/**
 * ConfigurationManager - Unified configuration management with validation and persistence
 * 
 * This manager provides schema-based configuration management for all application
 * settings with validation, type checking, and unified persistence.
 */
class ConfigurationManager {
    constructor(stateManager, materialManager) {
        this.stateManager = stateManager;
        this.materialManager = materialManager;
        
        // Configuration schema definitions
        this.schemas = {
            ui: {
                background: {
                    color: { type: 'color', default: '#1a1a1a', description: 'Background color' }
                },
                grid: {
                    size: { type: 'number', default: 50, min: 10, max: 200, step: 5, description: 'Grid size' },
                    divisions: { type: 'number', default: 50, min: 5, max: 100, step: 1, description: 'Grid divisions' },
                    subDivisions: { type: 'number', default: 10, min: 1, max: 20, step: 1, description: 'Grid subdivisions' },
                    mainColor: { type: 'color', default: '#666666', description: 'Main grid color' },
                    subColor: { type: 'color', default: '#333333', description: 'Sub grid color' }
                },
                selection: {
                    edgeColor: { type: 'color', default: '#0078d4', description: 'Selection edge color' },
                    thickness: { type: 'number', default: 2, min: 1, max: 10, step: 1, description: 'Edge thickness' },
                    cornerSize: { type: 'number', default: 0.05, min: 0.02, max: 0.3, step: 0.01, description: 'Corner size' },
                    hitAreaSize: { type: 'number', default: 24, min: 10, max: 50, step: 2, description: 'Hit area size' }
                },
                highlights: {
                    hoverColor: { type: 'color', default: '#ff6600', description: 'Hover highlight color' },
                    snapColor: { type: 'color', default: '#00ff00', description: 'Snap highlight color' },
                    thickness: { type: 'number', default: 1, min: 1, max: 5, step: 1, description: 'Highlight thickness' }
                },
                rendering: {
                    shadowsEnabled: { type: 'boolean', default: true, description: 'Enable shadows' },
                    wireframeMode: { type: 'boolean', default: false, description: 'Wireframe mode' },
                    antialias: { type: 'boolean', default: true, description: 'Enable antialiasing' }
                }
            },
            
            tools: {
                move: {
                    snapDistance: { type: 'number', default: 0.5, min: 0.1, max: 2.0, step: 0.1, description: 'Snap distance for move tool' },
                    constrainToAxis: { type: 'boolean', default: true, description: 'Constrain movement to clicked axis' }
                },
                pushpull: {
                    snapDistance: { type: 'number', default: 0.3, min: 0.1, max: 1.0, step: 0.1, description: 'Snap distance for push/pull' },
                    preserveAspectRatio: { type: 'boolean', default: false, description: 'Preserve aspect ratio during push/pull' }
                },
                select: {
                    multiSelectMode: { type: 'boolean', default: false, description: 'Enable multi-select by default' },
                    hoverFeedback: { type: 'boolean', default: true, description: 'Show hover feedback' }
                }
            },
            
            scene: {
                camera: {
                    fov: { type: 'number', default: 75, min: 10, max: 150, step: 5, description: 'Field of view' },
                    near: { type: 'number', default: 0.1, min: 0.01, max: 10, step: 0.01, description: 'Near clipping plane' },
                    far: { type: 'number', default: 1000, min: 100, max: 10000, step: 100, description: 'Far clipping plane' },
                    animationSpeed: { type: 'number', default: 1000, min: 200, max: 3000, step: 100, description: 'Animation duration (ms)' }
                },
                lighting: {
                    ambientIntensity: { type: 'number', default: 0.4, min: 0, max: 1, step: 0.1, description: 'Ambient light intensity' },
                    directionalIntensity: { type: 'number', default: 1.0, min: 0, max: 2, step: 0.1, description: 'Directional light intensity' },
                    shadowMapSize: { type: 'number', default: 2048, min: 512, max: 4096, step: 512, description: 'Shadow map resolution' }
                }
            },
            
            performance: {
                autoCleanup: { type: 'boolean', default: true, description: 'Automatic memory cleanup' },
                cleanupInterval: { type: 'number', default: 30000, min: 10000, max: 120000, step: 5000, description: 'Cleanup interval (ms)' },
                maxCachedMaterials: { type: 'number', default: 100, min: 50, max: 500, step: 25, description: 'Maximum cached materials' }
            }
        };
        
        // Current configuration values
        this.config = {};
        
        // Configuration change listeners
        this.listeners = new Map();
        
        // Validation errors
        this.validationErrors = new Map();
        
        // Initialize with defaults
        this.initializeDefaults();
        
        console.log('CONFIG: ConfigurationManager initialized with', this.getTotalSettingCount(), 'settings');
    }
    
    /**
     * Get configuration value with path
     * @param {string} path - Configuration path (e.g., 'ui.grid.size')
     * @returns {any} Configuration value
     */
    get(path) {
        return this.getNestedValue(this.config, path);
    }
    
    /**
     * Set configuration value with validation
     * @param {string} path - Configuration path
     * @param {any} value - New value
     * @param {boolean} skipValidation - Skip validation (use carefully)
     * @returns {boolean} Success
     */
    set(path, value, skipValidation = false) {
        // Validate if not skipped
        if (!skipValidation) {
            const validation = this.validate(path, value);
            if (!validation.valid) {
                console.error('CONFIG: Validation failed for', path, ':', validation.errors);
                this.validationErrors.set(path, validation.errors);
                return false;
            }
        }
        
        // Get old value
        const oldValue = this.get(path);
        
        // Set new value
        this.setNestedValue(this.config, path, value);
        
        // Clear any previous validation errors
        this.validationErrors.delete(path);
        
        // Notify listeners
        this.notifyListeners(path, value, oldValue);
        
        // Apply configuration changes to relevant systems
        this.applyConfigChange(path, value, oldValue);
        
        console.log('CONFIG: Set', path, 'to', value);
        return true;
    }
    
    /**
     * Validate configuration value against schema
     * @param {string} path - Configuration path
     * @param {any} value - Value to validate
     * @returns {object} Validation result
     */
    validate(path, value) {
        const schema = this.getSchemaForPath(path);
        if (!schema) {
            return { valid: false, errors: [`No schema found for path: ${path}`] };
        }
        
        const errors = [];
        
        // Type validation
        switch (schema.type) {
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    errors.push('Must be a valid number');
                } else {
                    if (schema.min !== undefined && value < schema.min) {
                        errors.push(`Must be >= ${schema.min}`);
                    }
                    if (schema.max !== undefined && value > schema.max) {
                        errors.push(`Must be <= ${schema.max}`);
                    }
                }
                break;
                
            case 'boolean':
                if (typeof value !== 'boolean') {
                    errors.push('Must be true or false');
                }
                break;
                
            case 'color':
                if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
                    errors.push('Must be a valid hex color (e.g., #ff0000)');
                }
                break;
                
            case 'string':
                if (typeof value !== 'string') {
                    errors.push('Must be a string');
                }
                break;
        }
        
        return { valid: errors.length === 0, errors };
    }
    
    /**
     * Get all configuration with validation status
     * @returns {object} Complete configuration with validation info
     */
    getAll() {
        return {
            config: this.deepClone(this.config),
            errors: Object.fromEntries(this.validationErrors),
            schema: this.schemas
        };
    }
    
    /**
     * Reset configuration section to defaults
     * @param {string} section - Configuration section ('ui', 'tools', etc.)
     */
    reset(section) {
        const sectionSchema = this.schemas[section];
        if (!sectionSchema) {
            console.error('CONFIG: Unknown section:', section);
            return false;
        }
        
        const defaults = this.extractDefaults(sectionSchema);
        this.config[section] = defaults;
        
        // Notify all listeners for this section
        this.notifySection(section);
        
        console.log('CONFIG: Reset section:', section);
        return true;
    }
    
    /**
     * Import configuration from object
     * @param {object} importConfig - Configuration to import
     * @param {boolean} merge - Whether to merge or replace
     */
    import(importConfig, merge = true) {
        const imported = {};
        const errors = [];
        
        // Validate all imported values
        this.flattenObject(importConfig).forEach(({ path, value }) => {
            const validation = this.validate(path, value);
            if (validation.valid) {
                imported[path] = value;
            } else {
                errors.push({ path, errors: validation.errors });
            }
        });
        
        if (errors.length > 0) {
            console.warn('CONFIG: Import validation errors:', errors);
        }
        
        // Apply valid configurations
        if (merge) {
            Object.entries(imported).forEach(([path, value]) => {
                this.set(path, value, true); // Skip re-validation
            });
        } else {
            this.config = this.unflattenObject(imported);
        }
        
        console.log('CONFIG: Imported', Object.keys(imported).length, 'settings with', errors.length, 'errors');
        return { imported: Object.keys(imported).length, errors };
    }
    
    /**
     * Export configuration
     * @param {Array<string>} sections - Sections to export (all if not specified)
     * @returns {object} Exported configuration
     */
    export(sections = null) {
        if (!sections) {
            return this.deepClone(this.config);
        }
        
        const exported = {};
        sections.forEach(section => {
            if (this.config[section]) {
                exported[section] = this.deepClone(this.config[section]);
            }
        });
        
        return exported;
    }
    
    /**
     * Subscribe to configuration changes
     * @param {string} path - Configuration path to watch
     * @param {function} callback - Change callback
     * @returns {function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        
        this.listeners.get(path).add(callback);
        
        return () => {
            const pathListeners = this.listeners.get(path);
            if (pathListeners) {
                pathListeners.delete(callback);
                if (pathListeners.size === 0) {
                    this.listeners.delete(path);
                }
            }
        };
    }
    
    // Private methods
    
    initializeDefaults() {
        Object.keys(this.schemas).forEach(section => {
            this.config[section] = this.extractDefaults(this.schemas[section]);
        });
    }
    
    extractDefaults(schema) {
        const defaults = {};
        
        Object.keys(schema).forEach(key => {
            if (schema[key].default !== undefined) {
                defaults[key] = schema[key].default;
            } else if (typeof schema[key] === 'object' && !schema[key].type) {
                // Nested object
                defaults[key] = this.extractDefaults(schema[key]);
            }
        });
        
        return defaults;
    }
    
    getSchemaForPath(path) {
        const parts = path.split('.');
        let current = this.schemas;
        
        for (const part of parts) {
            current = current[part];
            if (!current) return null;
        }
        
        return current;
    }
    
    applyConfigChange(path, value, oldValue) {
        // Route configuration changes to appropriate managers
        const section = path.split('.')[0];
        
        switch (section) {
            case 'ui':
                this.applyUIChange(path, value);
                break;
            case 'tools':
                this.applyToolChange(path, value);
                break;
            case 'scene':
                this.applySceneChange(path, value);
                break;
            case 'performance':
                this.applyPerformanceChange(path, value);
                break;
        }
    }
    
    applyUIChange(path, value) {
        // Apply UI configuration changes to relevant systems
        const app = window.modlerApp;
        if (!app) return;
        
        // Update material theme if colors changed
        if (path.includes('Color')) {
            this.updateMaterialTheme();
        }
        
        // Update HighlightManager if highlight settings changed
        if (path.includes('selection') || path.includes('highlights')) {
            if (app.highlightManager) {
                app.settingsManager?.updateHighlightManagerConfig(app.highlightManager);
            }
        }
        
        // Update scene if grid settings changed
        if (path.includes('grid')) {
            if (app.sceneManager) {
                app.sceneManager.updateGridWithSettings(this.get('ui.grid'));
            }
        }
        
        // Update background if changed
        if (path === 'ui.background.color') {
            if (app.sceneManager?.scene) {
                app.sceneManager.scene.background = new THREE.Color(value);
            }
        }
    }
    
    applyToolChange(path, value) {
        // Apply tool configuration changes
        const app = window.modlerApp;
        if (!app) return;
        
        // Update SnapManager configuration
        if (path.includes('snapDistance') && app.snapManager) {
            const toolName = path.split('.')[1];
            app.snapManager.updateToolConfig(toolName, { snapDistance: value });
        }
    }
    
    applySceneChange(path, value) {
        // Apply scene configuration changes
        const app = window.modlerApp;
        if (!app) return;
        
        // Update camera settings
        if (path.includes('camera')) {
            this.applyCameraConfig();
        }
        
        // Update lighting settings
        if (path.includes('lighting')) {
            this.applyLightingConfig();
        }
    }
    
    applyPerformanceChange(path, value) {
        // Apply performance configuration changes
        if (path === 'performance.maxCachedMaterials') {
            // Trigger material cleanup if over limit
            const stats = this.materialManager.getUsageStats();
            if (stats.cachedMaterials > value) {
                this.materialManager.disposeUnusedMaterials();
            }
        }
    }
    
    updateMaterialTheme() {
        console.log('CONFIG: updateMaterialTheme called');
        
        // Update material theme based on current UI colors
        // IMPORTANT: Only update specific theme sections, don't overwrite everything
        const selectionColor = this.get('ui.selection.edgeColor');
        const hoverColor = this.get('ui.highlights.hoverColor');
        const mainGridColor = this.get('ui.grid.mainColor');
        const subGridColor = this.get('ui.grid.subColor');
        
        console.log('CONFIG: Raw colors - selection:', selectionColor, 'hover:', hoverColor, 'mainGrid:', mainGridColor, 'subGrid:', subGridColor);
        
        const themeUpdates = {
            highlights: {
                selection: { color: this.hexToNumber(selectionColor) },
                hover: { color: this.hexToNumber(hoverColor) },
                face: { color: this.hexToNumber(selectionColor) }
            },
            ui: {
                grid: {
                    main: { color: this.hexToNumber(mainGridColor) },
                    sub: { color: this.hexToNumber(subGridColor) }
                }
            }
        };
        
        console.log('CONFIG: Theme updates being sent:', themeUpdates);
        
        // Use partial theme update to preserve existing object materials
        this.materialManager.updateTheme(themeUpdates);
    }
    
    applyCameraConfig() {
        const app = window.modlerApp;
        if (!app?.cameraManager) return;
        
        const fov = this.get('scene.camera.fov');
        const near = this.get('scene.camera.near');
        const far = this.get('scene.camera.far');
        
        app.cameraManager.camera.fov = fov;
        app.cameraManager.camera.near = near;
        app.cameraManager.camera.far = far;
        app.cameraManager.camera.updateProjectionMatrix();
        
        app.cameraManager.animation.duration = this.get('scene.camera.animationSpeed');
    }
    
    applyLightingConfig() {
        const app = window.modlerApp;
        if (!app?.sceneManager) return;
        
        const ambientIntensity = this.get('scene.lighting.ambientIntensity');
        const directionalIntensity = this.get('scene.lighting.directionalIntensity');
        
        // Update lights in scene
        app.sceneManager.scene.traverse(child => {
            if (child.isAmbientLight) {
                child.intensity = ambientIntensity;
            } else if (child.isDirectionalLight) {
                child.intensity = directionalIntensity;
            }
        });
    }
    
    notifyListeners(path, newValue, oldValue) {
        // Notify exact path listeners
        const pathListeners = this.listeners.get(path);
        if (pathListeners) {
            pathListeners.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('CONFIG: Listener error for', path, error);
                }
            });
        }
        
        // Notify parent path listeners
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentListeners = this.listeners.get(parentPath);
            if (parentListeners) {
                parentListeners.forEach(callback => {
                    try {
                        callback(this.get(parentPath), undefined, parentPath);
                    } catch (error) {
                        console.error('CONFIG: Parent listener error for', parentPath, error);
                    }
                });
            }
        }
    }
    
    notifySection(section) {
        // Notify all listeners in a section (for reset operations)
        this.listeners.forEach((callbacks, path) => {
            if (path.startsWith(section + '.')) {
                const value = this.get(path);
                callbacks.forEach(callback => {
                    try {
                        callback(value, undefined, path);
                    } catch (error) {
                        console.error('CONFIG: Section notification error for', path, error);
                    }
                });
            }
        });
    }
    
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key];
        }, obj);
    }
    
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
    }
    
    /**
     * Convert hex color string to THREE.js compatible number
     * @param {string} hexColor - Hex color (e.g., '#ff0000' or '#f00')
     * @returns {number} - Color as number (e.g., 0xff0000)
     */
    hexToNumber(hexColor) {
        if (typeof hexColor !== 'string') {
            console.warn('CONFIG: hexToNumber received non-string:', hexColor, 'using default gray');
            return 0x888888; // Default gray
        }
        
        // Remove # if present
        const cleanHex = hexColor.replace('#', '');
        
        // Convert to number
        const colorNumber = parseInt(cleanHex, 16);
        
        // Validate result
        if (isNaN(colorNumber)) {
            console.warn('CONFIG: Invalid hex color:', hexColor, 'using default gray');
            return 0x888888;
        }
        
        console.log('CONFIG: Converted hex color', hexColor, 'to number', colorNumber);
        return colorNumber;
    }
    
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        
        const cloned = Array.isArray(obj) ? [] : {};
        Object.keys(obj).forEach(key => {
            cloned[key] = this.deepClone(obj[key]);
        });
        
        return cloned;
    }
    
    hexToNumber(hex) {
        return parseInt(hex.replace('#', '0x'), 16);
    }
    
    flattenObject(obj, prefix = '') {
        const flattened = [];
        
        Object.keys(obj).forEach(key => {
            const fullPath = prefix ? `${prefix}.${key}` : key;
            
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                flattened.push(...this.flattenObject(obj[key], fullPath));
            } else {
                flattened.push({ path: fullPath, value: obj[key] });
            }
        });
        
        return flattened;
    }
    
    unflattenObject(flattened) {
        const result = {};
        
        Object.entries(flattened).forEach(([path, value]) => {
            this.setNestedValue(result, path, value);
        });
        
        return result;
    }
    
    getTotalSettingCount() {
        return this.flattenObject(this.schemas).length;
    }
    
    /**
     * Get configuration summary for debugging
     */
    getSummary() {
        return {
            totalSettings: this.getTotalSettingCount(),
            sections: Object.keys(this.schemas),
            validationErrors: this.validationErrors.size,
            listeners: this.listeners.size
        };
    }
    
    /**
     * Dispose configuration manager
     */
    dispose() {
        console.log('CONFIG: Disposing ConfigurationManager');
        this.listeners.clear();
        this.validationErrors.clear();
    }
}

// Export for module use
window.ConfigurationManager = ConfigurationManager;