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
    }

    onMouseDown(event, intersectionData) {
        if (!this.isActive) return false;
        
        console.log('SELECTTOOL: MouseDown event received, active:', this.isActive);
        console.log('SELECTTOOL: Intersection data:', intersectionData);
        
        // Handle selection
        if (intersectionData && intersectionData.object.userData.selectable) {
            let targetObject = intersectionData.object;
            
            // If clicking on container proxy, select the actual container
            if (intersectionData.object.userData.isContainerProxy) {
                targetObject = intersectionData.object.userData.parentContainer;
                console.log('SELECT: Clicked on container proxy, selecting container:', targetObject.userData.id);
            } else {
                console.log('SELECTTOOL: Selecting object:', intersectionData.object.userData.id);
            }
            
            // Select object (with multi-select support via Shift)
            if (event.shiftKey) {
                this.selectionManager.toggleSelection(targetObject);
            } else {
                this.selectionManager.selectOnly(targetObject);
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
            // Clear previous hover highlights  
            this.clearHoverHighlights();
            
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
                
                // For select tool, show face highlights for any object (not just selected)
                this.highlightManager.addFaceHoverHighlight(targetIntersection);
                console.log('SelectTool: Added face hover highlight');
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
}

// Export for module use
window.SelectTool = SelectTool;