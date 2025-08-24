/**
 * Scene Manager - Handles 3D scene setup, lighting, camera, and grid
 */
class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.grid = null;
        this.subGrid = null;
        this.floorPlane = null;
        this.lights = [];
        this.sceneSettings = {
            backgroundColor: 0x1a1a1a,
            gridSize: 50,
            gridDivisions: 50,
            subDivisions: 10
        };
        
        // Scene graph management
        this.hierarchyPanel = null;
        this.sceneEventListeners = [];
    }

    init(canvas) {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.sceneSettings.backgroundColor);

        // Setup camera
        const aspect = canvas.clientWidth / canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(15, 15, 15);
        this.camera.lookAt(0, 0, 0);

        // Setup lighting
        this.setupLighting();

        // Create grid and axes
        this.createGrid();

        console.log('Scene initialized');
        return { scene: this.scene, camera: this.camera };
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        this.lights.push(directionalLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-20, 10, -10);
        this.scene.add(fillLight);
        this.lights.push(fillLight);
    }

    createGrid() {
        // Remove existing grids if present
        if (this.grid) {
            this.scene.remove(this.grid);
        }
        if (this.subGrid) {
            this.scene.remove(this.subGrid);
        }

        // Main grid
        this.grid = new THREE.GridHelper(
            this.sceneSettings.gridSize, 
            this.sceneSettings.gridDivisions, 
            0x888888, 
            0x444444
        );
        this.grid.name = 'grid';
        this.grid.userData = { isGrid: true, selectable: false };
        this.grid.renderOrder = -2;
        this.scene.add(this.grid);

        // Sub-grid
        this.subGrid = new THREE.GridHelper(
            this.sceneSettings.gridSize, 
            this.sceneSettings.gridDivisions * (this.sceneSettings.subDivisions || 10), 
            0x333333, 
            0x333333
        );
        this.subGrid.name = 'subgrid';
        this.subGrid.userData = { isGrid: true, selectable: false };
        this.subGrid.renderOrder = -3;
        this.scene.add(this.subGrid);
        
        console.log('SCENE: Grid created - main divisions:', this.sceneSettings.gridDivisions, 'sub divisions:', this.sceneSettings.subDivisions, 'total sub lines:', this.sceneSettings.gridDivisions * this.sceneSettings.subDivisions);

        // Axes
        const axes = new THREE.AxesHelper(5);
        axes.name = 'axes';
        axes.userData = { isAxes: true, selectable: false };
        axes.renderOrder = 100;
        this.scene.add(axes);

        // Floor plane for shadows - ensure it doesn't cast shadows
        if (this.floorPlane) {
            this.scene.remove(this.floorPlane);
        }
        
        const floorGeometry = new THREE.PlaneGeometry(this.sceneSettings.gridSize * 2, this.sceneSettings.gridSize * 2);
        const floorMaterial = new THREE.MeshLambertMaterial({
            color: 0x2a2a2a,
            transparent: true,
            opacity: 0.05,
            side: THREE.DoubleSide
        });
        this.floorPlane = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floorPlane.rotation.x = -Math.PI / 2;
        this.floorPlane.position.y = -0.01;
        this.floorPlane.receiveShadow = false; // Don't receive shadows - objects should be visible under floor
        this.floorPlane.castShadow = false; // Ensure floor doesn't cast shadows
        this.floorPlane.name = 'floor';
        this.floorPlane.userData = { isFloor: true, selectable: false };
        this.scene.add(this.floorPlane);
    }

    updateSettings(settings) {
        Object.assign(this.sceneSettings, settings);
        
        // Update scene background
        this.scene.background = new THREE.Color(this.sceneSettings.backgroundColor);
        
        // Recreate grid with new settings
        this.createGrid();
    }

    updateGridWithSettings(gridSettings) {
        console.log('SCENE: Updating grid with settings:', gridSettings);
        this.sceneSettings.gridSize = gridSettings.size;
        this.sceneSettings.gridDivisions = gridSettings.divisions;
        this.sceneSettings.subDivisions = gridSettings.subDivisions || 10;
        console.log('SCENE: Grid settings updated to:', this.sceneSettings);
        this.createGrid();
    }

    enableShadows(enabled) {
        this.lights.forEach(light => {
            if (light.castShadow !== undefined) {
                light.castShadow = enabled;
            }
        });
        
        // Update all scene objects
        this.scene.traverse(child => {
            if (child.isMesh && child.userData && !child.userData.isGrid && !child.userData.isAxes) {
                child.castShadow = enabled;
                child.receiveShadow = enabled;
            }
        });
    }

    snapToGrid(position) {
        if (!position) return position;
        
        const gridSpacing = this.sceneSettings.gridSize / this.sceneSettings.gridDivisions;
        return new THREE.Vector3(
            Math.round(position.x / gridSpacing) * gridSpacing,
            position.y, // Don't snap Y to allow stacking
            Math.round(position.z / gridSpacing) * gridSpacing
        );
    }

    onWindowResize(canvas) {
        if (this.camera) {
            this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
            this.camera.updateProjectionMatrix();
        }
    }

    // Scene Graph Management
    setHierarchyPanel(hierarchyPanel) {
        this.hierarchyPanel = hierarchyPanel;
    }
    
    addObject(object) {
        this.scene.add(object);
        this.notifyObjectAdded(object);
        console.log(`Added object ${object.userData.id} to scene`);
    }
    
    removeObject(object) {
        // Handle container removal
        if (object.isContainer) {
            // Move children back to scene
            const children = Array.from(object.childObjects);
            children.forEach(child => {
                object.removeChild(child);
                this.scene.add(child);
            });
        }
        
        this.scene.remove(object);
        this.notifyObjectRemoved(object);
        
        // Clean up resources
        if (object.geometry) object.geometry.dispose();
        if (object.material && Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
        } else if (object.material) {
            object.material.dispose();
        }
        
        console.log(`Removed object ${object.userData.id} from scene`);
    }
    
    findObjectById(id) {
        let foundObject = null;
        this.scene.traverse((child) => {
            if (child.userData && child.userData.id !== undefined) {
                // Convert both to strings for comparison to handle type mismatches
                const childId = String(child.userData.id);
                const searchId = String(id);
                
                if (childId === searchId) {
                    foundObject = child;
                }
            }
        });
        return foundObject;
    }
    
    getAllSelectableObjects() {
        const objects = [];
        this.scene.traverse((child) => {
            if (child.userData && child.userData.selectable && child !== this.scene) {
                objects.push(child);
            }
        });
        return objects;
    }
    
    // Event system for hierarchy updates
    notifyObjectAdded(object) {
        if (this.hierarchyPanel) {
            this.hierarchyPanel.onObjectAdded(object);
        }
    }
    
    notifyObjectRemoved(object) {
        if (this.hierarchyPanel) {
            this.hierarchyPanel.onObjectRemoved(object);
        }
    }
    
    notifyObjectChanged(object) {
        if (this.hierarchyPanel) {
            this.hierarchyPanel.onObjectChanged(object);
        }
    }

    dispose() {
        if (this.scene) {
            // Clean up all objects
            while (this.scene.children.length > 0) {
                const child = this.scene.children[0];
                this.scene.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        }
        this.lights = [];
        
        if (this.hierarchyPanel) {
            this.hierarchyPanel.dispose();
            this.hierarchyPanel = null;
        }
    }
}

// Export for module use
window.SceneManager = SceneManager;