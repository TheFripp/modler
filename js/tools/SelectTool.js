/**
 * Select Tool - Handles object selection and basic interaction
 */
class SelectTool extends Tool {
    constructor(sceneManager, eventManager, selectionManager, highlightManager = null, snapManager = null, materialManager = null, stateManager = null, objectManager = null, configManager = null) {
        super('select', sceneManager, eventManager);
        this.selectionManager = selectionManager;
        this.highlightManager = highlightManager;
        this.snapManager = snapManager;
        this.materialManager = materialManager;
        this.stateManager = stateManager;
        this.objectManager = objectManager;
        this.configManager = configManager;
        this.cursor = 'default';
        this.lastHoveredObject = null;
        this.lastHoveredFace = null;
        
        this.isInternalSelection = false; // Flag to track selections made by this tool
    }

    onMouseDown(event, intersectionData) {
        if (!this.isActive) return false;
        
        console.log('SELECTTOOL: MouseDown event received, active:', this.isActive);
        console.log('SELECTTOOL: Intersection data:', intersectionData);
        
        // Use centralized hierarchical selection logic
        if (intersectionData && intersectionData.object.userData.selectable) {
            this.isInternalSelection = true;
            const selectedObject = this.selectionManager.handleToolClick(event, intersectionData, 'select');
            this.isInternalSelection = false;
            
            if (selectedObject) {
                console.log('SELECTTOOL: Selected object:', selectedObject.userData.id);
            }
            
        } else {
            console.log('SELECTTOOL: No selectable object found');
        }
        
        return false; // Allow camera controls for selection tool
    }

    onMouseUp(event, intersectionData, isDragging, wasInteracting) {
        if (!this.isActive) return false;
        
        // Don't process click if we just finished an interaction
        if (wasInteracting) {
            return false;
        }
        
        // Clear selection on empty clicks when using select tool
        if (!intersectionData && !isDragging) {
            console.log('SELECTTOOL: Clearing selection on empty click');
            this.selectionManager.clearSelection();
        }
        
        return false; // Allow camera controls for selection tool
    }

    onMouseMove(event, intersectionData) {
        if (!this.isActive) return false;
        
        // Update cursor based on what we're hovering over
        if (intersectionData && intersectionData.object.userData.selectable) {
            this.cursor = 'pointer';
        } else {
            this.cursor = 'default';
        }
        this.updateCursor();
        
        // Update hover highlighting using centralized system
        if (this.highlightManager) {
            // Check if object or face changed
            const currentObject = intersectionData?.object;
            const currentFace = intersectionData?.face;
            const currentFaceIndex = intersectionData?.faceIndex;
            
            // Create a unique identifier for the current face (object + face index)
            const currentFaceId = currentObject && currentFace ? 
                `${currentObject.uuid}_${currentFaceIndex}` : null;
            const lastFaceId = this.lastHoveredObject && this.lastHoveredFace ? 
                `${this.lastHoveredObject.uuid}_${this.lastHoveredFace.index}` : null;
            
            // Update if object changed OR face changed on the same object
            if (currentObject !== this.lastHoveredObject || currentFaceId !== lastFaceId) {
                // Clear previous hover highlights when object or face changes
                this.clearHoverHighlights();
                this.lastHoveredObject = currentObject;
                this.lastHoveredFace = currentFace ? { index: currentFaceIndex, face: currentFace } : null;
                
                // Add face hover highlight for current intersection
                if (intersectionData && intersectionData.object.userData.selectable && intersectionData.face) {
                    let targetIntersection = intersectionData;
                    
                    // Handle container proxy
                    if (intersectionData.object.userData.isContainerProxy) {
                        targetIntersection = {
                            ...intersectionData,
                            object: intersectionData.object.userData.parentContainer
                        };
                    }
                    
                    // Selection checking is now centralized in HighlightManager.addFaceHoverHighlight()
                    this.highlightManager.addFaceHoverHighlight(targetIntersection);
                    console.log('SelectTool: Added face hover highlight for object:', targetIntersection.object.userData.id, 'face:', currentFaceIndex);
                }
            }
        } else {
            // Fallback to legacy system
            this.selectionManager.updateHover(intersectionData);
        }
        
        return false; // Allow camera controls for selection tool
    }

    onKeyDown(event) {
        if (!this.isActive) return false;
        
        switch (event.key.toLowerCase()) {
            case 'delete':
            case 'backspace':
                event.preventDefault();
                this.selectionManager.deleteSelected();
                break;
            case 'a':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.selectionManager.selectAll();
                }
                break;
            case 'escape':
                event.preventDefault();
                this.selectionManager.clearSelection();
                this.selectionManager.highlightSystem.clearTempHighlights();
                break;
        }
    }
    
    activate() {
        super.activate();
        
        // Notify managers about tool activation
        if (this.highlightManager) {
            this.highlightManager.onToolActivated('select');
        }
        if (this.snapManager) {
            this.snapManager.onToolActivated('select');
        }
    }
    
    deactivate() {
        super.deactivate();
        
        // Clear any hover highlights when deactivating
        this.clearHoverHighlights();
        this.lastHoveredObject = null;
        this.lastHoveredFace = null;
        
        // Reset centralized hierarchical selection state
        this.selectionManager.resetHierarchicalState();
    }
    
    clearHoverHighlights() {
        if (this.highlightManager) {
            // Clear all hover highlights
            this.highlightManager.activeHighlights.hover.forEach((info, object) => {
                this.highlightManager.removeHoverHighlight(object);
            });
            // Also clear face hover highlights
            this.highlightManager.clearFaceHoverHighlights();
        }
    }

    getStatusText() {
        const selectedCount = this.selectionManager.getSelectedObjects().length;
        if (selectedCount > 0) {
            return `Select Tool - ${selectedCount} object${selectedCount > 1 ? 's' : ''} selected`;
        }
        return 'Select Tool - Click to select objects';
    }
    
    // Integration with centralized systems
    updateHighlightManagerContext() {
        if (this.highlightManager) {
            const selectedObjects = this.selectionManager.getSelectedObjects();
            this.highlightManager.setContext({
                activeTool: 'select',
                isMultiSelect: selectedObjects.length > 1
            });
        }
    }
    
    // Hierarchical Selection Methods (moved to SelectionManager for reuse across all tools)
    
    // Called when selection changes from external sources (like hierarchy panel)
    onExternalSelectionChange() {
        // Only reset depth tracking if this is not an internal selection
        if (!this.isInternalSelection) {
            console.log('SELECTTOOL: External selection change detected, resetting depth tracking');
            this.selectionManager.resetHierarchicalState();
        }
    }
}

// Export for module use
window.SelectTool = SelectTool;