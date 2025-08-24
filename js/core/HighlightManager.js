/**
 * HighlightManager - Centralized highlight system with configurable behaviors
 * 
 * This manager provides a unified API for all highlighting needs while allowing
 * tool-specific and object-type specific customizations through configuration.
 */
class HighlightManager {
    constructor(scene, camera, canvas, materialManager = null) {
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;
        this.materialManager = materialManager;
        
        // Configuration for different highlight types and contexts
        this.config = {
            // Default highlight styles
            styles: {
                selection: {
                    color: 0x0078d4,      // Blue
                    thickness: 2,
                    opacity: 1.0,
                    type: 'edge'           // 'edge', 'wireframe', 'glow'
                },
                hover: {
                    color: 0xff6600,       // Orange  
                    thickness: 2,
                    opacity: 0.5,
                    type: 'wireframe'
                },
                temporary: {
                    color: 0x00ff00,       // Green
                    thickness: 3,
                    opacity: 0.8,
                    type: 'edge'
                },
                face: {
                    color: 0x0078d4,       // Blue
                    opacity: 0.1,
                    type: 'overlay'
                }
            },
            
            // Tool-specific overrides
            tools: {
                'move': {
                    selection: { type: 'edge', thickness: 3 },
                    temporary: { color: 0xff6600, type: 'corner' },
                    face: { opacity: 0.15, color: 0x0078d4, type: 'overlay' } // Face hover for move tool
                },
                'pushpull': {
                    selection: { type: 'edge', thickness: 2 },
                    face: { opacity: 0.2, color: 0x0078d4, type: 'overlay' } // Face hover for push tool
                },
                'select': {
                    selection: { type: 'edge', thickness: 2 },
                    hover: { type: 'wireframe', opacity: 0.3 },
                    face: { opacity: 0.1, color: 0x0078d4, type: 'overlay' } // Face hover for select tool
                }
            },
            
            // Object-type specific overrides  
            objectTypes: {
                'container': {
                    selection: { type: 'bounding_box', color: 0x0078d4, thickness: 2 }
                },
                'box': {
                    selection: { type: 'edge', thickness: 2 }
                },
                'circle': {
                    selection: { type: 'edge', thickness: 2 },
                    hover: { type: 'wireframe' }
                }
            },
            
            // Context-specific behaviors
            contexts: {
                'multi_select': {
                    selection: { opacity: 0.7 } // Dimmer when multiple selected
                },
                'dragging': {
                    selection: { opacity: 0.5 },
                    temporary: { thickness: 4 }
                }
            }
        };
        
        // Active highlights tracking
        this.activeHighlights = {
            selection: new Map(),      // object -> highlight info
            hover: new Map(),          // object -> highlight info
            temporary: new Map(),      // id -> highlight info
            face: new Map()           // object -> face highlight info
        };
        
        // Current context for dynamic behavior
        this.currentContext = {
            activeTool: 'select',
            isMultiSelect: false,
            isDragging: false
        };
    }
    
    // Context Management
    setContext(context) {
        this.currentContext = { ...this.currentContext, ...context };
        
        // Update existing highlights to reflect context changes
        this.refreshActiveHighlights();
    }
    
    getActiveTool() {
        return this.currentContext.activeTool;
    }
    
    // Configuration Management
    getHighlightConfig(type, objectType = null, toolName = null) {
        const baseTool = toolName || this.currentContext.activeTool;
        const baseStyle = this.config.styles[type] || {};
        
        // Build configuration hierarchy: base -> tool -> objectType -> context
        let config = { ...baseStyle };
        
        // Apply tool-specific overrides
        if (this.config.tools[baseTool] && this.config.tools[baseTool][type]) {
            config = { ...config, ...this.config.tools[baseTool][type] };
        }
        
        // Apply object-type overrides
        if (objectType && this.config.objectTypes[objectType] && this.config.objectTypes[objectType][type]) {
            config = { ...config, ...this.config.objectTypes[objectType][type] };
        }
        
        // Apply context overrides
        Object.keys(this.currentContext).forEach(contextKey => {
            if (this.currentContext[contextKey] && this.config.contexts[contextKey] && this.config.contexts[contextKey][type]) {
                config = { ...config, ...this.config.contexts[contextKey][type] };
            }
        });
        
        return config;
    }
    
    // Main Highlight API
    addSelectionHighlight(object, options = {}) {
        const objectType = object.userData?.type;
        const config = this.getHighlightConfig('selection', objectType);
        const finalConfig = { ...config, ...options };
        
        console.log(`HIGHLIGHT: Adding selection highlight for ${object.userData?.id} with config:`, finalConfig);
        
        this.removeSelectionHighlight(object);
        
        let highlight = null;
        
        switch (finalConfig.type) {
            case 'edge':
                highlight = this.createEdgeHighlight(object, finalConfig);
                break;
            case 'wireframe':
                highlight = this.createWireframeHighlight(object, finalConfig);
                break;
            case 'bounding_box':
                highlight = this.createBoundingBoxHighlight(object, finalConfig);
                break;
            case 'glow':
                highlight = this.createGlowHighlight(object, finalConfig);
                break;
        }
        
        if (highlight) {
            this.activeHighlights.selection.set(object, {
                highlight: highlight,
                config: finalConfig,
                objectType: objectType
            });
        }
    }
    
    removeSelectionHighlight(object) {
        const highlightInfo = this.activeHighlights.selection.get(object);
        if (highlightInfo) {
            this.disposeHighlight(highlightInfo.highlight);
            this.activeHighlights.selection.delete(object);
        }
    }
    
    addHoverHighlight(object, options = {}) {
        const objectType = object.userData?.type;
        const config = this.getHighlightConfig('hover', objectType);
        const finalConfig = { ...config, ...options };
        
        this.removeHoverHighlight(object);
        
        let highlight = null;
        
        switch (finalConfig.type) {
            case 'wireframe':
                highlight = this.createWireframeHighlight(object, finalConfig);
                break;
            case 'edge':
                highlight = this.createEdgeHighlight(object, finalConfig);
                break;
            case 'glow':
                highlight = this.createGlowHighlight(object, finalConfig);
                break;
        }
        
        if (highlight) {
            this.activeHighlights.hover.set(object, {
                highlight: highlight,
                config: finalConfig,
                objectType: objectType
            });
        }
    }
    
    removeHoverHighlight(object) {
        const highlightInfo = this.activeHighlights.hover.get(object);
        if (highlightInfo) {
            this.disposeHighlight(highlightInfo.highlight);
            this.activeHighlights.hover.delete(object);
        }
    }
    
    addTemporaryHighlight(id, position, type, options = {}) {
        const config = this.getHighlightConfig('temporary');
        const finalConfig = { ...config, ...options };
        
        let highlight = null;
        
        switch (type) {
            case 'corner':
                highlight = this.createCornerHighlight(position, finalConfig);
                break;
            case 'edge':
                highlight = this.createEdgeLineHighlight(position, finalConfig);
                break;
            case 'point':
                highlight = this.createPointHighlight(position, finalConfig);
                break;
        }
        
        if (highlight) {
            this.activeHighlights.temporary.set(id, {
                highlight: highlight,
                config: finalConfig,
                type: type
            });
        }
    }
    
    removeTemporaryHighlight(id) {
        const highlightInfo = this.activeHighlights.temporary.get(id);
        if (highlightInfo) {
            this.disposeHighlight(highlightInfo.highlight);
            this.activeHighlights.temporary.delete(id);
        }
    }
    
    clearTemporaryHighlights() {
        this.activeHighlights.temporary.forEach((info, id) => {
            this.disposeHighlight(info.highlight);
        });
        this.activeHighlights.temporary.clear();
    }
    
    addFaceHighlight(object, faceData, options = {}) {
        const objectType = object.userData?.type;
        const config = this.getHighlightConfig('face', objectType);
        const finalConfig = { ...config, ...options };
        
        this.removeFaceHighlight(object);
        
        const highlight = this.createFaceOverlayHighlight(object, faceData, finalConfig);
        
        if (highlight) {
            this.activeHighlights.face.set(object, {
                highlight: highlight,
                config: finalConfig,
                faceData: faceData
            });
        }
    }
    
    removeFaceHighlight(object) {
        const highlightInfo = this.activeHighlights.face.get(object);
        if (highlightInfo) {
            this.disposeHighlight(highlightInfo.highlight);
            this.activeHighlights.face.delete(object);
        }
    }
    
    // Face hover highlighting - tool-aware
    addFaceHoverHighlight(intersectionData, options = {}) {
        if (!intersectionData || !intersectionData.face) return;
        
        const object = intersectionData.object;
        const objectType = object.userData?.type;
        const config = this.getHighlightConfig('face', objectType);
        const finalConfig = { ...config, ...options };
        
        // Check if we already have a face highlight for this object
        const existing = this.activeHighlights.face.get(object);
        if (existing && existing.type === 'hover') {
            // Already have a hover highlight for this object, no need to recreate
            return;
        }
        
        // Face hover highlight added (reduced logging)
        
        this.removeFaceHoverHighlight(object);
        
        const faceData = {
            face: intersectionData.face,
            worldNormal: intersectionData.face.normal.clone().transformDirection(object.matrixWorld).normalize(),
            point: intersectionData.point
        };
        
        const highlight = this.createFaceOverlayHighlight(object, faceData, finalConfig);
        
        if (highlight) {
            this.activeHighlights.face.set(object, {
                highlight: highlight,
                config: finalConfig,
                faceData: faceData,
                type: 'hover'
            });
        }
    }
    
    removeFaceHoverHighlight(object) {
        const highlightInfo = this.activeHighlights.face.get(object);
        if (highlightInfo && highlightInfo.type === 'hover') {
            this.disposeHighlight(highlightInfo.highlight);
            this.activeHighlights.face.delete(object);
        }
    }
    
    clearFaceHoverHighlights() {
        const toRemove = [];
        this.activeHighlights.face.forEach((info, object) => {
            if (info.type === 'hover') {
                toRemove.push(object);
            }
        });
        
        toRemove.forEach(object => {
            this.removeFaceHoverHighlight(object);
        });
    }
    
    // Highlight Creation Methods
    createEdgeHighlight(object, config) {
        // Delegate to existing HighlightSystem but with our config
        const tempUISettings = {
            selection: {
                edgeColor: `#${config.color.toString(16).padStart(6, '0')}`,
                thickness: config.thickness
            }
        };
        
        // Use our own createThickEdgeHighlight method instead of HighlightSystem
        const highlight = this.createThickEdgeHighlight(
            object.geometry, 
            config.color, 
            config.thickness
        );
        
        if (highlight) {
            highlight.position.copy(object.position);
            highlight.rotation.copy(object.rotation);
            highlight.scale.copy(object.scale);
            highlight.userData = { 
                isHighlight: true, 
                highlightType: 'edge',
                sourceObject: object.userData?.id 
            };
            this.scene.add(highlight);
        }
        
        return highlight;
    }
    
    createWireframeHighlight(object, config) {
        const wireframe = new THREE.WireframeGeometry(object.geometry);
        const material = this.materialManager ? 
            this.materialManager.getLineMaterial(config.color, {
                transparent: true,
                opacity: config.opacity,
                depthTest: false,
                depthWrite: false
            }) : 
            new THREE.LineBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: config.opacity,
                depthTest: false,
                depthWrite: false
            });
        
        const highlight = new THREE.LineSegments(wireframe, material);
        highlight.position.copy(object.position);
        highlight.rotation.copy(object.rotation);
        highlight.scale.copy(object.scale);
        highlight.userData = { 
            isHighlight: true, 
            highlightType: 'wireframe',
            sourceObject: object.userData?.id 
        };
        highlight.renderOrder = 99;
        
        this.scene.add(highlight);
        return highlight;
    }
    
    createBoundingBoxHighlight(object, config) {
        // For containers - create bounding box wireframe
        if (object.isContainer) {
            object.setSelected(true); // Use container's built-in method
            return object.boundingBoxHelper;
        } else {
            // Regular object bounding box
            const box = new THREE.BoxHelper(object, config.color);
            box.userData = { 
                isHighlight: true, 
                highlightType: 'bounding_box',
                sourceObject: object.userData?.id 
            };
            box.renderOrder = 101;
            box.material.depthTest = false;
            box.material.depthWrite = false;
            
            this.scene.add(box);
            return box;
        }
    }
    
    createGlowHighlight(object, config) {
        // Advanced glow effect - for future implementation
        console.warn('Glow highlights not yet implemented');
        return null;
    }
    
    createCornerHighlight(position, config) {
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = this.materialManager ? 
            this.materialManager.getHighlightMaterial('temporary', {
                color: config.color,
                transparent: true,
                opacity: config.opacity,
                depthTest: false,
                depthWrite: false
            }) : 
            new THREE.MeshBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: config.opacity,
                depthTest: false,
                depthWrite: false
            });
        
        const highlight = new THREE.Mesh(geometry, material);
        highlight.position.copy(position);
        highlight.userData = { 
            isHighlight: true, 
            highlightType: 'corner' 
        };
        highlight.renderOrder = 1000;
        
        this.scene.add(highlight);
        return highlight;
    }
    
    createEdgeLineHighlight(edgeData, config) {
        if (!edgeData.start || !edgeData.end) {
            console.warn('HighlightManager: Invalid edge data for highlight');
            return null;
        }
        
        const points = [edgeData.start, edgeData.end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = this.materialManager ? 
            this.materialManager.getLineMaterial(config.color, {
                linewidth: config.thickness || 3,
                depthTest: false,
                depthWrite: false
            }) :
            new THREE.LineBasicMaterial({
                color: config.color,
                linewidth: config.thickness || 3,
                depthTest: false,
                depthWrite: false
            });
        
        const highlight = new THREE.Line(geometry, material);
        highlight.userData = { 
            isHighlight: true, 
            highlightType: 'edge_line' 
        };
        highlight.renderOrder = 1000;
        
        this.scene.add(highlight);
        return highlight;
    }
    
    createPointHighlight(position, config) {
        const geometry = new THREE.RingGeometry(0.05, 0.1, 16);
        const material = new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: config.opacity,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });
        
        const highlight = new THREE.Mesh(geometry, material);
        highlight.position.copy(position);
        highlight.lookAt(this.camera.position);
        highlight.userData = { 
            isHighlight: true, 
            highlightType: 'point' 
        };
        highlight.renderOrder = 1000;
        
        this.scene.add(highlight);
        return highlight;
    }
    
    createFaceOverlayHighlight(object, faceData, config) {
        // Create improved face overlay that properly aligns with object geometry
        if (!faceData.face) return null;
        
        const face = faceData.face;
        const worldNormal = face.normal.clone().transformDirection(object.matrixWorld).normalize();
        
        // Create geometry that matches the actual face
        let faceGeometry = this.createProperFaceGeometry(object, worldNormal);
        if (!faceGeometry) return null;
        
        const faceMaterial = this.materialManager ? 
            this.materialManager.getHighlightMaterial('face', {
                color: config.color,
                transparent: true,
                opacity: config.opacity,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false
            }) : 
            new THREE.MeshBasicMaterial({
                color: new THREE.Color(config.color),
                transparent: true,
                opacity: config.opacity,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false
            });
        
        const faceHighlight = new THREE.Mesh(faceGeometry, faceMaterial);
        
        // Calculate the face center position in world space
        const faceCenter = this.calculatePreciseFaceCenter(object, worldNormal);
        
        // Position the highlight at the face center
        faceHighlight.position.copy(faceCenter);
        
        // Copy object rotation to align with object orientation
        faceHighlight.rotation.copy(object.rotation);
        
        // For rectangles (PlaneGeometry), don't apply additional orientation
        if (!(object.geometry instanceof THREE.PlaneGeometry)) {
            // Only orient the plane for 3D objects (boxes)
            faceHighlight.lookAt(faceCenter.clone().add(worldNormal));
        }
        
        // Small offset toward camera to avoid z-fighting
        const offset = worldNormal.clone().multiplyScalar(0.001);
        faceHighlight.position.add(offset);
        
        faceHighlight.userData = { 
            isHighlight: true, 
            highlightType: 'face_overlay',
            sourceObject: object.userData?.id 
        };
        faceHighlight.renderOrder = 102;
        
        // Disable shadows
        faceHighlight.castShadow = false;
        faceHighlight.receiveShadow = false;
        
        this.scene.add(faceHighlight);
        return faceHighlight;
    }
    
    createProperFaceGeometry(object, worldNormal) {
        // Create geometry that exactly matches the face dimensions
        const width = object.userData.width || 2;
        const height = object.userData.height || 1;
        const depth = object.userData.depth || 3;
        
        if (object.geometry instanceof THREE.BoxGeometry) {
            // Determine which face we're highlighting based on normal
            if (Math.abs(worldNormal.y) > 0.7) {
                // Top/bottom face - use width x depth
                return new THREE.PlaneGeometry(width, depth);
            } else if (Math.abs(worldNormal.x) > 0.7) {
                // Left/right face - use depth x height  
                return new THREE.PlaneGeometry(depth, height);
            } else if (Math.abs(worldNormal.z) > 0.7) {
                // Front/back face - use width x height
                return new THREE.PlaneGeometry(width, height);
            }
        } else if (object.geometry instanceof THREE.PlaneGeometry) {
            // For rectangles/planes, use the actual dimensions
            return new THREE.PlaneGeometry(width, height);
        }
        
        // Fallback
        return new THREE.PlaneGeometry(1, 1);
    }
    
    calculatePreciseFaceCenter(object, worldNormal) {
        // Handle rectangles (PlaneGeometry) differently from boxes (BoxGeometry)
        if (object.geometry instanceof THREE.PlaneGeometry) {
            // For rectangles, the face center is the object center (no offset needed)
            // PlaneGeometry objects are centered at their position
            return object.position.clone();
        }
        
        // For boxes and other 3D objects, calculate face offset
        const width = object.userData.width || 2;
        const height = object.userData.height || 1;
        const depth = object.userData.depth || 3;
        
        // Start with local face center offset
        let localOffset = new THREE.Vector3();
        
        // Determine face offset based on normal direction
        if (Math.abs(worldNormal.y) > 0.7) {
            // Top or bottom face
            localOffset.y = (height / 2) * Math.sign(worldNormal.y);
        } else if (Math.abs(worldNormal.x) > 0.7) {
            // Left or right face
            localOffset.x = (width / 2) * Math.sign(worldNormal.x);
        } else if (Math.abs(worldNormal.z) > 0.7) {
            // Front or back face
            localOffset.z = (depth / 2) * Math.sign(worldNormal.z);
        }
        
        // Transform to world space using object's transformation matrix
        const worldFaceCenter = localOffset.applyMatrix4(object.matrixWorld);
        
        return worldFaceCenter;
    }
    
    // Utility Methods
    updateHighlightTransforms() {
        // Update all object-bound highlights when objects move
        this.activeHighlights.selection.forEach((info, object) => {
            if (info.highlight && object) {
                this.updateHighlightTransform(info.highlight, object);
            }
        });
        
        this.activeHighlights.hover.forEach((info, object) => {
            if (info.highlight && object) {
                this.updateHighlightTransform(info.highlight, object);
            }
        });
    }
    
    updateHighlightTransform(highlight, object) {
        highlight.position.copy(object.position);
        highlight.rotation.copy(object.rotation);
        highlight.scale.copy(object.scale);
        highlight.updateMatrix();
    }
    
    refreshActiveHighlights() {
        // Recreate all highlights with current context
        const tempSelections = Array.from(this.activeHighlights.selection.keys());
        const tempHovers = Array.from(this.activeHighlights.hover.keys());
        
        tempSelections.forEach(object => {
            this.removeSelectionHighlight(object);
            this.addSelectionHighlight(object);
        });
        
        tempHovers.forEach(object => {
            this.removeHoverHighlight(object);
            this.addHoverHighlight(object);
        });
    }
    
    disposeHighlight(highlight) {
        if (!highlight) return;
        
        if (highlight.parent) {
            highlight.parent.remove(highlight);
        }
        
        if (highlight.geometry) highlight.geometry.dispose();
        if (highlight.material) {
            if (Array.isArray(highlight.material)) {
                highlight.material.forEach(mat => mat.dispose());
            } else {
                highlight.material.dispose();
            }
        }
        
        if (highlight.children) {
            highlight.children.forEach(child => this.disposeHighlight(child));
        }
    }
    
    // Tool Integration Methods - these are called by tools
    onToolActivated(toolName) {
        this.setContext({ activeTool: toolName });
        console.log(`HIGHLIGHT: Tool activated: ${toolName}`);
    }
    
    onObjectManipulationStart() {
        this.setContext({ isDragging: true });
    }
    
    onObjectManipulationEnd() {
        this.setContext({ isDragging: false });
    }
    
    onSelectionChanged(selectedObjects) {
        this.setContext({ isMultiSelect: selectedObjects.length > 1 });
    }
    
    // Legacy HighlightSystem compatibility methods
    highlightSelectedFace(faceData) {
        if (!faceData || !faceData.object) return;
        
        const config = this.getHighlightConfig('face', faceData.object.userData.type);
        const selectionConfig = {
            ...config,
            color: this.config.styles.selection.color,
            opacity: 0.2, // More visible for selected faces
            type: 'overlay'
        };
        
        // Use existing face highlight method but with selection styling
        this.addFaceHighlight(faceData.object, faceData, selectionConfig);
        
        // Mark as selected face
        const highlightInfo = this.activeHighlights.face.get(faceData.object);
        if (highlightInfo) {
            highlightInfo.type = 'selected';
        }
    }
    
    clearSelectedFaceHighlight(object) {
        const highlightInfo = this.activeHighlights.face.get(object);
        if (highlightInfo && highlightInfo.type === 'selected') {
            this.disposeHighlight(highlightInfo.highlight);
            this.activeHighlights.face.delete(object);
        }
    }
    
    highlightFace(faceData) {
        // Alias to existing method for compatibility
        this.addFaceHoverHighlight(faceData);
    }
    
    clearFaceHover(faceData) {
        // Alias to existing method for compatibility
        if (faceData && faceData.object) {
            this.removeFaceHoverHighlight(faceData.object);
        }
    }
    
    addObjectEdgeHighlight(object) {
        // Alias to selection highlight for compatibility
        this.addSelectionHighlight(object, { type: 'edge' });
    }
    
    removeObjectEdgeHighlight(object) {
        // Alias to remove selection highlight for compatibility
        this.removeSelectionHighlight(object);
    }
    
    updateObjectEdgeHighlight(object) {
        // Remove and re-add to update
        this.removeSelectionHighlight(object);
        this.addSelectionHighlight(object, { type: 'edge' });
    }
    
    updateSelectionHighlights() {
        // Re-create all selection highlights to apply any config changes
        const objectsToUpdate = Array.from(this.activeHighlights.selection.keys());
        objectsToUpdate.forEach(object => {
            const info = this.activeHighlights.selection.get(object);
            if (info) {
                this.removeSelectionHighlight(object);
                this.addSelectionHighlight(object, info.config);
            }
        });
        
        console.log('HIGHLIGHT: Updated', objectsToUpdate.length, 'selection highlights');
    }
    
    clearHoverHighlight(object) {
        // Alias to existing method for compatibility
        this.removeHoverHighlight(object);
    }
    
    updateEdgeHighlightThickness() {
        // Update edge highlight thickness based on camera distance
        this.activeHighlights.selection.forEach((info, object) => {
            if (info.config.type === 'edge' && info.highlight && info.highlight.children) {
                info.highlight.children.forEach(tube => {
                    const distanceToCamera = this.camera.position.distanceTo(tube.position);
                    
                    // Safety checks
                    if (!isFinite(distanceToCamera) || distanceToCamera <= 0) {
                        return;
                    }
                    
                    const fov = this.camera.fov || 75;
                    const canvasHeight = this.canvas.clientHeight || 600;
                    const pixelsToWorldScale = (distanceToCamera * Math.tan(fov * Math.PI / 360)) / (canvasHeight / 2);
                    let tubeRadius = info.config.thickness * pixelsToWorldScale;
                    
                    if (!isFinite(tubeRadius) || tubeRadius <= 0) {
                        tubeRadius = 0.01;
                    }
                    
                    // Update tube geometry if it has the scale method
                    if (tube.scale) {
                        tube.scale.setScalar(tubeRadius);
                    }
                });
            }
        });
    }
    
    /**
     * Create thick edge highlight using tube geometry
     * Migrated from HighlightSystem for complete independence
     */
    createThickEdgeHighlight(geometry, color, thickness) {
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
                // Calculate screen-space thickness with safety checks
                const center = start.clone().add(end).multiplyScalar(0.5);
                const distanceToCamera = this.camera.position.distanceTo(center);
                
                // Safety checks to prevent NaN
                if (!isFinite(distanceToCamera) || distanceToCamera <= 0) {
                    console.warn('HIGHLIGHT: Invalid distance to camera for edge highlight:', distanceToCamera);
                    continue;
                }
                
                const fov = this.camera.fov || 75; // Fallback FOV
                const canvasHeight = this.canvas.clientHeight || 600; // Fallback height
                
                const pixelsToWorldScale = (distanceToCamera * Math.tan(fov * Math.PI / 360)) / (canvasHeight / 2);
                let tubeRadius = thickness * pixelsToWorldScale;
                
                // Ensure tubeRadius is valid and has a minimum size for visibility
                if (!isFinite(tubeRadius) || tubeRadius <= 0) {
                    tubeRadius = 0.01; // Fallback radius
                    console.warn('HIGHLIGHT: Using fallback radius for edge highlight');
                } else if (tubeRadius < 0.005) {
                    // Ensure minimum visibility
                    tubeRadius = Math.max(tubeRadius, 0.005);
                    console.log('HIGHLIGHT: Enforcing minimum tube radius:', tubeRadius);
                }
                console.log('HIGHLIGHT: Creating edge tube with radius:', tubeRadius, 'thickness setting:', thickness, 'distance:', distanceToCamera);
                
                const tubeGeometry = new THREE.CylinderGeometry(tubeRadius, tubeRadius, length, 8);
                const tubeMaterial = this.materialManager ? 
                    this.materialManager.getMaterial('mesh_basic', {
                        color: edgeColor,
                        transparent: false,
                        depthTest: false,
                        depthWrite: false
                    }, 'highlights', 'selection') :
                    new THREE.MeshBasicMaterial({
                        color: edgeColor,
                        transparent: false,
                        depthTest: false,
                        depthWrite: false
                    });
                
                const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
                
                // Disable shadow casting and receiving for all highlights
                tube.castShadow = false;
                tube.receiveShadow = false;
                
                // Store original length for thickness updates
                tube.userData.originalLength = length;
                
                // Position the tube at the center of the edge
                if (isFinite(center.x) && isFinite(center.y) && isFinite(center.z)) {
                    tube.position.copy(center);
                } else {
                    tube.position.set(0, 0, 0);
                }
                
                // Properly orient the cylinder to align with the edge
                const up = new THREE.Vector3(0, 1, 0);
                direction.normalize();
                
                // Check for valid direction
                if (!isFinite(direction.x) || !isFinite(direction.y) || !isFinite(direction.z)) {
                    direction.set(0, 1, 0);
                }
                
                const quaternion = new THREE.Quaternion();
                quaternion.setFromUnitVectors(up, direction);
                tube.quaternion.copy(quaternion);
                
                tube.renderOrder = 100;
                group.add(tube);
            }
        }
        
        // Fallback to simple lines if mesh approach fails
        if (group.children.length === 0) {
            const edgeMaterial = this.materialManager ? 
                this.materialManager.getLineMaterial(edgeColor) :
                new THREE.LineBasicMaterial({ 
                    color: edgeColor, 
                    transparent: false,
                    depthTest: false,
                    depthWrite: false
                });
            const fallbackHighlight = new THREE.LineSegments(edges, edgeMaterial);
            fallbackHighlight.renderOrder = 100;
            return fallbackHighlight;
        }
        
        group.userData = { isObjectEdgeHighlight: true, selectable: false };
        group.renderOrder = 100;
        
        return group;
    }
    
    /**
     * Refresh all active highlights with current configuration
     * Called when UI settings change thickness, colors, etc.
     */
    refreshActiveHighlights() {
        console.log('HIGHLIGHT: Refreshing all active highlights with updated config');
        
        // Get all currently highlighted objects
        const selectionObjects = new Map();
        const hoverObjects = new Map();
        const temporaryObjects = new Map();
        const faceObjects = new Map();
        
        // Store current highlight targets (NOTE: don't use old config, get fresh config)
        this.activeHighlights.selection.forEach((info) => {
            if (info.object) {
                // Get fresh config with updated thickness/colors
                const freshConfig = this.getHighlightConfig('selection', info.object.userData.type);
                selectionObjects.set(info.object.userData.id, { object: info.object, config: freshConfig });
            }
        });
        
        this.activeHighlights.hover.forEach((info) => {
            if (info.object) {
                const freshConfig = this.getHighlightConfig('hover', info.object.userData.type);
                hoverObjects.set(info.object.userData.id, { object: info.object, config: freshConfig });
            }
        });
        
        this.activeHighlights.temporary.forEach((info) => {
            if (info.object) {
                const freshConfig = this.getHighlightConfig('temporary', info.object.userData.type);
                temporaryObjects.set(info.object.userData.id, { object: info.object, config: freshConfig });
            }
        });
        
        this.activeHighlights.face.forEach((info) => {
            if (info.object) {
                const freshConfig = this.getHighlightConfig('face', info.object.userData.type);
                faceObjects.set(info.object.userData.id, { object: info.object, config: freshConfig });
            }
        });
        
        // Clear all existing highlights
        this.clearTemporaryHighlights();
        this.activeHighlights.selection.forEach((info) => this.disposeHighlight(info.highlight));
        this.activeHighlights.hover.forEach((info) => this.disposeHighlight(info.highlight));
        this.activeHighlights.face.forEach((info) => this.disposeHighlight(info.highlight));
        
        this.activeHighlights.selection.clear();
        this.activeHighlights.hover.clear();
        this.activeHighlights.face.clear();
        
        // Recreate all highlights with updated configuration
        selectionObjects.forEach(({ object, config }) => {
            console.log('HIGHLIGHT: Recreating selection highlight for object:', object.userData.id, 'with thickness:', config.thickness);
            this.addSelectionHighlight(object, config);
        });
        
        hoverObjects.forEach(({ object, config }) => {
            console.log('HIGHLIGHT: Recreating hover highlight for object:', object.userData.id);
            this.addHoverHighlight(object, config);
        });
        
        faceObjects.forEach(({ object, config }) => {
            console.log('HIGHLIGHT: Recreating face highlight for object:', object.userData.id);
            this.addFaceHighlight(object, config);
        });
        
        // Note: temporary highlights are intentionally not recreated as they're transient
        
        console.log('HIGHLIGHT: Finished refreshing', 
            selectionObjects.size, 'selection,',
            hoverObjects.size, 'hover,', 
            faceObjects.size, 'face highlights');
    }
    
    // Cleanup
    dispose() {
        this.activeHighlights.selection.forEach((info) => this.disposeHighlight(info.highlight));
        this.activeHighlights.hover.forEach((info) => this.disposeHighlight(info.highlight));
        this.activeHighlights.temporary.forEach((info) => this.disposeHighlight(info.highlight));
        this.activeHighlights.face.forEach((info) => this.disposeHighlight(info.highlight));
        
        this.activeHighlights.selection.clear();
        this.activeHighlights.hover.clear();
        this.activeHighlights.temporary.clear();
        this.activeHighlights.face.clear();
    }
}

// Export for module use
window.HighlightManager = HighlightManager;