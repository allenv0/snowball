/**
 * ImageManager - Image handling and positioning
 * 
 * Manages image loading, positioning, metadata, and coordinates with interaction handlers.
 * Handles placement algorithms, collision detection, and state management.
 */
import { ImageContainer } from '../components/ImageContainer.js';

export class ImageManager {
    constructor(eventBus, stateManager, dragHandler, resizeHandler) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;
        this.dragHandler = dragHandler;
        this.resizeHandler = resizeHandler;
        
        this.containers = new Map(); // filename -> ImageContainer
        this.positions = []; // Array of [x, y] positions
        this.sizes = []; // Array of [width, height] sizes
        this.metadata = null;
        this.containerElement = null;
        this.debugMode = false;

        // Configuration
        this.config = {
            minSpacing: 20,
            gridSize: 50,
            goalPixels: 150000, // Target image size for scaling
            loadDelay: 100, // Delay between loading images
            maxRetries: 3
        };

        this.setupEventListeners();
    }

    /**
     * Initialize the image manager
     * @param {HTMLElement} container - Main container element
     */
    initialize(container) {
        this.containerElement = container;
        
        if (this.debugMode) {
            console.log('ImageManager: Initialized with container', container);
        }
    }

    /**
     * Load images from metadata
     * @param {Array} imageMetadata - Array of [filename, [width, height]] pairs
     */
    async loadImages(imageMetadata) {
        console.log('ImageManager: loadImages called with:', imageMetadata?.length, 'images');

        if (!imageMetadata || !Array.isArray(imageMetadata)) {
            throw new Error('ImageManager: Invalid metadata provided');
        }

        this.metadata = imageMetadata;

        // Check if we have saved states to determine shuffling
        const savedStates = this.stateManager.getAllImageStates();
        const hasSavedStates = Object.keys(savedStates).length > 0;

        console.log('ImageManager: Saved states check:', { hasSavedStates, stateCount: Object.keys(savedStates).length });

        // Only shuffle if no saved states exist
        let processedMetadata = hasSavedStates ?
            [...imageMetadata] :
            this.shuffleArray([...imageMetadata]);

        console.log('ImageManager: Processing', processedMetadata.length, 'images');

        if (this.debugMode) {
            console.log('ImageManager: Loading images', {
                count: processedMetadata.length,
                hasSavedStates,
                shuffled: !hasSavedStates
            });
        }

        // Calculate scaled sizes
        console.log('ImageManager: Calculating scaled sizes...');
        this.calculateScaledSizes(processedMetadata);
        console.log('ImageManager: Scaled sizes calculated:', this.sizes.length);

        // Clear existing containers
        console.log('ImageManager: Clearing existing containers...');
        this.clearAllImages();

        // Load images progressively
        console.log('ImageManager: Starting progressive loading...');
        await this.loadImagesProgressively(processedMetadata);

        console.log('ImageManager: Progressive loading complete');

        // Emit completion event
        this.eventBus.emit('images:loaded', {
            count: processedMetadata.length,
            hasSavedStates
        });

        console.log('ImageManager: loadImages completed successfully');
    }

    /**
     * Calculate scaled sizes for images
     * @param {Array} metadata - Image metadata
     */
    calculateScaledSizes(metadata) {
        console.log('ImageManager: calculateScaledSizes called with', metadata.length, 'images');
        console.log('ImageManager: containerElement:', this.containerElement);

        if (!this.containerElement) {
            throw new Error('ImageManager: Container element not set');
        }

        const containerRect = this.containerElement.getBoundingClientRect();
        console.log('ImageManager: containerRect:', containerRect);

        const screenWidth = containerRect.width;
        console.log('ImageManager: screenWidth:', screenWidth);

        if (screenWidth <= 0) {
            console.warn('ImageManager: Container has zero width, using fallback');
            // Use window width as fallback
            const fallbackWidth = window.innerWidth || 1200;
            console.log('ImageManager: Using fallback width:', fallbackWidth);
        }

        const effectiveWidth = screenWidth > 0 ? screenWidth : (window.innerWidth || 1200);

        this.sizes = metadata.map(([filename, [w, h]]) => {
            let actualPixels = w * h;
            let scaledWidth = w;
            let scaledHeight = h;

            // Scale down large images
            if (actualPixels / this.config.goalPixels > 16) {
                scaledWidth = Math.floor(w / 8);
                scaledHeight = Math.floor(h / 8);
            } else if (actualPixels / this.config.goalPixels > 4) {
                scaledWidth = Math.floor(w / 4);
                scaledHeight = Math.floor(h / 4);
            } else {
                scaledWidth = Math.floor(w / 2);
                scaledHeight = Math.floor(h / 2);
            }

            // Ensure width doesn't exceed screen width
            if (scaledWidth + 10 > effectiveWidth) {
                scaledWidth = effectiveWidth - 10;
                scaledHeight = Math.floor(scaledHeight * (scaledWidth / (w / 2)));
            }

            return [scaledWidth, scaledHeight];
        });

        console.log('ImageManager: Calculated', this.sizes.length, 'sizes');
    }

    /**
     * Load images progressively with delay
     * @param {Array} metadata - Image metadata
     */
    async loadImagesProgressively(metadata) {
        console.log('ImageManager: loadImagesProgressively starting with', metadata.length, 'images');
        this.positions = [];

        for (let i = 0; i < metadata.length; i++) {
            const [filename, originalSize] = metadata[i];
            const scaledSize = this.sizes[i];

            console.log(`ImageManager: Loading image ${i + 1}/${metadata.length}: ${filename}`);

            try {
                await this.loadSingleImage(filename, originalSize, scaledSize, i);
                console.log(`ImageManager: Successfully loaded image ${i + 1}/${metadata.length}: ${filename}`);

                // Add delay between images for smooth appearance
                if (i < metadata.length - 1) {
                    await this.delay(this.config.loadDelay);
                }
            } catch (error) {
                console.error(`ImageManager: Failed to load image ${filename}:`, error);
                console.error(`ImageManager: Error details:`, error.stack);
                this.eventBus.emit('image:error', { filename, index: i, error });
                // Continue with next image instead of stopping
            }
        }

        console.log('ImageManager: loadImagesProgressively completed');
    }

    /**
     * Load a single image
     * @param {string} filename - Image filename
     * @param {Array} originalSize - Original [width, height]
     * @param {Array} scaledSize - Scaled [width, height]
     * @param {number} index - Image index
     */
    async loadSingleImage(filename, originalSize, scaledSize, index) {
        console.log(`ImageManager: loadSingleImage called for ${filename} (index ${index})`);

        try {
            // Check for saved state
            console.log(`ImageManager: Checking saved state for ${filename}`);
            const savedState = this.stateManager.getImageState(filename);
            console.log(`ImageManager: Saved state for ${filename}:`, savedState);

            let finalPosition, finalSize;

            if (savedState) {
                finalPosition = savedState.position;
                finalSize = savedState.size;
                this.positions.push(finalPosition);
                this.sizes[index] = finalSize;
                console.log(`ImageManager: Using saved state for ${filename}`, { finalPosition, finalSize });
            } else {
                // Calculate new position using placement algorithm
                console.log(`ImageManager: Calculating new position for ${filename}`);
                finalPosition = this.calculatePosition(scaledSize, index);
                finalSize = scaledSize;
                this.positions.push(finalPosition);
                console.log(`ImageManager: Calculated position for ${filename}`, { finalPosition, finalSize });
            }

            // Create image container
            console.log(`ImageManager: Creating ImageContainer for ${filename}`);
            const container = new ImageContainer(
                filename,
                {
                    width: finalSize[0],
                    height: finalSize[1],
                    originalWidth: originalSize[0],
                    originalHeight: originalSize[1]
                },
                index,
                this.eventBus
            );
            console.log(`ImageManager: ImageContainer created for ${filename}`);

            // Set debug mode
            if (this.debugMode) {
                container.setDebugMode(true);
            }

            // Render container
            console.log(`ImageManager: Rendering container for ${filename}`);
            const element = container.render();
            console.log(`ImageManager: Container rendered for ${filename}`, element);

            container.setPosition(finalPosition[0], finalPosition[1]);
            container.setSize(finalSize[0], finalSize[1]);
            console.log(`ImageManager: Position and size set for ${filename}`);

            // Attach interaction handlers
            console.log(`ImageManager: Attaching interaction handlers for ${filename}`);
            this.dragHandler.attachTo(element, index);
            this.resizeHandler.attachTo(element, index);
            console.log(`ImageManager: Interaction handlers attached for ${filename}`);

            // Add to container
            console.log(`ImageManager: Adding to DOM container for ${filename}`);
            this.containerElement.appendChild(element);
            console.log(`ImageManager: Added to DOM for ${filename}`);

            // Store reference
            this.containers.set(filename, container);
            console.log(`ImageManager: Stored reference for ${filename}`);

            if (this.debugMode) {
                console.log(`ImageManager: Loaded image ${filename}`, {
                    index,
                    position: finalPosition,
                    size: finalSize,
                    hasSavedState: !!savedState
                });
            }

            console.log(`ImageManager: loadSingleImage completed successfully for ${filename}`);

        } catch (error) {
            console.error(`ImageManager: Error in loadSingleImage for ${filename}:`, error);
            console.error(`ImageManager: Error stack:`, error.stack);
            throw error; // Re-throw to be caught by the calling function
        }
    }

    /**
     * Calculate position for new image using placement algorithm
     * @param {Array} size - Image [width, height]
     * @param {number} index - Image index
     * @returns {Array} Position [x, y]
     */
    calculatePosition(size, index) {
        console.log(`ImageManager: calculatePosition called for index ${index}, size:`, size);

        const [width, height] = size;
        const containerRect = this.containerElement.getBoundingClientRect();
        const screenWidth = containerRect.width || window.innerWidth || 1200;

        console.log(`ImageManager: screenWidth: ${screenWidth}, containerRect:`, containerRect);

        // Simple fallback: grid-based placement
        const cols = Math.max(1, Math.floor(screenWidth / (width + 20)));
        const row = Math.floor(index / cols);
        const col = index % cols;

        const x = col * (width + 20) + 10;
        const y = row * (height + 20) + 10;

        console.log(`ImageManager: Calculated position [${x}, ${y}] for index ${index}`);
        return [x, y];

        // Original complex algorithm (commented out for now)
        /*
        let searchHeight = 600;

        while (true) {
            // Try grid-based placement first
            const gridPosition = this.tryGridPlacement(width, height, screenWidth, searchHeight);
            if (gridPosition) {
                return gridPosition;
            }

            // Try random placement as fallback
            const randomPosition = this.tryRandomPlacement(width, height, screenWidth, searchHeight);
            if (randomPosition) {
                return randomPosition;
            }

            // Increase search area
            searchHeight += 100;
        }
        */
    }

    /**
     * Try grid-based placement
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} screenWidth - Screen width
     * @param {number} searchHeight - Search height
     * @returns {Array|null} Position [x, y] or null if not found
     */
    tryGridPlacement(width, height, screenWidth, searchHeight) {
        const maxX = screenWidth - width;
        const maxY = searchHeight - height;
        
        for (let y = 0; y <= maxY; y += this.config.gridSize) {
            for (let x = 0; x <= maxX; x += this.config.gridSize) {
                if (!this.wouldOverlap(x, y, width, height)) {
                    return [x, y];
                }
            }
        }
        
        return null;
    }

    /**
     * Try random placement
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} screenWidth - Screen width
     * @param {number} searchHeight - Search height
     * @returns {Array|null} Position [x, y] or null if not found
     */
    tryRandomPlacement(width, height, screenWidth, searchHeight) {
        const maxX = screenWidth - width;
        const maxY = searchHeight - height;
        
        for (let attempt = 0; attempt < 30; attempt++) {
            const x = Math.random() * maxX;
            const y = Math.random() * maxY;
            
            if (!this.wouldOverlap(x, y, width, height)) {
                return [Math.floor(x), Math.floor(y)];
            }
        }
        
        return null;
    }

    /**
     * Check if position would cause overlap
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} excludeIndex - Index to exclude from check
     * @returns {boolean} True if would overlap
     */
    wouldOverlap(x, y, width, height, excludeIndex = -1) {
        const buffer = this.config.minSpacing;
        
        for (let i = 0; i < this.positions.length; i++) {
            if (i === excludeIndex) continue;
            
            const [otherX, otherY] = this.positions[i];
            const [otherWidth, otherHeight] = this.sizes[i];
            
            // Check overlap with spacing buffer
            if (x < (otherX + otherWidth + buffer) && 
                (x + width + buffer) > otherX && 
                (y + height + buffer) > otherY && 
                y < (otherY + otherHeight + buffer)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Update image position
     * @param {number} index - Image index
     * @param {Array} position - New position [x, y]
     */
    updateImagePosition(index, position) {
        if (index >= 0 && index < this.positions.length) {
            this.positions[index] = position;
            
            if (this.debugMode) {
                console.log(`ImageManager: Updated position for index ${index}`, position);
            }
        }
    }

    /**
     * Update image size
     * @param {number} index - Image index
     * @param {Array} size - New size [width, height]
     */
    updateImageSize(index, size) {
        if (index >= 0 && index < this.sizes.length) {
            this.sizes[index] = size;
            
            if (this.debugMode) {
                console.log(`ImageManager: Updated size for index ${index}`, size);
            }
        }
    }

    /**
     * Get image container by filename
     * @param {string} filename - Image filename
     * @returns {ImageContainer|null} Container or null
     */
    getContainer(filename) {
        return this.containers.get(filename) || null;
    }

    /**
     * Get all containers
     * @returns {Map} Map of filename -> ImageContainer
     */
    getAllContainers() {
        return new Map(this.containers);
    }

    /**
     * Clear all images
     */
    clearAllImages() {
        // Destroy all containers
        for (const container of this.containers.values()) {
            container.destroy();
        }
        
        // Clear collections
        this.containers.clear();
        this.positions = [];
        this.sizes = [];
        
        // Clear container element
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        
        if (this.debugMode) {
            console.log('ImageManager: Cleared all images');
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for drag events
        this.eventBus.on('drag:end', this.handleDragEnd.bind(this));
        
        // Listen for resize events
        this.eventBus.on('resize:end', this.handleResizeEnd.bind(this));
        
        // Listen for reset events
        this.eventBus.on('positions:reset', this.handlePositionsReset.bind(this));
    }

    /**
     * Handle drag end event
     * @param {Object} data - Drag event data
     */
    handleDragEnd(data) {
        const { index, position } = data;
        this.updateImagePosition(index, [position.x, position.y]);
        
        // Save state
        const filename = this.getFilenameByIndex(index);
        if (filename) {
            const size = this.sizes[index];
            this.stateManager.setImageState(filename, {
                position: [position.x, position.y],
                size: size
            });
        }
    }

    /**
     * Handle resize end event
     * @param {Object} data - Resize event data
     */
    handleResizeEnd(data) {
        const { index, size } = data;
        this.updateImageSize(index, [size.width, size.height]);
        
        // Save state
        const filename = this.getFilenameByIndex(index);
        if (filename) {
            const position = this.positions[index];
            this.stateManager.setImageState(filename, {
                position: position,
                size: [size.width, size.height]
            });
        }
    }

    /**
     * Handle positions reset event
     */
    handlePositionsReset() {
        // Reload images to reset positions
        if (this.metadata) {
            this.loadImages(this.metadata);
        }
    }

    /**
     * Get filename by index
     * @param {number} index - Image index
     * @returns {string|null} Filename or null
     */
    getFilenameByIndex(index) {
        if (!this.metadata || index < 0 || index >= this.metadata.length) {
            return null;
        }
        return this.metadata[index][0];
    }

    /**
     * Shuffle array in place
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Create delay promise
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.debugMode) {
            console.log('ImageManager: Configuration updated', this.config);
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
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        
        // Update all containers
        for (const container of this.containers.values()) {
            container.setDebugMode(enabled);
        }
        
        console.log(`ImageManager: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}
