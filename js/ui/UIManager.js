export class UIManager {
    constructor(scene, toolManager, unitsManager) {
        this.scene = scene;
        this.toolManager = toolManager;
        this.unitsManager = unitsManager;
        
        this.propertiesPanel = null;
        this.dimensionInput = null;
        
        this.init();
    }

    init() {
        this.setupPropertiesPanel();
        this.setupDimensionInput();
        this.setupEventListeners();
    }

    setupPropertiesPanel() {
        this.propertiesPanel = document.getElementById('properties-panel');
        const panelToggle = document.getElementById('panel-toggle');
        const panelContent = document.querySelector('.panel-content');
        
        if (panelToggle && panelContent) {
            panelToggle.addEventListener('click', () => {
                const isCollapsed = panelContent.style.display === 'none';
                panelContent.style.display = isCollapsed ? 'block' : 'none';
                panelToggle.textContent = isCollapsed ? '−' : '+';
            });
        }
    }

    setupDimensionInput() {
        this.dimensionInput = document.getElementById('dimension-input');
        const confirmBtn = document.getElementById('dimension-confirm');
        const cancelBtn = document.getElementById('dimension-cancel');
        const inputField = document.getElementById('dimension-value');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmDimension());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelDimension());
        }
        
        if (inputField) {
            inputField.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    this.confirmDimension();
                } else if (event.key === 'Escape') {
                    this.cancelDimension();
                }
            });
        }
    }

    setupEventListeners() {
        document.addEventListener('selectionChange', (event) => {
            this.updatePropertiesPanel(event.detail.selectedObjects);
        });
        
        document.addEventListener('unitsChange', (event) => {
            this.updateUnitsDisplay();
            this.updatePropertiesPanel(this.scene.selectionManager.getSelected());
        });
    }

    updatePropertiesPanel(selectedObjects) {
        const propertiesContent = document.getElementById('object-properties');
        if (!propertiesContent) return;

        propertiesContent.innerHTML = '';

        if (selectedObjects.length === 0) {
            propertiesContent.innerHTML = '<p style="color: #666; font-style: italic;">No selection</p>';
            return;
        }

        if (selectedObjects.length === 1) {
            this.displaySingleObjectProperties(selectedObjects[0], propertiesContent);
        } else {
            this.displayMultiObjectProperties(selectedObjects, propertiesContent);
        }
    }

    displaySingleObjectProperties(object, container) {
        const userData = object.userData;
        
        // Object info
        const infoGroup = this.createPropertyGroup('Object', container);
        this.addPropertyRow(infoGroup, 'Type', userData.type || 'mesh');
        this.addPropertyRow(infoGroup, 'ID', userData.id || 'N/A');

        // Position
        const positionGroup = this.createPropertyGroup('Position', container);
        this.addEditablePropertyRow(positionGroup, 'X', object.position.x, 'position.x', object);
        this.addEditablePropertyRow(positionGroup, 'Y', object.position.y, 'position.y', object);
        this.addEditablePropertyRow(positionGroup, 'Z', object.position.z, 'position.z', object);

        // Rotation
        const rotationGroup = this.createPropertyGroup('Rotation', container);
        this.addEditablePropertyRow(rotationGroup, 'X', THREE.MathUtils.radToDeg(object.rotation.x), 'rotation.x', object, '°');
        this.addEditablePropertyRow(rotationGroup, 'Y', THREE.MathUtils.radToDeg(object.rotation.y), 'rotation.y', object, '°');
        this.addEditablePropertyRow(rotationGroup, 'Z', THREE.MathUtils.radToDeg(object.rotation.z), 'rotation.z', object, '°');

        // Type-specific properties
        if (userData.type === 'rectangle') {
            const sizeGroup = this.createPropertyGroup('Size', container);
            this.addEditablePropertyRow(sizeGroup, 'Width', userData.width, 'width', object);
            this.addEditablePropertyRow(sizeGroup, 'Height', userData.height, 'height', object);
        } else if (userData.type === 'circle') {
            const sizeGroup = this.createPropertyGroup('Size', container);
            this.addEditablePropertyRow(sizeGroup, 'Radius', userData.radius, 'radius', object);
        }
    }

    displayMultiObjectProperties(objects, container) {
        const infoGroup = this.createPropertyGroup('Selection', container);
        this.addPropertyRow(infoGroup, 'Objects', objects.length);
        
        // Show common properties if they exist
        const types = [...new Set(objects.map(obj => obj.userData.type))];
        if (types.length === 1) {
            this.addPropertyRow(infoGroup, 'Type', types[0]);
        }
    }

    createPropertyGroup(title, container) {
        const group = document.createElement('div');
        group.className = 'property-group';
        
        const header = document.createElement('h4');
        header.textContent = title;
        group.appendChild(header);
        
        container.appendChild(group);
        return group;
    }

    addPropertyRow(group, label, value, unit = '') {
        const row = document.createElement('div');
        row.className = 'property-row';
        
        const labelEl = document.createElement('span');
        labelEl.className = 'property-label';
        labelEl.textContent = label;
        
        const valueEl = document.createElement('span');
        valueEl.className = 'property-value';
        
        if (typeof value === 'number') {
            const formatted = this.unitsManager.formatValue(value, null, unit === '');
            valueEl.textContent = formatted + (unit || '');
        } else {
            valueEl.textContent = value;
        }
        
        row.appendChild(labelEl);
        row.appendChild(valueEl);
        group.appendChild(row);
    }

    addEditablePropertyRow(group, label, value, property, object, unit = '') {
        const row = document.createElement('div');
        row.className = 'property-row';
        
        const labelEl = document.createElement('span');
        labelEl.className = 'property-label';
        labelEl.textContent = label;
        
        const input = document.createElement('input');
        input.className = 'property-input';
        input.type = 'text';
        
        if (typeof value === 'number') {
            if (unit === '°') {
                input.value = value.toFixed(1);
            } else {
                input.value = this.unitsManager.formatValue(value, null, false);
            }
        } else {
            input.value = value;
        }
        
        input.addEventListener('change', () => {
            this.updateObjectProperty(object, property, input.value, unit);
        });
        
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                input.blur();
            }
        });
        
        row.appendChild(labelEl);
        row.appendChild(input);
        group.appendChild(row);
    }

    updateObjectProperty(object, property, value, unit) {
        const parts = property.split('.');
        let target = object;
        
        // Navigate to the property
        for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]];
        }
        
        const finalProp = parts[parts.length - 1];
        let numericValue;
        
        if (unit === '°') {
            numericValue = parseFloat(value);
            if (!isNaN(numericValue)) {
                target[finalProp] = THREE.MathUtils.degToRad(numericValue);
            }
        } else if (property.startsWith('position') || property.startsWith('scale')) {
            numericValue = this.unitsManager.parseValue(value);
            target[finalProp] = numericValue;
        } else if (property === 'width' || property === 'height' || property === 'radius') {
            numericValue = this.unitsManager.parseValue(value);
            object.userData[property] = numericValue;
            this.updateObjectGeometry(object);
        } else {
            target[finalProp] = parseFloat(value) || value;
        }
        
        console.log(`Updated ${property} to ${value}`);
    }

    updateObjectGeometry(object) {
        const userData = object.userData;
        
        if (userData.type === 'rectangle' && userData.width && userData.height) {
            object.geometry.dispose();
            object.geometry = new THREE.PlaneGeometry(userData.width, userData.height);
        } else if (userData.type === 'circle' && userData.radius) {
            object.geometry.dispose();
            object.geometry = new THREE.CircleGeometry(userData.radius, userData.segments || 32);
        }
    }

    updateUnitsDisplay() {
        const unitInfo = this.unitsManager.getUnitInfo();
        const unitsElement = document.getElementById('units');
        if (unitsElement) {
            unitsElement.textContent = `Units: ${unitInfo.symbol}`;
        }
    }

    showDimensionInput(x, y, currentValue = '') {
        if (!this.dimensionInput) return;
        
        this.dimensionInput.style.left = `${x}px`;
        this.dimensionInput.style.top = `${y}px`;
        this.dimensionInput.classList.remove('hidden');
        
        const inputField = document.getElementById('dimension-value');
        if (inputField) {
            inputField.value = currentValue;
            inputField.focus();
            inputField.select();
        }
    }

    hideDimensionInput() {
        if (this.dimensionInput) {
            this.dimensionInput.classList.add('hidden');
        }
    }

    confirmDimension() {
        const inputField = document.getElementById('dimension-value');
        if (inputField) {
            const value = inputField.value.trim();
            if (value) {
                const event = new CustomEvent('dimensionConfirmed', {
                    detail: { value: value }
                });
                document.dispatchEvent(event);
            }
        }
        this.hideDimensionInput();
    }

    cancelDimension() {
        const event = new CustomEvent('dimensionCancelled');
        document.dispatchEvent(event);
        this.hideDimensionInput();
    }

    update() {
        // Update any animated UI elements
    }

    dispose() {
        // Clean up event listeners and resources
    }
}