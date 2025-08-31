/**
 * StateManager - Unified application state management with pub-sub pattern
 * 
 * This manager provides centralized state management for the entire application
 * with automatic persistence, change notifications, and hierarchical state organization.
 */
class StateManager {
    constructor() {
        // Application state structure
        this.state = {
            // Application-level state
            app: {
                initialized: false,
                activePanel: null, // 'scene-settings', 'ui-settings', 'hierarchy', etc.
                isFullscreen: false,
                lastSaveTime: null
            },
            
            // Current tool and operation state
            tools: {
                activeTool: 'select',
                isOperating: false,
                operationType: null, // 'move', 'pushpull', 'create', etc.
                toolContext: {}
            },
            
            // Scene and viewport state
            scene: {
                objectCount: 0,
                selectedCount: 0,
                cameraPosition: { x: 10, y: 10, z: 10 },
                cameraTarget: { x: 0, y: 0, z: 0 },
                viewportSize: { width: 800, height: 600 },
                gridVisible: true,
                axesVisible: true
            },
            
            // UI state
            ui: {
                panels: {
                    hierarchy: { visible: true, expanded: new Set() },
                    properties: { visible: true, currentObject: null },
                    settings: { visible: false, activeTab: 'ui' }
                },
                theme: {
                    darkMode: true,
                    accentColor: '#0078d4',
                    fontSize: 'medium'
                }
            },
            
            // Layer and hierarchy state
            hierarchy: {
                rootObjects: new Set(),
                containers: new Map(), // containerId -> { children: Set(), expanded: boolean }
                layerOrder: [], // Array of object IDs in z-order
                visibility: new Map() // objectId -> boolean
            },
            
            // Selection state
            selection: {
                objects: new Set(),
                lastSelected: null,
                multiSelectMode: false,
                selectedFace: null,
                selectionBox: null
            },
            
            // Performance and debug state
            debug: {
                showFPS: false,
                showStats: false,
                logLevel: 'info', // 'debug', 'info', 'warn', 'error'
                wireframeMode: false
            }
        };
        
        // Event subscribers for state changes
        this.subscribers = new Map();
        
        // State change history for undo/redo (limited to 50 entries)
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Persistence configuration
        this.persistence = {
            autoSave: true,
            saveInterval: 30000, // 30 seconds
            storagePrefix: 'modler-state-',
            excludeFromSave: new Set(['debug.logLevel', 'app.lastSaveTime', 'tools.isOperating'])
        };
        
        // Initialize persistence
        this.initializePersistence();
        
        console.log('STATE: StateManager initialized with unified state structure');
    }
    
    /**
     * Subscribe to state changes
     * @param {string} path - State path (e.g., 'tools.activeTool', 'selection.objects')
     * @param {function} callback - Callback function (newValue, oldValue, path)
     * @returns {function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }
        
        this.subscribers.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const pathSubscribers = this.subscribers.get(path);
            if (pathSubscribers) {
                pathSubscribers.delete(callback);
                if (pathSubscribers.size === 0) {
                    this.subscribers.delete(path);
                }
            }
        };
    }
    
    /**
     * Get state value by path
     * @param {string} path - Dot-separated path (e.g., 'tools.activeTool')
     * @returns {any} State value
     */
    get(path) {
        return this.getNestedValue(this.state, path);
    }
    
    /**
     * Set state value by path with change notification
     * @param {string} path - Dot-separated path
     * @param {any} value - New value
     * @param {boolean} saveToHistory - Whether to save to undo history
     */
    set(path, value, saveToHistory = false) {
        const oldValue = this.get(path);
        
        // Don't update if value hasn't changed
        if (this.deepEqual(oldValue, value)) {
            return;
        }
        
        // Save to history if requested
        if (saveToHistory) {
            this.saveToHistory();
        }
        
        // Update state
        this.setNestedValue(this.state, path, value);
        
        // Notify subscribers
        this.notifySubscribers(path, value, oldValue);
        
        // Auto-save if enabled
        if (this.persistence.autoSave && !this.isExcludedFromSave(path)) {
            this.scheduleAutoSave();
        }
    }
    
    /**
     * Update multiple state values atomically
     * @param {object} updates - Object with path-value pairs
     * @param {boolean} saveToHistory - Whether to save to undo history
     */
    update(updates, saveToHistory = false) {
        if (saveToHistory) {
            this.saveToHistory();
        }
        
        const changes = [];
        
        // Apply all updates
        Object.entries(updates).forEach(([path, value]) => {
            const oldValue = this.get(path);
            if (!this.deepEqual(oldValue, value)) {
                this.setNestedValue(this.state, path, value);
                changes.push({ path, value, oldValue });
            }
        });
        
        // Notify all subscribers
        changes.forEach(({ path, value, oldValue }) => {
            this.notifySubscribers(path, value, oldValue);
        });
        
        // Auto-save if any non-excluded changes
        if (this.persistence.autoSave && changes.some(c => !this.isExcludedFromSave(c.path))) {
            this.scheduleAutoSave();
        }
    }
    
    /**
     * Reset state section to defaults
     * @param {string} section - State section to reset ('ui', 'tools', etc.)
     */
    reset(section) {
        const defaultState = this.getDefaultState();
        if (defaultState[section]) {
            this.set(section, defaultState[section], true);
            console.log('STATE: Reset section:', section);
        }
    }
    
    /**
     * Save current state to history for undo/redo
     */
    saveToHistory() {
        // Remove any history after current index (for redo scenarios)
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add current state to history
        this.history.push(this.deepClone(this.state));
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    /**
     * Undo last state change
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.state = this.deepClone(this.history[this.historyIndex]);
            this.notifyAllSubscribers();
            console.log('STATE: Undo applied');
            return true;
        }
        return false;
    }
    
    /**
     * Redo last undone state change
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.state = this.deepClone(this.history[this.historyIndex]);
            this.notifyAllSubscribers();
            console.log('STATE: Redo applied');
            return true;
        }
        return false;
    }
    
    /**
     * Save state to localStorage
     */
    saveToStorage() {
        try {
            const savedState = this.createSaveableState();
            const stateJson = JSON.stringify(savedState);
            localStorage.setItem(this.persistence.storagePrefix + 'main', stateJson);
            
            this.set('app.lastSaveTime', Date.now());
            console.log('STATE: Saved to localStorage');
            return true;
        } catch (error) {
            console.error('STATE: Save failed:', error);
            return false;
        }
    }
    
    /**
     * Load state from localStorage
     */
    loadFromStorage() {
        try {
            const stateJson = localStorage.getItem(this.persistence.storagePrefix + 'main');
            if (stateJson) {
                const savedState = JSON.parse(stateJson);
                this.mergeLoadedState(savedState);
                console.log('STATE: Loaded from localStorage');
                return true;
            }
        } catch (error) {
            console.error('STATE: Load failed:', error);
        }
        return false;
    }
    
    // Private helper methods
    
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
    
    notifySubscribers(path, newValue, oldValue) {
        // Notify exact path subscribers
        const pathSubscribers = this.subscribers.get(path);
        if (pathSubscribers) {
            pathSubscribers.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('STATE: Subscriber error for path', path, error);
                }
            });
        }
        
        // Notify parent path subscribers (e.g., 'tools' for 'tools.activeTool')
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentSubscribers = this.subscribers.get(parentPath);
            if (parentSubscribers) {
                parentSubscribers.forEach(callback => {
                    try {
                        callback(this.get(parentPath), undefined, parentPath);
                    } catch (error) {
                        console.error('STATE: Parent subscriber error for path', parentPath, error);
                    }
                });
            }
        }
    }
    
    notifyAllSubscribers() {
        // Notify all subscribers (used for undo/redo)
        this.subscribers.forEach((callbacks, path) => {
            const currentValue = this.get(path);
            callbacks.forEach(callback => {
                try {
                    callback(currentValue, undefined, path);
                } catch (error) {
                    console.error('STATE: Global notification error for path', path, error);
                }
            });
        });
    }
    
    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.saveToStorage();
        }, 1000); // Debounce saves to 1 second
    }
    
    initializePersistence() {
        // Load saved state on startup
        this.loadFromStorage();
        
        // Set up periodic saves if auto-save enabled
        if (this.persistence.autoSave && this.persistence.saveInterval > 0) {
            setInterval(() => {
                this.saveToStorage();
            }, this.persistence.saveInterval);
        }
    }
    
    createSaveableState() {
        // Create state object excluding non-persistent data
        const saveableState = this.deepClone(this.state);
        
        // Remove excluded paths
        this.persistence.excludeFromSave.forEach(path => {
            this.deleteNestedValue(saveableState, path);
        });
        
        // Convert Sets to Arrays for JSON serialization
        this.convertSetsToArrays(saveableState);
        
        return saveableState;
    }
    
    mergeLoadedState(loadedState) {
        // Convert Arrays back to Sets
        this.convertArraysToSets(loadedState);
        
        // Merge loaded state with current state (preserving structure)
        this.state = this.deepMerge(this.state, loadedState);
        
        // Notify all subscribers of loaded state
        this.notifyAllSubscribers();
    }
    
    convertSetsToArrays(obj) {
        Object.keys(obj).forEach(key => {
            if (obj[key] instanceof Set) {
                obj[key] = Array.from(obj[key]);
            } else if (obj[key] && typeof obj[key] === 'object') {
                this.convertSetsToArrays(obj[key]);
            }
        });
    }
    
    convertArraysToSets(obj) {
        Object.keys(obj).forEach(key => {
            if (Array.isArray(obj[key]) && key.includes('Set')) {
                obj[key] = new Set(obj[key]);
            } else if (obj[key] && typeof obj[key] === 'object') {
                this.convertArraysToSets(obj[key]);
            }
        });
    }
    
    deleteNestedValue(obj, path) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => current && current[key], obj);
        
        if (target && lastKey in target) {
            delete target[lastKey];
        }
    }
    
    isExcludedFromSave(path) {
        return this.persistence.excludeFromSave.has(path);
    }
    
    getDefaultState() {
        // Return fresh default state structure
        return {
            app: {
                initialized: false,
                activePanel: null,
                isFullscreen: false,
                lastSaveTime: null
            },
            tools: {
                activeTool: 'select',
                isOperating: false,
                operationType: null,
                toolContext: {}
            },
            scene: {
                objectCount: 0,
                selectedCount: 0,
                cameraPosition: { x: 10, y: 10, z: 10 },
                cameraTarget: { x: 0, y: 0, z: 0 },
                viewportSize: { width: 800, height: 600 },
                gridVisible: true,
                axesVisible: true
            },
            ui: {
                panels: {
                    hierarchy: { visible: true, expanded: new Set() },
                    properties: { visible: true, currentObject: null },
                    settings: { visible: false, activeTab: 'ui' }
                },
                theme: {
                    darkMode: true,
                    accentColor: '#0078d4',
                    fontSize: 'medium'
                }
            },
            hierarchy: {
                rootObjects: new Set(),
                containers: new Map(),
                layerOrder: [],
                visibility: new Map()
            },
            selection: {
                objects: new Set(),
                lastSelected: null,
                multiSelectMode: false,
                selectedFace: null,
                selectionBox: null
            },
            debug: {
                showFPS: false,
                showStats: false,
                logLevel: 'info',
                wireframeMode: false
            }
        };
    }
    
    deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) return false;
        
        if (a instanceof Set && b instanceof Set) {
            return a.size === b.size && [...a].every(x => b.has(x));
        }
        
        if (a instanceof Map && b instanceof Map) {
            return a.size === b.size && [...a].every(([k, v]) => b.has(k) && this.deepEqual(v, b.get(k)));
        }
        
        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            return keysA.length === keysB.length && 
                   keysA.every(key => this.deepEqual(a[key], b[key]));
        }
        
        return false;
    }
    
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Set) return new Set([...obj]);
        if (obj instanceof Map) return new Map([...obj]);
        if (obj instanceof Date) return new Date(obj);
        
        const cloned = Array.isArray(obj) ? [] : {};
        Object.keys(obj).forEach(key => {
            cloned[key] = this.deepClone(obj[key]);
        });
        
        return cloned;
    }
    
    deepMerge(target, source) {
        if (source === null || typeof source !== 'object') return source;
        if (target === null || typeof target !== 'object') return this.deepClone(source);
        
        // Handle Sets
        if (source instanceof Set) {
            return new Set([...source]);
        }
        if (target instanceof Set && source instanceof Set) {
            return new Set([...target, ...source]);
        }
        
        // Handle Maps  
        if (source instanceof Map) {
            return new Map([...source]);
        }
        if (target instanceof Map && source instanceof Map) {
            return new Map([...target, ...source]);
        }
        
        // Handle Arrays - replace entirely
        if (Array.isArray(source)) return this.deepClone(source);
        
        // Handle Objects - merge recursively
        const result = this.deepClone(target);
        Object.keys(source).forEach(key => {
            if (typeof source[key] === 'object' && source[key] !== null && 
                typeof result[key] === 'object' && result[key] !== null &&
                !Array.isArray(source[key]) && 
                !(source[key] instanceof Set) && 
                !(source[key] instanceof Map)) {
                result[key] = this.deepMerge(result[key], source[key]);
            } else {
                result[key] = this.deepClone(source[key]);
            }
        });
        
        return result;
    }
    
    /**
     * Get state summary for debugging
     */
    getStateSummary() {
        return {
            objectCount: this.get('scene.objectCount'),
            selectedCount: this.get('selection.objects').size,
            activeTool: this.get('tools.activeTool'),
            isOperating: this.get('tools.isOperating'),
            activePanel: this.get('app.activePanel'),
            historySize: this.history.length,
            subscriberCount: this.subscribers.size
        };
    }
    
    /**
     * Clean up and dispose
     */
    dispose() {
        console.log('STATE: Disposing StateManager with', this.subscribers.size, 'subscribers');
        
        // Clear auto-save timer
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        // Final save
        if (this.persistence.autoSave) {
            this.saveToStorage();
        }
        
        // Clear subscribers
        this.subscribers.clear();
        
        // Clear history
        this.history = [];
        this.historyIndex = -1;
    }
}

// Export for module use
window.StateManager = StateManager;