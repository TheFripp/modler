export class InputManager {
    constructor(scene, toolManager, uiManager) {
        this.scene = scene;
        this.toolManager = toolManager;
        this.uiManager = uiManager;
        
        this.isMouseDown = false;
        this.mouseButton = -1;
        this.lastMousePos = { x: 0, y: 0 };
        
        this.init();
    }

    init() {
        this.setupCanvasEventListeners();
    }

    setupCanvasEventListeners() {
        const canvas = this.scene.canvas;
        
        // Mouse events
        canvas.addEventListener('mousedown', (event) => this.handleMouseDown(event));
        canvas.addEventListener('mousemove', (event) => this.handleMouseMove(event));
        canvas.addEventListener('mouseup', (event) => this.handleMouseUp(event));
        canvas.addEventListener('click', (event) => this.handleClick(event));
        canvas.addEventListener('dblclick', (event) => this.handleDoubleClick(event));
        canvas.addEventListener('wheel', (event) => this.handleWheel(event));
        
        // Context menu
        canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            return false;
        });
        
        // Touch events for mobile support
        canvas.addEventListener('touchstart', (event) => this.handleTouchStart(event));
        canvas.addEventListener('touchmove', (event) => this.handleTouchMove(event));
        canvas.addEventListener('touchend', (event) => this.handleTouchEnd(event));
        
        // Prevent default drag behavior
        canvas.addEventListener('dragstart', (event) => event.preventDefault());
    }

    handleMouseDown(event) {
        event.preventDefault();
        
        this.isMouseDown = true;
        this.mouseButton = event.button;
        this.lastMousePos = { x: event.clientX, y: event.clientY };
        
        // Handle middle mouse for camera controls
        if (event.button === 1) { // Middle mouse
            this.scene.controls.enabled = true;
            this.scene.controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
            return;
        }
        
        // Handle shift+middle mouse for panning
        if (event.button === 1 && event.shiftKey) {
            this.scene.controls.enabled = true;
            this.scene.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
            return;
        }
        
        // Handle alt+left mouse for camera rotation
        if (event.button === 0 && event.altKey) {
            this.scene.controls.enabled = true;
            this.scene.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
            return;
        }
        
        // Delegate to current tool
        const handled = this.toolManager.handleMouseDown(event);
        if (!handled && event.button === 0) {
            // If tool didn't handle it and it's left click, enable orbit controls
            this.scene.controls.enabled = true;
            this.scene.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        }
    }

    handleMouseMove(event) {
        event.preventDefault();
        
        this.lastMousePos = { x: event.clientX, y: event.clientY };
        
        // Always delegate to current tool
        this.toolManager.handleMouseMove(event);
    }

    handleMouseUp(event) {
        event.preventDefault();
        
        this.isMouseDown = false;
        this.mouseButton = -1;
        
        // Reset camera controls
        this.scene.controls.mouseButtons.LEFT = null;
        this.scene.controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
        
        // Delegate to current tool
        this.toolManager.handleMouseUp(event);
    }

    handleClick(event) {
        event.preventDefault();
        
        // Only handle if not dragging
        if (!this.isDragging(event)) {
            this.toolManager.handleClick(event);
        }
    }

    handleDoubleClick(event) {
        event.preventDefault();
        this.toolManager.handleDoubleClick(event);
    }

    handleWheel(event) {
        // Let Three.js orbit controls handle zoom
        const handled = this.toolManager.handleWheel(event);
        if (!handled) {
            // Default zoom behavior is handled by OrbitControls
        }
    }

    handleKeyDown(event) {
        // Handle global shortcuts first
        if (this.handleGlobalShortcuts(event)) {
            return;
        }
        
        // Delegate to tool manager
        this.toolManager.handleKeyDown(event);
    }

    handleKeyUp(event) {
        this.toolManager.handleKeyUp(event);
    }

    handleGlobalShortcuts(event) {
        const key = event.key.toLowerCase();
        
        // Save/Load shortcuts
        if (event.ctrlKey || event.metaKey) {
            switch (key) {
                case 's':
                    event.preventDefault();
                    this.saveProject();
                    return true;
                    
                case 'o':
                    event.preventDefault();
                    this.openProject();
                    return true;
                    
                case 'n':
                    event.preventDefault();
                    this.newProject();
                    return true;
                    
                case 'z':
                    event.preventDefault();
                    if (event.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    return true;
                    
                case 'y':
                    event.preventDefault();
                    this.redo();
                    return true;
                    
                case 'd':
                    event.preventDefault();
                    this.duplicateSelected();
                    return true;
                    
                case 'g':
                    event.preventDefault();
                    this.makeComponent();
                    return true;
            }
        }
        
        // View shortcuts
        switch (key) {
            case ' ':
            case 'space':
                event.preventDefault();
                this.resetView();
                return true;
                
            case 'f':
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    this.frameSelected();
                    return true;
                }
                break;
        }
        
        return false;
    }

    // Touch event handlers for mobile support
    handleTouchStart(event) {
        event.preventDefault();
        
        if (event.touches.length === 1) {
            // Single touch - treat as mouse down
            const touch = event.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0
            });
            this.handleMouseDown(mouseEvent);
        }
    }

    handleTouchMove(event) {
        event.preventDefault();
        
        if (event.touches.length === 1) {
            // Single touch - treat as mouse move
            const touch = event.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseMove(mouseEvent);
        }
    }

    handleTouchEnd(event) {
        event.preventDefault();
        
        const mouseEvent = new MouseEvent('mouseup', {
            clientX: this.lastMousePos.x,
            clientY: this.lastMousePos.y,
            button: 0
        });
        this.handleMouseUp(mouseEvent);
    }

    isDragging(event) {
        const threshold = 5; // pixels
        const dx = event.clientX - this.lastMousePos.x;
        const dy = event.clientY - this.lastMousePos.y;
        return Math.sqrt(dx * dx + dy * dy) > threshold;
    }

    // Project management methods (stubs for now)
    saveProject() {
        console.log('Save project - Not yet implemented');
        // TODO: Implement project saving
    }

    openProject() {
        console.log('Open project - Not yet implemented');
        // TODO: Implement project loading
    }

    newProject() {
        console.log('New project - Not yet implemented');
        // TODO: Implement new project
    }

    undo() {
        console.log('Undo - Not yet implemented');
        // TODO: Implement undo system
    }

    redo() {
        console.log('Redo - Not yet implemented');
        // TODO: Implement redo system
    }

    duplicateSelected() {
        // Delegate to main app's duplication functionality
        if (window.modlerApp) {
            window.modlerApp.duplicateSelectedObjects();
        } else {
            console.log('Duplicate selected - App not available');
        }
    }

    makeComponent() {
        console.log('Make component - Not yet implemented');
        // TODO: Implement component creation
    }

    resetView() {
        this.scene.camera.position.set(10, 10, 10);
        this.scene.camera.lookAt(0, 0, 0);
        this.scene.controls.target.set(0, 0, 0);
        this.scene.controls.update();
        console.log('View reset');
    }

    frameSelected() {
        const selected = this.scene.selectionManager.getSelected();
        if (selected.length === 0) return;
        
        // Calculate bounding box of selected objects
        const box = new THREE.Box3();
        selected.forEach(obj => {
            box.expandByObject(obj);
        });
        
        if (box.isEmpty()) return;
        
        // Position camera to frame the selection
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);
        const distance = maxSize * 2;
        
        this.scene.camera.position.copy(center);
        this.scene.camera.position.y += distance;
        this.scene.camera.position.z += distance;
        this.scene.camera.lookAt(center);
        this.scene.controls.target.copy(center);
        this.scene.controls.update();
        
        console.log('Framed selection');
    }

    dispose() {
        // Clean up event listeners if needed
    }
}