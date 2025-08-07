/**
 * Main Application Entry Point
 * 
 * Initializes all modules, wires them together through EventBus,
 * and maintains the same user experience as the original application.
 */

// Import core modules
import { EventBus } from './core/EventBus.js';
import { StorageManager } from './core/StorageManager.js';
import { StateManager } from './core/StateManager.js';

// Import managers
import { ImageManager } from './managers/ImageManager.js';

// Import components
import { ThemeToggle } from './components/ThemeToggle.js';
import { ResetButton } from './components/ResetButton.js';
import { SavedIndicator } from './components/SavedIndicator.js';

// Import interaction handlers
import { DragHandler } from './interactions/DragHandler.js';
import { ResizeHandler } from './interactions/ResizeHandler.js';

/**
 * Main Application Class
 */
class SnowballApp {
    constructor() {
        this.isInitialized = false;
        this.debugMode = false;
        
        // Core instances
        this.eventBus = null;
        this.storageManager = null;
        this.stateManager = null;
        
        // Manager instances
        this.imageManager = null;
        
        // Component instances
        this.themeToggle = null;
        this.resetButton = null;
        this.savedIndicator = null;
        
        // Interaction handler instances
        this.dragHandler = null;
        this.resizeHandler = null;
        
        // DOM references
        this.containerElement = null;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('SnowballApp: Already initialized');
            return;
        }

        try {
            console.log('SnowballApp: Starting initialization...');

            // Initialize core modules
            console.log('SnowballApp: Initializing core modules...');
            this.initializeCore();
            console.log('SnowballApp: Core modules initialized');

            // Initialize managers
            console.log('SnowballApp: Initializing managers...');
            this.initializeManagers();
            console.log('SnowballApp: Managers initialized');

            // Initialize components
            console.log('SnowballApp: Initializing components...');
            this.initializeComponents();
            console.log('SnowballApp: Components initialized');

            // Initialize interaction handlers
            console.log('SnowballApp: Initializing interaction handlers...');
            this.initializeInteractionHandlers();
            console.log('SnowballApp: Interaction handlers initialized');

            // Set up DOM
            console.log('SnowballApp: Setting up DOM...');
            this.setupDOM();
            console.log('SnowballApp: DOM setup complete');

            // Load and display images
            console.log('SnowballApp: Loading images...');
            await this.loadImages();
            console.log('SnowballApp: Images loading complete');

            this.isInitialized = true;
            console.log('SnowballApp: Initialization complete');

            // Emit app ready event
            this.eventBus.emit('app:ready', {
                timestamp: Date.now(),
                version: '2.0.0'
            });

        } catch (error) {
            console.error('SnowballApp: Initialization failed:', error);
            console.error('SnowballApp: Error stack:', error.stack);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize core modules
     */
    initializeCore() {
        // Create EventBus
        this.eventBus = new EventBus();
        
        // Create StorageManager
        this.storageManager = new StorageManager();
        
        // Create StateManager
        this.stateManager = new StateManager(this.eventBus, this.storageManager);

        if (this.debugMode) {
            this.eventBus.setDebugMode(true);
            this.storageManager.setDebugMode(true);
            this.stateManager.setDebugMode(true);
        }

        console.log('SnowballApp: Core modules initialized');
    }

    /**
     * Initialize managers
     */
    initializeManagers() {
        // Create interaction handlers first (needed by ImageManager)
        this.dragHandler = new DragHandler(this.eventBus, null); // ImageManager will be set later
        this.resizeHandler = new ResizeHandler(this.eventBus, null); // ImageManager will be set later
        
        // Create ImageManager
        this.imageManager = new ImageManager(
            this.eventBus,
            this.stateManager,
            this.dragHandler,
            this.resizeHandler
        );

        // Set ImageManager reference in handlers
        this.dragHandler.imageManager = this.imageManager;
        this.resizeHandler.imageManager = this.imageManager;

        if (this.debugMode) {
            this.imageManager.setDebugMode(true);
            this.dragHandler.setDebugMode(true);
            this.resizeHandler.setDebugMode(true);
        }

        console.log('SnowballApp: Managers initialized');
    }

    /**
     * Initialize components
     */
    initializeComponents() {
        // Create UI components
        this.themeToggle = new ThemeToggle(this.eventBus, this.stateManager);
        this.resetButton = new ResetButton(this.eventBus, this.stateManager);
        this.savedIndicator = new SavedIndicator(this.eventBus);

        if (this.debugMode) {
            this.themeToggle.setDebugMode(true);
            this.resetButton.setDebugMode(true);
            this.savedIndicator.setDebugMode(true);
        }

        console.log('SnowballApp: Components initialized');
    }

    /**
     * Initialize interaction handlers
     */
    initializeInteractionHandlers() {
        // Interaction handlers are already created in initializeManagers
        console.log('SnowballApp: Interaction handlers initialized');
    }

    /**
     * Set up DOM elements and render components
     */
    setupDOM() {
        // Get container element
        this.containerElement = document.getElementById('container');
        if (!this.containerElement) {
            throw new Error('Container element not found');
        }

        // Initialize ImageManager with container
        this.imageManager.initialize(this.containerElement);

        // Render UI components
        this.themeToggle.render();
        this.resetButton.render();
        this.savedIndicator.render();

        // Apply initial theme
        const savedTheme = this.stateManager.getTheme();
        this.themeToggle.setTheme(savedTheme);

        console.log('SnowballApp: DOM setup complete');
    }

    /**
     * Load and display images
     */
    async loadImages() {
        try {
            console.log('SnowballApp: Loading image metadata...');

            // Fetch image metadata
            const response = await fetch('image_widths_heights.json');

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Image metadata file not found. Please run lister.py to create it.');
                }
                throw new Error(`Failed to load metadata: ${response.status} ${response.statusText}`);
            }

            const imageData = await response.json();

            if (!Array.isArray(imageData) || imageData.length === 0) {
                throw new Error('Invalid or empty image metadata');
            }

            console.log(`SnowballApp: Loaded metadata for ${imageData.length} images`);
            console.log('SnowballApp: First few images:', imageData.slice(0, 3));

            // Load images through ImageManager
            console.log('SnowballApp: Starting image loading through ImageManager...');
            await this.imageManager.loadImages(imageData);

            console.log('SnowballApp: Images loaded successfully');

        } catch (error) {
            console.error('SnowballApp: Failed to load images:', error);
            console.error('SnowballApp: Error stack:', error.stack);
            this.handleImageLoadError(error);
        }
    }

    /**
     * Handle initialization errors
     * @param {Error} error - Initialization error
     */
    handleInitializationError(error) {
        // Show user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #fee;
            color: #c33;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #fcc;
            max-width: 500px;
            text-align: center;
            z-index: 10000;
        `;
        errorMessage.innerHTML = `
            <h3>Application Failed to Start</h3>
            <p>${error.message}</p>
            <p><small>Please check the console for more details.</small></p>
        `;
        document.body.appendChild(errorMessage);
    }

    /**
     * Handle image loading errors
     * @param {Error} error - Image loading error
     */
    handleImageLoadError(error) {
        // Show error through saved indicator
        if (this.savedIndicator) {
            this.savedIndicator.showError(error.message, 5000);
        }

        // Also show in console
        console.error('Image loading failed:', error);
    }

    /**
     * Enable debug mode for all modules
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;

        // Update all modules if they exist
        if (this.eventBus) this.eventBus.setDebugMode(enabled);
        if (this.storageManager) this.storageManager.setDebugMode(enabled);
        if (this.stateManager) this.stateManager.setDebugMode(enabled);
        if (this.imageManager) this.imageManager.setDebugMode(enabled);
        if (this.themeToggle) this.themeToggle.setDebugMode(enabled);
        if (this.resetButton) this.resetButton.setDebugMode(enabled);
        if (this.savedIndicator) this.savedIndicator.setDebugMode(enabled);
        if (this.dragHandler) this.dragHandler.setDebugMode(enabled);
        if (this.resizeHandler) this.resizeHandler.setDebugMode(enabled);

        console.log(`SnowballApp: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get application status
     * @returns {Object} Application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            debugMode: this.debugMode,
            imageCount: this.imageManager ? this.imageManager.getAllContainers().size : 0,
            theme: this.stateManager ? this.stateManager.getTheme() : 'unknown',
            storageAvailable: this.storageManager ? this.storageManager.isAvailable : false
        };
    }

    /**
     * Cleanup and destroy the application
     */
    destroy() {
        console.log('SnowballApp: Destroying application...');

        // Destroy components
        if (this.themeToggle) this.themeToggle.destroy();
        if (this.resetButton) this.resetButton.destroy();
        if (this.savedIndicator) this.savedIndicator.destroy();

        // Clear images
        if (this.imageManager) this.imageManager.clearAllImages();

        // Clear event bus
        if (this.eventBus) this.eventBus.clear();

        // Reset state
        this.isInitialized = false;

        console.log('SnowballApp: Application destroyed');
    }
}

// Create and initialize the application
const app = new SnowballApp();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    console.log('SnowballApp: DOM is loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('SnowballApp: DOMContentLoaded fired, initializing...');
        app.initialize().catch(error => {
            console.error('SnowballApp: Initialization failed:', error);
        });
    });
} else {
    // DOM is already ready
    console.log('SnowballApp: DOM is ready, initializing immediately...');
    app.initialize().catch(error => {
        console.error('SnowballApp: Initialization failed:', error);
    });
}

// Make app available globally for debugging
window.SnowballApp = app;

// Enable debug mode if URL parameter is present
if (new URLSearchParams(window.location.search).has('debug')) {
    app.setDebugMode(true);
}

export default app;
