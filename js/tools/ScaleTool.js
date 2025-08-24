import { BaseTool } from './BaseTool.js';

export class ScaleTool extends BaseTool {
    constructor(scene) {
        super(scene);
        this.name = 'ScaleTool';
        this.cursor = 'nw-resize';
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
        console.log('ScaleTool: onMouseDown - Not yet implemented');
        return false;
    }

    onMouseMove(event) {
        return false;
    }

    onMouseUp(event) {
        return false;
    }
}