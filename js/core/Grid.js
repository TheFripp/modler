class Grid {
    constructor(scene) {
        this.scene = scene;
        this.gridSize = 100;
        this.gridDivisions = 100;
        this.gridSpacing = 1;
        this.snapDistance = 0.5;
        this.visible = true;
        
        this.gridHelper = null;
        this.axesHelper = null;
        
        this.init();
    }

    init() {
        this.createGrid();
        this.createAxes();
    }

    createGrid() {
        this.gridHelper = new THREE.GridHelper(
            this.gridSize, 
            this.gridDivisions, 
            0x444444, 
            0x333333
        );
        this.gridHelper.name = 'grid';
        this.gridHelper.userData = { isGrid: true, selectable: false };
        this.scene.add(this.gridHelper);

        const subGrid = new THREE.GridHelper(
            this.gridSize, 
            this.gridDivisions * 10, 
            0x222222, 
            0x222222
        );
        subGrid.name = 'subgrid';
        subGrid.userData = { isGrid: true, selectable: false };
        this.scene.add(subGrid);
    }

    createAxes() {
        this.axesHelper = new THREE.AxesHelper(5);
        this.axesHelper.name = 'axes';
        this.axesHelper.userData = { isAxes: true, selectable: false };
        this.scene.add(this.axesHelper);
    }

    snapToGrid(position) {
        if (!position) return null;
        
        const snapped = position.clone();
        snapped.x = Math.round(snapped.x / this.gridSpacing) * this.gridSpacing;
        snapped.z = Math.round(snapped.z / this.gridSpacing) * this.gridSpacing;
        snapped.y = Math.round(snapped.y / this.gridSpacing) * this.gridSpacing;
        
        return snapped;
    }

    isNearGrid(position, threshold = null) {
        if (!position) return false;
        
        const snapThreshold = threshold || this.snapDistance;
        const snapped = this.snapToGrid(position);
        
        return position.distanceTo(snapped) <= snapThreshold;
    }

    setVisible(visible) {
        this.visible = visible;
        if (this.gridHelper) {
            this.gridHelper.visible = visible;
        }
        if (this.axesHelper) {
            this.axesHelper.visible = visible;
        }
        
        const subGrid = this.scene.getObjectByName('subgrid');
        if (subGrid) {
            subGrid.visible = visible;
        }
    }

    setSpacing(spacing) {
        this.gridSpacing = spacing;
        this.gridDivisions = Math.max(10, this.gridSize / spacing);
        
        this.scene.remove(this.gridHelper);
        const subGrid = this.scene.getObjectByName('subgrid');
        if (subGrid) {
            this.scene.remove(subGrid);
        }
        
        this.createGrid();
    }

    setSize(size) {
        this.gridSize = size;
        this.gridDivisions = Math.max(10, size / this.gridSpacing);
        
        this.scene.remove(this.gridHelper);
        const subGrid = this.scene.getObjectByName('subgrid');
        if (subGrid) {
            this.scene.remove(subGrid);
        }
        
        this.createGrid();
    }

    getClosestGridPoint(position) {
        return this.snapToGrid(position);
    }

    dispose() {
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
        }
        if (this.axesHelper) {
            this.scene.remove(this.axesHelper);
        }
        
        const subGrid = this.scene.getObjectByName('subgrid');
        if (subGrid) {
            this.scene.remove(subGrid);
        }
    }
}

// Export for module use
window.Grid = Grid;