/**
 * Selection Manager - Centralized management of object selection and highlighting
 */
class SelectionManager {
    constructor(sceneManager, highlightManager) {
        this.sceneManager = sceneManager;
        this.highlightManager = highlightManager;
        
        // Initialize PropertyPanelManager for UI handling
        this.propertyPanelManager = new PropertyPanelManager(this, highlightManager);
        
        // Selection state
        this.selectedObjects = new Set();
        this.hoveredObject = null;
        this.selectedFace = null;
        this.hoveredFace = null;
        
        // Centralized hierarchical selection state
        this.hierarchicalState = {
            lastClickTime: 0,
            lastClickedObject: null,
            currentDepthMap: new Map(), // objectId -> depth level
            doubleClickThreshold: 400
        };
        
        // MANDATORY ARCHITECTURE PATTERN: Centralized UI synchronization
        this.uiSyncCallbacks = new Set();
        
        // Materials
        this.standardMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
        this.selectionMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x0078d4, 
            transparent: true, 
            opacity: 0.7 
        });
        
        // Event callbacks for hierarchy integration
        this.onSelectionChanged = null;
    }

    // Object Selection
    selectOnly(object) {
        this.clearSelection();
        this.addToSelection(object);
    }

    addToSelection(object) {
        if (!object || !object.userData.selectable) return;
        
        this.selectedObjects.add(object);
        this.applySelectionVisuals(object);
        this.propertyPanelManager.updatePropertyPanel();
        
        // Handle container selection
        if (object.isContainer) {
            object.setSelected(true);
        }
        
        // Highlight parent container when child is selected (visual only, don't add to selection)
        if (object.userData.parentContainer && !object.isContainer) {
            console.log('SELECTION: Also highlighting parent container:', object.userData.parentContainer.userData.id);
            this.highlightParentContainer(object.userData.parentContainer);
        }
        
        // Notify centralized highlight manager about selection changes
        if (this.highlightManager) {
            this.highlightManager.onSelectionChanged(Array.from(this.selectedObjects));
        }
        
        // Notify hierarchy panel
        if (this.onSelectionChanged) {
            this.onSelectionChanged();
        }
        
        // MANDATORY ARCHITECTURE PATTERN: Notify UI of selection changes
        this.notifyUISync('selection_added', { object });
        this.notifyUISync('selection_changed', { selectedObjects: Array.from(this.selectedObjects) });
        
        console.log('SELECTION: Added object', object.userData.id, 'to selection');
    }

    removeFromSelection(object) {
        if (this.selectedObjects.has(object)) {
            this.selectedObjects.delete(object);
            this.removeSelectionVisuals(object);
            
            // Handle container deselection
            if (object.isContainer) {
                object.setSelected(false);
            }
            
            this.propertyPanelManager.updatePropertyPanel();
            
            // MANDATORY ARCHITECTURE PATTERN: Notify UI of selection changes
            this.notifyUISync('selection_removed', { object });
            this.notifyUISync('selection_changed', { selectedObjects: Array.from(this.selectedObjects) });
            
            // Notify hierarchy panel
            if (this.onSelectionChanged) {
                this.onSelectionChanged();
            }
        }
    }

    toggleSelection(object) {
        if (this.selectedObjects.has(object)) {
            this.removeFromSelection(object);
        } else {
            this.addToSelection(object);
        }
    }

    clearSelection() {
        this.selectedObjects.forEach(object => {
            this.removeSelectionVisuals(object);
            // Handle container deselection
            if (object.isContainer) {
                object.setSelected(false);
            }
        });
        this.selectedObjects.clear();
        this.selectedFace = null;
        this.clearParentContainerHighlights();
        this.propertyPanelManager.updatePropertyPanel();
        
        // Notify centralized highlight manager about selection changes
        if (this.highlightManager) {
            this.highlightManager.onSelectionChanged(Array.from(this.selectedObjects));
        }
        
        // MANDATORY ARCHITECTURE PATTERN: Notify UI of selection changes
        this.notifyUISync('selection_cleared', {});
        this.notifyUISync('selection_changed', { selectedObjects: [] });
        
        // Notify hierarchy panel
        if (this.onSelectionChanged) {
            this.onSelectionChanged();
        }
        
        console.log('Selection cleared');
    }

    isSelected(object) {
        return this.selectedObjects.has(object);
    }

    getSelectedObjects() {
        return Array.from(this.selectedObjects);
    }

    getFirstSelected() {
        return this.selectedObjects.size > 0 ? this.selectedObjects.values().next().value : null;
    }
    
    getSelectionCount() {
        return this.selectedObjects.size;
    }

    // Face Selection
    selectFace(faceData) {
        this.selectedFace = {
            object: faceData.object,
            face: faceData.face,
            faceIndex: faceData.faceIndex,
            normal: faceData.normal,
            worldNormal: faceData.worldNormal,
            point: faceData.point
        };
        
        // Ensure the object is also selected
        if (!this.isSelected(faceData.object)) {
            this.selectOnly(faceData.object);
        }
        
        // Add face highlighting
        this.highlightManager.highlightSelectedFace(this.selectedFace);
        
        console.log('Face selected on object:', faceData.object.userData.id);
    }

    clearFaceSelection() {
        if (this.selectedFace) {
            this.highlightManager.clearSelectedFaceHighlight(this.selectedFace.object);
            this.selectedFace = null;
        }
    }

    // Hover Management
    updateHover(intersectionData) {
        const newHoveredObject = intersectionData ? intersectionData.object : null;
        
        // Update object hover
        if (newHoveredObject !== this.hoveredObject) {
            // Clear old hover
            if (this.hoveredObject) {
                this.highlightManager.clearHoverHighlight(this.hoveredObject);
            }
            
            // Set new hover
            this.hoveredObject = newHoveredObject;
            // NO HOVER WIREFRAMES - Only selected objects get highlights
            // Just clear any existing hover highlight
            if (this.hoveredObject && this.hoveredObject.userData.selectable) {
                this.highlightManager.clearHoverHighlight(this.hoveredObject);
            }
        }

        // Update face hover - ONLY for selected objects
        const newHoveredFace = intersectionData && 
                              this.canInteractWithFace(intersectionData.object, intersectionData.face) &&
                              this.isSelected(intersectionData.object) ? 
            intersectionData : null;
        
        if (newHoveredFace !== this.hoveredFace) {
            // Clear old face hover
            if (this.hoveredFace) {
                this.highlightManager.clearFaceHover(this.hoveredFace);
            }
            
            // Set new face hover - only if object is selected
            this.hoveredFace = newHoveredFace;
            if (this.hoveredFace) {
                this.highlightManager.highlightFace(this.hoveredFace);
            }
        }
    }

    clearHover() {
        if (this.hoveredObject) {
            this.highlightManager.clearHoverHighlight(this.hoveredObject);
            this.hoveredObject = null;
        }
        
        if (this.hoveredFace) {
            this.highlightManager.clearFaceHover(this.hoveredFace);
            this.hoveredFace = null;
        }
    }

    // Selection Visuals
    applySelectionVisuals(object) {
        if (object.isContainer) {
            // For containers, show bounding box and highlight children
            object.setSelected(true);
            console.log('SELECTION: Applied container selection to:', object.userData.id);
        } else {
            // Use centralized HighlightManager
            console.log('SELECTION: Using centralized HighlightManager for object:', object.userData.id);
            this.highlightManager.addSelectionHighlight(object);
        }
    }

    removeSelectionVisuals(object) {
        if (object.isContainer) {
            // For containers, remove bounding box
            object.setSelected(false);
        } else {
            // Use centralized HighlightManager
            console.log('SELECTION: Using centralized HighlightManager to remove highlight for object:', object.userData.id);
            this.highlightManager.removeSelectionHighlight(object);
        }
    }

    // Utility Methods
    canInteractWithFace(object, face) {
        if (!face) return false;
        
        return object.geometry instanceof THREE.BoxGeometry || 
               object.geometry instanceof THREE.PlaneGeometry ||
               object.geometry instanceof THREE.CylinderGeometry ||
               object.geometry instanceof THREE.CircleGeometry;
    }

    selectAll() {
        // Find all selectable objects in scene
        const selectableObjects = [];
        this.sceneManager.scene.traverse(child => {
            if (child.userData && child.userData.selectable && child.isMesh) {
                selectableObjects.push(child);
            }
        });
        
        selectableObjects.forEach(object => {
            this.addToSelection(object);
        });
        
        console.log('Selected all objects:', selectableObjects.length);
    }

    deleteSelected() {
        if (this.selectedObjects.size === 0) return;
        
        const objectsToDelete = Array.from(this.selectedObjects);
        
        objectsToDelete.forEach(object => {
            // Remove from selection first
            this.removeFromSelection(object);
            
            // Use scene manager's removeObject method for proper cleanup
            this.sceneManager.removeObject(object);
        });
        
        this.clearSelection();
        this.propertyPanelManager.updatePropertyPanel();
        
        console.log('Deleted', objectsToDelete.length, 'objects');
    }

    applyPropertyChange(object, input) {
        const property = input.dataset.property;
        const newValue = parseFloat(input.value);
        
        if (isNaN(newValue)) {
            console.warn('Invalid numeric value:', input.value);
            return;
        }
        
        // console.log(`Updating ${property} from ${this.getObjectProperty(object, property)} to ${newValue}`);
        
        // Update the object based on property type
        if (property === 'x') {
            object.position.x = newValue;
            this.handleObjectPositionChange(object);
        } else if (property === 'y') {
            object.position.y = newValue;
            this.handleObjectPositionChange(object);
        } else if (property === 'z') {
            object.position.z = newValue;
            this.handleObjectPositionChange(object);
        } else if (property === 'width' && object.userData.width !== undefined) {
            this.updateObjectDimension(object, 'width', newValue);
        } else if (property === 'height' && object.userData.height !== undefined) {
            this.updateObjectDimension(object, 'height', newValue);
        } else if (property === 'depth' && object.userData.depth !== undefined) {
            this.updateObjectDimension(object, 'depth', newValue);
        } else if (property === 'radius' && object.userData.radius !== undefined) {
            this.updateObjectDimension(object, 'radius', newValue);
        }
        
        // Update the display
        this.highlightManager.updateSelectionHighlights();
        
        // Refresh properties panel to show updated values
        this.propertyPanelManager.refreshProperties();
    }

    getObjectProperty(object, property) {
        if (property === 'x') return object.position.x;
        if (property === 'y') return object.position.y;
        if (property === 'z') return object.position.z;
        return object.userData[property];
    }

    updateObjectDimension(object, dimension, newValue) {
        // Update userData
        object.userData[dimension] = newValue;
        
        // console.log(`Object ${object.userData.id} ${dimension} updated to ${newValue}`);
        
        // Update the actual geometry based on object type
        if (object.isContainer) {
            // Handle container resizing
            if (dimension === 'width' || dimension === 'height' || dimension === 'depth') {
                object.resize(
                    object.userData.width || 1,
                    object.userData.height || 1,
                    object.userData.depth || 1
                );
                
                // Check if container has auto-layout enabled, if so use that system
                if (window.modlerApp && window.modlerApp.autoLayoutManager && object.userData.layout && object.userData.layout.enabled !== false) {
                    // Use auto layout system for modern containers
                    window.modlerApp.autoLayoutManager.onContainerChildrenChanged(object);
                } else {
                    // Use legacy container properties for basic containers
                    object.applyContainerProperties();
                }
                
                // Update highlights for container and all child objects after resize
                this.updateContainerAndChildHighlights(object);
            }
        } else {
            // Handle regular object geometry updating
            this.updateObjectGeometry(object);
        }
        
        // Notify parent container if this object is inside one
        if (object.userData.parentContainer && object.userData.parentContainer.onChildChanged) {
            object.userData.parentContainer.onChildChanged();
        }
    }
    
    updateObjectGeometry(object) {
        // Update geometry for regular objects (not containers)
        if (object.geometry instanceof THREE.BoxGeometry) {
            const width = object.userData.width || 1;
            const height = object.userData.height || 1; 
            const depth = object.userData.depth || 1;
            
            // Create new geometry with updated dimensions
            const newGeometry = new THREE.BoxGeometry(width, height, depth);
            
            // Dispose old geometry and assign new one
            object.geometry.dispose();
            object.geometry = newGeometry;
            
        } else if (object.geometry instanceof THREE.CylinderGeometry) {
            const radius = object.userData.radius || 0.5;
            const height = object.userData.height || 1;
            
            // Create new cylinder geometry
            const newGeometry = new THREE.CylinderGeometry(radius, radius, height, 32);
            
            // Dispose old geometry and assign new one
            object.geometry.dispose();
            object.geometry = newGeometry;
            
        } else if (object.geometry instanceof THREE.SphereGeometry) {
            const radius = object.userData.radius || 0.5;
            
            // Create new sphere geometry
            const newGeometry = new THREE.SphereGeometry(radius, 32, 16);
            
            // Dispose old geometry and assign new one
            object.geometry.dispose();
            object.geometry = newGeometry;
        }
        
        // console.log(`Updated geometry for object ${object.userData.id}`);
    }
    
    handleObjectPositionChange(object) {
        // Handle position changes for objects and containers
        if (object.isContainer) {
            // When a container moves, update its bounding box
            object.updateBoundingBox();
            
            // Check if container has auto-layout enabled, if so use that system
            if (window.modlerApp && window.modlerApp.autoLayoutManager && object.userData.layout && object.userData.layout.enabled !== false) {
                // Use auto layout system for modern containers
                window.modlerApp.autoLayoutManager.onContainerChildrenChanged(object);
            } else {
                // Use legacy container properties for basic containers
                object.applyContainerProperties();
            }
            
            // Update highlights for container and all child objects
            this.updateContainerAndChildHighlights(object);
        } else {
            // For regular objects, notify parent container if they have one
            if (object.userData.parentContainer && object.userData.parentContainer.onChildChanged) {
                object.userData.parentContainer.onChildChanged();
            }
            
            // Update highlights for the moved object
            if (this.highlightManager) {
                this.highlightManager.updateSelectionHighlights();
            }
        }
    }
    
    updateContainerAndChildHighlights(container) {
        if (!this.highlightManager) return;
        
        // Clear all face highlights first - they may be positioned incorrectly after container move
        this.highlightManager.clearFaceHoverHighlights();
        
        // Update highlights for all selected objects in the container hierarchy
        this.selectedObjects.forEach(selectedObject => {
            // Check if this selected object is the container or a child of the moved container
            if (selectedObject === container || this.isChildOfContainer(selectedObject, container)) {
                // Clear any selected face highlights for this object
                this.highlightManager.clearSelectedFaceHighlight(selectedObject);
                
                // Force update edge highlights by recreating them
                this.highlightManager.updateObjectEdgeHighlight(selectedObject);
            }
        });
        
        // Also check if we have a selected face that belongs to an object in this container
        if (this.selectedFace && this.selectedFace.object) {
            if (container === this.selectedFace.object || this.isChildOfContainer(this.selectedFace.object, container)) {
                // Clear the selected face highlight since the object moved
                this.highlightManager.clearSelectedFaceHighlight(this.selectedFace.object);
                this.selectedFace = null; // Reset selected face
            }
        }
        
        // Update all selection highlights
        this.highlightManager.updateSelectionHighlights();
        
        console.log('Updated highlights for container and children after move/resize');
    }
    
    isChildOfContainer(object, container) {
        // Check if object is a descendant of the container
        let current = object;
        while (current && current.userData.parentContainer) {
            current = current.userData.parentContainer;
            if (current === container) {
                return true;
            }
        }
        return false;
    }
    
    // Hide bounding box helpers for all selected containers during operations
    hideContainerBoundingBoxes() {
        this.selectedObjects.forEach(object => {
            if (object.isContainer && object.hideBoundingBoxHelper) {
                object.hideBoundingBoxHelper();
            }
        });
    }
    
    // Show bounding box helpers for all selected containers after operations
    showContainerBoundingBoxes() {
        this.selectedObjects.forEach(object => {
            if (object.isContainer && object.showBoundingBoxHelper) {
                object.showBoundingBoxHelper();
            }
        });
    }


    // Refresh the properties panel for the currently selected object
    refreshProperties() {
        // Delegate to PropertyPanelManager
        this.propertyPanelManager.refreshProperties();
    }

    // Force refresh of selection highlights (for settings changes)
    refreshSelectionHighlights() {
        console.log('SELECTION: Refreshing selection highlights for', this.selectedObjects.size, 'objects');
        this.selectedObjects.forEach(object => {
            this.highlightManager.updateObjectEdgeHighlight(object);
        });
    }

    // Update coordinates display
    updateCoordinates(position) {
        const coordsElement = document.getElementById('coordinates');
        if (coordsElement && position) {
            coordsElement.textContent = `X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}`;
        }
    }

    // Parent container highlighting (visual only, not in selection)
    highlightParentContainer(container) {
        // Store reference to highlighted parent containers
        if (!this.highlightedParentContainers) {
            this.highlightedParentContainers = new Set();
        }
        
        if (!this.highlightedParentContainers.has(container)) {
            container.setSelected(true);
            this.highlightedParentContainers.add(container);
        }
    }

    clearParentContainerHighlights() {
        if (this.highlightedParentContainers) {
            this.highlightedParentContainers.forEach(container => {
                container.setSelected(false);
            });
            this.highlightedParentContainers.clear();
        }
    }

    dispose() {
        this.clearSelection();
        this.clearHover();
        this.clearParentContainerHighlights();
        this.selectedObjects.clear();
        
        // Dispose materials
        if (this.standardMaterial) this.standardMaterial.dispose();
        if (this.selectionMaterial) this.selectionMaterial.dispose();
    }
    
    // Hierarchical Selection Methods (used by all tools)
    handleHierarchicalClick(event, intersectionData, toolName = 'unknown') {
        if (!intersectionData || !intersectionData.object.userData.selectable) {
            console.log(`SELECTION: No selectable object found for tool: ${toolName}`);
            return null; // No object to select
        }
        
        let clickedObject = intersectionData.object;
        
        // If clicking on container proxy, get the actual container
        if (intersectionData.object.userData.isContainerProxy) {
            clickedObject = intersectionData.object.userData.parentContainer;
            console.log(`SELECTION: Clicked on container proxy for container: ${clickedObject.userData.id}`);
        }
        
        // Handle shift-click for multi-select (skips hierarchical logic)
        if (event.shiftKey) {
            console.log(`SELECTION: Shift-click multi-select for tool: ${toolName}`);
            this.toggleSelection(clickedObject);
            return clickedObject;
        }
        
        // For tools other than select, use hierarchical logic but without double-click depth tracking
        // All tools start by selecting the outermost container on first click
        const targetForSelection = this.getOutermostContainer(clickedObject);
        
        console.log(`SELECTION: Hierarchical selection for tool ${toolName} - selecting outermost container:`, targetForSelection.userData.id);
        this.selectOnly(targetForSelection);
        
        return targetForSelection;
    }
    
    handleHierarchicalDoubleClick(event, intersectionData, currentDepthMap) {
        if (!intersectionData || !intersectionData.object.userData.selectable) {
            return null;
        }
        
        let clickedObject = intersectionData.object;
        
        // If clicking on container proxy, get the actual container
        if (intersectionData.object.userData.isContainerProxy) {
            clickedObject = intersectionData.object.userData.parentContainer;
        }
        
        // Find the outermost container for this object
        const outermostContainer = this.getOutermostContainer(clickedObject);
        const currentDepth = currentDepthMap.get(outermostContainer.userData.id) || 0;
        
        console.log('SELECTION: Double-click - current selection depth for hierarchy:', currentDepth);
        
        // Go one level deeper
        const targetForSelection = this.getObjectAtDepth(clickedObject, currentDepth + 1);
        
        if (targetForSelection && targetForSelection !== outermostContainer) {
            console.log('SELECTION: Double-click - going deeper to select:', targetForSelection.userData.id);
            
            // Update depth tracking
            currentDepthMap.set(outermostContainer.userData.id, currentDepth + 1);
            
            // Select the deeper object
            this.selectOnly(targetForSelection);
            return targetForSelection;
        } else {
            console.log('SELECTION: Double-click - already at deepest level or no deeper level available');
            return null;
        }
    }
    
    getOutermostContainer(object) {
        // Find the topmost parent container (or the object itself if no container)
        let current = object;
        while (current.userData.parentContainer) {
            current = current.userData.parentContainer;
        }
        return current;
    }
    
    getObjectAtDepth(clickedObject, targetDepth) {
        // Get the outermost container first
        const outermostContainer = this.getOutermostContainer(clickedObject);
        
        // Build hierarchy path starting from outermost container
        const hierarchyPath = [outermostContainer];
        
        // If we're at depth 0, return the container
        if (targetDepth === 0) {
            return outermostContainer;
        }
        
        // If the outermost is a container with children, add children to path
        if (outermostContainer.isContainer && outermostContainer.childObjects && outermostContainer.childObjects.size > 0) {
            // Add children to hierarchy path
            const children = Array.from(outermostContainer.childObjects);
            // Sort children by some consistent order (e.g., by id)
            children.sort((a, b) => a.userData.id.toString().localeCompare(b.userData.id.toString()));
            hierarchyPath.push(...children);
        }
        
        console.log('SELECTION: Hierarchy path:', hierarchyPath.map(obj => obj.userData.id));
        console.log('SELECTION: Target depth:', targetDepth, 'Path length:', hierarchyPath.length);
        
        // Return object at target depth (0 = outermost container, 1+ = children)
        if (targetDepth < hierarchyPath.length) {
            return hierarchyPath[targetDepth];
        }
        
        // If target depth exceeds hierarchy, return the deepest object available
        return hierarchyPath[hierarchyPath.length - 1];
    }
    
    // Centralized Hierarchical Selection Handler
    handleToolClick(event, intersectionData, toolName) {
        if (!intersectionData || !intersectionData.object.userData.selectable) {
            return null;
        }
        
        let clickedObject = intersectionData.object;
        
        // Handle container geometry (not proxy - that's obsolete)
        if (intersectionData.object.userData.isContainerGeometry) {
            clickedObject = intersectionData.object.userData.parentContainer;
        }
        
        // Handle shift-click for multi-select (skips hierarchical logic)
        if (event.shiftKey) {
            this.toggleSelection(clickedObject);
            return clickedObject;
        }
        
        const currentTime = Date.now();
        const isDoubleClick = this.detectDoubleClick(currentTime, clickedObject);
        
        if (isDoubleClick) {
            // Double-click: go deeper in hierarchy
            const result = this.handleHierarchicalDoubleClick(event, { object: clickedObject }, this.hierarchicalState.currentDepthMap);
            return result;
        } else {
            // Single click: reset depth and select
            const result = this.handleHierarchicalClick(event, { object: clickedObject }, toolName);
            if (result) {
                this.hierarchicalState.currentDepthMap.clear();
                this.hierarchicalState.currentDepthMap.set(result.userData.id, 0);
            }
            return result;
        }
    }
    
    detectDoubleClick(currentTime, clickedObject) {
        const timeDiff = currentTime - this.hierarchicalState.lastClickTime;
        const isSameObject = this.hierarchicalState.lastClickedObject === clickedObject;
        const isDoubleClick = (timeDiff < this.hierarchicalState.doubleClickThreshold) && isSameObject;
        
        // Update tracking state
        this.hierarchicalState.lastClickTime = currentTime;
        this.hierarchicalState.lastClickedObject = clickedObject;
        
        return isDoubleClick;
    }
    
    // Reset hierarchical state when external selection changes occur
    resetHierarchicalState() {
        this.hierarchicalState.currentDepthMap.clear();
        this.hierarchicalState.lastClickedObject = null;
        this.hierarchicalState.lastClickTime = 0;
    }
    
    
    updateObjectGeometry(object) {
        if (!object.geometry) return;
        
        // Update geometry based on object type
        if (object.geometry instanceof THREE.BoxGeometry) {
            const newGeometry = new THREE.BoxGeometry(
                object.userData.width || 1,
                object.userData.height || 1,
                object.userData.depth || 1
            );
            object.geometry.dispose();
            object.geometry = newGeometry;
        } else if (object.geometry instanceof THREE.CylinderGeometry && object.userData.radius) {
            const newGeometry = new THREE.CylinderGeometry(
                object.userData.radius,
                object.userData.radius,
                object.userData.height || 1
            );
            object.geometry.dispose();
            object.geometry = newGeometry;
        }
        
        console.log(`LAYOUT: Updated geometry for object ${object.userData.id}`);
    }
    
    // MANDATORY ARCHITECTURE PATTERN: Centralized UI synchronization system
    registerUISync(callback) {
        this.uiSyncCallbacks.add(callback);
        console.log('UI sync callback registered with SelectionManager');
    }
    
    unregisterUISync(callback) {
        this.uiSyncCallbacks.delete(callback);
    }
    
    notifyUISync(changeType, data) {
        this.uiSyncCallbacks.forEach(callback => {
            try {
                callback(changeType, data);
            } catch (error) {
                console.error('Selection UI sync callback error:', error);
            }
        });
    }
    
}

// Export for module use
window.SelectionManager = SelectionManager;