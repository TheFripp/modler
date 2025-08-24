/**
 * Example Integration - How to integrate the centralized highlight and snap systems
 * 
 * This example shows how to initialize the ModlerApp with the new centralized systems.
 * Place this code in your main application initialization.
 */

// Example of how to initialize ModlerApp with centralized systems
function initializeModlerAppWithCentralizedSystems() {
    // Create scene, camera, renderer (existing code)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas') });
    
    // Initialize core managers (existing)
    const sceneManager = new SceneManager(scene, camera, renderer);
    const eventManager = new EventManager(document.getElementById('canvas'), camera);
    const geometryManager = new GeometryManager(scene);
    const selectionManager = new SelectionManager(scene, camera, document.getElementById('canvas'));
    const grid = new Grid(scene);
    
    // Initialize NEW centralized systems
    const highlightManager = new HighlightManager(
        scene, 
        camera, 
        document.getElementById('canvas'),
        selectionManager.highlightSystem // Pass existing HighlightSystem for compatibility
    );
    
    const snapManager = new SnapManager(
        scene,
        camera,
        document.getElementById('canvas'),
        geometryManager,
        grid
    );
    
    // Initialize ToolManager with centralized systems
    const toolManager = new ToolManager(
        sceneManager,
        eventManager,
        selectionManager,
        geometryManager,
        highlightManager, // NEW: Pass HighlightManager
        snapManager       // NEW: Pass SnapManager
    );
    
    console.log('ModlerApp initialized with centralized highlighting and snapping systems');
    
    return {
        sceneManager,
        eventManager,
        geometryManager,
        selectionManager,
        toolManager,
        highlightManager, // NEW
        snapManager,      // NEW
        grid
    };
}

// For existing applications, you can gradually migrate by:
// 1. Create the centralized managers
// 2. Pass them to ToolManager
// 3. Tools will automatically use centralized systems when available
// 4. Legacy fallback ensures nothing breaks during transition

// Example usage:
// const modlerApp = initializeModlerAppWithCentralizedSystems();
// window.modlerApp = modlerApp; // Make available globally if needed