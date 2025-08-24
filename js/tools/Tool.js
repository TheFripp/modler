/**
 * Base Tool Class - All tools inherit from this
 */
class Tool {
    constructor(name, sceneManager, eventManager) {
        this.name = name;
        this.sceneManager = sceneManager;
        this.eventManager = eventManager;
        this.isActive = false;
        this.cursor = 'default';
        
        // Tool state
        this.isOperating = false;
        this.operationData = null;
    }

    // Lifecycle methods - override in subclasses
    activate() {
        this.isActive = true;
        console.log(`${this.name} tool activated`);
        this.updateCursor();
    }

    deactivate() {
        this.isActive = false;
        this.cleanup();
        console.log(`${this.name} tool deactivated`);
    }

    cleanup() {
        // Override in subclasses to clean up any ongoing operations
        this.isOperating = false;
        this.operationData = null;
    }

    // Event handlers - override in subclasses
    onMouseDown(event, intersectionData) {
        // Override in subclasses
    }

    onMouseUp(event, intersectionData, isDragging, wasInteracting) {
        // Override in subclasses
    }

    onMouseMove(event, intersectionData) {
        // Override in subclasses
    }

    onKeyDown(event) {
        // Override in subclasses
    }

    onKeyUp(event) {
        // Override in subclasses
    }

    // Utility methods
    updateCursor() {
        if (this.eventManager.canvas) {
            this.eventManager.canvas.style.cursor = this.cursor;
        }
    }

    updateStatus(message) {
        const statusElement = document.getElementById('tool-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    // Raycasting helpers
    getGroundPosition(event) {
        return this.eventManager.getGroundPosition(event);
    }

    // Object manipulation helpers
    selectObject(object) {
        // This will be handled by SelectionManager
        console.log('Tool requesting object selection:', object.userData.id);
    }

    deselectAll() {
        // This will be handled by SelectionManager
        console.log('Tool requesting deselect all');
    }

    // Abstract methods that subclasses should implement
    getToolbarButton() {
        // Return the toolbar button element for this tool
        return document.querySelector(`[data-tool="${this.name}"]`);
    }

    getStatusText() {
        // Return the status bar text for this tool
        return `${this.name} Tool`;
    }
}

// Export for module use
window.Tool = Tool;