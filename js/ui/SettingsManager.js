/**
 * Settings Manager - Handles UI settings and preferences
 */
class SettingsManager {
    constructor(sceneManager, rendererManager, configManager = null, materialManager = null, stateManager = null) {
        this.sceneManager = sceneManager;
        this.rendererManager = rendererManager;
        this.configManager = configManager;
        this.materialManager = materialManager;
        this.stateManager = stateManager;
        
        // UI Settings - use centralized configuration when available
        if (this.configManager) {
            // Use centralized configuration defaults
            this.uiSettings = this.configManager.get('ui') || this.getDefaultUISettings();
        } else {
            // Fallback to hardcoded defaults
            this.uiSettings = this.getDefaultUISettings();
        }
        
        this.setupUIEventListeners();
        this.initializeSettings();
    }

    setupUIEventListeners() {
        // Scene settings panel
        const sceneSettingsBtn = document.getElementById('scene-settings-btn');
        const sceneSettingsPanel = document.getElementById('scene-settings-panel');
        const sceneSettingsClose = document.getElementById('scene-settings-close');
        
        if (sceneSettingsBtn && sceneSettingsPanel) {
            sceneSettingsBtn.addEventListener('click', () => {
                sceneSettingsPanel.style.display = 'block';
            });
        }
        
        if (sceneSettingsClose) {
            sceneSettingsClose.addEventListener('click', () => {
                sceneSettingsPanel.style.display = 'none';
            });
        }
        
        // UI Settings panel
        const toolSettingsBtn = document.getElementById('tool-settings');
        const uiSettingsPanel = document.getElementById('ui-settings-panel');
        const uiSettingsClose = document.getElementById('ui-settings-close');
        
        if (toolSettingsBtn && uiSettingsPanel) {
            toolSettingsBtn.addEventListener('click', () => {
                uiSettingsPanel.style.display = 'block';
                this.loadUISettingsToPanel();
            });
        }
        
        if (uiSettingsClose) {
            uiSettingsClose.addEventListener('click', () => {
                uiSettingsPanel.style.display = 'none';
            });
        }
        
        // Settings controls
        const saveSettingsBtn = document.getElementById('save-settings');
        const loadSettingsBtn = document.getElementById('load-settings');
        const resetSettingsBtn = document.getElementById('reset-settings');
        
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }
        
        if (loadSettingsBtn) {
            loadSettingsBtn.addEventListener('click', () => this.loadSettings());
        }
        
        if (resetSettingsBtn) {
            resetSettingsBtn.addEventListener('click', () => this.resetSettings());
        }
        
        // Setup input change listeners
        this.setupInputListeners();
        this.setupArrowListeners();
        
        // Keyboard shortcut for UI settings
        document.addEventListener('keydown', (event) => {
            // Don't trigger when typing in inputs
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }
            
            if (event.key.toLowerCase() === 'u' && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                this.toggleUISettingsPanel();
            }
        });
    }

    setupInputListeners() {
        const inputs = [
            'ui-bg-color', 'ui-grid-size', 'ui-grid-divisions', 'ui-grid-subdivisions', 'ui-grid-main-color', 'ui-grid-sub-color',
            'ui-edge-color', 'ui-edge-thickness', 'ui-corner-size', 'ui-hit-area',
            'ui-hover-color', 'ui-snap-color', 'ui-highlight-thickness',
            'ui-shadows-enabled', 'ui-wireframe-mode'
        ];
        
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                const eventType = input.type === 'checkbox' ? 'change' : 'input';
                input.addEventListener(eventType, () => {
                    console.log('SETTINGS: Input changed -', id, 'value:', input.value);
                    this.applyUISettings();
                });
                
                // Add Enter key handler for all inputs
                if (input.type !== 'checkbox') {
                    input.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            console.log('SETTINGS: Enter pressed on', id, 'value:', input.value);
                            this.applyUISettings();
                            input.blur(); // Remove focus
                        }
                    });
                }
                
                console.log('SETTINGS: Added listener for', id);
            } else {
                console.log('SETTINGS: Element not found:', id);
            }
        });
    }

    setupArrowListeners() {
        // Set up arrow button listeners for numeric inputs
        const setupArrowsForInput = (inputId) => {
            const input = document.getElementById(inputId);
            if (!input) return;
            
            const container = input.closest('.property-input-container');
            if (!container) return;
            
            const upArrow = container.querySelector('.property-arrow-up');
            const downArrow = container.querySelector('.property-arrow-down');
            
            if (upArrow) {
                upArrow.addEventListener('click', () => {
                    const currentValue = parseFloat(input.value) || 0;
                    const step = parseFloat(input.step) || 1;
                    const max = parseFloat(input.max) || 999;
                    input.value = Math.min(currentValue + step, max);
                    console.log('SETTINGS: Arrow up clicked for', inputId, 'new value:', input.value);
                    this.applyUISettings();
                });
            }
            
            if (downArrow) {
                downArrow.addEventListener('click', () => {
                    const currentValue = parseFloat(input.value) || 0;
                    const step = parseFloat(input.step) || 1;
                    const min = parseFloat(input.min) || 0;
                    input.value = Math.max(currentValue - step, min);
                    console.log('SETTINGS: Arrow down clicked for', inputId, 'new value:', input.value);
                    this.applyUISettings();
                });
            }
        };

        // Set up arrows for all numeric inputs
        ['ui-grid-size', 'ui-grid-divisions', 'ui-grid-subdivisions', 'ui-edge-thickness', 'ui-corner-size', 'ui-hit-area', 'ui-highlight-thickness'].forEach(setupArrowsForInput);
    }

    toggleUISettingsPanel() {
        const uiSettingsPanel = document.getElementById('ui-settings-panel');
        if (uiSettingsPanel) {
            if (uiSettingsPanel.style.display === 'block') {
                uiSettingsPanel.style.display = 'none';
            } else {
                uiSettingsPanel.style.display = 'block';
                this.loadUISettingsToPanel();
            }
        }
    }

    loadUISettingsToPanel() {
        // Ensure all settings objects exist with defaults
        if (!this.uiSettings.selection) {
            this.uiSettings.selection = { edgeColor: '#0078d4', thickness: 2, cornerSize: 0.05, hitAreaSize: 24 };
        }
        if (!this.uiSettings.highlights) {
            this.uiSettings.highlights = { hoverColor: '#ff6600', snapColor: '#00ff00', thickness: 1 };
        }
        
        // Load current settings into the panel - with null checks
        const elements = [
            ['ui-bg-color', this.uiSettings.background?.color || '#1a1a1a'],
            ['ui-grid-size', this.uiSettings.grid?.size || 50],
            ['ui-grid-divisions', this.uiSettings.grid?.divisions || 50],
            ['ui-grid-subdivisions', this.uiSettings.grid?.subDivisions || 10],
            ['ui-grid-main-color', this.uiSettings.grid?.mainColor || '#666666'],
            ['ui-grid-sub-color', this.uiSettings.grid?.subColor || '#333333'],
            ['ui-edge-color', this.uiSettings.selection?.edgeColor || '#0078d4'],
            ['ui-edge-thickness', this.uiSettings.selection?.thickness || 2],
            ['ui-corner-size', this.uiSettings.selection?.cornerSize || 0.05],
            ['ui-hit-area', this.uiSettings.selection?.hitAreaSize || 24],
            ['ui-hover-color', this.uiSettings.highlights?.hoverColor || '#ff6600'],
            ['ui-snap-color', this.uiSettings.highlights?.snapColor || '#00ff00'],
            ['ui-highlight-thickness', this.uiSettings.highlights?.thickness || 1]
        ];
        
        elements.forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        });
        
        // Handle checkboxes separately
        const shadowsElement = document.getElementById('ui-shadows-enabled');
        if (shadowsElement) {
            shadowsElement.checked = this.uiSettings.rendering.shadowsEnabled;
        }
        
        const wireframeElement = document.getElementById('ui-wireframe-mode');
        if (wireframeElement) {
            wireframeElement.checked = this.uiSettings.rendering.wireframeMode;
        }
    }

    applyUISettings() {
        // Use centralized configuration if available
        if (this.configManager) {
            this.applyUISettingsCentralized();
            return;
        }
        
        // Fallback to legacy settings management
        // Read values from inputs with null checks
        const bgColorEl = document.getElementById('ui-bg-color');
        if (bgColorEl) this.uiSettings.background.color = bgColorEl.value;
        
        const gridSizeEl = document.getElementById('ui-grid-size');
        if (gridSizeEl) this.uiSettings.grid.size = parseInt(gridSizeEl.value);
        
        const gridDivisionsEl = document.getElementById('ui-grid-divisions');
        if (gridDivisionsEl) this.uiSettings.grid.divisions = parseInt(gridDivisionsEl.value);
        
        const gridSubdivisionsEl = document.getElementById('ui-grid-subdivisions');
        if (gridSubdivisionsEl) {
            this.uiSettings.grid.subDivisions = parseInt(gridSubdivisionsEl.value);
            console.log('SETTINGS: Sub-divisions updated to:', this.uiSettings.grid.subDivisions);
        } else {
            console.log('SETTINGS: ui-grid-subdivisions element not found');
        }
        
        const gridMainColorEl = document.getElementById('ui-grid-main-color');
        if (gridMainColorEl) this.uiSettings.grid.mainColor = gridMainColorEl.value;
        
        const gridSubColorEl = document.getElementById('ui-grid-sub-color');
        if (gridSubColorEl) this.uiSettings.grid.subColor = gridSubColorEl.value;
        
        const edgeColorEl = document.getElementById('ui-edge-color');
        if (edgeColorEl) this.uiSettings.selection.edgeColor = edgeColorEl.value;
        
        const edgeThicknessEl = document.getElementById('ui-edge-thickness');
        if (edgeThicknessEl) this.uiSettings.selection.thickness = parseInt(edgeThicknessEl.value);
        
        const cornerSizeEl = document.getElementById('ui-corner-size');
        if (cornerSizeEl) this.uiSettings.selection.cornerSize = parseFloat(cornerSizeEl.value);
        
        const hitAreaEl = document.getElementById('ui-hit-area');
        if (hitAreaEl) this.uiSettings.selection.hitAreaSize = parseInt(hitAreaEl.value);
        
        const hoverColorEl = document.getElementById('ui-hover-color');
        if (hoverColorEl) this.uiSettings.highlights.hoverColor = hoverColorEl.value;
        
        const snapColorEl = document.getElementById('ui-snap-color');
        if (snapColorEl) this.uiSettings.highlights.snapColor = snapColorEl.value;
        
        const highlightThicknessEl = document.getElementById('ui-highlight-thickness');
        if (highlightThicknessEl) this.uiSettings.highlights.thickness = parseInt(highlightThicknessEl.value);
        
        const shadowsEl = document.getElementById('ui-shadows-enabled');
        if (shadowsEl) this.uiSettings.rendering.shadowsEnabled = shadowsEl.checked;
        
        const wireframeEl = document.getElementById('ui-wireframe-mode');
        if (wireframeEl) this.uiSettings.rendering.wireframeMode = wireframeEl.checked;
        
        // Apply settings to the scene
        this.updateSceneWithSettings();
        
        // Force update of selection highlights if objects are selected
        const app = window.modlerApp;
        if (app && app.selectionManager) {
            // Update centralized HighlightManager config if available
            if (app.highlightManager) {
                this.updateHighlightManagerConfig(app.highlightManager);
                console.log('SETTINGS: Updated centralized HighlightManager config');
            } else {
                // Fallback to legacy system
                app.selectionManager.refreshSelectionHighlights();
                app.selectionManager.highlightSystem.ensureNoShadowCasting();
            }
        }
    }
    
    /**
     * Apply UI settings using centralized configuration system
     */
    applyUISettingsCentralized() {
        // Read all UI input values and update centralized config
        const updates = {};
        
        // Background settings
        const bgColorEl = document.getElementById('ui-bg-color');
        if (bgColorEl) updates['ui.background.color'] = bgColorEl.value;
        
        // Grid settings
        const gridSizeEl = document.getElementById('ui-grid-size');
        if (gridSizeEl) updates['ui.grid.size'] = parseInt(gridSizeEl.value);
        
        const gridDivisionsEl = document.getElementById('ui-grid-divisions');
        if (gridDivisionsEl) updates['ui.grid.divisions'] = parseInt(gridDivisionsEl.value);
        
        const gridSubdivisionsEl = document.getElementById('ui-grid-subdivisions');
        if (gridSubdivisionsEl) updates['ui.grid.subDivisions'] = parseInt(gridSubdivisionsEl.value);
        
        const gridMainColorEl = document.getElementById('ui-grid-main-color');
        if (gridMainColorEl) updates['ui.grid.mainColor'] = gridMainColorEl.value;
        
        const gridSubColorEl = document.getElementById('ui-grid-sub-color');
        if (gridSubColorEl) updates['ui.grid.subColor'] = gridSubColorEl.value;
        
        // Selection settings
        const edgeColorEl = document.getElementById('ui-edge-color');
        if (edgeColorEl) updates['ui.selection.edgeColor'] = edgeColorEl.value;
        
        const edgeThicknessEl = document.getElementById('ui-edge-thickness');
        if (edgeThicknessEl) updates['ui.selection.thickness'] = parseInt(edgeThicknessEl.value);
        
        const cornerSizeEl = document.getElementById('ui-corner-size');
        if (cornerSizeEl) updates['ui.selection.cornerSize'] = parseFloat(cornerSizeEl.value);
        
        const hitAreaEl = document.getElementById('ui-hit-area');
        if (hitAreaEl) updates['ui.selection.hitAreaSize'] = parseInt(hitAreaEl.value);
        
        // Highlight settings
        const hoverColorEl = document.getElementById('ui-hover-color');
        if (hoverColorEl) updates['ui.highlights.hoverColor'] = hoverColorEl.value;
        
        const snapColorEl = document.getElementById('ui-snap-color');
        if (snapColorEl) updates['ui.highlights.snapColor'] = snapColorEl.value;
        
        const highlightThicknessEl = document.getElementById('ui-highlight-thickness');
        if (highlightThicknessEl) updates['ui.highlights.thickness'] = parseInt(highlightThicknessEl.value);
        
        // Rendering settings
        const shadowsEl = document.getElementById('ui-shadows-enabled');
        if (shadowsEl) updates['ui.rendering.shadowsEnabled'] = shadowsEl.checked;
        
        const wireframeEl = document.getElementById('ui-wireframe-mode');
        if (wireframeEl) updates['ui.rendering.wireframeMode'] = wireframeEl.checked;
        
        // Apply all updates to centralized configuration
        Object.entries(updates).forEach(([path, value]) => {
            this.configManager.set(path, value);
        });
        
        console.log('SETTINGS: Applied', Object.keys(updates).length, 'settings via centralized configuration');
    }
    
    updateHighlightManagerConfig(highlightManager) {
        // Update centralized HighlightManager config with UI settings
        const edgeColor = this.uiSettings.selection.edgeColor.replace('#', '');
        const hoverColor = this.uiSettings.highlights.hoverColor.replace('#', '');
        const snapColor = this.uiSettings.highlights.snapColor.replace('#', '');
        
        // Convert to numbers
        const edgeColorNumber = parseInt(edgeColor, 16);
        const hoverColorNumber = parseInt(hoverColor, 16);
        const snapColorNumber = parseInt(snapColor, 16);
        
        // Update base styles with UI settings
        highlightManager.config.styles.selection.color = edgeColorNumber;
        highlightManager.config.styles.selection.thickness = this.uiSettings.selection.thickness;
        console.log('SETTINGS: Updated selection config - color:', edgeColorNumber, 'thickness:', this.uiSettings.selection.thickness);
        
        highlightManager.config.styles.hover.color = hoverColorNumber;
        highlightManager.config.styles.hover.thickness = this.uiSettings.highlights.thickness;
        console.log('SETTINGS: Updated hover config - color:', hoverColorNumber, 'thickness:', this.uiSettings.highlights.thickness);
        
        highlightManager.config.styles.temporary.color = snapColorNumber;
        highlightManager.config.styles.temporary.thickness = this.uiSettings.highlights.thickness;
        console.log('SETTINGS: Updated temporary config - color:', snapColorNumber, 'thickness:', this.uiSettings.highlights.thickness);
        
        highlightManager.config.styles.face.color = edgeColorNumber;
        highlightManager.config.styles.face.thickness = this.uiSettings.selection.thickness;
        console.log('SETTINGS: Updated face config - color:', edgeColorNumber, 'thickness:', this.uiSettings.selection.thickness);
        
        // Update tool-specific face styles with thickness
        if (highlightManager.config.tools.move && highlightManager.config.tools.move.face) {
            highlightManager.config.tools.move.face.thickness = this.uiSettings.selection.thickness;
            console.log('SETTINGS: Updated move tool face thickness:', this.uiSettings.selection.thickness);
        }
        if (highlightManager.config.tools.pushpull && highlightManager.config.tools.pushpull.face) {
            highlightManager.config.tools.pushpull.face.thickness = this.uiSettings.selection.thickness;
            console.log('SETTINGS: Updated pushpull tool face thickness:', this.uiSettings.selection.thickness);
        }
        if (highlightManager.config.tools.select && highlightManager.config.tools.select.face) {
            highlightManager.config.tools.select.face.thickness = this.uiSettings.selection.thickness;
            console.log('SETTINGS: Updated select tool face thickness:', this.uiSettings.selection.thickness);
        }
        
        console.log('SETTINGS: Updated HighlightManager config complete - calling refreshActiveHighlights()');
        
        // Refresh all active highlights to use new settings
        highlightManager.refreshActiveHighlights();
    }

    updateSceneWithSettings() {
        // Update background color
        const bgColor = new THREE.Color(this.uiSettings.background.color);
        this.sceneManager.scene.background = bgColor;
        
        // Update grid
        this.sceneManager.updateGridWithSettings(this.uiSettings.grid);
        
        // Update rendering settings
        this.updateRenderingSettings();
        
        console.log('Applied UI settings:', this.uiSettings);
    }

    updateRenderingSettings() {
        // Ensure rendering settings exist
        if (!this.uiSettings.rendering) {
            this.uiSettings.rendering = {
                shadowsEnabled: true,
                wireframeMode: false
            };
        }
        
        // Update shadow settings
        this.rendererManager.enableShadows(this.uiSettings.rendering.shadowsEnabled);
        this.sceneManager.enableShadows(this.uiSettings.rendering.shadowsEnabled);
        
        // Update wireframe mode - this would need to be handled by the selection manager
        // For now, just log it
        console.log('Wireframe mode:', this.uiSettings.rendering.wireframeMode);
    }

    saveSettings() {
        try {
            if (this.configManager) {
                // Save through centralized configuration
                const uiConfig = this.configManager.export(['ui']);
                if (this.stateManager) {
                    this.stateManager.set('ui.settings', uiConfig);
                } else {
                    localStorage.setItem('modler-ui-settings', JSON.stringify(uiConfig));
                }
                console.log('UI settings saved via ConfigurationManager');
                alert('Settings saved!');
            } else {
                // Fallback to legacy save
                if (this.stateManager) {
                    this.stateManager.set('ui.settings.legacy', this.uiSettings);
                    console.log('UI settings saved to StateManager');
                    alert('Settings saved!');
                } else {
                    localStorage.setItem('modler-ui-settings', JSON.stringify(this.uiSettings));
                    console.log('UI settings saved to localStorage');
                    alert('Settings saved to localStorage!');
                }
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings: ' + error.message);
        }
    }

    loadSettings() {
        try {
            const saved = this.stateManager ? 
                this.stateManager.get('ui.settings') :
                localStorage.getItem('modler-ui-settings');
            if (saved) {
                const savedSettings = JSON.parse(saved);
                
                if (this.configManager) {
                    // Load through centralized configuration
                    this.configManager.import(savedSettings, true);
                    this.loadUISettingsFromConfig();
                    console.log('UI settings loaded via ConfigurationManager');
                    alert('Settings loaded!');
                } else {
                    // Fallback to legacy load
                    this.uiSettings = savedSettings;
                    this.loadUISettingsToPanel();
                    this.updateSceneWithSettings();
                    console.log('UI settings loaded from centralized state');
                    alert('Settings loaded!');
                }
            } else {
                alert('No saved settings found');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            alert('Error loading settings: ' + error.message);
        }
    }

    resetSettings() {
        if (this.configManager) {
            // Reset through centralized configuration
            this.configManager.reset('ui');
            this.loadUISettingsFromConfig();
            console.log('UI settings reset via ConfigurationManager');
            alert('Settings reset to defaults!');
        } else {
            // Fallback to legacy reset
            this.uiSettings = {
                background: { color: '#1a1a1a' },
                grid: {
                    size: 50,
                    divisions: 50,
                    subDivisions: 10,
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
            
            this.loadUISettingsToPanel();
            this.updateSceneWithSettings();
            console.log('UI settings reset to defaults');
            alert('Settings reset to defaults!');
        }
    }
    
    /**
     * Load UI settings from centralized configuration to panel
     */
    loadUISettingsFromConfig() {
        if (!this.configManager) return;
        
        // Load current config values into UI inputs
        const elements = [
            ['ui-bg-color', this.configManager.get('ui.background.color')],
            ['ui-grid-size', this.configManager.get('ui.grid.size')],
            ['ui-grid-divisions', this.configManager.get('ui.grid.divisions')],
            ['ui-grid-subdivisions', this.configManager.get('ui.grid.subDivisions')],
            ['ui-grid-main-color', this.configManager.get('ui.grid.mainColor')],
            ['ui-grid-sub-color', this.configManager.get('ui.grid.subColor')],
            ['ui-edge-color', this.configManager.get('ui.selection.edgeColor')],
            ['ui-edge-thickness', this.configManager.get('ui.selection.thickness')],
            ['ui-corner-size', this.configManager.get('ui.selection.cornerSize')],
            ['ui-hit-area', this.configManager.get('ui.selection.hitAreaSize')],
            ['ui-hover-color', this.configManager.get('ui.highlights.hoverColor')],
            ['ui-snap-color', this.configManager.get('ui.highlights.snapColor')],
            ['ui-highlight-thickness', this.configManager.get('ui.highlights.thickness')]
        ];
        
        elements.forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value !== undefined) {
                element.value = value;
            }
        });
        
        // Handle checkboxes separately
        const shadowsElement = document.getElementById('ui-shadows-enabled');
        if (shadowsElement) {
            shadowsElement.checked = this.configManager.get('ui.rendering.shadowsEnabled');
        }
        
        const wireframeElement = document.getElementById('ui-wireframe-mode');
        if (wireframeElement) {
            wireframeElement.checked = this.configManager.get('ui.rendering.wireframeMode');
        }
        
        console.log('SETTINGS: Loaded UI settings from centralized configuration');
    }
    
    /**
     * Get default UI settings (fallback when ConfigurationManager not available)
     */
    getDefaultUISettings() {
        return {
            background: { color: '#1a1a1a' },
            grid: {
                size: 50,
                divisions: 50,
                subDivisions: 10,
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
    }

    initializeSettings() {
        // Note: Settings loading is now handled by main application initialization
        // This prevents duplicate loading and ensures proper timing
        this.updateSceneWithSettings();
    }

    getUISettings() {
        return this.uiSettings;
    }

    dispose() {
        // Clean up event listeners if needed
        // Most are handled by the DOM cleanup automatically
    }
}

// Export for module use
window.SettingsManager = SettingsManager;