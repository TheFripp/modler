/**
 * MaterialManager - Centralized material creation, caching, and theme management
 * 
 * This manager provides a unified API for all material needs with caching,
 * theme support, and automatic disposal tracking.
 */
class MaterialManager {
    constructor() {
        // Material cache for reuse
        this.materialCache = new Map();
        this.disposalQueue = new Set();
        
        // Theme configuration
        this.theme = {
            // Default object materials
            objects: {
                default: { 
                    color: 0x888888, 
                    opacity: 1.0, 
                    transparent: false,
                    roughness: 0.7,
                    metalness: 0.1
                },
                selected: { 
                    color: 0x0078d4, 
                    opacity: 1.0, 
                    transparent: false,
                    roughness: 0.7,
                    metalness: 0.1
                },
                wireframe: { color: 0x666666, wireframe: true, transparent: true, opacity: 0.3 }
            },
            
            // Highlight materials
            highlights: {
                selection: { color: 0x0078d4, opacity: 1.0, transparent: false },
                hover: { color: 0xff6600, opacity: 0.5, transparent: true },
                face: { color: 0x0078d4, opacity: 0.1, transparent: true },
                temporary: { color: 0x00ff00, opacity: 0.8, transparent: true }
            },
            
            // UI materials
            ui: {
                grid: { 
                    main: { color: 0x666666, opacity: 1.0, transparent: false },
                    sub: { color: 0x333333, opacity: 1.0, transparent: false }
                },
                container: { color: 0x444444, wireframe: true, transparent: true, opacity: 0.6 },
                proxy: { transparent: true, opacity: 0.0, depthTest: false, depthWrite: false },
                snap: { color: 0x00ff00, transparent: true, opacity: 0.8, depthTest: false }
            }
        };
        
        // Material type registry
        this.materialTypes = {
            'mesh_basic': THREE.MeshBasicMaterial,
            'mesh_standard': THREE.MeshStandardMaterial,
            'mesh_lambert': THREE.MeshLambertMaterial,
            'line_basic': THREE.LineBasicMaterial,
            'line_dashed': THREE.LineDashedMaterial
        };
        
        // Active materials tracking for disposal
        this.activeMaterials = new Set();
        
        console.log('MATERIALS: MaterialManager initialized with theme support');
    }
    
    /**
     * Get or create a material with caching
     * @param {string} type - Material type (mesh_basic, mesh_standard, etc.)
     * @param {object} properties - Material properties
     * @param {string} category - Theme category (objects, highlights, ui)
     * @param {string} variant - Theme variant (default, selected, etc.)
     * @returns {THREE.Material}
     */
    getMaterial(type = 'mesh_standard', properties = {}, category = 'objects', variant = 'default') {
        // Apply theme defaults
        const themeProps = this.getThemeProperties(category, variant);
        const finalProps = { ...themeProps, ...properties };
        
        // Create cache key
        const cacheKey = this.createCacheKey(type, finalProps);
        
        // Return cached material if available
        if (this.materialCache.has(cacheKey)) {
            const material = this.materialCache.get(cacheKey);
            material.userData.refCount = (material.userData.refCount || 0) + 1;
            return material;
        }
        
        // Create new material
        const MaterialClass = this.materialTypes[type] || THREE.MeshStandardMaterial;
        
        // Log material creation with color info
        if (finalProps.color !== undefined) {
            console.log(`MATERIALS: Creating ${type} material for ${category}.${variant} with color:`, finalProps.color, 'type:', typeof finalProps.color);
        }
        
        const material = new MaterialClass(finalProps);
        
        // Check if THREE.js converted the color to an object
        if (material.color !== undefined) {
            console.log(`MATERIALS: After creation, material.color is:`, material.color, 'type:', typeof material.color);
        }
        
        // Add metadata for tracking
        material.userData = {
            type: type,
            category: category,
            variant: variant,
            refCount: 1,
            cacheKey: cacheKey,
            createdAt: Date.now()
        };
        
        // Cache and track
        this.materialCache.set(cacheKey, material);
        this.activeMaterials.add(material);
        
        return material;
    }
    
    /**
     * Get common object material
     */
    getObjectMaterial(color = null, properties = {}) {
        const finalProps = color ? { color, ...properties } : properties;
        return this.getMaterial('mesh_standard', finalProps, 'objects', 'default');
    }
    
    /**
     * Get wireframe material for objects
     */
    getWireframeMaterial(color = null, properties = {}) {
        const finalProps = { 
            wireframe: true, 
            transparent: true, 
            opacity: 0.3,
            ...(color ? { color } : {}),
            ...properties 
        };
        return this.getMaterial('mesh_basic', finalProps, 'objects', 'wireframe');
    }
    
    /**
     * Get highlight material for edges and selections
     */
    getHighlightMaterial(variant = 'selection', properties = {}) {
        return this.getMaterial('mesh_basic', properties, 'highlights', variant);
    }
    
    /**
     * Get line material for edges and guides
     */
    getLineMaterial(color = 0x666666, properties = {}) {
        const finalProps = { color, ...properties };
        return this.getMaterial('line_basic', finalProps, 'ui', 'grid');
    }
    
    /**
     * Get invisible material for container proxies
     */
    getInvisibleMaterial() {
        return this.getMaterial('mesh_basic', {}, 'ui', 'proxy');
    }
    
    /**
     * Update theme colors and refresh all cached materials
     */
    updateTheme(newTheme) {
        console.log('MATERIALS: Theme update requested with:', newTheme);
        console.log('MATERIALS: Current theme before merge:', this.theme);
        
        // Check if newTheme contains objects section
        if (newTheme.objects) {
            console.log('MATERIALS: ⚠️  newTheme contains objects section:', newTheme.objects);
            if (newTheme.objects.default && newTheme.objects.default.color) {
                console.log('MATERIALS: ⚠️  objects.default.color in newTheme:', newTheme.objects.default.color, 'type:', typeof newTheme.objects.default.color);
            }
        }
        
        // Merge with existing theme
        this.theme = this.deepMerge(this.theme, newTheme);
        
        console.log('MATERIALS: Merged theme:', this.theme);
        
        // Check merged theme objects section
        if (this.theme.objects && this.theme.objects.default && this.theme.objects.default.color) {
            console.log('MATERIALS: ⚠️  After merge, objects.default.color:', this.theme.objects.default.color, 'type:', typeof this.theme.objects.default.color);
        }
        
        // Refresh all cached materials with new theme
        this.refreshCachedMaterials();
        
        console.log('MATERIALS: Theme updated, refreshed', this.materialCache.size, 'cached materials');
        this.logMaterialCacheContents();
    }
    
    /**
     * Debug method to log all cached materials
     */
    logMaterialCacheContents() {
        console.log('MATERIALS: Cache contents:');
        this.materialCache.forEach((material, key) => {
            const { category, variant, type, refCount } = material.userData;
            console.log(`  - ${key} | ${category}.${variant} | ${type} | refs: ${refCount}`);
        });
    }
    
    /**
     * Release a material reference (decrements ref count)
     */
    releaseMaterial(material) {
        if (!material || !material.userData) return;
        
        material.userData.refCount = Math.max(0, (material.userData.refCount || 1) - 1);
        
        // If no more references, queue for disposal
        if (material.userData.refCount === 0) {
            this.disposalQueue.add(material);
        }
    }
    
    /**
     * Dispose unused materials
     */
    disposeUnusedMaterials() {
        let disposedCount = 0;
        
        this.disposalQueue.forEach(material => {
            if (material.userData.refCount === 0) {
                this.materialCache.delete(material.userData.cacheKey);
                this.activeMaterials.delete(material);
                material.dispose();
                disposedCount++;
            }
        });
        
        this.disposalQueue.clear();
        
        if (disposedCount > 0) {
            console.log('MATERIALS: Disposed', disposedCount, 'unused materials');
        }
    }
    
    /**
     * Get material usage statistics
     */
    getUsageStats() {
        return {
            cachedMaterials: this.materialCache.size,
            activeMaterials: this.activeMaterials.size,
            pendingDisposal: this.disposalQueue.size,
            categories: this.getCategoryCounts()
        };
    }
    
    // Private methods
    
    getThemeProperties(category, variant) {
        const categoryTheme = this.theme[category];
        if (!categoryTheme) return {};
        
        if (typeof categoryTheme[variant] === 'object') {
            return { ...categoryTheme[variant] };
        }
        
        // Handle nested categories (like ui.grid.main)
        const keys = variant.split('.');
        let result = categoryTheme;
        for (const key of keys) {
            result = result[key];
            if (!result) return {};
        }
        
        return typeof result === 'object' ? { ...result } : {};
    }
    
    createCacheKey(type, properties) {
        // Create deterministic cache key from material properties
        const sortedProps = Object.keys(properties)
            .sort()
            .map(key => `${key}:${properties[key]}`)
            .join('|');
        return `${type}::${sortedProps}`;
    }
    
    refreshCachedMaterials() {
        // Update all cached materials with new theme properties
        const materialsToRefresh = Array.from(this.materialCache.values());
        
        materialsToRefresh.forEach(material => {
            const { category, variant } = material.userData;
            const themeProps = this.getThemeProperties(category, variant);
            
            // SAFETY: Only update if we have theme properties to avoid corrupting materials
            if (Object.keys(themeProps).length > 0) {
                console.log(`MATERIALS: Updating ${category}.${variant} with props:`, themeProps);
                
                // Update material properties
                Object.keys(themeProps).forEach(prop => {
                    if (material[prop] !== undefined) {
                        const oldValue = material[prop];
                        const newValue = themeProps[prop];
                        
                        // Special handling for color property
                        if (prop === 'color') {
                            console.log(`MATERIALS: Color update - old: ${oldValue} (type: ${typeof oldValue}) -> new: ${newValue} (type: ${typeof newValue})`);
                            
                            // THREE.js materials store colors as Color objects, not numbers
                            if (material.color && typeof material.color.setHex === 'function') {
                                // Use setHex to update the existing Color object
                                material.color.setHex(newValue);
                                console.log(`MATERIALS: Updated color using setHex(${newValue}) -> now:`, material.color.getHex());
                            } else {
                                // Fallback to direct assignment
                                material[prop] = newValue;
                                console.log(`MATERIALS: Updated ${category}.${variant}.${prop} (direct): ${oldValue} -> ${newValue}`);
                            }
                        } else {
                            // Normal property update
                            material[prop] = newValue;
                            console.log(`MATERIALS: Updated ${category}.${variant}.${prop}: ${oldValue} -> ${newValue}`);
                        }
                    }
                });
                
                material.needsUpdate = true;
            } else {
                console.log(`MATERIALS: Skipping update for ${category}.${variant} - no theme properties found`);
            }
        });
    }
    
    getCategoryCounts() {
        const counts = {};
        this.activeMaterials.forEach(material => {
            const category = material.userData.category || 'unknown';
            counts[category] = (counts[category] || 0) + 1;
        });
        return counts;
    }
    
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    /**
     * Dispose all materials and clear caches
     */
    dispose() {
        console.log('MATERIALS: Disposing MaterialManager with', this.activeMaterials.size, 'active materials');
        
        this.activeMaterials.forEach(material => {
            material.dispose();
        });
        
        this.materialCache.clear();
        this.activeMaterials.clear();
        this.disposalQueue.clear();
    }
}

// Export for module use
window.MaterialManager = MaterialManager;