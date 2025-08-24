/**
 * Renderer Manager - Handles Three.js renderer setup and controls
 */
class RendererManager {
    constructor() {
        this.renderer = null;
        this.controls = null;
        this.canvas = null;
        this.scene = null;
        this.camera = null;
        this.animationId = null;
    }

    init(canvas, scene, camera) {
        this.canvas = canvas;
        this.scene = scene;
        this.camera = camera;

        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Setup controls
        this.setupControls();

        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));

        console.log('Renderer initialized');
        return this.renderer;
    }

    setupControls() {
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.canvas);
            this.controls.enableDamping = false; // Disable inertia
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 5;
            this.controls.maxDistance = 100;
            this.controls.maxPolarAngle = Math.PI;
            this.controls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            };
            
            console.log('OrbitControls initialized');
        } else {
            console.error('OrbitControls not available');
        }
    }

    addControlsEventListener(event, callback) {
        if (this.controls) {
            this.controls.addEventListener(event, callback);
        }
    }

    enableControls(enabled) {
        if (this.controls) {
            this.controls.enabled = enabled;
        }
    }
    
    disableControls() {
        this.enableControls(false);
    }
    
    enableControlsAgain() {
        this.enableControls(true);
    }

    enableShadows(enabled) {
        if (this.renderer) {
            this.renderer.shadowMap.enabled = enabled;
        }
    }

    handleResize() {
        if (this.canvas && this.camera && this.renderer) {
            this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        }
    }

    startRenderLoop(additionalCallbacks = []) {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            // Update controls
            if (this.controls) {
                this.controls.update();
            }
            
            // Execute additional callbacks
            additionalCallbacks.forEach(callback => callback());
            
            // Render the scene
            this.renderer.render(this.scene, this.camera);
        };

        animate();
    }

    stopRenderLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    dispose() {
        this.stopRenderLoop();
        
        if (this.controls) {
            this.controls.dispose();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        window.removeEventListener('resize', this.handleResize.bind(this));
    }
}

// Export for module use
window.RendererManager = RendererManager;