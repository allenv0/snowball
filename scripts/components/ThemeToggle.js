/**
 * ThemeToggle - Handle theme switching with visual feedback
 * 
 * Manages theme switching between light and dark modes with smooth transitions,
 * icon updates, and state persistence through the EventBus system.
 */
export class ThemeToggle {
    constructor(eventBus, stateManager) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;
        this.element = null;
        this.iconElement = null;
        this.currentTheme = this.stateManager.getTheme();
        this.debugMode = false;

        this.setupEventListeners();
    }

    /**
     * Create and mount the theme toggle component
     * @param {HTMLElement} container - Container to append the component to
     * @returns {HTMLElement} The created element
     */
    render(container = document.body) {
        if (this.element) {
            console.warn('ThemeToggle: Component already rendered');
            return this.element;
        }

        // Create button element
        this.element = document.createElement('button');
        this.element.className = 'theme-toggle glass-button';
        this.element.title = 'Toggle theme';
        this.element.setAttribute('aria-label', 'Toggle between light and dark theme');

        // Create icon container
        this.iconElement = document.createElement('div');
        this.iconElement.className = 'theme-icon';
        this.iconElement.innerHTML = this.getIconSVG(this.currentTheme);

        this.element.appendChild(this.iconElement);

        // Add click handler
        this.element.addEventListener('click', this.handleClick.bind(this));

        // Add keyboard support
        this.element.addEventListener('keydown', this.handleKeydown.bind(this));

        // Apply current theme
        this.applyTheme(this.currentTheme);

        // Append to container
        container.appendChild(this.element);

        if (this.debugMode) {
            console.log('ThemeToggle: Component rendered', { theme: this.currentTheme });
        }

        return this.element;
    }

    /**
     * Toggle between themes
     */
    toggle() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    /**
     * Set specific theme
     * @param {string} theme - Theme to set ('light' or 'dark')
     */
    setTheme(theme) {
        if (!['light', 'dark'].includes(theme)) {
            console.error('ThemeToggle: Invalid theme:', theme);
            return;
        }

        if (theme === this.currentTheme) {
            return; // No change needed
        }

        const previousTheme = this.currentTheme;
        this.currentTheme = theme;

        // Add transition class for smooth switching
        document.documentElement.classList.add('theme-transitioning');

        // Apply theme
        this.applyTheme(theme);

        // Update icon with animation
        this.updateIcon(theme);

        // Emit theme change event
        this.eventBus.emit('theme:changed', { 
            theme, 
            previousTheme,
            source: 'ThemeToggle'
        });

        // Remove transition class after animation
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transitioning');
        }, 300);

        if (this.debugMode) {
            console.log(`ThemeToggle: Theme changed from ${previousTheme} to ${theme}`);
        }
    }

    /**
     * Update icon with animation
     * @param {string} theme - Current theme
     */
    updateIcon(theme) {
        if (!this.iconElement) return;

        // Add fade out animation
        this.iconElement.style.opacity = '0';
        this.iconElement.style.transform = 'scale(0.8)';

        setTimeout(() => {
            // Update icon
            this.iconElement.innerHTML = this.getIconSVG(theme);
            
            // Fade in animation
            this.iconElement.style.opacity = '1';
            this.iconElement.style.transform = 'scale(1)';
        }, 150);
    }

    /**
     * Apply theme to document
     * @param {string} theme - Theme to apply
     */
    applyTheme(theme) {
        const html = document.documentElement;
        const body = document.body;

        // Remove existing theme classes
        html.classList.remove('dark-mode');
        body.classList.remove('dark-mode');
        html.removeAttribute('data-theme');

        if (theme === 'dark') {
            html.classList.add('dark-mode');
            body.classList.add('dark-mode');
            html.setAttribute('data-theme', 'dark');
        } else {
            html.setAttribute('data-theme', 'light');
        }

        // Update button aria-label
        if (this.element) {
            const label = theme === 'light' ? 
                'Switch to dark theme' : 
                'Switch to light theme';
            this.element.setAttribute('aria-label', label);
        }
    }

    /**
     * Get SVG icon for theme
     * @param {string} theme - Current theme
     * @returns {string} SVG icon HTML
     */
    getIconSVG(theme) {
        if (theme === 'dark') {
            // Moon icon for dark theme
            return `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon-moon">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
            `;
        } else {
            // Sun icon for light theme
            return `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon-sun">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
            `;
        }
    }

    /**
     * Handle click events
     * @param {Event} event - Click event
     */
    handleClick(event) {
        event.preventDefault();
        this.toggle();
    }

    /**
     * Handle keyboard events
     * @param {Event} event - Keyboard event
     */
    handleKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.toggle();
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for theme updates from state manager
        this.eventBus.on('theme:updated', this.handleThemeUpdate.bind(this));
        
        // Listen for external theme changes
        this.eventBus.on('theme:set', this.handleExternalThemeChange.bind(this));
    }

    /**
     * Handle theme update from state manager
     * @param {string} theme - New theme
     */
    handleThemeUpdate(theme) {
        if (theme !== this.currentTheme) {
            this.currentTheme = theme;
            this.applyTheme(theme);
            this.updateIcon(theme);
        }
    }

    /**
     * Handle external theme change
     * @param {Object} data - Theme change data
     */
    handleExternalThemeChange(data) {
        if (data.source !== 'ThemeToggle') {
            this.setTheme(data.theme);
        }
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
        this.eventBus.off('theme:updated', this.handleThemeUpdate);
        this.eventBus.off('theme:set', this.handleExternalThemeChange);

        this.element = null;
        this.iconElement = null;

        if (this.debugMode) {
            console.log('ThemeToggle: Component destroyed');
        }
    }

    /**
     * Get current theme
     * @returns {string} Current theme
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`ThemeToggle: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}
