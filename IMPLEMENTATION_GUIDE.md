# Modler Implementation Guide

This document serves as the **single source of truth** for implementation patterns, architectural decisions, and best practices in the Modler 3D application. All new features and modifications must follow these established patterns to ensure consistency and maintainability.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Camera Control Management](#camera-control-management)
3. [Selection System](#selection-system)
4. [Tool System](#tool-system)
5. [Object Management](#object-management)
6. [Event System](#event-system)
7. [Visual Feedback](#visual-feedback)
8. [Hierarchy System](#hierarchy-system)
9. [Best Practices](#best-practices)
10. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

### Core Modules
```
ModlerApp (main-refactored.js)
├── Core Systems
│   ├── SceneManager - 3D scene management
│   ├── RendererManager - Rendering and camera controls
│   └── EventManager - Input handling and event distribution
├── Centralized Managers (NEW)
│   ├── StateManager - Unified application state with pub-sub
│   ├── MaterialManager - Material caching and theme management
│   ├── ObjectManager - Object lifecycle and metadata management
│   ├── CameraManager - Camera operations and viewport control
│   ├── ConfigurationManager - Settings validation and persistence
│   ├── HighlightManager - Centralized visual feedback system
│   └── SnapManager - Centralized snapping system
└── Legacy Systems (being integrated)
    ├── ToolManager - Tool activation and event routing  
    ├── SelectionManager - Object selection coordination
    ├── GeometryManager - Basic object creation
    └── HierarchyPanel - UI tree view and drag-drop
```

### Design Principles
1. **Single Responsibility**: Each manager handles one specific domain
2. **Event-Driven**: Loose coupling through event callbacks  
3. **Consistent Patterns**: Same patterns across all tools and systems
4. **Centralized State**: StateManager owns all application state
5. **Dependency Injection**: Centralized managers passed to all systems

---

## Camera Control Management

### **ESTABLISHED PATTERN** ✅
**Status**: Fully implemented and consistent across all tools

#### How It Works
1. **ToolManager** manages camera controls based on tool return values
2. **Tools return booleans** from event handlers:
   - `true` = Disable camera controls
   - `false` = Allow camera controls
3. **RendererManager** provides centralized enable/disable methods

#### Implementation Pattern
```javascript
// In Tool classes
onMouseDown(event, intersectionData) {
    if (shouldBlockCamera) {
        this.startOperation();
        return true; // Blocks camera
    }
    return false; // Allows camera
}

onMouseMove(event, intersectionData) {
    if (this.isOperating) {
        this.updateOperation();
        return true; // Blocks camera while operating
    }
    return false; // Allows camera when idle
}

onMouseUp(event, intersectionData, isDragging, wasInteracting) {
    if (this.isOperating) {
        this.endOperation();
        return false; // Re-enables camera after operation
    }
    return false; // Allows camera
}
```

#### Camera Control Rules
- **ALWAYS disable** camera during object manipulation (move, push/pull, create)
- **NEVER disable** camera during hover/preview states
- **Tools must be consistent** in their return values
- **ToolManager handles** the actual enable/disable calls

#### Files Involved
- `/js/tools/ToolManager.js` - Central camera control logic
- `/js/core/Renderer.js` - `enableControls()` / `disableControls()` methods
- All tool files - Return appropriate boolean values

---

## Selection System

### **ESTABLISHED PATTERN** ✅
**Status**: Fully implemented with hierarchy sync

#### Core Components
1. **SelectionManager** - Centralized selection state and operations
2. **HighlightSystem** - Visual feedback for selections
3. **HierarchyPanel** - UI synchronization with 3D selection

#### Selection Rules
```javascript
// Selection State Management
- SelectionManager.selectedObjects = Set() // Selected objects
- SelectionManager.hoveredObject = Object  // Currently hovered
- SelectionManager.selectedFace = Object   // Face selection for tools

// Visual Feedback Rules
- Regular objects: Blue edge highlighting via HighlightSystem
- Containers: Blue wireframe bounding box via Container.setSelected()
- Hover effects: Only on selected objects (no hover wireframes)
```

#### Selection Sync Pattern
```javascript
// 3D Scene → Hierarchy
selectionManager.onSelectionChanged = () => {
    hierarchyPanel.updateSelection(); // Updates UI highlighting
}

// Hierarchy → 3D Scene
hierarchyPanel.handleTreeClick(event) {
    const object = this.findObjectById(objectId);
    selectionManager.selectOnly(object); // Triggers UI sync
}
```

#### Container Proxy Handling
**CRITICAL**: All tools must handle container proxies consistently:
```javascript
// Standard pattern for all tools
let targetObject = intersectionData.object;
if (intersectionData.object.userData.isContainerProxy) {
    targetObject = intersectionData.object.userData.parentContainer;
    console.log('TOOL: Clicked on container proxy, selecting container:', targetObject.userData.id);
}
// Use targetObject for all subsequent operations
```

#### Deselection Rules
- **Empty space clicks**: Clear selection ONLY if `!isDragging && !wasInteracting`
- **Camera movement**: Never clears selection (isDragging = true prevents it)
- **Tool operations**: Preserve selection during active operations

#### Files Involved
- `/js/geometry/SelectionManager.js` - Core selection logic
- `/js/geometry/HighlightSystem.js` - Visual feedback
- `/js/ui/HierarchyPanel.js` - UI synchronization
- All tool files - Container proxy handling

---

## Tool System

### **ESTABLISHED PATTERN** ✅
**Status**: Consistent event handling across all tools

#### Tool Interface Contract
Every tool must implement these methods with consistent signatures:
```javascript
class Tool {
    constructor(name, sceneManager, eventManager) {
        this.name = name;
        this.isActive = false;
        this.isOperating = false; // For multi-step operations
    }

    // Required event handlers (must return boolean for camera control)
    onMouseDown(event, intersectionData) { return false; }
    onMouseUp(event, intersectionData, isDragging, wasInteracting) { return false; }
    onMouseMove(event, intersectionData) { return false; }
    onKeyDown(event) { /* No return value */ }

    // Required lifecycle methods
    activate() { this.isActive = true; }
    deactivate() { this.isActive = false; this.cleanup(); }
    cleanup() { /* Tool-specific cleanup */ }
}
```

#### Tool Operation States
```javascript
// State Management Pattern
this.isActive    // Tool is selected in UI
this.isOperating // Tool is performing an operation (move, push/pull, etc.)

// State Transitions
activate() → isActive = true
onMouseDown() → isOperating = true (if starting operation)
onMouseUp() → isOperating = false (if ending operation)
deactivate() → isActive = false, cleanup()
```

#### Tool Categories and Behaviors
1. **Selection Tools** (SelectTool)
   - Immediate selection on mousedown
   - No multi-step operations
   - Always allow camera controls

2. **Manipulation Tools** (MoveTool, PushPullTool)
   - Multi-step operations (start → update → end)
   - Block camera during operations
   - Handle container proxies consistently

3. **Creation Tools** (Future: LineTool, etc.)
   - Multi-step creation process
   - Block camera during creation
   - Preview feedback during creation

#### Files Involved
- `/js/tools/ToolManager.js` - Tool coordination and event routing
- `/js/tools/Tool.js` - Base class and interface
- `/js/tools/SelectTool.js`, `/js/tools/MoveTool.js`, `/js/tools/PushPullTool.js` - Implementations

---

## Object Management

### **ESTABLISHED PATTERN** ✅
**Status**: Consistent object lifecycle and container system

#### Object Creation Pattern
```javascript
// Standard object creation flow
1. GeometryManager.createObject() - Creates Three.js object with userData
2. SceneManager.addObject() - Adds to scene and tracks in managers
3. GeometryManager.objects.set(id, object) - Registers for lookup
4. SelectionManager.selectOnly(object) - Auto-select new objects
```

#### Object userData Contract
```javascript
// Required userData properties for all objects
{
    id: string,           // Unique identifier
    type: string,         // 'box', 'rectangle', 'container', etc.
    selectable: boolean,  // Can be selected by tools
    visible: boolean,     // Visibility state
    
    // Dimension properties (as applicable)
    width?: number,
    height?: number,
    depth?: number,
    radius?: number,
    
    // Hierarchy properties
    parentContainer?: Container,  // Parent container reference
}
```

#### Container System
```javascript
// Container Object Pattern
class Container extends THREE.Object3D {
    // Properties
    isContainer: true
    childObjects: Set()
    boundingBox: THREE.Box3()
    boundingBoxHelper: THREE.LineSegments  // Visual feedback
    selectableProxy: THREE.Mesh           // Invisible clickable geometry
    
    // Layout properties
    userData.distributionMode: 'none' | 'even' | 'center'
    userData.alignmentMode: 'none' | 'left' | 'center' | 'right' | 'top' | 'bottom'
    userData.fillMode: { x: boolean, y: boolean, z: boolean }
}

// Container Operations
addChild(object) → Updates bounding box, applies layout
removeChild(object) → Updates bounding box
onChildChanged() → Called when children move/change
setSelected(visible) → Shows/hides bounding box
```

#### Object Modification Pattern
```javascript
// When modifying object geometry/properties
1. Modify object.geometry or object.userData
2. Call sceneManager.notifyObjectChanged(object) // Updates hierarchy
3. Call highlightSystem.updateObjectEdgeHighlight(object) // Updates visuals
4. Update parent container if needed: object.userData.parentContainer?.onChildChanged()
```

#### Files Involved
- `/js/geometry/GeometryManager.js` - Object creation
- `/js/core/Scene.js` - Scene management and notifications
- `/js/geometry/Container.js` - Container implementation
- `/js/ui/HierarchyPanel.js` - UI representation

---

## Event System

### **ESTABLISHED PATTERN** ✅
**Status**: Centralized event handling with proper state management

#### Event Flow
```
User Input → EventManager → ToolManager → ActiveTool → Managers
```

#### Event Manager Responsibilities
```javascript
// State tracking
mouseDownPosition: Vector2  // For drag detection
isDragging: boolean         // Mouse movement distance threshold
wasInteracting: boolean     // Set by tools during operations

// Event distribution
onMouseDown/Up/Move callbacks → Tools
getIntersectionData() → Raycasting and intersection detection
```

#### Event State Rules
```javascript
// State Management
mouseDown: mouseDownPosition = current, isDragging = false, wasInteracting = false
mouseMove: isDragging = true (if moved beyond threshold)
mouseUp: Reset all state flags
toolOperation: wasInteracting = true (set by tool)
```

#### Intersection Data Contract
```javascript
// Standard intersection data structure
{
    object: THREE.Object3D,     // Intersected object
    point: THREE.Vector3,       // World intersection point
    face: THREE.Face,           // Intersected face (if applicable)
    faceIndex: number,          // Face index
    normal: THREE.Vector3,      // Face normal (local space)
    worldNormal: THREE.Vector3, // Face normal (world space)
}
```

#### Files Involved
- `/js/core/EventManager.js` - Central event handling
- `/js/tools/ToolManager.js` - Event routing to tools

---

## Visual Feedback

### **ESTABLISHED PATTERN** ✅
**Status**: Consistent highlighting system

#### Highlight System Architecture
```javascript
// HighlightSystem manages all visual feedback
objectEdgeHighlights: Map()     // Selected object edge highlights
boundingBoxes: Map()            // Object bounding boxes
faceHighlights: Map()           // Hovered face highlights
selectedFaceHighlights: Map()   // Selected face highlights
tempHighlights: Array()         // Temporary interaction highlights
```

#### Highlight Rules
```javascript
// Visual Feedback Hierarchy (in order of precedence)
1. Selected objects: Blue edge highlights (0x0078d4)
2. Container selection: Blue wireframe bounding box
3. Face hover: Face highlighting (only on selected objects)
4. Temporary highlights: Edge/corner highlights during tool operations

// Color Standards
selectionColor: 0x0078d4    // Blue for selections
hoverColor: 0xff6600        // Orange for hovers
tempColor: 0x00ff00         // Green for temporary feedback
```

#### Highlight Update Pattern
```javascript
// Efficient highlight updates
updateObjectEdgeHighlight(object) {
    // Check if geometry changed via UUID comparison
    if (geometryChanged) {
        recreateHighlight(); // Full recreation
    } else {
        updateTransform();   // Fast transform update
    }
}
```

#### Performance Considerations
- **Geometry changes**: Require highlight recreation
- **Transform changes**: Only require position/rotation updates
- **UUID tracking**: Prevents unnecessary highlight recreation
- **Batch updates**: Update multiple highlights together when possible

#### Files Involved
- `/js/geometry/HighlightSystem.js` - All visual feedback logic
- `/js/geometry/SelectionManager.js` - Selection highlight coordination
- `/js/geometry/Container.js` - Container bounding box management

---

## Hierarchy System

### **ESTABLISHED PATTERN** ✅
**Status**: Full drag-drop with container management

#### Hierarchy Panel Architecture
```javascript
// Tree Structure
Root Objects (no parentContainer)
├── Regular Objects
└── Containers
    ├── Child Objects
    └── Nested Containers

// State Management
expandedItems: Set()          // Expanded container IDs
draggedItem: HTMLElement      // Currently dragged item
dropTarget: HTMLElement       // Current drop target
dropPosition: string          // 'before' | 'after' | 'inside'
```

#### Drag and Drop Rules
```javascript
// Drop Zones
Regular Objects: before/after only (blue lines)
Containers: before/after/inside (dashed border for inside)
Empty Space: Move to root level

// Visual Feedback
drop-before: Top blue line
drop-after: Bottom blue line  
drop-inside: Dashed blue border (containers only)
parent-container-highlight: Yellow border (during child drag)
```

#### Selection Synchronization
```javascript
// Bidirectional Sync Pattern
3D Selection Change → selectionManager.onSelectionChanged() → hierarchyPanel.updateSelection()
Hierarchy Click → hierarchyPanel.handleTreeClick() → selectionManager.selectOnly()

// Update Pattern
updateSelection() {
    // Always called after buildTree() to maintain sync
    // Uses CSS .selected class for visual feedback
    // Matches hierarchy highlighting with 3D scene selection
}
```

#### Container Proxy System
```javascript
// Container Proxy Pattern (for making containers clickable)
Container.selectableProxy = THREE.Mesh {
    geometry: BoxGeometry(boundingBox size),
    material: Invisible material,
    userData: {
        isContainerProxy: true,
        parentContainer: Container,
        selectable: true
    }
}
```

#### Files Involved
- `/js/ui/HierarchyPanel.js` - Tree UI and drag-drop logic
- `/js/geometry/Container.js` - Container hierarchy management
- `/styles/main.css` - Visual feedback styles

---

## Centralized Highlighting System

### **NEW PATTERN** 🆕
**Status**: Centralized highlight management with tool-specific configuration

#### HighlightManager Architecture
The HighlightManager provides a unified API for all highlighting needs while allowing tool-specific and object-type specific customizations.

```javascript
// HighlightManager Configuration Hierarchy
Base Style → Tool Override → Object Type Override → Context Override
```

#### Core Configuration Structure
```javascript
config: {
    styles: {
        selection: { color: 0x0078d4, thickness: 2, type: 'edge' },
        hover: { color: 0xff6600, thickness: 2, type: 'wireframe' },
        temporary: { color: 0x00ff00, thickness: 3, type: 'edge' },
        face: { color: 0x0078d4, opacity: 0.1, type: 'overlay' }
    },
    tools: {
        'move': { selection: { thickness: 3 }, temporary: { color: 0xff6600 } },
        'pushpull': { face: { opacity: 0.2 } }
    },
    objectTypes: {
        'container': { selection: { type: 'bounding_box' } },
        'box': { selection: { type: 'edge' } }
    },
    contexts: {
        'multi_select': { selection: { opacity: 0.7 } },
        'dragging': { temporary: { thickness: 4 } }
    }
}
```

#### Highlight Types and Behaviors
```javascript
// Available highlight types
'edge'        // Thick edge highlights using tubes
'wireframe'   // Wireframe overlay
'bounding_box' // Box helper outline
'glow'        // Advanced glow effect (future)
'overlay'     // Face overlay highlights
```

#### Tool Integration Pattern
```javascript
class ExampleTool extends Tool {
    constructor(..., highlightManager) {
        this.highlightManager = highlightManager;
    }
    
    activate() {
        super.activate();
        if (this.highlightManager) {
            this.highlightManager.onToolActivated(this.name);
        }
    }
    
    onMouseMove(event, intersectionData) {
        if (this.highlightManager) {
            this.highlightManager.removeHoverHighlight(prevObject);
            this.highlightManager.addHoverHighlight(currentObject);
        }
    }
}
```

#### Context Management
```javascript
// Update highlight behavior based on current state
highlightManager.setContext({
    activeTool: 'move',
    isMultiSelect: true,
    isDragging: false
});
// All active highlights automatically update to reflect new context
```

#### Files Involved
- `/js/core/HighlightManager.js` - Centralized highlight management
- `/js/geometry/HighlightSystem.js` - Low-level highlight creation (legacy support)
- All tool files - Integration with centralized system

---

## Centralized Snapping System

### **NEW PATTERN** 🆕
**Status**: Centralized snap management with configurable behaviors

#### SnapManager Architecture
The SnapManager provides a unified API for all snapping needs with tool-specific and object-type specific configurations.

```javascript
// Snap Detection Priority
Priority 4: Corner snaps (highest)
Priority 3: Edge snaps  
Priority 2: Face snaps, Center snaps
Priority 1: Grid snaps (lowest)
```

#### Core Configuration Structure
```javascript
config: {
    types: {
        corner: { enabled: true, distance: 2.0, priority: 3 },
        edge: { enabled: true, distance: 1.5, priority: 2 },
        face: { enabled: true, distance: 2.0, axisAlignedOnly: true },
        center: { enabled: true, distance: 1.8, priority: 2 },
        grid: { enabled: true, distance: 0.5, priority: 1 }
    },
    tools: {
        'move': {
            types: ['corner', 'edge', 'face', 'center'],
            face: { axisConstrainedOnly: true }
        },
        'pushpull': {
            types: ['face'],
            face: { axisAlignedOnly: true }
        }
    },
    objectTypes: {
        'box': { provides: ['corner', 'edge', 'face', 'center'] },
        'container': { provides: ['corner', 'center'] }
    }
}
```

#### Snap Type Behaviors
```javascript
// Snap types and their detection methods
'grid'    // Snaps to grid intersections
'corner'  // Snaps to object corners
'edge'    // Snaps to closest point on edges  
'face'    // Snaps to face surfaces with axis alignment
'center'  // Snaps to object centers
```

#### Tool Integration Pattern
```javascript
class ExampleTool extends Tool {
    constructor(..., snapManager) {
        this.snapManager = snapManager;
    }
    
    activate() {
        super.activate();
        if (this.snapManager) {
            this.snapManager.onToolActivated(this.name);
        }
    }
    
    onMouseMove(event, intersectionData) {
        if (this.snapManager) {
            const snapTarget = this.snapManager.getBestSnapTarget(
                currentPosition, 
                selectedObjects
            );
            
            if (snapTarget) {
                this.snapManager.showSnapPreview(snapTarget);
            }
        }
    }
}
```

#### Context-Aware Snapping
```javascript
// Face-constrained movement only snaps to aligned faces
snapManager.onFaceConstrainedStart('x'); // Only x-aligned faces
snapManager.setContext({ 
    isFaceConstrained: true, 
    constrainedAxis: 'x' 
});

// Multi-select reduces snap distances for precision
snapManager.setContext({ isMultiSelect: true });
```

#### Performance Optimization
```javascript
// Built-in caching system
snapCache: Map with 100ms timeout
- Caches snap detection results
- Clears on context changes
- Prevents redundant calculations during mouse movement
```

#### Files Involved
- `/js/core/SnapManager.js` - Centralized snap management
- `/js/core/Grid.js` - Grid snapping support
- All tool files - Integration with centralized system

---

## Best Practices

### Code Organization
1. **Consistent File Structure**: Follow the established manager/tool/ui organization
2. **Single Responsibility**: Each class/file handles one specific domain
3. **Explicit Dependencies**: Constructor injection for all dependencies
4. **Error Handling**: Graceful degradation with console logging

### Event Handling
1. **Return Values**: Tools must return boolean for camera control consistency
2. **State Flags**: Use `isOperating` for multi-step operations
3. **Event Propagation**: Return appropriate values to control event bubbling
4. **Cleanup**: Always cleanup resources in `deactivate()` and `dispose()` methods

### Performance
1. **Efficient Updates**: Transform updates vs full recreation
2. **Batch Operations**: Group related updates together
3. **Avoid Polling**: Use event-driven updates instead of continuous checking
4. **Memory Management**: Dispose geometry, materials, and event listeners

### Debugging
1. **Consistent Logging**: Use prefixed console messages (e.g., "TOOL:", "SELECTION:")
2. **State Logging**: Log important state transitions
3. **Error Context**: Include relevant object IDs and operation context
4. **Debug Modes**: Use conditional logging to avoid spam

### Testing Considerations
1. **Tool Consistency**: Same behavior across all tools for similar operations
2. **Edge Cases**: Empty selections, invalid objects, null checks
3. **State Transitions**: Verify proper cleanup on tool changes
4. **Memory Leaks**: Check for proper disposal of Three.js objects

---

## Implementation Checklist

### When Adding a New Tool
- [ ] Extends base Tool class with proper constructor
- [ ] Implements all required event methods with correct signatures
- [ ] Returns proper boolean values for camera control
- [ ] Handles container proxies consistently
- [ ] Includes proper cleanup in deactivate()
- [ ] Updates cursor appropriately for visual feedback
- [ ] Follows established logging patterns
- [ ] **Integrates with HighlightManager** for consistent visual feedback
- [ ] **Integrates with SnapManager** for tool-appropriate snapping behavior
- [ ] **Calls manager.onToolActivated()** in activate() method
- [ ] **Configures tool-specific highlight/snap behaviors** in manager configs

### When Adding Object Types  
- [ ] Includes all required userData properties
- [ ] Registers with GeometryManager.objects Map
- [ ] Supports selection highlighting via HighlightSystem
- [ ] Integrates with hierarchy panel display
- [ ] Handles container relationships properly
- [ ] Calls sceneManager.notifyObjectChanged() when modified
- [ ] **Defines highlight behavior** in HighlightManager objectTypes config
- [ ] **Specifies snap targets provided** in SnapManager objectTypes config
- [ ] **Implements geometry extraction** methods for snap detection

### When Modifying Selection Logic
- [ ] Updates SelectionManager as single source of truth
- [ ] Maintains hierarchy panel synchronization
- [ ] Preserves established highlighting rules
- [ ] Handles container selection properly
- [ ] Considers multi-selection scenarios

### When Changing Visual Feedback
- [ ] Uses established color standards
- [ ] Updates HighlightSystem consistently
- [ ] Maintains visual hierarchy (selection > hover > temp)
- [ ] Handles performance implications
- [ ] Tests with both objects and containers
- [ ] **Updates HighlightManager configuration** instead of hardcoding
- [ ] **Considers tool and context-specific overrides**
- [ ] **Tests highlight behavior across different tools**

### When Modifying Snapping Behavior
- [ ] **Updates SnapManager configuration** rather than tool-specific code
- [ ] **Considers tool-specific snap type requirements**
- [ ] **Maintains snap priority hierarchy** (corner > edge > face/center > grid)
- [ ] **Tests axis-aligned face detection** for accurate snapping
- [ ] **Validates performance** of snap detection with caching
- [ ] **Ensures visual feedback** matches snap targets

---

## Centralized Material Management

### **NEW PATTERN** 🆕
**Status**: Centralized material creation with caching and theme support

#### MaterialManager Architecture
The MaterialManager eliminates the 71+ scattered material creation instances by providing a unified API with caching, theme management, and automatic disposal.

```javascript
// Unified Material Creation
materialManager.getObjectMaterial(color, properties)     // Standard object materials
materialManager.getWireframeMaterial(color, properties)  // Wireframe materials
materialManager.getHighlightMaterial(variant)            // Highlight materials
materialManager.getLineMaterial(color)                   // Line materials
materialManager.getInvisibleMaterial()                   // Proxy materials
```

#### Theme Integration
```javascript
// Material themes automatically applied
theme: {
    objects: { default: { color: 0x888888 }, wireframe: { opacity: 0.3 } },
    highlights: { selection: { color: 0x0078d4 }, hover: { color: 0xff6600 } },
    ui: { grid: { main: { color: 0x666666 } }, proxy: { opacity: 0.0 } }
}

// Update theme and refresh all materials
materialManager.updateTheme(newTheme);
```

#### Performance Benefits
- **Material Reuse**: Automatic caching prevents duplicate materials
- **Memory Management**: Reference counting and automatic disposal
- **Theme Updates**: Batch material property updates
- **Usage Tracking**: Statistics for optimization

#### Files Involved
- `/js/core/MaterialManager.js` - Central material management
- All object creation files - Use MaterialManager instead of `new THREE.*Material`

---

## Centralized State Management

### **NEW PATTERN** 🆕
**Status**: Unified application state with pub-sub pattern and persistence

#### StateManager Architecture
The StateManager provides a single source of truth for all application state with automatic synchronization, persistence, and change notifications.

```javascript
// Hierarchical State Structure
state: {
    app: { initialized, activePanel, isFullscreen },
    tools: { activeTool, isOperating, operationType, toolContext },
    scene: { objectCount, selectedCount, cameraPosition, viewportSize },
    ui: { panels: {hierarchy, properties, settings}, theme },
    hierarchy: { rootObjects, containers, layerOrder, visibility },
    selection: { objects, lastSelected, multiSelectMode, selectedFace },
    debug: { showFPS, logLevel, wireframeMode }
}
```

#### State Operations
```javascript
// Subscribe to state changes
stateManager.subscribe('tools.activeTool', (newTool, oldTool) => {
    console.log('Tool changed from', oldTool, 'to', newTool);
});

// Get/set state values
const activeTool = stateManager.get('tools.activeTool');
stateManager.set('scene.objectCount', 5);

// Batch updates
stateManager.update({
    'tools.activeTool': 'move',
    'tools.isOperating': true,
    'ui.panels.properties.visible': false
});

// Undo/redo support
stateManager.saveToHistory();
stateManager.undo();
stateManager.redo();
```

#### Persistence Features
- **Auto-save**: Automatic localStorage persistence with debouncing
- **Selective Storage**: Exclude transient state from persistence
- **State History**: Undo/redo with configurable history size
- **Cross-session**: State restoration on application restart

#### Files Involved
- `/js/core/StateManager.js` - Central state management
- All managers - Subscribe to relevant state changes

---

## Centralized Object Management

### **NEW PATTERN** 🆕
**Status**: Unified object lifecycle with consistent metadata and hierarchy tracking

#### ObjectManager Architecture
The ObjectManager provides consistent object creation, registration, and disposal with unified ID generation and metadata handling.

```javascript
// Standardized Object Creation
const box = objectManager.createObject('box', {
    dimensions: { width: 2, height: 1, depth: 3 },
    position: new THREE.Vector3(0, 0, 0),
    color: 0x888888
});

// Template System
objectManager.createTemplate('standard-box', 'box', {
    dimensions: { width: 2, height: 1, depth: 3 }
});
const newBox = objectManager.createFromTemplate('standard-box');
```

#### Object Registration
```javascript
// Automatic registration includes:
- Unique ID generation
- Type registry management  
- Hierarchy state tracking
- Material reference counting
- Scene graph integration
```

#### Hierarchy Integration
```javascript
// Layer management
objectManager.setLayerIndex(object, newIndex);

// Visibility management
objectManager.setVisibility(object, visible);

// Batch operations
objectManager.batchOperation([
    { type: 'create', objectType: 'box', options: {...} },
    { type: 'remove', objectOrId: object },
    { type: 'update', object: obj, updates: {...} }
]);
```

#### Files Involved
- `/js/core/ObjectManager.js` - Central object management
- `/js/ui/HierarchyPanel.js` - Hierarchy integration
- All object creation code - Use ObjectManager API

---

## Centralized Camera Management

### **NEW PATTERN** 🆕
**Status**: Unified camera operations with viewport control and view presets

#### CameraManager Architecture
The CameraManager centralizes all camera operations including controls, animations, view presets, and viewport management.

```javascript
// Camera Control Management
cameraManager.blockControls('move-tool');   // Block with source tracking
cameraManager.unblockControls('move-tool'); // Unblock with validation

// View Presets and Animation
cameraManager.animateToView('front', 1000);  // Preset views
cameraManager.focusOnObjects([obj1, obj2]);  // Focus on objects
cameraManager.fitAll();                      // Fit all objects

// Custom Animations
cameraManager.animateToPosition(
    new THREE.Vector3(10, 5, 10),
    new THREE.Vector3(0, 0, 0),
    1500
);
```

#### Viewport Management
```javascript
// Automatic viewport tracking
cameraManager.updateViewport(width, height);  // Manual updates
// ResizeObserver for automatic updates

// Coordinate transformations
const worldPos = cameraManager.screenToWorld(screenX, screenY);
const screenPos = cameraManager.worldToScreen(worldPosition);

// Camera vectors for movement calculations
const { right, up, forward } = cameraManager.getCameraVectors();
```

#### State Integration
```javascript
// Automatic state synchronization
cameraManager.getState() // Current camera state
stateManager.get('scene.cameraPosition') // Synced position
stateManager.get('scene.cameraBlocked')  // Control state
```

#### Files Involved
- `/js/core/CameraManager.js` - Central camera management
- All tools - Use centralized camera control blocking

---

## Centralized Configuration Management

### **NEW PATTERN** 🆕
**Status**: Schema-based configuration with validation and unified persistence

#### ConfigurationManager Architecture
The ConfigurationManager provides type-safe configuration management with validation, schema definitions, and automatic change propagation.

```javascript
// Schema-based Configuration
schemas: {
    ui: {
        selection: {
            edgeColor: { type: 'color', default: '#0078d4', description: 'Selection edge color' },
            thickness: { type: 'number', default: 2, min: 1, max: 10, step: 1 }
        }
    },
    tools: {
        move: {
            snapDistance: { type: 'number', default: 0.5, min: 0.1, max: 2.0, step: 0.1 }
        }
    }
}
```

#### Configuration Operations
```javascript
// Get/set with validation
const edgeColor = configManager.get('ui.selection.edgeColor');
configManager.set('ui.selection.thickness', 3); // Auto-validates

// Validation results
const validation = configManager.validate('ui.selection.thickness', 15);
// { valid: false, errors: ['Must be <= 10'] }

// Import/export
const config = configManager.export(['ui', 'tools']);
configManager.import(savedConfig, true); // Merge mode
```

#### Automatic Change Propagation
```javascript
// Configuration changes automatically applied to:
- MaterialManager theme updates
- HighlightManager style updates  
- SceneManager grid/background updates
- CameraManager setting updates
```

#### Files Involved
- `/js/core/ConfigurationManager.js` - Central configuration management
- `/js/ui/SettingsManager.js` - UI integration with centralized config
- All managers - Respond to configuration changes

---

## Migration Patterns

### **CENTRALIZED ARCHITECTURE MIGRATION** ✅
**Status**: Ongoing migration from scattered implementations to unified systems

This section documents patterns for migrating legacy code to use centralized managers.

#### Material Creation Migration

**❌ OLD PATTERN - Scattered Material Creation:**
```javascript
// Direct THREE.js material creation scattered throughout codebase
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
const highlightMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x0078d4, 
    transparent: true, 
    opacity: 0.5 
});
```

**✅ NEW PATTERN - Centralized Material Management:**
```javascript
// Use MaterialManager for all material creation
const material = this.materialManager.getObjectMaterial(0xff0000);
const lineMaterial = this.materialManager.getLineMaterial(0x00ff00);
const highlightMaterial = this.materialManager.getHighlightMaterial('selection');

// Constructor injection pattern
class SomeManager {
    constructor(scene, camera, materialManager = null) {
        this.materialManager = materialManager;
    }
    
    createSomething() {
        const material = this.materialManager ? 
            this.materialManager.getObjectMaterial() :
            new THREE.MeshLambertMaterial({ color: 0xaaaaaa }); // Fallback
    }
}
```

#### Object Creation Migration

**❌ OLD PATTERN - Direct Object Creation:**
```javascript
// Scattered ID generation and inconsistent metadata
const box = new THREE.Mesh(geometry, material);
box.userData = {
    id: 'obj_' + Math.random().toString(36).substr(2, 9),
    type: 'box',
    selectable: true
};
scene.add(box);
```

**✅ NEW PATTERN - Centralized Object Management:**
```javascript
// Use ObjectManager for consistent object lifecycle
const object = this.objectManager.createObject('box', {
    geometry: boxGeometry,
    material: this.materialManager.getObjectMaterial(),
    position: new THREE.Vector3(0, 0, 0)
});
// ObjectManager handles ID generation, registration, and scene addition
```

#### State Management Migration

**❌ OLD PATTERN - Scattered State and localStorage:**
```javascript
// Direct localStorage access scattered throughout codebase
localStorage.setItem('modler_camera_position', JSON.stringify(cameraPos));
const savedPosition = JSON.parse(localStorage.getItem('modler_camera_position'));

// Component-specific state tracking
this.selectedObjects = [];
this.activePanel = 'properties';
this.cameraSettings = { fov: 75, near: 0.1 };
```

**✅ NEW PATTERN - Centralized State Management:**
```javascript
// Use StateManager for all state operations
this.stateManager.set('scene.cameraPosition', cameraPos);
const savedPosition = this.stateManager.get('scene.cameraPosition');

// Subscribe to state changes with automatic persistence
this.stateManager.subscribe('selection.objects', (selectedIds) => {
    this.updateUI(selectedIds);
});

// Structured state hierarchy
const appState = {
    app: { initialized: true, activePanel: 'properties' },
    scene: { cameraPosition: [0, 5, 10], selectedCount: 2 },
    tools: { activeTool: 'select', isOperating: false }
};
```

#### Configuration Migration

**❌ OLD PATTERN - Hardcoded Values:**
```javascript
// Magic numbers and hardcoded settings
const edgeColor = '#0078d4';
const thickness = 2;
const opacity = 0.5;
const hoverColor = '#ff6600';

// Inconsistent settings access
const uiSettings = this.settingsManager.getUISettings();
if (uiSettings.highlights.thickness) { /* ... */ }
```

**✅ NEW PATTERN - Schema-Based Configuration:**
```javascript
// Use ConfigurationManager for all settings
const edgeColor = this.configManager.get('ui.selection.edgeColor');
const thickness = this.configManager.get('ui.selection.thickness');

// Schema validation prevents errors
this.configManager.set('ui.selection.thickness', 15); // Auto-validated
// Throws error if > maxValue

// Configuration hierarchy with tool overrides
const config = {
    base: { ui: { selection: { edgeColor: '#0078d4' } } },
    tools: { move: { ui: { selection: { edgeColor: '#ff6600' } } } }
};
```

#### Dependency Injection Migration

**❌ OLD PATTERN - Global Access and Hard Dependencies:**
```javascript
// Global window access and tightly coupled systems
if (window.modlerApp && window.modlerApp.sceneManager) {
    window.modlerApp.sceneManager.scene.add(object);
}

// Hard dependencies without injection
class ToolManager {
    constructor() {
        this.highlightSystem = new HighlightSystem();
        this.materialManager = new MaterialManager();
    }
}
```

**✅ NEW PATTERN - Constructor Injection:**
```javascript
// Dependency injection with fallbacks
class Container {
    constructor(name, objectManager = null, materialManager = null, sceneManager = null) {
        this.objectManager = objectManager;
        this.materialManager = materialManager;
        this.sceneManager = sceneManager;
    }
    
    createBoundingBox() {
        const material = this.materialManager ? 
            this.materialManager.getLineMaterial(0x0078d4) :
            new THREE.LineBasicMaterial({ color: 0x0078d4 }); // Fallback
            
        if (this.sceneManager) {
            this.sceneManager.scene.add(boundingBox);
        } else if (window.modlerApp?.sceneManager) {
            // Backward compatibility fallback
            window.modlerApp.sceneManager.scene.add(boundingBox);
        }
    }
}

// Main app initialization with proper injection
this.materialManager = new MaterialManager();
this.stateManager = new StateManager();
this.objectManager = new ObjectManager(
    this.sceneManager, 
    this.materialManager, 
    this.stateManager
);
```

#### Class Updates Migration

**Step-by-Step Migration Process:**

1. **Update Constructor** - Add centralized manager parameters
```javascript
// OLD
constructor(scene, camera) { ... }

// NEW  
constructor(scene, camera, materialManager = null, stateManager = null) { ... }
```

2. **Update Material Creation** - Replace direct THREE.js calls
```javascript
// OLD
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

// NEW
const material = this.materialManager ? 
    this.materialManager.getObjectMaterial(0xff0000) :
    new THREE.MeshBasicMaterial({ color: 0xff0000 });
```

3. **Update Instantiation** - Pass managers when creating objects
```javascript
// OLD
const container = new Container('Group 1');

// NEW
const container = new Container('Group 1', this.objectManager, this.materialManager);
```

4. **Update State Access** - Use centralized state management
```javascript
// OLD
this.selectedCount = objects.length;

// NEW
this.stateManager.set('selection.selectedCount', objects.length);
```

### Migration Checklist

When migrating any system to centralized architecture:

- [ ] **Constructor**: Add centralized manager parameters with defaults
- [ ] **Material Creation**: Replace all `new THREE.*Material` with manager calls
- [ ] **State Access**: Replace direct property access with StateManager
- [ ] **Configuration**: Replace hardcoded values with ConfigurationManager
- [ ] **Object Creation**: Use ObjectManager for consistent lifecycle
- [ ] **Instantiation**: Update all creation sites to pass managers
- [ ] **Fallbacks**: Provide backward compatibility where needed
- [ ] **Testing**: Verify functionality with both new and legacy code paths

### Files Requiring Migration

Priority files identified for centralized architecture migration:

**High Priority** (Active usage):
- ✅ `/js/geometry/GeometryManager.js` - Updated to use MaterialManager
- ✅ `/js/core/SnapManager.js` - Updated to use MaterialManager  
- ✅ `/js/geometry/Container.js` - Updated to use centralized systems
- ✅ `HighlightSystem.js` - Completely migrated to HighlightManager and removed
- ✅ `/js/tools/*.js` - Tool classes updated with centralized manager integration
- ✅ `/js/ui/SettingsManager.js` - Updated to use StateManager and ConfigurationManager

**Medium Priority**:
- `/js/selection/SelectionManager.js` - StateManager integration needed
- `/js/ui/HierarchyPanel.js` - Enhanced centralized system usage
- Legacy material creation instances throughout codebase

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-23 | Initial comprehensive documentation |
| 1.1 | 2025-01-23 | Added centralized highlighting and snapping systems |
| 2.0 | 2025-08-23 | Added centralized material, state, object, camera, and configuration management |

---

**Remember**: This document is the single source of truth. Always consult it before implementing new features or modifying existing systems. The new centralized architecture provides:

- **MaterialManager**: Eliminates 71+ material creation instances with caching
- **StateManager**: Unified application state with pub-sub and persistence
- **ObjectManager**: Consistent object lifecycle and hierarchy management
- **CameraManager**: Unified camera operations and viewport control
- **ConfigurationManager**: Schema-based settings with validation

When in doubt, follow the established patterns rather than creating new approaches.