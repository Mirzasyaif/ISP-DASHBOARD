const fs = require('fs');
const path = require('path');

// State file path
const STATE_FILE = path.join(__dirname, '../data/whatsapp-state.json');

// Default state
const DEFAULT_STATE = {
    enabled: true,
    last_updated: new Date().toISOString(),
    updated_by: 'system'
};

// Current state in memory
let currentState = { ...DEFAULT_STATE };

/**
 * Load WhatsApp state from file
 */
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            currentState = JSON.parse(data);
            console.log(`[WhatsApp State] Loaded: ${currentState.enabled ? 'ENABLED' : 'DISABLED'}`);
        } else {
            // Create default state file
            saveState();
            console.log('[WhatsApp State] Created default state file');
        }
    } catch (error) {
        console.error('[WhatsApp State] Error loading state:', error.message);
        currentState = { ...DEFAULT_STATE };
    }
}

/**
 * Save WhatsApp state to file
 */
function saveState() {
    try {
        currentState.last_updated = new Date().toISOString();
        fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2));
        console.log(`[WhatsApp State] Saved: ${currentState.enabled ? 'ENABLED' : 'DISABLED'}`);
    } catch (error) {
        console.error('[WhatsApp State] Error saving state:', error.message);
    }
}

/**
 * Check if WhatsApp is enabled
 * @returns {boolean}
 */
function isEnabled() {
    return currentState.enabled === true;
}

/**
 * Enable WhatsApp
 * @param {string} updatedBy - Who enabled it (e.g., 'telegram', 'admin')
 */
function enable(updatedBy = 'system') {
    currentState.enabled = true;
    currentState.updated_by = updatedBy;
    saveState();
    console.log(`[WhatsApp State] ENABLED by ${updatedBy}`);
}

/**
 * Disable WhatsApp
 * @param {string} updatedBy - Who disabled it (e.g., 'telegram', 'admin')
 */
function disable(updatedBy = 'system') {
    currentState.enabled = false;
    currentState.updated_by = updatedBy;
    saveState();
    console.log(`[WhatsApp State] DISABLED by ${updatedBy}`);
}

/**
 * Get current state
 * @returns {object}
 */
function getState() {
    return { ...currentState };
}

/**
 * Get status string
 * @returns {string}
 */
function getStatusString() {
    return currentState.enabled ? '✅ ENABLED' : '❌ DISABLED';
}

// Initialize state on load
loadState();

module.exports = {
    isEnabled,
    enable,
    disable,
    getState,
    getStatusString,
    loadState,
    saveState
};