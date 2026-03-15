/**
 * Tavern Scenario Builder — State Management
 *
 * Manages persistent settings (extension_settings) and session state (in-memory).
 * Single source of truth for all wizard data.
 */

import { saveSettingsDebounced } from '/script.js';
import { extension_settings } from '/scripts/extensions.js';

const extensionName = 'TavernScenarioBuilder';

/** Ordered step names for the wizard */
export const STEPS = ['scenario', 'persona', 'character', 'location', 'firstMessage'];

const DEFAULT_SETTINGS = {
    splitRatio: 75,
    savedSession: null,
    systemPromptPrefix: '',
    scenarioHooks: 4,
    scenarioMaxTokens: 0,
    scenarioSections: ['setting', 'timePeriod', 'premise', 'keyThemes', 'toneAtmosphere', 'storyHooks'],
    personaMaxTokens: 0,
};

/**
 * Creates a blank session state object.
 * @returns {object} Fresh session state
 */
function createBlankSession() {
    return {
        scenario: {
            userInput: '',
            generated: '',
            accepted: '',
        },
        persona: {
            userInput: '',
            generated: '',
            accepted: '',
        },
        character: {
            userInput: '',
            fields: {
                name: '',
                age: '',
                hair: '',
                eyes: '',
                height: '',
                body: '',
                face: '',
                features: '',
                traits: '',
                habits: '',
                behavior: '',
                likes: '',
                dislikes: '',
                sexuality_orientation: '',
                sexuality_kinks: '',
                sexuality_likes: '',
                sexuality_dislikes: '',
                speaking_style: '',
                speaking_quirks: '',
                personality_summary: '',
                scenario: '',
                character_note: '',
                speech_examples: [],
            },
            lorebook: [],
        },
        location: {
            userInput: '',
            entries: [],
        },
        firstMessage: {
            generated: '',
            accepted: '',
        },
        currentStep: 'scenario',
        completedSteps: [],
    };
}

/** @type {object} In-memory session state */
let session = createBlankSession();

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

/**
 * Returns the current session object (read-only reference).
 * @returns {object} The session state.
 */
export function getSession() {
    return session;
}

/**
 * Returns session data for a specific step.
 * @param {string} stepName - The step name (e.g. 'scenario').
 * @returns {object} The step's data object.
 */
export function getStepData(stepName) {
    return session[stepName];
}

/**
 * Shallow-merges data into a specific step's session data.
 * @param {string} stepName - The step name.
 * @param {object} data - Key-value pairs to merge.
 */
export function updateStepData(stepName, data) {
    Object.assign(session[stepName], data);
}

/**
 * Marks a step as completed, advances currentStep, and persists session.
 * @param {string} stepName - The step that was accepted.
 */
export function acceptStep(stepName) {
    if (!session.completedSteps.includes(stepName)) {
        session.completedSteps.push(stepName);
    }
    // Advance to the next incomplete step
    const currentIndex = STEPS.indexOf(stepName);
    for (let i = currentIndex + 1; i < STEPS.length; i++) {
        if (!session.completedSteps.includes(STEPS[i])) {
            session.currentStep = STEPS[i];
            saveSession();
            return;
        }
    }
    // All steps completed
    session.currentStep = stepName;
    saveSession();
}

/**
 * Returns whether a step has been accepted/completed.
 * @param {string} stepName - The step to check.
 * @returns {boolean}
 */
export function isStepCompleted(stepName) {
    return session.completedSteps.includes(stepName);
}

/**
 * Returns a copy of the completed steps array.
 * @returns {string[]}
 */
export function getCompletedSteps() {
    return [...session.completedSteps];
}

/**
 * Returns the current wizard step name.
 * @returns {string}
 */
export function getCurrentStep() {
    return session.currentStep;
}

/**
 * Builds an accumulated context string from all completed steps.
 * Used as context for subsequent AI generation prompts.
 * @returns {string} Formatted context with delimited sections.
 */
export function getAccumulatedContext() {
    const parts = [];

    if (session.completedSteps.includes('scenario') && session.scenario.accepted) {
        parts.push(
            '--- ESTABLISHED SCENARIO ---\n' +
            session.scenario.accepted +
            '\n--- END SCENARIO ---',
        );
    }

    if (session.completedSteps.includes('persona') && session.persona.accepted) {
        parts.push(
            '--- PLAYER PERSONA ---\n' +
            session.persona.accepted +
            '\n--- END PERSONA ---',
        );
    }

    if (session.completedSteps.includes('character') && session.character.fields.name) {
        // Compose character description from fields
        const f = session.character.fields;
        const lines = [];
        if (f.name) lines.push(`Name: ${f.name}`);
        if (f.age) lines.push(`Age: ${f.age}`);
        if (f.hair) lines.push(`Hair: ${f.hair}`);
        if (f.eyes) lines.push(`Eyes: ${f.eyes}`);
        if (f.height) lines.push(`Height: ${f.height}`);
        if (f.body) lines.push(`Body: ${f.body}`);
        if (f.face) lines.push(`Face: ${f.face}`);
        if (f.features) lines.push(`Features: ${f.features}`);
        if (f.traits) lines.push(`Traits: ${f.traits}`);
        if (f.habits) lines.push(`Habits: ${f.habits}`);
        if (f.behavior) lines.push(`Behavior: ${f.behavior}`);
        if (f.likes) lines.push(`Likes: ${f.likes}`);
        if (f.dislikes) lines.push(`Dislikes: ${f.dislikes}`);
        if (f.personality_summary) lines.push(`Personality: ${f.personality_summary}`);
        if (f.scenario) lines.push(`Scenario: ${f.scenario}`);
        parts.push(
            '--- CHARACTER PROFILE ---\n' +
            lines.join('\n') +
            '\n--- END CHARACTER ---',
        );
    }

    if (session.completedSteps.includes('location') && session.location.entries.length > 0) {
        // Summarize: title + first paragraph of each entry
        const summaries = session.location.entries.map(e => {
            const firstPara = (e.content || '').split('\n\n')[0];
            return `${e.title}: ${firstPara}`;
        });
        parts.push(
            '--- LOCATION/SETTING ---\n' +
            summaries.join('\n\n') +
            '\n--- END LOCATION ---',
        );
    }

    return parts.join('\n\n');
}

/**
 * Serializes session to JSON and persists in extension_settings.
 */
export function saveSession() {
    extension_settings[extensionName].savedSession = JSON.stringify(session);
    saveSettingsDebounced();
}

/**
 * Restores session from saved extension_settings.
 * @returns {boolean} True if a session was restored, false if none existed.
 */
export function loadSession() {
    const saved = extension_settings[extensionName]?.savedSession;
    if (!saved) return false;
    try {
        const parsed = JSON.parse(saved);
        session = parsed;
        return true;
    } catch (e) {
        console.warn('[TavernScenarioBuilder] Saved session corrupted, starting fresh');
        resetSession();
        return false;
    }
}

/**
 * Returns whether a saved session exists in settings.
 * @returns {boolean}
 */
export function hasExistingSession() {
    return !!extension_settings[extensionName]?.savedSession;
}

/**
 * Resets session to blank state and clears the saved session.
 */
export function resetSession() {
    session = createBlankSession();
    extension_settings[extensionName].savedSession = null;
    saveSettingsDebounced();
}
