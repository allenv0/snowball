/**
 * ImageContainer - Wrapper for individual images with interaction capabilities
 * 
 * Creates a container for each image with drag-and-drop and resize functionality,
 * handles GIF indicators, loading states, and error handling.
 */
export class ImageContainer {
    constructor(filename, metadata, index, eventBus) {
        this.filename = filename;
        this.metadata = metadata;
        this.index = index;
        this.eventBus = eventBus;
        
        this.element = null;
        this.imageElement = null;
        this.resizeHandle = null;
        this.gifIndicator = null;
        
        this.isLoaded = false;
        this.hasError = false;
        this.debugMode = false;

        // Current state
        this.position = [0, 0];
        this.size = [metadata.width, metadata.height];
        this.isGif = this.checkIfGif(filename);
    }

    /**
     * Create and render the image container
     * @returns {HTMLElement} The created container element
     */
    render() {
        if (this.element) {
            console.warn('ImageContainer: Already rendered');
            return this.element;
        }

        // Create container
        this.element = document.createElement('div');
        this.element.className = 'resizable-container';
        this.element.style.position = 'absolute';
        this.element.style.width = this.size[0] + 'px';
        this.element.style.height = this.size[1] + 'px';
        this.element.setAttribute('data-filename', this.filename);
        this.element.setAttribute('data-index', this.index);

        // Create image element
        this.imageElement = document.createElement('img');
        this.imageElement.src = this.filename;
        this.imageElement.width = this.size[0];
        this.imageElement.height = this.size[1];
        this.imageElement.style.width = this.size[0] + 'px';
        this.imageElement.style.height = this.size[1] + 'px';
        this.imageElement.style.position = 'relative';
        this.imageElement.style.userSelect = 'none';
        this.imageElement.style.borderRadius = '12px';
        this.imageElement.style.display = 'block';
        this.imageElement.alt = `Image: ${this.filename}`;

        // Set loading strategy
        if (this.isGif) {
            this.imageElement.loading = 'eager';
        } else {
            this.imageElement.loading = 'lazy';
        }

        // Add image event handlers
        this.imageElement.addEventListener('load', this.handleImageLoad.bind(this));
        this.imageElement.addEventListener('error', this.handleImageError.bind(this));

        // Add image to container
        this.element.appendChild(this.imageElement);

        // Create resize handle
        this.createResizeHandle();

        // Add GIF indicator if needed
        if (this.isGif) {
            this.createGifIndicator();
        }

        // Add fade-in animation
        this.element.classList.add('fade-in');

        if (this.debugMode) {
            console.log('ImageContainer: Rendered', { filename: this.filename, index: this.index });
        }

        return this.element;
    }

    /**
     * Set position of the container
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    setPosition(x, y) {
        if (!this.element) return;

        this.position = [x, y];
        this.element.style.left = x + 'px';
        this.element.style.top = y + 'px';

        if (this.debugMode) {
            console.log(`ImageContainer: Position set to [${x}, ${y}]`, this.filename);
        }
    }

    /**
     * Set size of the container and image
     * @param {number} width - Width in pixels
     * @param {number} height - Height in pixels
     */
    setSize(width, height) {
        if (!this.element || !this.imageElement) return;

        this.size = [width, height];
        
        // Update container
        this.element.style.width = width + 'px';
        this.element.style.height = height + 'px';
        
        // Update image
        this.imageElement.width = width;
        this.imageElement.height = height;
        this.imageElement.style.width = width + 'px';
        this.imageElement.style.height = height + 'px';

        if (this.debugMode) {
            console.log(`ImageContainer: Size set to [${width}, ${height}]`, this.filename);
        }
    }

    /**
     * Get current position
     * @returns {number[]} Current position [x, y]
     */
    getPosition() {
        return [...this.position];
    }

    /**
     * Get current size
     * @returns {number[]} Current size [width, height]
     */
    getSize() {
        return [...this.size];
    }

    /**
     * Get bounding box
     * @returns {Object} Bounding box with left, top, right, bottom
     */
    getBoundingBox() {
        const [x, y] = this.position;
        const [width, height] = this.size;
        
        return {
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
            width,
            height
        };
    }

    /**
     * Create resize handle
     */
    createResizeHandle() {
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'resize-handle';
        this.resizeHandle.setAttribute('aria-label', 'Resize image');
        this.element.appendChild(this.resizeHandle);
    }

    /**
     * Create GIF indicator
     */
    createGifIndicator() {
        this.gifIndicator = document.createElement('div');
        this.gifIndicator.className = 'gif-indicator';
        this.gifIndicator.textContent = 'GIF';
        this.gifIndicator.setAttribute('aria-label', 'Animated GIF');
        this.element.appendChild(this.gifIndicator);
    }

    /**
     * Check if filename is a GIF
     * @param {string} filename - Filename to check
     * @returns {boolean} True if GIF
     */
    checkIfGif(filename) {
        return filename.toLowerCase().endsWith('.gif');
    }

    /**
     * Handle image load event
     */
    handleImageLoad() {
        this.isLoaded = true;
        this.hasError = false;
        this.element.classList.remove('loading', 'error');

        this.eventBus.emit('image:loaded', {
            filename: this.filename,
            index: this.index,
            naturalWidth: this.imageElement.naturalWidth,
            naturalHeight: this.imageElement.naturalHeight
        });

        if (this.debugMode) {
            console.log('ImageContainer: Image loaded', this.filename);
        }
    }

    /**
     * Handle image error event
     */
    handleImageError() {
        this.hasError = true;
        this.isLoaded = false;
        this.element.classList.add('error');
        this.element.classList.remove('loading');

        console.warn(`ImageContainer: Failed to load image: ${this.filename}`);

        this.eventBus.emit('image:error', {
            filename: this.filename,
            index: this.index,
            error: 'Failed to load image'
        });
    }

    /**
     * Set loading state
     * @param {boolean} loading - Whether image is loading
     */
    setLoadingState(loading) {
        if (!this.element) return;

        if (loading) {
            this.element.classList.add('loading');
        } else {
            this.element.classList.remove('loading');
        }
    }

    /**
     * Set overlap warning state
     * @param {boolean} overlapping - Whether container is overlapping
     */
    setOverlapWarning(overlapping) {
        if (!this.element) return;

        if (overlapping) {
            this.element.classList.add('overlap-warning');
        } else {
            this.element.classList.remove('overlap-warning');
        }
    }

    /**
     * Set resizing state
     * @param {boolean} resizing - Whether container is being resized
     */
    setResizingState(resizing) {
        if (!this.element) return;

        if (resizing) {
            this.element.classList.add('resizing');
        } else {
            this.element.classList.remove('resizing');
        }
    }

    /**
     * Get container element
     * @returns {HTMLElement} Container element
     */
    getElement() {
        return this.element;
    }

    /**
     * Get image element
     * @returns {HTMLElement} Image element
     */
    getImageElement() {
        return this.imageElement;
    }

    /**
     * Get resize handle element
     * @returns {HTMLElement} Resize handle element
     */
    getResizeHandle() {
        return this.resizeHandle;
    }

    /**
     * Check if image is loaded
     * @returns {boolean} True if loaded
     */
    isImageLoaded() {
        return this.isLoaded;
    }

    /**
     * Check if image has error
     * @returns {boolean} True if error
     */
    hasImageError() {
        return this.hasError;
    }

    /**
     * Get metadata
     * @returns {Object} Image metadata
     */
    getMetadata() {
        return { ...this.metadata };
    }

    /**
     * Get filename
     * @returns {string} Image filename
     */
    getFilename() {
        return this.filename;
    }

    /**
     * Get index
     * @returns {number} Container index
     */
    getIndex() {
        return this.index;
    }

    /**
     * Check if image is GIF
     * @returns {boolean} True if GIF
     */
    isGifImage() {
        return this.isGif;
    }

    /**
     * Cleanup and remove container
     */
    destroy() {
        // Remove event listeners
        if (this.imageElement) {
            this.imageElement.removeEventListener('load', this.handleImageLoad);
            this.imageElement.removeEventListener('error', this.handleImageError);
        }

        // Remove from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        // Clear references
        this.element = null;
        this.imageElement = null;
        this.resizeHandle = null;
        this.gifIndicator = null;

        if (this.debugMode) {
            console.log('ImageContainer: Destroyed', this.filename);
        }
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`ImageContainer: Debug mode ${enabled ? 'enabled' : 'disabled'} for ${this.filename}`);
    }
}
