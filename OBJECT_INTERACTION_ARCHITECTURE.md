# Object Interaction Architecture
**THE DEFINITIVE REFERENCE FOR ALL OBJECT INTERACTIONS IN MODLER**

This document establishes the **single, unified approach** for all object interactions in the Modler 3D application. **NO EXCEPTIONS** - all code must follow these patterns to ensure consistency and prevent fragmentation.

## 1. COORDINATE SYSTEMS HIERARCHY

### **MANDATORY TRANSFORMATION PATTERN**
```javascript
// ✅ ONLY CORRECT WAY: Use matrixWorld.decompose() for ALL transformations
const worldPosition = new THREE.Vector3();
const worldQuaternion = new THREE.Quaternion();
const worldScale = new THREE.Vector3();
object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

// Transform direction vectors (preserves rotation/scale, ignores position)
const transformedDirection = localDirection.clone().transformDirection(object.matrixWorld);

// Calculate final world position
const worldResult = worldPosition.clone().add(transformedDirection);

// ❌ FORBIDDEN: These create coordinate inconsistencies
const wrongResult = localVector.applyMatrix4(object.matrixWorld); // Includes position!
const wrongResult2 = object.localToWorld(localVector.clone()); // Use only for points, not directions
```

### **BOUNDING BOX CALCULATION HIERARCHY**
```javascript
// ✅ MANDATORY ORDER OF PREFERENCE:
// 1. For containers: Use Container.getObjectGeometryBounds()
// 2. For objects with userData: Use precise userData dimensions
// 3. Fallback only: Use Three.js setFromObject()

function getObjectBounds(object) {
    if (object.isContainer && object.getObjectGeometryBounds) {
        return object.getObjectGeometryBounds(object); // Uses child-based bounds
    }
    
    if (object.userData && object.userData.width !== undefined) {
        // Use precise userData dimensions with world transform
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
        
        const bounds = new THREE.Box3();
        bounds.setFromCenterAndSize(
            worldPosition,
            new THREE.Vector3(
                object.userData.width * worldScale.x,
                object.userData.height * worldScale.y,
                object.userData.depth * worldScale.z
            )
        );
        return bounds;
    }
    
    // Last resort fallback
    return new THREE.Box3().setFromObject(object);
}
```

### **FACE CENTER CALCULATION**
```javascript
// ✅ MANDATORY: Use FaceDetectionSystem for ALL face center calculations
const faceDetectionSystem = new FaceDetectionSystem();
object.updateMatrixWorld(); // ALWAYS call before face detection
const allFaces = faceDetectionSystem.getAllFaces(object);
const matchingFace = allFaces.find(face => 
    face.worldNormal.distanceTo(targetNormal) < 0.1
);
const faceCenter = matchingFace.center.clone();

// ❌ FORBIDDEN: Custom face center calculations
const wrongCenter = bounds.getCenter().add(faceOffset); // Inconsistent with detection
```

## 2. SELECTION SYSTEM ARCHITECTURE

### **SINGLE SOURCE OF TRUTH**
```javascript
// ✅ MANDATORY: SelectionManager is the ONLY system that manages selection state
// ALL other systems must query SelectionManager, never maintain their own selection state

class SomeManager {
    checkIfSelected(object) {
        // CORRECT: Always delegate to SelectionManager
        return this.selectionManager.isSelected(object);
        
        // ❌ FORBIDDEN: Never maintain local selection state
        // return this.mySelectionSet.has(object); // NO!
    }
}

// ✅ SELECTION CHECKING PATTERN (used everywhere)
function shouldHighlightObject(object, selectionManager) {
    // 1. Check if object itself is selected
    if (selectionManager.isSelected(object)) {
        return true;
    }
    
    // 2. Check if parent container is selected (for child objects)
    if (object.userData?.parentContainer && 
        selectionManager.isSelected(object.userData.parentContainer)) {
        return true;
    }
    
    return false;
}
```

### **HIERARCHICAL SELECTION RULES**
```javascript
// ✅ CONTAINER SELECTION HIERARCHY
// 1. Selecting a container selects the container (not children)
// 2. Children inherit container selection for highlighting/interaction
// 3. Container operations affect all children
// 4. Individual child selection requires explicit child targeting

// CORRECT container selection handling
function handleContainerClick(intersectionData) {
    let targetObject = intersectionData.object;
    
    // If clicking child of container, select the container instead
    if (targetObject.userData?.parentContainer) {
        targetObject = targetObject.userData.parentContainer;
    }
    
    return targetObject; // Always return the appropriate selection target
}
```

## 3. HIGHLIGHTING SYSTEM HIERARCHY

### **CENTRALIZED HIGHLIGHTING AUTHORITY**
```javascript
// ✅ MANDATORY: HighlightManager is the ONLY system that creates/manages highlights
// ALL tools delegate highlighting to HighlightManager

class Tool {
    onHover(intersectionData) {
        // CORRECT: Delegate to centralized system
        this.highlightManager.addFaceHoverHighlight(intersectionData);
        
        // ❌ FORBIDDEN: Never create highlights directly
        // const highlight = new THREE.Mesh(geometry, material); // NO!
        // this.scene.add(highlight); // NO!
    }
}

// ✅ SELECTION-BASED HIGHLIGHTING (built into HighlightManager)
class HighlightManager {
    addFaceHoverHighlight(intersectionData, options = {}) {
        const object = intersectionData.object;
        const bypassSelection = options.bypassSelection || false;
        
        // MANDATORY: Check selection state unless explicitly bypassed
        if (!bypassSelection && this.selectionManager) {
            // Only highlight selected objects
            if (!this.shouldHighlightObject(object)) {
                return; // Exit early - no highlight for unselected objects
            }
        }
        
        // Create highlight...
    }
    
    shouldHighlightObject(object) {
        // Centralized selection checking logic
        if (this.selectionManager.isSelected(object)) return true;
        if (object.userData?.parentContainer && 
            this.selectionManager.isSelected(object.userData.parentContainer)) return true;
        return false;
    }
}
```

### **HIGHLIGHT POSITIONING**
```javascript
// ✅ MANDATORY: ALL highlights use world coordinates and scene root
function createHighlight(object, faceData) {
    const highlight = new THREE.Mesh(geometry, material);
    
    // CORRECT: World coordinate positioning
    const worldCenter = calculateWorldFaceCenter(object, faceData.worldNormal);
    highlight.position.copy(worldCenter);
    
    // CORRECT: Add to scene root (not object hierarchy)
    scene.add(highlight);
    
    // ❌ FORBIDDEN: Local coordinate positioning
    // highlight.position.copy(localCenter); // Causes misalignment
    // object.add(highlight); // Wrong hierarchy
    
    return highlight;
}
```

## 4. HOVER/INTERSECTION DETECTION

### **CENTRALIZED RAYCASTING**
```javascript
// ✅ MANDATORY: EventManager handles ALL raycasting with consistent configuration
class EventManager {
    constructor() {
        this.raycaster = new THREE.Raycaster();
        // MANDATORY raycaster configuration
        this.raycaster.params.Line.threshold = 0.1; // Precise line detection
        this.raycaster.layers.set(0); // Only layer 0 objects
    }
    
    getIntersectionData(event) {
        // STANDARD intersection data format (used everywhere)
        return {
            object: intersection.object,
            point: intersection.point,
            face: intersection.face,
            faceIndex: intersection.faceIndex,
            worldNormal: intersection.face ? 
                intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld) : null,
            distance: intersection.distance
        };
    }
}

// ✅ ALL tools use this standard pattern
class Tool {
    onMouseMove(event) {
        const intersectionData = this.eventManager.getIntersectionData(event);
        if (intersectionData) {
            this.handleHover(intersectionData);
        }
    }
}
```

### **HOVER STATE MANAGEMENT**
```javascript
// ✅ CENTRALIZED hover state (never duplicated)
class EventManager {
    updateHoverState(intersectionData) {
        const currentObject = intersectionData?.object;
        
        // Clear previous hover if object changed
        if (this.hoveredObject !== currentObject) {
            if (this.hoveredObject) {
                this.clearHover(this.hoveredObject);
            }
            this.hoveredObject = currentObject;
        }
        
        // Update current hover
        if (currentObject) {
            this.setHover(currentObject, intersectionData);
        }
    }
}
```

## 5. TOOL INTERACTION PATTERNS

### **TOOL RESPONSIBILITY BOUNDARIES**
```javascript
// ✅ MANDATORY PATTERN: Tools handle interaction, Managers handle state
class Tool {
    handleClick(event) {
        // CORRECT: Tools determine interaction intent
        const intersectionData = this.eventManager.getIntersectionData(event);
        const actionType = this.determineActionType(intersectionData);
        
        // CORRECT: Delegate actual changes to appropriate manager
        switch (actionType) {
            case 'select':
                this.selectionManager.handleSelection(intersectionData);
                break;
            case 'move':
                this.objectManager.moveObject(object, newPosition);
                break;
            case 'highlight':
                this.highlightManager.addFaceHoverHighlight(intersectionData);
                break;
        }
        
        // ❌ FORBIDDEN: Direct object manipulation
        // object.position.copy(newPosition); // NO! Use ObjectManager
        // object.userData.selected = true; // NO! Use SelectionManager
    }
    
    // CORRECT: Tools interpret events, don't change state directly
    determineActionType(intersectionData) {
        // Tool-specific logic to determine what the user wants to do
        return 'select'; // or 'move', 'highlight', etc.
    }
}
```

### **UNIVERSAL TOOL INTERFACE**
```javascript
// ✅ MANDATORY: All tools implement this interface
class Tool {
    // Required methods (all tools must have these)
    activate() { /* Tool becomes active */ }
    deactivate() { /* Tool becomes inactive */ }
    onMouseDown(event) { /* Handle mouse press */ return false; /* Allow camera if not handled */ }
    onMouseMove(event) { /* Handle mouse move */ return false; }
    onMouseUp(event) { /* Handle mouse release */ return false; }
    
    // Standard tool state management
    handleIntersection(intersectionData) {
        // CORRECT: Use centralized managers
        if (this.shouldHighlight(intersectionData)) {
            this.highlightManager.addFaceHoverHighlight(intersectionData);
        }
    }
    
    cleanup() {
        // MANDATORY: Clean up tool-specific state
        this.highlightManager.clearTemporaryHighlights();
    }
}
```

## 6. PROXY OBJECT MANAGEMENT

### **UNIFIED COORDINATE CALCULATIONS**
```javascript
// ✅ MANDATORY: ALL proxy objects use identical bounds calculation
function createProxyObject(sourceObject, proxyType) {
    // STEP 1: Get consistent bounds
    const bounds = getObjectBounds(sourceObject); // Uses hierarchy above
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    
    // STEP 2: Use world coordinate positioning
    const worldPosition = new THREE.Vector3();
    sourceObject.matrixWorld.decompose(worldPosition, new THREE.Quaternion(), new THREE.Vector3());
    
    // STEP 3: Create proxy with consistent positioning
    const proxy = new THREE.Object3D();
    proxy.position.copy(center); // All proxies use bounds center
    proxy.userData = { isProxy: true, proxyType: proxyType, sourceObject: sourceObject.userData.id };
    
    // STEP 4: Add to scene root (never to object hierarchy)
    scene.add(proxy);
    
    return proxy;
}

// ✅ STANDARD PROXY TYPES (all use same pattern)
// - BoundingBox helpers: Container.createBoundingBoxHelper()
// - Face highlights: HighlightManager.createFaceOverlayHighlight()
// - Selection highlights: HighlightManager.createEdgeHighlight()  
// - Snap targets: SnapManager.showSnapPreview()
// - Temporary highlights: HighlightManager.addTemporaryHighlight()
```

### **PROXY LIFECYCLE MANAGEMENT**
```javascript
// ✅ CENTRALIZED cleanup pattern
class Manager {
    createProxy(sourceObject) {
        const proxy = this.createProxyGeometry(sourceObject);
        
        // MANDATORY: Register for cleanup
        this.activeProxies.set(sourceObject, proxy);
        
        return proxy;
    }
    
    removeProxy(sourceObject) {
        const proxy = this.activeProxies.get(sourceObject);
        if (proxy) {
            // STANDARD cleanup pattern
            if (proxy.parent) proxy.parent.remove(proxy);
            if (proxy.geometry) proxy.geometry.dispose();
            if (proxy.material) {
                if (Array.isArray(proxy.material)) {
                    proxy.material.forEach(mat => mat.dispose());
                } else {
                    proxy.material.dispose();
                }
            }
            this.activeProxies.delete(sourceObject);
        }
    }
}
```

## 7. SCENE-UI SYNCHRONIZATION SYSTEM

### **CENTRALIZED STATE SYNCHRONIZATION**
```javascript
// ✅ MANDATORY: SceneManager is the SINGLE SOURCE OF TRUTH for all scene changes
// ALL scene modifications must go through SceneManager methods to ensure UI sync

class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.uiSyncCallbacks = new Set(); // Registered UI update callbacks
    }
    
    // MANDATORY: Register UI components that need sync notifications
    registerUISync(callback) {
        this.uiSyncCallbacks.add(callback);
    }
    
    // MANDATORY: Notify all registered UI components of scene changes
    notifyUISync(changeType, data) {
        this.uiSyncCallbacks.forEach(callback => {
            try {
                callback(changeType, data);
            } catch (error) {
                console.error('UI sync callback error:', error);
            }
        });
    }
    
    // CORRECT: All scene modifications use this pattern
    addObject(object) {
        this.scene.add(object);
        this.notifyUISync('object_added', { object });
    }
    
    removeObject(object) {
        this.scene.remove(object);
        this.notifyUISync('object_removed', { object });
    }
}

// ✅ HIERARCHY PANEL REGISTRATION (mandatory pattern)
class HierarchyPanel {
    constructor(sceneManager, selectionManager) {
        this.sceneManager = sceneManager;
        this.selectionManager = selectionManager;
        
        // MANDATORY: Register for scene change notifications
        this.sceneManager.registerUISync(this.handleSceneChange.bind(this));
        
        // MANDATORY: Register for selection change notifications  
        this.selectionManager.registerUISync(this.handleSelectionChange.bind(this));
    }
    
    handleSceneChange(changeType, data) {
        switch (changeType) {
            case 'object_added':
            case 'object_removed':
            case 'object_modified':
                this.refresh(); // Update hierarchy display
                break;
        }
    }
    
    handleSelectionChange(changeType, data) {
        switch (changeType) {
            case 'selection_changed':
            case 'selection_cleared':
                this.updateSelectionHighlights(); // Update visual selection state
                break;
        }
    }
}
```

### **SCENE CHANGE TYPES**
```javascript
// ✅ STANDARD change type events (all UI components use these)
const SCENE_CHANGE_TYPES = {
    OBJECT_ADDED: 'object_added',           // New object added to scene
    OBJECT_REMOVED: 'object_removed',       // Object removed from scene
    OBJECT_MODIFIED: 'object_modified',     // Object properties changed
    OBJECT_MOVED: 'object_moved',           // Object position changed
    CONTAINER_CHANGED: 'container_changed', // Container contents modified
    HIERARCHY_CHANGED: 'hierarchy_changed'  // Parent-child relationships changed
};

const SELECTION_CHANGE_TYPES = {
    SELECTION_CHANGED: 'selection_changed', // Selection set modified
    SELECTION_CLEARED: 'selection_cleared', // All objects deselected
    SELECTION_ADDED: 'selection_added',     // Object added to selection
    SELECTION_REMOVED: 'selection_removed'  // Object removed from selection
};
```

### **MANDATORY MANAGER INTEGRATION**
```javascript
// ✅ ALL managers must notify SceneManager of relevant changes
class ObjectManager {
    createObject(type, options) {
        const object = this.buildObject(type, options);
        
        // CORRECT: Use SceneManager for scene modifications
        this.sceneManager.addObject(object);
        // SceneManager will handle UI notifications automatically
        
        return object;
    }
    
    removeObject(object) {
        // CORRECT: Use SceneManager for scene modifications
        this.sceneManager.removeObject(object);
        // SceneManager will handle UI notifications automatically
    }
    
    updateObjectProperty(object, property, value) {
        object.userData[property] = value;
        
        // MANDATORY: Notify of object modifications
        this.sceneManager.notifyUISync('object_modified', { object, property, value });
    }
}

// ✅ SelectionManager must notify of selection changes
class SelectionManager {
    constructor() {
        this.selectedObjects = new Set();
        this.uiSyncCallbacks = new Set();
    }
    
    registerUISync(callback) {
        this.uiSyncCallbacks.add(callback);
    }
    
    notifyUISync(changeType, data) {
        this.uiSyncCallbacks.forEach(callback => callback(changeType, data));
    }
    
    addToSelection(object) {
        this.selectedObjects.add(object);
        this.notifyUISync('selection_added', { object });
        this.notifyUISync('selection_changed', { selectedObjects: Array.from(this.selectedObjects) });
    }
    
    clearSelection() {
        this.selectedObjects.clear();
        this.notifyUISync('selection_cleared', {});
        this.notifyUISync('selection_changed', { selectedObjects: [] });
    }
}
```

## 8. MANDATORY PATTERNS & ENFORCEMENT

### **REQUIRED METHOD SIGNATURES**
```javascript
// ✅ STANDARD intersection handling (all tools)
Tool.prototype.handleIntersection = function(intersectionData) {
    // intersectionData format from EventManager.getIntersectionData()
    // Must return boolean indicating if interaction was handled
}

// ✅ STANDARD bounds calculation (all systems)
function getObjectBounds(object) {
    // Must return THREE.Box3 using hierarchy pattern above
}

// ✅ STANDARD coordinate transformation (everywhere)
function transformToWorldCoordinates(object, localVector) {
    // Must use matrixWorld.decompose() pattern above
}
```

### **ERROR PATTERNS TO AVOID**
```javascript
// ❌ FORBIDDEN PATTERNS (will cause inconsistencies)

// 1. Multiple selection state tracking
class BadManager {
    constructor() {
        this.selectedObjects = new Set(); // NO! Use SelectionManager only
    }
}

// 2. Direct highlight creation in tools
class BadTool {
    onHover() {
        const highlight = new THREE.Mesh(); // NO! Use HighlightManager
        this.scene.add(highlight); // NO!
    }
}

// 3. Inconsistent coordinate calculations
function badBoundsCalculation(object) {
    return object.userData.width; // NO! Use getObjectBounds()
}

// 4. Local coordinate proxy positioning
function badProxyPosition(object) {
    proxy.position.copy(object.position); // NO! Use world bounds center
    object.add(proxy); // NO! Add to scene root
}

// 5. Custom intersection data formats
function badIntersection(event) {
    return { obj: object }; // NO! Use EventManager.getIntersectionData()
}
```

### **TESTING PATTERNS**
```javascript
// ✅ CONSISTENCY VERIFICATION TESTS
function testCoordinateConsistency() {
    const object = createTestObject();
    
    // All systems should calculate same bounds
    const bounds1 = getObjectBounds(object);
    const bounds2 = faceDetectionSystem.getAllFaces(object)[0].center;
    const bounds3 = highlightManager.calculatePreciseFaceCenter(object, normal);
    
    assert(bounds1.getCenter().distanceTo(bounds2) < 0.001, 'Bounds calculation inconsistency');
}

function testSelectionConsistency() {
    const object = createTestObject();
    selectionManager.addToSelection(object);
    
    // All systems should agree on selection state
    assert(selectionManager.isSelected(object), 'SelectionManager inconsistency');
    assert(highlightManager.shouldHighlightObject(object), 'HighlightManager inconsistency');
}
```

## COMPLIANCE ENFORCEMENT

**THIS DOCUMENT IS THE SINGLE SOURCE OF TRUTH**

1. **ANY code that deviates from these patterns must be updated immediately**
2. **NO exceptions** - all object interaction code follows these patterns
3. **Before implementing any feature**, verify it follows these patterns
4. **When debugging interaction issues**, check compliance with these patterns first
5. **All new code must be reviewed against this document**

### **CANONICAL IMPLEMENTATIONS**
These files contain the **reference implementations** of each pattern:

- **Coordinate Systems**: `/js/geometry/Container.js` - `getObjectGeometryBounds()`
- **Selection Management**: `/js/core/SelectionManager.js` - `isSelected()`, `handleSelection()`  
- **Face Detection**: `/js/core/FaceDetectionSystem.js` - `getAllFaces()`, `detectFace()`
- **Highlighting**: `/js/core/HighlightManager.js` - `addFaceHoverHighlight()`, centralized selection checking
- **Event Handling**: `/js/core/EventManager.js` - `getIntersectionData()`
- **Tool Interface**: `/js/tools/SelectTool.js` - standard tool pattern

**When in doubt, follow these canonical implementations exactly.**

---

**This architecture eliminates fragmentation and ensures every object interaction works consistently across the entire application. Follow these patterns without exception.**