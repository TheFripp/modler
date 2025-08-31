/**
 * Container - Organizational object for grouping and managing child objects
 * Containers have no geometry but provide structural organization and transformation control
 */
class Container extends THREE.Object3D {
    constructor(name = 'Container', objectManager = null, materialManager = null, sceneManager = null, autoLayoutManager = null) {
        super();
        
        this.type = 'Container';
        this.name = name;
        this.isContainer = true;
        
        // Centralized system references
        this.objectManager = objectManager;
        this.materialManager = materialManager;
        this.sceneManager = sceneManager;
        this.autoLayoutManager = autoLayoutManager;
        
        // Face detection system for consistent coordinate handling
        this.faceDetection = new FaceDetectionSystem();
        
        // Container properties with dimensions
        this.userData = {
            id: this.generateId(),
            type: 'container',
            selectable: true,
            visible: true,
            width: 4,  // Default container size
            height: 1,
            depth: 4,
            fillMode: {
                x: false,
                y: false,
                z: false
            },
            distributionMode: 'none', // 'none', 'even', 'center' - default to none to avoid issues
            alignmentMode: 'none', // 'none', 'left', 'center', 'right', 'top', 'bottom'
            padding: 0, // Default uniform padding
            paddingMode: 'uniform', // 'uniform' or 'separate'
            paddingX: 0,
            paddingY: 0,
            paddingZ: 0
        };
        
        // Container geometry and materials
        this.geometry = null;
        this.material = null;
        
        // Bounding box for visualization
        this.boundingBox = new THREE.Box3();
        this.boundingBoxHelper = null;
        
        // Child management
        this.childObjects = new Set();
        
        // Create container geometry
        this.createContainerGeometry();
        
        // Initialize auto layout if AutoLayoutManager is available
        if (this.autoLayoutManager) {
            this.autoLayoutManager.initializeContainerLayout(this);
        }
        
        this.updateBoundingBox();
    }
    
    generateId() {
        if (this.objectManager) {
            return this.objectManager.generateId('container');
        }
        // Fallback for backward compatibility
        return 'container_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Container Geometry Methods
    createContainerGeometry() {
        // Create box geometry for edge detection
        const boxGeometry = new THREE.BoxGeometry(
            this.userData.width, 
            this.userData.height, 
            this.userData.depth
        );
        
        // Create edges geometry to get clean wireframe without triangles
        const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
        
        // Create line material for clean edges - make it very subtle or invisible
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.1, // Make it almost invisible - only for selection, not visualization
            visible: false // Hide container geometry - only show bounding box when selected
        });
        
        // Create the line segments and add it to this container
        const containerLines = new THREE.LineSegments(edgesGeometry, lineMaterial);
        containerLines.userData = {
            isContainerGeometry: true,
            parentContainer: this,
            selectable: false, // Don't use edges for selection
            id: this.userData.id,
            type: 'container',
            width: this.userData.width,
            height: this.userData.height,
            depth: this.userData.depth
        };
        
        // Create invisible box mesh for full volume selection detection
        const invisibleMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            visible: false
        });
        
        const containerVolume = new THREE.Mesh(boxGeometry.clone(), invisibleMaterial);
        // The volume will be positioned relative to the container's local space
        // The bounding box calculation will handle world positioning
        containerVolume.userData = {
            isContainerVolume: true,
            parentContainer: this,
            selectable: true, // Use this for selection instead of edges
            id: this.userData.id,
            type: 'container',
            width: this.userData.width,
            height: this.userData.height,
            depth: this.userData.depth
        };
        
        this.add(containerLines);
        this.add(containerVolume);
        
        // Store references for later disposal
        this.geometry = boxGeometry;
        this.edgesGeometry = edgesGeometry;
        this.material = lineMaterial;
        
        // console.log(`CONTAINER: Created clean wireframe geometry for container ${this.userData.id}`);
    }
    
    updateContainerGeometry() {
        // Remove existing geometry
        const existingLines = this.children.find(child => child.userData.isContainerGeometry);
        if (existingLines) {
            this.remove(existingLines);
            if (existingLines.geometry) existingLines.geometry.dispose();
            if (existingLines.material) existingLines.material.dispose();
        }
        
        // Remove existing volume geometry
        const existingVolume = this.children.find(child => child.userData.isContainerVolume);
        if (existingVolume) {
            this.remove(existingVolume);
            if (existingVolume.geometry) existingVolume.geometry.dispose();
            if (existingVolume.material) existingVolume.material.dispose();
        }
        
        // Dispose of stored geometry references
        if (this.geometry) this.geometry.dispose();
        if (this.edgesGeometry) this.edgesGeometry.dispose();
        if (this.material) this.material.dispose();
        
        // Create new geometry with updated dimensions
        this.createContainerGeometry();
        
        // Update bounding box
        this.updateBoundingBox();
        
        // console.log(`CONTAINER: Updated geometry for container ${this.userData.id}`);
    }
    
    // Method to resize container (for use by push/pull tool)
    resize(newWidth, newHeight, newDepth) {
        this.userData.width = Math.max(0.1, newWidth);
        this.userData.height = Math.max(0.1, newHeight);  
        this.userData.depth = Math.max(0.1, newDepth);
        
        this.updateContainerGeometry();
        
        // Apply container properties to reposition children based on new dimensions
        this.applyContainerProperties();
        
        // Trigger auto layout recalculation for children
        if (this.autoLayoutManager) {
            this.autoLayoutManager.onContainerChildrenChanged(this);
        }
        
        // console.log(`CONTAINER: Resized container ${this.userData.id} to ${newWidth}x${newHeight}x${newDepth}`);
    }
    
    // Child Management
    addChild(object) {
        if (!object || object === this) {
            console.log('CONTAINER: Cannot add null object or self as child');
            return;
        }
        
        console.log(`CONTAINER: Adding child ${object.userData.id} to container ${this.userData.id}`);
        
        // Clear any existing face highlights before adding object
        this.clearAllFaceHighlights();
        
        // Remove from current parent if any
        if (object.parent && object.parent !== this) {
            console.log(`CONTAINER: Removing ${object.userData.id} from current parent`);
            if (object.parent.isContainer) {
                object.parent.removeChild(object);
            } else {
                object.parent.remove(object);
            }
        }
        
        // Store object's world position before adding to container
        const worldPosition = object.getWorldPosition(new THREE.Vector3());
        
        // Add as child
        this.add(object);
        this.childObjects.add(object);
        
        // Convert world position to local position relative to container
        this.worldToLocal(worldPosition);
        object.position.copy(worldPosition);
        
        // Update object's parent reference
        object.userData.parentContainer = this;
        
        // Initialize auto layout for child object if AutoLayoutManager is available
        if (this.autoLayoutManager && !object.userData.layout) {
            this.autoLayoutManager.initializeObjectLayout(object);
        }
        
        // Auto-resize container to fit all children
        this.resizeToFitChildren();
        
        // Update bounding box and apply container properties
        this.updateBoundingBox();
        this.applyContainerProperties();
        
        // Trigger auto layout recalculation
        if (this.autoLayoutManager) {
            this.autoLayoutManager.onContainerChildrenChanged(this);
        }
        
        // Set up change notification for child
        object.userData.notifyParentOnChange = () => {
            this.onChildChanged();
        };
        
        console.log(`CONTAINER: Successfully added ${object.userData.id} to container ${this.userData.id}. Container now has ${this.childObjects.size} children`);
    }
    
    removeChild(object) {
        if (!object || !this.childObjects.has(object)) return;
        
        // Remove from Three.js hierarchy
        this.remove(object);
        this.childObjects.delete(object);
        
        // Clear parent reference
        delete object.userData.parentContainer;
        
        // Update bounding box
        this.updateBoundingBox();
        
        // Trigger auto layout recalculation
        if (this.autoLayoutManager) {
            this.autoLayoutManager.onContainerChildrenChanged(this);
        }
        
        console.log(`Removed object ${object.userData.id} from container ${this.userData.id}`);
    }
    
    onChildChanged() {
        console.log(`CONTAINER: Child changed, updating bounding box for ${this.userData.id}`);
        this.updateBoundingBox();
        
        // Update highlights for container and child objects if we have access to selection manager
        if (window.modlerApp && window.modlerApp.selectionManager) {
            window.modlerApp.selectionManager.updateContainerAndChildHighlights(this);
        }
        
        // Notify parent container if this container is also a child
        if (this.userData.parentContainer && this.userData.parentContainer.onChildChanged) {
            this.userData.parentContainer.onChildChanged();
        }
    }
    
    getChildren() {
        return Array.from(this.childObjects);
    }
    
    hasChildren() {
        return this.childObjects.size > 0;
    }
    
    // Bounding Box Management
    updateBoundingBox() {
        // Don't update bounding box while being moved - prevents stretching
        if (this.userData._isBeingMoved) {
            console.log(`CONTAINER: Skipping bounding box update for ${this.userData.id} - being moved`);
            return;
        }
        
        // Calculate bounding box based on children positions in world space
        this.boundingBox.makeEmpty();
        
        if (this.childObjects.size === 0) {
            // Empty container - use container's position and dimensions
            const containerCenter = new THREE.Vector3();
            this.getWorldPosition(containerCenter);
            this.boundingBox.setFromCenterAndSize(
                containerCenter,
                new THREE.Vector3(this.userData.width, this.userData.height, this.userData.depth)
            );
        } else {
            // Container with children - calculate bounding box from actual child positions
            this.childObjects.forEach(child => {
                // Skip highlight objects and other non-geometric objects
                if (child.userData && (
                    child.userData.isHighlight || 
                    child.userData.isFaceHighlight ||
                    child.userData.isTemporary ||
                    child.userData.type === 'highlight' ||
                    child.userData.isHelper ||
                    child.userData.isContainerBounds
                )) {
                    return;
                }
                
                // Calculate bounding box from child's actual geometry in world coordinates
                const childBox = this.getObjectGeometryBounds(child);
                if (!childBox.isEmpty()) {
                    this.boundingBox.union(childBox);
                }
            });
        }
        
        // Update visual bounding box if visible
        this.updateBoundingBoxHelper();
        
        // Clean up any legacy proxy objects
        this.cleanupLegacyProxy();
    }
    
    updateBoundingBoxHelper() {
        // Never show bounding box helper for empty containers (per user request)
        // Only show for containers with children
        const shouldShowHelper = this.userData.isSelected && this.childObjects.size > 0;
        const hasHelper = this.boundingBoxHelper !== null;
        
        if (!shouldShowHelper && hasHelper) {
            // Remove helper when not needed
            this.disposeBoundingBoxHelper();
        } else if (shouldShowHelper && !hasHelper) {
            // Create helper when needed
            this.createBoundingBoxHelper();
        } else if (shouldShowHelper && hasHelper) {
            // Update existing helper (recreate to reflect new bounds)
            this.disposeBoundingBoxHelper();
            this.createBoundingBoxHelper();
        }
    }
    
    disposeBoundingBoxHelper() {
        if (!this.boundingBoxHelper) return;
        
        // Safe removal from scene
        if (this.boundingBoxHelper.parent) {
            this.boundingBoxHelper.parent.remove(this.boundingBoxHelper);
        }
        
        // Safe geometry disposal
        if (this.boundingBoxHelper.geometry) {
            this.boundingBoxHelper.geometry.dispose();
        }
        
        // Safe material disposal
        if (this.boundingBoxHelper.material) {
            this.boundingBoxHelper.material.dispose();
        }
        
        this.boundingBoxHelper = null;
    }
    
    // Temporarily hide the bounding box helper during operations like move
    hideBoundingBoxHelper() {
        if (this.boundingBoxHelper) {
            this.boundingBoxHelper.visible = false;
            console.log(`CONTAINER: Hiding bounding box helper for ${this.userData.id}`);
        }
    }
    
    // Show the bounding box helper again after operations complete
    showBoundingBoxHelper() {
        if (this.boundingBoxHelper && this.userData.isSelected) {
            this.boundingBoxHelper.visible = true;
            console.log(`CONTAINER: Showing bounding box helper for ${this.userData.id}`);
        }
    }
    
    // Improved setSelected method to prevent redundant calls
    setSelected(selected) {
        if (this.userData.isSelected === selected) return; // Prevent redundant calls
        
        this.userData.isSelected = selected;
        this.updateBoundingBoxHelper();
        
        // Notify selection manager for consistency
        if (window.modlerApp && window.modlerApp.selectionManager) {
            const selectionManager = window.modlerApp.selectionManager;
            if (selected) {
                selectionManager.selectedObjects.add(this);
            } else {
                selectionManager.selectedObjects.delete(this);
            }
        }
    }
    
    createBoundingBoxHelper() {
        if (this.childObjects.size === 0) return;
        
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        this.boundingBox.getSize(size);
        this.boundingBox.getCenter(center);
        
        // Create edges-only wireframe using LineSegments for better control
        const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
        const material = this.materialManager ? 
            this.materialManager.getMaterial('line_basic', {
                color: 0x0078d4,
                transparent: true,
                opacity: 0.8,
                linewidth: 2
            }, 'ui', 'container') :
            new THREE.LineBasicMaterial({
                color: 0x0078d4,
                transparent: true,
                opacity: 0.8,
                linewidth: 2
            });
        
        this.boundingBoxHelper = new THREE.LineSegments(edges, material);
        // Convert bounding box center from world to local container space for proper positioning
        const localCenter = this.worldToLocal(center.clone());
        this.boundingBoxHelper.position.copy(localCenter);
        this.boundingBoxHelper.userData.isHelper = true;
        this.boundingBoxHelper.userData.isContainerBounds = true;
        this.boundingBoxHelper.renderOrder = 999; // Render on top
        
        // Debug logging can be added here if needed for troubleshooting
        
        // Add as child to container for proper coordinate system hierarchy
        this.add(this.boundingBoxHelper);
        
        // console.log(`Created bounding box for container ${this.userData.id} around ${this.childObjects.size} objects`);
    }
    
    // Legacy proxy cleanup - containers now use direct geometry
    cleanupLegacyProxy() {
        if (this.selectableProxy) {
            if (this.selectableProxy.parent) {
                this.selectableProxy.parent.remove(this.selectableProxy);
            }
            if (this.selectableProxy.geometry) {
                this.selectableProxy.geometry.dispose();
            }
            if (this.selectableProxy.material) {
                this.selectableProxy.material.dispose();
            }
            this.selectableProxy = null;
        }
    }
    
    // Container Properties Application
    applyContainerProperties() {
        if (this.childObjects.size === 0) return;
        
        // Apply fill modes
        this.applyFillModes();
        
        // Apply distribution
        this.applyDistribution();
        
        // Apply alignment
        this.applyAlignment();
    }
    
    applyFillModes() {
        const containerSize = new THREE.Vector3();
        this.boundingBox.getSize(containerSize);
        
        this.childObjects.forEach(child => {
            if (!child.userData) return;
            
            // Apply X-axis fill
            if (this.userData.fillMode.x && child.userData.width !== undefined) {
                child.userData.width = containerSize.x;
                this.updateChildGeometry(child);
            }
            
            // Apply Y-axis fill
            if (this.userData.fillMode.y && child.userData.height !== undefined) {
                child.userData.height = containerSize.y;
                this.updateChildGeometry(child);
            }
            
            // Apply Z-axis fill
            if (this.userData.fillMode.z && child.userData.depth !== undefined) {
                child.userData.depth = containerSize.z;
                this.updateChildGeometry(child);
            }
        });
    }
    
    applyDistribution() {
        if (this.userData.distributionMode === 'none' || this.childObjects.size === 0) return;
        
        // Clear face highlights before moving objects to prevent stuck highlights
        this.clearAllFaceHighlights();
        
        const children = Array.from(this.childObjects);
        const containerCenter = new THREE.Vector3();
        const containerSize = new THREE.Vector3();
        this.boundingBox.getCenter(containerCenter);
        this.boundingBox.getSize(containerSize);
        
        if (this.userData.distributionMode === 'even' && children.length > 1) {
            // Distribute children evenly along X-axis
            const spacing = containerSize.x / children.length;
            children.forEach((child, index) => {
                const newX = containerCenter.x - containerSize.x/2 + spacing * (index + 0.5);
                child.position.x = newX;
            });
        } else if (this.userData.distributionMode === 'center') {
            // Center all children at container center
            children.forEach(child => {
                child.position.x = containerCenter.x;
                child.position.z = containerCenter.z;
            });
        }
        
        // Clear highlights again after moving objects to clean up any new stuck highlights
        setTimeout(() => {
            this.clearAllFaceHighlights();
        }, 10);
    }
    
    applyAlignment() {
        if (this.userData.alignmentMode === 'none') return;
        
        const containerCenter = new THREE.Vector3();
        this.boundingBox.getCenter(containerCenter);
        const children = Array.from(this.childObjects);
        
        // Sort children by hierarchy order for consistent stacking
        children.sort((a, b) => {
            const aIndex = a.parent ? Array.from(a.parent.children).indexOf(a) : 0;
            const bIndex = b.parent ? Array.from(b.parent.children).indexOf(b) : 0;
            return aIndex - bIndex;
        });
        
        switch (this.userData.alignmentMode) {
            case 'center':
                children.forEach(child => {
                    child.position.x = containerCenter.x;
                    child.position.z = containerCenter.z;
                });
                break;
            case 'left':
                this.stackObjectsFromLeft(children);
                break;
            case 'right':
                this.stackObjectsFromRight(children);
                break;
            case 'front':
                this.stackObjectsFromFront(children);
                break;
            case 'back':
                this.stackObjectsFromBack(children);
                break;
            case 'top':
                children.forEach(child => {
                    const childHeight = child.userData.height || 0;
                    child.position.y = this.boundingBox.max.y - childHeight / 2;
                });
                break;
            case 'bottom':
                children.forEach(child => {
                    const childHeight = child.userData.height || 0;
                    child.position.y = this.boundingBox.min.y + childHeight / 2;
                });
                break;
        }
    }
    
    resizeToFitChildren() {
        if (this.childObjects.size === 0) return;
        
        // Don't auto-resize while being moved - prevents stretching
        if (this.userData._isBeingMoved) {
            console.log(`CONTAINER: Skipping auto-resize for ${this.userData.id} - being moved`);
            return;
        }
        
        // Clear any stuck face highlights before resizing
        this.clearAllFaceHighlights();
        
        // Calculate bounding box of all children in local coordinates (relative to this container)
        let childrenBounds = new THREE.Box3();
        childrenBounds.makeEmpty();
        
        this.childObjects.forEach(child => {
            // Skip highlight objects and other non-geometric objects
            if (child.userData && (
                child.userData.isHighlight || 
                child.userData.isFaceHighlight ||
                child.userData.isTemporary ||
                child.userData.type === 'highlight' ||
                child.userData.isHelper ||
                child.userData.isContainerBounds
            )) {
                return;
            }
            
            // Use the new method to get only geometry bounds (already in local space)
            const childBox = this.getObjectGeometryBounds(child);
            
            if (!childBox.isEmpty()) {
                childrenBounds.union(childBox);
            }
        });
        
        if (childrenBounds.isEmpty()) return;
        
        // Get padding values based on padding mode
        const paddingX = this.userData.paddingMode === 'uniform' ? this.userData.padding : this.userData.paddingX;
        const paddingY = this.userData.paddingMode === 'uniform' ? this.userData.padding : this.userData.paddingY;
        const paddingZ = this.userData.paddingMode === 'uniform' ? this.userData.padding : this.userData.paddingZ;
        
        const childrenSize = new THREE.Vector3();
        const childrenCenter = new THREE.Vector3();
        childrenBounds.getSize(childrenSize);
        childrenBounds.getCenter(childrenCenter);
        
        // Calculate required container dimensions with user-defined padding
        const newWidth = Math.max(childrenSize.x + paddingX * 2, 0.1);
        const newHeight = Math.max(childrenSize.y + paddingY * 2, 0.1);
        const newDepth = Math.max(childrenSize.z + paddingZ * 2, 0.1);
        
        console.log(`CONTAINER: Auto-resizing ${this.userData.id} from ${this.userData.width}x${this.userData.height}x${this.userData.depth} to ${newWidth.toFixed(2)}x${newHeight.toFixed(2)}x${newDepth.toFixed(2)}`);
        console.log(`CONTAINER: Children local bounds center:`, childrenCenter);
        
        // Update container dimensions
        this.userData.width = newWidth;
        this.userData.height = newHeight;
        this.userData.depth = newDepth;
        
        // Don't move the container - the objects should stay where they are
        // Only update the container geometry to the new size
        this.updateContainerGeometry();
    }
    
    stackObjectsFromFront(children) {
        let currentZ = this.boundingBox.min.z;
        
        children.forEach(child => {
            let childDepth = 0;
            if (child.userData && child.userData.depth) {
                childDepth = child.userData.depth;
            } else if (child.geometry) {
                const childBox = new THREE.Box3().setFromObject(child);
                childDepth = childBox.max.z - childBox.min.z;
            }
            
            child.position.z = currentZ + childDepth / 2;
            currentZ += childDepth;
        });
    }
    
    stackObjectsFromBack(children) {
        let currentZ = this.boundingBox.max.z;
        
        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            
            let childDepth = 0;
            if (child.userData && child.userData.depth) {
                childDepth = child.userData.depth;
            } else if (child.geometry) {
                const childBox = new THREE.Box3().setFromObject(child);
                childDepth = childBox.max.z - childBox.min.z;
            }
            
            child.position.z = currentZ - childDepth / 2;
            currentZ -= childDepth;
        }
    }
    
    stackObjectsFromLeft(children) {
        let currentX = this.boundingBox.min.x;
        
        children.forEach(child => {
            // Get child's width (either from userData or calculate from geometry)
            let childWidth = 0;
            if (child.userData && child.userData.width) {
                childWidth = child.userData.width;
            } else if (child.geometry) {
                const childBox = new THREE.Box3().setFromObject(child);
                childWidth = childBox.max.x - childBox.min.x;
            }
            
            // Position child at current X + half its width (to center it at the edge)
            child.position.x = currentX + childWidth / 2;
            
            // Move currentX to the right edge of this object
            currentX += childWidth;
        });
    }
    
    stackObjectsFromRight(children) {
        let currentX = this.boundingBox.max.x;
        
        // Process children in reverse order for right alignment
        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            
            // Get child's width
            let childWidth = 0;
            if (child.userData && child.userData.width) {
                childWidth = child.userData.width;
            } else if (child.geometry) {
                const childBox = new THREE.Box3().setFromObject(child);
                childWidth = childBox.max.x - childBox.min.x;
            }
            
            // Position child at current X - half its width
            child.position.x = currentX - childWidth / 2;
            
            // Move currentX to the left edge of this object
            currentX -= childWidth;
        }
    }
    
    updateChildGeometry(child) {
        if (!child.geometry) return;
        
        // Update geometry based on child type
        if (child.geometry instanceof THREE.BoxGeometry) {
            const newGeometry = new THREE.BoxGeometry(
                child.userData.width || 1,
                child.userData.height || 1,
                child.userData.depth || 1
            );
            child.geometry.dispose();
            child.geometry = newGeometry;
        } else if (child.geometry instanceof THREE.CylinderGeometry && child.userData.radius) {
            const newGeometry = new THREE.CylinderGeometry(
                child.userData.radius,
                child.userData.radius,
                child.userData.height || 1
            );
            child.geometry.dispose();
            child.geometry = newGeometry;
        }
        // Add other geometry types as needed
    }
    
    // Selection and Visibility
    setSelected(selected) {
        this.userData.isSelected = selected;
        this.updateBoundingBoxHelper();
    }
    
    setVisible(visible) {
        this.userData.visible = visible;
        this.visible = visible;
        
        // Also affect children visibility
        this.childObjects.forEach(child => {
            child.visible = visible;
        });
    }
    
    // Container Properties Setters
    setFillMode(axis, enabled) {
        this.userData.fillMode[axis] = enabled;
        this.applyContainerProperties();
    }
    
    setDistributionMode(mode) {
        this.userData.distributionMode = mode;
        
        // Clear all stuck face highlights from all child objects
        this.clearAllFaceHighlights();
        
        // If switching to 'none', resize container to fit objects in their current positions
        if (mode === 'none') {
            this.resizeToFitChildren();
        }
        
        this.applyContainerProperties();
    }
    
    setAlignmentMode(mode) {
        this.userData.alignmentMode = mode;
        this.applyContainerProperties();
    }
    
    setPadding(padding) {
        this.userData.padding = Math.max(0, padding);
        if (this.userData.paddingMode === 'uniform') {
            this.resizeToFitChildren();
        }
    }
    
    setPaddingMode(mode) {
        this.userData.paddingMode = mode;
        if (mode === 'uniform') {
            // Copy current padding to separate values when switching to uniform
            this.userData.paddingX = this.userData.padding;
            this.userData.paddingY = this.userData.padding;
            this.userData.paddingZ = this.userData.padding;
        }
        this.resizeToFitChildren();
    }
    
    setPaddingAxis(axis, value) {
        const padding = Math.max(0, value);
        switch(axis) {
            case 'x':
                this.userData.paddingX = padding;
                break;
            case 'y':
                this.userData.paddingY = padding;
                break;
            case 'z':
                this.userData.paddingZ = padding;
                break;
        }
        if (this.userData.paddingMode === 'separate') {
            this.resizeToFitChildren();
        }
    }
    
    getObjectGeometryBounds(object) {
        // Calculate bounding box from object's actual geometry only, excluding highlights
        const bounds = new THREE.Box3();
        
        // Handle objects with userData dimensions first (more accurate)
        if (object.userData && object.userData.width !== undefined) {
            const width = object.userData.width || 1;
            const height = object.userData.height || 1;
            const depth = object.userData.depth || 1;
            
            // Get object's world transform for consistent coordinate system
            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
            
            // Calculate world-space dimensions
            const worldWidth = width * worldScale.x;
            const worldHeight = height * worldScale.y;
            const worldDepth = depth * worldScale.z;
            
            // Create bounds using world coordinates
            bounds.setFromCenterAndSize(
                worldPosition,
                new THREE.Vector3(worldWidth, worldHeight, worldDepth)
            );
            
            return bounds;
        }
        
        // Fallback: calculate from geometry, but only include actual geometry children
        if (object.geometry) {
            // Direct geometry objects
            bounds.setFromObject(object);
        } else {
            // Objects that might have geometry children - traverse but exclude highlights
            object.traverse(child => {
                if (child.geometry && child !== object) {
                    // Skip highlight objects
                    if (child.userData && (
                        child.userData.isHighlight || 
                        child.userData.isFaceHighlight ||
                        child.userData.isTemporary ||
                        child.userData.type === 'highlight' ||
                        child.userData.isHelper ||
                        child.userData.isContainerBounds
                    )) {
                        return;
                    }
                    
                    const childBounds = new THREE.Box3().setFromObject(child);
                    bounds.union(childBounds);
                }
            });
        }
        
        return bounds;
    }
    
    clearAllFaceHighlights() {
        // Use centralized highlight manager for consistent face highlight clearing
        if (window.modlerApp && window.modlerApp.highlightManager) {
            const highlightManager = window.modlerApp.highlightManager;
            
            // Clear all face highlights using available methods
            highlightManager.clearFaceHoverHighlights();
            highlightManager.clearTemporaryHighlights();
            
            console.log('CONTAINER: Cleared all face highlights through centralized highlight manager');
        }
        
        // Clear any legacy face highlight references
        if (this.faceHighlight) {
            if (this.faceHighlight.parent) {
                this.faceHighlight.parent.remove(this.faceHighlight);
            }
            if (this.faceHighlight.geometry) {
                this.faceHighlight.geometry.dispose();
            }
            if (this.faceHighlight.material) {
                this.faceHighlight.material.dispose();
            }
            this.faceHighlight = null;
        }
        
        // Clear legacy face highlights from child objects
        this.childObjects.forEach(child => {
            if (child.faceHighlight) {
                if (child.faceHighlight.parent) {
                    child.faceHighlight.parent.remove(child.faceHighlight);
                }
                if (child.faceHighlight.geometry) {
                    child.faceHighlight.geometry.dispose();
                }
                if (child.faceHighlight.material) {
                    child.faceHighlight.material.dispose();
                }
                child.faceHighlight = null;
            }
        });
    }
    
    // Cleanup
    dispose() {
        // Remove bounding box helper
        if (this.boundingBoxHelper && this.boundingBoxHelper.parent) {
            this.boundingBoxHelper.parent.remove(this.boundingBoxHelper);
            this.boundingBoxHelper.geometry.dispose();
            this.boundingBoxHelper.material.dispose();
        }
        
        // Remove selectable proxy
        if (this.selectableProxy && this.selectableProxy.parent) {
            this.selectableProxy.parent.remove(this.selectableProxy);
            this.selectableProxy.geometry.dispose();
            this.selectableProxy.material.dispose();
        }
        
        // Clear children references
        this.childObjects.forEach(child => {
            delete child.userData.parentContainer;
        });
        this.childObjects.clear();
    }
    
    // Auto Layout Integration Methods
    enableAutoLayout(direction = 'horizontal', config = {}) {
        if (!this.autoLayoutManager) {
            console.warn('CONTAINER: AutoLayoutManager not available, cannot enable auto layout');
            return;
        }
        
        const layoutConfig = {
            direction,
            ...config
        };
        
        this.autoLayoutManager.updateContainerLayout(this, layoutConfig);
        console.log(`CONTAINER: Enabled auto layout for ${this.userData.id} with direction: ${direction}`);
    }
    
    disableAutoLayout() {
        if (!this.autoLayoutManager) return;
        
        this.autoLayoutManager.updateContainerLayout(this, { direction: 'none' });
        console.log(`CONTAINER: Disabled auto layout for ${this.userData.id}`);
    }
    
    updateLayoutConfig(updates) {
        if (!this.autoLayoutManager) {
            console.warn('CONTAINER: AutoLayoutManager not available, cannot update layout config');
            return;
        }
        
        this.autoLayoutManager.updateContainerLayout(this, updates);
        console.log(`CONTAINER: Updated layout config for ${this.userData.id}:`, updates);
    }
    
    getLayoutConfig() {
        return this.autoLayoutManager?.getLayoutConfig(this) || null;
    }
    
    isAutoLayoutEnabled() {
        return this.autoLayoutManager?.isAutoLayoutEnabled(this) || false;
    }
    
    showLayoutGuides() {
        if (this.autoLayoutManager) {
            this.autoLayoutManager.showLayoutGuides(this);
        }
    }
    
    hideLayoutGuides() {
        if (this.autoLayoutManager) {
            this.autoLayoutManager.hideLayoutGuides(this);
        }
    }
}

// Export for module use
window.Container = Container;