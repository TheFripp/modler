class BaseTool {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.cursor = 'default';
        this.name = 'BaseTool';
    }

    activate() {
        this.active = true;
        this.setCursor(this.cursor);
        console.log(`${this.name} activated`);
    }

    deactivate() {
        this.active = false;
        this.setCursor('default');
        console.log(`${this.name} deactivated`);
    }

    setCursor(cursor) {
        document.body.style.cursor = cursor;
    }

    // Event handlers to be overridden by subclasses
    onMouseDown(event) {
        return false;
    }

    onMouseMove(event) {
        return false;
    }

    onMouseUp(event) {
        return false;
    }

    onClick(event) {
        return false;
    }

    onDoubleClick(event) {
        return false;
    }

    onKeyDown(event) {
        return false;
    }

    onKeyUp(event) {
        return false;
    }

    onWheel(event) {
        return false;
    }

    // Utility methods
    getCanvasPosition(event) {
        const canvas = this.scene.canvas;
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    getWorldPosition(event) {
        const canvasPos = this.getCanvasPosition(event);
        return this.scene.getGroundPosition(canvasPos.x, canvasPos.y);
    }

    getObjectAt(event) {
        const canvasPos = this.getCanvasPosition(event);
        return this.scene.getObjectAt(canvasPos.x, canvasPos.y);
    }

    isShiftPressed(event) {
        return event.shiftKey;
    }

    isCtrlPressed(event) {
        return event.ctrlKey || event.metaKey;
    }

    isAltPressed(event) {
        return event.altKey;
    }

    // Create standard materials using MaterialManager
    createStandardMaterial(color = 0x888888) {
        return this.materialManager ? 
            this.materialManager.getObjectMaterial(color, { transparent: false }) :
            new THREE.MeshLambertMaterial({
                color: color,
                transparent: false
            });
    }

    createWireframeMaterial(color = 0xffffff) {
        return this.materialManager ? 
            this.materialManager.getWireframeMaterial(color, { opacity: 0.8 }) :
            new THREE.MeshBasicMaterial({
                color: color,
                wireframe: true,
                transparent: true,
                opacity: 0.8
            });
    }

    createPreviewMaterial(color = 0x00ff00) {
        return this.materialManager ? 
            this.materialManager.getMaterial('mesh_basic', { 
                color: color,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            }, 'ui', 'preview') :
            new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
    }

    // Common geometry creation
    createRectangleGeometry(width, height, segments = 1) {
        return new THREE.PlaneGeometry(width, height, segments, segments);
    }

    createCircleGeometry(radius, segments = 32) {
        return new THREE.CircleGeometry(radius, segments);
    }

    createBoxGeometry(width, height, depth) {
        return new THREE.BoxGeometry(width, height, depth);
    }

    createCylinderGeometry(radiusTop, radiusBottom, height, segments = 32) {
        return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
    }

    // Cleanup method
    dispose() {
        if (this.active) {
            this.deactivate();
        }
    }
}

// Export for module use
window.BaseTool = BaseTool;