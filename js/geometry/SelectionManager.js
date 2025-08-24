/**
 * Selection Manager - Centralized management of object selection and highlighting
 */
class SelectionManager {
    constructor(sceneManager, highlightManager) {
        this.sceneManager = sceneManager;
        this.highlightManager = highlightManager;
        
        // Selection state
        this.selectedObjects = new Set();
        this.hoveredObject = null;
        this.selectedFace = null;
        this.hoveredFace = null;
        
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
        this.updatePropertyPanel();
        
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
            
            this.updatePropertyPanel();
            
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
        this.updatePropertyPanel();
        
        // Notify centralized highlight manager about selection changes
        if (this.highlightManager) {
            this.highlightManager.onSelectionChanged(Array.from(this.selectedObjects));
        }
        
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
        this.updatePropertyPanel();
        
        console.log('Deleted', objectsToDelete.length, 'objects');
    }

    // Update UI
    updatePropertyPanel() {
        // This will be called to update the properties panel
        const selectedCount = this.selectedObjects.size;
        const firstSelected = this.getFirstSelected();
        
        // Update properties panel content
        const propertiesContainer = document.getElementById('object-properties');
        if (propertiesContainer) {
            if (selectedCount === 0) {
                propertiesContainer.innerHTML = '<p>No objects selected</p>';
            } else if (selectedCount === 1) {
                this.showObjectProperties(firstSelected, propertiesContainer);
            } else {
                propertiesContainer.innerHTML = `<p>${selectedCount} objects selected</p>`;
            }
        }
    }

    showObjectProperties(object, container) {
        const userData = object.userData;
        let html = `<h4>${object.isContainer ? 'Container' : 'Object'} Properties</h4>`;
        
        // Type and ID (read-only)
        html += `<div class="property-row">
            <span class="property-label">Type:</span>
            <span class="property-value">${userData.type || 'Unknown'}</span>
        </div>`;
        html += `<div class="property-row">
            <span class="property-label">ID:</span>
            <span class="property-value">${userData.id || 'N/A'}</span>
        </div>`;
        
        // Container-specific properties
        if (object.isContainer) {
            html += this.getContainerPropertiesHTML(object);
        }
        
        // Dimensions (editable)
        if (userData.width !== undefined) {
            html += `<div class="property-row">
                <span class="property-label">Width:</span>
                <div class="property-input-container">
                    <input class="property-input" id="prop-width" type="number" step="0.1" value="${userData.width.toFixed(2)}" 
                           data-object-id="${userData.id}" data-property="width" />
                </div>
            </div>`;
        }
        if (userData.height !== undefined) {
            html += `<div class="property-row">
                <span class="property-label">Height:</span>
                <div class="property-input-container">
                    <input class="property-input" id="prop-height" type="number" step="0.1" value="${userData.height.toFixed(2)}" 
                           data-object-id="${userData.id}" data-property="height" />
                </div>
            </div>`;
        }
        if (userData.depth !== undefined) {
            html += `<div class="property-row">
                <span class="property-label">Depth:</span>
                <div class="property-input-container">
                    <input class="property-input" id="prop-depth" type="number" step="0.1" value="${userData.depth.toFixed(2)}" 
                           data-object-id="${userData.id}" data-property="depth" />
                </div>
            </div>`;
        }
        if (userData.radius !== undefined) {
            html += `<div class="property-row">
                <span class="property-label">Radius:</span>
                <div class="property-input-container">
                    <input class="property-input" id="prop-radius" type="number" step="0.1" value="${userData.radius.toFixed(2)}" 
                           data-object-id="${userData.id}" data-property="radius" />
                </div>
            </div>`;
        }
        
        // Position (editable)
        html += `<div class="property-row">
            <span class="property-label">Position X:</span>
            <div class="property-input-container">
                <input class="property-input" id="prop-x" type="number" step="0.1" value="${object.position.x.toFixed(2)}" 
                       data-object-id="${userData.id}" data-property="x" />
            </div>
        </div>`;
        html += `<div class="property-row">
            <span class="property-label">Position Y:</span>
            <div class="property-input-container">
                <input class="property-input" id="prop-y" type="number" step="0.1" value="${object.position.y.toFixed(2)}" 
                       data-object-id="${userData.id}" data-property="y" />
            </div>
        </div>`;
        html += `<div class="property-row">
            <span class="property-label">Position Z:</span>
            <div class="property-input-container">
                <input class="property-input" id="prop-z" type="number" step="0.1" value="${object.position.z.toFixed(2)}" 
                       data-object-id="${userData.id}" data-property="z" />
            </div>
        </div>`;
        
        container.innerHTML = html;
        
        // Add event listeners for the property inputs
        this.setupPropertyInputListeners(object);
    }

    getContainerPropertiesHTML(container) {
        let html = `<div class="property-group">
            <h4>Layout Options</h4>`;
        
        // Distribution Mode
        html += `<div class="property-row">
            <span class="property-label">Distribution:</span>
            <select class="property-select" id="distribution-mode" data-container-id="${container.userData.id}">
                <option value="none" ${container.userData.distributionMode === 'none' ? 'selected' : ''}>None</option>
                <option value="even" ${container.userData.distributionMode === 'even' ? 'selected' : ''}>Even Spacing</option>
                <option value="center" ${container.userData.distributionMode === 'center' ? 'selected' : ''}>Center</option>
            </select>
        </div>`;
        
        // Alignment Mode
        html += `<div class="property-row">
            <span class="property-label">Alignment:</span>
            <select class="property-select" id="alignment-mode" data-container-id="${container.userData.id}">
                <option value="none" ${container.userData.alignmentMode === 'none' ? 'selected' : ''}>None</option>
                <option value="left" ${container.userData.alignmentMode === 'left' ? 'selected' : ''}>Left</option>
                <option value="center" ${container.userData.alignmentMode === 'center' ? 'selected' : ''}>Center</option>
                <option value="right" ${container.userData.alignmentMode === 'right' ? 'selected' : ''}>Right</option>
                <option value="top" ${container.userData.alignmentMode === 'top' ? 'selected' : ''}>Top</option>
                <option value="bottom" ${container.userData.alignmentMode === 'bottom' ? 'selected' : ''}>Bottom</option>
            </select>
        </div>`;
        
        // Fill Mode Checkboxes
        html += `<div class="property-row">
            <span class="property-label">Scale to Fill:</span>
            <div class="fill-mode-checkboxes">
                <label class="fill-checkbox">
                    <input type="checkbox" id="fill-x" data-container-id="${container.userData.id}" data-axis="x" 
                           ${container.userData.fillMode.x ? 'checked' : ''}> X
                </label>
                <label class="fill-checkbox">
                    <input type="checkbox" id="fill-y" data-container-id="${container.userData.id}" data-axis="y" 
                           ${container.userData.fillMode.y ? 'checked' : ''}> Y
                </label>
                <label class="fill-checkbox">
                    <input type="checkbox" id="fill-z" data-container-id="${container.userData.id}" data-axis="z" 
                           ${container.userData.fillMode.z ? 'checked' : ''}> Z
                </label>
            </div>
        </div>`;
        
        html += `</div>`;
        return html;
    }

    setupPropertyInputListeners(object) {
        const propertyInputs = document.querySelectorAll('.property-input[data-object-id="' + object.userData.id + '"]');
        
        propertyInputs.forEach(input => {
            // Handle Enter key to apply changes
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.applyPropertyChange(object, input);
                    input.blur(); // Remove focus
                } else if (event.key === 'Tab') {
                    // Tab navigation will be handled by default browser behavior
                    // We can enhance this later
                }
            });
            
            // Handle blur (when input loses focus)
            input.addEventListener('blur', () => {
                this.applyPropertyChange(object, input);
            });
            
            // Real-time validation (optional)
            input.addEventListener('input', () => {
                this.validatePropertyInput(input);
            });
        });
        
        // Container-specific controls
        if (object.isContainer) {
            this.setupContainerControlListeners(object);
        }
    }

    setupContainerControlListeners(container) {
        // Distribution mode select
        const distributionSelect = document.getElementById('distribution-mode');
        if (distributionSelect) {
            distributionSelect.addEventListener('change', (event) => {
                container.setDistributionMode(event.target.value);
                console.log(`Set distribution mode to ${event.target.value} for container ${container.userData.id}`);
            });
        }
        
        // Alignment mode select
        const alignmentSelect = document.getElementById('alignment-mode');
        if (alignmentSelect) {
            alignmentSelect.addEventListener('change', (event) => {
                container.setAlignmentMode(event.target.value);
                console.log(`Set alignment mode to ${event.target.value} for container ${container.userData.id}`);
            });
        }
        
        // Fill mode checkboxes
        const fillCheckboxes = document.querySelectorAll(`input[data-container-id="${container.userData.id}"][data-axis]`);
        fillCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const axis = event.target.dataset.axis;
                const enabled = event.target.checked;
                container.setFillMode(axis, enabled);
                console.log(`Set fill mode ${axis} to ${enabled} for container ${container.userData.id}`);
            });
        });
    }

    applyPropertyChange(object, input) {
        const property = input.dataset.property;
        const newValue = parseFloat(input.value);
        
        if (isNaN(newValue)) {
            console.warn('Invalid numeric value:', input.value);
            return;
        }
        
        console.log(`Updating ${property} from ${this.getObjectProperty(object, property)} to ${newValue}`);
        
        // Update the object based on property type
        if (property === 'x') {
            object.position.x = newValue;
        } else if (property === 'y') {
            object.position.y = newValue;
        } else if (property === 'z') {
            object.position.z = newValue;
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
        this.refreshProperties();
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
        
        // Update the actual geometry - this would need to be more sophisticated
        // For now, just log the change
        console.log(`Object ${object.userData.id} ${dimension} updated to ${newValue}`);
        
        // TODO: Implement geometry updating based on the object type
        // This would require calling the appropriate geometry manager methods
    }

    validatePropertyInput(input) {
        const value = parseFloat(input.value);
        if (isNaN(value)) {
            input.style.borderColor = '#ff0000';
            input.style.backgroundColor = '#ffeeee';
        } else {
            input.style.borderColor = '';
            input.style.backgroundColor = '';
        }
    }

    // Refresh the properties panel for the currently selected object
    refreshProperties() {
        const selectedCount = this.getSelectionCount();
        const firstSelected = this.getFirstSelected();
        
        const propertiesContainer = document.getElementById('object-properties');
        if (propertiesContainer && selectedCount === 1 && firstSelected) {
            // Update the properties panel with current object values
            this.showObjectProperties(firstSelected, propertiesContainer);
        }
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
}

// Export for module use
window.SelectionManager = SelectionManager;