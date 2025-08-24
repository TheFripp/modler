/**
 * Push/Pull Tool - Handles face extrusion operations
 */
class PushPullTool extends Tool {
    constructor(sceneManager, eventManager, selectionManager, geometryManager, highlightManager = null, snapManager = null, materialManager = null, stateManager = null, objectManager = null, configManager = null) {
        super('push', sceneManager, eventManager);
        this.selectionManager = selectionManager;
        this.geometryManager = geometryManager;
        this.highlightManager = highlightManager;
        this.snapManager = snapManager;
        this.materialManager = materialManager;
        this.stateManager = stateManager;
        this.objectManager = objectManager;
        this.configManager = configManager;
        this.cursor = 'grab';
        
        // Tool state
        this.isPushing = false;
        this.pushData = null;
        this.targetFace = null;
    }

    activate() {
        super.activate();
        
        // Notify managers about tool activation
        if (this.highlightManager) {
            this.highlightManager.onToolActivated('pushpull');
        }
        if (this.snapManager) {
            this.snapManager.onToolActivated('pushpull');
        }
        
        this.updateStatus('Push/Pull Tool - Click on face to extrude');
    }

    deactivate() {
        super.deactivate();
        this.endPushPull();
        
        // Clear face hover highlights when deactivating
        if (this.highlightManager) {
            this.highlightManager.clearFaceHoverHighlights();
        }
    }

    cleanup() {
        super.cleanup();
        this.endPushPull();
    }

    onMouseDown(event, intersectionData) {
        if (!this.isActive || this.isPushing) return false;
        
        // Check if we can start push/pull operation
        if (intersectionData && intersectionData.object.userData.selectable) {
            let targetObject = intersectionData.object;
            
            // If clicking on container proxy, select the actual container
            if (intersectionData.object.userData.isContainerProxy) {
                targetObject = intersectionData.object.userData.parentContainer;
                console.log('PUSHPULL: Clicked on container proxy, selecting container:', targetObject.userData.id);
                // Can't push/pull containers, just select them
                this.selectionManager.selectOnly(targetObject);
                return false; // Allow camera interaction
            }
            
            if (this.geometryManager.canPushPullFace(targetObject, intersectionData.face)) {
                this.startPushPull(event, intersectionData);
                return true; // Prevent camera interaction during push/pull
            } else {
                // Just select the object if we can't push/pull it
                this.selectionManager.selectOnly(targetObject);
                return false; // Allow camera interaction
            }
        } else {
            // Don't clear selection on empty clicks - preserve selection for camera orbiting
            return false; // Allow camera interaction
        }
    }

    onMouseUp(event, intersectionData, isDragging, wasInteracting) {
        if (!this.isActive) return false;
        
        if (this.isPushing) {
            this.endPushPull();
            return false; // Allow camera interaction after push/pull ends
        } else {
            // Only deselect on empty space clicks if it's a genuine click (not camera drag)
            // Camera dragging sets isDragging = true, so we avoid deselecting during camera movement
            if (!intersectionData && !isDragging && !wasInteracting) {
                this.selectionManager.clearSelection();
            }
        }
        return false; // Allow camera interaction
    }

    onMouseMove(event, intersectionData) {
        if (!this.isActive) return false;
        
        if (this.isPushing) {
            this.updatePushPull(event);
            return true; // Prevent camera interaction while pushing
        } else {
            this.updateHoverFeedback(intersectionData);
            
            // Use centralized face hover highlighting
            if (this.highlightManager) {
                this.highlightManager.clearFaceHoverHighlights();
                
                // Show face highlight if hovering over a pushable face
                if (intersectionData && intersectionData.face && 
                    this.geometryManager.canPushPullFace(intersectionData.object, intersectionData.face)) {
                    this.highlightManager.addFaceHoverHighlight(intersectionData);
                }
            } else {
                // Fallback to legacy system
                this.selectionManager.updateHover(intersectionData);
            }
            
            return false; // Allow camera interaction when not pushing
        }
    }

    onKeyDown(event) {
        if (!this.isActive) return;
        
        switch (event.key.toLowerCase()) {
            case 'escape':
                event.preventDefault();
                if (this.isPushing) {
                    this.cancelPushPull();
                }
                break;
        }
    }

    startPushPull(event, intersectionData) {
        const object = intersectionData.object;
        const face = intersectionData.face;
        
        // Select the face for push/pull
        this.selectionManager.selectFace(intersectionData);
        
        console.log('Starting interactive push/pull');
        this.isPushing = true;
        this.isOperating = true;
        
        // Update cursor for push/pull operation
        this.cursor = 'grabbing';
        this.updateCursor();
        
        // Store initial mouse position for screen-space calculation
        const rect = this.eventManager.canvas.getBoundingClientRect();
        const startMouseX = event.clientX - rect.left;
        const startMouseY = event.clientY - rect.top;
        
        // Convert plane to box if needed
        if (object.geometry instanceof THREE.PlaneGeometry) {
            this.geometryManager.convertPlaneToBox(object);
        }
        
        // Calculate world normal for the selected face
        const worldNormal = face.normal.clone().transformDirection(object.matrixWorld).normalize();
        
        // Store push/pull data
        this.pushData = {
            object: object,
            face: face,
            worldNormal: worldNormal,
            startMouseX: startMouseX,
            startMouseY: startMouseY,
            initialDimensions: {
                width: object.userData.width || 1,
                height: object.userData.height || 1,
                depth: object.userData.depth || 1
            },
            initialPosition: object.position.clone(),
            screenDirection: this.calculateScreenDirection(face, object)
        };
        
        console.log('Face selected for push/pull:', {
            normal: face.normal,
            worldNormal: worldNormal,
            screenDirection: this.pushData.screenDirection
        });
        
        this.updateStatus('Push/Pull - Drag to extrude (ESC to cancel)');
        console.log('Push/pull started with screen direction:', this.pushData.screenDirection);
    }

    updatePushPull(event) {
        if (!this.pushData) return;
        
        const rect = this.eventManager.canvas.getBoundingClientRect();
        const currentMouseX = event.clientX - rect.left;
        const currentMouseY = event.clientY - rect.top;
        
        const startMouseX = this.pushData.startMouseX;
        const startMouseY = this.pushData.startMouseY;
        
        // Calculate mouse movement
        const deltaX = currentMouseX - startMouseX;
        const deltaY = currentMouseY - startMouseY; // Note: Y increases downward in screen space
        
        // PROPER SOLUTION: Convert screen movement to world movement relative to camera
        const worldNormal = this.pushData.worldNormal;
        
        // Get camera vectors - make sure app is available
        const app = window.modlerApp;
        if (!app || !app.sceneManager || !app.sceneManager.camera) {
            console.error('Missing camera reference');
            return;
        }
        
        const camera = app.sceneManager.camera;
        const cameraRight = new THREE.Vector3();
        const cameraUp = new THREE.Vector3();
        
        // Get camera right and up vectors from world matrix
        cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        cameraUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
        
        // Convert screen movement to world movement
        const worldMovement = new THREE.Vector3();
        worldMovement.addScaledVector(cameraRight, deltaX * 0.01);
        worldMovement.addScaledVector(cameraUp, -deltaY * 0.01); // Invert Y (screen Y is inverted)
        
        // Project world movement onto face normal to get extrusion amount
        let mouseDelta = worldMovement.dot(worldNormal);
        
        // Debug only if there's an issue
        if (Math.abs(mouseDelta) < 0.001) {
            console.log('PushPull: Very small mouseDelta, perpendicular movement detected');
        }
        
        // Snap functionality temporarily disabled to fix stuttering
        // TODO: Optimize snapping calculations for better performance
        
        // Apply the extrusion
        this.applyExtrusion(mouseDelta);
    }

    applyExtrusion(mouseDelta) {
        const object = this.pushData.object;
        const initialDims = this.pushData.initialDimensions;
        const initialPos = this.pushData.initialPosition;
        const worldNormal = this.pushData.worldNormal;
        
        // Calculate new dimensions and position based on face normal
        let newWidth = initialDims.width;
        let newHeight = initialDims.height;
        let newDepth = initialDims.depth;
        let newPosition = initialPos.clone();
        
        // Determine which axis to modify based on the world normal of the selected face
        // The mouseDelta already includes the correct direction from the dot product
        if (Math.abs(worldNormal.y) > 0.7) {
            // Top or bottom face - change height
            newHeight = Math.max(0.01, initialDims.height + mouseDelta);
            // Adjust position so the clicked face moves with mouse
            const heightChange = newHeight - initialDims.height;
            newPosition.y = initialPos.y + heightChange * Math.sign(worldNormal.y) * 0.5;
        } else if (Math.abs(worldNormal.x) > 0.7) {
            // Left or right face - change width  
            newWidth = Math.max(0.01, initialDims.width + mouseDelta);
            // Adjust position so the clicked face moves with mouse
            const widthChange = newWidth - initialDims.width;
            newPosition.x = initialPos.x + widthChange * Math.sign(worldNormal.x) * 0.5;
        } else if (Math.abs(worldNormal.z) > 0.7) {
            // Front or back face - change depth
            newDepth = Math.max(0.01, initialDims.depth + mouseDelta);
            // Adjust position so the clicked face moves with mouse
            const depthChange = newDepth - initialDims.depth;
            newPosition.z = initialPos.z + depthChange * Math.sign(worldNormal.z) * 0.5;
        }
        
        // Update geometry and position
        const newGeometry = new THREE.BoxGeometry(newWidth, newHeight, newDepth);
        object.geometry.dispose();
        object.geometry = newGeometry;
        
        object.position.copy(newPosition);
        
        // Update user data
        object.userData.width = newWidth;
        object.userData.height = newHeight;
        object.userData.depth = newDepth;
        
        // Change type from rectangle to box if this was a flat shape that's now 3D
        if (object.userData.type === 'rectangle' && newDepth > 0.1) {
            object.userData.type = 'box';
            console.log('PushPull: Changed object type from rectangle to box');
        }
        
        // Clear old face highlights that are now in wrong positions
        // Clear highlights using centralized system
        if (this.highlightManager) {
            this.highlightManager.clearSelectedFaceHighlight(object);
            this.highlightManager.clearFaceHover({ object });
            this.highlightManager.clearTemporaryHighlights();
        } else if (this.selectionManager.highlightSystem) {
            // Fallback for legacy system
            this.selectionManager.highlightSystem.clearSelectedFaceHighlight(object);
            this.selectionManager.highlightSystem.clearFaceHover({ object });
            this.selectionManager.highlightSystem.clearTempHighlights();
        }
        
        // Update edge highlighting with new geometry
        // Update highlights using centralized system
        if (this.highlightManager) {
            this.highlightManager.addSelectionHighlight(object);
        } else if (this.selectionManager.highlightSystem) {
            // Fallback for legacy system
            this.selectionManager.highlightSystem.updateObjectEdgeHighlight(object);
        }
    }

    endPushPull() {
        if (!this.isPushing) return;
        
        this.isPushing = false;
        this.isOperating = false;
        this.cursor = 'grab';
        this.updateCursor();
        
        // Clean up all face highlights that might be left behind using centralized system
        if (this.highlightManager) {
            this.highlightManager.clearTemporaryHighlights();
        } else if (this.selectionManager.highlightSystem) {
            // Fallback for legacy system
            this.selectionManager.highlightSystem.clearTempHighlights();
        }
        this.selectionManager.clearFaceSelection(); // Clear selected face
        
        // Clean up push data and notify hierarchy of object change
        if (this.pushData) {
            const object = this.pushData.object;
            console.log('Push/pull completed');
            this.pushData = null;
            
            // Notify scene manager that object changed (for hierarchy update)
            this.sceneManager.notifyObjectChanged(object);
        }
        
        // Reset interaction flag and re-enable controls
        this.eventManager.setWasInteracting(false);
        const app = window.modlerApp;
        if (app && app.rendererManager) {
            app.rendererManager.enableControlsAgain();
        }
        
        this.updateStatus('Push/Pull Tool - Click on face to extrude');
    }

    cancelPushPull() {
        if (!this.isPushing || !this.pushData) return;
        
        // Restore original state
        const object = this.pushData.object;
        const initialDims = this.pushData.initialDimensions;
        const initialPos = this.pushData.initialPosition;
        
        // Restore geometry
        const originalGeometry = new THREE.BoxGeometry(
            initialDims.width, 
            initialDims.height, 
            initialDims.depth
        );
        object.geometry.dispose();
        object.geometry = originalGeometry;
        
        // Restore position
        object.position.copy(initialPos);
        
        // Restore user data
        object.userData.width = initialDims.width;
        object.userData.height = initialDims.height;
        object.userData.depth = initialDims.depth;
        
        // Clear all face highlights and update edge highlighting
        // Clear highlights using centralized system
        if (this.highlightManager) {
            this.highlightManager.clearSelectedFaceHighlight(object);
            this.highlightManager.clearFaceHover({ object });
            this.highlightManager.clearTemporaryHighlights();
        } else if (this.selectionManager.highlightSystem) {
            // Fallback for legacy system
            this.selectionManager.highlightSystem.clearSelectedFaceHighlight(object);
            this.selectionManager.highlightSystem.clearFaceHover({ object });
            this.selectionManager.highlightSystem.clearTempHighlights();
        }
        // Update highlights using centralized system
        if (this.highlightManager) {
            this.highlightManager.addSelectionHighlight(object);
        } else if (this.selectionManager.highlightSystem) {
            // Fallback for legacy system
            this.selectionManager.highlightSystem.updateObjectEdgeHighlight(object);
        }
        
        this.endPushPull();
        console.log('Push/pull canceled');
    }

    calculateScreenDirection(face, object) {
        // Determine how mouse movement should affect the extrusion
        // This is a simplified version - could be improved with proper camera projection
        const worldNormal = face.normal.clone().transformDirection(object.matrixWorld);
        
        // For now, use a simple mapping
        if (Math.abs(worldNormal.y) > 0.7) {
            return { type: 'vertical', sign: worldNormal.y > 0 ? 1 : -1 };
        } else if (Math.abs(worldNormal.x) > Math.abs(worldNormal.z)) {
            return { type: 'horizontal', sign: worldNormal.x > 0 ? 1 : -1 };
        } else {
            return { type: 'vertical', sign: worldNormal.z > 0 ? 1 : -1 };
        }
    }

    updateHoverFeedback(intersectionData) {
        if (intersectionData && intersectionData.object.userData.selectable) {
            if (this.geometryManager.canPushPullFace(intersectionData.object, intersectionData.face)) {
                this.cursor = 'grab';
                this.updateStatus('Push/Pull Tool - Click to start extrusion');
            } else {
                this.cursor = 'pointer';
                this.updateStatus('Push/Pull Tool - Object not extrudable');
            }
        } else {
            this.cursor = 'default';
            this.updateStatus('Push/Pull Tool - Click on face to extrude');
        }
        this.updateCursor();
    }

    getStatusText() {
        if (this.isPushing) {
            return 'Push/Pull Tool - Extruding... (ESC to cancel)';
        }
        return 'Push/Pull Tool - Click on face to extrude';
    }
    
    findSnapDistance(currentDelta) {
        if (!this.pushData) return null;
        
        const object = this.pushData.object;
        const worldNormal = this.pushData.worldNormal;
        const initialPos = this.pushData.initialPosition;
        
        // Find all other objects to snap to
        const otherObjects = [];
        this.sceneManager.scene.traverse(child => {
            if (child.userData && child.userData.selectable && child !== object) {
                otherObjects.push(child);
            }
        });
        
        if (otherObjects.length === 0) return null;
        
        // Calculate where the face would be after extrusion
        let newFacePosition = initialPos.clone();
        
        // Adjust position based on face normal (simplified - assumes face at object center)
        newFacePosition.addScaledVector(worldNormal, currentDelta);
        
        let bestSnapDistance = null;
        let smallestError = Infinity;
        const snapThreshold = 0.5; // 0.5 units snap threshold
        
        // Check each other object for alignment opportunities
        otherObjects.forEach(targetObject => {
            const snapDistances = this.getObjectSnapDistances(targetObject, newFacePosition, worldNormal);
            
            snapDistances.forEach(snapDistance => {
                const error = Math.abs(currentDelta - snapDistance);
                if (error < snapThreshold && error < smallestError) {
                    smallestError = error;
                    bestSnapDistance = snapDistance;
                }
            });
        });
        
        return bestSnapDistance;
    }
    
    getObjectSnapDistances(targetObject, facePosition, worldNormal) {
        // Get bounding box of target object
        const bounds = new THREE.Box3().setFromObject(targetObject);
        const snapDistances = [];
        
        // Calculate distances to corners, edges, and faces
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
        
        // Calculate snap distances to align with each corner
        corners.forEach(corner => {
            const cornerToFace = corner.clone().sub(facePosition);
            const distanceAlongNormal = cornerToFace.dot(worldNormal);
            snapDistances.push(distanceAlongNormal);
        });
        
        // Face centers for face-to-face snapping
        const faceCenters = [
            new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.min.y, (bounds.min.z + bounds.max.z) / 2), // Bottom
            new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.max.y, (bounds.min.z + bounds.max.z) / 2), // Top
            new THREE.Vector3(bounds.min.x, (bounds.min.y + bounds.max.y) / 2, (bounds.min.z + bounds.max.z) / 2), // Left
            new THREE.Vector3(bounds.max.x, (bounds.min.y + bounds.max.y) / 2, (bounds.min.z + bounds.max.z) / 2), // Right
            new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, bounds.min.z), // Front
            new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, bounds.max.z)  // Back
        ];
        
        faceCenters.forEach(faceCenter => {
            const faceToFace = faceCenter.clone().sub(facePosition);
            const distanceAlongNormal = faceToFace.dot(worldNormal);
            snapDistances.push(distanceAlongNormal);
        });
        
        return snapDistances;
    }
}

// Export for module use
window.PushPullTool = PushPullTool;