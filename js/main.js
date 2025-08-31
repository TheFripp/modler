/**
 * Modler - Modern 3D Parametric Modeling Application
 * Class-based architecture with centralized management systems
 */

class ModlerApp {
    constructor() {
        console.log('Initializing Modler Application...');
        
        // Core managers
        this.sceneManager = null;
        this.rendererManager = null;
        this.eventManager = null;
        this.cameraManager = null;
        this.materialManager = null;
        this.stateManager = null;
        this.configManager = null;
        this.objectManager = null;
        this.geometryManager = null;
        this.selectionManager = null;
        this.highlightManager = null;
        this.snapManager = null;
        this.autoLayoutManager = null;
        this.faceDetectionSystem = null;
        
        // UI managers
        this.toolManager = null;
        this.propertyPanelManager = null;
        this.hierarchyPanel = null;
        this.settingsManager = null;
        
        // Application state
        this.isInitialized = false;
        this.canvas = null;
    }

    async init() {
        try {
            console.log('Starting Modler initialization...');
            
            // Initialize core systems
            this.initializeCanvas();
            this.initializeManagers();
            this.initializeUI();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            
            // Start the application
            this.start();
            
            this.isInitialized = true;
            console.log('✅ Modler initialization completed successfully');
            
        } catch (error) {
            console.error('❌ Modler initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    initializeCanvas() {
        this.canvas = document.getElementById('canvas');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
    }

    initializeManagers() {
        console.log('Initializing managers...');
        
        // Core rendering and scene management
        this.sceneManager = new SceneManager();
        this.sceneManager.init(this.canvas); // Initialize the scene with canvas
        
        this.rendererManager = new RendererManager();
        this.rendererManager.init(this.canvas, this.sceneManager.scene, this.sceneManager.camera);
        
        this.eventManager = new EventManager(this.canvas, this.sceneManager.camera, this.sceneManager.scene);
        
        // Configuration and state management (order matters for dependencies)
        this.stateManager = new StateManager();
        this.materialManager = new MaterialManager();
        this.configManager = new ConfigurationManager(this.stateManager, this.materialManager);
        
        this.cameraManager = new CameraManager(this.sceneManager.camera, this.rendererManager.controls, this.canvas, this.stateManager);
        
        // Object management
        this.objectManager = new ObjectManager(this.sceneManager, this.materialManager, this.stateManager);
        
        // Geometry and selection systems
        this.geometryManager = new GeometryManager(
            this.sceneManager,
            this.materialManager,
            this.objectManager,
            this.stateManager
        );
        
        // Highlighting needs to be created before selection manager
        this.highlightManager = new HighlightManager(
            this.sceneManager.scene,
            this.sceneManager.camera,
            this.canvas,
            this.materialManager
        );
        
        this.selectionManager = new SelectionManager(
            this.sceneManager,
            this.highlightManager
        );
        
        // Set the selectionManager reference in highlightManager for centralized face highlight logic
        this.highlightManager.selectionManager = this.selectionManager;
        
        this.snapManager = new SnapManager(
            this.sceneManager.scene,
            this.sceneManager.camera,
            this.canvas,
            this.geometryManager,
            this.sceneManager.grid,
            this.materialManager
        );
        
        // Face detection and auto-layout systems
        this.faceDetectionSystem = new FaceDetectionSystem();
        this.autoLayoutManager = new AutoLayoutManager(
            this.sceneManager,
            this.objectManager,
            this.stateManager,
            this.configManager,
            this.highlightManager
        );
        
        // Connect managers with their dependencies
        this.connectManagers();
        
        console.log('✅ All managers initialized');
    }

    connectManagers() {
        // Managers are already connected through constructor parameters
        // SelectionManager already has HighlightManager
        // ObjectManager already has other dependencies
        
        // Set up cross-manager callbacks
        if (this.objectManager && this.selectionManager) {
            // Connect object manager with selection for updates
            this.objectManager.selectionManager = this.selectionManager;
        }
        
        // Connect scene updates with state persistence
        if (this.stateManager && this.sceneManager) {
            this.sceneManager.onSceneChange = () => {
                this.stateManager.saveState();
            };
        }
        
        // Connect selection changes to property panel updates
        if (this.selectionManager && this.propertyPanelManager) {
            this.selectionManager.onSelectionChanged = () => {
                this.updateUI();
            };
        }
    }

    initializeUI() {
        console.log('Initializing UI systems...');
        
        // Tool management
        this.toolManager = new ToolManager(
            this.sceneManager,
            this.eventManager,
            this.selectionManager,
            this.geometryManager,
            this.highlightManager,
            this.snapManager,
            this.materialManager,
            this.stateManager,
            this.objectManager,
            this.configManager,
            this.autoLayoutManager
        );
        
        // Property panel management
        this.propertyPanelManager = new PropertyPanelManager(
            this.selectionManager,
            this.stateManager,
            this.materialManager
        );
        
        // Hierarchy panel
        this.hierarchyPanel = new HierarchyPanel(
            this.sceneManager,
            this.selectionManager,
            this.stateManager
        );
        
        // Settings management
        this.settingsManager = new SettingsManager(
            this.sceneManager,
            this.rendererManager,
            this.configManager,
            this.materialManager,
            this.stateManager
        );
        
        console.log('✅ UI systems initialized');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Window resize handling
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        // Canvas interaction events are handled by ToolManager
        // Selection events are handled by SelectionManager
        // Property panel events are handled by PropertyPanelManager
        
        console.log('✅ Event listeners configured');
    }

    setupKeyboardShortcuts() {
        console.log('Setting up keyboard shortcuts...');
        
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcut(event);
        });
        
        console.log('✅ Keyboard shortcuts configured');
    }

    handleKeyboardShortcut(event) {
        // Don't handle shortcuts if user is typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const key = event.key;
        const ctrlOrCmd = event.ctrlKey || event.metaKey;
        
        // Tool shortcuts (1-6 keys)
        if (key >= '1' && key <= '6' && !ctrlOrCmd) {
            event.preventDefault();
            const toolMap = {
                '1': 'select',
                '2': 'push',
                '3': 'move',
                '4': 'rotate',
                '5': 'rectangle',
                '6': 'circle'
            };
            
            const tool = toolMap[key];
            if (tool && this.toolManager) {
                this.toolManager.switchTool(tool);
            }
            return;
        }
        
        // Application shortcuts
        switch (key) {
            case 'Delete':
            case 'Backspace':
                event.preventDefault();
                this.deleteSelectedObjects();
                break;
                
            case 'Escape':
                event.preventDefault();
                this.handleEscapeKey();
                break;
                
            case 'f':
            case 'F':
                if (ctrlOrCmd) {
                    event.preventDefault();
                    this.groupSelectedObjects();
                }
                break;
                
            case 'u':
            case 'U':
                if (!ctrlOrCmd) {
                    event.preventDefault();
                    this.toggleSettingsPanel();
                }
                break;
                
            case 'h':
            case 'H':
                if (!ctrlOrCmd) {
                    event.preventDefault();
                    this.toggleHierarchyPanel();
                }
                break;
                
            case 'd':
            case 'D':
                if (ctrlOrCmd) {
                    event.preventDefault();
                    this.duplicateSelectedObjects();
                }
                break;
        }
        
        // Pass keyboard events to current tool
        if (this.toolManager && this.toolManager.currentTool) {
            const handled = this.toolManager.currentTool.handleKeyboard(event);
            if (handled) {
                event.preventDefault();
            }
        }
    }

    deleteSelectedObjects() {
        if (this.selectionManager && this.objectManager) {
            const selectedObjects = this.selectionManager.getSelectedObjects();
            if (selectedObjects.length > 0) {
                selectedObjects.forEach(object => {
                    this.objectManager.removeObject(object);
                });
                this.selectionManager.clearSelection();
                console.log(`Deleted ${selectedObjects.length} object(s)`);
            }
        }
    }

    groupSelectedObjects() {
        if (this.hierarchyPanel) {
            const selectedObjects = this.selectionManager.getSelectedObjects();
            if (selectedObjects.length > 1) {
                console.log(`Grouping ${selectedObjects.length} selected objects`);
                this.hierarchyPanel.createContainerFromSelection();
            } else if (selectedObjects.length === 1) {
                console.log('Cannot group single object - select multiple objects to group');
            } else {
                console.log('No objects selected for grouping');
            }
        }
    }

    duplicateSelectedObjects() {
        if (!this.selectionManager || !this.objectManager) return;
        
        const selectedObjects = this.selectionManager.getSelectedObjects();
        if (selectedObjects.length === 0) {
            console.log('No objects selected for duplication');
            return;
        }
        
        console.log(`Duplicating ${selectedObjects.length} selected object(s)`);
        
        const duplicatedObjects = [];
        const offset = new THREE.Vector3(2, 0, 0); // Offset duplicates to the right
        
        try {
            selectedObjects.forEach(object => {
                const duplicatedObject = this.duplicateObject(object, offset, null);
                if (duplicatedObject) {
                    duplicatedObjects.push(duplicatedObject);
                }
            });
            
            // Clear current selection and select the duplicated objects
            this.selectionManager.clearSelection();
            duplicatedObjects.forEach(obj => {
                this.selectionManager.addToSelection(obj);
            });
            
            // Update hierarchy panel to show duplicated objects
            if (this.hierarchyPanel) {
                this.hierarchyPanel.refresh();
            }
            
            console.log(`Successfully duplicated ${duplicatedObjects.length} object(s)`);
            
        } catch (error) {
            console.error('Failed to duplicate objects:', error);
        }
    }

    duplicateObject(object, offset, parentContainer = null) {
        if (!object || !object.userData) return null;
        
        const metadata = object.userData;
        const type = metadata.type;
        
        // Get the object's world position for proper positioning
        const worldPos = object.getWorldPosition(new THREE.Vector3());
        
        // Create duplication options from original object
        const options = {
            position: {
                x: worldPos.x + offset.x,
                y: worldPos.y + offset.y,
                z: worldPos.z + offset.z
            },
            rotation: {
                x: object.rotation.x || 0,
                y: object.rotation.y || 0,
                z: object.rotation.z || 0
            },
            dimensions: {
                width: metadata.width,
                height: metadata.height,
                depth: metadata.depth
            },
            name: `${metadata.name || type} Copy`,
            userData: (() => {
                const { id, ...metadataWithoutId } = metadata;
                return { 
                    ...metadataWithoutId,
                    parentContainer: parentContainer // Set correct parent
                };
            })()
        };
        
        // Handle container duplication
        if (type === 'container') {
            const duplicatedContainer = this.objectManager.createObject(type, options);
            
            // Container duplication with child objects
            
            // Duplicate all child objects and add them to the new container
            if (object.childObjects && object.childObjects.size > 0) {
                object.childObjects.forEach(child => {
                    // Get child's position relative to original container
                    const childWorldPos = child.getWorldPosition(new THREE.Vector3());
                    const childLocalPos = object.worldToLocal(childWorldPos.clone());
                    
                    // Create duplicated child with position relative to new container
                    const duplicatedChild = this.duplicateObject(child, new THREE.Vector3(0, 0, 0), duplicatedContainer);
                    if (duplicatedChild) {
                        // Remove from scene first (it was added by createObject)
                        this.sceneManager.removeObject(duplicatedChild);
                        
                        // Set local position and add to container
                        duplicatedChild.position.copy(childLocalPos);
                        
                        // Use the correct method name: addChild (not addChildObject)
                        duplicatedContainer.addChild(duplicatedChild);
                    }
                });
            }
            
            return duplicatedContainer;
        } else {
            // Regular object duplication - only add to scene if not being added to a container
            const duplicatedObject = this.objectManager.createObject(type, options);
            
            // If this object will be added to a container, don't keep it in the scene root
            if (parentContainer) {
                this.sceneManager.removeObject(duplicatedObject);
            }
            
            return duplicatedObject;
        }
    }

    handleEscapeKey() {
        // Cancel current tool operation
        if (this.toolManager && this.toolManager.currentTool) {
            if (this.toolManager.currentTool.cancel) {
                this.toolManager.currentTool.cancel();
            }
        }
        
        // Clear selection
        if (this.selectionManager) {
            this.selectionManager.clearSelection();
        }
    }

    toggleSettingsPanel() {
        const panel = document.getElementById('ui-settings-panel');
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
        }
    }

    toggleHierarchyPanel() {
        const panel = document.querySelector('.hierarchy-panel');
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
        }
    }

    handleWindowResize() {
        if (this.rendererManager && this.cameraManager) {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            this.rendererManager.resize(width, height);
            this.cameraManager.updateAspectRatio(width / height);
        }
    }

    start() {
        console.log('Starting render loop...');
        
        // Start the render loop
        this.animate();
        
        // Create test objects for development
        this.createTestObjects();
        
        // Set default tool
        if (this.toolManager) {
            this.toolManager.switchTool('select');
        }
        
        // Show initial UI state
        this.updateUI();
    }

    createTestObjects() {
        if (!this.objectManager || !this.sceneManager) {
            console.warn('Cannot create test objects - managers not available');
            return;
        }

        console.log('Creating test objects...');
        
        try {
            // Create two boxes
            const box1 = this.objectManager.createObject('box', {
                position: { x: -3, y: 0.5, z: 0 },
                dimensions: { width: 2, height: 1, depth: 1.5 },
                name: 'Test Box 1'
            });
            this.sceneManager.addObject(box1);

            const box2 = this.objectManager.createObject('box', {
                position: { x: 3, y: 0.5, z: 0 },
                dimensions: { width: 1.5, height: 2, depth: 1 },
                name: 'Test Box 2'
            });
            this.sceneManager.addObject(box2);

            // Create a rectangle
            const rectangle = this.objectManager.createObject('rectangle', {
                position: { x: 0, y: 0.01, z: 2 },
                dimensions: { width: 3, height: 2, depth: 0.01 },
                name: 'Test Rectangle'
            });
            this.sceneManager.addObject(rectangle);

            console.log('✅ Test objects created successfully');
        } catch (error) {
            console.error('❌ Failed to create test objects:', error);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update camera controls and animations
        if (this.cameraManager) {
            // Update controls (OrbitControls)
            if (this.cameraManager.controls) {
                this.cameraManager.controls.update();
            }
            // Update camera animations
            this.cameraManager.animateCamera();
        }
        
        // Render the scene
        if (this.rendererManager && this.sceneManager && this.rendererManager.renderer) {
            this.rendererManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
        }
    }

    updateUI() {
        // Update property panel if object is selected
        if (this.propertyPanelManager && this.selectionManager) {
            const selectedObjects = this.selectionManager.getSelectedObjects();
            if (selectedObjects.length === 1) {
                this.propertyPanelManager.showObjectProperties(selectedObjects[0]);
            }
        }
        
        // Update hierarchy panel
        if (this.hierarchyPanel) {
            this.hierarchyPanel.refresh();
        }
    }

    handleInitializationError(error) {
        console.error('Failed to initialize Modler:', error);
        
        // Show user-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff6b6b;
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            z-index: 10000;
            max-width: 400px;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <h3>Initialization Error</h3>
            <p>Failed to start Modler application.</p>
            <p><strong>Error:</strong> ${error.message}</p>
            <p>Please check the browser console for details.</p>
        `;
        
        document.body.appendChild(errorDiv);
    }

    // Public API for external access
    getManager(type) {
        switch (type) {
            case 'scene': return this.sceneManager;
            case 'renderer': return this.rendererManager;
            case 'event': return this.eventManager;
            case 'camera': return this.cameraManager;
            case 'material': return this.materialManager;
            case 'state': return this.stateManager;
            case 'config': return this.configManager;
            case 'object': return this.objectManager;
            case 'geometry': return this.geometryManager;
            case 'selection': return this.selectionManager;
            case 'highlight': return this.highlightManager;
            case 'snap': return this.snapManager;
            case 'tool': return this.toolManager;
            default: return null;
        }
    }
}

// Global application instance
let modlerApp = null;

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Modler...');
    
    modlerApp = new ModlerApp();
    window.modlerApp = modlerApp; // Make available globally for debugging
    
    modlerApp.init().catch(error => {
        console.error('Failed to initialize Modler application:', error);
    });
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModlerApp };
}