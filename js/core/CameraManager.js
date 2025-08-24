/**
 * CameraManager - Unified camera operations and viewport control
 * 
 * This manager provides centralized camera management including controls,
 * viewport updates, camera state persistence, and view presets.
 */
class CameraManager {
    constructor(camera, controls, canvas, stateManager) {
        this.camera = camera;
        this.controls = controls;
        this.canvas = canvas;
        this.stateManager = stateManager;
        
        // Camera state
        this.isEnabled = true;
        this.isBlocked = false;
        this.blockingSource = null; // Track what's blocking camera
        
        // View presets
        this.viewPresets = {
            front: { position: { x: 0, y: 0, z: 10 }, target: { x: 0, y: 0, z: 0 } },
            back: { position: { x: 0, y: 0, z: -10 }, target: { x: 0, y: 0, z: 0 } },
            left: { position: { x: -10, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            right: { position: { x: 10, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            top: { position: { x: 0, y: 10, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            bottom: { position: { x: 0, y: -10, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            isometric: { position: { x: 7, y: 7, z: 7 }, target: { x: 0, y: 0, z: 0 } },
            perspective: { position: { x: 10, y: 10, z: 10 }, target: { x: 0, y: 0, z: 0 } }
        };
        
        // Animation settings
        this.animation = {
            duration: 1000, // milliseconds
            easing: 'easeInOutQuart',
            isAnimating: false,
            startTime: 0,
            startPosition: new THREE.Vector3(),
            startTarget: new THREE.Vector3(),
            endPosition: new THREE.Vector3(),
            endTarget: new THREE.Vector3()
        };
        
        // Viewport tracking
        this.viewport = {
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            aspect: canvas.clientWidth / canvas.clientHeight,
            resizeObserver: null
        };
        
        // Setup viewport monitoring
        this.setupViewportMonitoring();
        
        // Setup state synchronization
        this.setupStateSync();
        
        console.log('CAMERA: CameraManager initialized with controls and viewport monitoring');
    }
    
    /**
     * Block camera controls with source tracking
     * @param {string} source - What's blocking the camera (tool name, etc.)
     */
    blockControls(source = 'unknown') {
        if (this.isBlocked && this.blockingSource !== source) {
            console.warn('CAMERA: Controls already blocked by', this.blockingSource, ', now blocked by', source);
        }
        
        this.isBlocked = true;
        this.blockingSource = source;
        this.controls.enabled = false;
        
        this.stateManager.set('scene.cameraBlocked', true);
        console.log('CAMERA: Controls blocked by', source);
    }
    
    /**
     * Unblock camera controls
     * @param {string} source - What's unblocking the camera
     */
    unblockControls(source = 'unknown') {
        if (this.isBlocked && this.blockingSource !== source) {
            console.warn('CAMERA: Controls blocked by', this.blockingSource, ', cannot unblock from', source);
            return;
        }
        
        this.isBlocked = false;
        this.blockingSource = null;
        this.controls.enabled = this.isEnabled;
        
        this.stateManager.set('scene.cameraBlocked', false);
        console.log('CAMERA: Controls unblocked by', source);
    }
    
    /**
     * Enable/disable camera controls globally
     * @param {boolean} enabled - Whether controls should be enabled
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        // Only actually enable if not blocked
        if (!this.isBlocked) {
            this.controls.enabled = enabled;
        }
        
        console.log('CAMERA: Controls', enabled ? 'enabled' : 'disabled');
    }
    
    /**
     * Animate camera to preset view
     * @param {string} preset - View preset name
     * @param {number} duration - Animation duration in ms
     */
    animateToView(preset, duration = null) {
        const view = this.viewPresets[preset];
        if (!view) {
            console.error('CAMERA: Unknown view preset:', preset);
            return;
        }
        
        this.animateToPosition(
            new THREE.Vector3(view.position.x, view.position.y, view.position.z),
            new THREE.Vector3(view.target.x, view.target.y, view.target.z),
            duration
        );
    }
    
    /**
     * Animate camera to specific position and target
     * @param {THREE.Vector3} position - Target camera position
     * @param {THREE.Vector3} target - Target camera look-at point
     * @param {number} duration - Animation duration in ms
     */
    animateToPosition(position, target, duration = null) {
        if (this.animation.isAnimating) {
            console.log('CAMERA: Stopping current animation to start new one');
        }
        
        // Setup animation
        this.animation.duration = duration || this.animation.duration;
        this.animation.isAnimating = true;
        this.animation.startTime = Date.now();
        
        // Store start and end positions
        this.animation.startPosition.copy(this.camera.position);
        this.animation.startTarget.copy(this.controls.target);
        this.animation.endPosition.copy(position);
        this.animation.endTarget.copy(target);
        
        // Start animation loop
        this.animateCamera();
        
        console.log('CAMERA: Started animation to position:', position, 'target:', target);
    }
    
    /**
     * Focus camera on object(s)
     * @param {THREE.Object3D|Array<THREE.Object3D>} objects - Object(s) to focus on
     * @param {number} distance - Distance from object(s)
     */
    focusOnObjects(objects, distance = null) {
        const objectArray = Array.isArray(objects) ? objects : [objects];
        if (objectArray.length === 0) return;
        
        // Calculate bounding box for all objects
        const boundingBox = new THREE.Box3();
        objectArray.forEach(object => {
            boundingBox.expandByObject(object);
        });
        
        // Calculate center and size
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        const size = boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Calculate camera distance
        const fov = this.camera.fov * (Math.PI / 180);
        const cameraDistance = distance || (maxDim / (2 * Math.tan(fov / 2))) * 1.5;
        
        // Position camera
        const direction = this.camera.position.clone().sub(this.controls.target).normalize();
        const newPosition = center.clone().add(direction.multiplyScalar(cameraDistance));
        
        this.animateToPosition(newPosition, center);
    }
    
    /**
     * Fit camera to show all objects in scene
     */
    fitAll() {
        const allObjects = [];
        this.stateManager.get('hierarchy.rootObjects').forEach(id => {
            const object = window.modlerApp?.objectManager?.getObject(id);
            if (object) allObjects.push(object);
        });
        
        if (allObjects.length > 0) {
            this.focusOnObjects(allObjects);
        } else {
            this.animateToView('perspective');
        }
    }
    
    /**
     * Save current camera state
     * @param {string} name - Saved view name
     */
    saveView(name) {
        const view = {
            position: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            },
            target: {
                x: this.controls.target.x,
                y: this.controls.target.y,
                z: this.controls.target.z
            }
        };
        
        this.viewPresets[name] = view;
        console.log('CAMERA: Saved view:', name);
    }
    
    /**
     * Update viewport size
     * @param {number} width - New viewport width
     * @param {number} height - New viewport height
     */
    updateViewport(width, height) {
        this.viewport.width = width;
        this.viewport.height = height;
        this.viewport.aspect = width / height;
        
        // Update camera
        this.camera.aspect = this.viewport.aspect;
        this.camera.updateProjectionMatrix();
        
        // Update state
        this.stateManager.set('scene.viewportSize', { width, height });
        
        console.log('CAMERA: Viewport updated to', width, 'x', height);
    }
    
    /**
     * Get camera vectors for coordinate transformations
     */
    getCameraVectors() {
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        const forward = new THREE.Vector3();
        
        right.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
        up.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
        forward.setFromMatrixColumn(this.camera.matrixWorld, 2).normalize().negate();
        
        return { right, up, forward };
    }
    
    /**
     * Convert screen coordinates to world position
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     * @param {number} depth - Z-depth (0 = near, 1 = far)
     * @returns {THREE.Vector3} World position
     */
    screenToWorld(x, y, depth = 0.5) {
        const mouse = new THREE.Vector2();
        mouse.x = (x / this.viewport.width) * 2 - 1;
        mouse.y = -(y / this.viewport.height) * 2 + 1;
        
        const vector = new THREE.Vector3(mouse.x, mouse.y, depth);
        vector.unproject(this.camera);
        
        return vector;
    }
    
    /**
     * Convert world position to screen coordinates
     * @param {THREE.Vector3} worldPosition - World position
     * @returns {THREE.Vector2} Screen coordinates
     */
    worldToScreen(worldPosition) {
        const screenPosition = worldPosition.clone().project(this.camera);
        
        return new THREE.Vector2(
            (screenPosition.x + 1) * this.viewport.width / 2,
            -(screenPosition.y - 1) * this.viewport.height / 2
        );
    }
    
    // Private methods
    
    animateCamera() {
        if (!this.animation.isAnimating) return;
        
        const elapsed = Date.now() - this.animation.startTime;
        const progress = Math.min(elapsed / this.animation.duration, 1);
        
        // Apply easing
        const eased = this.easeInOutQuart(progress);
        
        // Interpolate position and target
        this.camera.position.lerpVectors(this.animation.startPosition, this.animation.endPosition, eased);
        this.controls.target.lerpVectors(this.animation.startTarget, this.animation.endTarget, eased);
        
        // Update controls
        this.controls.update();
        
        // Update state
        this.updateCameraState();
        
        if (progress < 1) {
            requestAnimationFrame(() => this.animateCamera());
        } else {
            this.animation.isAnimating = false;
            console.log('CAMERA: Animation completed');
        }
    }
    
    easeInOutQuart(t) {
        return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
    }
    
    setupViewportMonitoring() {
        // Use ResizeObserver for accurate viewport tracking
        if (window.ResizeObserver) {
            this.viewport.resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    this.updateViewport(width, height);
                }
            });
            
            this.viewport.resizeObserver.observe(this.canvas);
        } else {
            // Fallback to window resize
            window.addEventListener('resize', () => {
                this.updateViewport(this.canvas.clientWidth, this.canvas.clientHeight);
            });
        }
    }
    
    setupStateSync() {
        // Sync camera position/target to state on controls change
        this.controls.addEventListener('change', () => {
            this.updateCameraState();
        });
        
        // Listen for state changes to update camera
        this.stateManager.subscribe('scene.cameraPosition', (newPos) => {
            if (!this.animation.isAnimating) {
                this.camera.position.set(newPos.x, newPos.y, newPos.z);
            }
        });
        
        this.stateManager.subscribe('scene.cameraTarget', (newTarget) => {
            if (!this.animation.isAnimating) {
                this.controls.target.set(newTarget.x, newTarget.y, newTarget.z);
                this.controls.update();
            }
        });
    }
    
    updateCameraState() {
        if (!this.animation.isAnimating) {
            this.stateManager.update({
                'scene.cameraPosition': {
                    x: this.camera.position.x,
                    y: this.camera.position.y,
                    z: this.camera.position.z
                },
                'scene.cameraTarget': {
                    x: this.controls.target.x,
                    y: this.controls.target.y,
                    z: this.controls.target.z
                }
            });
        }
    }
    
    /**
     * Get camera state summary
     */
    getState() {
        return {
            position: this.camera.position.clone(),
            target: this.controls.target.clone(),
            isEnabled: this.isEnabled,
            isBlocked: this.isBlocked,
            blockingSource: this.blockingSource,
            isAnimating: this.animation.isAnimating,
            viewport: { ...this.viewport }
        };
    }
    
    /**
     * Dispose camera manager and clean up
     */
    dispose() {
        console.log('CAMERA: Disposing CameraManager');
        
        // Stop any ongoing animation
        this.animation.isAnimating = false;
        
        // Clean up resize observer
        if (this.viewport.resizeObserver) {
            this.viewport.resizeObserver.disconnect();
        }
        
        // Final state save
        this.updateCameraState();
    }
}

// Export for module use
window.CameraManager = CameraManager;