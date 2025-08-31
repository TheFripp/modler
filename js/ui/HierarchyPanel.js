/**
 * Hierarchy Panel - Tree view for organizing and managing scene objects
 */
class HierarchyPanel {
    constructor(sceneManager, selectionManager, stateManager = null, objectManager = null, materialManager = null, autoLayoutManager = null) {
        this.sceneManager = sceneManager;
        this.selectionManager = selectionManager;
        this.stateManager = stateManager;
        this.objectManager = objectManager;
        this.materialManager = materialManager;
        this.autoLayoutManager = autoLayoutManager;
        
        // Panel state - use centralized state if available
        if (this.stateManager) {
            // Subscribe to state changes
            this.stateManager.subscribe('hierarchy.expanded', (expanded) => {
                this.expandedItems = expanded instanceof Set ? expanded : new Set(expanded || []);
                this.buildTree();
            });
            
            this.stateManager.subscribe('hierarchy.rootObjects', () => {
                this.buildTree();
            });
            
            this.stateManager.subscribe('hierarchy.layerOrder', () => {
                this.buildTree();
            });
            
            this.stateManager.subscribe('hierarchy.visibility', () => {
                this.updateVisibilityUI();
            });
            
            // Use centralized expanded state - ensure it's a Set
            const savedExpanded = this.stateManager.get('hierarchy.expanded');
            this.expandedItems = savedExpanded instanceof Set ? savedExpanded : new Set(savedExpanded || []);
        } else {
            // Fallback to local state
            this.expandedItems = new Set();
        }
        
        this.draggedItem = null;
        this.dropTarget = null;
        this.dropPosition = null; // 'before', 'after', 'inside'
        
        // Container creation state
        this.creatingContainer = false;
        this.nextContainerNumber = 1;
        
        // Tree building state
        this.buildTreePending = false;
        
        // Create panel DOM structure
        this.createPanel();
        this.setupEventListeners();
        
        // MANDATORY ARCHITECTURE PATTERN: Register for centralized UI synchronization
        if (this.sceneManager && this.sceneManager.registerUISync) {
            this.sceneManager.registerUISync(this.handleSceneChange.bind(this));
        }
        
        if (this.selectionManager && this.selectionManager.registerUISync) {
            this.selectionManager.registerUISync(this.handleSelectionChange.bind(this));
        }
        
        // Update on selection changes (callback will be set by main application)
        
        // Build initial tree
        this.buildTree();
    }
    
    createPanel() {
        // Create hierarchy panel container
        this.panel = document.createElement('div');
        this.panel.id = 'hierarchy-panel';
        this.panel.className = 'hierarchy-panel';
        
        // Panel header
        const header = document.createElement('div');
        header.className = 'panel-header';
        header.innerHTML = `
            <h3>Hierarchy</h3>
            <div class="panel-actions">
                <button id="create-container-btn" class="panel-action-btn" title="Create Container">📁</button>
                <button id="hierarchy-collapse-btn" class="panel-toggle" title="Collapse All">▼</button>
            </div>
        `;
        
        // Tree container
        this.treeContainer = document.createElement('div');
        this.treeContainer.className = 'hierarchy-tree';
        this.treeContainer.id = 'hierarchy-tree';
        
        // Panel content
        const content = document.createElement('div');
        content.className = 'panel-content';
        content.appendChild(this.treeContainer);
        
        this.panel.appendChild(header);
        this.panel.appendChild(content);
        
        // Add to DOM
        document.getElementById('app').appendChild(this.panel);
    }
    
    setupEventListeners() {
        // Create container button
        document.getElementById('create-container-btn').addEventListener('click', () => {
            this.createContainerFromSelection();
        });
        
        // Collapse all button
        document.getElementById('hierarchy-collapse-btn').addEventListener('click', () => {
            this.collapseAll();
        });
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.key.toLowerCase() === 'g') {
                event.preventDefault();
                this.createContainerFromSelection();
            }
        });
        
        // Tree container event delegation
        this.treeContainer.addEventListener('click', (event) => {
            this.handleTreeClick(event);
        });
        
        this.treeContainer.addEventListener('dblclick', (event) => {
            this.handleTreeDoubleClick(event);
        });
        
        // Drag and drop
        this.treeContainer.addEventListener('dragstart', (event) => {
            this.handleDragStart(event);
        });
        
        this.treeContainer.addEventListener('dragover', (event) => {
            this.handleDragOver(event);
        });
        
        this.treeContainer.addEventListener('drop', (event) => {
            this.handleDrop(event);
        });
        
        this.treeContainer.addEventListener('dragleave', (event) => {
            // Clear drop target when leaving tree area
            if (!this.treeContainer.contains(event.relatedTarget)) {
                if (this.dropTarget) {
                    this.dropTarget.classList.remove('drop-target');
                    this.dropTarget = null;
                }
            }
        });
    }
    
    // Tree Building
    buildTree() {
        // Throttle rapid buildTree calls to prevent duplicates
        if (this.buildTreePending) {
            console.log('HIERARCHY: buildTree() already pending, skipping');
            return;
        }
        
        this.buildTreePending = true;
        
        console.log('HIERARCHY: buildTree() called - clearing existing tree');
        this.treeContainer.innerHTML = '';
        
        // Get all root-level objects (objects without containers as parents)
        const rootObjects = this.getRootObjects();
        console.log('HIERARCHY: Found', rootObjects.length, 'root objects:', rootObjects.map(obj => obj.userData.id));
        
        rootObjects.forEach(object => {
            this.addObjectAndChildrenToTree(object, 0);
        });
        
        if (rootObjects.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'hierarchy-empty';
            emptyMessage.textContent = 'No objects in scene';
            this.treeContainer.appendChild(emptyMessage);
        }
        
        // Update selection highlighting after rebuilding tree
        this.updateSelection();
        
        // Clear pending flag
        this.buildTreePending = false;
    }
    
    addObjectAndChildrenToTree(object, depth) {
        console.log(`HIERARCHY: Adding object ${object.userData.id} at depth ${depth}, isContainer: ${object.isContainer}`);
        
        // Check if item already exists in tree (prevent duplicates)
        const existingItem = this.treeContainer.querySelector(`[data-object-id="${object.userData.id}"]`);
        if (existingItem) {
            console.warn(`HIERARCHY: Item ${object.userData.id} already exists in tree, skipping duplicate`);
            return;
        }
        
        // Create and add the main item
        const item = this.createTreeItem(object, depth);
        this.treeContainer.appendChild(item);
        
        // Add children if container is expanded
        if (object.isContainer) {
            const isExpanded = this.expandedItems.has(object.userData.id);
            const childCount = object.childObjects ? object.childObjects.size : 0;
            console.log(`HIERARCHY: Container ${object.userData.id} - expanded: ${isExpanded}, children: ${childCount}`);
            
            if (isExpanded && childCount > 0) {
                const children = Array.from(object.childObjects);
                console.log(`HIERARCHY: Adding ${children.length} children for container ${object.userData.id}`);
                
                // Don't sort children - maintain user-defined order for drag-and-drop reordering
                // children.sort((a, b) => {
                //     // Containers first, then by name
                //     if (a.isContainer && !b.isContainer) return -1;
                //     if (!a.isContainer && b.isContainer) return 1;
                //     
                //     const nameA = String(a.name || a.userData.id || 'Unnamed');
                //     const nameB = String(b.name || b.userData.id || 'Unnamed');
                //     return nameA.localeCompare(nameB);
                // });
                
                children.forEach(child => {
                    console.log(`HIERARCHY: Adding child ${child.userData.id} at depth ${depth + 1}`);
                    this.addObjectAndChildrenToTree(child, depth + 1);
                });
            }
        }
    }
    
    /**
     * Update visibility UI based on centralized state
     */
    updateVisibilityUI() {
        if (!this.stateManager) return;
        
        const visibility = this.stateManager.get('hierarchy.visibility');
        if (!visibility) return;
        
        // Update visibility checkboxes in the tree
        this.treeContainer.querySelectorAll('.visibility-toggle').forEach(checkbox => {
            const objectId = checkbox.dataset.objectId;
            if (visibility.has(objectId)) {
                checkbox.checked = visibility.get(objectId);
            }
        });
    }
    
    /**
     * Toggle object visibility and update state
     */
    toggleObjectVisibility(objectId, visible) {
        const object = this.objectManager ? 
            this.objectManager.getObject(objectId) : 
            this.findObjectById(objectId);
        
        if (!object) return;
        
        if (this.objectManager) {
            this.objectManager.setVisibility(object, visible);
        } else {
            // Fallback to direct object update
            object.visible = visible;
            object.userData.visible = visible;
        }
        
        console.log('HIERARCHY: Toggled visibility for', objectId, 'to', visible);
    }
    
    /**
     * Update expanded state in centralized state manager
     */
    updateExpandedState() {
        if (this.stateManager) {
            this.stateManager.set('hierarchy.expanded', this.expandedItems);
        }
    }
    
    getRootObjects() {
        // Try centralized ObjectManager if available
        if (this.objectManager && this.stateManager) {
            const rootObjectIds = this.stateManager.get('hierarchy.rootObjects') || new Set();
            const layerOrder = this.stateManager.get('hierarchy.layerOrder') || [];
            
            // Ensure rootObjectIds is a Set
            const rootObjectIdsSet = rootObjectIds instanceof Set ? rootObjectIds : new Set(rootObjectIds);
            
            // Get objects in layer order
            const rootObjects = [];
            layerOrder.forEach(id => {
                if (rootObjectIdsSet.has(id)) {
                    const object = this.objectManager.getObject(id);
                    if (object) {
                        rootObjects.push(object);
                    }
                }
            });
            
            console.log('HIERARCHY: Using centralized object management, found', rootObjects.length, 'root objects');
            
            // If centralized approach found objects, return them
            if (rootObjects.length > 0) {
                return rootObjects;
            }
            
            // If no objects found in centralized state, fall back to scene traversal
            console.log('HIERARCHY: No objects in centralized state, falling back to scene traversal');
        }
        
        // Fallback to legacy scene traversal
        const rootObjects = [];
        
        // Get direct children of the scene that are selectable
        this.sceneManager.scene.children.forEach((child, index) => {
            
            // Skip camera, lights, helpers, grids, floor
            if (child.isCamera || child.isLight || 
                child.userData?.isHelper || child.userData?.isGrid || 
                child.userData?.isAxes || child.userData?.isFloor) {
                return;
            }
            
            // Include selectable objects and containers, but exclude container proxies
            if (child.userData && child.userData.selectable && 
                !child.userData.isContainerProxy && 
                child.userData.type !== 'container-proxy') {
                rootObjects.push(child);
            }
        });
        
        // Deduplicate objects by ID to prevent duplicates in tree
        const uniqueObjects = [];
        const seenIds = new Set();
        
        rootObjects.forEach(object => {
            const id = object.userData.id;
            if (!seenIds.has(id)) {
                seenIds.add(id);
                uniqueObjects.push(object);
            } else {
                console.warn('HIERARCHY: Detected duplicate object:', id);
            }
        });
        
        if (rootObjects.length !== uniqueObjects.length) {
            console.warn('HIERARCHY: Removed', rootObjects.length - uniqueObjects.length, 'duplicate objects');
        }
        
        // Register found objects with centralized systems for future use
        if (uniqueObjects.length > 0) {
            // Register with ObjectManager
            if (this.objectManager) {
                uniqueObjects.forEach(object => {
                    if (!this.objectManager.getObject(object.userData.id)) {
                        this.objectManager.registerObject(object);
                    }
                });
            }
            
            // Register with StateManager hierarchy
            if (this.stateManager) {
                const rootObjectIds = new Set(uniqueObjects.map(obj => obj.userData.id));
                const layerOrder = uniqueObjects.map(obj => obj.userData.id);
                
                this.stateManager.set('hierarchy.rootObjects', rootObjectIds);
                this.stateManager.set('hierarchy.layerOrder', layerOrder);
            }
        }
        
        // Don't sort root objects - maintain creation/user-defined order for drag-and-drop reordering
        return uniqueObjects;
        
        // return rootObjects.sort((a, b) => {
        //     // Containers first, then by name
        //     if (a.isContainer && !b.isContainer) return -1;
        //     if (!a.isContainer && b.isContainer) return 1;
        //     
        //     const nameA = String(a.name || a.userData.id || 'Unnamed');
        //     const nameB = String(b.name || b.userData.id || 'Unnamed');
        //     return nameA.localeCompare(nameB);
        // });
    }
    
    createTreeItem(object, depth) {
        // Create main item
        const item = document.createElement('div');
        item.className = 'hierarchy-item';
        item.dataset.objectId = object.userData.id;
        item.dataset.depth = depth;
        item.draggable = true;
        item.style.paddingLeft = `${depth * 16 + 8}px`;
        
        // Expand/collapse arrow (for containers)
        const arrow = document.createElement('div');
        arrow.className = 'hierarchy-arrow';
        if (object.isContainer && object.childObjects.size > 0) {
            const isExpanded = this.expandedItems.has(object.userData.id);
            arrow.textContent = isExpanded ? '▼' : '▶';
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleExpanded(object.userData.id);
            });
        } else {
            arrow.style.visibility = 'hidden';
        }
        
        // Object icon
        const icon = document.createElement('div');
        icon.className = 'hierarchy-icon';
        icon.textContent = object.isContainer ? '📁' : this.getObjectIcon(object);
        
        // Object name (editable)
        const nameSpan = document.createElement('span');
        nameSpan.className = 'hierarchy-name';
        nameSpan.textContent = object.name || object.userData.id || 'Unnamed';
        nameSpan.dataset.originalName = nameSpan.textContent;
        
        // Visibility toggle
        const visibilityBtn = document.createElement('button');
        visibilityBtn.className = 'hierarchy-visibility';
        visibilityBtn.textContent = object.visible ? '👁' : '🙈';
        visibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleVisibility(object);
        });
        
        // Assemble main item
        item.appendChild(arrow);
        item.appendChild(icon);
        item.appendChild(nameSpan);
        item.appendChild(visibilityBtn);
        
        return item;
    }
    
    getObjectIcon(object) {
        if (object.geometry instanceof THREE.BoxGeometry) return '⬛';
        if (object.geometry instanceof THREE.CylinderGeometry) return '⚫';
        if (object.geometry instanceof THREE.PlaneGeometry) return '⬜';
        if (object.geometry instanceof THREE.CircleGeometry) return '⭕';
        return '📦';
    }
    
    // Tree Interaction
    handleTreeClick(event) {
        console.log('HIERARCHY: Tree click event on:', event.target.className);
        
        // Ignore clicks on specific elements
        if (event.target.classList.contains('hierarchy-arrow') || 
            event.target.classList.contains('hierarchy-visibility') ||
            event.target.classList.contains('hierarchy-name-input')) {
            console.log('HIERARCHY: Ignoring click on interactive element');
            return;
        }
        
        const item = event.target.closest('.hierarchy-item');
        if (!item) {
            console.log('HIERARCHY: No hierarchy item found');
            return;
        }
        
        const objectId = item.dataset.objectId;
        console.log('HIERARCHY: Clicked on item with objectId:', objectId);
        
        const object = this.findObjectById(objectId);
        
        if (object) {
            console.log('HIERARCHY: Found object for selection:', object.userData.id, 'isContainer:', object.isContainer);
            
            // Select object in viewport
            if (event.shiftKey) {
                this.selectionManager.toggleSelection(object);
                console.log('HIERARCHY: Toggled selection for:', object.userData.id);
            } else {
                this.selectionManager.selectOnly(object);
                console.log('HIERARCHY: Selected only:', object.userData.id);
            }
        } else {
            console.warn('HIERARCHY: Could not find object with id:', objectId);
        }
    }
    
    handleTreeDoubleClick(event) {
        const nameSpan = event.target.closest('.hierarchy-name');
        if (!nameSpan) return;
        
        this.startRenaming(nameSpan);
    }
    
    startRenaming(nameSpan) {
        const originalName = nameSpan.textContent;
        nameSpan.dataset.originalName = originalName;
        
        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.className = 'hierarchy-name-input';
        
        // Replace span with input
        nameSpan.style.display = 'none';
        nameSpan.parentNode.insertBefore(input, nameSpan.nextSibling);
        
        input.focus();
        input.select();
        
        // Handle rename completion
        const finishRename = () => {
            const newName = input.value.trim() || nameSpan.dataset.originalName;
            nameSpan.textContent = newName;
            nameSpan.style.display = '';
            input.remove();
            
            // Update object name
            const objectId = nameSpan.closest('.hierarchy-item').dataset.objectId;
            const object = this.findObjectById(objectId);
            if (object) {
                object.name = newName;
                console.log(`Renamed object ${objectId} to "${newName}"`);
            }
        };
        
        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finishRename();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                nameSpan.style.display = '';
                input.remove();
            }
        });
    }
    
    toggleExpanded(objectId) {
        if (this.expandedItems.has(objectId)) {
            this.expandedItems.delete(objectId);
        } else {
            this.expandedItems.add(objectId);
        }
        
        // Update centralized state
        this.updateExpandedState();
        
        this.buildTree();
    }
    
    collapseAll() {
        this.expandedItems.clear();
        this.buildTree();
    }
    
    toggleVisibility(object) {
        const newVisibility = !object.visible;
        
        if (object.isContainer) {
            object.setVisible(newVisibility);
        } else {
            object.visible = newVisibility;
            object.userData.visible = newVisibility;
        }
        
        this.buildTree();
        console.log(`Toggled visibility for ${object.userData.id}: ${newVisibility}`);
    }
    
    // Container Management
    createContainerFromSelection() {
        // Prevent rapid multiple calls
        if (this.creatingContainer) {
            console.log('HIERARCHY: Container creation already in progress, ignoring');
            return;
        }
        this.creatingContainer = true;
        
        const selectedObjects = this.selectionManager.getSelectedObjects();
        
        // Create new container using centralized systems with proper naming
        const containerName = `Container ${this.nextContainerNumber.toString().padStart(2, '0')}`;
        this.nextContainerNumber++;
        
        const container = new Container(
            containerName,
            this.objectManager,
            this.materialManager,
            this.sceneManager,
            this.autoLayoutManager
        );
        
        // Add container to scene
        this.sceneManager.addObject(container);
        
        if (selectedObjects.length > 0) {
            console.log(`HIERARCHY: Moving ${selectedObjects.length} selected objects into container`);
            
            // Move selected objects into container
            selectedObjects.forEach(object => {
                console.log(`HIERARCHY: Moving object ${object.userData.id} into container`);
                
                // Remove from current parent or scene
                if (object.userData.parentContainer) {
                    console.log(`HIERARCHY: Removing ${object.userData.id} from parent container`);
                    object.userData.parentContainer.removeChild(object);
                } else {
                    console.log(`HIERARCHY: Removing ${object.userData.id} from scene`);
                    this.sceneManager.scene.remove(object);
                }
                container.addChild(object);
            });
            
            // Expand the container to show its contents
            this.expandedItems.add(container.userData.id);
            this.updateExpandedState();
            console.log(`HIERARCHY: Created container with ${selectedObjects.length} objects, expanded: true`);
        } else {
            console.log('HIERARCHY: Created empty container');
        }
        
        // Select the new container
        this.selectionManager.selectOnly(container);
        
        // Refresh tree
        this.buildTree();
        
        // Clear the creation flag after a short delay
        setTimeout(() => {
            this.creatingContainer = false;
        }, 500);
    }
    
    // Drag and Drop
    handleDragStart(event) {
        const item = event.target.closest('.hierarchy-item');
        if (!item) {
            console.log('HIERARCHY: No item found for drag start');
            return;
        }
        
        console.log('HIERARCHY: Drag started for item:', item.dataset.objectId);
        
        this.draggedItem = item;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.dataset.objectId);
        
        item.classList.add('dragging');
        
        // Highlight parent container when dragging child objects
        const draggedObject = this.findObjectById(item.dataset.objectId);
        if (draggedObject && draggedObject.userData.parentContainer) {
            this.highlightParentContainer(draggedObject.userData.parentContainer);
        }
    }
    
    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        const item = event.target.closest('.hierarchy-item');
        if (!item || item === this.draggedItem) {
            // Clear drop target when over empty space or same item
            this.clearDropTarget();
            this.clearParentContainerHighlight(); // Clear parent highlighting when over empty space
            console.log('HIERARCHY: Drag over empty space or same item');
            return;
        }
        
        console.log('HIERARCHY: Drag over item:', item.dataset.objectId);
        
        // Update parent container highlighting based on drag target
        this.updateParentHighlightingForDragTarget(item.dataset.objectId);
        
        // Determine drop position based on mouse position within item
        const itemRect = item.getBoundingClientRect();
        const mouseY = event.clientY;
        const itemTop = itemRect.top;
        const itemHeight = itemRect.height;
        
        // Get the target object to determine allowed drop zones
        const targetObjectId = item.dataset.objectId;
        const targetObject = this.findObjectById(targetObjectId);
        
        let dropPosition = 'after'; // default
        let allowDrop = true;
        
        if (targetObject && targetObject.isContainer) {
            // For containers, allow all three positions
            const relativeY = (mouseY - itemTop) / itemHeight;
            if (relativeY < 0.25) {
                dropPosition = 'before';
            } else if (relativeY > 0.75) {
                dropPosition = 'after';
            } else {
                dropPosition = 'inside';
            }
        } else {
            // For regular objects, only allow before/after positioning
            const relativeY = (mouseY - itemTop) / itemHeight;
            dropPosition = relativeY < 0.5 ? 'before' : 'after';
        }
        
        console.log(`HIERARCHY: Drop position: ${dropPosition} for ${targetObject?.isContainer ? 'container' : 'object'}`);
        
        // Update visual feedback
        this.updateDropTarget(item, dropPosition);
    }
    
    clearDropTarget() {
        if (this.dropTarget) {
            this.dropTarget.classList.remove('drop-target', 'drop-before', 'drop-after', 'drop-inside');
            this.dropTarget = null;
            this.dropPosition = null;
        }
    }
    
    updateDropTarget(item, position) {
        // Clear previous target
        this.clearDropTarget();
        
        // Set new target
        this.dropTarget = item;
        this.dropPosition = position;
        
        // Add appropriate CSS classes for visual feedback
        item.classList.add('drop-target');
        item.classList.add(`drop-${position}`);
    }
    
    handleDrop(event) {
        event.preventDefault();
        
        console.log('HIERARCHY: Drop event triggered');
        
        if (!this.draggedItem) {
            console.log('HIERARCHY: No dragged item');
            return;
        }
        
        const draggedObjectId = this.draggedItem.dataset.objectId;
        console.log('HIERARCHY: Dragged object id:', draggedObjectId, 'drop position:', this.dropPosition);
        
        const draggedObject = this.findObjectById(draggedObjectId);
        
        if (!draggedObject) {
            console.log('HIERARCHY: Could not find dragged object');
            this.cleanupDragOperation();
            return;
        }
        
        if (this.dropTarget && this.dropPosition) {
            const targetObjectId = this.dropTarget.dataset.objectId;
            console.log('HIERARCHY: Drop target id:', targetObjectId, 'position:', this.dropPosition);
            
            const targetObject = this.findObjectById(targetObjectId);
            
            if (targetObject && draggedObject !== targetObject) {
                console.log('HIERARCHY: Valid drop target found, isContainer:', targetObject.isContainer);
                
                if (this.dropPosition === 'inside' && targetObject.isContainer) {
                    // Drop into container
                    console.log('HIERARCHY: Moving object into container');
                    this.moveObjectToContainer(draggedObject, targetObject);
                } else if (this.dropPosition === 'before' || this.dropPosition === 'after') {
                    // Reorder objects (before/after positioning)
                    console.log('HIERARCHY: Reordering objects - position:', this.dropPosition);
                    this.reorderObjects(draggedObject, targetObject, this.dropPosition);
                } else {
                    console.log('HIERARCHY: Invalid drop - cannot drop on regular objects');
                }
            }
        } else {
            // Drop on empty space - move to root level
            console.log('HIERARCHY: Moving object to root level');
            this.moveObjectToRoot(draggedObject);
        }
        
        this.cleanupDragOperation();
    }
    
    cleanupDragOperation() {
        // Cleanup drag state
        if (this.draggedItem) {
            this.draggedItem.classList.remove('dragging');
        }
        this.clearDropTarget();
        this.clearParentContainerHighlight();
        this.draggedItem = null;
        
        // Debug: Check scene state after drag operation
        console.log('HIERARCHY: Scene objects after drag operation:');
        this.sceneManager.scene.children.forEach(child => {
            if (child.userData && child.userData.selectable) {
                console.log(`  - ${child.userData.id} (${child.userData.type}) isContainer:${child.isContainer} children:${child.childObjects ? child.childObjects.size : 0}`);
            }
        });
        
        this.buildTree();
    }

    highlightParentContainer(container) {
        // Clear any existing parent highlight first
        this.clearParentContainerHighlight();
        
        // Store reference to highlighted parent container
        this.highlightedParentContainer = container;
        
        // Find the container's item in the hierarchy and add visual highlight
        const containerItems = this.treeContainer.querySelectorAll('.hierarchy-item');
        containerItems.forEach(item => {
            if (item.dataset.objectId === String(container.userData.id)) {
                item.classList.add('parent-container-highlight');
                console.log('HIERARCHY: Highlighted parent container:', container.userData.id);
            }
        });
    }

    clearParentContainerHighlight() {
        if (this.highlightedParentContainer) {
            const containerItems = this.treeContainer.querySelectorAll('.hierarchy-item');
            containerItems.forEach(item => {
                item.classList.remove('parent-container-highlight');
            });
            this.highlightedParentContainer = null;
            console.log('HIERARCHY: Cleared parent container highlight');
        }
    }

    updateParentHighlightingForDragTarget(targetObjectId) {
        if (!this.draggedItem) return;
        
        const draggedObject = this.findObjectById(this.draggedItem.dataset.objectId);
        const targetObject = this.findObjectById(targetObjectId);
        
        if (!draggedObject) return;
        
        // Only highlight parent if we're still working within the same group
        // or if the target is within the same parent container
        let shouldHighlightParent = false;
        
        if (draggedObject.userData.parentContainer) {
            // If target object is in the same container as dragged object, keep highlighting
            if (targetObject && targetObject.userData.parentContainer === draggedObject.userData.parentContainer) {
                shouldHighlightParent = true;
            }
            // If target object is the parent container itself, keep highlighting  
            else if (targetObject === draggedObject.userData.parentContainer) {
                shouldHighlightParent = true;
            }
        }
        
        if (shouldHighlightParent && !this.highlightedParentContainer) {
            // Add highlighting
            this.highlightParentContainer(draggedObject.userData.parentContainer);
        } else if (!shouldHighlightParent && this.highlightedParentContainer) {
            // Clear highlighting
            this.clearParentContainerHighlight();
        }
    }
    
    reorderObjects(draggedObject, targetObject, position) {
        console.log(`HIERARCHY: Reordering ${draggedObject.userData.id} ${position} ${targetObject.userData.id}`);
        
        const draggedParent = draggedObject.userData.parentContainer;
        const targetParent = targetObject.userData.parentContainer;
        
        console.log(`HIERARCHY: Dragged parent: ${draggedParent ? draggedParent.userData.id : 'ROOT'}`);
        console.log(`HIERARCHY: Target parent: ${targetParent ? targetParent.userData.id : 'ROOT'}`);
        
        // Remove dragged object from current parent
        if (draggedParent) {
            console.log(`HIERARCHY: Removing ${draggedObject.userData.id} from container ${draggedParent.userData.id}`);
            draggedParent.removeChild(draggedObject);
        }
        
        // Determine final placement based on target
        if (targetParent) {
            // Target is inside a container
            if (draggedParent === targetParent) {
                // Both objects are in the same container - this is true reordering within container
                console.log(`HIERARCHY: Reordering within container ${targetParent.userData.id}`);
                // For now, just add back to container (proper ordering would require more complex logic)
                targetParent.addChild(draggedObject);
            } else {
                // Target is in a different container - move dragged object to same container as target
                console.log(`HIERARCHY: Moving ${draggedObject.userData.id} to same container as target: ${targetParent.userData.id}`);
                targetParent.addChild(draggedObject);
            }
        } else {
            // Target is at root level - move dragged object to root level
            console.log(`HIERARCHY: Moving ${draggedObject.userData.id} to root level`);
            
            // Ensure parent container reference is cleared
            delete draggedObject.userData.parentContainer;
            
            this.sceneManager.addObject(draggedObject);
        }
    }
    
    moveObjectToContainer(object, targetContainer) {
        if (!targetContainer.isContainer) {
            console.log('Cannot move object to non-container');
            return;
        }
        
        if (object === targetContainer) {
            console.log('Cannot move object to itself');
            return;
        }
        
        // Prevent circular references
        if (this.wouldCreateCircularReference(object, targetContainer)) {
            console.log('Cannot move container inside itself or its descendants');
            return;
        }
        
        console.log(`HIERARCHY: Moving object ${object.userData.id} into container ${targetContainer.userData.id}`);
        
        // Remove from current parent (this is critical to prevent duplicates)
        if (object.userData.parentContainer) {
            object.userData.parentContainer.removeChild(object);
        } else if (object.parent) {
            // Remove from any Three.js parent (including scene)
            object.parent.remove(object);
        }
        
        // Add to new container
        targetContainer.addChild(object);
        
        // Ensure container is expanded to show the new child
        this.expandedItems.add(targetContainer.userData.id);
        this.updateExpandedState();
    }
    
    moveObjectToRoot(object) {
        // Remove from current parent
        if (object.userData.parentContainer) {
            console.log(`HIERARCHY: Removing ${object.userData.id} from parent container ${object.userData.parentContainer.userData.id}`);
            object.userData.parentContainer.removeChild(object);
        }
        
        // Ensure parent container reference is cleared
        delete object.userData.parentContainer;
        
        // Add to scene at root level
        this.sceneManager.addObject(object);
        
        console.log(`HIERARCHY: Moved ${object.userData.id} to root level`);
    }
    
    
    wouldCreateCircularReference(object, targetContainer) {
        if (!object.isContainer) return false;
        
        // Check if targetContainer is a descendant of object
        let currentContainer = targetContainer;
        while (currentContainer && currentContainer.userData.parentContainer) {
            if (currentContainer.userData.parentContainer === object) {
                return true;
            }
            currentContainer = currentContainer.userData.parentContainer;
        }
        
        return false;
    }
    
    // Utility Methods
    findObjectById(id) {
        console.log(`HIERARCHY: Searching for object with id: ${id} (type: ${typeof id})`);
        let foundObject = null;
        
        this.sceneManager.scene.traverse((child) => {
            if (child.userData && child.userData.id !== undefined) {
                // Convert both to strings for comparison
                const childId = String(child.userData.id);
                const searchId = String(id);
                
                if (childId === searchId) {
                    // Skip container-proxy objects - we want the actual container/object
                    if (child.userData.isContainerProxy || child.userData.type === 'container-proxy') {
                        console.log(`HIERARCHY: Skipping container-proxy for id ${id}`);
                        return;
                    }
                    
                    console.log(`HIERARCHY: Found object ${id}:`, child.userData.type, 'isContainer:', child.isContainer);
                    foundObject = child;
                }
            }
        });
        
        if (!foundObject) {
            console.warn(`HIERARCHY: Object with id ${id} not found in scene`);
            // List all objects for debugging
            console.log('HIERARCHY: Available objects in scene:');
            this.sceneManager.scene.traverse((child) => {
                if (child.userData && child.userData.id !== undefined) {
                    console.log(`  - ${child.userData.id} (${typeof child.userData.id}) (${child.userData.type})`);
                }
            });
        }
        
        return foundObject;
    }
    
    updateSelection() {
        // Update visual selection state in tree
        const selectedObjects = this.selectionManager.getSelectedObjects();
        console.log('HIERARCHY: Updating selection for objects:', selectedObjects.map(o => o.userData.id));
        
        // Use internal reference instead of DOM queries for better reliability
        if (!this.treeContainer) {
            console.warn('HIERARCHY: No tree container available');
            return;
        }
        
        const allItems = this.treeContainer.querySelectorAll('.hierarchy-item[data-object-id]');
        console.log('HIERARCHY: Found', allItems.length, 'items in tree');
        console.log('HIERARCHY: Available item IDs:', Array.from(allItems).map(i => i.dataset.objectId));
        
        // Clear all selected items using internal reference
        const previouslySelected = this.treeContainer.querySelectorAll('.hierarchy-item.selected');
        console.log('HIERARCHY: Clearing', previouslySelected.length, 'previously selected items');
        previouslySelected.forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to current items
        selectedObjects.forEach(object => {
            const selector = `.hierarchy-item[data-object-id="${object.userData.id}"]`;
            console.log('HIERARCHY: Looking for item with selector:', selector);
            const item = this.treeContainer.querySelector(selector);
            if (item) {
                item.classList.add('selected');
                console.log('HIERARCHY: Successfully marked item as selected:', object.userData.id);
            } else {
                console.warn('HIERARCHY: Could not find item for object:', object.userData.id);
            }
        });
    }
    
    // Public API
    refresh() {
        this.buildTree();
    }
    
    expandContainer(objectId) {
        this.expandedItems.add(objectId);
        this.updateExpandedState();
        this.buildTree();
    }
    
    collapseContainer(objectId) {
        this.expandedItems.delete(objectId);
        this.updateExpandedState();
        this.buildTree();
    }
    
    selectObjectInTree(objectId) {
        const object = this.findObjectById(objectId);
        if (object) {
            this.selectionManager.selectOnly(object);
        }
    }
    
    // Scene Event Handlers
    onObjectAdded(object) {
        this.buildTree();
    }
    
    onObjectRemoved(object) {
        // Clean up expanded state
        this.expandedItems.delete(object.userData.id);
        this.updateExpandedState();
        this.buildTree();
    }
    
    onObjectChanged(object) {
        // Update tree if object properties changed
        this.buildTree();
    }
    
    // MANDATORY ARCHITECTURE PATTERN: Centralized UI sync handlers
    handleSceneChange(changeType, data) {
        switch (changeType) {
            case 'object_added':
                this.onObjectAdded(data.object);
                break;
            case 'object_removed':
                this.onObjectRemoved(data.object);
                break;
            case 'object_modified':
                this.onObjectChanged(data.object);
                break;
            case 'container_changed':
            case 'hierarchy_changed':
                this.buildTree(); // Full refresh for structural changes
                break;
        }
    }
    
    handleSelectionChange(changeType, data) {
        switch (changeType) {
            case 'selection_changed':
            case 'selection_cleared':
            case 'selection_added':
            case 'selection_removed':
                this.updateSelectionVisuals(data.selectedObjects || []);
                break;
        }
    }
    
    updateSelectionVisuals(selectedObjects) {
        // Update visual selection state in hierarchy
        const items = this.panel.querySelectorAll('.item');
        items.forEach(item => {
            const objectId = item.dataset.objectId;
            const isSelected = selectedObjects.some(obj => obj.userData.id === objectId);
            item.classList.toggle('selected', isSelected);
        });
    }
    
    dispose() {
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        
        this.expandedItems.clear();
        this.draggedItem = null;
        this.dropTarget = null;
    }
}

// Export for module use
window.HierarchyPanel = HierarchyPanel;