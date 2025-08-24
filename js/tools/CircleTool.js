import { BaseTool } from './BaseTool.js';

export class CircleTool extends BaseTool {
    constructor(scene) {
        super(scene);
        this.name = 'CircleTool';
        this.cursor = 'crosshair';
        
        this.isDrawing = false;
        this.centerPoint = null;
        this.previewMesh = null;
        this.snapToGrid = true;
        this.segments = 32;
    }

    activate() {
        super.activate();
        this.scene.controls.enabled = false;
    }

    deactivate() {
        super.deactivate();
        this.cancelDrawing();
        this.scene.controls.enabled = true;
    }

    onMouseDown(event) {
        if (event.button !== 0) return false; // Only left mouse button

        const worldPos = this.getWorldPosition(event);
        if (!worldPos) return false;

        if (this.snapToGrid) {
            this.centerPoint = this.scene.grid.snapToGrid(worldPos);
        } else {
            this.centerPoint = worldPos.clone();
        }

        this.isDrawing = true;
        this.createPreviewMesh();
        
        return true;
    }

    onMouseMove(event) {
        if (!this.active) return false;

        if (this.isDrawing && this.centerPoint && this.previewMesh) {
            const currentPos = this.getWorldPosition(event);
            if (!currentPos) return false;

            let endPoint = currentPos;
            if (this.snapToGrid) {
                endPoint = this.scene.grid.snapToGrid(currentPos);
            }

            const radius = this.centerPoint.distanceTo(endPoint);
            this.updatePreviewMesh(radius);
        }

        return this.isDrawing;
    }

    onMouseUp(event) {
        if (!this.isDrawing) return false;

        const currentPos = this.getWorldPosition(event);
        if (!currentPos || !this.centerPoint) return false;

        let endPoint = currentPos;
        if (this.snapToGrid) {
            endPoint = this.scene.grid.snapToGrid(currentPos);
        }

        const radius = this.centerPoint.distanceTo(endPoint);

        // Only create circle if it has meaningful size
        if (radius > 0.1) {
            this.createCircle(this.centerPoint, radius);
        }

        this.finishDrawing();
        return true;
    }

    createPreviewMesh() {
        if (this.previewMesh) {
            this.scene.scene.remove(this.previewMesh);
        }

        const geometry = this.createCircleGeometry(1, this.segments);
        const material = this.createPreviewMaterial(0x00ff00);
        
        this.previewMesh = new THREE.Mesh(geometry, material);
        this.previewMesh.rotation.x = -Math.PI / 2; // Lay flat on ground
        this.previewMesh.userData = {
            isPreview: true,
            selectable: false
        };
        
        this.scene.scene.add(this.previewMesh);
    }

    updatePreviewMesh(radius) {
        if (!this.previewMesh || !this.centerPoint) return;

        // Update geometry
        this.previewMesh.geometry.dispose();
        this.previewMesh.geometry = this.createCircleGeometry(radius, this.segments);

        // Update position
        this.previewMesh.position.set(
            this.centerPoint.x, 
            0.01, // Slightly above ground
            this.centerPoint.z
        );
    }

    createCircle(centerPoint, radius) {
        const geometry = this.createCircleGeometry(radius, this.segments);
        const material = this.createStandardMaterial(0xcccccc);
        
        const circle = this.scene.addObject(geometry, material, {
            type: 'circle',
            radius: radius,
            segments: this.segments,
            position: { x: centerPoint.x, y: 0, z: centerPoint.z }
        });

        circle.rotation.x = -Math.PI / 2; // Lay flat on ground
        circle.position.set(centerPoint.x, 0, centerPoint.z);

        // Select the newly created circle
        this.scene.selectionManager.clearSelection();
        this.scene.selectionManager.select(circle);

        console.log(`Created circle: radius ${radius.toFixed(2)}`);
    }

    cancelDrawing() {
        if (this.previewMesh) {
            this.scene.scene.remove(this.previewMesh);
            this.previewMesh.geometry.dispose();
            this.previewMesh.material.dispose();
            this.previewMesh = null;
        }
        
        this.isDrawing = false;
        this.centerPoint = null;
    }

    finishDrawing() {
        this.cancelDrawing();
        // Don't switch tools - allow continuous circle creation
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
                console.log(`Grid snapping: ${this.snapToGrid ? 'ON' : 'OFF'}`);
                return true;
                
            case '+':
            case '=':
                event.preventDefault();
                this.segments = Math.min(64, this.segments + 8);
                console.log(`Circle segments: ${this.segments}`);
                return true;
                
            case '-':
                event.preventDefault();
                this.segments = Math.max(8, this.segments - 8);
                console.log(`Circle segments: ${this.segments}`);
                return true;
        }
        
        return false;
    }

    dispose() {
        super.dispose();
        this.cancelDrawing();
    }
}