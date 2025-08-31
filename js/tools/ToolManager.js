/**
 * Tool Manager - Manages all tools and handles tool switching
 */
class ToolManager {
    constructor(sceneManager, eventManager, selectionManager, geometryManager, highlightManager = null, snapManager = null, materialManager = null, stateManager = null, objectManager = null, configManager = null) {
        this.sceneManager = sceneManager;
        this.eventManager = eventManager;
        this.selectionManager = selectionManager;
        this.geometryManager = geometryManager;
        this.highlightManager = highlightManager;
        this.snapManager = snapManager;
        this.materialManager = materialManager;
        this.stateManager = stateManager;
        this.objectManager = objectManager;
        this.configManager = configManager;
        
        // Tool instances
        this.tools = new Map();
        this.activeTool = null;
        this.toolHistory = [];
        
        this.initializeTools();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupToolbarButtons();
        
        // Default to select tool
        this.switchTool('select');
    }

    initializeTools() {
        // Create tool instances with all centralized managers
        this.tools.set('select', new SelectTool(
            this.sceneManager, 
            this.eventManager, 
            this.selectionManager, 
            this.highlightManager, 
            this.snapManager,
            this.materialManager,
            this.stateManager,
            this.objectManager,
            this.configManager
        ));
        this.tools.set('rectangle', new RectangleTool(
            this.sceneManager, 
            this.eventManager, 
            this.geometryManager, 
            this.selectionManager,
            this.materialManager,
            this.stateManager,
            this.objectManager,
            this.configManager,
            this.highlightManager
        ));
        this.tools.set('push', new PushPullTool(
            this.sceneManager, 
            this.eventManager, 
            this.selectionManager, 
            this.geometryManager,
            this.highlightManager,
            this.snapManager,
            this.materialManager,
            this.stateManager,
            this.objectManager,
            this.configManager
        ));
        this.tools.set('move', new MoveTool(
            this.sceneManager, 
            this.eventManager, 
            this.selectionManager,
            this.highlightManager,
            this.snapManager,
            this.materialManager,
            this.stateManager,
            this.objectManager,
            this.configManager
        ));
        
        // Add more tools as needed
        console.log('Initialized tools:', Array.from(this.tools.keys()));
        if (this.highlightManager) {
            console.log('Tools initialized with centralized HighlightManager');
        }
        if (this.snapManager) {
            console.log('Tools initialized with centralized SnapManager');
        }
    }

    setupEventListeners() {
        // Forward events to active tool and handle camera control based on return values
        this.eventManager.onMouseDown((event, intersectionData) => {
            if (this.activeTool) {
                const shouldPreventCamera = this.activeTool.onMouseDown(event, intersectionData);
                if (shouldPreventCamera) {
                    const app = window.modlerApp;
                    if (app && app.rendererManager) {
                        app.rendererManager.disableControls();
                        console.log('TOOLMANAGER: Camera controls disabled by tool:', this.activeTool.name);
                    }
                }
            }
        });

        this.eventManager.onMouseUp((event, intersectionData, isDragging, wasInteracting) => {
            if (this.activeTool) {
                const shouldPreventCamera = this.activeTool.onMouseUp(event, intersectionData, isDragging, wasInteracting);
                // Always re-enable controls on mouse up unless tool explicitly prevents it
                if (!shouldPreventCamera) {
                    const app = window.modlerApp;
                    if (app && app.rendererManager) {
                        app.rendererManager.enableControlsAgain();
                        console.log('TOOLMANAGER: Camera controls re-enabled after mouse up');
                    }
                }
            }
        });

        this.eventManager.onMouseMove((event, intersectionData) => {
            if (this.activeTool) {
                const shouldPreventCamera = this.activeTool.onMouseMove(event, intersectionData);
                // Handle camera control dynamically during mouse move
                const app = window.modlerApp;
                if (app && app.rendererManager) {
                    if (shouldPreventCamera) {
                        app.rendererManager.disableControls();
                    } else {
                        app.rendererManager.enableControlsAgain();
                    }
                }
            }
        });

        this.eventManager.onKeyDown((event) => {
            // Check for tool shortcuts first
            if (this.handleToolShortcut(event)) {
                return;
            }
            
            // Forward to active tool
            if (this.activeTool) {
                this.activeTool.onKeyDown(event);
            }
        });

        this.eventManager.onKeyUp((event) => {
            if (this.activeTool) {
                this.activeTool.onKeyUp(event);
            }
        });
    }

    setupKeyboardShortcuts() {
        // Tool shortcuts mapping
        this.shortcuts = {
            '1': 'select',
            'v': 'select',
            '2': 'push', 
            'p': 'push',
            '3': 'move',
            'm': 'move',
            '4': 'rotate',
            'r': 'rotate',
            '5': 'rectangle',
            '6': 'circle',
            'c': 'circle'
        };
    }

    setupToolbarButtons() {
        // Setup toolbar button event listeners
        document.querySelectorAll('.tool-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const toolName = button.dataset.tool;
                if (toolName && this.tools.has(toolName)) {
                    this.switchTool(toolName);
                }
            });
        });
    }

    handleToolShortcut(event) {
        // Don't trigger shortcuts when typing in inputs
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return false;
        }
        
        const key = event.key.toLowerCase();
        console.log('TOOLMANAGER: Keyboard shortcut pressed:', key);
        
        if (this.shortcuts[key]) {
            console.log('TOOLMANAGER: Found tool for shortcut:', key, '->', this.shortcuts[key]);
            event.preventDefault();
            this.switchTool(this.shortcuts[key]);
            return true;
        }
        
        console.log('TOOLMANAGER: No tool found for shortcut:', key);
        return false;
    }

    switchTool(toolName) {
        console.log('TOOLMANAGER: switchTool called with:', toolName);
        
        if (!this.tools.has(toolName)) {
            console.warn('TOOLMANAGER: Unknown tool:', toolName);
            return false;
        }

        // Deactivate current tool
        if (this.activeTool) {
            console.log('TOOLMANAGER: Deactivating current tool:', this.activeTool.name);
            this.activeTool.deactivate();
            this.toolHistory.push(this.activeTool.name);
        }
        
        // Clear all temporary highlights when switching tools using centralized system
        if (this.highlightManager) {
            console.log('TOOLMANAGER: highlightManager exists, type:', typeof this.highlightManager);
            console.log('TOOLMANAGER: clearTemporaryHighlights method exists:', typeof this.highlightManager.clearTemporaryHighlights);
            this.highlightManager.clearTemporaryHighlights();
        } else if (this.selectionManager && this.selectionManager.highlightSystem) {
            // Fallback for legacy system
            this.selectionManager.highlightSystem.clearTempHighlights();
        }

        // Activate new tool
        const newTool = this.tools.get(toolName);
        console.log('TOOLMANAGER: Activating new tool:', toolName);
        
        try {
            newTool.activate();
            this.activeTool = newTool;
            console.log('TOOLMANAGER: Successfully activated tool:', toolName);
        } catch (error) {
            console.error('TOOLMANAGER: Failed to activate tool:', toolName, error);
            // Keep the previous tool active if activation fails
            return false;
        }

        // Update UI
        this.updateToolbarUI();
        this.updateStatusBar();

        console.log('TOOLMANAGER: Successfully switched to tool:', toolName);
        return true;
    }

    getActiveTool() {
        return this.activeTool;
    }

    getActiveToolName() {
        return this.activeTool ? this.activeTool.name : null;
    }
    
    getTool(toolName) {
        return this.tools.get(toolName);
    }

    getPreviousTool() {
        return this.toolHistory.length > 0 ? this.toolHistory[this.toolHistory.length - 1] : 'select';
    }

    switchToPreviousTool() {
        if (this.toolHistory.length > 0) {
            const previousTool = this.toolHistory.pop();
            this.switchTool(previousTool);
        }
    }

    updateToolbarUI() {
        // Update toolbar button states
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (this.activeTool) {
            const activeButton = document.querySelector(`[data-tool="${this.activeTool.name}"]`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
    }

    updateStatusBar() {
        if (this.activeTool) {
            const statusText = this.activeTool.getStatusText();
            const statusElement = document.getElementById('tool-status');
            if (statusElement) {
                statusElement.textContent = statusText;
            }
        }
    }

    // Tool state queries
    isToolActive(toolName) {
        return this.activeTool && this.activeTool.name === toolName;
    }

    isAnyToolOperating() {
        return this.activeTool && this.activeTool.isOperating;
    }

    // Cleanup
    dispose() {
        // Deactivate current tool
        if (this.activeTool) {
            this.activeTool.deactivate();
        }

        // Dispose all tools
        this.tools.forEach(tool => {
            if (tool.dispose) {
                tool.dispose();
            }
        });

        this.tools.clear();
        this.activeTool = null;
        this.toolHistory = [];
    }
}

// Export for module use
window.ToolManager = ToolManager;