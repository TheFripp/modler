/**
 * ObjectManager - Centralized object lifecycle and metadata management
 * 
 * This manager provides unified object creation, registration, and disposal
 * with consistent ID generation, metadata handling, and hierarchy management.
 */
class ObjectManager {
    constructor(sceneManager, materialManager, stateManager, autoLayoutManager = null) {
        this.sceneManager = sceneManager;
        this.materialManager = materialManager;
        this.stateManager = stateManager;
        this.autoLayoutManager = autoLayoutManager;
        
        // Object registry
        this.objects = new Map(); // id -> object
        this.objectsByType = new Map(); // type -> Set of objects
        this.containers = new Map(); // id -> container
        
        // ID generation
        this.nextId = 1;
        this.idPrefix = 'obj_';
        
        // Object type definitions
        this.objectTypes = {
            'box': {
                geometryClass: THREE.BoxGeometry,
                defaultDimensions: { width: 2, height: 1, depth: 3 },
                material: 'standard',
                selectable: true,
                moveable: true,
                resizable: true
            },
            'rectangle': {
                geometryClass: THREE.PlaneGeometry,
                defaultDimensions: { width: 2, height: 1, depth: 0.01 },
                material: 'standard',
                selectable: true,
                moveable: true,
                resizable: true
            },
            'container': {
                geometryClass: null, // Containers don't have geometry
                defaultDimensions: {},
                material: null,
                selectable: true,
                moveable: true,
                resizable: false
            }
        };
        
        // Object templates for consistent creation
        this.templates = new Map();
        
        // Disposal tracking
        this.disposalQueue = new Set();
        
        console.log('OBJECTS: ObjectManager initialized with', Object.keys(this.objectTypes).length, 'object types');
    }
    
    /**
     * Create a new object with consistent metadata and registration
     * @param {string} type - Object type (box, rectangle, container)
     * @param {object} options - Creation options
     * @returns {THREE.Object3D} Created object
     */
    createObject(type, options = {}) {
        const objectType = this.objectTypes[type];
        if (!objectType) {
            throw new Error(`Unknown object type: ${type}`);
        }
        
        // Generate unique ID
        const id = this.generateId(type);
        
        // Prepare object metadata
        const metadata = this.createMetadata(type, id, options);
        
        // Create the Three.js object
        let object;
        if (type === 'container') {
            object = this.createContainer(metadata, options);
        } else {
            object = this.createMeshObject(type, metadata, options);
        }
        
        // Register the object
        this.registerObject(object);
        
        // Add to scene
        this.sceneManager.addObject(object);
        
        // Update state
        this.updateObjectCounts();
        
        console.log('OBJECTS: Created', type, 'with ID:', id);
        return object;
    }
    
    /**
     * Register an existing object with the manager
     * @param {THREE.Object3D} object - Object to register
     */
    registerObject(object) {
        const id = object.userData.id;
        const type = object.userData.type;
        
        // Add to main registry
        this.objects.set(id, object);
        
        // Add to type registry
        if (!this.objectsByType.has(type)) {
            this.objectsByType.set(type, new Set());
        }
        this.objectsByType.get(type).add(object);
        
        // Track containers separately
        if (type === 'container') {
            this.containers.set(id, object);
        }
        
        // Add to hierarchy tracking
        this.updateHierarchyState(object);
    }
    
    /**
     * Remove object and clean up all references
     * @param {string|THREE.Object3D} objectOrId - Object or ID to remove
     */
    removeObject(objectOrId) {
        const object = typeof objectOrId === 'string' ? this.objects.get(objectOrId) : objectOrId;
        if (!object) return false;
        
        const id = object.userData.id;
        const type = object.userData.type;
        
        // Remove from hierarchy if it's a child
        if (object.userData.parentContainer) {
            object.userData.parentContainer.removeChild(object);
        }
        
        // If it's a container, remove all children first
        if (type === 'container' && object.childObjects) {
            const children = Array.from(object.childObjects);
            children.forEach(child => this.removeObject(child));
        }
        
        // Remove from scene
        this.sceneManager.removeObject(object);
        
        // Clean up materials
        if (object.material) {
            this.materialManager.releaseMaterial(object.material);
        }
        
        // Clean up geometry
        if (object.geometry) {
            object.geometry.dispose();
        }
        
        // Remove from registries
        this.objects.delete(id);
        
        const typeSet = this.objectsByType.get(type);
        if (typeSet) {
            typeSet.delete(object);
            if (typeSet.size === 0) {
                this.objectsByType.delete(type);
            }
        }
        
        if (type === 'container') {
            this.containers.delete(id);
        }
        
        // Update state
        this.updateObjectCounts();
        this.removeFromHierarchyState(object);
        
        console.log('OBJECTS: Removed', type, 'with ID:', id);
        return true;
    }
    
    /**
     * Get object by ID
     * @param {string} id - Object ID
     * @returns {THREE.Object3D|null}
     */
    getObject(id) {
        return this.objects.get(id) || null;
    }
    
    /**
     * Get all objects of a specific type
     * @param {string} type - Object type
     * @returns {Set<THREE.Object3D>}
     */
    getObjectsByType(type) {
        return this.objectsByType.get(type) || new Set();
    }
    
    /**
     * Get all objects as array
     * @returns {Array<THREE.Object3D>}
     */
    getAllObjects() {
        return Array.from(this.objects.values());
    }
    
    /**
     * Update object metadata
     * @param {THREE.Object3D} object - Object to update
     * @param {object} updates - Metadata updates
     */
    updateMetadata(object, updates) {
        Object.assign(object.userData, updates);
        
        // Notify hierarchy if visibility changed
        if ('visible' in updates) {
            this.stateManager.set(`hierarchy.visibility.${object.userData.id}`, updates.visible);
        }
        
        // Notify scene of changes
        this.sceneManager.notifyObjectChanged(object);
    }
    
    /**
     * Create object template for reuse
     * @param {string} name - Template name
     * @param {string} type - Object type
     * @param {object} options - Template options
     */
    createTemplate(name, type, options) {
        this.templates.set(name, { type, options });
        console.log('OBJECTS: Created template:', name);
    }
    
    /**
     * Create object from template
     * @param {string} templateName - Template name
     * @param {object} overrides - Option overrides
     * @returns {THREE.Object3D}
     */
    createFromTemplate(templateName, overrides = {}) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template not found: ${templateName}`);
        }
        
        const options = { ...template.options, ...overrides };
        return this.createObject(template.type, options);
    }
    
    /**
     * Set object visibility with hierarchy updates
     * @param {THREE.Object3D} object - Object to update
     * @param {boolean} visible - Visibility state
     */
    setVisibility(object, visible) {
        object.visible = visible;
        this.updateMetadata(object, { visible });
        
        // If it's a container, update children visibility
        if (object.isContainer && object.childObjects) {
            object.childObjects.forEach(child => {
                this.setVisibility(child, visible);
            });
        }
    }
    
    /**
     * Move object in layer hierarchy
     * @param {THREE.Object3D} object - Object to move
     * @param {number} newIndex - New index in layer order
     */
    setLayerIndex(object, newIndex) {
        const layerOrder = this.stateManager.get('hierarchy.layerOrder');
        const currentIndex = layerOrder.indexOf(object.userData.id);
        
        if (currentIndex !== -1) {
            layerOrder.splice(currentIndex, 1);
        }
        
        layerOrder.splice(newIndex, 0, object.userData.id);
        this.stateManager.set('hierarchy.layerOrder', layerOrder);
        
        // Update scene object order for rendering
        this.updateSceneOrder();
    }
    
    // Private methods
    
    generateId(type) {
        const id = `${this.idPrefix}${this.nextId++}`;
        
        // Ensure uniqueness
        while (this.objects.has(id)) {
            this.nextId++;
            const newId = `${this.idPrefix}${this.nextId}`;
            if (!this.objects.has(newId)) {
                return newId;
            }
        }
        
        return id;
    }
    
    createMetadata(type, id, options) {
        const objectType = this.objectTypes[type];
        const defaultDims = objectType.defaultDimensions;
        
        return {
            id: id,
            type: type,
            selectable: objectType.selectable,
            visible: true,
            created: Date.now(),
            modified: Date.now(),
            
            // Dimensions
            ...defaultDims,
            ...options.dimensions,
            
            // Hierarchy
            parentContainer: options.parentContainer || null,
            
            // Capabilities
            moveable: objectType.moveable,
            resizable: objectType.resizable,
            
            // Custom properties
            ...options.userData
        };
    }
    
    createMeshObject(type, metadata, options) {
        const objectType = this.objectTypes[type];
        
        // Create geometry
        const geometry = this.createGeometry(type, metadata);
        
        // Get material with type-specific properties
        let materialProperties = options.materialProperties || {};
        
        // Make rectangles (planes) double-sided so they're visible from both sides
        if (type === 'rectangle') {
            materialProperties.side = THREE.DoubleSide;
        }
        
        const material = this.materialManager.getObjectMaterial(
            options.color,
            materialProperties
        );
        
        // Create mesh
        const object = new THREE.Mesh(geometry, material);
        object.userData = metadata;
        
        // Set position
        if (options.position) {
            object.position.copy(options.position);
        }
        
        // Set rotation
        if (options.rotation) {
            object.rotation.copy(options.rotation);
        }
        
        return object;
    }
    
    createContainer(metadata, options) {
        // Import Container class dynamically
        if (!window.Container) {
            console.error('OBJECTS: Container class not available');
            return null;
        }
        
        const container = new Container(
            metadata.id || 'Container',
            this, // objectManager
            this.materialManager,
            this.sceneManager,
            this.autoLayoutManager
        );
        
        // Set position if provided
        if (options.position) {
            container.position.copy(options.position);
        }
        
        // Update userData with provided metadata
        Object.assign(container.userData, metadata);
        
        return container;
    }
    
    createGeometry(type, metadata) {
        const objectType = this.objectTypes[type];
        const GeometryClass = objectType.geometryClass;
        
        switch (type) {
            case 'box':
                return new GeometryClass(metadata.width, metadata.height, metadata.depth);
            case 'rectangle':
                return new GeometryClass(metadata.width, metadata.height);
            default:
                return new GeometryClass();
        }
    }
    
    updateObjectCounts() {
        const totalCount = this.objects.size;
        this.stateManager.set('scene.objectCount', totalCount);
    }
    
    updateHierarchyState(object) {
        // Add to root objects if no parent
        if (!object.userData.parentContainer) {
            const rootObjects = this.stateManager.get('hierarchy.rootObjects') || new Set();
            // Ensure it's a Set
            const rootObjectsSet = rootObjects instanceof Set ? rootObjects : new Set(rootObjects);
            rootObjectsSet.add(object.userData.id);
            this.stateManager.set('hierarchy.rootObjects', rootObjectsSet);
        }
        
        // Add to layer order
        const layerOrder = this.stateManager.get('hierarchy.layerOrder') || [];
        if (!layerOrder.includes(object.userData.id)) {
            layerOrder.push(object.userData.id);
            this.stateManager.set('hierarchy.layerOrder', layerOrder);
        }
        
        // Set initial visibility
        this.stateManager.set(`hierarchy.visibility.${object.userData.id}`, object.userData.visible);
    }
    
    removeFromHierarchyState(object) {
        const id = object.userData.id;
        
        // Remove from root objects
        const rootObjects = this.stateManager.get('hierarchy.rootObjects');
        rootObjects.delete(id);
        this.stateManager.set('hierarchy.rootObjects', rootObjects);
        
        // Remove from layer order
        const layerOrder = this.stateManager.get('hierarchy.layerOrder');
        const index = layerOrder.indexOf(id);
        if (index !== -1) {
            layerOrder.splice(index, 1);
            this.stateManager.set('hierarchy.layerOrder', layerOrder);
        }
        
        // Remove visibility state
        const visibility = this.stateManager.get('hierarchy.visibility');
        visibility.delete(id);
        this.stateManager.set('hierarchy.visibility', visibility);
    }
    
    updateSceneOrder() {
        const layerOrder = this.stateManager.get('hierarchy.layerOrder');
        
        // Reorder objects in scene based on layer order
        layerOrder.forEach((id, index) => {
            const object = this.objects.get(id);
            if (object && object.parent) {
                // Remove and re-add to change render order
                const parent = object.parent;
                parent.remove(object);
                parent.add(object);
            }
        });
    }
    
    /**
     * Batch object operations for performance
     * @param {Array} operations - Array of {type: 'create'|'remove'|'update', ...params}
     */
    batchOperation(operations) {
        const results = [];
        
        operations.forEach(op => {
            try {
                switch (op.type) {
                    case 'create':
                        results.push(this.createObject(op.objectType, op.options));
                        break;
                    case 'remove':
                        results.push(this.removeObject(op.objectOrId));
                        break;
                    case 'update':
                        this.updateMetadata(op.object, op.updates);
                        results.push(true);
                        break;
                }
            } catch (error) {
                console.error('OBJECTS: Batch operation failed:', op, error);
                results.push(null);
            }
        });
        
        // Update counts once after all operations
        this.updateObjectCounts();
        
        console.log('OBJECTS: Completed batch operation with', operations.length, 'operations');
        return results;
    }
    
    /**
     * Get object statistics
     */
    getStats() {
        const stats = {
            totalObjects: this.objects.size,
            containers: this.containers.size,
            types: {},
            memoryUsage: {
                materials: this.materialManager.getUsageStats(),
                disposalQueue: this.disposalQueue.size
            }
        };
        
        // Count by type
        this.objectsByType.forEach((objectSet, type) => {
            stats.types[type] = objectSet.size;
        });
        
        return stats;
    }
    
    /**
     * Validate object integrity
     * @param {THREE.Object3D} object - Object to validate
     * @returns {Array} Array of validation errors
     */
    validateObject(object) {
        const errors = [];
        
        if (!object.userData) {
            errors.push('Missing userData');
            return errors;
        }
        
        const required = ['id', 'type', 'selectable', 'visible'];
        required.forEach(prop => {
            if (!(prop in object.userData)) {
                errors.push(`Missing required property: ${prop}`);
            }
        });
        
        // Type-specific validation
        const objectType = this.objectTypes[object.userData.type];
        if (!objectType) {
            errors.push(`Unknown object type: ${object.userData.type}`);
        }
        
        // Check if registered
        if (!this.objects.has(object.userData.id)) {
            errors.push('Object not registered in ObjectManager');
        }
        
        return errors;
    }
    
    /**
     * Repair object integrity issues
     * @param {THREE.Object3D} object - Object to repair
     */
    repairObject(object) {
        const errors = this.validateObject(object);
        if (errors.length === 0) return;
        
        console.log('OBJECTS: Repairing object', object.userData.id, 'errors:', errors);
        
        // Ensure basic userData exists
        if (!object.userData) {
            object.userData = {};
        }
        
        // Generate ID if missing
        if (!object.userData.id) {
            object.userData.id = this.generateId('unknown');
        }
        
        // Set defaults for missing properties
        const defaults = {
            type: 'box',
            selectable: true,
            visible: true,
            created: Date.now(),
            modified: Date.now()
        };
        
        Object.keys(defaults).forEach(prop => {
            if (!(prop in object.userData)) {
                object.userData[prop] = defaults[prop];
            }
        });
        
        // Re-register if needed
        if (!this.objects.has(object.userData.id)) {
            this.registerObject(object);
        }
    }
    
    /**
     * Import objects from scene (for migration scenarios)
     */
    importFromScene() {
        const imported = [];
        
        this.sceneManager.scene.traverse(child => {
            if (child.userData && child.userData.selectable && !this.objects.has(child.userData.id)) {
                this.repairObject(child);
                this.registerObject(child);
                imported.push(child);
            }
        });
        
        console.log('OBJECTS: Imported', imported.length, 'objects from scene');
        return imported;
    }
    
    /**
     * Update object counts in centralized state
     */
    updateObjectCounts() {
        if (!this.stateManager) return;
        
        const totalObjects = this.objects.size;
        const containers = this.containers.size;
        const typeCounts = {};
        
        // Count objects by type
        this.objectsByType.forEach((objectSet, type) => {
            typeCounts[type] = objectSet.size;
        });
        
        // Update centralized state
        this.stateManager.set('scene.objectCount', totalObjects);
        this.stateManager.set('scene.containerCount', containers);
        this.stateManager.set('scene.objectTypes', typeCounts);
        
        console.log('OBJECTS: Updated state - total:', totalObjects, 'containers:', containers);
    }
    
    /**
     * Remove object from hierarchy state
     */
    removeFromHierarchyState(object) {
        if (!this.stateManager || !object.userData) return;
        
        const id = object.userData.id;
        
        // Remove from hierarchy tracking
        const rootObjects = this.stateManager.get('hierarchy.rootObjects', new Set());
        rootObjects.delete(id);
        this.stateManager.set('hierarchy.rootObjects', rootObjects);
        
        // Update layer order
        const layerOrder = this.stateManager.get('hierarchy.layerOrder', []);
        const updatedLayerOrder = layerOrder.filter(objId => objId !== id);
        this.stateManager.set('hierarchy.layerOrder', updatedLayerOrder);
        
        console.log('OBJECTS: Removed', id, 'from hierarchy state');
    }
    
    /**
     * Clean up unused objects and materials
     */
    cleanup() {
        // Process disposal queue
        this.disposalQueue.forEach(object => {
            if (object.material) {
                this.materialManager.releaseMaterial(object.material);
            }
            if (object.geometry) {
                object.geometry.dispose();
            }
        });
        
        this.disposalQueue.clear();
        
        // Clean up unused materials
        this.materialManager.disposeUnusedMaterials();
        
        console.log('OBJECTS: Cleanup completed');
    }
    
    /**
     * Dispose all objects and clean up
     */
    dispose() {
        console.log('OBJECTS: Disposing ObjectManager with', this.objects.size, 'objects');
        
        // Remove all objects
        const allObjects = Array.from(this.objects.values());
        allObjects.forEach(object => this.removeObject(object));
        
        // Clean up registries
        this.objects.clear();
        this.objectsByType.clear();
        this.containers.clear();
        this.templates.clear();
        this.disposalQueue.clear();
        
        // Final cleanup
        this.cleanup();
    }
}

// Export for module use
window.ObjectManager = ObjectManager;