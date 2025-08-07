/**
 * StateManager - Centralized application state management with validation
 * 
 * Manages application state including image positions, sizes, theme preferences,
 * and provides validation, persistence, and cleanup functionality.
 */
export class StateManager {
    constructor(eventBus, storageManager) {
        this.eventBus = eventBus;
        this.storage = storageManager;
        this.debugMode = false;
        
        // State structure
        this.state = {
            images: {},
            theme: 'light',
            lastSaved: null
        };

        // Configuration
        this.config = {
            stateExpiryDays: 30,
            storageKeys: {
                imageStates: 'imageStates',
                theme: 'theme'
            }
        };

        this.loadState();
        this.setupEventListeners();
    }

    /**
     * Load state from storage
     */
    loadState() {
        try {
            // Load image states
            const imageStates = this.storage.get(this.config.storageKeys.imageStates, {});
            this.state.images = this.validateImageStates(imageStates);

            // Load theme
            const savedTheme = this.storage.get(this.config.storageKeys.theme, 'light');
            this.state.theme = this.validateTheme(savedTheme);

            if (this.debugMode) {
                console.log('StateManager: Loaded state', this.state);
            }

            // Clean up old states
            this.cleanupOldStates();
        } catch (error) {
            console.error('StateManager: Error loading state:', error);
            this.resetToDefaults();
        }
    }

    /**
     * Set up event listeners for state changes
     */
    setupEventListeners() {
        // Listen for image state changes
        this.eventBus.on('image:moved', this.handleImageMoved.bind(this));
        this.eventBus.on('image:resized', this.handleImageResized.bind(this));
        this.eventBus.on('theme:changed', this.handleThemeChanged.bind(this));
        this.eventBus.on('positions:reset', this.handlePositionsReset.bind(this));
    }

    /**
     * Get image state for a specific filename
     * @param {string} filename - Image filename
     * @returns {Object|null} Image state or null if not found
     */
    getImageState(filename) {
        return this.state.images[filename] || null;
    }

    /**
     * Set image state for a specific filename
     * @param {string} filename - Image filename
     * @param {Object} imageState - Image state object
     */
    setImageState(filename, imageState) {
        if (!this.validateImageState(imageState)) {
            console.error('StateManager: Invalid image state:', imageState);
            return false;
        }

        this.state.images[filename] = {
            ...imageState,
            timestamp: Date.now()
        };

        this.saveImageStates();
        this.eventBus.emit('state:saved', { filename, state: imageState });

        if (this.debugMode) {
            console.log(`StateManager: Updated state for '${filename}'`, imageState);
        }

        return true;
    }

    /**
     * Get current theme
     * @returns {string} Current theme
     */
    getTheme() {
        return this.state.theme;
    }

    /**
     * Set theme
     * @param {string} theme - Theme name ('light' or 'dark')
     */
    setTheme(theme) {
        const validatedTheme = this.validateTheme(theme);
        if (validatedTheme !== this.state.theme) {
            this.state.theme = validatedTheme;
            this.storage.set(this.config.storageKeys.theme, validatedTheme);
            this.eventBus.emit('theme:updated', validatedTheme);

            if (this.debugMode) {
                console.log(`StateManager: Theme changed to '${validatedTheme}'`);
            }
        }
    }

    /**
     * Reset all saved states
     */
    resetAllStates() {
        this.state.images = {};
        this.storage.remove(this.config.storageKeys.imageStates);
        this.eventBus.emit('state:reset');

        if (this.debugMode) {
            console.log('StateManager: Reset all image states');
        }
    }

    /**
     * Clean up old states (older than configured days)
     */
    cleanupOldStates() {
        const expiryTime = Date.now() - (this.config.stateExpiryDays * 24 * 60 * 60 * 1000);
        let cleanedCount = 0;

        for (const filename in this.state.images) {
            const imageState = this.state.images[filename];
            if (imageState.timestamp && imageState.timestamp < expiryTime) {
                delete this.state.images[filename];
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.saveImageStates();
            if (this.debugMode) {
                console.log(`StateManager: Cleaned up ${cleanedCount} old states`);
            }
        }
    }

    /**
     * Get all image states
     * @returns {Object} All image states
     */
    getAllImageStates() {
        return { ...this.state.images };
    }

    /**
     * Get state summary
     * @returns {Object} State summary information
     */
    getStateSummary() {
        return {
            imageCount: Object.keys(this.state.images).length,
            theme: this.state.theme,
            lastSaved: this.state.lastSaved,
            oldestState: this.getOldestStateTimestamp(),
            newestState: this.getNewestStateTimestamp()
        };
    }

    // Private methods

    /**
     * Handle image moved event
     * @param {Object} data - Event data
     */
    handleImageMoved(data) {
        const { filename, position, size } = data;
        this.setImageState(filename, { position, size });
    }

    /**
     * Handle image resized event
     * @param {Object} data - Event data
     */
    handleImageResized(data) {
        const { filename, position, size } = data;
        this.setImageState(filename, { position, size });
    }

    /**
     * Handle theme changed event
     * @param {Object} data - Event data
     */
    handleThemeChanged(data) {
        this.setTheme(data.theme);
    }

    /**
     * Handle positions reset event
     */
    handlePositionsReset() {
        this.resetAllStates();
    }

    /**
     * Save image states to storage
     */
    saveImageStates() {
        this.state.lastSaved = Date.now();
        this.storage.set(this.config.storageKeys.imageStates, this.state.images);
    }

    /**
     * Validate image states object
     * @param {Object} imageStates - Image states to validate
     * @returns {Object} Validated image states
     */
    validateImageStates(imageStates) {
        if (!imageStates || typeof imageStates !== 'object') {
            return {};
        }

        const validated = {};
        for (const filename in imageStates) {
            const state = imageStates[filename];
            if (this.validateImageState(state)) {
                validated[filename] = state;
            }
        }

        return validated;
    }

    /**
     * Validate individual image state
     * @param {Object} state - Image state to validate
     * @returns {boolean} True if valid
     */
    validateImageState(state) {
        if (!state || typeof state !== 'object') {
            return false;
        }

        const { position, size } = state;

        // Validate position
        if (!Array.isArray(position) || position.length !== 2 || 
            !Number.isFinite(position[0]) || !Number.isFinite(position[1])) {
            return false;
        }

        // Validate size
        if (!Array.isArray(size) || size.length !== 2 || 
            !Number.isFinite(size[0]) || !Number.isFinite(size[1]) ||
            size[0] <= 0 || size[1] <= 0) {
            return false;
        }

        return true;
    }

    /**
     * Validate theme value
     * @param {string} theme - Theme to validate
     * @returns {string} Validated theme
     */
    validateTheme(theme) {
        return ['light', 'dark'].includes(theme) ? theme : 'light';
    }

    /**
     * Reset state to defaults
     */
    resetToDefaults() {
        this.state = {
            images: {},
            theme: 'light',
            lastSaved: null
        };
    }

    /**
     * Get oldest state timestamp
     * @returns {number|null} Oldest timestamp or null
     */
    getOldestStateTimestamp() {
        const timestamps = Object.values(this.state.images)
            .map(state => state.timestamp)
            .filter(ts => ts);
        return timestamps.length > 0 ? Math.min(...timestamps) : null;
    }

    /**
     * Get newest state timestamp
     * @returns {number|null} Newest timestamp or null
     */
    getNewestStateTimestamp() {
        const timestamps = Object.values(this.state.images)
            .map(state => state.timestamp)
            .filter(ts => ts);
        return timestamps.length > 0 ? Math.max(...timestamps) : null;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`StateManager: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}
