/**
 * AutoLayoutManager - Centralized auto layout system for containers
 * 
 * Provides Figma-style auto layout capabilities with automatic positioning,
 * spacing, and sizing of child objects based on configurable layout rules.
 */

console.log('AUTOLAYOUT: AutoLayoutManager.js file loaded');
class AutoLayoutManager {
    constructor(sceneManager, objectManager = null, stateManager = null, configManager = null, highlightManager = null) {
        this.sceneManager = sceneManager;
        this.objectManager = objectManager;
        this.stateManager = stateManager;
        this.configManager = configManager;
        this.highlightManager = highlightManager;
        
        // Layout calculation cache and invalidation system
        this.layoutCache = new Map(); // containerID -> layout result
        this.invalidationQueue = new Set(); // containers needing layout updates
        this.isCalculating = false; // prevent recursive layouts
        this.calculationFrameId = null;
        
        // Default layout configuration
        this.defaultConfig = this.getDefaultLayoutConfig();
        
        // Bind methods for event callbacks
        this.onObjectChanged = this.onObjectChanged.bind(this);
        this.onContainerChildrenChanged = this.onContainerChildrenChanged.bind(this);
        
        console.log('AUTOLAYOUT: AutoLayoutManager initialized');
    }
    
    getDefaultLayoutConfig() {
        // Default configuration - can be extended later with ConfigurationManager integration
        return {
            container: {
                direction: 'none', // 'horizontal' | 'vertical' | 'none'
                spacing: 8,
                padding: { top: 8, right: 8, bottom: 8, left: 8 },
                alignItems: 'start', // 'start' | 'center' | 'end' | 'stretch'
                justifyContent: 'start', // 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly'
                autoResize: 'none', // 'none' | 'width' | 'height' | 'both'
                minWidth: 10,
                minHeight: 10,
                maxWidth: 1000,
                maxHeight: 1000
            },
            child: {
                width: 'auto', // 'fixed' | 'fill' | 'auto'
                height: 'auto',
                fixedWidth: null,
                fixedHeight: null,
                fillWeight: 1,
                margin: { top: 0, right: 0, bottom: 0, left: 0 },
                alignSelf: null, // null uses container alignItems
                exclude: false
            }
        };
    }
    
    // Layout Configuration Management
    initializeContainerLayout(container, config = {}) {
        if (!container || !container.isContainer) {
            console.warn('AUTOLAYOUT: Cannot initialize layout on non-container object');
            return;
        }
        
        // Initialize layout configuration
        if (!container.userData.layout) {
            container.userData.layout = {};
        }
        
        // Merge with defaults
        const layoutConfig = {
            ...this.defaultConfig.container,
            ...config
        };
        
        Object.assign(container.userData.layout, layoutConfig);
        
        console.log(`AUTOLAYOUT: Initialized layout for container ${container.userData.id}:`, layoutConfig);
        
        // Store in state manager if available
        if (this.stateManager) {
            this.stateManager.set(`autolayout.containers.${container.userData.id}`, layoutConfig);
        }
        
        // Trigger initial layout if direction is set
        if (layoutConfig.direction !== 'none') {
            this.invalidateLayout(container);
        }
    }
    
    initializeObjectLayout(object, config = {}) {
        if (!object || !object.userData) {
            console.warn('AUTOLAYOUT: Cannot initialize layout on invalid object');
            return;
        }
        
        // Initialize layout configuration
        if (!object.userData.layout) {
            object.userData.layout = {};
        }
        
        // Merge with defaults
        const layoutConfig = {
            ...this.defaultConfig.child,
            ...config
        };
        
        Object.assign(object.userData.layout, layoutConfig);
        
        console.log(`AUTOLAYOUT: Initialized layout properties for object ${object.userData.id}:`, layoutConfig);
        
        // Invalidate parent container layout if this object is in one
        if (object.userData.parentContainer) {
            this.invalidateLayout(object.userData.parentContainer);
        }
    }
    
    updateContainerLayout(container, updates) {
        if (!container || !container.userData.layout) {
            console.warn('AUTOLAYOUT: Container not initialized for layout');
            return;
        }
        
        // Apply updates
        Object.assign(container.userData.layout, updates);
        
        // Update state manager
        if (this.stateManager) {
            this.stateManager.set(`autolayout.containers.${container.userData.id}`, container.userData.layout);
        }
        
        console.log(`AUTOLAYOUT: Updated container ${container.userData.id} layout:`, updates);
        
        // Invalidate and recalculate
        this.invalidateLayout(container);
    }
    
    updateObjectLayout(object, updates) {
        if (!object || !object.userData.layout) {
            console.warn('AUTOLAYOUT: Object not initialized for layout');
            return;
        }
        
        // Apply updates
        Object.assign(object.userData.layout, updates);
        
        console.log(`AUTOLAYOUT: Updated object ${object.userData.id} layout:`, updates);
        
        // Invalidate parent container layout
        if (object.userData.parentContainer) {
            this.invalidateLayout(object.userData.parentContainer);
        }
    }
    
    // Layout Calculation and Application
    invalidateLayout(container) {
        if (!container || !container.isContainer) return;
        
        // Clear cache for this container
        this.layoutCache.delete(container.userData.id);
        
        // Add to invalidation queue
        this.invalidationQueue.add(container);
        
        console.log(`AUTOLAYOUT: Invalidated layout for container ${container.userData.id}`);
        
        // Schedule layout calculation
        this.scheduleLayoutCalculation();
    }
    
    scheduleLayoutCalculation() {
        if (this.calculationFrameId) {
            cancelAnimationFrame(this.calculationFrameId);
        }
        
        this.calculationFrameId = requestAnimationFrame(() => {
            this.processLayoutQueue();
        });
    }
    
    processLayoutQueue() {
        if (this.isCalculating || this.invalidationQueue.size === 0) return;
        
        this.isCalculating = true;
        console.log(`AUTOLAYOUT: Processing ${this.invalidationQueue.size} layout updates`);
        
        // Process all invalidated containers
        const containersToUpdate = Array.from(this.invalidationQueue);
        this.invalidationQueue.clear();
        
        containersToUpdate.forEach(container => {
            this.calculateAndApplyLayout(container);
        });
        
        this.isCalculating = false;
        this.calculationFrameId = null;
    }
    
    calculateAndApplyLayout(container) {
        if (!container || !container.userData.layout || container.userData.layout.direction === 'none') {
            return;
        }
        
        console.log(`AUTOLAYOUT: Calculating layout for container ${container.userData.id}`);
        
        const layoutResult = this.calculateLayout(container);
        if (layoutResult) {
            this.applyLayout(container, layoutResult);
            this.layoutCache.set(container.userData.id, layoutResult);
        }
    }
    
    calculateLayout(container) {
        const config = container.userData.layout;
        const children = Array.from(container.childObjects || [])
            .filter(child => !child.userData.layout?.exclude);
        
        if (children.length === 0) return null;
        
        // Calculate available space
        const containerBounds = this.getContainerBounds(container);
        const padding = config.padding;
        
        const availableWidth = containerBounds.width - padding.left - padding.right;
        const availableHeight = containerBounds.height - padding.top - padding.bottom;
        
        console.log(`AUTOLAYOUT: Container ${container.userData.id} - Available space: ${availableWidth}x${availableHeight}`);
        
        // Calculate layout based on direction
        if (config.direction === 'horizontal') {
            return this.calculateHorizontalLayout(children, availableWidth, availableHeight, config);
        } else if (config.direction === 'vertical') {
            return this.calculateVerticalLayout(children, availableWidth, availableHeight, config);
        }
        
        return null;
    }
    
    calculateHorizontalLayout(children, availableWidth, availableHeight, config) {
        const spacing = config.spacing || 0;
        const totalSpacing = Math.max(0, children.length - 1) * spacing;
        let remainingWidth = availableWidth - totalSpacing;
        
        // Calculate child dimensions
        const childLayouts = [];
        let totalFillWeight = 0;
        
        // First pass: calculate fixed and auto sizes, count fill weights
        for (const child of children) {
            const childConfig = child.userData.layout || {};
            const childLayout = {
                object: child,
                width: 0,
                height: 0,
                x: 0,
                y: 0
            };
            
            // Calculate width
            if (childConfig.widthMode === 'fixed' && childConfig.fixedWidth) {
                childLayout.width = childConfig.fixedWidth;
                remainingWidth -= childLayout.width;
            } else if (childConfig.widthMode === 'auto') {
                childLayout.width = this.getObjectNaturalWidth(child);
                remainingWidth -= childLayout.width;
            } else if (childConfig.widthMode === 'fill') {
                totalFillWeight += childConfig.fillWeight || 1;
            }
            
            // Calculate height (cross-axis)
            if (childConfig.heightMode === 'fixed' && childConfig.fixedHeight) {
                childLayout.height = childConfig.fixedHeight;
            } else if (childConfig.heightMode === 'fill') {
                childLayout.height = availableHeight;
            } else {
                childLayout.height = this.getObjectNaturalHeight(child);
            }
            
            childLayouts.push(childLayout);
        }
        
        // Second pass: distribute remaining space to fill objects
        if (totalFillWeight > 0 && remainingWidth > 0) {
            const fillUnitWidth = remainingWidth / totalFillWeight;
            
            for (const layout of childLayouts) {
                const childConfig = layout.object.userData.layout || {};
                if (childConfig.widthMode === 'fill') {
                    layout.width = fillUnitWidth * (childConfig.fillWeight || 1);
                }
            }
        }
        
        // Third pass: calculate positions
        this.calculatePositions(childLayouts, availableWidth, availableHeight, config, 'horizontal');
        
        return {
            direction: 'horizontal',
            children: childLayouts,
            totalWidth: availableWidth,
            totalHeight: availableHeight
        };
    }
    
    calculateVerticalLayout(children, availableWidth, availableHeight, config) {
        const spacing = config.spacing || 0;
        const totalSpacing = Math.max(0, children.length - 1) * spacing;
        let remainingHeight = availableHeight - totalSpacing;
        
        // Calculate child dimensions
        const childLayouts = [];
        let totalFillWeight = 0;
        
        // First pass: calculate fixed and auto sizes, count fill weights
        for (const child of children) {
            const childConfig = child.userData.layout || {};
            const childLayout = {
                object: child,
                width: 0,
                height: 0,
                x: 0,
                y: 0
            };
            
            // Calculate height (main axis)
            if (childConfig.heightMode === 'fixed' && childConfig.fixedHeight) {
                childLayout.height = childConfig.fixedHeight;
                remainingHeight -= childLayout.height;
            } else if (childConfig.heightMode === 'auto') {
                childLayout.height = this.getObjectNaturalHeight(child);
                remainingHeight -= childLayout.height;
            } else if (childConfig.heightMode === 'fill') {
                totalFillWeight += childConfig.fillWeight || 1;
            }
            
            // Calculate width (cross-axis)
            if (childConfig.widthMode === 'fixed' && childConfig.fixedWidth) {
                childLayout.width = childConfig.fixedWidth;
            } else if (childConfig.widthMode === 'fill') {
                childLayout.width = availableWidth;
            } else {
                childLayout.width = this.getObjectNaturalWidth(child);
            }
            
            childLayouts.push(childLayout);
        }
        
        // Second pass: distribute remaining space to fill objects
        if (totalFillWeight > 0 && remainingHeight > 0) {
            const fillUnitHeight = remainingHeight / totalFillWeight;
            
            for (const layout of childLayouts) {
                const childConfig = layout.object.userData.layout || {};
                if (childConfig.heightMode === 'fill') {
                    layout.height = fillUnitHeight * (childConfig.fillWeight || 1);
                }
            }
        }
        
        // Third pass: calculate positions
        this.calculatePositions(childLayouts, availableWidth, availableHeight, config, 'vertical');
        
        return {
            direction: 'vertical',
            children: childLayouts,
            totalWidth: availableWidth,
            totalHeight: availableHeight
        };
    }
    
    calculatePositions(childLayouts, availableWidth, availableHeight, config, direction) {
        const spacing = config.spacing || 0;
        const padding = config.padding;
        
        if (direction === 'horizontal') {
            // Calculate main axis positions (X)
            let currentX = padding.left;
            const totalChildWidth = childLayouts.reduce((sum, layout) => sum + layout.width, 0);
            const totalSpacing = Math.max(0, childLayouts.length - 1) * spacing;
            const remainingSpace = availableWidth - totalChildWidth - totalSpacing;
            
            // Apply justifyContent
            switch (config.justifyContent) {
                case 'center':
                    currentX += remainingSpace / 2;
                    break;
                case 'end':
                    currentX += remainingSpace;
                    break;
                case 'space-between':
                    if (childLayouts.length > 1) {
                        const extraSpacing = remainingSpace / (childLayouts.length - 1);
                        childLayouts.forEach((layout, index) => {
                            layout.x = currentX;
                            currentX += layout.width + spacing + extraSpacing;
                        });
                        return;
                    }
                    break;
                case 'space-around':
                    if (childLayouts.length > 0) {
                        const extraSpacing = remainingSpace / childLayouts.length;
                        currentX += extraSpacing / 2;
                        childLayouts.forEach((layout, index) => {
                            layout.x = currentX;
                            currentX += layout.width + spacing + extraSpacing;
                        });
                        return;
                    }
                    break;
            }
            
            // Default positioning (start, space-evenly, etc.)
            childLayouts.forEach(layout => {
                layout.x = currentX;
                currentX += layout.width + spacing;
            });
            
            // Calculate cross axis positions (Y)
            childLayouts.forEach(layout => {
                const childConfig = layout.object.userData.layout || {};
                const align = childConfig.alignSelf || config.alignItems;
                
                switch (align) {
                    case 'center':
                        layout.y = padding.top + (availableHeight - layout.height) / 2;
                        break;
                    case 'end':
                        layout.y = padding.top + availableHeight - layout.height;
                        break;
                    case 'stretch':
                        layout.y = padding.top;
                        layout.height = availableHeight;
                        break;
                    default: // 'start'
                        layout.y = padding.top;
                        break;
                }
            });
            
        } else { // vertical
            // Calculate main axis positions (Y)
            let currentY = padding.top;
            const totalChildHeight = childLayouts.reduce((sum, layout) => sum + layout.height, 0);
            const totalSpacing = Math.max(0, childLayouts.length - 1) * spacing;
            const remainingSpace = availableHeight - totalChildHeight - totalSpacing;
            
            // Apply justifyContent
            switch (config.justifyContent) {
                case 'center':
                    currentY += remainingSpace / 2;
                    break;
                case 'end':
                    currentY += remainingSpace;
                    break;
                case 'space-between':
                    if (childLayouts.length > 1) {
                        const extraSpacing = remainingSpace / (childLayouts.length - 1);
                        childLayouts.forEach((layout, index) => {
                            layout.y = currentY;
                            currentY += layout.height + spacing + extraSpacing;
                        });
                        return;
                    }
                    break;
            }
            
            // Default positioning
            childLayouts.forEach(layout => {
                layout.y = currentY;
                currentY += layout.height + spacing;
            });
            
            // Calculate cross axis positions (X)
            childLayouts.forEach(layout => {
                const childConfig = layout.object.userData.layout || {};
                const align = childConfig.alignSelf || config.alignItems;
                
                switch (align) {
                    case 'center':
                        layout.x = padding.left + (availableWidth - layout.width) / 2;
                        break;
                    case 'end':
                        layout.x = padding.left + availableWidth - layout.width;
                        break;
                    case 'stretch':
                        layout.x = padding.left;
                        layout.width = availableWidth;
                        break;
                    default: // 'start'
                        layout.x = padding.left;
                        break;
                }
            });
        }
    }
    
    applyLayout(container, layoutResult) {
        console.log(`AUTOLAYOUT: Applying layout to container ${container.userData.id}`);
        
        // Get container bounds to position objects relative to container's edges
        const containerBounds = new THREE.Box3().setFromObject(container);
        const containerMinX = containerBounds.min.x;
        const containerMinZ = containerBounds.min.z;
        
        layoutResult.children.forEach(childLayout => {
            const { object, x, y, width, height } = childLayout;
            
            // Calculate world position relative to container's minimum bounds
            // Layout coordinates (x, y) are relative to the top-left of the container's content area
            // Since Three.js positions objects by their center, we offset by half the object size
            const worldX = containerMinX + x + width / 2;
            const worldY = container.position.y; // Keep same Y level as container
            const worldZ = containerMinZ + y + height / 2;
            
            // Apply position
            object.position.set(worldX, worldY, worldZ);
            
            // Apply size if object supports it
            this.resizeObject(object, width, height);
            
            console.log(`AUTOLAYOUT: Positioned ${object.userData.id} at (${worldX.toFixed(2)}, ${worldY.toFixed(2)}, ${worldZ.toFixed(2)}) size ${width.toFixed(2)}x${height.toFixed(2)}`);
        });
        
        // Handle container auto-resize
        if (container.userData.layout.autoResize !== 'none') {
            this.resizeContainer(container, layoutResult);
        }
        
        // Notify scene manager of changes
        if (this.sceneManager) {
            this.sceneManager.notifyObjectChanged(container);
        }
    }
    
    // Utility Methods
    getContainerBounds(container) {
        // Get container bounding box
        const bounds = new THREE.Box3().setFromObject(container);
        return {
            width: bounds.max.x - bounds.min.x,
            height: bounds.max.z - bounds.min.z, // Using Z as 2D height
            depth: bounds.max.y - bounds.min.y
        };
    }
    
    getObjectNaturalWidth(object) {
        return object.userData.width || 2;
    }
    
    getObjectNaturalHeight(object) {
        return object.userData.depth || 2; // Using depth as 2D height
    }
    
    resizeObject(object, layoutWidth, layoutHeight, layoutDepth = null) {
        // In 2D layout, layoutHeight actually refers to depth (Z-axis)
        // layoutDepth is the actual Y-axis height when provided
        
        console.log(`AUTOLAYOUT: Resizing object ${object.userData.id} to layout dimensions: width=${layoutWidth}, height=${layoutHeight}, depth=${layoutDepth}`);
        
        // Determine final dimensions based on object's layout configuration
        const layout = object.userData.layout || {};
        let finalWidth = layoutWidth;
        let finalHeight = object.userData.height || 1; // Keep existing height if not specified
        let finalDepth = layoutHeight; // In 2D layout, height param is actually depth
        
        // If object has height layout configuration, use the calculated value
        if (layoutDepth !== null) {
            finalHeight = layoutDepth;
        } else if (layout.heightMode === 'fill') {
            // For vertical filling, use the container's height
            const containerBounds = this.getContainerBounds(object.userData.parentContainer);
            finalHeight = containerBounds.height;
        } else if (layout.heightMode === 'fixed' && layout.fixedHeight) {
            finalHeight = layout.fixedHeight;
        }
        
        console.log(`AUTOLAYOUT: Final dimensions for ${object.userData.id}: ${finalWidth.toFixed(2)} x ${finalHeight.toFixed(2)} x ${finalDepth.toFixed(2)}`);
        
        // Update object dimensions based on type
        if (object.geometry instanceof THREE.BoxGeometry) {
            const newGeometry = new THREE.BoxGeometry(finalWidth, finalHeight, finalDepth);
            object.geometry.dispose();
            object.geometry = newGeometry;
            
            // Update userData to reflect new dimensions
            object.userData.width = finalWidth;
            object.userData.height = finalHeight;
            object.userData.depth = finalDepth;
            
            console.log(`AUTOLAYOUT: Updated box geometry for ${object.userData.id}`);
        } else if (object.geometry instanceof THREE.CylinderGeometry) {
            // For cylinders, width/depth affect radius
            const radius = Math.min(finalWidth, finalDepth) / 2;
            const newGeometry = new THREE.CylinderGeometry(radius, radius, finalHeight);
            object.geometry.dispose();
            object.geometry = newGeometry;
            
            object.userData.radius = radius;
            object.userData.height = finalHeight;
            object.userData.width = finalWidth;
            object.userData.depth = finalDepth;
            
            console.log(`AUTOLAYOUT: Updated cylinder geometry for ${object.userData.id}`);
        }
        // Add support for other object types as needed
    }
    
    resizeContainer(container, layoutResult) {
        const config = container.userData.layout;
        const autoResize = config.autoResize;
        
        if (autoResize === 'width' || autoResize === 'both') {
            // Resize container width to fit content
            const contentWidth = layoutResult.totalWidth + config.padding.left + config.padding.right;
            const newWidth = Math.max(config.minWidth, Math.min(config.maxWidth, contentWidth));
            
            if (container.userData.width !== newWidth) {
                container.userData.width = newWidth;
                container.updateBoundingBox();
            }
        }
        
        if (autoResize === 'height' || autoResize === 'both') {
            // Resize container height to fit content
            const contentHeight = layoutResult.totalHeight + config.padding.top + config.padding.bottom;
            const newHeight = Math.max(config.minHeight, Math.min(config.maxHeight, contentHeight));
            
            if (container.userData.depth !== newHeight) {
                container.userData.depth = newHeight;
                container.updateBoundingBox();
            }
        }
    }
    
    // Event Handlers
    onObjectChanged(object) {
        // Called when any object changes - check if it affects auto layout
        if (object.userData.parentContainer && object.userData.parentContainer.userData.layout?.direction !== 'none') {
            console.log(`AUTOLAYOUT: Object ${object.userData.id} changed, invalidating parent container layout`);
            this.invalidateLayout(object.userData.parentContainer);
        }
    }
    
    onContainerChildrenChanged(container) {
        // Called when container children are added/removed
        if (container.userData.layout?.direction !== 'none') {
            console.log(`AUTOLAYOUT: Container ${container.userData.id} children changed, invalidating layout`);
            this.invalidateLayout(container);
        }
    }
    
    // Public API
    getLayoutConfig(container) {
        return container?.userData?.layout || null;
    }
    
    isAutoLayoutEnabled(container) {
        return container?.userData?.layout?.direction !== 'none';
    }
    
    toggleAutoLayout(container, enable, direction = 'horizontal') {
        if (!container || !container.isContainer) return;
        
        if (enable) {
            this.initializeContainerLayout(container, { direction });
        } else {
            this.updateContainerLayout(container, { direction: 'none' });
        }
    }
    
    // Visual Feedback Integration
    showLayoutGuides(container) {
        if (!this.highlightManager || !container) return;
        
        // Show layout direction indicators, spacing guides, etc.
        // This would integrate with the existing HighlightManager
        console.log(`AUTOLAYOUT: Showing layout guides for container ${container.userData.id}`);
    }
    
    hideLayoutGuides(container) {
        if (!this.highlightManager) return;
        
        this.highlightManager.clearTemporaryHighlights();
        console.log(`AUTOLAYOUT: Hidden layout guides for container ${container.userData.id}`);
    }
    
    // Cleanup
    dispose() {
        if (this.calculationFrameId) {
            cancelAnimationFrame(this.calculationFrameId);
        }
        
        this.layoutCache.clear();
        this.invalidationQueue.clear();
        
        console.log('AUTOLAYOUT: AutoLayoutManager disposed');
    }
}

// Export for module use
console.log('AUTOLAYOUT: Exporting AutoLayoutManager to window');
window.AutoLayoutManager = AutoLayoutManager;
console.log('AUTOLAYOUT: AutoLayoutManager is now available:', typeof window.AutoLayoutManager);