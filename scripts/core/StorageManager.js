/**
 * StorageManager - Abstract localStorage operations with error handling
 * 
 * Provides a safe interface for localStorage operations with fallback mechanisms,
 * error handling, and data validation. Handles quota exceeded scenarios gracefully.
 */
export class StorageManager {
    constructor() {
        this.isAvailable = this.checkAvailability();
        this.fallbackStorage = new Map(); // In-memory fallback
        this.debugMode = false;
    }

    /**
     * Check if localStorage is available
     * @returns {boolean} True if localStorage is available
     */
    checkAvailability() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('StorageManager: localStorage not available, using fallback storage', error);
            return false;
        }
    }

    /**
     * Get data from storage with fallback
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Retrieved value or default
     */
    get(key, defaultValue = null) {
        try {
            if (this.isAvailable) {
                const value = localStorage.getItem(key);
                if (value === null) {
                    if (this.debugMode) {
                        console.log(`StorageManager: Key '${key}' not found, returning default`);
                    }
                    return defaultValue;
                }
                
                // Try to parse JSON, fallback to string if parsing fails
                try {
                    const parsed = JSON.parse(value);
                    if (this.debugMode) {
                        console.log(`StorageManager: Retrieved '${key}'`, parsed);
                    }
                    return parsed;
                } catch (parseError) {
                    if (this.debugMode) {
                        console.log(`StorageManager: Retrieved '${key}' as string`, value);
                    }
                    return value;
                }
            } else {
                // Use fallback storage
                const value = this.fallbackStorage.get(key);
                return value !== undefined ? value : defaultValue;
            }
        } catch (error) {
            console.error(`StorageManager: Error getting '${key}':`, error);
            return defaultValue;
        }
    }

    /**
     * Store data with error handling
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} True if successful
     */
    set(key, value) {
        try {
            const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
            
            if (this.isAvailable) {
                localStorage.setItem(key, serializedValue);
                if (this.debugMode) {
                    console.log(`StorageManager: Stored '${key}'`, value);
                }
            } else {
                // Use fallback storage
                this.fallbackStorage.set(key, value);
                if (this.debugMode) {
                    console.log(`StorageManager: Stored '${key}' in fallback`, value);
                }
            }
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('StorageManager: Storage quota exceeded, attempting cleanup');
                this.handleQuotaExceeded(key, value);
                return false;
            } else {
                console.error(`StorageManager: Error storing '${key}':`, error);
                // Try fallback storage
                try {
                    this.fallbackStorage.set(key, value);
                    return true;
                } catch (fallbackError) {
                    console.error('StorageManager: Fallback storage also failed:', fallbackError);
                    return false;
                }
            }
        }
    }

    /**
     * Remove data from storage
     * @param {string} key - Storage key
     * @returns {boolean} True if successful
     */
    remove(key) {
        try {
            if (this.isAvailable) {
                localStorage.removeItem(key);
            }
            this.fallbackStorage.delete(key);
            
            if (this.debugMode) {
                console.log(`StorageManager: Removed '${key}'`);
            }
            return true;
        } catch (error) {
            console.error(`StorageManager: Error removing '${key}':`, error);
            return false;
        }
    }

    /**
     * Clear all storage
     * @returns {boolean} True if successful
     */
    clear() {
        try {
            if (this.isAvailable) {
                localStorage.clear();
            }
            this.fallbackStorage.clear();
            
            if (this.debugMode) {
                console.log('StorageManager: Cleared all storage');
            }
            return true;
        } catch (error) {
            console.error('StorageManager: Error clearing storage:', error);
            return false;
        }
    }

    /**
     * Get all keys from storage
     * @returns {string[]} Array of storage keys
     */
    keys() {
        try {
            if (this.isAvailable) {
                return Object.keys(localStorage);
            } else {
                return Array.from(this.fallbackStorage.keys());
            }
        } catch (error) {
            console.error('StorageManager: Error getting keys:', error);
            return [];
        }
    }

    /**
     * Check if a key exists in storage
     * @param {string} key - Storage key
     * @returns {boolean} True if key exists
     */
    has(key) {
        try {
            if (this.isAvailable) {
                return localStorage.getItem(key) !== null;
            } else {
                return this.fallbackStorage.has(key);
            }
        } catch (error) {
            console.error(`StorageManager: Error checking key '${key}':`, error);
            return false;
        }
    }

    /**
     * Get storage size information
     * @returns {Object} Storage size information
     */
    getStorageInfo() {
        try {
            if (!this.isAvailable) {
                return {
                    available: false,
                    fallbackKeys: this.fallbackStorage.size
                };
            }

            let totalSize = 0;
            const keys = Object.keys(localStorage);
            
            keys.forEach(key => {
                const value = localStorage.getItem(key);
                totalSize += key.length + (value ? value.length : 0);
            });

            return {
                available: true,
                keyCount: keys.length,
                estimatedSize: totalSize,
                fallbackKeys: this.fallbackStorage.size
            };
        } catch (error) {
            console.error('StorageManager: Error getting storage info:', error);
            return { available: false, error: error.message };
        }
    }

    /**
     * Handle quota exceeded error by cleaning up old data
     * @param {string} key - Key that failed to store
     * @param {*} value - Value that failed to store
     */
    handleQuotaExceeded(key, value) {
        try {
            // Try to free up space by removing old entries
            const keys = this.keys();
            let removedCount = 0;
            
            // Remove entries that look like old timestamps (older than 30 days)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            
            keys.forEach(storageKey => {
                try {
                    const data = this.get(storageKey);
                    if (data && typeof data === 'object' && data.timestamp && data.timestamp < thirtyDaysAgo) {
                        this.remove(storageKey);
                        removedCount++;
                    }
                } catch (error) {
                    // Skip problematic entries
                }
            });

            console.log(`StorageManager: Cleaned up ${removedCount} old entries`);
            
            // Try storing again
            if (removedCount > 0) {
                try {
                    this.set(key, value);
                } catch (retryError) {
                    console.warn('StorageManager: Still unable to store after cleanup, using fallback');
                    this.fallbackStorage.set(key, value);
                }
            }
        } catch (error) {
            console.error('StorageManager: Error during quota cleanup:', error);
        }
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`StorageManager: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// Export a singleton instance for convenience
export const storageManager = new StorageManager();
