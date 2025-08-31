/**
 * FaceDetectionSystem - Unified face detection for all object types
 * 
 * Centralizes face detection logic that was scattered across tools and containers,
 * providing consistent coordinate transformations and face identification for
 * highlighting, interaction, and tool operations.
 */
class FaceDetectionSystem {
    constructor() {
        // Face normal vectors for standard box geometry
        this.faceNormals = {
            right: new THREE.Vector3(1, 0, 0),
            left: new THREE.Vector3(-1, 0, 0),
            top: new THREE.Vector3(0, 1, 0),
            bottom: new THREE.Vector3(0, -1, 0),
            front: new THREE.Vector3(0, 0, 1),
            back: new THREE.Vector3(0, 0, -1)
        };

        // Face indices for consistency with Three.js geometry
        this.faceIndices = {
            right: 0,
            left: 1,
            top: 2,
            bottom: 3,
            front: 4,
            back: 5
        };
    }

    /**
     * Detect which face of an object (container or regular) is closest to a point
     */
    detectFace(object, worldPoint, intersectionData = null) {
        if (!object || !worldPoint) {
            return null;
        }

        // Handle containers specially
        if (object.isContainer) {
            return this.detectContainerFace(object, worldPoint, intersectionData);
        }

        // Handle regular objects
        return this.detectObjectFace(object, worldPoint, intersectionData);
    }

    /**
     * Detect face for container objects using their userData dimensions
     */
    detectContainerFace(container, worldPoint, intersectionData = null) {
        const width = container.userData.width || 4;
        const height = container.userData.height || 1;
        const depth = container.userData.depth || 4;

        // Get container's world transform
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        container.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

        // Convert point to container local space
        const localPoint = worldPoint.clone();
        localPoint.sub(worldPosition);
        localPoint.applyQuaternion(worldQuaternion.clone().invert());
        localPoint.divide(worldScale);

        // Normalize by container dimensions
        const normalizedX = localPoint.x / (width / 2);
        const normalizedY = localPoint.y / (height / 2);
        const normalizedZ = localPoint.z / (depth / 2);

        // Find the face with the maximum normalized coordinate
        const absX = Math.abs(normalizedX);
        const absY = Math.abs(normalizedY);
        const absZ = Math.abs(normalizedZ);

        let faceName;
        let localNormal;

        if (absX >= absY && absX >= absZ) {
            // X-axis dominant
            faceName = normalizedX > 0 ? 'right' : 'left';
            localNormal = this.faceNormals[faceName].clone();
        } else if (absY >= absX && absY >= absZ) {
            // Y-axis dominant
            faceName = normalizedY > 0 ? 'top' : 'bottom';
            localNormal = this.faceNormals[faceName].clone();
        } else {
            // Z-axis dominant
            faceName = normalizedZ > 0 ? 'front' : 'back';
            localNormal = this.faceNormals[faceName].clone();
        }

        // Transform normal to world space
        const worldNormal = localNormal.clone().transformDirection(container.matrixWorld).normalize();

        return {
            object: container,
            faceName: faceName,
            faceIndex: this.faceIndices[faceName],
            localNormal: localNormal,
            worldNormal: worldNormal,
            localPoint: localPoint,
            worldPoint: worldPoint.clone(),
            axis: this.getAxisFromNormal(worldNormal),
            confidence: Math.max(absX, absY, absZ) // How close to edge/center
        };
    }

    /**
     * Detect face for regular objects using geometry or intersection data
     */
    detectObjectFace(object, worldPoint, intersectionData = null) {
        // If we have intersection data, use it directly
        if (intersectionData && intersectionData.face) {
            const face = intersectionData.face;
            const worldNormal = face.normal.clone().transformDirection(object.matrixWorld).normalize();
            
            return {
                object: object,
                face: face,
                faceIndex: intersectionData.faceIndex || 0,
                localNormal: face.normal.clone(),
                worldNormal: worldNormal,
                worldPoint: worldPoint.clone(),
                axis: this.getAxisFromNormal(worldNormal),
                confidence: 1.0 // Direct intersection is highest confidence
            };
        }

        // Fallback: calculate face based on object bounds
        // MANDATORY ARCHITECTURE PATTERN: Use consistent bounds calculation hierarchy
        let bounds;
        if (object.isContainer && object.getObjectGeometryBounds) {
            bounds = object.getObjectGeometryBounds(object);
        } else if (object.userData && object.userData.width !== undefined) {
            // Use precise userData dimensions with world transform
            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
            
            bounds = new THREE.Box3();
            bounds.setFromCenterAndSize(
                worldPosition,
                new THREE.Vector3(
                    object.userData.width * worldScale.x,
                    object.userData.height * worldScale.y,
                    object.userData.depth * worldScale.z
                )
            );
        } else {
            bounds = new THREE.Box3().setFromObject(object);
        }
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());

        // Convert to object local space for analysis
        const localPoint = object.worldToLocal(worldPoint.clone());
        const localCenter = object.worldToLocal(center.clone());
        
        // Find closest face
        const relativeX = (localPoint.x - localCenter.x) / (size.x / 2);
        const relativeY = (localPoint.y - localCenter.y) / (size.y / 2);
        const relativeZ = (localPoint.z - localCenter.z) / (size.z / 2);

        const absX = Math.abs(relativeX);
        const absY = Math.abs(relativeY);
        const absZ = Math.abs(relativeZ);

        let faceName;
        let localNormal;

        if (absX >= absY && absX >= absZ) {
            faceName = relativeX > 0 ? 'right' : 'left';
            localNormal = this.faceNormals[faceName].clone();
        } else if (absY >= absX && absY >= absZ) {
            faceName = relativeY > 0 ? 'top' : 'bottom';
            localNormal = this.faceNormals[faceName].clone();
        } else {
            faceName = relativeZ > 0 ? 'front' : 'back';
            localNormal = this.faceNormals[faceName].clone();
        }

        const worldNormal = localNormal.clone().transformDirection(object.matrixWorld).normalize();

        return {
            object: object,
            faceName: faceName,
            faceIndex: this.faceIndices[faceName],
            localNormal: localNormal,
            worldNormal: worldNormal,
            localPoint: localPoint,
            worldPoint: worldPoint.clone(),
            axis: this.getAxisFromNormal(worldNormal),
            confidence: Math.max(absX, absY, absZ)
        };
    }

    /**
     * Get the dominant axis from a world normal vector
     */
    getAxisFromNormal(normal) {
        if (Math.abs(normal.x) > Math.abs(normal.y) && Math.abs(normal.x) > Math.abs(normal.z)) {
            return 'x';
        } else if (Math.abs(normal.y) > Math.abs(normal.z)) {
            return 'y';
        } else {
            return 'z';
        }
    }

    /**
     * Get all faces of an object for highlighting or snapping
     */
    getAllFaces(object) {
        const faces = [];
        
        if (object.isContainer) {
            // For containers, calculate faces from dimensions
            const width = object.userData.width || 4;
            const height = object.userData.height || 1;
            const depth = object.userData.depth || 4;

            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

            Object.entries(this.faceNormals).forEach(([faceName, localNormal]) => {
                const worldNormal = localNormal.clone().transformDirection(object.matrixWorld).normalize();
                
                // Calculate face center
                const faceOffset = localNormal.clone();
                faceOffset.multiply(new THREE.Vector3(width/2, height/2, depth/2));
                faceOffset.multiply(worldScale);
                faceOffset.applyQuaternion(worldQuaternion);
                
                const faceCenter = worldPosition.clone().add(faceOffset);

                faces.push({
                    object: object,
                    faceName: faceName,
                    faceIndex: this.faceIndices[faceName],
                    localNormal: localNormal.clone(),
                    worldNormal: worldNormal,
                    center: faceCenter,
                    axis: this.getAxisFromNormal(worldNormal)
                });
            });
        } else {
            // MANDATORY ARCHITECTURE PATTERN: Use consistent bounds calculation hierarchy
            let bounds, center, size;
            if (object.isContainer && object.getObjectGeometryBounds) {
                bounds = object.getObjectGeometryBounds(object);
            } else if (object.userData && object.userData.width !== undefined) {
                // Use precise userData dimensions with world transform
                const worldPosition = new THREE.Vector3();
                const worldQuaternion = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();
                object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
                
                bounds = new THREE.Box3();
                bounds.setFromCenterAndSize(
                    worldPosition,
                    new THREE.Vector3(
                        object.userData.width * worldScale.x,
                        object.userData.height * worldScale.y,
                        object.userData.depth * worldScale.z
                    )
                );
            } else {
                bounds = new THREE.Box3().setFromObject(object);
            }
            
            center = bounds.getCenter(new THREE.Vector3());
            size = bounds.getSize(new THREE.Vector3());

            Object.entries(this.faceNormals).forEach(([faceName, localNormal]) => {
                const worldNormal = localNormal.clone().transformDirection(object.matrixWorld).normalize();
                
                // Calculate face center based on bounds
                const faceOffset = localNormal.clone().multiply(size).multiplyScalar(0.5);
                const faceCenter = center.clone().add(faceOffset);

                faces.push({
                    object: object,
                    faceName: faceName,
                    faceIndex: this.faceIndices[faceName],
                    localNormal: localNormal.clone(),
                    worldNormal: worldNormal,
                    center: faceCenter,
                    axis: this.getAxisFromNormal(worldNormal)
                });
            });
        }

        return faces;
    }

    /**
     * Check if a world point is near a face (for hover detection)
     */
    isPointNearFace(faceData, worldPoint, tolerance = 0.5) {
        const distance = worldPoint.distanceTo(faceData.center);
        return distance <= tolerance;
    }

    /**
     * Get face normal in world coordinates
     */
    getFaceWorldNormal(object, faceName) {
        const localNormal = this.faceNormals[faceName];
        if (!localNormal) return null;
        
        return localNormal.clone().transformDirection(object.matrixWorld).normalize();
    }

    /**
     * Convert face name to Three.js compatible face index
     */
    getFaceIndex(faceName) {
        return this.faceIndices[faceName] || 0;
    }

    /**
     * Convert face index back to face name
     */
    getFaceName(faceIndex) {
        for (const [name, index] of Object.entries(this.faceIndices)) {
            if (index === faceIndex) return name;
        }
        return 'front'; // Default
    }
}

// Export for module use
window.FaceDetectionSystem = FaceDetectionSystem;