/**
 * Geometry Manager - Handles creation and management of 3D objects
 */
class GeometryManager {
    constructor(sceneManager, materialManager = null) {
        this.sceneManager = sceneManager;
        this.materialManager = materialManager;
        this.objects = new Map(); // id -> object
        this.nextObjectId = 1;
        
        // Legacy fallback materials (when MaterialManager not available)
        this.standardMaterial = null; // Will be created on demand
        this.materials = new Map();
    }

    // Object Creation
    createRectangle(width, height, position, targetFace = null, userData = {}) {
        // Clamp dimensions to reasonable values
        width = Math.min(Math.max(width, 0.01), 100);
        height = Math.min(Math.max(height, 0.01), 100);
        
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = this.getStandardMaterial();
        
        const rectangle = new THREE.Mesh(geometry, material);
        
        // Set position and orientation
        if (targetFace) {
            // Position on face
            rectangle.position.copy(position);
            rectangle.lookAt(position.clone().add(targetFace.normal));
            
            // Offset slightly from face to avoid z-fighting
            const offset = targetFace.normal.clone().multiplyScalar(0.001);
            rectangle.position.add(offset);
        } else {
            // Position on ground
            rectangle.position.set(position.x, 0.01, position.z);
            rectangle.rotation.x = -Math.PI / 2; // Lay flat
        }
        
        // Set up user data
        const finalUserData = {
            type: 'rectangle',
            width: width,
            height: height,
            selectable: true,
            id: this.nextObjectId++,
            createdOnFace: !!targetFace,
            ...userData
        };
        
        if (targetFace) {
            finalUserData.faceNormal = targetFace.normal.clone();
        }
        
        rectangle.userData = finalUserData;
        
        // Add to scene and tracking
        this.sceneManager.addObject(rectangle);
        this.objects.set(rectangle.userData.id, rectangle);
        
        console.log('Created rectangle:', width, 'x', height, targetFace ? 'on face' : 'on ground');
        return rectangle;
    }

    createCircle(radius, position, userData = {}) {
        // Clamp radius to reasonable values
        radius = Math.min(Math.max(radius, 0.01), 50);
        
        const geometry = new THREE.CircleGeometry(radius, 32);
        const material = this.getStandardMaterial();
        
        const circle = new THREE.Mesh(geometry, material);
        circle.position.copy(position);
        circle.rotation.x = -Math.PI / 2; // Lay flat on ground
        
        // Set up user data
        circle.userData = {
            type: 'circle',
            radius: radius,
            selectable: true,
            id: this.nextObjectId++,
            ...userData
        };
        
        // Add to scene and tracking
        this.sceneManager.addObject(circle);
        this.objects.set(circle.userData.id, circle);
        
        console.log('Created circle with radius:', radius);
        return circle;
    }

    createBox(width, height, depth, position, userData = {}) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = this.getStandardMaterial();
        
        const box = new THREE.Mesh(geometry, material);
        box.position.copy(position);
        
        // Set up user data
        box.userData = {
            type: 'box',
            width: width,
            height: height,
            depth: depth,
            selectable: true,
            id: this.nextObjectId++,
            ...userData
        };
        
        // Add to scene and tracking
        this.sceneManager.addObject(box);
        this.objects.set(box.userData.id, box);
        
        console.log('Created box:', width, 'x', height, 'x', depth);
        return box;
    }

    // Object Transformation
    convertPlaneToBox(object, initialDepth = 0.5) {
        if (!(object.geometry instanceof THREE.PlaneGeometry)) {
            console.warn('Cannot convert non-plane geometry to box');
            return object;
        }
        
        const userData = object.userData;
        let width = userData.width || 2;
        let height = userData.height || 2;
        
        // Clamp dimensions
        width = Math.min(Math.max(width, 0.01), 100);
        height = Math.min(Math.max(height, 0.01), 100);
        
        console.log('=== PLANE TO BOX CONVERSION ===');
        console.log('Original userData:', userData);
        console.log('Input dimensions - width:', width, 'height:', height, 'initialDepth:', initialDepth);
        console.log('Created on face:', userData.createdOnFace);
        console.log('Original position:', object.position);
        console.log('Original rotation:', object.rotation);
        
        let newGeometry;
        if (userData.createdOnFace) {
            // Rectangle created on a face - maintain orientation
            newGeometry = new THREE.BoxGeometry(width, height, initialDepth);
            userData.depth = initialDepth;
        } else {
            // Rectangle created on ground - preserve its current position
            const originalY = object.position.y;
            newGeometry = new THREE.BoxGeometry(width, initialDepth, height);
            userData.width = width; // X dimension stays the same
            userData.height = initialDepth; // Y dimension (extrusion up)
            userData.depth = height; // Z dimension stays the same
            
            // Reset rotation but preserve position, just adjust for geometry center
            object.rotation.set(0, 0, 0);
            object.position.y = originalY + initialDepth / 2;
        }
        
        // Replace geometry
        object.geometry.dispose();
        object.geometry = newGeometry;
        
        // Update user data
        userData.type = 'extruded-rectangle';
        userData.selectable = true;
        
        // Remove the createdOnFace flag since it's now a proper 3D object
        if (userData.createdOnFace) {
            delete userData.createdOnFace;
        }
        
        console.log('=== CONVERSION COMPLETE ===');
        console.log('New geometry dimensions:', newGeometry.parameters);
        console.log('Final userData:', userData);
        console.log('Final position:', object.position);
        console.log('Final rotation:', object.rotation);
        console.log('Selectable:', userData.selectable);
        console.log('================================');
        return object;
    }

    extrudeObject(object, direction, distance) {
        const userData = object.userData;
        
        if (object.geometry instanceof THREE.BoxGeometry) {
            // Get current dimensions
            let width = userData.width || 1;
            let height = userData.height || 1;
            let depth = userData.depth || 1;
            
            // Determine which dimension to modify based on direction
            if (Math.abs(direction.y) > 0.9) {
                // Top/bottom face - modify height
                height = Math.max(0.01, height + distance);
                userData.height = height;
                
                // Adjust position if extruding from bottom
                if (direction.y < 0) {
                    object.position.y += distance / 2;
                } else {
                    object.position.y += distance / 2;
                }
            } else if (Math.abs(direction.x) > 0.9) {
                // Left/right face - modify width
                width = Math.max(0.01, width + distance);
                userData.width = width;
                object.position.x += distance / 2 * Math.sign(direction.x);
            } else if (Math.abs(direction.z) > 0.9) {
                // Front/back face - modify depth
                depth = Math.max(0.01, depth + distance);
                userData.depth = depth;
                object.position.z += distance / 2 * Math.sign(direction.z);
            }
            
            // Create new geometry
            const newGeometry = new THREE.BoxGeometry(width, height, depth);
            object.geometry.dispose();
            object.geometry = newGeometry;
            
            console.log('Extruded object - new dimensions:', width, 'x', height, 'x', depth);
        } else {
            console.warn('Cannot extrude non-box geometry');
        }
        
        return object;
    }

    // Object Management
    getObject(id) {
        return this.objects.get(id);
    }

    getAllObjects() {
        return Array.from(this.objects.values());
    }

    removeObject(object) {
        if (!object || !object.userData || !object.userData.id) return;
        
        const id = object.userData.id;
        
        // Remove from tracking
        this.objects.delete(id);
        
        // Remove from scene
        this.sceneManager.scene.remove(object);
        
        // Dispose of resources
        if (object.geometry) object.geometry.dispose();
        if (object.material && object.material !== this.standardMaterial) {
            if (Array.isArray(object.material)) {
                object.material.forEach(mat => mat.dispose());
            } else {
                object.material.dispose();
            }
        }
        
        console.log('Removed object:', id);
    }

    // Face Detection
    canPushPullFace(object, face) {
        if (!face) return false;
        
        // Allow push/pull on box, plane, cylinder, and circle geometries
        return object.geometry instanceof THREE.BoxGeometry || 
               object.geometry instanceof THREE.PlaneGeometry ||
               object.geometry instanceof THREE.CylinderGeometry ||
               object.geometry instanceof THREE.CircleGeometry;
    }

    // Utility Methods
    getStandardMaterial() {
        if (this.materialManager) {
            // Use centralized MaterialManager
            return this.materialManager.getObjectMaterial();
        } else {
            // Fallback to legacy material
            if (!this.standardMaterial) {
                this.standardMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
            }
            return this.standardMaterial;
        }
    }

    createMaterial(color = 0xaaaaaa, options = {}) {
        if (this.materialManager) {
            // Use centralized MaterialManager
            return this.materialManager.getObjectMaterial(color, options);
        } else {
            // Fallback to legacy caching
            const materialKey = `${color}_${JSON.stringify(options)}`;
            
            if (!this.materials.has(materialKey)) {
                const material = new THREE.MeshLambertMaterial({
                    color: color,
                    ...options
                });
                this.materials.set(materialKey, material);
            }
            
            return this.materials.get(materialKey);
        }
    }

    // Debug and Cleanup
    cleanupLargeObjects() {
        const toRemove = [];
        
        this.objects.forEach(object => {
            if (object.geometry && object.geometry.parameters) {
                const params = object.geometry.parameters;
                const maxDim = Math.max(
                    params.width || 0, 
                    params.height || 0, 
                    params.depth || 0, 
                    params.radius || 0
                );
                
                if (maxDim > 30) {
                    console.warn('Found problematic large object:', {
                        id: object.userData.id,
                        type: object.userData.type,
                        maxDimension: maxDim,
                        parameters: params
                    });
                    toRemove.push(object);
                }
            }
        });
        
        toRemove.forEach(object => {
            this.removeObject(object);
        });
        
        console.log(`Cleaned up ${toRemove.length} problematic large objects`);
        return toRemove.length;
    }

    debugObjects() {
        console.log('=== GEOMETRY MANAGER DEBUG ===');
        console.log('Total objects:', this.objects.size);
        
        this.objects.forEach((object, id) => {
            const userData = object.userData;
            console.log(`Object ${id}:`, {
                type: userData.type,
                dimensions: {
                    width: userData.width,
                    height: userData.height,
                    depth: userData.depth,
                    radius: userData.radius
                },
                position: object.position,
                geometry: object.geometry.type,
                selectable: userData.selectable
            });
        });
    }

    dispose() {
        // Remove all objects
        this.objects.forEach((object, id) => {
            this.removeObject(object);
        });
        this.objects.clear();
        
        // Dispose of materials
        this.materials.forEach(material => material.dispose());
        this.materials.clear();
        
        if (this.standardMaterial) {
            this.standardMaterial.dispose();
        }
    }
}

// Export for module use
window.GeometryManager = GeometryManager;