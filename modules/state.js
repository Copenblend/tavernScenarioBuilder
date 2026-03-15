/**
 * Tavern Scenario Builder — State Management
 *
 * Manages persistent settings (extension_settings) and session state (in-memory).
 * Single source of truth for all wizard data.
 */

import { saveSettingsDebounced } from '/script.js';
import { extension_settings } from '/scripts/extensions.js';

const extensionName = 'TavernScenarioBuilder';

const DEFAULT_SETTINGS = {
    splitRatio: 75,
    savedSession: null,
};

/** @type {object} In-memory session state — full structure added in later tickets */
const session = {
    currentStep: 'scenario',
    completedSteps: [],
};

/**
 * Merges default settings with any previously saved extension settings.
 * Must be called once during extension initialization.
 */
export function loadSettings() {
    extension_settings[extensionName] = {
        ...DEFAULT_SETTINGS,
        ...extension_settings[extensionName],
    };
}

/**
 * Returns the value of a persistent setting.
 * @param {string} key - The setting key to retrieve.
 * @returns {*} The setting value, or the default if not set.
 */
export function getSetting(key) {
    return extension_settings[extensionName]?.[key] ?? DEFAULT_SETTINGS[key];
}

/**
 * Updates a persistent setting and triggers a debounced save.
 * @param {string} key - The setting key to update.
 * @param {*} value - The new value.
 */
export function setSetting(key, value) {
    extension_settings[extensionName][key] = value;
    saveSettingsDebounced();
}
