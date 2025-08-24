/**
 * Container - Organizational object for grouping and managing child objects
 * Containers have no geometry but provide structural organization and transformation control
 */
class Container extends THREE.Object3D {
    constructor(name = 'Container', objectManager = null, materialManager = null, sceneManager = null) {
        super();
        
        this.type = 'Container';
        this.name = name;
        this.isContainer = true;
        
        // Centralized system references
        this.objectManager = objectManager;
        this.materialManager = materialManager;
        this.sceneManager = sceneManager;
        
        // Container properties
        this.userData = {
            id: this.generateId(),
            type: 'container',
            selectable: true,
            visible: true,
            fillMode: {
                x: false,
                y: false,
                z: false
            },
            distributionMode: 'none', // 'none', 'even', 'center'
            alignmentMode: 'none' // 'none', 'left', 'center', 'right', 'top', 'bottom'
        };
        
        // Bounding box for visualization
        this.boundingBox = new THREE.Box3();
        this.boundingBoxHelper = null;
        this.selectableProxy = null;
        
        // Child management
        this.childObjects = new Set();
        
        this.updateBoundingBox();
    }
    
    generateId() {
        if (this.objectManager) {
            return this.objectManager.generateId('container');
        }
        // Fallback for backward compatibility
        return 'container_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Child Management
    addChild(object) {
        if (!object || object === this) {
            console.log('CONTAINER: Cannot add null object or self as child');
            return;
        }
        
        console.log(`CONTAINER: Adding child ${object.userData.id} to container ${this.userData.id}`);
        
        // Remove from current parent if any
        if (object.parent && object.parent !== this) {
            console.log(`CONTAINER: Removing ${object.userData.id} from current parent`);
            if (object.parent.isContainer) {
                object.parent.removeChild(object);
            } else {
                object.parent.remove(object);
            }
        }
        
        // Add as child
        this.add(object);
        this.childObjects.add(object);
        
        // Update object's parent reference
        object.userData.parentContainer = this;
        
        // Update bounding box and apply container properties
        this.updateBoundingBox();
        this.applyContainerProperties();
        
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
        
        console.log(`Removed object ${object.userData.id} from container ${this.userData.id}`);
    }
    
    onChildChanged() {
        console.log(`CONTAINER: Child changed, updating bounding box for ${this.userData.id}`);
        this.updateBoundingBox();
        
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
        if (this.childObjects.size === 0) {
            // Empty container has minimal bounding box at its position
            this.boundingBox.setFromCenterAndSize(
                this.position, 
                new THREE.Vector3(0.1, 0.1, 0.1)
            );
        } else {
            // Calculate combined bounding box of all children
            this.boundingBox.makeEmpty();
            
            this.childObjects.forEach(child => {
                const childBox = new THREE.Box3().setFromObject(child);
                this.boundingBox.union(childBox);
            });
        }
        
        // Update visual bounding box if visible
        this.updateBoundingBoxHelper();
        
        // Update selectable proxy
        this.updateSelectableProxy();
    }
    
    updateBoundingBoxHelper() {
        console.log(`CONTAINER: Updating bounding box helper for ${this.userData.id}, isSelected: ${this.userData.isSelected}`);
        
        if (this.boundingBoxHelper) {
            console.log(`CONTAINER: Removing existing bounding box helper`);
            if (this.boundingBoxHelper.parent) {
                this.boundingBoxHelper.parent.remove(this.boundingBoxHelper);
            }
            // Dispose of geometry and material
            if (this.boundingBoxHelper.geometry) {
                this.boundingBoxHelper.geometry.dispose();
            }
            if (this.boundingBoxHelper.material) {
                this.boundingBoxHelper.material.dispose();
            }
            this.boundingBoxHelper = null;
        }
        
        // Only show bounding box if container is selected
        if (this.userData.isSelected) {
            console.log(`CONTAINER: Creating bounding box helper for selected container`);
            this.createBoundingBoxHelper();
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
        this.boundingBoxHelper.position.copy(center);
        this.boundingBoxHelper.userData.isHelper = true;
        this.boundingBoxHelper.userData.isContainerBounds = true;
        this.boundingBoxHelper.renderOrder = 999; // Render on top
        
        // Add to scene using centralized scene manager
        if (this.sceneManager) {
            this.sceneManager.scene.add(this.boundingBoxHelper);
        } else if (window.modlerApp && window.modlerApp.sceneManager) {
            // Fallback for backward compatibility
            window.modlerApp.sceneManager.scene.add(this.boundingBoxHelper);
        }
        
        console.log(`Created bounding box for container ${this.userData.id} around ${this.childObjects.size} objects`);
    }
    
    updateSelectableProxy() {
        // Remove existing proxy
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
        
        if (this.childObjects.size === 0) return;
        
        // Create invisible geometry that matches the bounding box
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        this.boundingBox.getSize(size);
        this.boundingBox.getCenter(center);
        
        const proxyGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const proxyMaterial = this.materialManager ? 
            this.materialManager.getInvisibleMaterial() :
            new THREE.MeshBasicMaterial({ 
                transparent: true, 
                opacity: 0,
                visible: false 
            });
        
        this.selectableProxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
        this.selectableProxy.position.copy(center);
        this.selectableProxy.userData = {
            isContainerProxy: true,
            parentContainer: this,
            selectable: true,
            id: this.userData.id,
            type: 'container-proxy',
            width: size.x,
            height: size.y,
            depth: size.z
        };
        
        // Add to scene using centralized scene manager
        if (this.sceneManager) {
            this.sceneManager.scene.add(this.selectableProxy);
        } else if (window.modlerApp && window.modlerApp.sceneManager) {
            // Fallback for backward compatibility
            window.modlerApp.sceneManager.scene.add(this.selectableProxy);
        }
        
        console.log(`Created selectable proxy for container ${this.userData.id}`);
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
    }
    
    applyAlignment() {
        if (this.userData.alignmentMode === 'none') return;
        
        const containerCenter = new THREE.Vector3();
        this.boundingBox.getCenter(containerCenter);
        
        this.childObjects.forEach(child => {
            switch (this.userData.alignmentMode) {
                case 'center':
                    child.position.x = containerCenter.x;
                    child.position.z = containerCenter.z;
                    break;
                case 'left':
                    child.position.x = this.boundingBox.min.x;
                    break;
                case 'right':
                    child.position.x = this.boundingBox.max.x;
                    break;
                case 'top':
                    child.position.y = this.boundingBox.max.y;
                    break;
                case 'bottom':
                    child.position.y = this.boundingBox.min.y;
                    break;
            }
        });
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
        this.applyContainerProperties();
    }
    
    setAlignmentMode(mode) {
        this.userData.alignmentMode = mode;
        this.applyContainerProperties();
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
}

// Export for module use
window.Container = Container;