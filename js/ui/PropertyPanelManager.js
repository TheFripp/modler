/**
 * PropertyPanelManager - Handles property panel UI generation and interactions
 * Extracted from SelectionManager for better separation of concerns
 */
class PropertyPanelManager {
    constructor(selectionManager, highlightManager = null) {
        this.selectionManager = selectionManager;
        this.highlightManager = highlightManager;
    }

    // Centralized input HTML generation methods
    
    /**
     * Generate a section header that appears on its own row
     */
    generateSectionHeader(title) {
        return `<div class="property-section-header">${title}</div>`;
    }
    
    /**
     * Generate a standardized property input with colored axis label
     * @param {string} axis - 'x', 'y', 'z', 'w', 'h', 'd'
     * @param {string} inputId - Unique input ID
     * @param {number} value - Current value
     * @param {string} objectId - Object ID for data attributes
     * @param {string} property - Property name for data attributes
     * @param {boolean} disabled - Whether input should be disabled
     * @param {string|null} extraButton - Optional extra button HTML (like fill toggle)
     * @param {boolean} isContainer - Whether this is a container property (uses data-container-id)
     */
    generateAxisInput(axis, inputId, value, objectId, property, disabled = false, extraButton = null, isContainer = false) {
        const axisLabels = {
            'x': 'X', 'y': 'Y', 'z': 'Z',
            'w': 'W', 'h': 'H', 'd': 'D'
        };
        
        const axisClasses = {
            'x': 'axis-x', 'y': 'axis-y', 'z': 'axis-z',
            'w': 'axis-w', 'h': 'axis-h', 'd': 'axis-d'
        };
        
        const dataAttribute = isContainer ? 'data-container-id' : 'data-object-id';
        
        return `
            <div class="property-axis-input">
                <span class="axis-label ${axisClasses[axis]}">${axisLabels[axis]}</span>
                <input class="property-input property-input-compact" 
                       id="${inputId}" 
                       type="number" 
                       step="0.1" 
                       value="${value.toFixed(2)}" 
                       ${dataAttribute}="${objectId}" 
                       data-property="${property}" 
                       ${disabled ? 'disabled' : ''} />
                <div class="property-arrows">
                    <div class="property-arrow-up" data-target="${inputId}">▲</div>
                    <div class="property-arrow-down" data-target="${inputId}">▼</div>
                </div>
                ${extraButton || ''}
            </div>
        `;
    }
    
    /**
     * Generate a group of axis inputs (e.g., dimensions or position)
     * @param {string} sectionTitle - Section title (appears on separate row)
     * @param {Array} axes - Array of axis configurations
     * @param {boolean} isContainer - Whether these are container properties
     */
    generateAxisInputGroup(sectionTitle, axes, isContainer = false) {
        let html = this.generateSectionHeader(sectionTitle);
        html += `<div class="property-axis-group">`;
        
        axes.forEach(axisConfig => {
            html += this.generateAxisInput(
                axisConfig.axis,
                axisConfig.inputId,
                axisConfig.value,
                axisConfig.objectId,
                axisConfig.property,
                axisConfig.disabled,
                axisConfig.extraButton,
                isContainer
            );
        });
        
        html += `</div>`;
        return html;
    }
    
    /**
     * Generate a standard property row with label and input
     * @param {string} label - Property label
     * @param {string} inputId - Input ID
     * @param {number} value - Current value
     * @param {string} objectId - Object ID
     * @param {string} property - Property name
     * @param {boolean} disabled - Whether input is disabled
     */
    generatePropertyRow(label, inputId, value, objectId, property, disabled = false) {
        return `
            <div class="property-row">
                <span class="property-label">${label}:</span>
                <div class="property-input-container">
                    <input class="property-input property-input-compact" 
                           id="${inputId}" 
                           type="number" 
                           step="0.1" 
                           value="${value.toFixed(2)}" 
                           data-object-id="${objectId}" 
                           data-property="${property}" 
                           ${disabled ? 'disabled' : ''} />
                    <div class="property-arrows">
                        <div class="property-arrow-up" data-target="${inputId}">▲</div>
                        <div class="property-arrow-down" data-target="${inputId}">▼</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Update UI
    updatePropertyPanel() {
        // This will be called to update the properties panel
        const selectedCount = this.selectionManager.selectedObjects.size;
        const firstSelected = this.selectionManager.getFirstSelected();
        
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
        
        // Layout properties are now handled inline with dimension inputs via toggle buttons
        
        // Dimensions (with colored axis labels and standardized layout)
        const dimensionAxes = [];
        
        if (userData.width !== undefined) {
            const isContainerChild = object.userData.layout && object.userData.layout.widthMode;
            const isFillMode = isContainerChild && object.userData.layout.widthMode === 'fill';
            const fillButton = isContainerChild ? `<button class="fill-toggle ${isFillMode ? 'active' : ''}" data-object-id="${userData.id}" data-axis="width" title="Fill width">↔</button>` : null;
            
            dimensionAxes.push({
                axis: 'w',
                inputId: 'prop-width',
                value: userData.width,
                objectId: userData.id,
                property: 'width',
                disabled: isFillMode,
                extraButton: fillButton
            });
        }
        
        if (userData.height !== undefined) {
            const isContainerChild = object.userData.layout && object.userData.layout.heightMode;
            const isFillMode = isContainerChild && object.userData.layout.heightMode === 'fill';
            const fillButton = isContainerChild ? `<button class="fill-toggle ${isFillMode ? 'active' : ''}" data-object-id="${userData.id}" data-axis="height" title="Fill height">↕</button>` : null;
            
            dimensionAxes.push({
                axis: 'h',
                inputId: 'prop-height',
                value: userData.height,
                objectId: userData.id,
                property: 'height',
                disabled: isFillMode,
                extraButton: fillButton
            });
        }
        
        if (userData.depth !== undefined) {
            const isContainerChild = object.userData.layout && object.userData.layout.depthMode;
            const isFillMode = isContainerChild && object.userData.layout.depthMode === 'fill';
            const fillButton = isContainerChild ? `<button class="fill-toggle ${isFillMode ? 'active' : ''}" data-object-id="${userData.id}" data-axis="depth" title="Fill depth">⟷</button>` : null;
            
            dimensionAxes.push({
                axis: 'd',
                inputId: 'prop-depth',
                value: userData.depth,
                objectId: userData.id,
                property: 'depth',
                disabled: isFillMode,
                extraButton: fillButton
            });
        }
        
        if (dimensionAxes.length > 0) {
            html += this.generateAxisInputGroup('Dimensions', dimensionAxes);
        }
        if (userData.radius !== undefined) {
            html += this.generatePropertyRow('Radius', 'prop-radius', userData.radius, userData.id, 'radius');
        }
        
        // Position (with colored axis labels and standardized layout)
        const positionAxes = [
            {
                axis: 'x',
                inputId: 'prop-x',
                value: object.position.x,
                objectId: userData.id,
                property: 'x',
                disabled: false
            },
            {
                axis: 'y',
                inputId: 'prop-y',
                value: object.position.y,
                objectId: userData.id,
                property: 'y',
                disabled: false
            },
            {
                axis: 'z',
                inputId: 'prop-z',
                value: object.position.z,
                objectId: userData.id,
                property: 'z',
                disabled: false
            }
        ];
        
        html += this.generateAxisInputGroup('Position', positionAxes);
        
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
                <option value="front" ${container.userData.alignmentMode === 'front' ? 'selected' : ''}>Front</option>
                <option value="back" ${container.userData.alignmentMode === 'back' ? 'selected' : ''}>Back</option>
                <option value="top" ${container.userData.alignmentMode === 'top' ? 'selected' : ''}>Top</option>
                <option value="bottom" ${container.userData.alignmentMode === 'bottom' ? 'selected' : ''}>Bottom</option>
            </select>
        </div>`;
        
        // Padding Controls (standardized with section header)
        if (container.userData.paddingMode === 'uniform') {
            html += this.generateSectionHeader('Padding');
            html += `<div class="property-row">
                <div class="property-input-container">
                    <input type="number" 
                        class="property-input property-input-compact" 
                        id="container-padding" 
                        value="${container.userData.padding.toFixed(2)}" 
                        step="0.1" 
                        min="0"
                        data-container-id="${container.userData.id}">
                    <div class="property-arrows">
                        <div class="property-arrow-up" data-target="container-padding">▲</div>
                        <div class="property-arrow-down" data-target="container-padding">▼</div>
                    </div>
                    <button class="expand-padding-btn" data-container-id="${container.userData.id}" title="Separate padding controls">⋯</button>
                </div>
            </div>`;
        } else {
            const paddingAxes = [
                {
                    axis: 'x',
                    inputId: 'container-padding-x',
                    value: container.userData.paddingX,
                    objectId: container.userData.id,
                    property: 'paddingX',
                    disabled: false
                },
                {
                    axis: 'y',
                    inputId: 'container-padding-y',
                    value: container.userData.paddingY,
                    objectId: container.userData.id,
                    property: 'paddingY',
                    disabled: false
                },
                {
                    axis: 'z',
                    inputId: 'container-padding-z',
                    value: container.userData.paddingZ,
                    objectId: container.userData.id,
                    property: 'paddingZ',
                    disabled: false
                }
            ];
            
            html += this.generateAxisInputGroup('Padding', paddingAxes, true);
            html += `<div class="property-row">
                <button class="collapse-padding-btn" data-container-id="${container.userData.id}" title="Uniform padding control">←</button>
            </div>`;
        }
        
        html += `</div>`;
        return html;
    }
    
    setupPaddingArrows(container) {
        // Setup arrows for uniform padding
        const setupArrowsForInput = (inputId, callback) => {
            const input = document.getElementById(inputId);
            if (!input) return;
            
            const inputContainer = input.closest('.property-input-container');
            if (!inputContainer) return;
            
            const upArrow = inputContainer.querySelector('.property-arrow-up');
            const downArrow = inputContainer.querySelector('.property-arrow-down');
            
            if (upArrow) {
                upArrow.addEventListener('click', () => {
                    const currentValue = parseFloat(input.value) || 0;
                    const step = parseFloat(input.step) || 0.1;
                    const max = parseFloat(input.max) || 999;
                    const newValue = Math.min(currentValue + step, max);
                    input.value = newValue.toFixed(2);
                    callback(newValue);
                });
            }
            
            if (downArrow) {
                downArrow.addEventListener('click', () => {
                    const currentValue = parseFloat(input.value) || 0;
                    const step = parseFloat(input.step) || 0.1;
                    const min = parseFloat(input.min) || 0;
                    const newValue = Math.max(currentValue - step, min);
                    input.value = newValue.toFixed(2);
                    callback(newValue);
                });
            }
        };
        
        // Setup arrows for all padding inputs
        setupArrowsForInput('container-padding', (value) => {
            container.setPadding(value);
        });
        
        setupArrowsForInput('container-padding-x', (value) => {
            container.setPaddingAxis('x', value);
        });
        
        setupArrowsForInput('container-padding-y', (value) => {
            container.setPaddingAxis('y', value);
        });
        
        setupArrowsForInput('container-padding-z', (value) => {
            container.setPaddingAxis('z', value);
        });
    }

    getObjectLayoutPropertiesHTML(object) {
        const userData = object.userData;
        
        // Initialize layout properties if not present
        if (!userData.layout) {
            userData.layout = {
                widthMode: 'fixed',
                heightMode: 'fixed',
                depthMode: 'fixed',
                fixedWidth: userData.width || 1,
                fixedHeight: userData.height || 1,
                fixedDepth: userData.depth || 1,
                fillWeight: 1
            };
        }
        
        let html = `<div class="property-group">
            <h4>Layout Properties</h4>`;
        
        // Width Mode
        html += `<div class="property-row">
            <span class="property-label">Width Mode:</span>
            <select class="layout-mode-select" data-object-id="${userData.id}" data-axis="width">
                <option value="fixed" ${userData.layout.widthMode === 'fixed' ? 'selected' : ''}>Fixed</option>
                <option value="fill" ${userData.layout.widthMode === 'fill' ? 'selected' : ''}>Fill</option>
            </select>
        </div>`;
        
        // Show fixed width input if in fixed mode
        if (userData.layout.widthMode === 'fixed') {
            html += `<div class="property-row">
                <span class="property-label">Fixed Width:</span>
                <div class="property-input-container">
                    <input class="property-input" type="number" step="0.1" 
                       value="${(userData.layout.fixedWidth || 1).toFixed(2)}"
                       data-object-id="${userData.id}" data-property="fixedWidth" />
                </div>
            </div>`;
        }
        
        // Height Mode  
        html += `<div class="property-row">
            <span class="property-label">Height Mode:</span>
            <select class="layout-mode-select" data-object-id="${userData.id}" data-axis="height">
                <option value="fixed" ${userData.layout.heightMode === 'fixed' ? 'selected' : ''}>Fixed</option>
                <option value="fill" ${userData.layout.heightMode === 'fill' ? 'selected' : ''}>Fill</option>
            </select>
        </div>`;
        
        // Show fixed height input if in fixed mode
        if (userData.layout.heightMode === 'fixed') {
            html += `<div class="property-row">
                <span class="property-label">Fixed Height:</span>
                <div class="property-input-container">
                    <input class="property-input" type="number" step="0.1" 
                       value="${(userData.layout.fixedHeight || 1).toFixed(2)}"
                       data-object-id="${userData.id}" data-property="fixedHeight" />
                </div>
            </div>`;
        }
        
        // Depth Mode
        html += `<div class="property-row">
            <span class="property-label">Depth Mode:</span>
            <select class="layout-mode-select" data-object-id="${userData.id}" data-axis="depth">
                <option value="fixed" ${userData.layout.depthMode === 'fixed' ? 'selected' : ''}>Fixed</option>
                <option value="fill" ${userData.layout.depthMode === 'fill' ? 'selected' : ''}>Fill</option>
            </select>
        </div>`;
        
        // Show fixed depth input if in fixed mode
        if (userData.layout.depthMode === 'fixed') {
            html += `<div class="property-row">
                <span class="property-label">Fixed Depth:</span>
                <div class="property-input-container">
                    <input class="property-input" type="number" step="0.1" 
                       value="${(userData.layout.fixedDepth || 1).toFixed(2)}"
                       data-object-id="${userData.id}" data-property="fixedDepth" />
                </div>
            </div>`;
        }
        
        // Fill Weight (shown for any fill mode)
        if (userData.layout.widthMode === 'fill' || userData.layout.heightMode === 'fill' || userData.layout.depthMode === 'fill') {
            html += `<div class="property-row">
                <span class="property-label">Fill Weight:</span>
                <div class="property-input-container">
                    <input class="property-input" type="number" step="0.1" min="0.1" 
                       value="${(userData.layout.fillWeight || 1).toFixed(1)}"
                       data-object-id="${userData.id}" data-property="fillWeight" /></div>
            </div>`;
        }
        
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
                    this.selectionManager.applyPropertyChange(object, input);
                    input.blur(); // Remove focus
                } else if (event.key === 'Tab') {
                    // Tab navigation will be handled by default browser behavior
                    // We can enhance this later
                }
            });
            
            // Handle blur (when input loses focus)
            input.addEventListener('blur', () => {
                this.selectionManager.applyPropertyChange(object, input);
            });
            
            // Real-time validation (optional)
            input.addEventListener('input', () => {
                this.validatePropertyInput(input);
            });
        });
        
        // Setup drag controls for dimension inputs
        this.setupDragControls(object);
        
        // Container-specific controls
        if (object.isContainer) {
            this.setupContainerControlListeners(object);
        }
    }
    
    setupDragControls(object) {
        // Get all drag control buttons for this object (now using property-arrow classes)
        const dragButtons = document.querySelectorAll('.property-arrow-up, .property-arrow-down');
        
        dragButtons.forEach(button => {
            const targetInputId = button.dataset.target;
            const targetInput = document.getElementById(targetInputId);
            
            if (!targetInput) return;
            
            // Single click handlers for up/down buttons
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const isUp = button.classList.contains('property-arrow-up');
                const step = parseFloat(targetInput.step) || 0.1;
                const currentValue = parseFloat(targetInput.value) || 0;
                const newValue = isUp ? currentValue + step : currentValue - step;
                
                // Apply minimum value constraint only for dimensions, not positions
                const property = targetInput.dataset.property;
                const isDimension = ['width', 'height', 'depth', 'radius'].includes(property);
                const finalValue = isDimension ? Math.max(0.01, newValue) : newValue;
                
                targetInput.value = finalValue.toFixed(2);
                this.selectionManager.applyPropertyChange(object, targetInput);
            });
            
            // Mouse move handler (attached to document to work outside button)
            const handleMouseMove = (event) => {
                if (!isDragging) return;
                
                event.preventDefault();
                const deltaY = startY - event.clientY; // Inverted: up = positive
                const deltaValue = deltaY * dragSensitivity;
                
                // Apply minimum value constraint only for dimensions, not positions
                const property = targetInput.dataset.property;
                const isDimension = ['width', 'height', 'depth', 'radius'].includes(property);
                const newValue = isDimension ? Math.max(0.01, startValue + deltaValue) : startValue + deltaValue;
                
                targetInput.value = newValue.toFixed(2);
                
                // Apply change in real-time during drag
                this.selectionManager.applyPropertyChange(object, targetInput);
            };
            
            // Mouse up handler
            const handleMouseUp = (event) => {
                if (!isDragging) return;
                
                isDragging = false;
                
                // Restore cursor and button appearance
                button.style.cursor = '';
                button.style.backgroundColor = '';
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // Prevent selection clearing by marking this as an interaction
                if (window.modlerApp && window.modlerApp.eventManager) {
                    window.modlerApp.eventManager.setWasInteracting(true);
                }
                
                // Remove global listeners
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                
                // Prevent this mouseup from triggering other click handlers
                event.preventDefault();
                event.stopPropagation();
            };
            
            // Mouse down for drag functionality
            let isDragging = false;
            let startY = 0;
            let startValue = 0;
            let dragSensitivity = 0.01; // How much the value changes per pixel
            
            button.addEventListener('mousedown', (event) => {
                event.preventDefault();
                isDragging = true;
                startY = event.clientY;
                startValue = parseFloat(targetInput.value) || 0;
                
                // Change cursor and button appearance
                button.style.cursor = 'ns-resize';
                button.style.backgroundColor = '#0078d4';
                document.body.style.cursor = 'ns-resize';
                
                // Prevent text selection during drag
                document.body.style.userSelect = 'none';
                
                // Add global listeners for drag
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
        });
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
            
            // Add hover highlighting for alignment options
            const alignmentOptions = alignmentSelect.querySelectorAll('option');
            alignmentSelect.addEventListener('mouseover', (event) => {
                if (event.target.tagName === 'OPTION') {
                    this.highlightContainerFace(container, event.target.value);
                }
            });
            
            alignmentSelect.addEventListener('mouseout', () => {
                this.clearContainerFaceHighlight(container);
            });
            
            // Also highlight on dropdown open/close
            alignmentSelect.addEventListener('focus', () => {
                // When dropdown opens, highlight current selection
                this.highlightContainerFace(container, alignmentSelect.value);
            });
            
            alignmentSelect.addEventListener('blur', () => {
                // When dropdown closes, clear highlights
                this.clearContainerFaceHighlight(container);
            });
        }
        
        // Padding controls
        const paddingInput = document.getElementById('container-padding');
        if (paddingInput) {
            paddingInput.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value) || 0;
                container.setPadding(value);
            });
        }
        
        const paddingXInput = document.getElementById('container-padding-x');
        const paddingYInput = document.getElementById('container-padding-y');
        const paddingZInput = document.getElementById('container-padding-z');
        
        if (paddingXInput) {
            paddingXInput.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value) || 0;
                container.setPaddingAxis('x', value);
            });
        }
        
        if (paddingYInput) {
            paddingYInput.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value) || 0;
                container.setPaddingAxis('y', value);
            });
        }
        
        if (paddingZInput) {
            paddingZInput.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value) || 0;
                container.setPaddingAxis('z', value);
            });
        }
        
        // Expand/collapse padding buttons
        const expandPaddingBtn = document.querySelector('.expand-padding-btn');
        if (expandPaddingBtn) {
            expandPaddingBtn.addEventListener('click', () => {
                container.setPaddingMode('separate');
                // Find the properties panel container and refresh
                const propertiesPanel = document.querySelector('.properties-panel .panel-content');
                if (propertiesPanel) {
                    this.showObjectProperties(container, propertiesPanel);
                }
            });
        }
        
        const collapsePaddingBtn = document.querySelector('.collapse-padding-btn');
        if (collapsePaddingBtn) {
            collapsePaddingBtn.addEventListener('click', () => {
                container.setPaddingMode('uniform');
                // Find the properties panel container and refresh
                const propertiesPanel = document.querySelector('.properties-panel .panel-content');
                if (propertiesPanel) {
                    this.showObjectProperties(container, propertiesPanel);
                }
            });
        }
        
        // Set up arrow controls for padding inputs
        this.setupPaddingArrows(container);
        
        // Layout mode selects
        const layoutModeSelects = document.querySelectorAll('.layout-mode-select');
        layoutModeSelects.forEach(select => {
            select.addEventListener('change', (event) => {
                this.handleLayoutModeChange(select);
            });
        });
        
        // Fixed size inputs for objects in containers
        const layoutFixedInputs = document.querySelectorAll('.layout-fixed-size');
        layoutFixedInputs.forEach(input => {
            input.addEventListener('input', (event) => {
                this.handleLayoutSizeChange(event.target);
            });
        });
        
        // Fill weight inputs for objects in containers
        const fillWeightInputs = document.querySelectorAll('.layout-fill-weight');
        fillWeightInputs.forEach(input => {
            input.addEventListener('input', (event) => {
                this.handleFillWeightChange(event.target);
            });
        });

        // Fill toggle buttons
        const fillToggleButtons = document.querySelectorAll('.fill-toggle');
        fillToggleButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.handleFillToggle(button);
            });
        });
    }

    handleFillToggle(button) {
        const objectId = button.dataset.objectId;
        const axis = button.dataset.axis;
        const object = this.findObjectById(objectId);
        
        if (!object || !object.userData.layout) return;
        
        const modeProperty = axis + 'Mode';
        const isCurrentlyFill = object.userData.layout[modeProperty] === 'fill';
        const newMode = isCurrentlyFill ? 'fixed' : 'fill';
        
        // Toggle the mode
        this.handleLayoutModeChange({ 
            dataset: { objectId, axis }, 
            value: newMode 
        });
        
        // Update UI
        this.updatePropertyPanel();
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

    // Container face highlighting for alignment preview
    highlightContainerFace(container, alignmentValue) {
        if (!this.highlightManager || alignmentValue === 'none') {
            this.clearContainerFaceHighlight(container);
            return;
        }
        
        // Remove existing highlight
        this.clearContainerFaceHighlight(container);
        
        const boundingBox = container.boundingBox;
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        boundingBox.getSize(size);
        boundingBox.getCenter(center);
        
        let faceGeometry = null;
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB, // Sky blue
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        // Create geometry for the face based on alignment value
        switch (alignmentValue) {
            case 'left':
                faceGeometry = new THREE.PlaneGeometry(size.z, size.y);
                break;
            case 'right':
                faceGeometry = new THREE.PlaneGeometry(size.z, size.y);
                break;
            case 'front':
                faceGeometry = new THREE.PlaneGeometry(size.x, size.y);
                break;
            case 'back':
                faceGeometry = new THREE.PlaneGeometry(size.x, size.y);
                break;
            case 'top':
                faceGeometry = new THREE.PlaneGeometry(size.x, size.z);
                break;
            case 'bottom':
                faceGeometry = new THREE.PlaneGeometry(size.x, size.z);
                break;
            case 'center':
                // For center alignment, highlight all faces with lower opacity
                const centerMaterial = highlightMaterial.clone();
                centerMaterial.opacity = 0.1;
                
                // Create a box that's slightly larger than the container
                faceGeometry = new THREE.BoxGeometry(size.x * 1.01, size.y * 1.01, size.z * 1.01);
                highlightMaterial.opacity = 0.1;
                break;
        }
        
        if (!faceGeometry) return;
        
        // Create face highlight mesh
        container.faceHighlight = new THREE.Mesh(faceGeometry, highlightMaterial);
        container.faceHighlight.position.copy(center);
        
        // Position and orient the face highlight
        this.positionFaceHighlight(container.faceHighlight, alignmentValue, center, size);
        
        // Add to scene
        if (window.modlerApp && window.modlerApp.sceneManager) {
            window.modlerApp.sceneManager.scene.add(container.faceHighlight);
        }
    }
    
    positionFaceHighlight(highlight, alignmentValue, center, size) {
        // For 'center' alignment, create a subtle highlight of all faces
        if (alignmentValue === 'center') {
            // Box highlight is already positioned at center
            return;
        }
        
        // Position the face highlight on the correct face
        switch (alignmentValue) {
            case 'left':
                highlight.position.x = center.x - size.x / 2;
                highlight.rotation.y = Math.PI / 2;
                break;
            case 'right':
                highlight.position.x = center.x + size.x / 2;
                highlight.rotation.y = -Math.PI / 2;
                break;
            case 'front':
                highlight.position.z = center.z - size.z / 2;
                break;
            case 'back':
                highlight.position.z = center.z + size.z / 2;
                break;
            case 'top':
                highlight.position.y = center.y + size.y / 2;
                highlight.rotation.x = -Math.PI / 2;
                break;
            case 'bottom':
                highlight.position.y = center.y - size.y / 2;
                highlight.rotation.x = Math.PI / 2;
                break;
        }
    }
    
    clearContainerFaceHighlight(container) {
        if (container.faceHighlight) {
            if (container.faceHighlight.parent) {
                container.faceHighlight.parent.remove(container.faceHighlight);
            }
            if (container.faceHighlight.geometry) {
                container.faceHighlight.geometry.dispose();
            }
            if (container.faceHighlight.material) {
                container.faceHighlight.material.dispose();
            }
            container.faceHighlight = null;
        }
    }

    // Refresh the properties panel for the currently selected object
    refreshProperties() {
        const firstSelected = this.selectionManager.getFirstSelected();
        if (firstSelected) {
            // Update the properties panel with current object values
            this.updatePropertyPanel();
        }
    }

    // Layout Property Handlers (moved from SelectionManager)
    handleLayoutModeChange(selectElement) {
        const objectId = selectElement.dataset.objectId;
        const axis = selectElement.dataset.axis; // 'width', 'height', or 'depth'
        const mode = selectElement.value; // 'fixed' or 'fill'
        
        const object = this.findObjectById(objectId);
        if (!object || !object.userData.layout) return;
        
        console.log(`LAYOUT: Changing ${axis} mode to ${mode} for object ${objectId}`);
        
        // Store current size as fixed size before switching to fill
        if (mode === 'fill' && object.userData.layout[axis + 'Mode'] === 'fixed') {
            const currentProperty = axis === 'width' ? 'width' : axis === 'height' ? 'height' : 'depth';
            const currentSize = object.userData[currentProperty];
            if (currentSize !== undefined) {
                object.userData.layout['fixed' + axis.charAt(0).toUpperCase() + axis.slice(1)] = currentSize;
                console.log(`LAYOUT: Remembered ${axis} size: ${currentSize} for object ${objectId}`);
            }
        }
        
        // Update the mode
        object.userData.layout[axis + 'Mode'] = mode;
        
        // If switching to fixed mode, restore the remembered size
        if (mode === 'fixed') {
            const fixedSizeProperty = 'fixed' + axis.charAt(0).toUpperCase() + axis.slice(1);
            const rememberedSize = object.userData.layout[fixedSizeProperty];
            if (rememberedSize !== undefined) {
                const targetProperty = axis === 'width' ? 'width' : axis === 'height' ? 'height' : 'depth';
                object.userData[targetProperty] = rememberedSize;
                this.updateObjectGeometry(object);
                console.log(`LAYOUT: Restored ${axis} size: ${rememberedSize} for object ${objectId}`);
            }
        }
        
        // Trigger container layout recalculation
        if (object.userData.parentContainer && window.modlerApp && window.modlerApp.autoLayoutManager) {
            window.modlerApp.autoLayoutManager.onContainerChildrenChanged(object.userData.parentContainer);
        }
        
        // Refresh properties panel to show/hide fixed size inputs
        this.updatePropertyPanel();
    }
    
    handleLayoutSizeChange(inputElement) {
        const objectId = inputElement.dataset.objectId;
        const property = inputElement.dataset.property; // 'fixedWidth', 'fixedHeight', 'fixedDepth'
        const newValue = parseFloat(inputElement.value);
        
        if (isNaN(newValue) || newValue <= 0) return;
        
        const object = this.findObjectById(objectId);
        if (!object || !object.userData.layout) return;
        
        console.log(`LAYOUT: Updating ${property} to ${newValue} for object ${objectId}`);
        
        // Update the fixed size
        object.userData.layout[property] = newValue;
        
        // If currently in fixed mode, also update the actual object size
        const axis = property.replace('fixed', '').toLowerCase();
        const modeProperty = axis + 'Mode';
        
        if (object.userData.layout[modeProperty] === 'fixed') {
            const targetProperty = axis === 'width' ? 'width' : axis === 'height' ? 'height' : 'depth';
            object.userData[targetProperty] = newValue;
            this.updateObjectGeometry(object);
            
            // Trigger container layout recalculation
            if (object.userData.parentContainer && window.modlerApp && window.modlerApp.autoLayoutManager) {
                window.modlerApp.autoLayoutManager.onContainerChildrenChanged(object.userData.parentContainer);
            }
        }
    }
    
    handleFillWeightChange(inputElement) {
        const objectId = inputElement.dataset.objectId;
        const newValue = parseFloat(inputElement.value);
        
        if (isNaN(newValue) || newValue < 0.1) return;
        
        const object = this.findObjectById(objectId);
        if (!object || !object.userData.layout) return;
        
        console.log(`LAYOUT: Updating fill weight to ${newValue} for object ${objectId}`);
        
        // Update the fill weight
        object.userData.layout.fillWeight = newValue;
        
        // Trigger container layout recalculation
        if (object.userData.parentContainer && window.modlerApp && window.modlerApp.autoLayoutManager) {
            window.modlerApp.autoLayoutManager.onContainerChildrenChanged(object.userData.parentContainer);
        }
    }
    
    findObjectById(objectId) {
        // Use objectManager if available, otherwise traverse scene
        if (window.modlerApp && window.modlerApp.objectManager) {
            const objects = window.modlerApp.objectManager.getObjects();
            for (const object of objects.values()) {
                if (object.userData.id === objectId) {
                    return object;
                }
            }
        }
        
        // Fallback to scene traversal
        let foundObject = null;
        if (window.modlerApp && window.modlerApp.sceneManager) {
            window.modlerApp.sceneManager.scene.traverse((child) => {
                if (child.userData && child.userData.id === objectId) {
                    foundObject = child;
                }
            });
        }
        
        return foundObject;
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
}

// Export for module use
window.PropertyPanelManager = PropertyPanelManager;