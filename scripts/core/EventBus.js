/**
 * EventBus - Central communication hub for decoupled module interaction
 * 
 * Provides a publish-subscribe pattern for modules to communicate without
 * direct dependencies. Supports event subscription, emission, and cleanup.
 */
export class EventBus {
    constructor() {
        this.events = new Map();
        this.debugMode = false;
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Optional context for callback
     */
    on(event, callback, context = null) {
        if (typeof callback !== 'function') {
            throw new Error('EventBus.on: callback must be a function');
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listener = { callback, context };
        this.events.get(event).push(listener);

        if (this.debugMode) {
            console.log(`EventBus: Subscribed to '${event}'`, { callback: callback.name, context });
        }

        // Return unsubscribe function
        return () => this.off(event, callback, context);
    }

    /**
     * Subscribe to an event for single occurrence
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Optional context for callback
     */
    once(event, callback, context = null) {
        const onceWrapper = (...args) => {
            this.off(event, onceWrapper);
            callback.apply(context, args);
        };

        return this.on(event, onceWrapper, context);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     * @param {Object} context - Optional context to match
     */
    off(event, callback, context = null) {
        if (!this.events.has(event)) {
            return false;
        }

        const listeners = this.events.get(event);
        const index = listeners.findIndex(listener => 
            listener.callback === callback && listener.context === context
        );

        if (index !== -1) {
            listeners.splice(index, 1);
            
            // Clean up empty event arrays
            if (listeners.length === 0) {
                this.events.delete(event);
            }

            if (this.debugMode) {
                console.log(`EventBus: Unsubscribed from '${event}'`, { callback: callback.name, context });
            }
            return true;
        }

        return false;
    }

    /**
     * Emit an event with data
     * @param {string} event - Event name
     * @param {*} data - Data to pass to listeners
     */
    emit(event, data = null) {
        if (!this.events.has(event)) {
            if (this.debugMode) {
                console.log(`EventBus: No listeners for '${event}'`);
            }
            return;
        }

        const listeners = this.events.get(event);
        
        if (this.debugMode) {
            console.log(`EventBus: Emitting '${event}' to ${listeners.length} listeners`, data);
        }

        // Create a copy of listeners to avoid issues if listeners are modified during emission
        const listenersCopy = [...listeners];
        
        listenersCopy.forEach(({ callback, context }) => {
            try {
                callback.call(context, data);
            } catch (error) {
                console.error(`EventBus: Error in listener for '${event}':`, error);
            }
        });
    }

    /**
     * Remove all listeners for an event or all events
     * @param {string} event - Optional event name. If not provided, clears all events
     */
    clear(event = null) {
        if (event) {
            this.events.delete(event);
            if (this.debugMode) {
                console.log(`EventBus: Cleared all listeners for '${event}'`);
            }
        } else {
            this.events.clear();
            if (this.debugMode) {
                console.log('EventBus: Cleared all listeners');
            }
        }
    }

    /**
     * Get list of events with listener counts
     * @returns {Object} Event names and their listener counts
     */
    getEvents() {
        const eventInfo = {};
        this.events.forEach((listeners, event) => {
            eventInfo[event] = listeners.length;
        });
        return eventInfo;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`EventBus: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if there are listeners for an event
     * @param {string} event - Event name
     * @returns {boolean} True if there are listeners
     */
    hasListeners(event) {
        return this.events.has(event) && this.events.get(event).length > 0;
    }
}

// Export a singleton instance for convenience
export const eventBus = new EventBus();
