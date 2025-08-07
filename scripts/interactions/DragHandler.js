/**
 * DragHandler - Drag and drop functionality
 * 
 * Handles drag and drop interactions for image containers with collision detection,
 * boundary constraints, and smooth visual feedback.
 */
export class DragHandler {
    constructor(eventBus, imageManager) {
        this.eventBus = eventBus;
        this.imageManager = imageManager;
        this.debugMode = false;

        // Drag state
        this.isDragging = false;
        this.currentContainer = null;
        this.startPosition = { x: 0, y: 0 };
        this.initialPosition = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };

        // Configuration
        this.config = {
            minSpacing: 20,
            snapToGrid: false,
            gridSize: 10,
            boundaryPadding: 10,
            animationDuration: 200
        };

        this.setupEventListeners();
    }

    /**
     * Attach drag functionality to a container
     * @param {HTMLElement} container - Container element
     * @param {number} index - Container index
     */
    attachTo(container, index) {
        if (!container) {
            console.error('DragHandler: Invalid container');
            return;
        }

        // Store reference
        container.setAttribute('data-drag-index', index);

        // Add mouse event listeners
        container.addEventListener('mousedown', this.handleMouseDown.bind(this));

        // Add touch event listeners for mobile
        container.addEventListener('touchstart', this.handleTouchStart.bind(this));

        // Set cursor
        container.style.cursor = 'move';

        if (this.debugMode) {
            console.log('DragHandler: Attached to container', { index });
        }
    }

    /**
     * Detach drag functionality from a container
     * @param {HTMLElement} container - Container element
     */
    detach(container) {
        if (!container) return;

        container.removeEventListener('mousedown', this.handleMouseDown);
        container.removeEventListener('touchstart', this.handleTouchStart);
        container.style.cursor = '';
        container.removeAttribute('data-drag-index');

        if (this.debugMode) {
            console.log('DragHandler: Detached from container');
        }
    }

    /**
     * Handle mouse down event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown(event) {
        // Don't start drag if clicking on resize handle
        if (event.target.classList.contains('resize-handle')) {
            return;
        }

        event.preventDefault();
        this.startDrag(event.currentTarget, event.clientX, event.clientY);
    }

    /**
     * Handle touch start event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchStart(event) {
        // Don't start drag if touching resize handle
        if (event.target.classList.contains('resize-handle')) {
            return;
        }

        event.preventDefault();
        const touch = event.touches[0];
        this.startDrag(event.currentTarget, touch.clientX, touch.clientY);
    }

    /**
     * Start drag operation
     * @param {HTMLElement} container - Container being dragged
     * @param {number} clientX - Initial X coordinate
     * @param {number} clientY - Initial Y coordinate
     */
    startDrag(container, clientX, clientY) {
        if (this.isDragging) return;

        this.isDragging = true;
        this.currentContainer = container;

        // Get initial position
        const rect = container.getBoundingClientRect();
        const containerRect = document.getElementById('container').getBoundingClientRect();
        
        this.initialPosition = {
            x: parseInt(container.style.left) || 0,
            y: parseInt(container.style.top) || 0
        };

        this.startPosition = { x: clientX, y: clientY };

        // Calculate drag offset (where user clicked relative to container)
        this.dragOffset = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };

        // Set high z-index for dragging
        container.style.zIndex = '1000';

        // Emit drag start event
        const index = parseInt(container.getAttribute('data-drag-index'));
        this.eventBus.emit('drag:start', {
            index,
            container,
            position: this.initialPosition
        });

        if (this.debugMode) {
            console.log('DragHandler: Drag started', { 
                index, 
                initialPosition: this.initialPosition 
            });
        }
    }

    /**
     * Handle mouse move during drag
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        if (!this.isDragging) return;

        event.preventDefault();
        this.updateDragPosition(event.clientX, event.clientY);
    }

    /**
     * Handle touch move during drag
     * @param {TouchEvent} event - Touch event
     */
    handleTouchMove(event) {
        if (!this.isDragging) return;

        event.preventDefault();
        const touch = event.touches[0];
        this.updateDragPosition(touch.clientX, touch.clientY);
    }

    /**
     * Update position during drag
     * @param {number} clientX - Current X coordinate
     * @param {number} clientY - Current Y coordinate
     */
    updateDragPosition(clientX, clientY) {
        if (!this.currentContainer) return;

        // Calculate new position
        const deltaX = clientX - this.startPosition.x;
        const deltaY = clientY - this.startPosition.y;

        let newX = this.initialPosition.x + deltaX;
        let newY = this.initialPosition.y + deltaY;

        // Apply boundary constraints
        const constrainedPosition = this.applyBoundaryConstraints(newX, newY);
        newX = constrainedPosition.x;
        newY = constrainedPosition.y;

        // Apply grid snapping if enabled
        if (this.config.snapToGrid) {
            newX = Math.round(newX / this.config.gridSize) * this.config.gridSize;
            newY = Math.round(newY / this.config.gridSize) * this.config.gridSize;
        }

        // Check for overlaps and provide visual feedback
        const index = parseInt(this.currentContainer.getAttribute('data-drag-index'));
        const wouldOverlap = this.checkOverlap(newX, newY, index);

        if (wouldOverlap) {
            this.currentContainer.classList.add('overlap-warning');
        } else {
            this.currentContainer.classList.remove('overlap-warning');
        }

        // Update position
        this.currentContainer.style.left = newX + 'px';
        this.currentContainer.style.top = newY + 'px';

        // Emit drag move event
        this.eventBus.emit('drag:move', {
            index,
            position: { x: newX, y: newY },
            wouldOverlap
        });
    }

    /**
     * Handle mouse up to end drag
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseUp(event) {
        if (!this.isDragging) return;
        this.endDrag();
    }

    /**
     * Handle touch end to end drag
     * @param {TouchEvent} event - Touch event
     */
    handleTouchEnd(event) {
        if (!this.isDragging) return;
        this.endDrag();
    }

    /**
     * End drag operation
     */
    endDrag() {
        if (!this.isDragging || !this.currentContainer) return;

        const index = parseInt(this.currentContainer.getAttribute('data-drag-index'));
        const finalPosition = {
            x: parseInt(this.currentContainer.style.left),
            y: parseInt(this.currentContainer.style.top)
        };

        // Check final overlap
        const wouldOverlap = this.checkOverlap(finalPosition.x, finalPosition.y, index);

        if (wouldOverlap) {
            // Revert to original position
            this.currentContainer.style.left = this.initialPosition.x + 'px';
            this.currentContainer.style.top = this.initialPosition.y + 'px';
            
            // Show shake animation
            this.showShakeAnimation();
            
            // Emit drag cancelled event
            this.eventBus.emit('drag:cancelled', {
                index,
                reason: 'overlap',
                originalPosition: this.initialPosition,
                attemptedPosition: finalPosition
            });

            if (this.debugMode) {
                console.log('DragHandler: Drag cancelled due to overlap', { index });
            }
        } else {
            // Accept new position
            this.eventBus.emit('drag:end', {
                index,
                position: finalPosition,
                previousPosition: this.initialPosition
            });

            if (this.debugMode) {
                console.log('DragHandler: Drag completed', { 
                    index, 
                    finalPosition 
                });
            }
        }

        // Cleanup
        this.currentContainer.style.zIndex = 'auto';
        this.currentContainer.classList.remove('overlap-warning');
        
        this.isDragging = false;
        this.currentContainer = null;
    }

    /**
     * Apply boundary constraints to position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object} Constrained position
     */
    applyBoundaryConstraints(x, y) {
        if (!this.currentContainer) return { x, y };

        const containerRect = document.getElementById('container').getBoundingClientRect();
        const elementRect = this.currentContainer.getBoundingClientRect();

        const minX = this.config.boundaryPadding;
        const minY = this.config.boundaryPadding;
        const maxX = containerRect.width - elementRect.width - this.config.boundaryPadding;
        const maxY = Math.max(minY, y); // Allow vertical scrolling

        return {
            x: Math.max(minX, Math.min(x, maxX)),
            y: Math.max(minY, y)
        };
    }

    /**
     * Check if position would cause overlap
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} excludeIndex - Index to exclude from check
     * @returns {boolean} True if would overlap
     */
    checkOverlap(x, y, excludeIndex) {
        if (!this.imageManager) return false;

        const containerRect = this.currentContainer.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;

        return this.imageManager.wouldOverlap(x, y, width, height, excludeIndex);
    }

    /**
     * Show shake animation for invalid drop
     */
    showShakeAnimation() {
        if (!this.currentContainer) return;

        this.currentContainer.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            if (this.currentContainer) {
                this.currentContainer.style.animation = '';
            }
        }, 500);
    }

    /**
     * Set up global event listeners
     */
    setupEventListeners() {
        // Mouse events
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Touch events
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Prevent context menu during drag
        document.addEventListener('contextmenu', (event) => {
            if (this.isDragging) {
                event.preventDefault();
            }
        });
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.debugMode) {
            console.log('DragHandler: Configuration updated', this.config);
        }
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Check if currently dragging
     * @returns {boolean} True if dragging
     */
    isDragActive() {
        return this.isDragging;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`DragHandler: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}
