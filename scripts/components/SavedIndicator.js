/**
 * SavedIndicator - Save status component
 * 
 * Shows visual feedback when image positions and sizes are saved,
 * with smooth animations and customizable display duration.
 */
export class SavedIndicator {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.element = null;
        this.isVisible = false;
        this.hideTimeout = null;
        this.debugMode = false;

        this.config = {
            defaultDuration: 2000,
            animationDuration: 300,
            maxDisplayTime: 10000
        };

        this.setupEventListeners();
    }

    /**
     * Create and mount the saved indicator component
     * @param {HTMLElement} container - Container to append the component to
     * @returns {HTMLElement} The created element
     */
    render(container = document.body) {
        if (this.element) {
            console.warn('SavedIndicator: Component already rendered');
            return this.element;
        }

        // Create indicator element
        this.element = document.createElement('div');
        this.element.className = 'saved-indicator';
        this.element.setAttribute('role', 'status');
        this.element.setAttribute('aria-live', 'polite');
        this.element.setAttribute('aria-label', 'Save status indicator');

        // Create content
        this.element.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span class="saved-text">Saved</span>
        `;

        // Append to container
        container.appendChild(this.element);

        if (this.debugMode) {
            console.log('SavedIndicator: Component rendered');
        }

        return this.element;
    }

    /**
     * Show the saved indicator
     * @param {Object} options - Display options
     */
    show(options = {}) {
        if (!this.element) {
            console.warn('SavedIndicator: Component not rendered');
            return;
        }

        const {
            message = 'Saved',
            duration = this.config.defaultDuration,
            type = 'success'
        } = options;

        // Clear any existing timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // Update message if provided
        const textElement = this.element.querySelector('.saved-text');
        if (textElement && message !== 'Saved') {
            textElement.textContent = message;
        }

        // Update type class
        this.element.className = `saved-indicator saved-indicator--${type}`;

        // Show with animation
        this.element.classList.add('show');
        this.isVisible = true;

        // Update aria-label for screen readers
        this.element.setAttribute('aria-label', `${message} - Save status`);

        // Auto-hide after duration
        if (duration > 0) {
            this.hideTimeout = setTimeout(() => {
                this.hide();
            }, Math.min(duration, this.config.maxDisplayTime));
        }

        if (this.debugMode) {
            console.log('SavedIndicator: Shown', { message, duration, type });
        }
    }

    /**
     * Hide the saved indicator
     */
    hide() {
        if (!this.element || !this.isVisible) {
            return;
        }

        // Clear timeout if exists
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // Hide with animation
        this.element.classList.remove('show');
        this.isVisible = false;

        // Reset message after animation
        setTimeout(() => {
            const textElement = this.element.querySelector('.saved-text');
            if (textElement) {
                textElement.textContent = 'Saved';
            }
            this.element.className = 'saved-indicator';
            this.element.setAttribute('aria-label', 'Save status indicator');
        }, this.config.animationDuration);

        if (this.debugMode) {
            console.log('SavedIndicator: Hidden');
        }
    }

    /**
     * Show success message
     * @param {string} message - Success message
     * @param {number} duration - Display duration
     */
    showSuccess(message = 'Saved', duration = this.config.defaultDuration) {
        this.show({ message, duration, type: 'success' });
    }

    /**
     * Show error message
     * @param {string} message - Error message
     * @param {number} duration - Display duration
     */
    showError(message = 'Save failed', duration = this.config.defaultDuration * 1.5) {
        this.show({ message, duration, type: 'error' });
    }

    /**
     * Show info message
     * @param {string} message - Info message
     * @param {number} duration - Display duration
     */
    showInfo(message = 'Info', duration = this.config.defaultDuration) {
        this.show({ message, duration, type: 'info' });
    }

    /**
     * Show warning message
     * @param {string} message - Warning message
     * @param {number} duration - Display duration
     */
    showWarning(message = 'Warning', duration = this.config.defaultDuration) {
        this.show({ message, duration, type: 'warning' });
    }

    /**
     * Check if indicator is currently visible
     * @returns {boolean} True if visible
     */
    isShowing() {
        return this.isVisible;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for state save events
        this.eventBus.on('state:saved', this.handleStateSaved.bind(this));
        
        // Listen for general message events
        this.eventBus.on('message:show', this.handleMessageShow.bind(this));
        
        // Listen for save error events
        this.eventBus.on('save:error', this.handleSaveError.bind(this));
        
        // Listen for save success events
        this.eventBus.on('save:success', this.handleSaveSuccess.bind(this));
    }

    /**
     * Handle state saved event
     * @param {Object} data - Save event data
     */
    handleStateSaved(data) {
        const filename = data && data.filename;
        const message = filename ? `Saved ${filename}` : 'Saved';
        this.showSuccess(message);
    }

    /**
     * Handle message show event
     * @param {Object} data - Message data
     */
    handleMessageShow(data) {
        if (!data) return;

        const { message, type = 'info', duration } = data;
        this.show({ message, type, duration });
    }

    /**
     * Handle save error event
     * @param {Object} data - Error data
     */
    handleSaveError(data) {
        const message = data && data.message ? data.message : 'Save failed';
        this.showError(message);
    }

    /**
     * Handle save success event
     * @param {Object} data - Success data
     */
    handleSaveSuccess(data) {
        const message = data && data.message ? data.message : 'Saved successfully';
        this.showSuccess(message);
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.debugMode) {
            console.log('SavedIndicator: Configuration updated', this.config);
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
     * Cleanup component
     */
    destroy() {
        // Clear any pending timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // Remove element
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        // Remove event listeners
        this.eventBus.off('state:saved', this.handleStateSaved);
        this.eventBus.off('message:show', this.handleMessageShow);
        this.eventBus.off('save:error', this.handleSaveError);
        this.eventBus.off('save:success', this.handleSaveSuccess);

        this.element = null;
        this.isVisible = false;

        if (this.debugMode) {
            console.log('SavedIndicator: Component destroyed');
        }
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`SavedIndicator: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}
