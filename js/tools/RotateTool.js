import { BaseTool } from './BaseTool.js';

export class RotateTool extends BaseTool {
    constructor(scene) {
        super(scene);
        this.name = 'RotateTool';
        this.cursor = 'grab';
    }

    activate() {
        super.activate();
        this.scene.controls.enabled = false;
    }

    deactivate() {
        super.deactivate();
        this.scene.controls.enabled = true;
    }

    onMouseDown(event) {
        console.log('RotateTool: onMouseDown - Not yet implemented');
        return false;
    }

    onMouseMove(event) {
        return false;
    }

    onMouseUp(event) {
        return false;
    }
}