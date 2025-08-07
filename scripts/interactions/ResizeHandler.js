/**
 * ResizeHandler - Image resizing with aspect ratio preservation
 * 
 * Handles resize interactions for image containers with aspect ratio preservation,
 * minimum size constraints, and smooth visual feedback.
 */
export class ResizeHandler {
    constructor(eventBus, imageManager) {
        this.eventBus = eventBus;
        this.imageManager = imageManager;
        this.debugMode = false;

        // Resize state
        this.isResizing = false;
        this.currentContainer = null;
        this.currentHandle = null;
        this.startPosition = { x: 0, y: 0 };
        this.initialSize = { width: 0, height: 0 };
        this.aspectRatio = 1;

        // Configuration
        this.config = {
            minSize: 50,
            maxSize: 2000,
            preserveAspectRatio: true,
            snapToGrid: false,
            gridSize: 10,
            resizeThreshold: 5 // Minimum movement to start resize
        };

        this.setupEventListeners();
    }

    /**
     * Attach resize functionality to a container
     * @param {HTMLElement} container - Container element
     * @param {number} index - Container index
     */
    attachTo(container, index) {
        if (!container) {
            console.error('ResizeHandler: Invalid container');
            return;
        }

        const resizeHandle = container.querySelector('.resize-handle');
        if (!resizeHandle) {
            console.error('ResizeHandler: No resize handle found');
            return;
        }

        // Store reference
        container.setAttribute('data-resize-index', index);

        // Add mouse event listeners to handle
        resizeHandle.addEventListener('mousedown', this.handleMouseDown.bind(this));

        // Add touch event listeners for mobile
        resizeHandle.addEventListener('touchstart', this.handleTouchStart.bind(this));

        if (this.debugMode) {
            console.log('ResizeHandler: Attached to container', { index });
        }
    }

    /**
     * Detach resize functionality from a container
     * @param {HTMLElement} container - Container element
     */
    detach(container) {
        if (!container) return;

        const resizeHandle = container.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.removeEventListener('mousedown', this.handleMouseDown);
            resizeHandle.removeEventListener('touchstart', this.handleTouchStart);
        }

        container.removeAttribute('data-resize-index');

        if (this.debugMode) {
            console.log('ResizeHandler: Detached from container');
        }
    }

    /**
     * Handle mouse down event on resize handle
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown(event) {
        event.preventDefault();
        event.stopPropagation(); // Prevent drag from starting

        const container = event.target.closest('.resizable-container');
        this.startResize(container, event.clientX, event.clientY);
    }

    /**
     * Handle touch start event on resize handle
     * @param {TouchEvent} event - Touch event
     */
    handleTouchStart(event) {
        event.preventDefault();
        event.stopPropagation(); // Prevent drag from starting

        const touch = event.touches[0];
        const container = event.target.closest('.resizable-container');
        this.startResize(container, touch.clientX, touch.clientY);
    }

    /**
     * Start resize operation
     * @param {HTMLElement} container - Container being resized
     * @param {number} clientX - Initial X coordinate
     * @param {number} clientY - Initial Y coordinate
     */
    startResize(container, clientX, clientY) {
        if (this.isResizing || !container) return;

        this.isResizing = true;
        this.currentContainer = container;
        this.currentHandle = container.querySelector('.resize-handle');

        // Get initial size
        const imageElement = container.querySelector('img');
        if (!imageElement) {
            console.error('ResizeHandler: No image element found');
            this.isResizing = false;
            return;
        }

        this.initialSize = {
            width: imageElement.width,
            height: imageElement.height
        };

        this.startPosition = { x: clientX, y: clientY };

        // Calculate aspect ratio
        this.aspectRatio = this.initialSize.width / this.initialSize.height;

        // Set visual state
        container.classList.add('resizing');
        container.style.zIndex = '1000';

        // Emit resize start event
        const index = parseInt(container.getAttribute('data-resize-index'));
        this.eventBus.emit('resize:start', {
            index,
            container,
            initialSize: this.initialSize,
            aspectRatio: this.aspectRatio
        });

        if (this.debugMode) {
            console.log('ResizeHandler: Resize started', { 
                index, 
                initialSize: this.initialSize,
                aspectRatio: this.aspectRatio
            });
        }
    }

    /**
     * Handle mouse move during resize
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        if (!this.isResizing) return;

        event.preventDefault();
        this.updateResizeSize(event.clientX, event.clientY);
    }

    /**
     * Handle touch move during resize
     * @param {TouchEvent} event - Touch event
     */
    handleTouchMove(event) {
        if (!this.isResizing) return;

        event.preventDefault();
        const touch = event.touches[0];
        this.updateResizeSize(touch.clientX, touch.clientY);
    }

    /**
     * Update size during resize
     * @param {number} clientX - Current X coordinate
     * @param {number} clientY - Current Y coordinate
     */
    updateResizeSize(clientX, clientY) {
        if (!this.currentContainer) return;

        // Calculate delta
        const deltaX = clientX - this.startPosition.x;
        const deltaY = clientY - this.startPosition.y;

        // Calculate new dimensions
        let newWidth = this.initialSize.width + deltaX;
        let newHeight;

        if (this.config.preserveAspectRatio) {
            // Maintain aspect ratio
            newHeight = newWidth / this.aspectRatio;
        } else {
            newHeight = this.initialSize.height + deltaY;
        }

        // Apply size constraints
        const constrainedSize = this.applySizeConstraints(newWidth, newHeight);
        newWidth = constrainedSize.width;
        newHeight = constrainedSize.height;

        // Apply grid snapping if enabled
        if (this.config.snapToGrid) {
            newWidth = Math.round(newWidth / this.config.gridSize) * this.config.gridSize;
            if (this.config.preserveAspectRatio) {
                newHeight = newWidth / this.aspectRatio;
            } else {
                newHeight = Math.round(newHeight / this.config.gridSize) * this.config.gridSize;
            }
        }

        // Update container and image
        this.applyNewSize(newWidth, newHeight);

        // Emit resize move event
        const index = parseInt(this.currentContainer.getAttribute('data-resize-index'));
        this.eventBus.emit('resize:move', {
            index,
            size: { width: newWidth, height: newHeight }
        });
    }

    /**
     * Apply new size to container and image
     * @param {number} width - New width
     * @param {number} height - New height
     */
    applyNewSize(width, height) {
        if (!this.currentContainer) return;

        const imageElement = this.currentContainer.querySelector('img');
        if (!imageElement) return;

        // Update container
        this.currentContainer.style.width = width + 'px';
        this.currentContainer.style.height = height + 'px';

        // Update image
        imageElement.width = width;
        imageElement.height = height;
        imageElement.style.width = width + 'px';
        imageElement.style.height = height + 'px';
    }

    /**
     * Apply size constraints
     * @param {number} width - Proposed width
     * @param {number} height - Proposed height
     * @returns {Object} Constrained size
     */
    applySizeConstraints(width, height) {
        // Apply minimum size
        width = Math.max(this.config.minSize, width);
        height = Math.max(this.config.minSize, height);

        // Apply maximum size
        width = Math.min(this.config.maxSize, width);
        height = Math.min(this.config.maxSize, height);

        // Maintain aspect ratio if enabled
        if (this.config.preserveAspectRatio) {
            // Recalculate height based on constrained width
            height = width / this.aspectRatio;
            
            // If height exceeds constraints, adjust width accordingly
            if (height > this.config.maxSize) {
                height = this.config.maxSize;
                width = height * this.aspectRatio;
            } else if (height < this.config.minSize) {
                height = this.config.minSize;
                width = height * this.aspectRatio;
            }
        }

        return { width, height };
    }

    /**
     * Handle mouse up to end resize
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseUp(event) {
        if (!this.isResizing) return;
        this.endResize();
    }

    /**
     * Handle touch end to end resize
     * @param {TouchEvent} event - Touch event
     */
    handleTouchEnd(event) {
        if (!this.isResizing) return;
        this.endResize();
    }

    /**
     * End resize operation
     */
    endResize() {
        if (!this.isResizing || !this.currentContainer) return;

        const index = parseInt(this.currentContainer.getAttribute('data-resize-index'));
        const imageElement = this.currentContainer.querySelector('img');
        
        const finalSize = {
            width: imageElement.width,
            height: imageElement.height
        };

        // Emit resize end event
        this.eventBus.emit('resize:end', {
            index,
            size: finalSize,
            previousSize: this.initialSize
        });

        // Cleanup visual state
        this.currentContainer.classList.remove('resizing');
        this.currentContainer.style.zIndex = 'auto';

        if (this.debugMode) {
            console.log('ResizeHandler: Resize completed', { 
                index, 
                finalSize 
            });
        }

        // Reset state
        this.isResizing = false;
        this.currentContainer = null;
        this.currentHandle = null;
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
    }

    /**
     * Maintain aspect ratio for given dimensions
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} originalRatio - Original aspect ratio
     * @returns {Object} Adjusted dimensions
     */
    maintainAspectRatio(width, height, originalRatio) {
        if (!this.config.preserveAspectRatio) {
            return { width, height };
        }

        // Use width as primary dimension
        const adjustedHeight = width / originalRatio;
        
        return {
            width: width,
            height: adjustedHeight
        };
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.debugMode) {
            console.log('ResizeHandler: Configuration updated', this.config);
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
     * Check if currently resizing
     * @returns {boolean} True if resizing
     */
    isResizeActive() {
        return this.isResizing;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`ResizeHandler: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}
