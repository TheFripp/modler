// Modler - Parametric 3D Modeling Web App
console.log('Loading Modler...');

// Global application state
let scene, camera, renderer, controls;
let canvas, grid, objects = [], nextObjectId = 1;
let currentTool = 'select';
let selectedObjects = [];
let hoveredObject = null;
let selectedFace = null;
let hoveredFace = null;
let boundingBoxHelpers = new Map();
let isPushPulling = false;
let isMovingObject = false;

// Rectangle creation state
let isCreatingRectangle = false;
let rectangleStartPoint = null;
let rectanglePreview = null;

// Circle creation state
let isCreatingCircle = false;
let circleStartPoint = null;
let circlePreview = null;

// Move tool state
let moveStartPosition = null;
let moveStartMousePosition = null;
let isWholeObjectMove = false;
let wholeObjectMoveData = null;
let snapTarget = null;
let snapHighlight = null;
let snapPreview = null;

// Materials
let standardMaterial, selectionMaterial, hoverMaterial, snapMaterial;
let materialManager;

// Selection modes
const SELECTION_MODE = {
    OBJECT: 'object',
    FACE: 'face'
};
let currentSelectionMode = SELECTION_MODE.OBJECT;

// Track last changed property for Tab navigation
let lastChangedProperty = null;

// UI Settings with defaults
let uiSettings = {
    background: {
        color: '#1a1a1a'
    },
    grid: {
        size: 50,
        divisions: 50,
        mainColor: '#666666',
        subColor: '#333333'
    },
    selection: {
        edgeColor: '#0078d4',
        thickness: 2,
        cornerSize: 0.05,
        hitAreaSize: 24
    },
    highlights: {
        hoverColor: '#ff6600',
        snapColor: '#00ff00',
        thickness: 1
    },
    rendering: {
        shadowsEnabled: true,
        wireframeMode: false
    }
};

// Scene settings
let sceneSettings = {
    backgroundColor: 0x1a1a1a,
    gridSize: 50,
    gridDivisions: 5
};

// Initialize the application
function init() {
    console.log('Initializing Modler...');
    console.log('THREE.js version:', THREE.REVISION);
    
    // Get canvas
    canvas = document.getElementById('canvas');
    if (!canvas) {
        console.error('Canvas not found!');
        return;
    }
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    
    // Camera
    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        antialias: true 
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;
        controls.minDistance = 5;
        controls.maxDistance = 100;
        controls.maxPolarAngle = Math.PI;
        
        controls.addEventListener('change', updateCoordinates);
        controls.addEventListener('change', updateEdgeHighlightThickness);
        console.log('OrbitControls initialized');
        updateStatus('Mouse navigation ready');
    } else {
        console.error('OrbitControls not available');
        updateStatus('Error: Mouse controls not loaded');
    }
    
    // Materials
    materialManager = new MaterialManager();
    setupMaterials();
    
    // Lighting
    setupLighting();
    
    // Grid and floor
    createGrid();
    
    // Test objects
    createTestObjects();
    
    // UI setup
    setupUI();
    
    // Event listeners
    setupEventListeners();
    
    console.log('Modler initialization complete');
    updateStatus('Ready - Use tools to create shapes');
    
    // Clean up any problematic shadow casters that may exist
    setTimeout(() => {
        cleanupShadowCasters();
    }, 1000);
}

function setupMaterials() {
    // Standard object material
    if (materialManager) {
        standardMaterial = materialManager.getMaterial('mesh_lambert', { color: 0xaaaaaa }, 'objects', 'default'); // Light grey
    } else {
        standardMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaaaa }); // Light grey
    }
    
    // Selection material
    if (materialManager) {
        selectionMaterial = materialManager.getMaterial('mesh_lambert', { 
            transparent: true, 
            opacity: 0.7 
        }, 'highlights', 'selection');
    } else {
        selectionMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x0078d4, 
            transparent: true, 
            opacity: 0.7 
        });
    }
    
    // Hover material
    if (materialManager) {
        hoverMaterial = materialManager.getMaterial('mesh_lambert', { 
            color: 0x00ff00,
            transparent: true, 
            opacity: 0.5 
        }, 'highlights', 'hover');
    } else {
        hoverMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.5 
        });
    }
    
    // Snap target material for face highlighting during move
    if (materialManager) {
        snapMaterial = materialManager.getMaterial('mesh_lambert', {
            color: 0xff6600,  // Orange for snap targets
            transparent: true,
            opacity: 0.6
        }, 'highlights', 'temporary');
    } else {
        snapMaterial = new THREE.MeshLambertMaterial({
            color: 0xff6600,  // Orange for snap targets
            transparent: true,
            opacity: 0.6
        });
    }
}

function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-20, 10, -10);
    scene.add(fillLight);
}

function createGrid() {
    // Main grid
    grid = new THREE.GridHelper(sceneSettings.gridSize, sceneSettings.gridDivisions, 0x888888, 0x444444);
    grid.name = 'grid';
    grid.userData = { isGrid: true, selectable: false };
    grid.renderOrder = -2;
    scene.add(grid);
    
    // Sub-grid
    const subGrid = new THREE.GridHelper(sceneSettings.gridSize, sceneSettings.gridDivisions * 10, 0x333333, 0x333333);
    subGrid.name = 'subgrid';
    subGrid.userData = { isGrid: true, selectable: false };
    subGrid.renderOrder = -3;
    scene.add(subGrid);
    
    // Axes
    const axes = new THREE.AxesHelper(5);
    axes.name = 'axes';
    axes.userData = { isAxes: true, selectable: false };
    axes.renderOrder = 100; // Render on top
    scene.add(axes);
    
    // Floor plane
    const floorGeometry = new THREE.PlaneGeometry(sceneSettings.gridSize * 2, sceneSettings.gridSize * 2);
    const floorMaterial = new THREE.MeshLambertMaterial({
        color: 0x2a2a2a,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.name = 'floor';
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02; // Below grid
    floor.receiveShadow = true;
    floor.userData = { isFloor: true, selectable: false };
    floor.renderOrder = -4;
    scene.add(floor);
    
    console.log('Grid and floor created');
}

function createTestObjects() {
    // Light grey test cube
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cube = addObject(cubeGeometry, standardMaterial.clone(), {
        type: 'test-cube',
        name: 'Test Cube'
    });
    cube.position.set(0, 1.01, 0); // Slightly above grid to prevent z-fighting
    
    console.log('Test cube created');
}

function addObject(geometry, material, userData = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
        id: nextObjectId++,
        selectable: true,
        originalMaterial: material,
        ...userData
    };
    
    // Check for extremely large geometries
    const params = geometry.parameters || {};
    const maxDim = Math.max(params.width || 0, params.height || 0, params.depth || 0, params.radius || 0);
    if (maxDim > 20) {
        console.warn('Creating large object that may cause shadow issues:', {
            id: mesh.userData.id,
            type: userData.type,
            geometry: geometry.type,
            maxDimension: maxDim,
            parameters: params
        });
    }
    
    console.log('Adding object with ID:', mesh.userData.id, 'type:', userData.type || 'unknown', 'geometry:', geometry.type);
    
    scene.add(mesh);
    objects.push(mesh);
    
    return mesh;
}

function setupUI() {
    // Tool buttons
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            setTool(button.dataset.tool);
        });
    });
    
    // Scene settings
    const sceneSettingsBtn = document.getElementById('scene-settings-btn');
    const sceneSettingsPanel = document.getElementById('scene-settings-panel');
    const sceneSettingsClose = document.getElementById('scene-settings-close');
    
    // UI Settings
    const toolSettingsBtn = document.getElementById('tool-settings');
    const uiSettingsPanel = document.getElementById('ui-settings-panel');
    const uiSettingsClose = document.getElementById('ui-settings-close');
    
    if (sceneSettingsBtn && sceneSettingsPanel) {
        sceneSettingsBtn.addEventListener('click', () => {
            sceneSettingsPanel.style.display = 'block';
        });
        
        sceneSettingsClose.addEventListener('click', () => {
            sceneSettingsPanel.style.display = 'none';
        });
    }
    
    // UI Settings panel
    if (toolSettingsBtn && uiSettingsPanel) {
        toolSettingsBtn.addEventListener('click', () => {
            uiSettingsPanel.style.display = 'block';
            loadUISettingsToPanel();
        });
    }
    
    if (uiSettingsClose) {
        uiSettingsClose.addEventListener('click', () => {
            uiSettingsPanel.style.display = 'none';
        });
    }
    
    // UI Settings controls
    const saveSettingsBtn = document.getElementById('save-settings');
    const loadSettingsBtn = document.getElementById('load-settings');
    const resetSettingsBtn = document.getElementById('reset-settings');
    
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveUISettings);
    }
    
    if (loadSettingsBtn) {
        loadSettingsBtn.addEventListener('click', loadUISettings);
    }
    
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', resetUISettings);
    }
    
    // Add change listeners to UI settings inputs
    setupUISettingsInputs();
    
    if (sceneSettingsBtn && sceneSettingsPanel) {
        // Background color
        const bgColorInput = document.getElementById('bg-color');
        if (bgColorInput) {
            bgColorInput.addEventListener('change', (e) => {
                const color = new THREE.Color(e.target.value);
                scene.background = color;
                sceneSettings.backgroundColor = color.getHex();
            });
        }
        
        // Grid settings
        const gridSizeInput = document.getElementById('grid-size');
        const gridDivisionsInput = document.getElementById('grid-divisions');
        
        if (gridSizeInput) {
            gridSizeInput.addEventListener('change', (e) => {
                sceneSettings.gridSize = parseFloat(e.target.value) || 50;
                updateGrid();
            });
        }
        
        if (gridDivisionsInput) {
            gridDivisionsInput.addEventListener('change', (e) => {
                sceneSettings.gridDivisions = parseFloat(e.target.value) || 50;
                updateGrid();
            });
        }
    }
    
    console.log('UI setup complete');
}

function updateGrid() {
    // Remove existing grid elements
    const existingGrid = scene.getObjectByName('grid');
    const existingSubGrid = scene.getObjectByName('subgrid');
    const existingFloor = scene.getObjectByName('floor');
    
    if (existingGrid) scene.remove(existingGrid);
    if (existingSubGrid) scene.remove(existingSubGrid);
    if (existingFloor) scene.remove(existingFloor);
    
    // Recreate grid with new settings
    createGrid();
}

function setupEventListeners() {
    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    // Canvas events
    canvas.addEventListener('click', handleCanvasClick);
    // canvas.addEventListener('dblclick', handleCanvasDoubleClick); // Removed double-click face selection
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);
    
    console.log('Event listeners setup complete');
}

function setTool(toolName) {
    // Clean up any ongoing operations when switching tools
    if (isCreatingRectangle) {
        cancelRectangleCreation();
    }
    if (isCreatingCircle) {
        cancelCircleCreation();
    }
    if (isPushPulling) {
        endInteractivePushPull();
    }
    if (isWholeObjectMove) {
        endWholeObjectMove();
    }
    if (isFaceConstrainedMove) {
        endFaceConstrainedMove();
    }
    
    currentTool = toolName;
    
    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeButton = document.querySelector(`[data-tool="${toolName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Update status
    const toolNames = {
        'select': 'Select Tool',
        'rectangle': 'Rectangle Tool',
        'circle': 'Circle Tool',
        'push': 'Push/Pull Tool',
        'move': 'Move Tool',
        'rotate': 'Rotate Tool'
    };
    
    const statusEl = document.getElementById('tool-status');
    if (statusEl) {
        statusEl.textContent = toolNames[toolName] || 'Unknown Tool';
    }
    
    console.log('Tool changed to:', toolName);
}

function handleCanvasClick(event) {
    // Safety: force clear any stuck interaction states
    if (isMovingObject && selectedObjects.length === 0) {
        console.log('Safety: clearing stuck move state');
        isMovingObject = false;
        controls.enabled = true;
        canvas.style.cursor = 'default';
    }
    
    // Don't process click if we just finished an interaction
    if (wasInteracting) {
        wasInteracting = false;
        return;
    }
    
    // Don't process click if it was a drag (camera orbit)
    if (isDragging) {
        isDragging = false;
        mouseDownPosition = null;
        return;
    }
    
    const intersectionData = getIntersectionAtMouse(event);
    
    // All tools can select objects and interact with faces
    if (intersectionData && intersectionData.object.userData.selectable) {
        // Select object first if not already selected
        if (!selectedObjects.includes(intersectionData.object)) {
            clearSelection();
            selectObject(intersectionData.object);
        }
        
        // Tool-specific face interaction
        if (currentTool === 'push' && canPushPullFace(intersectionData.object, intersectionData.face)) {
            selectFace(intersectionData);
            console.log('Face selected for push/pull');
        }
    } else if (!event.shiftKey) {
        // Only deselect on empty click, not drag
        clearSelection();
        controls.enabled = true;
        canvas.style.cursor = 'default';
    }
    
    // Reset drag tracking
    mouseDownPosition = null;
    isDragging = false;
}

// Removed handleCanvasDoubleClick - no longer using double-click for face selection

function handleCanvasMouseDown(event) {
    if (event.button !== 0) return; // Only left mouse button
    
    // Track mouse down position to detect drag vs click
    const rect = canvas.getBoundingClientRect();
    mouseDownPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
    isDragging = false;
    
    if (currentTool === 'rectangle') {
        startRectangleCreation(event);
        return;
    } else if (currentTool === 'circle') {
        startCircleCreation(event);
        return;
    } else if (currentTool === 'move') {
        const intersectionData = getIntersectionAtMouse(event);
        if (intersectionData && selectedObjects.includes(intersectionData.object)) {
            const edgeCornerResult = detectEdgesAndCorners(intersectionData, null);
            
            if (edgeCornerResult) {
                // Corner or edge grabbing - move whole object
                startWholeObjectMove(event, edgeCornerResult);
                return;
            } else if (canPushPullFace(intersectionData.object, intersectionData.face)) {
                // Face grabbing - face-constrained movement
                if (hoveredFace || selectedFace) {
                    startFaceConstrainedMove(event);
                }
                return;
            }
        }
        // No valid target for move tool
        return;
    } else if (currentTool === 'push') {
        // If we're hovering over a face that can be pushed, start immediately
        if (hoveredFace && canPushPullFace(hoveredFace.object, hoveredFace.face)) {
            // Always use the hovered face for push/pull
            selectFace(hoveredFace);
            startInteractivePushPull(event);
            return;
        }
    }
    
    // If we have a selected face and we're hovering over it, start push/pull
    if (selectedFace && hoveredFace && hoveredFace.object === selectedFace.object) {
        startInteractivePushPull(event);
        return;
    }
}

function handleCanvasMouseUp(event) {
    if (isPushPulling) {
        endInteractivePushPull();
    } else if (isCreatingRectangle) {
        endRectangleCreation(event);
    } else if (isCreatingCircle) {
        endCircleCreation(event);
    } else if (isMovingObject) {
        endObjectMove(event);
    } else if (isFaceConstrainedMove) {
        endFaceConstrainedMove(event);
    } else if (isWholeObjectMove) {
        endWholeObjectMove(event);
    }
}

function handleCanvasMouseMove(event) {
    // Check if we're dragging (mouse has moved significantly since mousedown)
    if (mouseDownPosition && !isDragging) {
        const rect = canvas.getBoundingClientRect();
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;
        const deltaX = currentX - mouseDownPosition.x;
        const deltaY = currentY - mouseDownPosition.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 5) { // 5 pixel threshold for drag detection
            isDragging = true;
        }
    }
    
    if (isPushPulling) {
        updateInteractivePushPull(event);
        return;
    } else if (isCreatingRectangle) {
        updateRectangleCreation(event);
        return;
    } else if (isCreatingCircle) {
        updateCircleCreation(event);
        return;
    } else if (isMovingObject) {
        updateObjectMove(event);
        return;
    } else if (isFaceConstrainedMove) {
        updateFaceConstrainedMove(event);
        return;
    } else if (isWholeObjectMove) {
        updateWholeObjectMove(event);
        return;
    }
    
    // All tools should provide hover feedback
    const intersectionData = getIntersectionAtMouse(event);
    updateHoverFeedback(intersectionData);
}

function getIntersectionAtMouse(event) {
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const selectableObjects = objects.filter(obj => obj.userData.selectable);
    console.log('Selectable objects:', selectableObjects.map(obj => ({id: obj.userData.id, type: obj.userData.type})));
    const intersects = raycaster.intersectObjects(selectableObjects);
    
    if (intersects.length > 0) {
        const intersection = intersects[0];
        
        // Transform face normal from local to world space to account for object rotation
        let worldNormal = null;
        if (intersection.face && intersection.face.normal) {
            worldNormal = intersection.face.normal.clone();
            worldNormal.transformDirection(intersection.object.matrixWorld);
            worldNormal.normalize();
        }
        
        return {
            object: intersection.object,
            point: intersection.point,
            face: intersection.face,
            faceIndex: intersection.faceIndex,
            normal: intersection.face ? intersection.face.normal : null,
            worldNormal: worldNormal
        };
    }
    
    return null;
}

function getObjectAtMouse(event) {
    const intersectionData = getIntersectionAtMouse(event);
    return intersectionData ? intersectionData.object : null;
}

function updateHoverFeedback(intersectionData) {
    // Clear previous face hover
    clearFaceHover();
    
    // Manage camera controls based on hover state
    if (selectedFace) {
        if (intersectionData && intersectionData.object === selectedFace.object) {
            // Hovering over selected object - disable camera controls
            controls.enabled = false;
        } else {
            // Not hovering over selected object - enable camera controls
            controls.enabled = true;
        }
    } else {
        // No face selected - always enable camera controls
        controls.enabled = true;
    }
    
    if (!intersectionData) {
        // No object hovered
        setHoverObject(null);
        canvas.style.cursor = selectedFace ? 'default' : 'default';
        return;
    }
    
    const object = intersectionData.object;
    
    // Check for edge/corner detection with rectangle tool or move tool
    const edgeCornerResult = detectEdgesAndCorners(intersectionData, null);
    
    // Debug edge/corner detection for move tool
    if (currentTool === 'move' && intersectionData) {
        console.log('Move tool hover - object:', object.userData.id, 'edgeCornerResult:', edgeCornerResult?.type || 'none');
    }
    
    // For move tool, show edge/corner highlighting
    if (currentTool === 'move' && edgeCornerResult) {
        // Only show on selected objects when not dragging, or on any object when dragging for snap targets
        const isDragging = isWholeObjectMove || isFaceConstrainedMove;
        const shouldHighlight = selectedObjects.includes(object) || isDragging;
        
        if (shouldHighlight) {
            if (edgeCornerResult.type === 'corner') {
                highlightCorner(edgeCornerResult.data);
                canvas.style.cursor = selectedObjects.includes(object) ? 'move' : 'pointer';
                console.log('Move tool: highlighting corner on object:', object.userData.id, 'selected:', selectedObjects.includes(object));
            } else if (edgeCornerResult.type === 'edge') {
                highlightEdge(edgeCornerResult.data);
                canvas.style.cursor = selectedObjects.includes(object) ? 'move' : 'pointer';
                console.log('Move tool: highlighting edge on object:', object.userData.id, 'selected:', selectedObjects.includes(object));
            }
            return; // Don't process face highlighting if edge/corner is detected
        }
    }
    
    // Highlight faces for different tools (but not if edge/corner is detected)
    if (!edgeCornerResult && 
        ((selectedObjects.includes(object) && canPushPullFace(object, intersectionData.face)) ||
        (currentTool === 'rectangle' && canPushPullFace(object, intersectionData.face)) ||
        (currentTool === 'move' && canPushPullFace(object, intersectionData.face)))) {
        hoveredFace = { 
            object, 
            face: intersectionData.face, 
            faceIndex: intersectionData.faceIndex,
            point: intersectionData.point,
            normal: intersectionData.normal,
            worldNormal: intersectionData.worldNormal
        };
        highlightFace(hoveredFace);
        
        // Set cursor based on current tool
        if (currentTool === 'push') {
            canvas.style.cursor = 'grab'; // Push/pull cursor
        } else if (currentTool === 'move') {
            canvas.style.cursor = 'move'; // Move along face normal
        } else if (currentTool === 'rectangle') {
            canvas.style.cursor = 'crosshair'; // Rectangle creation cursor
        } else {
            canvas.style.cursor = 'pointer'; 
        }
    } else if (edgeCornerResult) {
        // Edge or corner detected - clear face highlighting and set appropriate cursor
        clearFaceHover();
        canvas.style.cursor = 'crosshair'; // Snap cursor
    } else if (selectedObjects.includes(object)) {
        canvas.style.cursor = 'move'; // Move cursor for selected objects
    } else {
        canvas.style.cursor = 'pointer'; // Selection cursor
    }
    
    setHoverObject(object);
}

function highlightFace(faceData) {
    if (!faceData || !faceData.face) return;
    
    const object = faceData.object;
    const face = faceData.face;
    
    // Remove existing highlight
    if (object.faceHighlight) {
        scene.remove(object.faceHighlight);
        object.faceHighlight.geometry.dispose();
        object.faceHighlight.material.dispose();
        object.faceHighlight = null;
    }
    
    // Create face highlight overlay with subtle blue 10% opacity
    const faceGeometry = createFaceGeometry(object, face);
    const faceMaterial = new THREE.MeshBasicMaterial({
        color: 0x0078d4, // Blue color
        transparent: true,
        opacity: 0.1, // Very subtle 10% opacity
        side: THREE.DoubleSide,
        depthTest: false // Render on top
    });
    
    const faceHighlight = new THREE.Mesh(faceGeometry, faceMaterial);
    faceHighlight.userData = { isFaceHighlight: true, selectable: false };
    faceHighlight.renderOrder = 50;
    
    // Position and orient the highlight based on face normal
    positionFaceHighlight(faceHighlight, object, face, faceData.worldNormal);
    
    // Add to scene instead of object to avoid transform issues
    scene.add(faceHighlight);
    object.faceHighlight = faceHighlight;
}

function positionFaceHighlight(highlight, object, face, worldNormal) {
    if (!face || !face.normal) return;
    
    const userData = object.userData;
    const width = userData.width || 2;
    const height = userData.height || 2;
    const depth = userData.depth || 2;
    
    // Copy object position and rotation
    highlight.position.copy(object.position);
    highlight.rotation.copy(object.rotation);
    
    // Use world normal if provided, otherwise transform local normal
    let normal = worldNormal;
    if (!normal) {
        normal = face.normal.clone();
        normal.transformDirection(object.matrixWorld);
        normal.normalize();
    }
    
    const offset = 0.005; // Smaller offset to be closer to the face
    
    if (object.geometry instanceof THREE.BoxGeometry) {
        // Position on the correct face of the box using world normal
        if (Math.abs(normal.y) > 0.9) {
            // Top or bottom face in world space
            highlight.rotation.x = normal.y > 0 ? -Math.PI / 2 : Math.PI / 2;
            highlight.position.y += normal.y > 0 ? (height / 2 + offset) : (-height / 2 - offset);
        } else if (Math.abs(normal.x) > 0.9) {
            // Left or right face in world space
            highlight.rotation.y = normal.x > 0 ? Math.PI / 2 : -Math.PI / 2;
            highlight.position.x += normal.x > 0 ? (width / 2 + offset) : (-width / 2 - offset);
        } else if (Math.abs(normal.z) > 0.9) {
            // Front or back face in world space
            highlight.rotation.y = normal.z > 0 ? 0 : Math.PI;
            highlight.position.z += normal.z > 0 ? (depth / 2 + offset) : (-depth / 2 - offset);
        }
    } else if (object.geometry instanceof THREE.PlaneGeometry) {
        // For plane geometry, position slightly above
        if (Math.abs(normal.y) > 0.9) {
            highlight.position.y += normal.y > 0 ? offset : -offset;
        } else {
            // Plane is rotated, use the normal direction
            highlight.position.add(normal.clone().multiplyScalar(offset));
        }
    }
}

function clearFaceHover() {
    if (hoveredFace && hoveredFace.object && hoveredFace.object.faceHighlight) {
        scene.remove(hoveredFace.object.faceHighlight);
        hoveredFace.object.faceHighlight.geometry.dispose();
        hoveredFace.object.faceHighlight.material.dispose();
        hoveredFace.object.faceHighlight = null;
    }
    hoveredFace = null;
}

function clearAllHighlights() {
    // Clear all face highlights from all objects
    objects.forEach(obj => {
        if (obj.faceHighlight) {
            scene.remove(obj.faceHighlight);
            obj.faceHighlight.geometry.dispose();
            obj.faceHighlight.material.dispose();
            obj.faceHighlight = null;
        }
        if (obj.selectedFaceHighlight) {
            scene.remove(obj.selectedFaceHighlight);
            obj.selectedFaceHighlight.geometry.dispose();
            obj.selectedFaceHighlight.material.dispose();
            obj.selectedFaceHighlight = null;
        }
    });
    
    // Also clean up any orphaned highlights in the scene
    const highlightsToRemove = [];
    scene.traverse(child => {
        if (child.userData && (child.userData.isFaceHighlight || child.userData.isSelectedFaceHighlight)) {
            highlightsToRemove.push(child);
        }
    });
    
    highlightsToRemove.forEach(highlight => {
        scene.remove(highlight);
        if (highlight.geometry) highlight.geometry.dispose();
        if (highlight.material) highlight.material.dispose();
    });
}

function createFaceGeometry(object, face) {
    if (object.geometry instanceof THREE.BoxGeometry) {
        const userData = object.userData;
        const width = userData.width || 2;
        const height = userData.height || 2;
        const depth = userData.depth || 2;
        
        // Create face geometry based on face normal - exact size, no stretching
        if (face && face.normal) {
            const normal = face.normal.clone();
            
            // Determine which face we're on based on normal direction
            if (Math.abs(normal.y) > 0.9) {
                // Top or bottom face
                return new THREE.PlaneGeometry(width, depth);
            } else if (Math.abs(normal.x) > 0.9) {
                // Left or right face  
                return new THREE.PlaneGeometry(depth, height);
            } else if (Math.abs(normal.z) > 0.9) {
                // Front or back face
                return new THREE.PlaneGeometry(width, height);
            }
        }
        
        // Default to largest face if normal detection fails
        return new THREE.PlaneGeometry(Math.max(width, depth), height);
        
    } else if (object.geometry instanceof THREE.PlaneGeometry) {
        const userData = object.userData;
        const width = userData.width || 2;
        const height = userData.height || 2;
        return new THREE.PlaneGeometry(width, height);
    }
    
    return new THREE.PlaneGeometry(1, 1);
}

function canPushPullFace(object, face) {
    if (!face) return false;
    
    // Allow push/pull on box, plane, cylinder, and circle geometries
    return object.geometry instanceof THREE.BoxGeometry || 
           object.geometry instanceof THREE.PlaneGeometry ||
           object.geometry instanceof THREE.CylinderGeometry ||
           object.geometry instanceof THREE.CircleGeometry;
}

function selectFace(intersectionData) {
    selectedFace = {
        object: intersectionData.object,
        face: intersectionData.face,
        faceIndex: intersectionData.faceIndex,
        normal: intersectionData.normal,
        worldNormal: intersectionData.worldNormal,
        point: intersectionData.point
    };
    
    // Keep the object selected when selecting a face
    if (!selectedObjects.includes(intersectionData.object)) {
        clearObjectSelection();
        selectObject(intersectionData.object);
    }
    
    // Clear any existing hover highlight
    clearFaceHover();
    
    // Show selected face highlight (different from hover)
    highlightSelectedFace(selectedFace);
    
    console.log('Face selected for push/pull');
    // Properties panel will show object properties since object is still selected
}

function highlightSelectedFace(faceData) {
    if (!faceData || !faceData.face) return;
    
    const object = faceData.object;
    const face = faceData.face;
    
    // Create selected face edge highlight 
    const faceGeometry = createFaceGeometry(object, face);
    const edges = new THREE.EdgesGeometry(faceGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x0078d4, // Intense blue for selected face edges
        linewidth: 3, // Thicker line for selection
        transparent: false
    });
    
    const faceEdgeHighlight = new THREE.LineSegments(edges, edgeMaterial);
    faceEdgeHighlight.userData = { isSelectedFaceHighlight: true, selectable: false };
    faceEdgeHighlight.renderOrder = 60; // Higher than hover highlight
    
    // Position and orient the highlight
    positionFaceHighlight(faceEdgeHighlight, object, face, faceData.worldNormal);
    
    // Add to scene
    scene.add(faceEdgeHighlight);
    object.selectedFaceHighlight = faceEdgeHighlight;
}

function clearObjectSelection() {
    selectedObjects.forEach(obj => {
        removeBoundingBox(obj);
    });
    selectedObjects = [];
}

function getGroundPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, groundPoint);
    
    return groundPoint;
}

function selectObject(object, multiSelect = false) {
    console.log('selectObject called with object:', object.userData, 'multiSelect:', multiSelect);
    
    if (!multiSelect) {
        clearSelection();
    }
    
    if (selectedObjects.includes(object)) {
        // Deselect
        const index = selectedObjects.indexOf(object);
        selectedObjects.splice(index, 1);
        removeObjectEdgeHighlight(object);
        console.log('Deselected object, remaining:', selectedObjects.length);
    } else {
        // Select
        selectedObjects.push(object);
        addObjectEdgeHighlight(object);
        console.log('Selected object, total selected:', selectedObjects.length);
    }
    
    updatePropertiesPanel();
    console.log('Called updatePropertiesPanel');
}

function addObjectEdgeHighlight(object) {
    // Remove existing highlight first
    removeObjectEdgeHighlight(object);
    
    // Create edge geometry for the object - ensure geometry is current
    let geometry = object.geometry;
    if (!geometry || geometry.attributes.position.count === 0) {
        console.error('Object has invalid geometry for edge highlight');
        return;
    }
    
    // Create thick edge highlights using mesh geometry instead of lines
    const edgeHighlight = createThickEdgeHighlight(geometry, uiSettings.selection.edgeColor, uiSettings.selection.thickness);
    
    // Apply the exact same transformation as the original object
    edgeHighlight.position.copy(object.position);
    edgeHighlight.rotation.copy(object.rotation);
    edgeHighlight.scale.copy(object.scale);
    
    // Keep matrix auto-update enabled so it follows the object
    edgeHighlight.matrixAutoUpdate = true;
    
    edgeHighlight.userData = { isObjectEdgeHighlight: true, selectable: false };
    edgeHighlight.renderOrder = 100; // Render on top
    
    scene.add(edgeHighlight);
    object.edgeHighlight = edgeHighlight;
    
    console.log('Added edge highlight for object:', object.userData.id, 'thickness:', thickness, 'children:', edgeHighlight.children.length);
}

function updateObjectEdgeHighlight(object) {
    if (selectedObjects.includes(object)) {
        // Always remove and recreate to ensure geometry is current
        removeObjectEdgeHighlight(object);
        addObjectEdgeHighlight(object);
    }
}

function syncEdgeHighlightTransform(object) {
    if (object.edgeHighlight) {
        object.edgeHighlight.position.copy(object.position);
        object.edgeHighlight.rotation.copy(object.rotation);
        object.edgeHighlight.scale.copy(object.scale);
    }
}

function removeObjectEdgeHighlight(object) {
    if (object.edgeHighlight) {
        scene.remove(object.edgeHighlight);
        if (object.edgeHighlight.geometry) object.edgeHighlight.geometry.dispose();
        if (object.edgeHighlight.material) object.edgeHighlight.material.dispose();
        object.edgeHighlight = null;
    }
}

function addBoundingBox(object) {
    if (boundingBoxHelpers.has(object)) return;
    
    const box = new THREE.BoxHelper(object, 0x0078d4);
    box.userData = { isBoundingBox: true, selectable: false };
    box.renderOrder = 101; // Render on top of everything
    box.material.depthTest = false;
    scene.add(box);
    boundingBoxHelpers.set(object, box);
}

function removeBoundingBox(object) {
    const box = boundingBoxHelpers.get(object);
    if (box) {
        scene.remove(box);
        box.dispose();
        boundingBoxHelpers.delete(object);
    }
}

function clearSelection() {
    // Clear object selection
    selectedObjects.forEach(obj => {
        obj.material = obj.userData.originalMaterial;
        removeObjectEdgeHighlight(obj);
        removeBoundingBox(obj);
    });
    selectedObjects = [];
    
    // Clear face selection
    if (selectedFace) {
        clearSelectedFaceHighlight();
        selectedFace = null;
    }
    
    // Clear any remaining highlights
    clearFaceHover();
    clearAllHighlights();
    
    // Re-enable camera controls
    controls.enabled = true;
    canvas.style.cursor = 'default';
    
    updatePropertiesPanel();
}

function clearSelectedFaceHighlight() {
    if (selectedFace && selectedFace.object && selectedFace.object.selectedFaceHighlight) {
        scene.remove(selectedFace.object.selectedFaceHighlight);
        selectedFace.object.selectedFaceHighlight.geometry.dispose();
        selectedFace.object.selectedFaceHighlight.material.dispose();
        selectedFace.object.selectedFaceHighlight = null;
    }
}

function setHoverObject(object) {
    // Clear previous hover
    if (hoveredObject && !selectedObjects.includes(hoveredObject)) {
        hoveredObject.material = hoveredObject.userData.originalMaterial;
    }
    
    hoveredObject = object;
    
    // No longer apply hover material to objects - only face highlighting will be used
}



function startRectangleCreation(event) {
    // Check if we can create on a face first
    const intersectionData = getIntersectionAtMouse(event);
    let position, targetFace = null;
    
    // Check for edge/corner snapping first
    const edgeCornerResult = detectEdgesAndCorners(intersectionData, null);
    if (edgeCornerResult) {
        if (edgeCornerResult.type === 'corner') {
            position = edgeCornerResult.data.position.clone();
            console.log('Starting rectangle creation snapped to corner');
        } else if (edgeCornerResult.type === 'edge') {
            // Snap to closest point on edge
            position = getClosestPointOnEdge(intersectionData.point, edgeCornerResult.data);
            console.log('Starting rectangle creation snapped to edge');
        }
        // Use the face of the object that contains the edge/corner
        targetFace = {
            object: intersectionData.object,
            face: intersectionData.face,
            normal: intersectionData.worldNormal,
            point: position
        };
    } else if (intersectionData && intersectionData.object.userData.selectable && 
        canPushPullFace(intersectionData.object, intersectionData.face)) {
        // Creating on an object face
        position = intersectionData.point;
        targetFace = {
            object: intersectionData.object,
            face: intersectionData.face,
            normal: intersectionData.worldNormal,
            point: intersectionData.point
        };
        console.log('Starting rectangle creation on face of', intersectionData.object.userData.type);
    } else {
        // Creating on ground
        position = getGroundPosition(event);
        if (!position) return;
        console.log('Starting rectangle creation on ground');
    }
    
    isCreatingRectangle = true;
    rectangleStartPoint = position;
    
    // Store target face info for later
    if (targetFace) {
        rectangleStartPoint.targetFace = targetFace;
    }
    
    // Disable camera controls during rectangle creation
    controls.enabled = false;
    canvas.style.cursor = 'crosshair';
    
    // Create preview rectangle (wireframe)
    const previewGeometry = new THREE.PlaneGeometry(0.1, 0.1);
    const previewEdges = new THREE.EdgesGeometry(previewGeometry);
    const previewMaterial = new THREE.LineBasicMaterial({ 
        color: 0x0078d4, 
        linewidth: 2 
    });
    
    rectanglePreview = new THREE.LineSegments(previewEdges, previewMaterial);
    
    if (targetFace) {
        // Orient rectangle to face normal
        rectanglePreview.lookAt(
            position.x + targetFace.normal.x,
            position.y + targetFace.normal.y,
            position.z + targetFace.normal.z
        );
        // Offset slightly to prevent z-fighting
        rectanglePreview.position.copy(position);
        rectanglePreview.position.add(targetFace.normal.clone().multiplyScalar(0.001));
    } else {
        // Ground creation
        rectanglePreview.rotation.x = -Math.PI / 2;
        rectanglePreview.position.copy(position);
    }
    
    rectanglePreview.userData = { isPreview: true, selectable: false };
    scene.add(rectanglePreview);
}

function updateRectangleCreation(event) {
    if (!isCreatingRectangle || !rectangleStartPoint || !rectanglePreview) return;
    
    let currentPosition;
    
    if (rectangleStartPoint.targetFace) {
        // Creating on a face - project mouse to face plane
        const intersectionData = getIntersectionAtMouse(event);
        
        // Check for edge/corner snapping at current position
        const edgeCornerResult = detectEdgesAndCorners(intersectionData, null);
        if (edgeCornerResult && intersectionData && intersectionData.object === rectangleStartPoint.targetFace.object) {
            if (edgeCornerResult.type === 'corner') {
                currentPosition = edgeCornerResult.data.position.clone();
                // Highlight the corner for visual feedback
                highlightCorner(edgeCornerResult.data);
            } else if (edgeCornerResult.type === 'edge') {
                currentPosition = getClosestPointOnEdge(intersectionData.point, edgeCornerResult.data);
                // Highlight the edge for visual feedback
                highlightEdge(edgeCornerResult.data);
            }
        } else if (intersectionData && intersectionData.object === rectangleStartPoint.targetFace.object) {
            currentPosition = intersectionData.point;
            // Clear any previous edge/corner highlights
            clearEdgeCornerHighlights();
        } else {
            // Project mouse ray to face plane if not directly hitting
            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            const facePlane = new THREE.Plane();
            facePlane.setFromNormalAndCoplanarPoint(
                rectangleStartPoint.targetFace.normal, 
                rectangleStartPoint.targetFace.point
            );
            
            currentPosition = new THREE.Vector3();
            raycaster.ray.intersectPlane(facePlane, currentPosition);
            // Clear any previous edge/corner highlights
            clearEdgeCornerHighlights();
        }
    } else {
        // Creating on ground
        currentPosition = getGroundPosition(event);
        
        // For ground creation, check for snapping to objects
        const intersectionData = getIntersectionAtMouse(event);
        const edgeCornerResult = detectEdgesAndCorners(intersectionData, null);
        if (edgeCornerResult) {
            if (edgeCornerResult.type === 'corner') {
                currentPosition = edgeCornerResult.data.position.clone();
                currentPosition.y = 0; // Keep on ground
                highlightCorner(edgeCornerResult.data);
            } else if (edgeCornerResult.type === 'edge') {
                const snapPoint = getClosestPointOnEdge(intersectionData.point, edgeCornerResult.data);
                currentPosition = snapPoint.clone();
                currentPosition.y = 0; // Keep on ground
                highlightEdge(edgeCornerResult.data);
            }
        } else {
            clearEdgeCornerHighlights();
        }
    }
    
    if (!currentPosition) return;
    
    // Calculate dimensions based on face orientation
    let width, height;
    if (rectangleStartPoint.targetFace) {
        // For face creation, calculate dimensions in face-local coordinates
        const delta = currentPosition.clone().sub(rectangleStartPoint);
        const normal = rectangleStartPoint.targetFace.normal;
        
        // Create local coordinate system for the face
        const up = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(normal, up).normalize();
        const forward = new THREE.Vector3().crossVectors(right, normal).normalize();
        
        width = Math.abs(delta.dot(right));
        height = Math.abs(delta.dot(forward));
    } else {
        // Ground creation
        width = Math.abs(currentPosition.x - rectangleStartPoint.x);
        height = Math.abs(currentPosition.z - rectangleStartPoint.z);
    }
    
    // Update preview geometry
    rectanglePreview.geometry.dispose();
    const newGeometry = new THREE.PlaneGeometry(Math.max(0.1, width), Math.max(0.1, height));
    const newEdges = new THREE.EdgesGeometry(newGeometry);
    rectanglePreview.geometry = newEdges;
    
    // Update position and orientation to center between start and current
    if (rectangleStartPoint.targetFace) {
        // For face creation, center on the face
        const center = new THREE.Vector3().addVectors(rectangleStartPoint, currentPosition).multiplyScalar(0.5);
        center.add(rectangleStartPoint.targetFace.normal.clone().multiplyScalar(0.001)); // Slight offset
        rectanglePreview.position.copy(center);
        
        // Maintain orientation to face normal
        rectanglePreview.lookAt(
            center.x + rectangleStartPoint.targetFace.normal.x,
            center.y + rectangleStartPoint.targetFace.normal.y,
            center.z + rectangleStartPoint.targetFace.normal.z
        );
    } else {
        // Ground creation
        const centerX = (rectangleStartPoint.x + currentPosition.x) / 2;
        const centerZ = (rectangleStartPoint.z + currentPosition.z) / 2;
        rectanglePreview.position.set(centerX, 0.01, centerZ);
    }
}

function endRectangleCreation(event) {
    if (!isCreatingRectangle || !rectangleStartPoint) return;
    
    let endPosition, width, height;
    
    if (rectangleStartPoint.targetFace) {
        // Creating on a face
        const intersectionData = getIntersectionAtMouse(event);
        
        // Check for edge/corner snapping at end position
        const edgeCornerResult = detectEdgesAndCorners(intersectionData, null);
        if (edgeCornerResult && intersectionData.object === rectangleStartPoint.targetFace.object) {
            if (edgeCornerResult.type === 'corner') {
                endPosition = edgeCornerResult.data.position.clone();
            } else if (edgeCornerResult.type === 'edge') {
                endPosition = getClosestPointOnEdge(intersectionData.point, edgeCornerResult.data);
            }
        } else if (intersectionData && intersectionData.object === rectangleStartPoint.targetFace.object) {
            endPosition = intersectionData.point;
        } else {
            // Project to face plane
            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            const facePlane = new THREE.Plane();
            facePlane.setFromNormalAndCoplanarPoint(
                rectangleStartPoint.targetFace.normal, 
                rectangleStartPoint.targetFace.point
            );
            
            endPosition = new THREE.Vector3();
            raycaster.ray.intersectPlane(facePlane, endPosition);
        }
        
        if (!endPosition) {
            cancelRectangleCreation();
            return;
        }
        
        // Calculate dimensions in face-local coordinates
        const delta = endPosition.clone().sub(rectangleStartPoint);
        const normal = rectangleStartPoint.targetFace.normal;
        
        const up = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(normal, up).normalize();
        const forward = new THREE.Vector3().crossVectors(right, normal).normalize();
        
        width = Math.abs(delta.dot(right));
        height = Math.abs(delta.dot(forward));
    } else {
        // Creating on ground
        endPosition = getGroundPosition(event);
        if (!endPosition) {
            cancelRectangleCreation();
            return;
        }
        
        width = Math.abs(endPosition.x - rectangleStartPoint.x);
        height = Math.abs(endPosition.z - rectangleStartPoint.z);
    }
    
    // Only create if minimum size and reasonable maximum
    if (width > 0.1 && height > 0.1 && width < 50 && height < 50) {
        // Create actual rectangle
        const geometry = new THREE.PlaneGeometry(width, height);
        const doubleSidedMaterial = standardMaterial.clone();
        doubleSidedMaterial.side = THREE.DoubleSide; // Render both sides
        const rectangle = addObject(geometry, doubleSidedMaterial, {
            type: 'rectangle',
            width: width,
            height: height
        });
        
        console.log('Created rectangle with dimensions:', width, 'x', height);
        
        if (rectangleStartPoint.targetFace) {
            // Position and orient on face
            const center = new THREE.Vector3().addVectors(rectangleStartPoint, endPosition).multiplyScalar(0.5);
            center.add(rectangleStartPoint.targetFace.normal.clone().multiplyScalar(0.01)); // Small offset
            
            rectangle.position.copy(center);
            rectangle.lookAt(
                center.x + rectangleStartPoint.targetFace.normal.x,
                center.y + rectangleStartPoint.targetFace.normal.y,
                center.z + rectangleStartPoint.targetFace.normal.z
            );
            
            // Store face orientation for proper extrusion
            rectangle.userData.createdOnFace = true;
            rectangle.userData.faceNormal = rectangleStartPoint.targetFace.normal.clone();
            rectangle.userData.parentObject = rectangleStartPoint.targetFace.object;
            
            console.log('Created rectangle on face:', width, 'x', height);
        } else {
            // Ground creation
            const centerX = (rectangleStartPoint.x + endPosition.x) / 2;
            const centerZ = (rectangleStartPoint.z + endPosition.z) / 2;
            
            rectangle.rotation.x = -Math.PI / 2;
            rectangle.position.set(centerX, 0.01, centerZ);
            
            console.log('Created rectangle on ground:', width, 'x', height, 'at', centerX, centerZ);
        }
        
        clearSelection();
        selectObject(rectangle);
    }
    
    // Cleanup
    cancelRectangleCreation();
}

function cancelRectangleCreation() {
    if (rectanglePreview) {
        scene.remove(rectanglePreview);
        rectanglePreview.geometry.dispose();
        rectanglePreview.material.dispose();
        rectanglePreview = null;
    }
    
    isCreatingRectangle = false;
    rectangleStartPoint = null;
    controls.enabled = true;
    canvas.style.cursor = 'default';
}

function startCircleCreation(event) {
    const position = getGroundPosition(event);
    if (!position) return;
    
    isCreatingCircle = true;
    circleStartPoint = position;
    
    // Disable camera controls during circle creation
    controls.enabled = false;
    canvas.style.cursor = 'crosshair';
    
    // Create preview circle (wireframe)
    const previewGeometry = new THREE.CircleGeometry(0.1, 16);
    const previewEdges = new THREE.EdgesGeometry(previewGeometry);
    const previewMaterial = new THREE.LineBasicMaterial({ 
        color: 0x0078d4, 
        linewidth: 2 
    });
    
    circlePreview = new THREE.LineSegments(previewEdges, previewMaterial);
    circlePreview.rotation.x = -Math.PI / 2;
    circlePreview.position.copy(position);
    circlePreview.userData = { isPreview: true, selectable: false };
    
    scene.add(circlePreview);
    console.log('Started circle creation at', position);
}

function updateCircleCreation(event) {
    if (!isCreatingCircle || !circleStartPoint || !circlePreview) return;
    
    const currentPosition = getGroundPosition(event);
    if (!currentPosition) return;
    
    // Calculate radius from center to current position
    const radius = Math.max(0.1, circleStartPoint.distanceTo(currentPosition));
    
    // Update preview geometry
    circlePreview.geometry.dispose();
    const newGeometry = new THREE.CircleGeometry(radius, 16);
    const newEdges = new THREE.EdgesGeometry(newGeometry);
    circlePreview.geometry = newEdges;
}

function endCircleCreation(event) {
    if (!isCreatingCircle || !circleStartPoint) return;
    
    const endPosition = getGroundPosition(event);
    if (!endPosition) {
        cancelCircleCreation();
        return;
    }
    
    // Calculate final radius
    const radius = Math.max(0.1, circleStartPoint.distanceTo(endPosition));
    
    // Only create if minimum size
    if (radius > 0.1) {
        // Create actual circle
        const geometry = new THREE.CircleGeometry(radius, 32);
        const circle = addObject(geometry, standardMaterial.clone(), {
            type: 'circle',
            radius: radius
        });
        
        circle.rotation.x = -Math.PI / 2;
        circle.position.copy(circleStartPoint);
        
        clearSelection();
        selectObject(circle);
        
        console.log('Created circle with radius:', radius, 'at', circleStartPoint);
    }
    
    // Cleanup
    cancelCircleCreation();
}

function cancelCircleCreation() {
    if (circlePreview) {
        scene.remove(circlePreview);
        circlePreview.geometry.dispose();
        circlePreview.material.dispose();
        circlePreview = null;
    }
    
    isCreatingCircle = false;
    circleStartPoint = null;
    controls.enabled = true;
    canvas.style.cursor = 'default';
}

function startObjectMove(event) {
    if (selectedObjects.length === 0) return;
    
    isMovingObject = true;
    wasInteracting = true; // Prevent click deselection on mouse up
    controls.enabled = false; // Disable camera controls during move
    canvas.style.cursor = 'grabbing';
    
    // Store starting positions
    const rect = canvas.getBoundingClientRect();
    moveStartMousePosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
    
    // Store initial positions of all selected objects
    selectedObjects.forEach(obj => {
        obj.userData.moveStartPosition = obj.position.clone();
    });
    
    console.log('Started moving', selectedObjects.length, 'objects');
}

function updateObjectMove(event) {
    if (!isMovingObject || selectedObjects.length === 0) {
        // Safety: if we're in move mode but have no objects selected, exit move mode
        if (isMovingObject) {
            endObjectMove(event);
        }
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const currentMouseX = event.clientX - rect.left;
    const currentMouseY = event.clientY - rect.top;
    
    // Calculate mouse delta in screen space
    const deltaX = currentMouseX - moveStartMousePosition.x;
    const deltaY = currentMouseY - moveStartMousePosition.y;
    
    // Convert screen delta to world delta
    const worldDelta = screenToWorldDelta(deltaX, deltaY);
    
    // Update positions of all selected objects
    selectedObjects.forEach(obj => {
        const startPos = obj.userData.moveStartPosition;
        obj.position.set(
            startPos.x + worldDelta.x,
            startPos.y,  // Keep Y position fixed (don't move vertically)
            startPos.z + worldDelta.z
        );
        
        // Update edge highlights
        syncEdgeHighlightTransform(obj);
    });
    
    // Check for snap targets
    checkForSnapTargets(event);
}

function endObjectMove(event) {
    if (!isMovingObject) return;
    
    // Apply snap if we have a target
    if (snapTarget) {
        applySnapToTarget();
    }
    
    isMovingObject = false;
    controls.enabled = true;
    canvas.style.cursor = 'move';
    
    // Reset interaction flag to allow future clicks
    wasInteracting = false;
    
    // Clean up snap highlighting
    clearSnapHighlight();
    clearSnapPreview();
    
    // Clean up temporary data
    selectedObjects.forEach(obj => {
        delete obj.userData.moveStartPosition;
    });
    
    console.log('Finished moving objects');
    updatePropertiesPanel();
}

function screenToWorldDelta(screenDeltaX, screenDeltaY) {
    // Convert screen pixel movement to world units using proper camera projection
    const distance = camera.position.length(); // Distance from origin as approximation
    const fov = camera.fov * Math.PI / 180;
    const pixelSize = (2 * Math.tan(fov / 2) * distance) / canvas.clientHeight;
    
    // Get camera's right and up vectors in world space
    const cameraMatrix = camera.matrixWorld;
    const right = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0); // Camera's right vector
    const up = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 1);    // Camera's up vector
    
    // Scale by pixel size and apply to camera vectors
    const worldDeltaX = right.clone().multiplyScalar(screenDeltaX * pixelSize);
    const worldDeltaY = up.clone().multiplyScalar(-screenDeltaY * pixelSize); // Invert Y
    
    // Combine the movements but keep Y movement minimal for ground-based objects
    const combinedDelta = worldDeltaX.add(worldDeltaY);
    
    return {
        x: combinedDelta.x,
        y: 0, // Keep objects on ground
        z: combinedDelta.z
    };
}

// Face-constrained movement functions
let isFaceConstrainedMove = false;
let faceConstrainedMoveData = null;

// Flag to prevent click deselection during interactions
let wasInteracting = false;

// Track mouse movement to detect drag vs click
let mouseDownPosition = null;
let isDragging = false;

// Edge and corner detection for rectangle tool
let hoveredEdge = null;
let hoveredCorner = null;
let edgeHighlights = [];
let cornerHighlights = [];

function startFaceConstrainedMove(event) {
    // Use hoveredFace if available, otherwise use selectedFace
    const faceToUse = hoveredFace || selectedFace;
    
    if (!faceToUse || selectedObjects.length === 0) return;
    
    isFaceConstrainedMove = true;
    wasInteracting = true; // Prevent click deselection on mouse up
    controls.enabled = false;
    canvas.style.cursor = 'grabbing';
    
    const rect = canvas.getBoundingClientRect();
    faceConstrainedMoveData = {
        startMousePosition: {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        },
        faceNormal: faceToUse.worldNormal.clone(),
        startPositions: []
    };
    
    // Store initial positions of all selected objects
    selectedObjects.forEach(obj => {
        faceConstrainedMoveData.startPositions.push({
            object: obj,
            position: obj.position.clone()
        });
    });
    
    console.log('Started face-constrained move along normal:', faceConstrainedMoveData.faceNormal);
}

function updateFaceConstrainedMove(event) {
    if (!isFaceConstrainedMove || !faceConstrainedMoveData) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentMouseX = event.clientX - rect.left;
    const currentMouseY = event.clientY - rect.top;
    
    // Calculate mouse delta
    const deltaX = currentMouseX - faceConstrainedMoveData.startMousePosition.x;
    const deltaY = currentMouseY - faceConstrainedMoveData.startMousePosition.y;
    
    // Project face normal to screen space to determine best mouse direction to use
    const faceNormal = faceConstrainedMoveData.faceNormal;
    const screenNormal = new THREE.Vector3();
    screenNormal.copy(faceNormal);
    screenNormal.project(camera);
    
    // Improved face-constrained movement with correct direction mapping
    let mouseDelta;
    
    // Project the face normal to screen space to determine direction
    const screenProjected = faceNormal.clone().project(camera);
    
    // Determine which mouse movement to use and apply proper direction
    if (Math.abs(screenProjected.x) > Math.abs(screenProjected.y)) {
        // Face normal projects more horizontally on screen
        // Use X mouse movement, with sign matching screen projection
        const direction = Math.sign(screenProjected.x);
        mouseDelta = deltaX * 0.01 * direction;
    } else {
        // Face normal projects more vertically on screen  
        // Use Y mouse movement (invert Y axis), with sign matching screen projection
        const direction = Math.sign(screenProjected.y);
        mouseDelta = -deltaY * 0.01 * direction;
    }
    
    const moveVector = faceNormal.clone().multiplyScalar(mouseDelta);
    
    // Apply movement to all selected objects
    faceConstrainedMoveData.startPositions.forEach(data => {
        const newPosition = data.position.clone().add(moveVector);
        data.object.position.copy(newPosition);
        
        // Update edge highlights
        syncEdgeHighlightTransform(data.object);
    });
    
    // Check for snap targets during face-constrained move too
    checkForWholeObjectSnapTargets(event);
}

function endFaceConstrainedMove(event) {
    if (!isFaceConstrainedMove) return;
    
    // Apply snap if we have a target
    if (snapTarget) {
        applyWholeObjectSnapToTarget();
    }
    
    isFaceConstrainedMove = false;
    faceConstrainedMoveData = null;
    controls.enabled = true;
    canvas.style.cursor = 'move';
    
    // Reset interaction flag to allow future clicks
    wasInteracting = false;
    
    // Clean up snap highlighting
    clearSnapHighlight();
    clearSnapPreview();
    
    console.log('Finished face-constrained move');
    updatePropertiesPanel();
}

// Whole object movement functions (for corner/edge grabbing)
function startWholeObjectMove(event, edgeCornerResult) {
    if (selectedObjects.length === 0) return;
    
    isWholeObjectMove = true;
    wasInteracting = true;
    controls.enabled = false;
    canvas.style.cursor = 'grabbing';
    
    const rect = canvas.getBoundingClientRect();
    wholeObjectMoveData = {
        startMousePosition: {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        },
        startPositions: [],
        grabType: edgeCornerResult.type,
        grabData: edgeCornerResult.data,
        grabPoint: edgeCornerResult.data.position ? edgeCornerResult.data.position.clone() : null
    };
    
    // Store starting positions of all selected objects
    selectedObjects.forEach(obj => {
        wholeObjectMoveData.startPositions.push({
            object: obj,
            position: obj.position.clone()
        });
    });
    
    console.log('Started whole object move via', edgeCornerResult.type);
}

function updateWholeObjectMove(event) {
    if (!isWholeObjectMove || !wholeObjectMoveData) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentMouseX = event.clientX - rect.left;
    const currentMouseY = event.clientY - rect.top;
    
    // Calculate mouse delta
    const deltaX = currentMouseX - wholeObjectMoveData.startMousePosition.x;
    const deltaY = currentMouseY - wholeObjectMoveData.startMousePosition.y;
    
    // Convert screen delta to world delta
    const worldDelta = screenToWorldDelta(deltaX, deltaY);
    
    // Apply movement to all selected objects
    wholeObjectMoveData.startPositions.forEach(data => {
        const newPosition = data.position.clone().add(new THREE.Vector3(worldDelta.x, 0, worldDelta.z));
        data.object.position.copy(newPosition);
        
        // Update edge highlights
        syncEdgeHighlightTransform(data.object);
    });
    
    // Check for snap targets on other objects
    checkForWholeObjectSnapTargets(event);
}

function endWholeObjectMove(event) {
    if (!isWholeObjectMove) return;
    
    // Apply snap if we have a target
    if (snapTarget) {
        applyWholeObjectSnapToTarget();
    }
    
    isWholeObjectMove = false;
    wholeObjectMoveData = null;
    controls.enabled = true;
    canvas.style.cursor = 'move';
    
    // Reset interaction flag to allow future clicks
    wasInteracting = false;
    
    // Clean up snap highlighting
    clearSnapHighlight();
    clearSnapPreview();
    
    console.log('Finished whole object move');
    updatePropertiesPanel();
}

function checkForWholeObjectSnapTargets(event) {
    if (selectedObjects.length === 0) return;
    
    const movingObject = selectedObjects[0]; // For simplicity, use first selected object
    const snapDistance = 2.0; // World units within which snapping occurs
    
    // Clear previous snap target
    clearSnapHighlight();
    clearSnapPreview();
    snapTarget = null;
    
    // Get intersection at current mouse position, but exclude selected objects from raycasting
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Only test against non-selected, selectable objects
    const testableObjects = objects.filter(obj => 
        obj.userData.selectable && 
        !selectedObjects.includes(obj)
    );
    
    const intersects = raycaster.intersectObjects(testableObjects);
    
    if (intersects.length > 0) {
        const intersection = intersects[0];
        const intersectionData = {
            object: intersection.object,
            point: intersection.point,
            face: intersection.face,
            worldNormal: intersection.face ? intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld) : null
        };
        // Check for edge/corner/face snapping on other objects
        const edgeCornerResult = detectEdgesAndCorners(intersectionData, null);
        
        if (edgeCornerResult) {
            // Found edge or corner to snap to
            snapTarget = {
                type: edgeCornerResult.type,
                data: edgeCornerResult.data,
                object: intersectionData.object
            };
            
            // Only show blue snap preview, no orange/green highlights
            // Pass intersection point for better edge snapping
            showSnapPreview(snapTarget, intersectionData.point);
            console.log('Found snap target:', edgeCornerResult.type);
        } else if (canPushPullFace(intersectionData.object, intersectionData.face)) {
            // Face snapping - check if face is axis-aligned for better snapping
            const targetNormal = intersectionData.worldNormal;
            
            // Get the moving object's orientation to determine preferred axis
            const movingObject = selectedObjects[0];
            let isAxisAligned = false;
            
            // Check if the target face normal is aligned with a major axis (within 15 degrees)
            const threshold = Math.cos(15 * Math.PI / 180); // ~0.97
            if (Math.abs(targetNormal.x) > threshold || 
                Math.abs(targetNormal.y) > threshold || 
                Math.abs(targetNormal.z) > threshold) {
                isAxisAligned = true;
            }
            
            if (isAxisAligned) {
                const faceData = {
                    worldPosition: intersectionData.point,
                    worldNormal: intersectionData.worldNormal,
                    object: intersectionData.object
                };
                
                snapTarget = {
                    type: 'face',
                    data: faceData,
                    object: intersectionData.object
                };
                
                // Only show blue snap preview, no orange face highlight
                showSnapPreview(snapTarget, intersectionData.point);
                console.log('Found axis-aligned face snap target');
            }
        }
    }
}

function applyWholeObjectSnapToTarget() {
    if (!snapTarget || !wholeObjectMoveData) return;
    
    const movingObject = selectedObjects[0];
    
    // Calculate snap position based on target type
    let snapPosition;
    
    if (snapTarget.type === 'corner') {
        snapPosition = snapTarget.data.position.clone();
    } else if (snapTarget.type === 'edge') {
        // Snap to closest point on edge
        snapPosition = getClosestPointOnEdge(movingObject.position, snapTarget.data);
    } else if (snapTarget.type === 'face') {
        // Snap to face surface
        snapPosition = snapTarget.data.worldPosition.clone();
        const offset = 0.1; // Small offset to prevent z-fighting
        snapPosition.add(snapTarget.data.worldNormal.clone().multiplyScalar(offset));
    }
    
    if (snapPosition) {
        let offset;
        
        if (wholeObjectMoveData.grabPoint && snapTarget.type === 'corner') {
            // Corner-to-corner snapping: align grabbed corner with target corner
            const currentGrabPoint = wholeObjectMoveData.grabPoint.clone();
            // Transform grab point to current world position
            const grabOffset = currentGrabPoint.clone().sub(wholeObjectMoveData.startPositions[0].position);
            const currentWorldGrabPoint = movingObject.position.clone().add(grabOffset);
            
            // Calculate offset to align grab point with target
            offset = snapPosition.clone().sub(currentWorldGrabPoint);
        } else {
            // Default behavior: align object center
            offset = snapPosition.clone().sub(movingObject.position);
        }
        
        // Apply snap to all selected objects
        wholeObjectMoveData.startPositions.forEach((data, index) => {
            const newPosition = selectedObjects[index].position.clone().add(offset);
            selectedObjects[index].position.copy(newPosition);
            syncEdgeHighlightTransform(selectedObjects[index]);
        });
        
        console.log('Snapped object', wholeObjectMoveData.grabPoint ? 'corner-to-corner' : 'center-to-target', 'to', snapTarget.type);
    }
}

function highlightSnapTarget(targetData, type) {
    clearSnapHighlight();
    
    let geometry, material;
    
    if (type === 'corner') {
        // Create corner highlight
        const radius = 0.1;
        geometry = new THREE.SphereGeometry(radius, 8, 8);
        material = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.7,
            depthTest: false 
        });
        snapHighlight = new THREE.Mesh(geometry, material);
        snapHighlight.position.copy(targetData.position);
    } else if (type === 'edge') {
        // Create edge highlight
        const points = [targetData.start, targetData.end];
        geometry = new THREE.BufferGeometry().setFromPoints(points);
        material = new THREE.LineBasicMaterial({ 
            color: 0x00ff00, 
            linewidth: 4,
            depthTest: false 
        });
        snapHighlight = new THREE.Line(geometry, material);
    } else if (type === 'face') {
        // Create face highlight using the actual face geometry
        const faceGeometry = generateFaceGeometry(targetData.object);
        material = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthTest: false 
        });
        snapHighlight = new THREE.Mesh(faceGeometry, material);
        
        // Copy object transformation and add slight offset along normal
        snapHighlight.position.copy(targetData.object.position);
        snapHighlight.rotation.copy(targetData.object.rotation);
        snapHighlight.scale.copy(targetData.object.scale);
        
        // Add small offset along the face normal to prevent z-fighting
        const offset = targetData.worldNormal.clone().multiplyScalar(0.01);
        snapHighlight.position.add(offset);
    }
    
    if (snapHighlight) {
        snapHighlight.userData = { isSnapHighlight: true, selectable: false };
        snapHighlight.renderOrder = 1000;
        scene.add(snapHighlight);
    }
}

function showSnapPreview(snapTarget, mouseIntersectionPoint) {
    clearSnapPreview();
    
    if (!snapTarget || !wholeObjectMoveData || selectedObjects.length === 0) return;
    
    const movingObject = selectedObjects[0];
    
    // Calculate where the object will be positioned after snap
    let snapPosition;
    
    if (snapTarget.type === 'corner') {
        snapPosition = snapTarget.data.position.clone();
    } else if (snapTarget.type === 'edge') {
        // Use mouse intersection point for more precise edge snapping
        if (mouseIntersectionPoint) {
            snapPosition = getClosestPointOnEdge(mouseIntersectionPoint, snapTarget.data);
        } else {
            snapPosition = getClosestPointOnEdge(movingObject.position, snapTarget.data);
        }
    } else if (snapTarget.type === 'face') {
        snapPosition = snapTarget.data.worldPosition.clone();
        const offset = 0.1;
        snapPosition.add(snapTarget.data.worldNormal.clone().multiplyScalar(offset));
    }
    
    if (snapPosition) {
        // Calculate final position based on grab point vs center alignment
        let finalPosition;
        
        if (wholeObjectMoveData.grabPoint && snapTarget.type === 'corner') {
            // Corner-to-corner: align grabbed corner with target corner
            const grabOffset = wholeObjectMoveData.grabPoint.clone().sub(wholeObjectMoveData.startPositions[0].position);
            finalPosition = snapPosition.clone().sub(grabOffset);
        } else {
            // Default: align center with target
            finalPosition = snapPosition.clone();
        }
        
        // Create blue wireframe preview box
        const box = new THREE.Box3().setFromObject(movingObject);
        const size = box.getSize(new THREE.Vector3());
        
        const previewGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const previewEdges = new THREE.EdgesGeometry(previewGeometry);
        const previewMaterial = new THREE.LineBasicMaterial({
            color: 0x0078d4, // Blue color
            transparent: true,
            opacity: 0.6,
            depthTest: false,
            linewidth: 2
        });
        
        snapPreview = new THREE.LineSegments(previewEdges, previewMaterial);
        snapPreview.position.copy(finalPosition);
        snapPreview.rotation.copy(movingObject.rotation);
        snapPreview.scale.copy(movingObject.scale);
        
        snapPreview.userData = { isSnapPreview: true, selectable: false };
        snapPreview.renderOrder = 999; // Render on top
        
        scene.add(snapPreview);
    }
}

function clearSnapPreview() {
    if (snapPreview) {
        scene.remove(snapPreview);
        snapPreview.geometry.dispose();
        snapPreview.material.dispose();
        snapPreview = null;
    }
}

function checkForSnapTargets(event) {
    if (selectedObjects.length === 0) return;
    
    const movingObject = selectedObjects[0]; // For simplicity, snap the first selected object
    const snapDistance = 2.0; // World units within which snapping occurs
    
    // Clear previous snap target
    clearSnapHighlight();
    clearSnapPreview();
    snapTarget = null;
    
    // Check all objects in scene for potential snap targets
    scene.traverse(object => {
        if (object.isMesh && 
            !selectedObjects.includes(object) && 
            object.userData.type && 
            object.geometry instanceof THREE.BoxGeometry) {
            
            // Get faces of this potential target object
            const targetFaces = getObjectFaces(object);
            
            targetFaces.forEach(face => {
                const distance = movingObject.position.distanceTo(face.worldPosition);
                
                if (distance < snapDistance) {
                    // Found a snap target
                    snapTarget = {
                        object: object,
                        face: face,
                        distance: distance
                    };
                    
                    // Highlight the snap target face
                    highlightSnapTarget(face);
                }
            });
        }
    });
}

function getObjectFaces(object) {
    const faces = [];
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Define face positions and normals for a box
    const faceData = [
        { normal: new THREE.Vector3(0, 1, 0), offset: size.y / 2 },   // Top
        { normal: new THREE.Vector3(0, -1, 0), offset: -size.y / 2 }, // Bottom
        { normal: new THREE.Vector3(1, 0, 0), offset: size.x / 2 },   // Right
        { normal: new THREE.Vector3(-1, 0, 0), offset: -size.x / 2 }, // Left
        { normal: new THREE.Vector3(0, 0, 1), offset: size.z / 2 },   // Front
        { normal: new THREE.Vector3(0, 0, -1), offset: -size.z / 2 }  // Back
    ];
    
    faceData.forEach((data, index) => {
        const worldNormal = data.normal.clone();
        worldNormal.transformDirection(object.matrixWorld);
        
        const worldPosition = center.clone();
        worldPosition.add(data.normal.clone().multiplyScalar(data.offset));
        worldPosition.applyMatrix4(object.matrixWorld);
        
        faces.push({
            index: index,
            worldNormal: worldNormal,
            worldPosition: worldPosition,
            localNormal: data.normal.clone(),
            object: object
        });
    });
    
    return faces;
}

function highlightSnapTarget(face) {
    clearSnapHighlight();
    
    // Create a plane to highlight the target face
    const size = 0.1; // Thin highlight plane
    const geometry = new THREE.PlaneGeometry(2, 2);
    snapHighlight = new THREE.Mesh(geometry, snapMaterial);
    
    // Position the highlight on the face
    snapHighlight.position.copy(face.worldPosition);
    
    // Orient the highlight to match the face normal
    snapHighlight.lookAt(
        face.worldPosition.x + face.worldNormal.x,
        face.worldPosition.y + face.worldNormal.y,
        face.worldPosition.z + face.worldNormal.z
    );
    
    scene.add(snapHighlight);
}

function clearSnapHighlight() {
    if (snapHighlight) {
        scene.remove(snapHighlight);
        snapHighlight.geometry.dispose();
        snapHighlight.material.dispose();
        snapHighlight = null;
    }
}

function applySnapToTarget() {
    if (!snapTarget || selectedObjects.length === 0) return;
    
    const movingObject = selectedObjects[0];
    const targetFace = snapTarget.face;
    
    // Calculate the position to snap to
    // Place the moving object so it touches the target face
    const movingBox = new THREE.Box3().setFromObject(movingObject);
    const movingSize = movingBox.getSize(new THREE.Vector3());
    
    // Find the closest face of the moving object to the target
    const offset = movingSize.y / 2 + 0.01; // Small gap to prevent z-fighting
    
    const snapPosition = targetFace.worldPosition.clone();
    snapPosition.add(targetFace.worldNormal.clone().multiplyScalar(offset));
    
    movingObject.position.copy(snapPosition);
    
    // Update edge highlights
    syncEdgeHighlightTransform(movingObject);
    
    console.log('Snapped object to face');
}

// Edge and corner detection functions
function detectEdgesAndCorners(intersectionData, mousePosition) {
    if ((currentTool !== 'rectangle' && currentTool !== 'move') || !intersectionData) {
        clearEdgeCornerHighlights();
        return null;
    }
    
    const object = intersectionData.object;
    const worldPoint = intersectionData.point;
    
    // Get object bounding box
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Calculate screen-space distance for dynamic hit area
    const distance = camera.position.distanceTo(worldPoint);
    const snapDistance = (uiSettings.selection.hitAreaSize / canvas.clientHeight) * distance * Math.tan(camera.fov * Math.PI / 360);
    
    // Define edges and corners based on object geometry
    const edges = getObjectEdges(object, box, size, center);
    const corners = getObjectCorners(object, box, size, center);
    
    // Check for corner proximity first (higher priority)
    for (const corner of corners) {
        const distance = worldPoint.distanceTo(corner.position);
        if (distance < snapDistance) {
            highlightCorner(corner);
            return { type: 'corner', data: corner };
        }
    }
    
    // Check for edge proximity
    for (const edge of edges) {
        const distance = distanceToLineSegment(worldPoint, edge.start, edge.end);
        if (distance < snapDistance) {
            highlightEdge(edge);
            return { type: 'edge', data: edge };
        }
    }
    
    clearEdgeCornerHighlights();
    return null;
}

function getObjectEdges(object, box, size, center) {
    const edges = [];
    
    // Define 12 edges of a box
    const halfSize = size.clone().multiplyScalar(0.5);
    
    // Bottom face edges
    edges.push({
        start: new THREE.Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z - halfSize.z),
        end: new THREE.Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z - halfSize.z),
        normal: new THREE.Vector3(0, -1, 0)
    });
    edges.push({
        start: new THREE.Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z - halfSize.z),
        end: new THREE.Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z + halfSize.z),
        normal: new THREE.Vector3(0, -1, 0)
    });
    edges.push({
        start: new THREE.Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z + halfSize.z),
        end: new THREE.Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z + halfSize.z),
        normal: new THREE.Vector3(0, -1, 0)
    });
    edges.push({
        start: new THREE.Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z + halfSize.z),
        end: new THREE.Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z - halfSize.z),
        normal: new THREE.Vector3(0, -1, 0)
    });
    
    // Top face edges
    edges.push({
        start: new THREE.Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z - halfSize.z),
        end: new THREE.Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z - halfSize.z),
        normal: new THREE.Vector3(0, 1, 0)
    });
    edges.push({
        start: new THREE.Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z - halfSize.z),
        end: new THREE.Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z + halfSize.z),
        normal: new THREE.Vector3(0, 1, 0)
    });
    edges.push({
        start: new THREE.Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z + halfSize.z),
        end: new THREE.Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z + halfSize.z),
        normal: new THREE.Vector3(0, 1, 0)
    });
    edges.push({
        start: new THREE.Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z + halfSize.z),
        end: new THREE.Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z - halfSize.z),
        normal: new THREE.Vector3(0, 1, 0)
    });
    
    // Vertical edges
    edges.push({
        start: new THREE.Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z - halfSize.z),
        end: new THREE.Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z - halfSize.z),
        normal: new THREE.Vector3(-1, 0, -1).normalize()
    });
    edges.push({
        start: new THREE.Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z - halfSize.z),
        end: new THREE.Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z - halfSize.z),
        normal: new THREE.Vector3(1, 0, -1).normalize()
    });
    edges.push({
        start: new THREE.Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z + halfSize.z),
        end: new THREE.Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z + halfSize.z),
        normal: new THREE.Vector3(1, 0, 1).normalize()
    });
    edges.push({
        start: new THREE.Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z + halfSize.z),
        end: new THREE.Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z + halfSize.z),
        normal: new THREE.Vector3(-1, 0, 1).normalize()
    });
    
    return edges;
}

function getObjectCorners(object, box, size, center) {
    const corners = [];
    const halfSize = size.clone().multiplyScalar(0.5);
    
    // 8 corners of a box
    corners.push({ position: new THREE.Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z - halfSize.z) });
    corners.push({ position: new THREE.Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z - halfSize.z) });
    corners.push({ position: new THREE.Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z + halfSize.z) });
    corners.push({ position: new THREE.Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z + halfSize.z) });
    corners.push({ position: new THREE.Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z - halfSize.z) });
    corners.push({ position: new THREE.Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z - halfSize.z) });
    corners.push({ position: new THREE.Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z + halfSize.z) });
    corners.push({ position: new THREE.Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z + halfSize.z) });
    
    return corners;
}

function distanceToLineSegment(point, lineStart, lineEnd) {
    const line = lineEnd.clone().sub(lineStart);
    const pointToStart = point.clone().sub(lineStart);
    
    const lineLength = line.length();
    if (lineLength === 0) return pointToStart.length();
    
    const t = Math.max(0, Math.min(1, pointToStart.dot(line) / (lineLength * lineLength)));
    const closestPoint = lineStart.clone().add(line.multiplyScalar(t));
    
    return point.distanceTo(closestPoint);
}

function highlightEdge(edge) {
    clearEdgeCornerHighlights();
    
    // Create a single tube for edge highlighting using screen-space thickness
    const start = edge.start;
    const end = edge.end;
    const direction = end.clone().sub(start);
    const length = direction.length();
    
    if (length > 0.001) {
        // Calculate screen-space thickness for hover highlights
        const center = start.clone().add(end).multiplyScalar(0.5);
        const distanceToCamera = camera.position.distanceTo(center);
        const pixelsToWorldScale = (distanceToCamera * Math.tan(camera.fov * Math.PI / 360)) / (canvas.clientHeight / 2);
        const tubeRadius = uiSettings.highlights.thickness * pixelsToWorldScale;
        
        const tubeGeometry = new THREE.CylinderGeometry(tubeRadius, tubeRadius, length, 8);
        const tubeMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(uiSettings.highlights.hoverColor),
            transparent: false,
            depthTest: false,
            depthWrite: false
        });
        
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        
        // Position the tube at the center of the edge
        tube.position.copy(center);
        
        // Properly orient the cylinder to align with the edge
        const up = new THREE.Vector3(0, 1, 0);
        direction.normalize();
        
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(up, direction);
        tube.quaternion.copy(quaternion);
        
        tube.userData = { isEdgeHighlight: true, selectable: false };
        tube.renderOrder = 1000;
        
        scene.add(tube);
        edgeHighlights.push(tube);
    }
    
    hoveredEdge = edge;
}

function highlightCorner(corner) {
    clearEdgeCornerHighlights();
    
    // Calculate screen-space size for 16px circle
    const distance = camera.position.distanceTo(corner.position);
    const screenSize = (16 / canvas.clientHeight) * distance * Math.tan(camera.fov * Math.PI / 360);
    
    // Create ring geometry with screen-space appropriate size
    const innerRadius = screenSize * 0.3;
    const outerRadius = screenSize * 0.6;
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 16);
    
    const material = new THREE.MeshBasicMaterial({
        color: 0xff6600, // Orange for corner highlight
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthTest: false, // Render on top
        depthWrite: false
    });
    
    const cornerHighlight = new THREE.Mesh(geometry, material);
    cornerHighlight.position.copy(corner.position);
    cornerHighlight.lookAt(camera.position); // Always face camera
    cornerHighlight.userData = { isCornerHighlight: true, selectable: false };
    cornerHighlight.renderOrder = 1000; // High render order to appear on top
    
    scene.add(cornerHighlight);
    cornerHighlights.push(cornerHighlight);
    
    hoveredCorner = corner;
}

function clearEdgeCornerHighlights() {
    edgeHighlights.forEach(highlight => {
        scene.remove(highlight);
        highlight.geometry.dispose();
        highlight.material.dispose();
    });
    edgeHighlights = [];
    
    cornerHighlights.forEach(highlight => {
        scene.remove(highlight);
        highlight.geometry.dispose();
        highlight.material.dispose();
    });
    cornerHighlights = [];
    
    hoveredEdge = null;
    hoveredCorner = null;
}

function getClosestPointOnEdge(point, edge) {
    const line = edge.end.clone().sub(edge.start);
    const pointToStart = point.clone().sub(edge.start);
    
    const lineLength = line.length();
    if (lineLength === 0) return edge.start.clone();
    
    const t = Math.max(0, Math.min(1, pointToStart.dot(line) / (lineLength * lineLength)));
    return edge.start.clone().add(line.multiplyScalar(t));
}

function updatePropertiesPanel() {
    const propertiesEl = document.getElementById('object-properties');
    if (!propertiesEl) {
        console.error('Properties panel element not found!');
        return;
    }
    
    console.log('Updating properties panel for', selectedObjects.length, 'selected objects');
    
    if (selectedObjects.length === 0) {
        propertiesEl.innerHTML = `
            <div class="property-group">
                <h4>Controls</h4>
                <div style="font-size: 11px; line-height: 1.4; color: #aaa;">
                    <strong>Mode:</strong> ${currentSelectionMode}<br>
                    <strong>F:</strong> Toggle face/object mode<br>
                    <strong>Click:</strong> Select object/face<br>
                    <strong>Click face:</strong> Select for push/pull<br>
                    <strong>Drag face:</strong> Push/pull interactively<br>
                    <strong>Double-click:</strong> Select object to move<br>
                    <strong>R/C:</strong> Create rectangle/circle<br>
                    <strong>Del:</strong> Delete selected<br>
                    <strong>Esc:</strong> Clear selection<br><br>
                    <strong>Property editing:</strong><br>
                    <strong>Type:</strong> Edit value directly<br>
                    <strong>Shift+drag:</strong> Drag to change value<br>
                    <strong>Ctrl+Shift+drag:</strong> Fine adjustment
                </div>
            </div>
            <p style="color: #666; font-style: italic;">No selection</p>
        `;
    } else if (selectedObjects.length === 1) {
        const obj = selectedObjects[0];
        const userData = obj.userData;
        propertiesEl.innerHTML = `
            <div class="property-group">
                <h4>Object</h4>
                <div class="property-row">
                    <span class="property-label">Type:</span>
                    <span class="property-value">${userData.type}</span>
                </div>
                <div class="property-row">
                    <span class="property-label">ID:</span>
                    <span class="property-value">${userData.id}</span>
                </div>
            </div>
            <div class="property-group">
                <h4>Position</h4>
                <div class="property-row">
                    <span class="property-label">X:</span>
                    <div class="property-input-container">
                        <input class="property-input" data-object-id="${userData.id}" data-property="position.x" value="${obj.position.x.toFixed(2)}" />
                        <div class="property-arrows">
                            <div class="property-arrow-up">▲</div>
                            <div class="property-arrow-down">▼</div>
                        </div>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Y:</span>
                    <div class="property-input-container">
                        <input class="property-input" data-object-id="${userData.id}" data-property="position.y" value="${obj.position.y.toFixed(2)}" />
                        <div class="property-arrows">
                            <div class="property-arrow-up">▲</div>
                            <div class="property-arrow-down">▼</div>
                        </div>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Z:</span>
                    <div class="property-input-container">
                        <input class="property-input" data-object-id="${userData.id}" data-property="position.z" value="${obj.position.z.toFixed(2)}" />
                        <div class="property-arrows">
                            <div class="property-arrow-up">▲</div>
                            <div class="property-arrow-down">▼</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="property-group">
                <h4>Dimensions</h4>
                ${userData.width ? `
                <div class="property-row">
                    <span class="property-label">Width:</span>
                    <div class="property-input-container">
                        <input class="property-input" data-object-id="${userData.id}" data-property="width" value="${userData.width.toFixed(2)}" />
                        <div class="property-arrows">
                            <div class="property-arrow-up">▲</div>
                            <div class="property-arrow-down">▼</div>
                        </div>
                    </div>
                </div>
                ` : ''}
                ${userData.height ? `
                <div class="property-row">
                    <span class="property-label">Height:</span>
                    <div class="property-input-container">
                        <input class="property-input" data-object-id="${userData.id}" data-property="height" value="${userData.height.toFixed(2)}" />
                        <div class="property-arrows">
                            <div class="property-arrow-up">▲</div>
                            <div class="property-arrow-down">▼</div>
                        </div>
                    </div>
                </div>
                ` : ''}
                ${userData.depth ? `
                <div class="property-row">
                    <span class="property-label">Length:</span>
                    <div class="property-input-container">
                        <input class="property-input" data-object-id="${userData.id}" data-property="depth" value="${userData.depth.toFixed(2)}" />
                        <div class="property-arrows">
                            <div class="property-arrow-up">▲</div>
                            <div class="property-arrow-down">▼</div>
                        </div>
                    </div>
                </div>
                ` : ''}
                ${userData.radius ? `
                <div class="property-row">
                    <span class="property-label">Radius:</span>
                    <div class="property-input-container">
                        <input class="property-input" data-object-id="${userData.id}" data-property="radius" value="${userData.radius.toFixed(2)}" />
                        <div class="property-arrows">
                            <div class="property-arrow-up">▲</div>
                            <div class="property-arrow-down">▼</div>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
        // Set up property input event listeners
        setupPropertyInputs();
        setupPropertyArrows();
    } else {
        propertiesEl.innerHTML = `<p>Selected: ${selectedObjects.length} objects</p>`;
    }
}

function focusLastChangedProperty() {
    if (!lastChangedProperty) return;
    
    const input = document.querySelector(`input[data-property="${lastChangedProperty}"]`);
    if (input) {
        input.focus();
        input.select(); // Select all text so user can immediately type
        console.log('Focused last changed property:', lastChangedProperty);
    }
}

function setupPropertyArrows() {
    const arrows = document.querySelectorAll('.property-arrow-up, .property-arrow-down');
    
    arrows.forEach(arrow => {
        let isDragging = false;
        let startY = 0;
        let startValue = 0;
        let input = null;
        
        arrow.addEventListener('mousedown', (e) => {
            e.preventDefault();
            
            // Find the associated input field
            input = arrow.closest('.property-input-container').querySelector('.property-input');
            if (!input) return;
            
            isDragging = true;
            startY = e.clientY;
            startValue = parseFloat(input.value) || 0;
            
            arrow.style.cursor = 'ns-resize';
            document.body.style.cursor = 'ns-resize';
            
            const handleMouseMove = (e) => {
                if (!isDragging || !input) return;
                
                const deltaY = startY - e.clientY; // Invert so up is positive
                const sensitivity = e.shiftKey ? 0.01 : 0.1; // Fine control with shift
                const increment = deltaY * sensitivity;
                
                let newValue = startValue + increment;
                
                // Clamp to reasonable values
                const property = input.dataset.property;
                if (property === 'position.x' || property === 'position.y' || property === 'position.z') {
                    // Allow negative positions
                    newValue = Math.max(-1000, Math.min(1000, newValue));
                } else {
                    // Dimensions should be positive
                    newValue = Math.max(0.01, Math.min(1000, newValue));
                }
                
                input.value = newValue.toFixed(2);
                updateObjectProperty(input);
            };
            
            const handleMouseUp = () => {
                isDragging = false;
                arrow.style.cursor = 'pointer';
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    });
}

function setupPropertyInputs() {
    const inputs = document.querySelectorAll('.property-input');
    inputs.forEach(input => {
        let isDragging = false;
        let startY = 0;
        let startValue = 0;
        
        // Handle direct input changes
        input.addEventListener('change', () => {
            updateObjectProperty(input);
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
        
        // Handle drag to change values
        input.addEventListener('mousedown', (e) => {
            if (e.shiftKey) {
                isDragging = true;
                startY = e.clientY;
                startValue = parseFloat(input.value) || 0;
                input.style.cursor = 'ns-resize';
                e.preventDefault();
                
                const handleMouseMove = (e) => {
                    if (!isDragging) return;
                    
                    const deltaY = startY - e.clientY;
                    const sensitivity = e.ctrlKey ? 0.01 : 0.1;
                    const newValue = startValue + (deltaY * sensitivity);
                    
                    input.value = newValue.toFixed(2);
                    updateObjectProperty(input);
                };
                
                const handleMouseUp = () => {
                    isDragging = false;
                    input.style.cursor = '';
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }
        });
    });
}

function updateObjectProperty(input) {
    const objectId = parseInt(input.dataset.objectId);
    const property = input.dataset.property;
    const value = parseFloat(input.value) || 0;
    
    // Track this as the last changed property for Tab navigation
    lastChangedProperty = property;
    console.log('Property changed:', property);
    
    const object = objects.find(obj => obj.userData.id === objectId);
    if (!object) return;
    
    // Update the property
    if (property.startsWith('position.')) {
        const axis = property.split('.')[1];
        object.position[axis] = value;
        // Update edge highlights when position changes
        syncEdgeHighlightTransform(object);
    } else if (property === 'width' || property === 'height' || property === 'depth' || property === 'radius') {
        object.userData[property] = value;
        
        // Update geometry
        if (property === 'width' || property === 'height' || property === 'depth') {
            if (object.geometry instanceof THREE.PlaneGeometry && object.userData.width && object.userData.height) {
                object.geometry.dispose();
                object.geometry = new THREE.PlaneGeometry(object.userData.width, object.userData.height);
            } else if (object.geometry instanceof THREE.BoxGeometry && object.userData.width && object.userData.height && object.userData.depth) {
                object.geometry.dispose();
                object.geometry = new THREE.BoxGeometry(object.userData.width, object.userData.height, object.userData.depth);
                object.position.y = object.userData.depth / 2 + 0.01;
            }
            // Update edge highlights after geometry change
            updateObjectEdgeHighlight(object);
        } else if (property === 'radius' && object.geometry instanceof THREE.CircleGeometry) {
            object.geometry.dispose();
            object.geometry = new THREE.CircleGeometry(object.userData.radius, 32);
            // Update edge highlights after geometry change
            updateObjectEdgeHighlight(object);
        }
    }
}

function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    
    // Check if an input field is focused - if so, disable most shortcuts
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
    );
    
    // Handle Tab navigation for properties panel
    if (key === 'tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (lastChangedProperty && selectedObjects.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            focusLastChangedProperty();
            return;
        }
        // If no last changed property, but we're trying to focus properties, prevent default tab behavior
        if (selectedObjects.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            // Focus the first property input as fallback
            const firstInput = document.querySelector('.property-input');
            if (firstInput) {
                firstInput.focus();
                firstInput.select();
            }
            return;
        }
    }
    
    // Skip tool shortcuts if input is focused (except Tab and Escape)
    if (isInputFocused && key !== 'escape') {
        return;
    }
    
    // Handle Cmd+D / Ctrl+D for duplication
    if ((event.metaKey || event.ctrlKey) && key === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
    }
    
    // Tool shortcuts - number keys and letters
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        switch (key) {
            case '1':
            case 's':
                event.preventDefault();
                setTool('select');
                break;
            case '2':
            case 'p':
                event.preventDefault();
                setTool('push');
                break;
            case '3':
            case 'm':
                event.preventDefault();
                setTool('move');
                break;
            case '4':
                event.preventDefault();
                setTool('rotate');
                break;
            case '5':
            case 'r':
                event.preventDefault();
                setTool('rectangle');
                break;
            case '6':
            case 'c':
                event.preventDefault();
                setTool('circle');
                break;
            case 'f':
                event.preventDefault();
                toggleSelectionMode();
                break;
            case 'u':
                event.preventDefault();
                // Toggle UI settings panel
                const uiSettingsPanel = document.getElementById('ui-settings-panel');
                if (uiSettingsPanel) {
                    if (uiSettingsPanel.style.display === 'block') {
                        uiSettingsPanel.style.display = 'none';
                    } else {
                        uiSettingsPanel.style.display = 'block';
                        loadUISettingsToPanel();
                    }
                }
                break;
            case 'delete':
            case 'backspace':
                event.preventDefault();
                deleteSelected();
                break;
            case 'escape':
                event.preventDefault();
                if (isCreatingRectangle) {
                    cancelRectangleCreation();
                } else if (isCreatingCircle) {
                    cancelCircleCreation();
                } else {
                    currentSelectionMode = SELECTION_MODE.OBJECT;
                    clearSelection();
                    canvas.style.cursor = 'default';
                }
                break;
        }
    }
}

function toggleSelectionMode() {
    currentSelectionMode = currentSelectionMode === SELECTION_MODE.OBJECT ? 
        SELECTION_MODE.FACE : SELECTION_MODE.OBJECT;
    
    const statusEl = document.getElementById('tool-status');
    if (statusEl) {
        statusEl.textContent = `Select Tool (${currentSelectionMode} mode)`;
    }
    
    console.log('Selection mode:', currentSelectionMode);
}

function startInteractivePushPull(event) {
    if (!selectedFace) return;
    
    console.log('Starting interactive push/pull');
    isPushPulling = true;
    wasInteracting = true; // Prevent click deselection on mouse up
    controls.enabled = false; // Disable camera controls during push/pull
    canvas.style.cursor = 'grabbing';
    
    // Hide the selected face highlight during dragging
    if (selectedFace.object && selectedFace.object.selectedFaceHighlight) {
        selectedFace.object.selectedFaceHighlight.visible = false;
    }
    
    const object = selectedFace.object;
    const face = selectedFace.face;
    const normal = face.normal;
    
    // Store initial mouse position for screen-space calculation
    const rect = canvas.getBoundingClientRect();
    const startMouseX = event.clientX - rect.left;
    const startMouseY = event.clientY - rect.top;
    
    // If it's a plane or circle, convert to 3D geometry first
    if (object.geometry instanceof THREE.PlaneGeometry) {
        const userData = object.userData;
        let width = userData.width || 2;
        let height = userData.height || 2;
        
        // Clamp dimensions to reasonable values to prevent invisible huge objects
        width = Math.min(Math.max(width, 0.01), 100);
        height = Math.min(Math.max(height, 0.01), 100);
        
        console.log('Converting plane to box - width:', width, 'height:', height, 'createdOnFace:', userData.createdOnFace);
        
        if (userData.createdOnFace) {
            // Rectangle created on a face - maintain orientation
            // For face-created rectangles, the extrusion should be thin in the face-normal direction
            // Since the plane was already oriented correctly, create a thin box in the same dimensions
            const newGeometry = new THREE.BoxGeometry(width, height, 0.5);
            object.geometry.dispose();
            object.geometry = newGeometry;
            
            object.userData.type = 'extruded-rectangle';
            object.userData.width = width;   // X dimension (same as plane width)
            object.userData.height = height; // Y dimension (same as plane height)
            object.userData.depth = 0.5;     // Z dimension (initial extrusion)
            
            // Keep the existing rotation and position - don't reset to ground orientation
            // The face normal direction is preserved via rotation
            
            // Ensure selectable property is preserved
            object.userData.selectable = true;
            
            // Remove the createdOnFace flag since it's now a proper 3D object
            delete object.userData.createdOnFace;
            // Keep face normal for future reference during push/pull operations
            // object.userData.faceNormal is preserved
            
            // Update the selected face to match the new box geometry
            // Find the appropriate face on the new box that corresponds to the front face (for extrusion)
            if (selectedFace && selectedFace.object === object) {
                // For face-created rectangles, the face to extrude is typically the "front" face
                // This is face index 10 or 11 in BoxGeometry (front faces in three.js)
                selectedFace.faceIndex = 10; // Front face of the box
                // Update face normal to point along the depth axis (local Z)
                selectedFace.face = { normal: new THREE.Vector3(0, 0, 1) };
                selectedFace.worldNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion);
            }
            
            console.log('Converted face-created rectangle to box, selectable:', object.userData.selectable);
        } else {
            // Rectangle created on ground - use original logic
            const newGeometry = new THREE.BoxGeometry(width, 0.5, height);
            object.geometry.dispose();
            object.geometry = newGeometry;
            
            object.userData.type = 'extruded-rectangle';
            object.userData.width = width;   // X dimension
            object.userData.height = 0.5;    // Y dimension (initial extrusion)
            object.userData.depth = height;  // Z dimension
            
            // Ensure selectable property is preserved
            object.userData.selectable = true;
            
            // Remove rotation since we're now a proper box
            object.rotation.x = 0;
            object.position.y = 0.5 / 2 + 0.01; // Position at correct height for new thickness
            
            // Update the selected face to match the new box geometry
            if (selectedFace && selectedFace.object === object) {
                // For ground-created rectangles, extrude upward (top face)
                selectedFace.faceIndex = 8; // Top face of the box
                selectedFace.face = { normal: new THREE.Vector3(0, 1, 0) };
                selectedFace.worldNormal = new THREE.Vector3(0, 1, 0);
            }
            
            console.log('Converted ground rectangle to box, selectable:', object.userData.selectable);
        }
        
        // Clear any existing highlights to force refresh
        if (object.edgeHighlight) {
            scene.remove(object.edgeHighlight);
            object.edgeHighlight.geometry.dispose();
            object.edgeHighlight.material.dispose();
            object.edgeHighlight = null;
        }
        if (object.selectedFaceHighlight) {
            scene.remove(object.selectedFaceHighlight);
            object.selectedFaceHighlight.geometry.dispose();
            object.selectedFaceHighlight.material.dispose();
            object.selectedFaceHighlight = null;
        }
        
        // Refresh edge highlights for selected objects
        if (selectedObjects.includes(object)) {
            addObjectEdgeHighlight(object);
        }
        
        // Debug: Log all scene objects to identify shadow caster
        console.log('Scene objects after conversion:', scene.children.filter(child => child.castShadow).map(child => ({
            type: child.geometry?.type,
            dimensions: child.geometry?.parameters,
            position: child.position,
            scale: child.scale,
            visible: child.visible,
            id: child.userData?.id,
            name: child.name,
            isPreview: child.userData?.isPreview
        })));
        
        // Check for any extremely large objects that could be casting shadows
        scene.children.forEach(child => {
            if (child.castShadow && child.geometry && child.geometry.parameters) {
                const params = child.geometry.parameters;
                const maxDim = Math.max(params.width || 0, params.height || 0, params.depth || 0, params.radius || 0) * Math.max(child.scale.x, child.scale.y, child.scale.z);
                if (maxDim > 50) {
                    console.warn('Large shadow caster found:', {
                        name: child.name || 'unnamed',
                        id: child.userData?.id,
                        maxDimension: maxDim,
                        parameters: params,
                        scale: child.scale,
                        position: child.position
                    });
                }
            }
        });
        
        // Update properties panel to reflect new geometry
        updatePropertiesPanel();
    } else if (object.geometry instanceof THREE.CircleGeometry) {
        const userData = object.userData;
        const radius = userData.radius || 1;
        
        // Convert circle to cylinder
        const newGeometry = new THREE.CylinderGeometry(radius, radius, 0.1, 16);
        object.geometry.dispose();
        object.geometry = newGeometry;
        
        object.userData.type = 'extruded-circle';
        object.userData.radius = radius;
        object.userData.height = 0.1;
        
        // Remove rotation since we're now a proper cylinder
        object.rotation.x = 0;
        object.position.y = 0.1 / 2 + 0.01;
        
        // Clear any existing highlights to force refresh
        if (object.edgeHighlight) {
            scene.remove(object.edgeHighlight);
            object.edgeHighlight.geometry.dispose();
            object.edgeHighlight.material.dispose();
            object.edgeHighlight = null;
        }
        if (object.selectedFaceHighlight) {
            scene.remove(object.selectedFaceHighlight);
            object.selectedFaceHighlight.geometry.dispose();
            object.selectedFaceHighlight.material.dispose();
            object.selectedFaceHighlight = null;
        }
        
        // Refresh edge highlights for selected objects
        if (selectedObjects.includes(object)) {
            addObjectEdgeHighlight(object);
        }
        
        // Update properties panel to reflect new geometry
        updatePropertiesPanel();
    }
    
    // Store initial dimensions and position at the moment push/pull starts
    // Always use current dimensions as the starting point for this operation
    const userData = object.userData;
    object.userData.initialWidth = userData.width || 2;
    object.userData.initialHeight = userData.height || 2;  
    object.userData.initialDepth = userData.depth || 2;
    object.userData.initialPosition = object.position.clone(); // Current position, not original
    
    console.log('Starting push/pull with current dimensions as initial:', {
        width: object.userData.initialWidth,
        height: object.userData.initialHeight, 
        depth: object.userData.initialDepth,
        position: object.userData.initialPosition
    });
    object.userData.startMouseX = startMouseX;
    object.userData.startMouseY = startMouseY;
    
    console.log('Stored initial position:', object.userData.initialPosition, 'Initial dimensions:', 
                object.userData.initialWidth, object.userData.initialHeight, object.userData.initialDepth);
    
    // Calculate screen-space direction for this face normal using world normal
    const screenDirection = calculateScreenSpaceDirection(selectedFace.worldNormal);
    object.userData.screenDirection = screenDirection;
    
    console.log('Push/pull started, face normal:', normal, 'screen direction:', screenDirection);
}

function calculateScreenSpaceDirection(worldNormal) {
    // Use the already transformed world normal
    const normal = worldNormal.clone().normalize();
    
    // Get camera direction vectors in world space
    const cameraRight = new THREE.Vector3(1, 0, 0);
    const cameraUp = new THREE.Vector3(0, 1, 0);
    
    // Transform camera vectors to world space
    cameraRight.transformDirection(camera.matrixWorld);
    cameraUp.transformDirection(camera.matrixWorld);
    
    // Calculate how much the face normal aligns with camera right/up vectors
    const rightAlignment = Math.abs(normal.dot(cameraRight));
    const upAlignment = Math.abs(normal.dot(cameraUp));
    
    // Choose the direction that gives the most intuitive movement
    if (upAlignment > rightAlignment) {
        return {
            type: 'vertical',
            sign: normal.dot(cameraUp) > 0 ? 1 : -1
        };
    } else {
        return {
            type: 'horizontal', 
            sign: normal.dot(cameraRight) > 0 ? 1 : -1
        };
    }
}

function updateInteractivePushPull(event) {
    if (!isPushPulling || !selectedFace) return;
    
    const object = selectedFace.object;
    const rect = canvas.getBoundingClientRect();
    const currentMouseX = event.clientX - rect.left;
    const currentMouseY = event.clientY - rect.top;
    
    const startMouseX = object.userData.startMouseX || 0;
    const startMouseY = object.userData.startMouseY || 0;
    const screenDirection = object.userData.screenDirection || { type: 'vertical', sign: 1 };
    
    // Calculate mouse delta with 1:1 movement ratio
    let mouseDelta;
    
    // Convert mouse pixels to world units for 1:1 movement
    const worldUnitsPerPixel = 0.01; // Adjust this for proper 1:1 ratio
    
    if (screenDirection.type === 'horizontal') {
        mouseDelta = (currentMouseX - startMouseX) * worldUnitsPerPixel * screenDirection.sign;
    } else {
        mouseDelta = (startMouseY - currentMouseY) * worldUnitsPerPixel * screenDirection.sign; // Inverted Y for intuitive feel
    }
    
    // Get initial values
    const initialWidth = object.userData.initialWidth;
    const initialHeight = object.userData.initialHeight;
    const initialDepth = object.userData.initialDepth;
    const initialPosition = object.userData.initialPosition;
    
    const face = selectedFace.face;
    const worldNormal = selectedFace.worldNormal;
    
    // Calculate new dimensions and position to keep opposite face stationary
    let newWidth = initialWidth;
    let newHeight = initialHeight;
    let newDepth = initialDepth;
    let newPosition = initialPosition.clone();
    
    // Special handling for rectangles created on faces (check if faceNormal exists)
    if (object.userData.faceNormal && object.userData.type === 'extruded-rectangle') {
        // For face-created rectangles, always extrude along depth (local Z-axis)
        // Keep the object center stationary - just change the depth dimension
        newDepth = Math.max(0.01, initialDepth + mouseDelta);
        
        // Don't move the position - keep it centered
        // This ensures the rectangle doesn't slide along the axis during extrusion
        console.log('Face-created rectangle extrusion - depth:', initialDepth, '->', newDepth);
    } else if (Math.abs(worldNormal.y) > 0.9) {
        // Top or bottom face in world space - change height
        if (worldNormal.y > 0) {
            // Top face - extend upward with positive mouse movement
            newHeight = Math.max(0.01, initialHeight + mouseDelta);
            newPosition.y = initialPosition.y - initialHeight/2 + newHeight/2;
        } else {
            // Bottom face - extend downward with positive mouse movement (invert delta)
            newHeight = Math.max(0.01, initialHeight + mouseDelta);
            newPosition.y = initialPosition.y + initialHeight/2 - newHeight/2;
        }
    } else if (Math.abs(worldNormal.x) > 0.9) {
        // Left or right face in world space - change width
        if (worldNormal.x > 0) {
            // Right face - extend right with positive mouse movement
            newWidth = Math.max(0.01, initialWidth + mouseDelta);
            newPosition.x = initialPosition.x - initialWidth/2 + newWidth/2;
        } else {
            // Left face - extend left with positive mouse movement (invert delta)
            newWidth = Math.max(0.01, initialWidth + mouseDelta);
            newPosition.x = initialPosition.x + initialWidth/2 - newWidth/2;
        }
    } else if (Math.abs(worldNormal.z) > 0.9) {
        // Front or back face in world space - change depth
        if (worldNormal.z > 0) {
            // Front face - extend forward with positive mouse movement
            newDepth = Math.max(0.01, initialDepth + mouseDelta);
            newPosition.z = initialPosition.z - initialDepth/2 + newDepth/2;
        } else {
            // Back face - extend backward with positive mouse movement (invert delta)
            newDepth = Math.max(0.01, initialDepth + mouseDelta);
            newPosition.z = initialPosition.z + initialDepth/2 - newDepth/2;
        }
    }
    
    // Update geometry based on object type
    object.geometry.dispose();
    
    if (object.geometry.type === 'CylinderGeometry' || object.userData.type === 'extruded-circle') {
        // For cylinders, only height changes (radius stays the same)
        const radius = object.userData.radius || 1;
        object.geometry = new THREE.CylinderGeometry(radius, radius, newHeight, 16);
        object.userData.radius = radius;
    } else {
        // For boxes
        object.geometry = new THREE.BoxGeometry(newWidth, newHeight, newDepth);
        object.userData.width = newWidth;
        object.userData.depth = newDepth;
    }
    
    // Update position
    object.position.copy(newPosition);
    
    // Update userData
    object.userData.height = newHeight;
    if (!(object.geometry.type === 'CylinderGeometry' || object.userData.type === 'extruded-circle')) {
        object.userData.width = newWidth;
        object.userData.depth = newDepth;
    }
    
    // Update edge highlights to match new geometry
    updateObjectEdgeHighlight(object);
    
    // Update the selected face highlight position
    updateSelectedFaceHighlight();
}

function updateSelectedFaceHighlight() {
    if (!selectedFace || !selectedFace.object) return;
    
    const object = selectedFace.object;
    
    // Remove old highlight if it exists
    if (object.selectedFaceHighlight) {
        scene.remove(object.selectedFaceHighlight);
        object.selectedFaceHighlight.geometry.dispose();
        object.selectedFaceHighlight.material.dispose();
        object.selectedFaceHighlight = null;
    }
    
    // Create new highlight with updated position and size
    highlightSelectedFace(selectedFace);
}

function endInteractivePushPull() {
    if (!isPushPulling) return;
    
    isPushPulling = false;
    canvas.style.cursor = 'grab';
    
    // Reset interaction flag to allow future clicks
    wasInteracting = false;
    
    // Show the selected face highlight again
    if (selectedFace && selectedFace.object && selectedFace.object.selectedFaceHighlight) {
        selectedFace.object.selectedFaceHighlight.visible = true;
    }
    
    if (selectedFace && selectedFace.object) {
        // Clean up temporary data
        delete selectedFace.object.userData.startMouseX;
        delete selectedFace.object.userData.startMouseY;
        delete selectedFace.object.userData.initialWidth;
        delete selectedFace.object.userData.initialHeight;
        delete selectedFace.object.userData.initialDepth;
        delete selectedFace.object.userData.initialPosition;
        delete selectedFace.object.userData.screenDirection;
        
        // Clean up any orphaned highlights
        clearAllHighlights();
        
        console.log('Push/pull completed');
        updatePropertiesPanel();
    }
}

function deleteSelected() {
    if (selectedObjects.length === 0) return;
    
    selectedObjects.forEach(obj => {
        // Remove from objects array
        const index = objects.indexOf(obj);
        if (index > -1) {
            objects.splice(index, 1);
        }
        
        // Clean up highlights
        removeObjectEdgeHighlight(obj);
        removeBoundingBox(obj);
        
        // Remove from scene
        scene.remove(obj);
        
        // Dispose of resources
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    });
    
    selectedObjects = [];
    updatePropertiesPanel();
    console.log('Deleted selected objects');
}

function highlightRelevantProperty() {
    if (!selectedFace || !selectedFace.object) return;
    
    const object = selectedFace.object;
    const worldNormal = selectedFace.worldNormal;
    
    // Determine which property to highlight based on the face being pushed
    let propertyToHighlight = '';
    
    if (Math.abs(worldNormal.y) > 0.9) {
        // Top or bottom face - highlight height
        propertyToHighlight = 'height';
    } else if (Math.abs(worldNormal.x) > 0.9) {
        // Left or right face - highlight width
        propertyToHighlight = 'width';
    } else if (Math.abs(worldNormal.z) > 0.9) {
        // Front or back face - highlight depth
        propertyToHighlight = 'depth';
    }
    
    if (propertyToHighlight) {
        const objectId = object.userData.id;
        const input = document.querySelector(`input[data-object-id="${objectId}"][data-property="${propertyToHighlight}"]`);
        
        if (input) {
            input.focus();
            input.select();
            console.log('Highlighted property:', propertyToHighlight);
        }
    }
}

function updateCoordinates() {
    const target = controls.target;
    const coordsEl = document.getElementById('coordinates');
    if (coordsEl) {
        coordsEl.textContent = `X: ${target.x.toFixed(1)}, Y: ${target.y.toFixed(1)}, Z: ${target.z.toFixed(1)}`;
    }
}

function updateStatus(message) {
    const coordsEl = document.getElementById('coordinates');
    if (coordsEl) coordsEl.textContent = message;
}

function onWindowResize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls) {
        controls.update();
    }
    
    // Update bounding boxes
    updateBoundingBoxes();
    
    renderer.render(scene, camera);
}

function updateBoundingBoxes() {
    boundingBoxHelpers.forEach((box, object) => {
        box.update();
    });
}

// Start the application
// UI Settings functions
function setupUISettingsInputs() {
    // Add change listeners to all UI settings inputs
    const inputs = [
        'ui-bg-color', 'ui-grid-size', 'ui-grid-divisions', 'ui-grid-main-color', 'ui-grid-sub-color',
        'ui-edge-color', 'ui-edge-thickness', 'ui-corner-size', 'ui-hit-area',
        'ui-hover-color', 'ui-snap-color', 'ui-highlight-thickness',
        'ui-shadows-enabled', 'ui-wireframe-mode'
    ];
    
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', applyUISettings);
            input.addEventListener('input', applyUISettings); // Real-time updates while typing/dragging
        }
    });
    
    // Add drag functionality to arrow buttons for real-time updates
    setupArrowDragHandlers();
}

function loadUISettingsToPanel() {
    // Load current settings into the panel
    document.getElementById('ui-bg-color').value = uiSettings.background.color;
    document.getElementById('ui-grid-size').value = uiSettings.grid.size;
    document.getElementById('ui-grid-divisions').value = uiSettings.grid.divisions;
    document.getElementById('ui-grid-main-color').value = uiSettings.grid.mainColor;
    document.getElementById('ui-grid-sub-color').value = uiSettings.grid.subColor;
    document.getElementById('ui-edge-color').value = uiSettings.selection.edgeColor;
    document.getElementById('ui-edge-thickness').value = uiSettings.selection.thickness;
    document.getElementById('ui-corner-size').value = uiSettings.selection.cornerSize;
    document.getElementById('ui-hit-area').value = uiSettings.selection.hitAreaSize;
    document.getElementById('ui-hover-color').value = uiSettings.highlights.hoverColor;
    document.getElementById('ui-snap-color').value = uiSettings.highlights.snapColor;
    document.getElementById('ui-highlight-thickness').value = uiSettings.highlights.thickness;
    document.getElementById('ui-shadows-enabled').checked = uiSettings.rendering.shadowsEnabled;
    document.getElementById('ui-wireframe-mode').checked = uiSettings.rendering.wireframeMode;
}

function applyUISettings() {
    // Read values from inputs
    uiSettings.background.color = document.getElementById('ui-bg-color').value;
    uiSettings.grid.size = parseInt(document.getElementById('ui-grid-size').value);
    uiSettings.grid.divisions = parseInt(document.getElementById('ui-grid-divisions').value);
    uiSettings.grid.mainColor = document.getElementById('ui-grid-main-color').value;
    uiSettings.grid.subColor = document.getElementById('ui-grid-sub-color').value;
    uiSettings.selection.edgeColor = document.getElementById('ui-edge-color').value;
    uiSettings.selection.thickness = parseInt(document.getElementById('ui-edge-thickness').value);
    uiSettings.selection.cornerSize = parseFloat(document.getElementById('ui-corner-size').value);
    uiSettings.selection.hitAreaSize = parseInt(document.getElementById('ui-hit-area').value);
    uiSettings.highlights.hoverColor = document.getElementById('ui-hover-color').value;
    uiSettings.highlights.snapColor = document.getElementById('ui-snap-color').value;
    uiSettings.highlights.thickness = parseInt(document.getElementById('ui-highlight-thickness').value);
    uiSettings.rendering.shadowsEnabled = document.getElementById('ui-shadows-enabled').checked;
    uiSettings.rendering.wireframeMode = document.getElementById('ui-wireframe-mode').checked;
    
    // Apply settings to the scene
    updateSceneWithSettings();
}

function updateSceneWithSettings() {
    // Update background color
    const bgColor = new THREE.Color(uiSettings.background.color);
    scene.background = bgColor;
    
    // Update grid
    updateGridWithSettings();
    
    // Update selection materials and highlighting
    updateSelectionMaterials();
    
    // Update rendering settings
    updateRenderingSettings();
    
    console.log('Applied UI settings:', uiSettings);
}

function updateRenderingSettings() {
    // Update shadow settings
    renderer.shadowMap.enabled = uiSettings.rendering.shadowsEnabled;
    
    // Update all objects shadow casting/receiving based on setting
    scene.traverse(child => {
        if (child.isMesh && child.userData && !child.userData.isGrid && !child.userData.isAxes) {
            child.castShadow = uiSettings.rendering.shadowsEnabled;
            child.receiveShadow = uiSettings.rendering.shadowsEnabled;
        }
    });
    
    // Update wireframe mode
    objects.forEach(obj => {
        if (obj.material) {
            obj.material.wireframe = uiSettings.rendering.wireframeMode;
        }
    });
    
    console.log('Updated rendering settings - shadows:', uiSettings.rendering.shadowsEnabled, 'wireframe:', uiSettings.rendering.wireframeMode);
}

function updateGridWithSettings() {
    // Remove existing grid
    const existingGrid = scene.getObjectByName('grid');
    const existingSubGrid = scene.getObjectByName('subgrid');
    
    if (existingGrid) scene.remove(existingGrid);
    if (existingSubGrid) scene.remove(existingSubGrid);
    
    // Create new grid with updated settings
    const mainColor = new THREE.Color(uiSettings.grid.mainColor);
    const subColor = new THREE.Color(uiSettings.grid.subColor);
    
    const grid = new THREE.GridHelper(uiSettings.grid.size, uiSettings.grid.divisions, mainColor, mainColor);
    grid.name = 'grid';
    grid.userData = { isGrid: true, selectable: false };
    grid.renderOrder = -2;
    scene.add(grid);
    
    const subGrid = new THREE.GridHelper(uiSettings.grid.size, uiSettings.grid.divisions * 10, subColor, subColor);
    subGrid.name = 'subgrid';
    subGrid.userData = { isGrid: true, selectable: false };
    subGrid.renderOrder = -3;
    scene.add(subGrid);
}

function updateSelectionMaterials() {
    const edgeColor = new THREE.Color(uiSettings.selection.edgeColor);
    
    // Update existing edge highlights with new color
    objects.forEach(obj => {
        if (obj.edgeHighlight) {
            // Remove existing highlight
            scene.remove(obj.edgeHighlight);
            obj.edgeHighlight.geometry.dispose();
            obj.edgeHighlight.material.dispose();
            obj.edgeHighlight = null;
            
            // Recreate with new settings if object is selected
            if (selectedObjects.includes(obj)) {
                addObjectEdgeHighlight(obj);
            }
        }
    });
    
    // Update material colors for highlighting functions
    updateHighlightMaterials();
}

function updateHighlightMaterials() {
    // Update materials used by highlighting functions
    hoverMaterial.color.copy(new THREE.Color(uiSettings.highlights.hoverColor));
    snapMaterial.color.copy(new THREE.Color(uiSettings.highlights.snapColor));
}

function saveUISettings() {
    try {
        applyUISettings(); // Make sure current values are captured
        localStorage.setItem('modler-ui-settings', JSON.stringify(uiSettings));
        console.log('UI settings saved to localStorage');
        
        // Also save to file
        const dataStr = JSON.stringify(uiSettings, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'modler-settings.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('Settings saved to localStorage and downloaded as file!');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Error saving settings: ' + error.message);
    }
}

function loadUISettings() {
    try {
        const saved = localStorage.getItem('modler-ui-settings');
        if (saved) {
            uiSettings = JSON.parse(saved);
            loadUISettingsToPanel();
            updateSceneWithSettings();
            console.log('UI settings loaded from localStorage');
            alert('Settings loaded from localStorage!');
        } else {
            alert('No saved settings found in localStorage');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        alert('Error loading settings: ' + error.message);
    }
}

function resetUISettings() {
    uiSettings = {
        background: { color: '#1a1a1a' },
        grid: {
            size: 50,
            divisions: 50,
            mainColor: '#666666',
            subColor: '#333333'
        },
        selection: {
            edgeColor: '#0078d4',
            thickness: 2,
            cornerSize: 0.05,
            hitAreaSize: 24
        },
        highlights: {
            hoverColor: '#ff6600',
            snapColor: '#00ff00',
            thickness: 1
        },
        rendering: {
            shadowsEnabled: true,
            wireframeMode: false
        }
    };
    
    loadUISettingsToPanel();
    updateSceneWithSettings();
    console.log('UI settings reset to defaults');
    alert('Settings reset to defaults!');
}

// Load settings on startup
function initUISettings() {
    const saved = localStorage.getItem('modler-ui-settings');
    if (saved) {
        try {
            uiSettings = JSON.parse(saved);
            console.log('Loaded UI settings from localStorage on startup');
        } catch (error) {
            console.error('Error loading saved settings, using defaults:', error);
        }
    }
    updateSceneWithSettings();
}

// Debug function to inspect all scene objects
function debugSceneObjects() {
    console.log('=== SCENE DEBUG ===');
    console.log('Total scene children:', scene.children.length);
    
    const shadowCasters = scene.children.filter(child => child.castShadow);
    console.log('Shadow casters:', shadowCasters.length);
    
    shadowCasters.forEach((child, index) => {
        const params = child.geometry?.parameters || {};
        const maxDim = Math.max(params.width || 0, params.height || 0, params.depth || 0, params.radius || 0);
        console.log(`Shadow caster ${index}:`, {
            name: child.name || 'unnamed',
            type: child.geometry?.type,
            id: child.userData?.id,
            maxDim: maxDim,
            scale: child.scale,
            position: child.position,
            visible: child.visible,
            isPreview: child.userData?.isPreview,
            isSelectable: child.userData?.selectable
        });
    });
    
    // Check objects array vs scene children
    console.log('Objects array length:', objects.length);
    console.log('Scene children - objects mismatch:', scene.children.length - objects.length);
}

// Arrow drag handlers for real-time value changes
function setupArrowDragHandlers() {
    // Find all arrow buttons in UI settings panel
    const arrows = document.querySelectorAll('#ui-settings-panel .property-arrow-up, #ui-settings-panel .property-arrow-down');
    
    arrows.forEach(arrow => {
        let isDragging = false;
        let dragStartY = 0;
        let dragStartValue = 0;
        let targetInput = null;
        
        arrow.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            dragStartY = e.clientY;
            
            // Find the associated input
            targetInput = arrow.closest('.property-input-container').querySelector('.property-input');
            dragStartValue = parseFloat(targetInput.value) || 0;
            
            // Add global mouse move and up listeners
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        
        function onMouseMove(e) {
            if (!isDragging || !targetInput) return;
            
            const deltaY = dragStartY - e.clientY; // Invert for intuitive up/down
            const step = parseFloat(targetInput.step) || 1;
            const sensitivity = 0.1; // Pixels per step
            
            const newValue = dragStartValue + (deltaY * sensitivity * step);
            const min = parseFloat(targetInput.min) || -Infinity;
            const max = parseFloat(targetInput.max) || Infinity;
            
            const clampedValue = Math.max(min, Math.min(max, newValue));
            targetInput.value = clampedValue;
            
            // Trigger real-time update
            applyUISettings();
        }
        
        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    });
}

// Function to find and remove problematic shadow casters
function cleanupShadowCasters() {
    console.log('=== SHADOW CLEANUP ===');
    const toRemove = [];
    
    scene.children.forEach(child => {
        if (child.castShadow && child.geometry && child.geometry.parameters) {
            const params = child.geometry.parameters;
            const maxDim = Math.max(params.width || 0, params.height || 0, params.depth || 0, params.radius || 0);
            
            // Check for huge objects that shouldn't be shadow casters
            if (maxDim > 30) {
                console.warn('Found large shadow caster to remove:', {
                    name: child.name || 'unnamed',
                    id: child.userData?.id,
                    maxDim: maxDim,
                    parameters: params,
                    position: child.position
                });
                toRemove.push(child);
            }
        }
    });
    
    // Remove problematic objects
    toRemove.forEach(obj => {
        console.log('Removing large shadow caster:', obj.userData?.id || obj.name);
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
        
        // Remove from objects array if it exists there
        const index = objects.indexOf(obj);
        if (index > -1) {
            objects.splice(index, 1);
        }
    });
    
    console.log(`Removed ${toRemove.length} problematic shadow casters`);
}

// Function to create thick edge highlights using mesh tubes
function createThickEdgeHighlight(geometry, color, thickness) {
    const group = new THREE.Group();
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeColor = new THREE.Color(color);
    
    // Get edge positions
    const positions = edges.attributes.position.array;
    
    // Create tubes for each edge
    for (let i = 0; i < positions.length; i += 6) {
        const start = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        const end = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
        
        // Calculate tube parameters
        const direction = end.clone().sub(start);
        const length = direction.length();
        
        if (length > 0.001) { // Only create tube if edge has meaningful length
            // Calculate screen-space thickness
            // Get the center point of the edge to calculate camera distance
            const center = start.clone().add(end).multiplyScalar(0.5);
            const distanceToCamera = camera.position.distanceTo(center);
            
            // Convert pixel thickness to world space at this distance
            // thickness is in pixels, convert to world space based on camera FOV and distance
            const pixelsToWorldScale = (distanceToCamera * Math.tan(camera.fov * Math.PI / 360)) / (canvas.clientHeight / 2);
            const tubeRadius = thickness * pixelsToWorldScale; // Direct pixel to world conversion
            
            const tubeGeometry = new THREE.CylinderGeometry(tubeRadius, tubeRadius, length, 8);
            const tubeMaterial = new THREE.MeshBasicMaterial({
                color: edgeColor,
                transparent: false,
                depthTest: false,
                depthWrite: false
            });
            
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            
            // Store original length for thickness updates
            tube.userData.originalLength = length;
            
            // Position the tube at the center of the edge
            tube.position.copy(center);
            
            // Properly orient the cylinder to align with the edge
            // Cylinder's default orientation is along Y-axis
            const up = new THREE.Vector3(0, 1, 0);
            direction.normalize();
            
            // Create rotation quaternion to align cylinder with edge direction
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(up, direction);
            tube.quaternion.copy(quaternion);
            
            tube.renderOrder = 100;
            group.add(tube);
        }
    }
    
    // Fallback to simple lines if mesh approach fails
    if (group.children.length === 0) {
        console.warn('Mesh-based edge highlighting failed, using line fallback');
        const edgeMaterial = new THREE.LineBasicMaterial({ 
            color: edgeColor, 
            transparent: false,
            depthTest: false,
            depthWrite: false
        });
        const fallbackHighlight = new THREE.LineSegments(edges, edgeMaterial);
        fallbackHighlight.renderOrder = 100;
        return fallbackHighlight;
    }
    
    console.log('Created thick edge highlight with', group.children.length, 'tube segments, thickness:', thickness, 'px');
    
    group.userData = { isObjectEdgeHighlight: true, selectable: false };
    group.renderOrder = 100;
    
    return group;
}

// Function to update edge highlight thickness when camera moves for screen-space consistency
function updateEdgeHighlightThickness() {
    selectedObjects.forEach(object => {
        if (object.edgeHighlight && object.edgeHighlight.children) {
            // Update each tube's thickness based on current camera distance
            object.edgeHighlight.children.forEach(tube => {
                const distanceToCamera = camera.position.distanceTo(tube.position);
                const pixelsToWorldScale = (distanceToCamera * Math.tan(camera.fov * Math.PI / 360)) / (canvas.clientHeight / 2);
                const tubeRadius = uiSettings.selection.thickness * pixelsToWorldScale;
                
                // Update the geometry with new radius
                tube.geometry.dispose();
                const length = tube.userData.originalLength || 1;
                tube.geometry = new THREE.CylinderGeometry(tubeRadius, tubeRadius, length, 8);
            });
        }
    });
}

// Make it available globally for debugging
window.debugSceneObjects = debugSceneObjects;
window.cleanupShadowCasters = cleanupShadowCasters;

window.addEventListener('DOMContentLoaded', () => {
    try {
        init();
        animate();
        // Load UI settings after initialization
        setTimeout(initUISettings, 100);
        // Clean up any problematic shadow casters after initialization
        setTimeout(cleanupShadowCasters, 200);
        console.log('Modler started successfully');
    } catch (error) {
        console.error('Startup error:', error);
        const coordsEl = document.getElementById('coordinates');
        if (coordsEl) coordsEl.textContent = 'Error: ' + error.message;
    }
});