/**
 * ContainerInteractionHandler - Specialized handler for container interactions
 * 
 * Centralizes container-specific interaction logic that was scattered across tools,
 * providing consistent face detection, coordinate transformation, and highlighting
 * for all container operations.
 */
class ContainerInteractionHandler {
    constructor(highlightManager = null) {
        this.highlightManager = highlightManager;
        this.faceDetection = new FaceDetectionSystem();
    }

    /**
     * Determines which face of a container corresponds to an intersection point
     * Uses centralized face detection system for consistency
     */
    getContainerFaceFromIntersection(container, intersectionData) {
        if (!container.isContainer || !intersectionData.point) {
            return null;
        }

        // Use unified face detection system
        const faceData = this.faceDetection.detectFace(container, intersectionData.point, intersectionData);
        
        if (!faceData) {
            return null;
        }

        // Return in format expected by existing code
        return {
            face: { normal: faceData.worldNormal },
            faceIndex: faceData.faceIndex,
            faceName: faceData.faceName,
            localPoint: faceData.localPoint,
            worldNormal: faceData.worldNormal
        };
    }

    /**
     * Get face index for consistency with Three.js geometry
     */
    getFaceIndexForNormal(normal) {
        return this.faceDetection.getFaceIndex(this.faceDetection.getFaceName(normal));
    }

    /**
     * Get the dominant axis for a normal vector
     */
    getNormalAxis(normal) {
        return this.faceDetection.getAxisFromNormal(normal);
    }

    /**
     * Show appropriate face highlights for containers
     * Uses centralized highlight manager for consistency
     */
    showContainerFaceHighlight(container, intersectionData) {
        if (!this.highlightManager || !container.isContainer) {
            return;
        }

        const containerFace = this.getContainerFaceFromIntersection(container, intersectionData);
        if (!containerFace) {
            return;
        }

        // Create intersection data for highlight manager
        const containerIntersectionData = {
            object: container,
            face: containerFace.face,
            faceIndex: containerFace.faceIndex,
            point: intersectionData.point,
            worldNormal: containerFace.worldNormal
        };

        this.highlightManager.addFaceHoverHighlight(containerIntersectionData);
    }

    /**
     * Calculate container bounds in world coordinates
     * Fixes the coordinate system inconsistency
     */
    getContainerWorldBounds(container) {
        if (!container.isContainer) {
            return null;
        }

        // Get world transform
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        container.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

        // Calculate world-space dimensions
        const worldWidth = container.userData.width * worldScale.x;
        const worldHeight = container.userData.height * worldScale.y;
        const worldDepth = container.userData.depth * worldScale.z;

        // Create bounding box in world coordinates
        const bounds = new THREE.Box3().setFromCenterAndSize(
            worldPosition,
            new THREE.Vector3(worldWidth, worldHeight, worldDepth)
        );

        return bounds;
    }

    /**
     * Check if a point is within container bounds with tolerance
     */
    isPointInContainer(container, worldPoint, tolerance = 0.1) {
        const bounds = this.getContainerWorldBounds(container);
        if (!bounds) return false;

        bounds.expandByScalar(tolerance);
        return bounds.containsPoint(worldPoint);
    }

    /**
     * Get container corners in world coordinates for snapping
     */
    getContainerSnapPoints(container) {
        const bounds = this.getContainerWorldBounds(container);
        if (!bounds) return [];

        // Return 8 corner points plus face centers
        const corners = [
            new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
            new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
            new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
            new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
            new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
            new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
            new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
            new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z)
        ];

        // Add face centers
        const center = bounds.getCenter(new THREE.Vector3());
        const faceCenters = [
            new THREE.Vector3(center.x, bounds.min.y, center.z), // Bottom
            new THREE.Vector3(center.x, bounds.max.y, center.z), // Top
            new THREE.Vector3(bounds.min.x, center.y, center.z), // Left
            new THREE.Vector3(bounds.max.x, center.y, center.z), // Right
            new THREE.Vector3(center.x, center.y, bounds.min.z), // Front
            new THREE.Vector3(center.x, center.y, bounds.max.z)  // Back
        ];

        return { corners, faceCenters, center };
    }

    /**
     * Validate container hierarchy to prevent infinite nesting
     */
    canAddToContainer(container, object) {
        if (!container.isContainer) return false;
        if (object === container) return false;

        // Check if adding this object would create a circular reference
        let current = container;
        while (current && current.userData.parentContainer) {
            if (current.userData.parentContainer === object) {
                return false; // Would create circular reference
            }
            current = current.userData.parentContainer;
        }

        return true;
    }

    /**
     * Get the outermost container in a hierarchy chain
     */
    getOutermostContainer(object) {
        let current = object;
        while (current && current.userData.parentContainer) {
            current = current.userData.parentContainer;
        }
        return current.isContainer ? current : object;
    }

    /**
     * Get all containers in the hierarchy chain
     */
    getContainerChain(object) {
        const chain = [];
        let current = object;
        
        while (current && current.userData.parentContainer) {
            chain.unshift(current.userData.parentContainer);
            current = current.userData.parentContainer;
        }
        
        return chain;
    }
}

// Export for module use
window.ContainerInteractionHandler = ContainerInteractionHandler;