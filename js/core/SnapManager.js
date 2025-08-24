/**
 * SnapManager - Centralized snapping system with configurable behaviors
 * 
 * This manager provides a unified API for all snapping needs while allowing
 * tool-specific and object-type specific customizations through configuration.
 */
class SnapManager {
    constructor(scene, camera, canvas, geometryManager, grid, materialManager = null) {
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;
        this.geometryManager = geometryManager;
        this.grid = grid;
        this.materialManager = materialManager;
        
        // Configuration for different snap types and contexts
        this.config = {
            // Global snap settings
            global: {
                enabled: true,
                visualFeedback: true,
                audioFeedback: false // Future: snap sound
            },
            
            // Snap type configurations
            types: {
                grid: {
                    enabled: true,
                    distance: 0.5,
                    priority: 1,
                    visual: { color: 0x888888, size: 0.1 }
                },
                corner: {
                    enabled: true,
                    distance: 2.0,
                    priority: 3,
                    visual: { color: 0x00ff00, size: 0.15 }
                },
                edge: {
                    enabled: true,
                    distance: 1.5,
                    priority: 2,
                    visual: { color: 0x00ff00, thickness: 4 }
                },
                face: {
                    enabled: true,
                    distance: 2.0,
                    priority: 2,
                    axisAlignedOnly: true, // Only snap to axis-aligned faces
                    visual: { color: 0x0078d4, opacity: 0.3 }
                },
                center: {
                    enabled: true,
                    distance: 1.8,
                    priority: 2,
                    visual: { color: 0xff6600, size: 0.12 }
                }
            },
            
            // Tool-specific snap behaviors
            tools: {
                'move': {
                    types: ['corner', 'edge', 'face', 'center'],
                    grid: { enabled: false }, // Move tool doesn't use grid snapping
                    corner: { distance: 2.5, priority: 4 },
                    face: { axisConstrainedOnly: true } // Only snap to faces when axis-constrained
                },
                'pushpull': {
                    types: ['face'], // Push-pull only snaps to faces
                    face: { distance: 1.0, axisAlignedOnly: true }
                },
                'select': {
                    types: [], // Select tool has no snapping
                    global: { enabled: false }
                },
                'rectangle': {
                    types: ['grid', 'corner', 'edge', 'face'],
                    grid: { distance: 0.3 }
                },
                'circle': {
                    types: ['grid', 'center', 'corner'],
                    center: { priority: 4 } // Prefer center snapping for circles
                }
            },
            
            // Object-type specific snap targets
            objectTypes: {
                'box': {
                    provides: ['corner', 'edge', 'face', 'center'],
                    face: { axisAligned: true }
                },
                'rectangle': {
                    provides: ['corner', 'edge', 'center'],
                    edge: { priority: 3 } // Rectangles prefer edge snapping
                },
                'circle': {
                    provides: ['center', 'edge'],
                    center: { priority: 4 }
                },
                'container': {
                    provides: ['corner', 'center'], // Containers only provide basic snaps
                    corner: { useBoundingBox: true }
                }
            },
            
            // Context-specific behaviors
            contexts: {
                'face_constrained': {
                    face: { enabled: true, sameAxisOnly: true },
                    corner: { enabled: false },
                    edge: { enabled: false }
                },
                'multi_select': {
                    // Reduce snap distances when multiple objects selected
                    corner: { distance: 1.5 },
                    edge: { distance: 1.2 }
                }
            }
        };
        
        // Current context
        this.currentContext = {
            activeTool: 'select',
            isMultiSelect: false,
            isFaceConstrained: false,
            constrainedAxis: null
        };
        
        // Active snap state
        this.activeSnap = null;
        this.snapPreview = null;
        
        // Snap detection cache for performance
        this.snapCache = new Map();
        this.cacheTimeout = 100; // ms
    }
    
    // Context Management
    setContext(context) {
        this.currentContext = { ...this.currentContext, ...context };
        this.clearSnapCache();
        
        console.log(`SNAP: Context updated:`, this.currentContext);
    }
    
    // Configuration Management
    getSnapConfig(type, objectType = null) {
        const baseTool = this.currentContext.activeTool;
        const baseConfig = this.config.types[type] || {};
        
        // Build configuration hierarchy: base -> tool -> objectType -> context
        let config = { ...baseConfig };
        
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
            const contextConfig = this.config.contexts[contextKey];
            if (this.currentContext[contextKey] && contextConfig && contextConfig[type]) {
                config = { ...config, ...contextConfig[type] };
            }
        });
        
        return config;
    }
    
    isSnapTypeEnabled(type) {
        const baseTool = this.currentContext.activeTool;
        const globalEnabled = this.config.global.enabled;
        const toolConfig = this.config.tools[baseTool];
        
        if (!globalEnabled) return false;
        if (toolConfig && toolConfig.global && !toolConfig.global.enabled) return false;
        if (toolConfig && toolConfig.types && !toolConfig.types.includes(type)) return false;
        
        const typeConfig = this.getSnapConfig(type);
        return typeConfig.enabled !== false;
    }
    
    // Main Snap Detection API
    detectSnapTargets(position, excludeObjects = []) {
        const cacheKey = this.generateCacheKey(position, excludeObjects);
        if (this.snapCache.has(cacheKey)) {
            const cached = this.snapCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.targets;
            }
        }
        
        const targets = [];
        
        // Detect each snap type
        if (this.isSnapTypeEnabled('grid')) {
            const gridTarget = this.detectGridSnap(position);
            if (gridTarget) targets.push(gridTarget);
        }
        
        if (this.isSnapTypeEnabled('corner')) {
            const cornerTargets = this.detectCornerSnaps(position, excludeObjects);
            targets.push(...cornerTargets);
        }
        
        if (this.isSnapTypeEnabled('edge')) {
            const edgeTargets = this.detectEdgeSnaps(position, excludeObjects);
            targets.push(...edgeTargets);
        }
        
        if (this.isSnapTypeEnabled('face')) {
            const faceTargets = this.detectFaceSnaps(position, excludeObjects);
            targets.push(...faceTargets);
        }
        
        if (this.isSnapTypeEnabled('center')) {
            const centerTargets = this.detectCenterSnaps(position, excludeObjects);
            targets.push(...centerTargets);
        }
        
        // Sort by priority and distance
        targets.sort((a, b) => {
            const priorityDiff = b.priority - a.priority;
            if (priorityDiff !== 0) return priorityDiff;
            return a.distance - b.distance;
        });
        
        // Cache results
        this.snapCache.set(cacheKey, {
            targets: targets,
            timestamp: Date.now()
        });
        
        return targets;
    }
    
    getBestSnapTarget(position, excludeObjects = []) {
        const targets = this.detectSnapTargets(position, excludeObjects);
        return targets.length > 0 ? targets[0] : null;
    }
    
    // Snap Detection Methods
    detectGridSnap(position) {
        if (!this.grid) return null;
        
        const config = this.getSnapConfig('grid');
        if (!config.enabled) return null;
        
        const snapPoint = this.grid.snapToGrid(position);
        const distance = position.distanceTo(snapPoint);
        
        if (distance <= config.distance) {
            return {
                type: 'grid',
                position: snapPoint,
                distance: distance,
                priority: config.priority,
                visual: config.visual,
                data: { gridPoint: snapPoint }
            };
        }
        
        return null;
    }
    
    detectCornerSnaps(position, excludeObjects) {
        const config = this.getSnapConfig('corner');
        if (!config.enabled) return [];
        
        const targets = [];
        const testableObjects = this.getTestableObjects(excludeObjects);
        
        testableObjects.forEach(object => {
            const objectType = object.userData?.type;
            const objectConfig = this.config.objectTypes[objectType];
            
            if (!objectConfig?.provides?.includes('corner')) return;
            
            const corners = this.extractObjectCorners(object, objectConfig);
            
            corners.forEach(corner => {
                const distance = position.distanceTo(corner.position);
                if (distance <= config.distance) {
                    targets.push({
                        type: 'corner',
                        position: corner.position.clone(),
                        distance: distance,
                        priority: config.priority,
                        visual: config.visual,
                        data: {
                            object: object,
                            cornerIndex: corner.index,
                            localPosition: corner.localPosition
                        }
                    });
                }
            });
        });
        
        return targets;
    }
    
    detectEdgeSnaps(position, excludeObjects) {
        const config = this.getSnapConfig('edge');
        if (!config.enabled) return [];
        
        const targets = [];
        const testableObjects = this.getTestableObjects(excludeObjects);
        
        testableObjects.forEach(object => {
            const objectType = object.userData?.type;
            const objectConfig = this.config.objectTypes[objectType];
            
            if (!objectConfig?.provides?.includes('edge')) return;
            
            const edges = this.extractObjectEdges(object, objectConfig);
            
            edges.forEach(edge => {
                const closestPoint = this.getClosestPointOnEdge(position, edge);
                const distance = position.distanceTo(closestPoint);
                
                if (distance <= config.distance) {
                    targets.push({
                        type: 'edge',
                        position: closestPoint,
                        distance: distance,
                        priority: config.priority,
                        visual: config.visual,
                        data: {
                            object: object,
                            edge: edge,
                            edgeStart: edge.start,
                            edgeEnd: edge.end
                        }
                    });
                }
            });
        });
        
        return targets;
    }
    
    detectFaceSnaps(position, excludeObjects) {
        const config = this.getSnapConfig('face');
        if (!config.enabled) return [];
        
        // Face snapping uses raycasting for precision
        const targets = [];
        const mouse = this.worldToScreenPosition(position);
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        const testableObjects = this.getTestableObjects(excludeObjects);
        const intersects = raycaster.intersectObjects(testableObjects);
        
        intersects.forEach(intersection => {
            const object = intersection.object;
            const objectType = object.userData?.type;
            const objectConfig = this.config.objectTypes[objectType];
            
            if (!objectConfig?.provides?.includes('face')) return;
            
            const face = intersection.face;
            const worldNormal = face.normal.clone().transformDirection(object.matrixWorld);
            
            // Check axis alignment if required
            if (config.axisAlignedOnly && !this.isFaceAxisAligned(worldNormal)) return;
            
            // Check axis constraint if in face-constrained mode
            if (config.sameAxisOnly && this.currentContext.constrainedAxis) {
                if (!this.isFaceAlignedWithAxis(worldNormal, this.currentContext.constrainedAxis)) return;
            }
            
            const distance = position.distanceTo(intersection.point);
            if (distance <= config.distance) {
                targets.push({
                    type: 'face',
                    position: intersection.point.clone(),
                    distance: distance,
                    priority: config.priority,
                    visual: config.visual,
                    data: {
                        object: object,
                        face: face,
                        worldNormal: worldNormal,
                        faceCenter: this.calculateFaceCenter(object, face, worldNormal)
                    }
                });
            }
        });
        
        return targets;
    }
    
    detectCenterSnaps(position, excludeObjects) {
        const config = this.getSnapConfig('center');
        if (!config.enabled) return [];
        
        const targets = [];
        const testableObjects = this.getTestableObjects(excludeObjects);
        
        testableObjects.forEach(object => {
            const objectType = object.userData?.type;
            const objectConfig = this.config.objectTypes[objectType];
            
            if (!objectConfig?.provides?.includes('center')) return;
            
            const centerPosition = object.position.clone();
            const distance = position.distanceTo(centerPosition);
            
            if (distance <= config.distance) {
                targets.push({
                    type: 'center',
                    position: centerPosition,
                    distance: distance,
                    priority: config.priority,
                    visual: config.visual,
                    data: {
                        object: object,
                        center: centerPosition
                    }
                });
            }
        });
        
        return targets;
    }
    
    // Geometry Extraction Methods
    extractObjectCorners(object, objectConfig) {
        const corners = [];
        
        if (objectConfig.corner?.useBoundingBox && object.isContainer) {
            // Use container bounding box corners
            const bbox = object.boundingBox;
            const min = bbox.min;
            const max = bbox.max;
            
            const cornerPositions = [
                new THREE.Vector3(min.x, min.y, min.z),
                new THREE.Vector3(max.x, min.y, min.z),
                new THREE.Vector3(min.x, max.y, min.z),
                new THREE.Vector3(max.x, max.y, min.z),
                new THREE.Vector3(min.x, min.y, max.z),
                new THREE.Vector3(max.x, min.y, max.z),
                new THREE.Vector3(min.x, max.y, max.z),
                new THREE.Vector3(max.x, max.y, max.z)
            ];
            
            cornerPositions.forEach((pos, index) => {
                corners.push({
                    position: pos,
                    localPosition: pos.clone(),
                    index: index
                });
            });
        } else if (object.geometry instanceof THREE.BoxGeometry) {
            // Extract box corners
            const width = object.userData.width || 2;
            const height = object.userData.height || 1;
            const depth = object.userData.depth || 3;
            
            const halfW = width / 2;
            const halfH = height / 2;
            const halfD = depth / 2;
            
            const localCorners = [
                new THREE.Vector3(-halfW, -halfH, -halfD),
                new THREE.Vector3(halfW, -halfH, -halfD),
                new THREE.Vector3(-halfW, halfH, -halfD),
                new THREE.Vector3(halfW, halfH, -halfD),
                new THREE.Vector3(-halfW, -halfH, halfD),
                new THREE.Vector3(halfW, -halfH, halfD),
                new THREE.Vector3(-halfW, halfH, halfD),
                new THREE.Vector3(halfW, halfH, halfD)
            ];
            
            localCorners.forEach((localPos, index) => {
                const worldPos = localPos.clone().applyMatrix4(object.matrixWorld);
                corners.push({
                    position: worldPos,
                    localPosition: localPos,
                    index: index
                });
            });
        }
        
        return corners;
    }
    
    extractObjectEdges(object, objectConfig) {
        const edges = [];
        
        if (object.geometry instanceof THREE.BoxGeometry || object.geometry instanceof THREE.PlaneGeometry) {
            const edgesGeometry = new THREE.EdgesGeometry(object.geometry);
            const positions = edgesGeometry.attributes.position.array;
            
            for (let i = 0; i < positions.length; i += 6) {
                const start = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
                const end = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
                
                // Transform to world space
                start.applyMatrix4(object.matrixWorld);
                end.applyMatrix4(object.matrixWorld);
                
                edges.push({
                    start: start,
                    end: end,
                    length: start.distanceTo(end),
                    direction: end.clone().sub(start).normalize()
                });
            }
        }
        
        return edges;
    }
    
    // Utility Methods
    getTestableObjects(excludeObjects) {
        return Array.from(this.geometryManager.objects.values()).filter(obj =>
            obj.userData.selectable &&
            !excludeObjects.includes(obj) &&
            obj.visible
        );
    }
    
    getClosestPointOnEdge(position, edge) {
        const edgeVector = edge.end.clone().sub(edge.start);
        const positionVector = position.clone().sub(edge.start);
        
        const t = Math.max(0, Math.min(1, positionVector.dot(edgeVector) / edgeVector.lengthSq()));
        
        return edge.start.clone().add(edgeVector.multiplyScalar(t));
    }
    
    isFaceAxisAligned(worldNormal, threshold = 0.97) {
        return Math.abs(worldNormal.x) > threshold ||
               Math.abs(worldNormal.y) > threshold ||
               Math.abs(worldNormal.z) > threshold;
    }
    
    isFaceAlignedWithAxis(worldNormal, constrainedAxis) {
        const threshold = 0.7;
        switch (constrainedAxis) {
            case 'x': return Math.abs(worldNormal.x) > threshold;
            case 'y': return Math.abs(worldNormal.y) > threshold;
            case 'z': return Math.abs(worldNormal.z) > threshold;
            default: return false;
        }
    }
    
    calculateFaceCenter(object, face, worldNormal) {
        const width = object.userData.width || 2;
        const height = object.userData.height || 1;
        const depth = object.userData.depth || 3;
        
        let localOffset = new THREE.Vector3();
        
        if (Math.abs(worldNormal.y) > 0.7) {
            localOffset.y = (height / 2) * Math.sign(worldNormal.y);
        } else if (Math.abs(worldNormal.x) > 0.7) {
            localOffset.x = (width / 2) * Math.sign(worldNormal.x);
        } else if (Math.abs(worldNormal.z) > 0.7) {
            localOffset.z = (depth / 2) * Math.sign(worldNormal.z);
        }
        
        return localOffset.applyMatrix4(object.matrixWorld);
    }
    
    worldToScreenPosition(worldPosition) {
        const screenPosition = worldPosition.clone().project(this.camera);
        return new THREE.Vector2(screenPosition.x, screenPosition.y);
    }
    
    generateCacheKey(position, excludeObjects) {
        const posKey = `${position.x.toFixed(2)},${position.y.toFixed(2)},${position.z.toFixed(2)}`;
        const excludeKey = excludeObjects.map(obj => obj.userData?.id || 'unknown').join(',');
        return `${posKey}:${excludeKey}`;
    }
    
    clearSnapCache() {
        this.snapCache.clear();
    }
    
    // Visual Feedback API
    showSnapPreview(snapTarget) {
        this.clearSnapPreview();
        
        if (!snapTarget || !this.config.global.visualFeedback) return;
        
        const visual = snapTarget.visual;
        let preview = null;
        
        switch (snapTarget.type) {
            case 'grid':
                preview = this.createGridSnapPreview(snapTarget, visual);
                break;
            case 'corner':
                preview = this.createCornerSnapPreview(snapTarget, visual);
                break;
            case 'edge':
                preview = this.createEdgeSnapPreview(snapTarget, visual);
                break;
            case 'face':
                preview = this.createFaceSnapPreview(snapTarget, visual);
                break;
            case 'center':
                preview = this.createCenterSnapPreview(snapTarget, visual);
                break;
        }
        
        if (preview) {
            this.snapPreview = preview;
            this.scene.add(preview);
        }
    }
    
    clearSnapPreview() {
        if (this.snapPreview) {
            this.scene.remove(this.snapPreview);
            if (this.snapPreview.geometry) this.snapPreview.geometry.dispose();
            if (this.snapPreview.material) this.snapPreview.material.dispose();
            this.snapPreview = null;
        }
    }
    
    // Preview Creation Methods
    createCornerSnapPreview(snapTarget, visual) {
        const geometry = new THREE.SphereGeometry(visual.size, 8, 8);
        const material = this.materialManager ? 
            this.materialManager.getMaterial('mesh_basic', {
                color: visual.color,
                transparent: true,
                opacity: 0.8,
                depthTest: false
            }, 'ui', 'snap') :
            new THREE.MeshBasicMaterial({
                color: visual.color,
                transparent: true,
                opacity: 0.8,
                depthTest: false
            });
        
        const preview = new THREE.Mesh(geometry, material);
        preview.position.copy(snapTarget.position);
        preview.renderOrder = 1000;
        return preview;
    }
    
    createEdgeSnapPreview(snapTarget, visual) {
        const points = [snapTarget.data.edgeStart, snapTarget.data.edgeEnd];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = this.materialManager ? 
            this.materialManager.getMaterial('line_basic', {
                color: visual.color,
                linewidth: visual.thickness,
                depthTest: false
            }, 'ui', 'snap') :
            new THREE.LineBasicMaterial({
                color: visual.color,
                linewidth: visual.thickness,
                depthTest: false
            });
        
        const preview = new THREE.Line(geometry, material);
        preview.renderOrder = 1000;
        return preview;
    }
    
    createFaceSnapPreview(snapTarget, visual) {
        const object = snapTarget.data.object;
        const faceGeometry = this.createFaceGeometry(object);
        const material = this.materialManager ? 
            this.materialManager.getMaterial('mesh_basic', {
                color: visual.color,
                transparent: true,
                opacity: visual.opacity,
                side: THREE.DoubleSide,
                depthTest: false
            }, 'ui', 'snap') :
            new THREE.MeshBasicMaterial({
                color: visual.color,
                transparent: true,
                opacity: visual.opacity,
                side: THREE.DoubleSide,
                depthTest: false
            });
        
        const preview = new THREE.Mesh(faceGeometry, material);
        preview.position.copy(object.position);
        preview.rotation.copy(object.rotation);
        preview.scale.copy(object.scale);
        
        // Offset slightly along normal
        const offset = snapTarget.data.worldNormal.clone().multiplyScalar(0.01);
        preview.position.add(offset);
        preview.renderOrder = 1000;
        return preview;
    }
    
    createCenterSnapPreview(snapTarget, visual) {
        const geometry = new THREE.RingGeometry(visual.size * 0.7, visual.size, 16);
        const material = this.materialManager ? 
            this.materialManager.getMaterial('mesh_basic', {
                color: visual.color,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                depthTest: false
            }, 'ui', 'snap') :
            new THREE.MeshBasicMaterial({
                color: visual.color,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                depthTest: false
            });
        
        const preview = new THREE.Mesh(geometry, material);
        preview.position.copy(snapTarget.position);
        preview.lookAt(this.camera.position);
        preview.renderOrder = 1000;
        return preview;
    }
    
    createGridSnapPreview(snapTarget, visual) {
        const geometry = new THREE.BoxGeometry(visual.size, visual.size, visual.size);
        const material = this.materialManager ? 
            this.materialManager.getMaterial('mesh_basic', {
                color: visual.color,
                transparent: true,
                opacity: 0.6,
                depthTest: false
            }, 'ui', 'snap') :
            new THREE.MeshBasicMaterial({
                color: visual.color,
                transparent: true,
                opacity: 0.6,
                depthTest: false
            });
        
        const preview = new THREE.Mesh(geometry, material);
        preview.position.copy(snapTarget.position);
        preview.renderOrder = 1000;
        return preview;
    }
    
    createFaceGeometry(object) {
        if (object.geometry instanceof THREE.BoxGeometry) {
            const width = object.userData.width || 2;
            const height = object.userData.height || 1;
            const depth = object.userData.depth || 3;
            return new THREE.BoxGeometry(width, height, depth);
        } else if (object.geometry instanceof THREE.PlaneGeometry) {
            const width = object.userData.width || 2;
            const height = object.userData.height || 2;
            return new THREE.PlaneGeometry(width, height);
        }
        
        return new THREE.BoxGeometry(1, 1, 1);
    }
    
    // Tool Integration Methods
    onToolActivated(toolName) {
        this.setContext({ activeTool: toolName });
        console.log(`SNAP: Tool activated: ${toolName}`);
    }
    
    onFaceConstrainedStart(axis) {
        this.setContext({
            isFaceConstrained: true,
            constrainedAxis: axis
        });
    }
    
    onFaceConstrainedEnd() {
        this.setContext({
            isFaceConstrained: false,
            constrainedAxis: null
        });
    }
    
    onSelectionChanged(selectedObjects) {
        this.setContext({ isMultiSelect: selectedObjects.length > 1 });
    }
    
    // Cleanup
    dispose() {
        this.clearSnapPreview();
        this.clearSnapCache();
    }
}

// Export for module use
window.SnapManager = SnapManager;