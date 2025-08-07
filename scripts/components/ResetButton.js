/**
 * ResetButton - Reset functionality component
 * 
 * Provides a button to reset all image positions and sizes to their defaults
 * with confirmation dialog and proper event communication.
 */
export class ResetButton {
    constructor(eventBus, stateManager) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;
        this.element = null;
        this.isResetting = false;
        this.debugMode = false;

        this.setupEventListeners();
    }

    /**
     * Create and mount the reset button component
     * @param {HTMLElement} container - Container to append the component to
     * @returns {HTMLElement} The created element
     */
    render(container = document.body) {
        if (this.element) {
            console.warn('ResetButton: Component already rendered');
            return this.element;
        }

        // Create button element
        this.element = document.createElement('button');
        this.element.className = 'reset-button glass-button';
        this.element.title = 'Reset all image positions and sizes';
        this.element.setAttribute('aria-label', 'Reset all image positions and sizes to defaults');

        // Create icon
        const iconElement = document.createElement('div');
        iconElement.innerHTML = this.getIconSVG();
        this.element.appendChild(iconElement);

        // Add click handler
        this.element.addEventListener('click', this.handleClick.bind(this));

        // Add keyboard support
        this.element.addEventListener('keydown', this.handleKeydown.bind(this));

        // Append to container
        container.appendChild(this.element);

        if (this.debugMode) {
            console.log('ResetButton: Component rendered');
        }

        return this.element;
    }

    /**
     * Reset all positions and sizes
     * @param {boolean} skipConfirmation - Skip confirmation dialog
     */
    async reset(skipConfirmation = false) {
        if (this.isResetting) {
            return; // Prevent multiple simultaneous resets
        }

        // Check if there are any saved states to reset
        const stateSummary = this.stateManager.getStateSummary();
        if (stateSummary.imageCount === 0) {
            this.showMessage('No saved positions to reset', 'info');
            return;
        }

        // Show confirmation dialog unless skipped
        if (!skipConfirmation) {
            const confirmed = await this.showConfirmationDialog();
            if (!confirmed) {
                return;
            }
        }

        this.isResetting = true;
        this.setLoadingState(true);

        try {
            // Emit reset event
            this.eventBus.emit('positions:reset', {
                source: 'ResetButton',
                timestamp: Date.now()
            });

            // Show success message
            this.showMessage('Positions reset successfully', 'success');

            if (this.debugMode) {
                console.log('ResetButton: Reset completed successfully');
            }

        } catch (error) {
            console.error('ResetButton: Error during reset:', error);
            this.showMessage('Error resetting positions', 'error');
        } finally {
            this.isResetting = false;
            this.setLoadingState(false);
        }
    }

    /**
     * Show confirmation dialog
     * @returns {Promise<boolean>} True if confirmed
     */
    showConfirmationDialog() {
        return new Promise((resolve) => {
            // Create custom confirmation dialog
            const dialog = this.createConfirmationDialog();
            document.body.appendChild(dialog);

            // Focus management
            const confirmButton = dialog.querySelector('.confirm-button');
            const cancelButton = dialog.querySelector('.cancel-button');
            
            confirmButton.focus();

            // Handle confirmation
            const handleConfirm = () => {
                document.body.removeChild(dialog);
                resolve(true);
            };

            // Handle cancellation
            const handleCancel = () => {
                document.body.removeChild(dialog);
                resolve(false);
            };

            // Event listeners
            confirmButton.addEventListener('click', handleConfirm);
            cancelButton.addEventListener('click', handleCancel);

            // Keyboard navigation
            dialog.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    handleCancel();
                } else if (event.key === 'Tab') {
                    event.preventDefault();
                    const focusedElement = document.activeElement;
                    if (focusedElement === confirmButton) {
                        cancelButton.focus();
                    } else {
                        confirmButton.focus();
                    }
                }
            });

            // Click outside to cancel
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) {
                    handleCancel();
                }
            });
        });
    }

    /**
     * Create confirmation dialog element
     * @returns {HTMLElement} Dialog element
     */
    createConfirmationDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'reset-confirmation-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--bg-secondary, white);
            color: var(--text-primary, #333);
            padding: 24px;
            border-radius: 12px;
            box-shadow: var(--shadow-heavy, 0 16px 64px rgba(0, 0, 0, 0.3));
            max-width: 400px;
            margin: 20px;
            text-align: center;
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
                Reset Image Positions
            </h3>
            <p style="margin: 0 0 24px 0; color: var(--text-secondary, #666); line-height: 1.5;">
                This will reset all image positions and sizes to their defaults. This action cannot be undone.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button class="cancel-button" style="
                    padding: 8px 16px;
                    border: 1px solid var(--border-color, #ddd);
                    background: transparent;
                    color: var(--text-primary, #333);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">Cancel</button>
                <button class="confirm-button" style="
                    padding: 8px 16px;
                    border: none;
                    background: var(--accent-error, #EF4444);
                    color: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                ">Reset Positions</button>
            </div>
        `;

        dialog.appendChild(content);
        return dialog;
    }

    /**
     * Show temporary message
     * @param {string} message - Message to show
     * @param {string} type - Message type ('success', 'error', 'info')
     */
    showMessage(message, type = 'info') {
        this.eventBus.emit('message:show', {
            message,
            type,
            duration: 3000,
            source: 'ResetButton'
        });
    }

    /**
     * Set loading state
     * @param {boolean} loading - Whether component is loading
     */
    setLoadingState(loading) {
        if (!this.element) return;

        if (loading) {
            this.element.classList.add('loading');
            this.element.disabled = true;
            this.element.setAttribute('aria-label', 'Resetting positions...');
        } else {
            this.element.classList.remove('loading');
            this.element.disabled = false;
            this.element.setAttribute('aria-label', 'Reset all image positions and sizes to defaults');
        }
    }

    /**
     * Get reset icon SVG
     * @returns {string} SVG icon HTML
     */
    getIconSVG() {
        return `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
        `;
    }

    /**
     * Handle click events
     * @param {Event} event - Click event
     */
    handleClick(event) {
        event.preventDefault();
        this.reset();
    }

    /**
     * Handle keyboard events
     * @param {Event} event - Keyboard event
     */
    handleKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.reset();
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for external reset requests
        this.eventBus.on('reset:request', this.handleResetRequest.bind(this));
    }

    /**
     * Handle external reset request
     * @param {Object} data - Reset request data
     */
    handleResetRequest(data) {
        const skipConfirmation = data && data.skipConfirmation;
        this.reset(skipConfirmation);
    }

    /**
     * Cleanup component
     */
    destroy() {
        if (this.element) {
            this.element.removeEventListener('click', this.handleClick);
            this.element.removeEventListener('keydown', this.handleKeydown);
            
            if (this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
        }

        // Remove event listeners
        this.eventBus.off('reset:request', this.handleResetRequest);

        this.element = null;

        if (this.debugMode) {
            console.log('ResetButton: Component destroyed');
        }
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`ResetButton: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}
