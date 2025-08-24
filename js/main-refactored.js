/**
 * Modler - Parametric 3D Modeling Application
 * Refactored Architecture
 */

class ModlerApp {
    constructor() {
        console.log('Initializing Modler with refactored architecture...');
        
        // Core systems
        this.canvas = null;
        this.sceneManager = null;
        this.rendererManager = null;
        this.eventManager = null;
        
        // Centralized Managers (NEW)
        this.stateManager = null;
        this.materialManager = null;
        this.objectManager = null;
        this.cameraManager = null;
        this.configManager = null;
        this.highlightManager = null;
        this.snapManager = null;
        
        // Legacy Managers (to be phased out)
        this.geometryManager = null;
        this.selectionManager = null;
        this.toolManager = null;
        this.settingsManager = null;
        this.hierarchyPanel = null;
        
        // Animation
        this.animationId = null;
    }

    init() {
        try {
            console.log('THREE.js version:', THREE.REVISION);
            
            // Get canvas
            this.canvas = document.getElementById('canvas');
            if (!this.canvas) {
                throw new Error('Canvas not found!');
            }

            // Initialize core systems
            this.initializeCore();
            
            // Initialize managers
            this.initializeManagers();
            
            // Setup additional features
            this.setupTestObjects();
            this.setupWindowResize();
            this.setupKeyboardShortcuts();
            this.setupToolbar();
            
            // Load saved settings
            this.loadSavedSettings();
            
            // Start render loop
            this.startRenderLoop();
            
            console.log('Modler initialization complete');
            this.updateStatus('Ready - Use tools to create shapes');
            
        } catch (error) {
            console.error('Modler initialization failed:', error);
            this.updateStatus('Error: Initialization failed');
        }
    }

    initializeCore() {
        // Scene manager
        this.sceneManager = new SceneManager();
        const sceneData = this.sceneManager.init(this.canvas);
        
        // Renderer manager
        this.rendererManager = new RendererManager();
        this.rendererManager.init(this.canvas, sceneData.scene, sceneData.camera);
        
        // Event manager
        this.eventManager = new EventManager(this.canvas, sceneData.camera, sceneData.scene);
        
        console.log('Core systems initialized');
    }

    initializeManagers() {
        // Initialize centralized managers first
        this.stateManager = new StateManager();
        this.materialManager = new MaterialManager();
        this.configManager = new ConfigurationManager(this.stateManager, this.materialManager);
        this.objectManager = new ObjectManager(this.sceneManager, this.materialManager, this.stateManager);
        this.cameraManager = new CameraManager(
            this.sceneManager.camera,
            this.rendererManager.controls,
            this.canvas,
            this.stateManager
        );
        
        // Legacy geometry manager (updated to use MaterialManager)
        this.geometryManager = new GeometryManager(this.sceneManager, this.materialManager);
        
        // Settings manager with centralized dependencies
        this.settingsManager = new SettingsManager(
            this.sceneManager, 
            this.rendererManager,
            this.configManager,
            this.materialManager,
            this.stateManager
        );
        
        // HighlightSystem removed - now using centralized HighlightManager only
        
        // Create centralized highlighting and snapping systems
        this.highlightManager = new HighlightManager(
            this.sceneManager.scene,
            this.sceneManager.camera,
            this.canvas,
            this.materialManager
        );
        
        // Selection manager with centralized highlighting only
        this.selectionManager = new SelectionManager(this.sceneManager, this.highlightManager);
        
        this.snapManager = new SnapManager(
            this.sceneManager.scene,
            this.sceneManager.camera,
            this.canvas,
            this.geometryManager,
            this.sceneManager.grid,
            this.materialManager
        );
        
        // Tool manager with centralized systems
        this.toolManager = new ToolManager(
            this.sceneManager,
            this.eventManager,
            this.selectionManager,
            this.geometryManager,
            this.highlightManager,  // Pass centralized highlight manager
            this.snapManager,       // Pass centralized snap manager
            this.materialManager,   // Pass centralized material manager
            this.stateManager,      // Pass centralized state manager
            this.objectManager,     // Pass centralized object manager
            this.configManager      // Pass centralized config manager
        );
        
        // Hierarchy panel with centralized dependencies
        this.hierarchyPanel = new HierarchyPanel(
            this.sceneManager, 
            this.selectionManager, 
            this.stateManager, 
            this.objectManager,
            this.materialManager
        );
        this.sceneManager.setHierarchyPanel(this.hierarchyPanel);
        
        // Ensure bidirectional selection sync with centralized state
        this.selectionManager.onSelectionChanged = () => {
            console.log('MAIN: Selection changed, updating hierarchy panel');
            this.hierarchyPanel.updateSelection();
            
            // Update centralized state
            if (this.stateManager) {
                const selectedObjects = this.selectionManager.getSelectedObjects();
                const selectedIds = new Set(selectedObjects.map(obj => obj.userData.id));
                this.stateManager.set('selection.objects', selectedIds);
                this.stateManager.set('selection.selectedCount', selectedObjects.length);
                this.stateManager.set('scene.selectedCount', selectedObjects.length);
            }
        };
        
        // Setup coordinate updates
        this.rendererManager.addControlsEventListener('change', () => {
            this.updateCoordinates();
        });
        
        // Setup edge highlight thickness updates on camera movement
        this.rendererManager.addControlsEventListener('change', () => {
            this.highlightManager.updateEdgeHighlightThickness();
        });
        
        console.log('Managers initialized');
    }

    setupTestObjects() {
        // Create some test objects
        const box = this.geometryManager.createBox(2, 1, 3, new THREE.Vector3(-3, 0.5, 0), {
            type: 'test-box'
        });
        box.castShadow = true;
        box.receiveShadow = true;
        
        const rectangle = this.geometryManager.createRectangle(
            2, 2, 
            new THREE.Vector3(3, 0, 0), 
            null, 
            { type: 'test-rectangle' }
        );
        
        console.log('Test objects created');
    }

    setupWindowResize() {
        window.addEventListener('resize', () => {
            this.rendererManager.handleResize();
            this.sceneManager.onWindowResize(this.canvas);
        });
    }

    setupKeyboardShortcuts() {
        this.eventManager.onKeyDown((event) => {
            this.handleGlobalKeyboard(event);
        });
    }

    setupToolbar() {
        // Tool buttons
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const toolName = button.dataset.tool;
                if (toolName && this.toolManager) {
                    console.log('MAIN: Switching to tool:', toolName);
                    this.toolManager.switchTool(toolName);
                    this.updateToolbarUI(toolName);
                }
            });
        });

        console.log('MAIN: Toolbar setup complete, found', toolButtons.length, 'tool buttons');
    }

    updateToolbarUI(activeToolName) {
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeButton = document.querySelector(`[data-tool="${activeToolName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
            console.log('MAIN: Updated toolbar UI, active tool:', activeToolName);
        }
    }

    loadSavedSettings() {
        try {
            if (this.settingsManager && this.stateManager) {
                // Try to load settings from centralized state
                const savedSettings = this.stateManager.get('ui.settings');
                if (savedSettings) {
                    console.log('MAIN: Loading saved UI settings from centralized state');
                    if (this.configManager) {
                        this.configManager.import(savedSettings, true);
                        this.settingsManager.loadUISettingsFromConfig();
                    } else {
                        this.settingsManager.uiSettings = savedSettings;
                        this.settingsManager.loadUISettingsToPanel();
                    }
                    // Apply the loaded settings
                    this.settingsManager.applyUISettings();
                    console.log('MAIN: Successfully loaded and applied saved settings');
                } else {
                    console.log('MAIN: No saved settings found, using defaults');
                }
            }
        } catch (error) {
            console.error('MAIN: Error loading saved settings:', error);
        }
    }

    handleGlobalKeyboard(event) {
        const key = event.key.toLowerCase();
        
        // Check if an input field is focused
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
        
        // Skip shortcuts if input is focused
        if (isInputFocused) {
            return;
        }
        
        // Handle Cmd+D / Ctrl+D for duplication
        if ((event.metaKey || event.ctrlKey) && key === 'd') {
            event.preventDefault();
            this.duplicateSelected();
            return;
        }
    }

    duplicateSelected() {
        const selectedObjects = this.selectionManager.getSelectedObjects();
        if (selectedObjects.length === 0) return;
        
        const newObjects = [];
        const offset = new THREE.Vector3(1, 0, 1); // Offset duplicates slightly
        
        selectedObjects.forEach(object => {
            const duplicate = this.duplicateObject(object);
            if (duplicate) {
                duplicate.position.add(offset);
                newObjects.push(duplicate);
            }
        });
        
        // Select the duplicated objects
        this.selectionManager.clearSelection();
        newObjects.forEach(object => {
            this.selectionManager.addToSelection(object);
        });
        
        console.log(`Duplicated ${newObjects.length} objects`);
    }

    duplicateObject(object) {
        if (object.isContainer) {
            return this.duplicateContainer(object);
        } else {
            return this.duplicateRegularObject(object);
        }
    }

    duplicateContainer(container) {
        // Create new container using centralized systems
        const newContainer = new Container(
            container.name + ' Copy',
            this.objectManager,
            this.materialManager,
            this.sceneManager
        );
        
        // Copy container properties
        newContainer.userData.distributionMode = container.userData.distributionMode;
        newContainer.userData.alignmentMode = container.userData.alignmentMode;
        newContainer.userData.fillMode = { ...container.userData.fillMode };
        
        // Copy position, rotation, scale
        newContainer.position.copy(container.position);
        newContainer.rotation.copy(container.rotation);
        newContainer.scale.copy(container.scale);
        
        // Add to scene using proper method
        this.sceneManager.addObject(newContainer);
        this.geometryManager.objects.set(newContainer.userData.id, newContainer);
        
        // Duplicate all children
        container.getChildren().forEach(child => {
            const duplicatedChild = this.duplicateObject(child);
            if (duplicatedChild) {
                // Remove from scene first (it was auto-added during duplication)
                this.sceneManager.scene.remove(duplicatedChild);
                this.geometryManager.objects.delete(duplicatedChild.userData.id);
                
                // Add as child to container
                newContainer.addChild(duplicatedChild);
            }
        });
        
        console.log(`Duplicated container ${container.userData.id} as ${newContainer.userData.id}`);
        return newContainer;
    }

    duplicateRegularObject(object) {
        // Clone geometry and material
        const newGeometry = object.geometry.clone();
        const newMaterial = object.material.clone();
        
        // Create new mesh
        const newObject = new THREE.Mesh(newGeometry, newMaterial);
        newObject.castShadow = true;
        newObject.receiveShadow = true;
        
        // Copy userData and generate new ID
        newObject.userData = { ...object.userData };
        newObject.userData.id = this.generateObjectId();
        
        // Copy position, rotation, scale
        newObject.position.copy(object.position);
        newObject.rotation.copy(object.rotation);
        newObject.scale.copy(object.scale);
        
        // Add to scene using proper method
        this.sceneManager.addObject(newObject);
        this.geometryManager.objects.set(newObject.userData.id, newObject);
        
        console.log(`Duplicated object ${object.userData.id} as ${newObject.userData.id}`);
        return newObject;
    }

    generateObjectId() {
        return this.objectManager ? 
            this.objectManager.generateId('object') :
            'obj_' + Math.random().toString(36).substr(2, 9);
    }

    startRenderLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            // Update controls
            if (this.rendererManager.controls) {
                this.rendererManager.controls.update();
            }
            
            // Render the scene
            this.rendererManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
        };

        animate();
        console.log('Render loop started');
    }

    updateCoordinates() {
        const controls = this.rendererManager.controls;
        if (controls) {
            const center = controls.target;
            this.selectionManager.updateCoordinates(center);
        }
    }

    updateStatus(message) {
        const statusElement = document.getElementById('tool-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    // Public API for debugging
    debugInfo() {
        console.log('=== MODLER DEBUG INFO ===');
        console.log('Scene objects:', this.sceneManager.scene.children.length);
        console.log('Geometry objects:', this.geometryManager.getAllObjects().length);
        console.log('Selected objects:', this.selectionManager.getSelectedObjects().length);
        console.log('Active tool:', this.toolManager.getActiveToolName());
        console.log('UI Settings:', this.settingsManager.getUISettings());
    }

    cleanupShadowCasters() {
        return this.geometryManager.cleanupLargeObjects();
    }

    // Cleanup
    dispose() {
        // Stop render loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Dispose managers
        if (this.toolManager) this.toolManager.dispose();
        if (this.selectionManager) this.selectionManager.dispose();
        if (this.highlightManager) this.highlightManager.dispose();
        if (this.geometryManager) this.geometryManager.dispose();
        if (this.settingsManager) this.settingsManager.dispose();
        
        // Dispose core systems
        if (this.eventManager) this.eventManager.dispose();
        if (this.rendererManager) this.rendererManager.dispose();
        if (this.sceneManager) this.sceneManager.dispose();
        
        console.log('Modler disposed');
    }
}

// Set up console logging to file for debugging
const logs = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Log to both console and our array
console.log = function(...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const msg = args.join(' ');
    logs.push(`[${timestamp}] LOG: ${msg}`);
    
    // Keep only last 100 logs to prevent memory issues
    if (logs.length > 100) logs.shift();
    
    originalLog.apply(console, args);
};

console.warn = function(...args) {
    const msg = args[0];
    if (typeof msg === 'string' && (
        msg.includes('THREE.WebGLShadowMap') ||
        msg.includes('has no shadow') ||
        msg.includes('shadow') && msg.includes('cast') ||
        msg.includes('BufferGeometry') ||
        msg.includes('bounding') ||
        msg.includes('computeBoundingSphere')
    )) {
        return; // Suppress Three.js spam
    }
    
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const msgStr = args.join(' ');
    logs.push(`[${timestamp}] WARN: ${msgStr}`);
    if (logs.length > 100) logs.shift();
    
    originalWarn.apply(console, args);
};

console.error = function(...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const msg = args.join(' ');
    logs.push(`[${timestamp}] ERROR: ${msg}`);
    if (logs.length > 100) logs.shift();
    
    originalError.apply(console, args);
};

// Add global function to dump logs to file
window.dumpLogs = () => {
    const logContent = logs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modler-debug-logs.txt';
    a.click();
    URL.revokeObjectURL(url);
};

// Global app instance
let modlerApp = null;

// Start the application when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    try {
        modlerApp = new ModlerApp();
        modlerApp.init(); // Actually initialize the app!
        
        // Make available globally for debugging
        window.modlerApp = modlerApp;
        window.debugModler = () => modlerApp.debugInfo();
        window.cleanupShadowCasters = () => modlerApp.cleanupShadowCasters();
        
    } catch (error) {
        console.error('Failed to start Modler:', error);
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (modlerApp) {
        modlerApp.dispose();
    }
});