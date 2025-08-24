/**
 * Event Manager - Centralizes event handling for mouse, keyboard, and UI
 */
class EventManager {
    constructor(canvas, camera, scene) {
        this.canvas = canvas;
        this.camera = camera;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Event state
        this.mouseDownPosition = null;
        this.isDragging = false;
        this.wasInteracting = false;
        
        // Callbacks
        this.callbacks = {
            mouseDown: [],
            mouseUp: [],
            mouseMove: [],
            keyDown: [],
            keyUp: [],
            wheel: []
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Event registration methods
    onMouseDown(callback) { this.callbacks.mouseDown.push(callback); }
    onMouseUp(callback) { this.callbacks.mouseUp.push(callback); }
    onMouseMove(callback) { this.callbacks.mouseMove.push(callback); }
    onKeyDown(callback) { this.callbacks.keyDown.push(callback); }
    onKeyUp(callback) { this.callbacks.keyUp.push(callback); }
    onWheel(callback) { this.callbacks.wheel.push(callback); }

    // Mouse event handlers
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseDownPosition = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        this.isDragging = false;

        const intersectionData = this.getIntersectionData(event);
        
        this.callbacks.mouseDown.forEach(callback => {
            callback(event, intersectionData);
        });
    }

    handleMouseUp(event) {
        const intersectionData = this.getIntersectionData(event);
        
        this.callbacks.mouseUp.forEach(callback => {
            callback(event, intersectionData, this.isDragging, this.wasInteracting);
        });

        // Reset state
        this.mouseDownPosition = null;
        this.isDragging = false;
        this.wasInteracting = false;
    }

    handleMouseMove(event) {
        // Check if we're dragging
        if (this.mouseDownPosition && !this.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            const currentX = event.clientX - rect.left;
            const currentY = event.clientY - rect.top;
            const deltaX = currentX - this.mouseDownPosition.x;
            const deltaY = currentY - this.mouseDownPosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (distance > 5) { // 5 pixel threshold for drag detection
                this.isDragging = true;
            }
        }

        const intersectionData = this.getIntersectionData(event);
        
        this.callbacks.mouseMove.forEach(callback => {
            callback(event, intersectionData);
        });
    }

    handleWheel(event) {
        this.callbacks.wheel.forEach(callback => {
            callback(event);
        });
    }

    // Keyboard event handlers
    handleKeyDown(event) {
        this.callbacks.keyDown.forEach(callback => {
            callback(event);
        });
    }

    handleKeyUp(event) {
        this.callbacks.keyUp.forEach(callback => {
            callback(event);
        });
    }

    // Utility methods
    getIntersectionData(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.canvas.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.canvas.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Get all selectable objects
        const selectableObjects = [];
        this.scene.traverse(child => {
            if (child.userData && child.userData.selectable) {
                selectableObjects.push(child);
            }
        });

        const intersects = this.raycaster.intersectObjects(selectableObjects, true);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            return {
                object: intersection.object,
                point: intersection.point,
                normal: intersection.face ? intersection.face.normal : null,
                face: intersection.face,
                faceIndex: intersection.faceIndex,
                distance: intersection.distance,
                worldNormal: intersection.face ? intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld) : null
            };
        }

        return null;
    }

    getGroundPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.canvas.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.canvas.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const groundPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(groundPlane, groundPoint);
        
        return groundPoint;
    }

    setWasInteracting(value) {
        this.wasInteracting = value;
    }

    dispose() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('wheel', this.handleWheel);
        
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        // Clear callbacks
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = [];
        });
    }
}

// Export for module use
window.EventManager = EventManager;