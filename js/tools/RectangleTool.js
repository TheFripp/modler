class RectangleTool extends Tool {
    constructor(sceneManager, eventManager, geometryManager, selectionManager, materialManager = null, stateManager = null, objectManager = null, configManager = null, highlightManager = null) {
        super('rectangle', sceneManager, eventManager);
        this.geometryManager = geometryManager;
        this.selectionManager = selectionManager;
        this.materialManager = materialManager;
        this.stateManager = stateManager;
        this.objectManager = objectManager;
        this.configManager = configManager;
        this.highlightManager = highlightManager;
        this.cursor = 'crosshair';
        
        this.isDrawing = false;
        this.startPoint = null;
        this.previewMesh = null;
        this.snapToGrid = false; // Default to precise positioning
        
        // Face drawing state
        this.targetFace = null; // The face we're drawing on
        this.faceNormal = null;
        this.hoveredObject = null;
        this.snapData = null; // Current snap target (edge/corner)
    }

    activate() {
        console.log('RECTANGLE TOOL: ACTIVATE called');
        super.activate();
        console.log('RECTANGLE TOOL: ACTIVATED - isActive:', this.isActive);
        console.log('RECTANGLE TOOL: Ready to receive mouse events');
        this.updateStatus('Rectangle Tool - Click and drag to create rectangle');
        // Controls will be disabled when drawing starts, not on activation
    }

    deactivate() {
        super.deactivate();
        this.cancelDrawing();
    }

    onMouseDown(event, intersectionData) {
        console.log('RECTANGLE TOOL: MOUSEDOWN EVENT RECEIVED - isActive:', this.isActive, 'button:', event.button);
        if (!this.isActive) {
            console.log('RECTANGLE: Tool not active, ignoring mousedown');
            return false;
        }
        
        if (event.button !== 0) return false; // Only left mouse button

        console.log('RECTANGLE: MouseDown received');
        if (intersectionData) {
            console.log('RECTANGLE: intersectionData exists - object:', intersectionData.object?.userData?.id, 'point:', intersectionData.point, 'selectable:', intersectionData.object?.userData?.selectable);
        } else {
            console.log('RECTANGLE: intersectionData is null/undefined');
        }
        
        // Determine drawing position: snap point, object surface, or ground
        let worldPos = null;
        let useObjectSurface = false;
        
        // First, check for snap position (highest priority)
        const snapPoint = this.getSnapPosition(intersectionData, event);
        if (snapPoint) {
            worldPos = snapPoint;
            console.log('RECTANGLE: Using snap position:', `(${worldPos.x}, ${worldPos.y}, ${worldPos.z})`);
        } 
        // Otherwise, use best available position
        else {
            worldPos = this.getBestPosition(intersectionData, event);
            
            // Set target face info if drawing on object surface
            if (intersectionData && intersectionData.object && intersectionData.point) {
                this.targetFace = intersectionData.face;
                this.faceNormal = intersectionData.normal;
                console.log('RECTANGLE: Using object surface position:', `(${worldPos.x}, ${worldPos.y}, ${worldPos.z})`);
            } else {
                console.log('RECTANGLE: Using ground position:', `(${worldPos.x}, ${worldPos.y}, ${worldPos.z})`);
            }
        }
        
        if (!worldPos) return false;
        this.startPoint = worldPos.clone();

        this.isDrawing = true;
        console.log('RECTANGLE: Set isDrawing = true, startPoint:', `(${this.startPoint.x}, ${this.startPoint.y}, ${this.startPoint.z})`);
        
        return true; // Prevent camera interaction while drawing
    }

    onMouseMove(event, intersectionData) {
        if (!this.isActive) {
            console.log('RECTANGLE: onMouseMove called but tool not active');
            return false;
        }
        
        if (this.isDrawing) {
            console.log('RECTANGLE: onMouseMove WHILE DRAWING - active:', this.isActive, 'isDrawing:', this.isDrawing);
        }

        if (this.isDrawing && this.startPoint) {
            // Create preview mesh on first mouse movement
            if (!this.previewMesh) {
                this.createPreviewMesh();
                console.log('RECTANGLE: Created preview mesh on first mouse movement');
            }
            
            // While drawing, show snap points for end position
            this.showSnapHighlights(intersectionData, event);
            const endPoint = this.getSnapPosition(intersectionData, event) || this.getBestPosition(intersectionData, event);
            
            this.updatePreviewMesh(this.startPoint, endPoint);
            console.log('RECTANGLE: Updated preview mesh from', this.startPoint, 'to', endPoint);
        } else {
            // Not drawing - show snap points for start position
            this.showSnapHighlights(intersectionData, event);
        }

        // Only prevent camera interaction when actively drawing
        if (this.isDrawing) {
            return true; // Prevent camera during drawing
        }
        return false; // Allow camera when not drawing
    }

    onMouseUp(event, intersectionData, isDragging, wasInteracting) {
        console.log('RECTANGLE: onMouseUp called, isDrawing:', this.isDrawing);
        if (!this.isDrawing) return false;

        if (!this.startPoint) return false;

        // Check for snap position first, then use best available position
        let endPoint = this.getSnapPosition(intersectionData, event);
        if (!endPoint) {
            const currentPos = this.getBestPosition(intersectionData, event);
            if (!currentPos) return false;
            endPoint = this.snapToGrid ? this.sceneManager.snapToGrid(currentPos) : currentPos;
        }

        // Calculate dimensions
        const width = Math.abs(endPoint.x - this.startPoint.x);
        const height = Math.abs(endPoint.z - this.startPoint.z);
        console.log('RECTANGLE: Calculated dimensions - width:', width, 'height:', height);
        console.log('RECTANGLE: Start point:', `(${this.startPoint.x}, ${this.startPoint.y}, ${this.startPoint.z})`);
        console.log('RECTANGLE: End point:', `(${endPoint.x}, ${endPoint.y}, ${endPoint.z})`);

        // Only create rectangle if it has meaningful size
        if (width > 0.1 && height > 0.1) {
            console.log('RECTANGLE: Creating rectangle...');
            this.createRectangle(this.startPoint, endPoint);
        } else {
            console.log('RECTANGLE: Rectangle too small, not creating. Min size: 0.1');
        }

        this.finishDrawing();
        return true; // Prevent camera interaction
    }

    createPreviewMesh() {
        if (this.previewMesh) {
            this.sceneManager.scene.remove(this.previewMesh);
        }

        // Create rectangle outline using EdgesGeometry to avoid diagonal line
        const planeGeometry = new THREE.PlaneGeometry(1, 1);
        const edgesGeometry = new THREE.EdgesGeometry(planeGeometry);
        const material = this.materialManager ? 
            this.materialManager.getLineMaterial(0x00ff00, { linewidth: 2 }) :
            new THREE.LineBasicMaterial({ 
                color: 0x00ff00,
                linewidth: 2
            });
        planeGeometry.dispose(); // Clean up intermediate geometry
        
        this.previewMesh = new THREE.LineSegments(edgesGeometry, material);
        this.previewMesh.rotation.x = -Math.PI / 2; // Lay flat on ground
        this.previewMesh.userData = {
            isPreview: true,
            selectable: false
        };
        
        // Position at start point initially to avoid showing at origin
        if (this.startPoint) {
            this.previewMesh.position.copy(this.startPoint);
            this.previewMesh.position.y = 0.01; // Slightly above ground
        }
        
        this.sceneManager.scene.add(this.previewMesh);
        console.log('RECTANGLE: Preview mesh created and added to scene at:', this.startPoint);
    }

    updatePreviewMesh(startPoint, endPoint) {
        if (!this.previewMesh) return;

        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.z - startPoint.z);
        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerZ = (startPoint.z + endPoint.z) / 2;

        // Ensure minimum size for preview visibility
        const minSize = 0.1;
        const previewWidth = Math.max(width, minSize);
        const previewHeight = Math.max(height, minSize);

        // Update geometry - create new edges geometry for clean rectangle outline
        this.previewMesh.geometry.dispose();
        const newPlaneGeometry = new THREE.PlaneGeometry(previewWidth, previewHeight);
        this.previewMesh.geometry = new THREE.EdgesGeometry(newPlaneGeometry);
        newPlaneGeometry.dispose(); // Clean up intermediate geometry

        // Update position
        this.previewMesh.position.set(centerX, 0.01, centerZ);
        
        console.log('RECTANGLE: Preview updated - pos:', `(${centerX}, 0.01, ${centerZ})`, 'size:', `${previewWidth}x${previewHeight}`);
    }

    createRectangle(startPoint, endPoint) {
        console.log('RECTANGLE: createRectangle called');
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.z - startPoint.z);
        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2; // Use actual Y position
        const centerZ = (startPoint.z + endPoint.z) / 2;
        console.log('RECTANGLE: Final dimensions for creation - width:', width, 'height:', height, 'center:', centerX, centerY, centerZ);

        const rectangle = this.geometryManager.createRectangle(
            width, height,
            new THREE.Vector3(centerX, centerY, centerZ), // Use centerY instead of 0
            null,
            {
                type: 'rectangle',
                width: width,
                height: height
            }
        );

        // Auto-select the newly created rectangle
        const app = window.modlerApp;
        if (app && app.selectionManager) {
            console.log('Auto-selecting created rectangle:', rectangle.userData.id);
            app.selectionManager.selectOnly(rectangle);
        }

        console.log(`Created rectangle: ${width.toFixed(2)} × ${height.toFixed(2)}`);
    }

    // Face detection and highlighting methods
    updateFaceDetection(intersectionData) {
        // Clear previous highlighting
        if (this.highlightManager) {
            this.highlightManager.clearTemporaryHighlights();
        }
        
        if (intersectionData && intersectionData.object.userData.selectable) {
            console.log('RECTANGLE: Hovering over face of object:', intersectionData.object.userData.id);
            
            // Highlight edges and corners of this object face
            this.highlightFaceEdgesAndCorners(intersectionData.object, intersectionData.face);
            this.hoveredObject = intersectionData.object;
        } else {
            this.hoveredObject = null;
        }
    }
    
    updateSnapHighlighting(intersectionData) {
        // Clear previous snap highlighting
        if (this.highlightManager) {
            this.highlightManager.clearTemporaryHighlights();
        }
        
        if (intersectionData && intersectionData.object === this.hoveredObject) {
            // Still on the same object - update snap highlights
            this.highlightFaceEdgesAndCorners(intersectionData.object, intersectionData.face);
            
            // Calculate snap data for current cursor position
            this.snapData = this.calculateSnapData(intersectionData);
        }
    }
    
    highlightFaceEdgesAndCorners(object, face) {
        // Highlight the edges and corners of the face being hovered
        const edges = this.getFaceEdges(object, face);
        const corners = this.getFaceCorners(object, face);
        
        if (this.highlightManager) {
            // Highlight edges in orange
            edges.forEach(edge => {
                this.highlightManager.addTemporaryHighlight({
                    type: 'edge',
                    start: edge.start,
                    end: edge.end
                });
            });
            
            // Highlight corners in orange
            corners.forEach(corner => {
                this.highlightManager.addTemporaryHighlight({
                    type: 'corner',
                    position: corner
                });
            });
        }
    }
    
    getCurrentDrawPosition(event, intersectionData) {
        if (this.snapData) {
            // Return snapped position
            console.log('RECTANGLE: Using snapped position');
            return this.snapData.position;
        } else if (this.targetFace) {
            // Drawing on a face - project cursor onto face plane
            console.log('RECTANGLE: Drawing on face');
            return this.projectCursorToFace(event);
        } else {
            // Fallback to ground plane
            console.log('RECTANGLE: Using ground position');
            return this.getGroundPosition(event);
        }
    }
    
    getFaceEdges(object, face) {
        // Calculate the edges of the face
        // This is a simplified version - you'd want to make this more robust
        const width = object.userData.width || 2;
        const height = object.userData.height || 1;
        const depth = object.userData.depth || 3;
        
        // Return array of edge objects with start/end points
        // This is placeholder - needs proper face edge calculation
        return [];
    }
    
    getFaceCorners(object, face) {
        // Calculate the corners of the face
        // This is a simplified version - you'd want to make this more robust
        const width = object.userData.width || 2;
        const height = object.userData.height || 1;
        const depth = object.userData.depth || 3;
        
        // Return array of corner positions
        // This is placeholder - needs proper face corner calculation
        return [];
    }
    
    calculateSnapData(intersectionData) {
        // Calculate if cursor is near an edge or corner for snapping
        // Return { type: 'edge'|'corner', position: Vector3 }
        return null;
    }
    
    getBestPosition(intersectionData, event) {
        // Determine the best drawing position based on available data
        // Priority: object surface > ground plane
        
        if (intersectionData && intersectionData.object && intersectionData.point) {
            // Use object surface position
            return intersectionData.point.clone();
        } else {
            // Fallback to ground position
            return this.getGroundPosition(event);
        }
    }
    
    projectCursorToFace(event, intersectionData) {
        // Project cursor position onto the target face plane
        return this.getBestPosition(intersectionData, event);
    }

    cancelDrawing() {
        if (this.previewMesh) {
            this.sceneManager.scene.remove(this.previewMesh);
            this.previewMesh.geometry.dispose();
            this.previewMesh.material.dispose();
            this.previewMesh = null;
        }
        
        // Clear highlighting
        if (this.highlightManager) {
            this.highlightManager.clearTemporaryHighlights();
        }
        
        this.isDrawing = false;
        this.startPoint = null;
        this.targetFace = null;
        this.faceNormal = null;
        this.hoveredObject = null;
        this.snapData = null;
    }

    finishDrawing() {
        this.cancelDrawing();
        
        // Don't switch tools - allow continuous rectangle creation
        return false; // Allow camera interaction after drawing finishes
    }

    onKeyDown(event) {
        switch (event.key.toLowerCase()) {
            case 'escape':
                if (this.isDrawing) {
                    event.preventDefault();
                    this.cancelDrawing();
                    return true;
                }
                break;
                
            case 'tab':
                event.preventDefault();
                this.snapToGrid = !this.snapToGrid;
                const status = this.snapToGrid ? 'ON' : 'OFF';
                console.log(`Grid snapping: ${status}`);
                this.updateStatus(`Rectangle Tool - Grid snapping: ${status} (Press Tab to toggle)`);
                return true;
        }
        
        return false;
    }

    showSnapHighlights(intersectionData, event) {
        // Clear previous highlights
        if (this.highlightManager) {
            this.highlightManager.clearTemporaryHighlights();
        }
        
        if (!intersectionData || !intersectionData.object.userData.selectable) return;
        
        const object = intersectionData.object;
        const snapPoint = this.findNearestSnapPoint(object, intersectionData, event);
        
        if (snapPoint && this.highlightManager) {
            // Only log if we're close enough (reduce spam)
        // console.log('RECTANGLE: Snap point found -', snapPoint.type, 'at', snapPoint.position);
            if (snapPoint.type === 'corner') {
                this.highlightManager.addTemporaryHighlight({
                    type: 'corner',
                    position: snapPoint.position
                });
            } else if (snapPoint.type === 'edge') {
                this.highlightManager.addTemporaryHighlight({
                    type: 'edge',
                    start: snapPoint.start,
                    end: snapPoint.end
                });
            }
        }
    }

    getSnapPosition(intersectionData, event) {
        if (!intersectionData || !intersectionData.object.userData.selectable) return null;
        
        const object = intersectionData.object;
        const snapPoint = this.findNearestSnapPoint(object, intersectionData, event);
        
        return snapPoint ? snapPoint.position : null;
    }

    findNearestSnapPoint(object, intersectionData, event) {
        // Get mouse position in world coordinates and convert to 2D screen space for distance calculation
        const mouseWorld = this.getGroundPosition(event);
        if (!mouseWorld) return null;
        
        // Convert mouse world position to screen coordinates for better proximity detection
        const mouseScreen = mouseWorld.clone().project(this.sceneManager.camera);
        
        // Get object dimensions and position
        const bounds = new THREE.Box3().setFromObject(object);
        
        // Calculate all snap points (corners and edge midpoints)
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
            // Convert corner to screen space for proximity check
            const cornerScreen = corner.clone().project(this.sceneManager.camera);
            const screenDistance = mouseScreen.distanceTo(cornerScreen);
            
            snapPoints.push({
                type: 'corner',
                position: corner,
                distance: screenDistance
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
            // Add multiple points along each edge for better snapping sensitivity
            const numPoints = 5; // Sample 5 points along each edge
            for (let i = 0; i < numPoints; i++) {
                const t = i / (numPoints - 1); // 0 to 1
                const edgePoint = edge.start.clone().lerp(edge.end, t);
                // Convert edge point to screen space for proximity check
                const edgePointScreen = edgePoint.clone().project(this.sceneManager.camera);
                const screenDistance = mouseScreen.distanceTo(edgePointScreen);
                
                snapPoints.push({
                    type: 'edge',
                    position: edgePoint,
                    start: edge.start,
                    end: edge.end,
                    distance: screenDistance
                });
            }
        });
        
        // Find closest snap point within snap distance (screen space)
        const snapDistance = 0.06; // 6% of screen space - more forgiving for edges
        
        if (snapPoints.length === 0) return null;
        
        const closest = snapPoints.reduce((prev, curr) => 
            curr.distance < prev.distance ? curr : prev
        );
        
        console.log('RECTANGLE: Closest snap distance:', closest.distance, 'threshold:', snapDistance);
        return closest.distance <= snapDistance ? closest : null;
    }

    dispose() {
        this.cancelDrawing();
    }
}

// Export for module use
window.RectangleTool = RectangleTool;