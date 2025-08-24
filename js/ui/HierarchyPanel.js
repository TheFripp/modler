/**
 * Hierarchy Panel - Tree view for organizing and managing scene objects
 */
class HierarchyPanel {
    constructor(sceneManager, selectionManager, stateManager = null, objectManager = null, materialManager = null) {
        this.sceneManager = sceneManager;
        this.selectionManager = selectionManager;
        this.stateManager = stateManager;
        this.objectManager = objectManager;
        this.materialManager = materialManager;
        
        // Panel state - use centralized state if available
        if (this.stateManager) {
            // Subscribe to state changes
            this.stateManager.subscribe('hierarchy.expanded', (expanded) => {
                this.expandedItems = expanded;
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
            
            // Use centralized expanded state
            this.expandedItems = this.stateManager.get('hierarchy.expanded') || new Set();
        } else {
            // Fallback to local state
            this.expandedItems = new Set();
        }
        
        this.draggedItem = null;
        this.dropTarget = null;
        this.dropPosition = null; // 'before', 'after', 'inside'
        
        // Create panel DOM structure
        this.createPanel();
        this.setupEventListeners();
        
        // Update on selection changes
        this.selectionManager.onSelectionChanged = () => this.updateSelection();
        
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
        console.log('HIERARCHY: Building tree...');
        this.treeContainer.innerHTML = '';
        
        // Get all root-level objects (objects without containers as parents)
        const rootObjects = this.getRootObjects();
        console.log('HIERARCHY: Root objects for tree:', rootObjects.map(o => `${o.userData.id}(${o.isContainer ? 'container' : 'object'})`));
        
        rootObjects.forEach(object => {
            this.addObjectAndChildrenToTree(object, 0);
        });
        
        if (rootObjects.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'hierarchy-empty';
            emptyMessage.textContent = 'No objects in scene';
            this.treeContainer.appendChild(emptyMessage);
        }
        
        console.log('HIERARCHY: Tree building complete');
        
        // Update selection highlighting after rebuilding tree
        this.updateSelection();
    }
    
    addObjectAndChildrenToTree(object, depth) {
        console.log(`HIERARCHY: Adding object ${object.userData.id} at depth ${depth}, isContainer: ${object.isContainer}`);
        
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
        // Use centralized ObjectManager if available
        if (this.objectManager && this.stateManager) {
            const rootObjectIds = this.stateManager.get('hierarchy.rootObjects') || new Set();
            const layerOrder = this.stateManager.get('hierarchy.layerOrder') || [];
            
            // Get objects in layer order
            const rootObjects = [];
            layerOrder.forEach(id => {
                if (rootObjectIds.has(id)) {
                    const object = this.objectManager.getObject(id);
                    if (object) {
                        rootObjects.push(object);
                    }
                }
            });
            
            console.log('HIERARCHY: Using centralized object management, found', rootObjects.length, 'root objects');
            return rootObjects;
        }
        
        // Fallback to legacy scene traversal
        const rootObjects = [];
        
        console.log('HIERARCHY: Getting root objects from scene. Scene children count:', this.sceneManager.scene.children.length);
        
        // Get direct children of the scene that are selectable
        this.sceneManager.scene.children.forEach((child) => {
            console.log(`HIERARCHY: Checking scene child:`, child.userData ? child.userData.id : 'no-id', 'type:', child.type, 'isContainer:', child.isContainer);
            
            // Skip camera, lights, helpers, grids, floor
            if (child.isCamera || child.isLight || 
                child.userData?.isHelper || child.userData?.isGrid || 
                child.userData?.isAxes || child.userData?.isFloor) {
                console.log(`HIERARCHY: Skipping system object:`, child.userData?.id || child.type);
                return;
            }
            
            // Include selectable objects and containers, but exclude container proxies
            if (child.userData && child.userData.selectable && !child.userData.isContainerProxy) {
                console.log(`HIERARCHY: Adding root object:`, child.userData.id, 'isContainer:', child.isContainer);
                rootObjects.push(child);
            }
        });
        
        console.log('HIERARCHY: Found', rootObjects.length, 'root objects');
        
        // Don't sort root objects - maintain creation/user-defined order for drag-and-drop reordering
        return rootObjects;
        
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
        const selectedObjects = this.selectionManager.getSelectedObjects();
        
        // Create new container using centralized systems
        const container = new Container(
            `Group ${Date.now()}`,
            this.objectManager,
            this.materialManager,
            this.sceneManager
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
        
        console.log('HIERARCHY: Rebuilding tree after drop');
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
        
        // Remove from current parent
        if (object.userData.parentContainer) {
            object.userData.parentContainer.removeChild(object);
        } else {
            // Remove from scene if it was a root object
            this.sceneManager.scene.remove(object);
        }
        
        // Add to new container
        targetContainer.addChild(object);
        
        console.log(`Moved ${object.userData.id} to container ${targetContainer.userData.id}`);
    }
    
    moveObjectToRoot(object) {
        // Remove from current parent
        if (object.userData.parentContainer) {
            object.userData.parentContainer.removeChild(object);
            this.sceneManager.addObject(object);
        }
        
        console.log(`Moved ${object.userData.id} to root level`);
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
        
        // Clear all selected items
        const previouslySelected = document.querySelectorAll('.hierarchy-item.selected');
        console.log('HIERARCHY: Clearing', previouslySelected.length, 'previously selected items');
        previouslySelected.forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to current items
        selectedObjects.forEach(object => {
            const item = document.querySelector(`[data-object-id="${object.userData.id}"]`);
            if (item) {
                item.classList.add('selected');
                console.log('HIERARCHY: Marked item as selected:', object.userData.id);
            } else {
                console.warn('HIERARCHY: Could not find item for object:', object.userData.id);
                // Debug: list all available items
                const allItems = document.querySelectorAll('.hierarchy-item[data-object-id]');
                console.log('HIERARCHY: Available items:', Array.from(allItems).map(i => i.dataset.objectId));
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