class MoveTool extends Tool {
    constructor(sceneManager, eventManager, selectionManager, highlightManager = null, snapManager = null, materialManager = null, stateManager = null, objectManager = null, configManager = null) {
        super('move', sceneManager, eventManager);
        this.selectionManager = selectionManager;
        this.highlightManager = highlightManager;
        this.snapManager = snapManager;
        this.materialManager = materialManager;
        this.stateManager = stateManager;
        this.objectManager = objectManager;
        this.configManager = configManager;
        this.cursor = 'move';
        
        // Move state
        this.isMoving = false;
        this.moveData = null;
        this.lastPropertyUpdate = 0;
        
        // Container interaction handler for centralized container logic
        this.containerHandler = new ContainerInteractionHandler(highlightManager);
        
        // Move tool maintains its own selection preservation logic
        // Uses centralized hierarchical methods but keeps tool-specific behavior
    }

    activate() {
        super.activate();
        
        // Notify managers about tool activation
        if (this.highlightManager) {
            this.highlightManager.onToolActivated('move');
        }
        if (this.snapManager) {
            this.snapManager.onToolActivated('move');
        }
        
        this.updateStatus('Move Tool - Select objects to move them');
    }

    deactivate() {
        super.deactivate();
        this.endMove();
        
        // Reset centralized hierarchical selection state
        this.selectionManager.resetHierarchicalState();
        
        // Clear any hover highlights using centralized system
        if (this.highlightManager) {
            this.highlightManager.clearTemporaryHighlights();
        } else if (this.selectionManager.highlightSystem) {
            // Fallback for legacy system
            if (this.highlightManager) {
                this.highlightManager.clearTemporaryHighlights();
            } else if (this.selectionManager?.highlightSystem?.clearTemporaryHighlights) {
                this.selectionManager.highlightSystem.clearTemporaryHighlights();
            }
        }
        
        // Clear face hover highlights when deactivating
        if (this.highlightManager) {
            this.highlightManager.clearFaceHoverHighlights();
        }
    }

    onMouseDown(event, intersectionData) {
        if (!this.isActive) return false;
        
        // If we clicked on a selectable object, analyze what part was clicked
        if (intersectionData && intersectionData.object.userData.selectable) {
            let clickedObject = intersectionData.object;
            
            // Handle container geometry (not proxy - that's obsolete)
            if (intersectionData.object.userData.isContainerGeometry) {
                clickedObject = intersectionData.object.userData.parentContainer;
            }
            
            // Use centralized double-click detection
            const currentTime = Date.now();
            const isDoubleClick = this.selectionManager.detectDoubleClick(currentTime, clickedObject);
            
            let targetObject = null;
            
            if (isDoubleClick) {
                // Double-click: try to go deeper in hierarchy
                console.log('MOVE: Double-click detected, attempting to go deeper');
                const result = this.selectionManager.handleHierarchicalDoubleClick(event, { object: clickedObject }, this.selectionManager.hierarchicalState.currentDepthMap);
                targetObject = result;
                if (!targetObject) {
                    // If we can't go deeper, keep the current selection
                    const currentSelection = this.selectionManager.getSelectedObjects();
                    targetObject = currentSelection.length > 0 ? currentSelection[0] : null;
                }
            } else {
                // Single click: check if the clicked object (or its container) is already selected
                const outermostContainer = this.selectionManager.getOutermostContainer(clickedObject);
                const isAlreadySelected = this.selectionManager.isSelected(clickedObject) || 
                                        this.selectionManager.isSelected(outermostContainer);
                
                if (isAlreadySelected) {
                    // Don't override existing selection - use what's currently selected
                    console.log('MOVE: Object or its container already selected, using current selection');
                    const currentSelection = this.selectionManager.getSelectedObjects();
                    targetObject = currentSelection.length > 0 ? currentSelection[0] : null;
                } else {
                    // Use hierarchical selection
                    console.log('MOVE: New selection, using hierarchical selection');
                    targetObject = this.selectionManager.handleHierarchicalClick(event, intersectionData, 'move');
                    // Reset depth tracking for new selections
                    this.selectionManager.hierarchicalState.currentDepthMap.clear();
                    if (targetObject) {
                        this.selectionManager.hierarchicalState.currentDepthMap.set(targetObject.userData.id, 0);
                    }
                }
            }
            
            // Click tracking handled by centralized system
            
            // If no target object was determined, return false
            if (!targetObject) {
                return false;
            }
            
            // For containers, handle click analysis differently
            let clickAnalysis;
            if (targetObject && targetObject.isContainer) {
                // Use centralized container interaction handler
                const containerFace = this.containerHandler.getContainerFaceFromIntersection(targetObject, intersectionData);
                if (containerFace) {
                    clickAnalysis = {
                        type: 'face',
                        data: {
                            face: containerFace.face,
                            worldNormal: containerFace.worldNormal,
                            point: intersectionData.point,
                            object: targetObject,
                            axis: this.containerHandler.getNormalAxis(containerFace.worldNormal)
                        }
                    };
                } else {
                    clickAnalysis = this.analyzeClick(intersectionData);
                }
            } else {
                clickAnalysis = this.analyzeClick(intersectionData);
            }
            
            this.startMove(event, intersectionData, clickAnalysis);
            return true; // Block camera controls when starting move
        } else {
            // Don't clear selection on empty clicks - preserve selection for camera orbiting
            return false; // Allow camera controls
        }
    }

    onMouseMove(event, intersectionData) {
        if (!this.isActive) return false;
        
        if (this.isMoving) {
            this.updateMove(event);
            return true; // Block camera controls while moving
        } else {
            // Use centralized highlighting system for all hover feedback
            if (this.highlightManager) {
                this.updateCentralizedHoverHighlighting(intersectionData);
            }
            
            // Update cursor based on hover
            if (intersectionData && intersectionData.object.userData.selectable) {
                const clickAnalysis = this.analyzeClick(intersectionData);
                this.cursor = this.getCursorForClickType(clickAnalysis.type);
            } else {
                this.cursor = 'default';
            }
            this.updateCursor();
            return false; // Allow camera controls when not moving
        }
    }

    onMouseUp(event, intersectionData, isDragging, wasInteracting) {
        if (!this.isActive) return false;
        
        if (this.isMoving) {
            this.endMove();
            return false; // Allow camera controls after move ends
        } else {
            // Only deselect on empty space clicks if it's a genuine click (not camera drag)
            // Camera dragging sets isDragging = true, so we avoid deselecting during camera movement
            if (!intersectionData && !isDragging && !wasInteracting) {
                this.selectionManager.clearSelection();
                // Clear temp highlights using centralized system
                if (this.highlightManager) {
                    this.highlightManager.clearTemporaryHighlights();
                } else if (this.selectionManager.highlightSystem) {
                    // Fallback for legacy system
                    this.selectionManager.highlightSystem.clearTemporaryHighlights();
                }
            }
            return false; // Allow camera controls
        }
    }

    analyzeClick(intersectionData) {
        // Analyze where on the object the user clicked
        if (!intersectionData || !intersectionData.face) {
            return { type: 'face', data: null };
        }
        
        const object = intersectionData.object;
        const face = intersectionData.face;
        const point = intersectionData.point;
        
        // Calculate world normal
        const worldNormal = face.normal.clone().transformDirection(object.matrixWorld).normalize();
        
        // Check if click is near edges or corners
        const clickType = this.determineClickType(object, point, worldNormal);
        
        return {
            type: clickType.type,
            data: {
                face: face,
                worldNormal: worldNormal,
                point: point,
                object: object,
                ...clickType.data
            }
        };
    }
    
    determineClickType(object, clickPoint, worldNormal) {
        // Convert click point to local object space
        const localPoint = object.worldToLocal(clickPoint.clone());
        
        const width = object.userData.width || 2;
        const height = object.userData.height || 1;
        const depth = object.userData.depth || 3;
        
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const halfDepth = depth / 2;
        
        const tolerance = 0.15; // Smaller tolerance for more precise detection
        
        // Check if near corners - need to be close to ALL edges of a corner
        const nearX = Math.abs(Math.abs(localPoint.x) - halfWidth) < tolerance;
        const nearY = Math.abs(Math.abs(localPoint.y) - halfHeight) < tolerance;
        const nearZ = Math.abs(Math.abs(localPoint.z) - halfDepth) < tolerance;
        
        // Corner detection - must be near edges in ALL three dimensions that form a corner
        if ((nearX && nearY && nearZ)) {
            return {
                type: 'corner',
                data: {
                    position: clickPoint.clone(),
                    axes: this.getCornerAxes(localPoint, halfWidth, halfHeight, halfDepth)
                }
            };
        }
        
        // Edge detection - must be near edge in exactly ONE dimension
        const edgeDetected = (nearX && !nearY && !nearZ) || 
                           (!nearX && nearY && !nearZ) || 
                           (!nearX && !nearY && nearZ);
        
        if (edgeDetected) {
            return {
                type: 'edge',
                data: {
                    object: object,
                    axis: this.getEdgeAxis(localPoint, worldNormal, halfWidth, halfHeight, halfDepth),
                    start: clickPoint.clone(),
                    end: clickPoint.clone()
                }
            };
        }
        
        // Default to face
        return {
            type: 'face',
            data: {
                normal: worldNormal,
                axis: this.getFaceAxis(worldNormal)
            }
        };
    }
    
    getCornerAxes(localPoint, halfWidth, halfHeight, halfDepth) {
        // Return the axes available for corner movement
        return ['x', 'y', 'z']; // Corner allows movement in all directions
    }
    
    getEdgeAxis(localPoint, worldNormal, halfWidth, halfHeight, halfDepth) {
        // Determine which axis the edge runs along
        if (Math.abs(worldNormal.x) > 0.7) return 'x';
        if (Math.abs(worldNormal.y) > 0.7) return 'y';
        if (Math.abs(worldNormal.z) > 0.7) return 'z';
        return 'x'; // Default
    }
    
    getFaceAxis(worldNormal) {
        // Return the axis perpendicular to the face (movement direction)
        if (Math.abs(worldNormal.x) > 0.7) return 'x';
        if (Math.abs(worldNormal.y) > 0.7) return 'y';
        if (Math.abs(worldNormal.z) > 0.7) return 'z';
        return 'y'; // Default
    }
    
    getCursorForClickType(type) {
        switch (type) {
            case 'corner': return 'move';
            case 'edge': return 'ew-resize';
            case 'face': return 'ns-resize';
            default: return 'move';
        }
    }
    
    startMove(event, intersectionData, clickAnalysis) {
        const selectedObjects = this.selectionManager.getSelectedObjects();
        if (selectedObjects.length === 0) return;
        
        this.isMoving = true;
        this.isOperating = true;
        
        // Mark containers to prevent auto-resize during movement
        selectedObjects.forEach(object => {
            if (object.isContainer) {
                object.userData._isBeingMoved = true;
            }
        });
        
        // Hide non-selection highlights during move, keep selection highlights visible
        if (this.highlightManager) {
            this.highlightManager.hideNonSelectionHighlights();
            // Also aggressively clear all face highlights at the start of move
            this.highlightManager.clearFaceHoverHighlights();
            selectedObjects.forEach(object => {
                this.highlightManager.clearSelectedFaceHighlight(object);
            });
        }
        
        // Hide container bounding box helpers during move to prevent them showing in wrong positions
        this.selectionManager.hideContainerBoundingBoxes();
        
        // Disable camera controls during move
        const app = window.modlerApp;
        if (app && app.rendererManager) {
            app.rendererManager.disableControls();
        }
        
        // Store initial positions and mouse position
        const rect = this.eventManager.canvas.getBoundingClientRect();
        this.moveData = {
            objects: selectedObjects.map(obj => ({
                object: obj,
                initialPosition: obj.position.clone()
            })),
            startMouseX: event.clientX - rect.left,
            startMouseY: event.clientY - rect.top,
            initialGroundPoint: this.eventManager.getGroundPosition(event),
            clickAnalysis: clickAnalysis,
            clickType: clickAnalysis.type, // Store click type for snapping logic
            constrainedAxis: this.getConstrainedAxis(clickAnalysis)
        };
        
        this.cursor = 'grabbing';
        this.updateCursor();
        this.updateStatus(`Move Tool - Moving along ${this.moveData.constrainedAxis} axis...`);
        
        console.log('Started constrained move:', clickAnalysis.type, 'axis:', this.moveData.constrainedAxis);
    }
    
    getConstrainedAxis(clickAnalysis) {
        if (!clickAnalysis || !clickAnalysis.data) {
            return null;
        }
        
        switch (clickAnalysis.type) {
            case 'face':
                // For face clicks, return 'normal' to indicate normal-constrained movement
                return 'normal';
            case 'edge':
                return clickAnalysis.data.axis; // Move along edge
            case 'corner':
                return null; // Free movement
            default:
                return null;
        }
    }

    updateMove(event) {
        if (!this.moveData) return;
        
        // Calculate movement delta based on constraint
        let delta = new THREE.Vector3();
        let snapPosition = null;
        
        // Check for snapping using centralized SnapManager
        const currentMousePos = this.eventManager.getGroundPosition(event);
        if (currentMousePos && this.snapManager) {
            const selectedObjects = this.selectionManager.getSelectedObjects();
            const snapTarget = this.snapManager.getBestSnapTarget(currentMousePos, selectedObjects);
            if (snapTarget) {
                snapPosition = snapTarget.position;
                console.log('MOVE: Using centralized snap target:', snapTarget.type, 'at position:', snapPosition);
            }
        }
        
        if (snapPosition) {
            // Calculate delta to move the grabbed point (not object center) to snap position
            const grabbedPoint = this.getGrabbedPoint();
            if (grabbedPoint) {
                delta = snapPosition.clone().sub(grabbedPoint);
                console.log('MOVE: Snapping grabbed point to target position:', snapPosition);
            } else {
                // Fallback to center-based movement
                delta = snapPosition.clone().sub(this.moveData.initialGroundPoint);
            }
        } else if (this.moveData.constrainedAxis) {
            // Axis-constrained movement
            delta = this.calculateAxisConstrainedDelta(event);
        } else {
            // Free movement (corner click)
            const newGroundPoint = this.eventManager.getGroundPosition(event);
            if (newGroundPoint && this.moveData.initialGroundPoint) {
                delta = newGroundPoint.clone().sub(this.moveData.initialGroundPoint);
            }
        }
        
        // Apply movement to all selected objects
        this.moveData.objects.forEach(({ object, initialPosition }) => {
            const newPosition = initialPosition.clone().add(delta);
            object.position.copy(newPosition);
            
            // If this is a container, don't update bounding box during movement
            // This prevents the container from stretching/resizing while being moved
            if (object.isContainer) {
                // Don't call updateBoundingBox() during movement - this causes stretching
                // The container should move as a solid unit
                // Don't notify parent container - we're moving the whole container as a unit
            } else {
                // Only notify parent container for regular objects (not containers)
                // And only if we're not moving a container - check if the parent is also selected
                if (object.userData.parentContainer && 
                    object.userData.parentContainer.onChildChanged &&
                    !this.selectionManager.isSelected(object.userData.parentContainer)) {
                    object.userData.parentContainer.onChildChanged();
                }
            }
        });
        
        // Update selection highlight positions to follow the moved objects
        if (this.highlightManager) {
            const movedObjects = this.moveData.objects.map(item => item.object);
            this.highlightManager.updateHighlightPositions(movedObjects);
        }
        
        // Update properties panel in real-time (throttled)
        if (!this.lastPropertyUpdate || Date.now() - this.lastPropertyUpdate > 100) {
            this.selectionManager.refreshProperties();
            this.lastPropertyUpdate = Date.now();
        }
    }
    
    calculateAxisConstrainedDelta(event) {
        // Calculate movement along a specific axis based on mouse movement
        const rect = this.eventManager.canvas.getBoundingClientRect();
        const currentMouseX = event.clientX - rect.left;
        const currentMouseY = event.clientY - rect.top;
        
        const deltaX = currentMouseX - this.moveData.startMouseX;
        const deltaY = currentMouseY - this.moveData.startMouseY;
        
        // Use camera-relative approach for consistent axis movement
        const app = window.modlerApp;
        if (!app || !app.sceneManager || !app.sceneManager.camera) {
            console.error('Missing camera reference in MoveTool');
            return new THREE.Vector3();
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
        
        // Project world movement onto the constrained axis
        const delta = new THREE.Vector3();
        const axisVector = new THREE.Vector3();
        
        // Handle face normal constraint
        if (this.moveData.constrainedAxis === 'normal' && this.moveData.clickAnalysis && this.moveData.clickAnalysis.data && this.moveData.clickAnalysis.data.worldNormal) {
            const faceNormal = this.moveData.clickAnalysis.data.worldNormal.clone().normalize();
            const projectedDistance = worldMovement.dot(faceNormal);
            delta.copy(faceNormal.multiplyScalar(projectedDistance));
        } else {
            // Handle standard axis constraints
            switch (this.moveData.constrainedAxis) {
                case 'x':
                    axisVector.set(1, 0, 0);
                    break;
                case 'y':
                    axisVector.set(0, 1, 0);
                    break;
                case 'z':
                    axisVector.set(0, 0, 1);
                    break;
                default:
                    return new THREE.Vector3();
            }
            
            // Project the world movement onto the axis
            const projectedDistance = worldMovement.dot(axisVector);
            delta.copy(axisVector.multiplyScalar(projectedDistance));
        }
        
        // Removed excessive debugging
        
        return delta;
    }
    
    updateCentralizedHoverHighlighting(intersectionData) {
        // Clear all existing highlights
        if (this.highlightManager) {
            this.highlightManager.clearFaceHoverHighlights();
            this.highlightManager.clearTemporaryHighlights();
        }
        
        if (!intersectionData || !intersectionData.object.userData.selectable) {
            return;
        }
        
        const object = intersectionData.object;
        
        if (this.isMoving) {
            // During move: Show snap targets on other objects
            this.showSnapTargets(intersectionData);
        } else {
            // When hovering: Show appropriate highlights based on object type
            // Check if the hovered object is part of a selected container
            let targetObject = object;
            let isSelectedContainer = false;
            
            // If we hit a child of a selected container, highlight the container instead
            if (object.userData.parentContainer && this.selectionManager.isSelected(object.userData.parentContainer)) {
                targetObject = object.userData.parentContainer;
                isSelectedContainer = true;
            } else if (this.selectionManager.isSelected(object)) {
                isSelectedContainer = object.isContainer;
            }
            
            // Selection checking is now centralized in HighlightManager.addFaceHoverHighlight()
            if (isSelectedContainer) {
                // Show container face highlights when hovering selected containers or their children
                this.showContainerFaceHighlights(targetObject, intersectionData);
            } else {
                // For regular objects, show normal highlights  
                this.showObjectHighlights(targetObject, intersectionData);
            }
        }
    }
    
    showContainerFaceHighlights(container, intersectionData) {
        // Use centralized container interaction handler for face highlighting
        this.containerHandler.showContainerFaceHighlight(container, intersectionData);
    }
    
    // REMOVED: getContainerFaceFromIntersection - now handled by ContainerInteractionHandler
    
    // REMOVED: getFaceIndexForNormal - now handled by ContainerInteractionHandler
    
    // REMOVED: getNormalAxis - now handled by ContainerInteractionHandler
    
    showObjectHighlights(object, intersectionData) {
        // Show edges and corners on selected objects for grab points
        if (this.highlightManager) {
            // Show face highlight when hovering selected objects
            if (intersectionData.face) {
                this.highlightManager.addFaceHoverHighlight(intersectionData);
            }
            
            // Show edge and corner highlights for grab points
            this.addEdgeAndCornerHighlights(object);
        }
    }
    
    showSnapTargets(intersectionData) {
        // During move operation, show snap targets on other objects
        if (!this.snapManager || !this.isMoving) return;
        
        const object = intersectionData.object;
        const selectedObjects = this.selectionManager.getSelectedObjects();
        
        // Don't show snap targets on objects being moved
        if (selectedObjects.includes(object)) return;
        
        // Use centralized snap manager to find and show snap targets
        if (this.snapManager && this.moveData) {
            const currentPosition = this.moveData.objects[0]?.object.position;
            if (currentPosition) {
                const snapTarget = this.snapManager.getBestSnapTarget(currentPosition, selectedObjects, object);
                if (snapTarget) {
                    this.snapManager.showSnapPreview(snapTarget);
                    // Also highlight the snap target on the target object
                    this.highlightSnapTarget(object, snapTarget);
                }
            }
        }
    }
    
    addEdgeAndCornerHighlights(object) {
        // Add orange highlights for edges and corners
        const bounds = new THREE.Box3().setFromObject(object);
        
        // Add corner highlights
        const corners = this.getObjectCorners(bounds);
        corners.forEach(corner => {
            this.highlightManager.addTemporaryHighlight({
                type: 'corner',
                position: corner,
                color: 0xff6600 // Orange
            });
        });
        
        // Add edge highlights  
        const edges = this.getObjectEdges(bounds);
        edges.forEach(edge => {
            this.highlightManager.addTemporaryHighlight({
                type: 'edge',
                start: edge.start,
                end: edge.end,
                color: 0xff6600 // Orange
            });
        });
    }
    
    highlightSnapTarget(object, snapTarget) {
        // Highlight the specific snap target (corner/edge/face) on the target object
        if (this.highlightManager) {
            this.highlightManager.addTemporaryHighlight({
                type: snapTarget.type,
                position: snapTarget.position,
                start: snapTarget.start,
                end: snapTarget.end,
                color: 0x00ff00 // Green for snap targets
            });
        }
    }
    
    getObjectCorners(bounds) {
        // Return the 8 corners of the bounding box
        return [
            new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
            new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
            new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
            new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
            new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
            new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
            new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
            new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z)
        ];
    }
    
    getObjectEdges(bounds) {
        // Return the 12 edges of the bounding box
        const corners = this.getObjectCorners(bounds);
        return [
            // Bottom face edges
            { start: corners[0], end: corners[1] },
            { start: corners[1], end: corners[3] },
            { start: corners[3], end: corners[2] },
            { start: corners[2], end: corners[0] },
            // Top face edges  
            { start: corners[4], end: corners[5] },
            { start: corners[5], end: corners[7] },
            { start: corners[7], end: corners[6] },
            { start: corners[6], end: corners[4] },
            // Vertical edges
            { start: corners[0], end: corners[4] },
            { start: corners[1], end: corners[5] },
            { start: corners[2], end: corners[6] },
            { start: corners[3], end: corners[7] }
        ];
    }
    
    applyFinalSnapping() {
        // Apply snapping when move operation ends
        if (!this.snapManager || !this.moveData) return;
        
        const selectedObjects = this.selectionManager.getSelectedObjects();
        if (selectedObjects.length === 0) return;
        
        // Find the best snap target for the primary object
        const primaryObject = selectedObjects[0];
        const currentPosition = primaryObject.position.clone();
        
        // Get all potential target objects (not selected)
        const targetObjects = [];
        this.sceneManager.scene.traverse(child => {
            if (child.userData && child.userData.selectable && !selectedObjects.includes(child)) {
                targetObjects.push(child);
            }
        });
        
        // Find best snap target across all target objects
        let bestSnapTarget = null;
        let shortestDistance = Infinity;
        
        targetObjects.forEach(targetObject => {
            const snapTarget = this.snapManager.getBestSnapTarget(currentPosition, selectedObjects, targetObject);
            if (snapTarget && snapTarget.distance < shortestDistance) {
                bestSnapTarget = snapTarget;
                shortestDistance = snapTarget.distance;
            }
        });
        
        // Apply snapping if within snap threshold
        if (bestSnapTarget && shortestDistance <= this.snapManager.getSnapThreshold()) {
            console.log('MOVE: Applying final snap to', bestSnapTarget.type, 'at distance', shortestDistance);
            
            // Calculate offset to apply to all selected objects
            const snapOffset = bestSnapTarget.position.clone().sub(currentPosition);
            
            // Apply snap offset to all selected objects
            selectedObjects.forEach(object => {
                object.position.add(snapOffset);
            });
            
            // Update highlight positions after snapping
            if (this.highlightManager) {
                this.highlightManager.updateHighlightPositions(selectedObjects);
            }
        }
    }
    
    
    calculateActualEdge(object, clickPoint, axis) {
        // Calculate the actual edge endpoints for highlighting
        const width = object.userData.width || 2;
        const height = object.userData.height || 1;
        const depth = object.userData.depth || 3;
        
        // Get object position
        const objPos = object.position;
        
        // Convert click point to local space to find which edge we're near
        const localPoint = object.worldToLocal(clickPoint.clone());
        
        // Calculate edge endpoints based on which edge was detected
        let start = new THREE.Vector3();
        let end = new THREE.Vector3();
        
        const halfW = width / 2;
        const halfH = height / 2;  
        const halfD = depth / 2;
        
        // Determine which edge based on which coordinate is closest to the edge
        switch (axis) {
            case 'x':
                // Edge runs along X axis
                start.set(-halfW, localPoint.y, localPoint.z);
                end.set(halfW, localPoint.y, localPoint.z);
                break;
            case 'y':
                // Edge runs along Y axis  
                start.set(localPoint.x, -halfH, localPoint.z);
                end.set(localPoint.x, halfH, localPoint.z);
                break;
            case 'z':
                // Edge runs along Z axis
                start.set(localPoint.x, localPoint.y, -halfD);
                end.set(localPoint.x, localPoint.y, halfD);
                break;
        }
        
        // Convert back to world space
        start = object.localToWorld(start);
        end = object.localToWorld(end);
        
        return { start, end };
    }
    
    findObjectFromCornerData(cornerData) {
        // Find the object that's currently selected (for corner detection)
        const selectedObjects = this.selectionManager.getSelectedObjects();
        return selectedObjects.length > 0 ? selectedObjects[0] : null;
    }
    
    calculateNearestCorner(object, clickPosition) {
        // Calculate the nearest actual corner position
        const width = object.userData.width || 2;
        const height = object.userData.height || 1;
        const depth = object.userData.depth || 3;
        
        const halfW = width / 2;
        const halfH = height / 2;
        const halfD = depth / 2;
        
        // Convert click to local space
        const localClick = object.worldToLocal(clickPosition.clone());
        
        // Find the nearest corner by determining which octant the click is in
        const cornerX = localClick.x > 0 ? halfW : -halfW;
        const cornerY = localClick.y > 0 ? halfH : -halfH;
        const cornerZ = localClick.z > 0 ? halfD : -halfD;
        
        // Convert back to world space
        const cornerLocal = new THREE.Vector3(cornerX, cornerY, cornerZ);
        const cornerWorld = object.localToWorld(cornerLocal);
        
        return cornerWorld;
    }

    endMove() {
        if (!this.isMoving) return;
        
        // Apply final snapping before ending move
        this.applyFinalSnapping();
        
        // Notify parent containers that children have changed (but only for non-container objects)
        const selectedObjects = this.selectionManager.getSelectedObjects();
        selectedObjects.forEach(object => {
            // Only notify parent containers if:
            // 1. The object has a parent container
            // 2. The object itself is not a container (containers move as whole units)
            // 3. The parent container is not also selected (avoid double notifications)
            if (object.userData.parentContainer && 
                object.userData.parentContainer.onChildChanged &&
                !object.isContainer &&
                !this.selectionManager.isSelected(object.userData.parentContainer)) {
                object.userData.parentContainer.onChildChanged();
            }
        });
        
        // Clear movement flags from containers and update their bounding boxes
        selectedObjects.forEach(object => {
            if (object.isContainer) {
                delete object.userData._isBeingMoved;
                // Now that movement is complete, update the bounding box helper position
                object.updateBoundingBox();
            }
        });
        
        this.isMoving = false;
        this.isOperating = false;
        this.moveData = null;
        
        // Show all highlights again after move operation
        if (this.highlightManager) {
            this.highlightManager.showAllHighlights();
        }
        
        // Show container bounding box helpers again after move
        this.selectionManager.showContainerBoundingBoxes();
        
        // Clear all temporary highlights (edges, corners, faces) using centralized system
        if (this.highlightManager) {
            this.highlightManager.clearTemporaryHighlights();
            this.highlightManager.clearFaceHoverHighlights();
            
            // Also clear any stuck face highlights from selected objects
            selectedObjects.forEach(object => {
                this.highlightManager.removeFaceHighlight(object);
            });
        }
        
        // Clear snap previews
        if (this.snapManager) {
            this.snapManager.clearSnapPreview();
        }
        
        // Re-enable camera controls
        const app = window.modlerApp;
        if (app && app.rendererManager) {
            app.rendererManager.enableControlsAgain();
        }
        
        // Final properties update after move is complete
        this.selectionManager.refreshProperties();
        
        this.cursor = 'move';
        this.updateCursor();
        this.updateStatus('Move Tool - Select objects to move them');
        
        console.log('Move operation completed');
    }

    onKeyDown(event) {
        if (!this.isActive) return;
        
        switch (event.key.toLowerCase()) {
            case 'escape':
                if (this.isMoving) {
                    event.preventDefault();
                    // Cancel move - restore original positions
                    if (this.moveData) {
                        this.moveData.objects.forEach(({ object, initialPosition }) => {
                            object.position.copy(initialPosition);
                            // Selection highlighting is handled by SelectionManager automatically
                        });
                    }
                    this.endMove();
                    return true;
                } else {
                    // If not moving, clear selection
                    event.preventDefault();
                    this.selectionManager.clearSelection();
                    this.selectionManager.highlightSystem.clearTemporaryHighlights();
                    return true;
                }
                break;
        }
        
        return false;
    }

    getStatusText() {
        if (this.isMoving) {
            return 'Move Tool - Dragging objects (ESC to cancel)';
        }
        const selectedCount = this.selectionManager.getSelectedObjects().length;
        if (selectedCount > 0) {
            return `Move Tool - ${selectedCount} object${selectedCount > 1 ? 's' : ''} selected`;
        }
        return 'Move Tool - Select objects to move them';
    }
    
    findSnapPosition(currentMousePos, event) {
        // Find all objects except the ones being moved
        const otherObjects = [];
        this.sceneManager.scene.traverse(child => {
            if (child.userData && child.userData.selectable) {
                // Skip objects that are currently being moved
                const isBeingMoved = this.moveData.objects.some(({ object }) => object === child);
                if (!isBeingMoved) {
                    otherObjects.push(child);
                }
            }
        });
        
        if (otherObjects.length === 0) return null;
        
        // Convert mouse position to screen space for proximity checking
        const mouseScreen = currentMousePos.clone().project(this.sceneManager.camera);
        
        let closestSnapPoint = null;
        let closestDistance = Infinity;
        const snapThreshold = 0.08; // 8% of screen space
        
        // Check each other object for snap points
        otherObjects.forEach(object => {
            const snapPoints = this.getObjectSnapPoints(object);
            
            snapPoints.forEach(snapPoint => {
                const snapScreen = snapPoint.position.clone().project(this.sceneManager.camera);
                const distance = mouseScreen.distanceTo(snapScreen);
                
                if (distance < snapThreshold && distance < closestDistance) {
                    // Filter snap points based on move type
                    if (this.shouldSnapToPoint(snapPoint)) {
                        closestDistance = distance;
                        closestSnapPoint = snapPoint;
                    }
                }
            });
        });
        
        return closestSnapPoint ? closestSnapPoint.position : null;
    }
    
    getObjectSnapPoints(object) {
        // Get bounding box for snap points
        const bounds = new THREE.Box3().setFromObject(object);
        const snapPoints = [];
        
        // 8 corners of the bounding box
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
        
        corners.forEach(corner => {
            snapPoints.push({
                type: 'corner',
                position: corner
            });
        });
        
        // Edge midpoints (12 edges)
        const edges = [
            // Bottom face edges
            { start: corners[0], end: corners[1] },
            { start: corners[1], end: corners[3] },
            { start: corners[3], end: corners[2] },
            { start: corners[2], end: corners[0] },
            // Top face edges
            { start: corners[4], end: corners[5] },
            { start: corners[5], end: corners[7] },
            { start: corners[7], end: corners[6] },
            { start: corners[6], end: corners[4] },
            // Vertical edges
            { start: corners[0], end: corners[4] },
            { start: corners[1], end: corners[5] },
            { start: corners[2], end: corners[6] },
            { start: corners[3], end: corners[7] }
        ];
        
        edges.forEach(edge => {
            const midpoint = edge.start.clone().lerp(edge.end, 0.5);
            snapPoints.push({
                type: 'edge',
                position: midpoint,
                start: edge.start,
                end: edge.end
            });
        });
        
        // Face centers (6 faces)
        const faceCenters = [
            new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.min.y, (bounds.min.z + bounds.max.z) / 2), // Bottom
            new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.max.y, (bounds.min.z + bounds.max.z) / 2), // Top
            new THREE.Vector3(bounds.min.x, (bounds.min.y + bounds.max.y) / 2, (bounds.min.z + bounds.max.z) / 2), // Left
            new THREE.Vector3(bounds.max.x, (bounds.min.y + bounds.max.y) / 2, (bounds.min.z + bounds.max.z) / 2), // Right
            new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, bounds.min.z), // Front
            new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, bounds.max.z)  // Back
        ];
        
        faceCenters.forEach((center, index) => {
            const faceNormals = [
                new THREE.Vector3(0, -1, 0), // Bottom
                new THREE.Vector3(0, 1, 0),  // Top
                new THREE.Vector3(-1, 0, 0), // Left
                new THREE.Vector3(1, 0, 0),  // Right
                new THREE.Vector3(0, 0, -1), // Front
                new THREE.Vector3(0, 0, 1)   // Back
            ];
            
            snapPoints.push({
                type: 'face',
                position: center,
                normal: faceNormals[index]
            });
        });
        
        return snapPoints;
    }
    
    shouldSnapToPoint(snapPoint) {
        if (!this.moveData || !this.moveData.clickType) return true;
        
        const clickType = this.moveData.clickType;
        
        if (clickType === 'corner') {
            // When dragging by corner, can snap to corners and edges
            return snapPoint.type === 'corner' || snapPoint.type === 'edge';
        } else if (clickType === 'face') {
            // When dragging by face, can snap to corners, edges, and aligned faces
            if (snapPoint.type === 'corner' || snapPoint.type === 'edge') {
                return true;
            }
            if (snapPoint.type === 'face' && this.moveData.constrainedAxis) {
                // Only snap to faces that are aligned with the movement axis
                const axis = this.moveData.constrainedAxis;
                const faceNormal = snapPoint.normal;
                
                // Check if face normal is aligned with movement axis
                if (axis === 'x') return Math.abs(faceNormal.x) > 0.9;
                if (axis === 'y') return Math.abs(faceNormal.y) > 0.9;
                if (axis === 'z') return Math.abs(faceNormal.z) > 0.9;
            }
            return false;
        }
        
        return true;
    }
    
    getGrabbedPoint() {
        if (!this.moveData || !this.moveData.clickAnalysis) return null;
        
        const clickAnalysis = this.moveData.clickAnalysis;
        const object = this.moveData.objects[0]?.object; // Use first selected object
        
        if (!object) return null;
        
        // Use the actual clicked point from the intersection data
        if (clickAnalysis.data && clickAnalysis.data.point) {
            return clickAnalysis.data.point.clone();
        }
        
        // Fallback to object center
        return object.position.clone();
    }
}

// Export for module use
window.MoveTool = MoveTool;