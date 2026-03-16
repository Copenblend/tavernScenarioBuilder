/**
 * Tavern Scenario Builder — Entries Panel
 *
 * Renders the right-side entries panel as accordions showing
 * accepted content from each completed wizard step.
 */

import { escapeHTML } from './utils.js';
import { getStepData, isStepCompleted, STEPS } from './state.js';

/** Step display labels and icons */
const STEP_META = {
    scenario: { label: 'Scenario', icon: 'fa-solid fa-scroll' },
    persona: { label: 'Persona', icon: 'fa-solid fa-user' },
    character: { label: 'Character', icon: 'fa-solid fa-id-card' },
    location: { label: 'Location', icon: 'fa-solid fa-map-location-dot' },
    firstMessage: { label: 'First Message', icon: 'fa-solid fa-message' },
};

/** @type {{ $container: jQuery|null, $overlayRoot: jQuery|null }} */
const state = {
    $container: null,
    $overlayRoot: null,
};

/**
 * Initializes the entries module.
 * Stores a reference to the entries content container and renders the empty state.
 * @param {jQuery} $container - The overlay root element.
 */
export function init($container) {
    state.$overlayRoot = $container;
    state.$container = $container.find('.tsb-entries-content');
    renderAllEntries();

    // Delegated accordion toggle
    $container.on('click.tsbEntries', '.tsb-accordion-header', handleToggle);
    // Delegated edit button → navigate to step tab
    $container.on('click.tsbEntries', '.tsb-entry-edit-btn', handleEditClick);
}

/**
 * Rebuilds the entire entries panel from current session state.
 * Shows entries for all completed steps, or empty state if none.
 */
export function renderAllEntries() {
    if (!state.$container) return;

    const steps = ['scenario', 'persona', 'character', 'location', 'firstMessage'];
    const completedEntries = steps.filter(s => isStepCompleted(s));

    if (completedEntries.length === 0) {
        state.$container.html(
            '<div class="tsb-entries-empty">' +
            '<i class="fa-solid fa-inbox"></i>' +
            '<span>No entries yet. Complete wizard steps to see your content here.</span>' +
            '</div>',
        );
        return;
    }

    const html = completedEntries.map(step => buildAccordionHtml(step)).join('');
    state.$container.html(html);

    // Show Create button when all steps are complete
    appendCreateButtonIfReady();
}

/**
 * Adds or updates the accordion entry for a specific step.
 * If the entry already exists, replaces it; otherwise appends it.
 * @param {string} stepName - The step to add/update an entry for.
 */
export function addEntry(stepName) {
    if (!state.$container) return;

    // Remove empty state if present
    state.$container.find('.tsb-entries-empty').remove();

    // Remove existing accordion for this step (if re-accepting)
    state.$container.find(`.tsb-accordion[data-step="${stepName}"]`).remove();

    // Append the new accordion
    const html = buildAccordionHtml(stepName);
    state.$container.append(html);

    // Show Create button when all steps are complete
    appendCreateButtonIfReady();
}

/**
 * Updates an existing accordion entry for a specific step.
 * @param {string} stepName - The step to update.
 */
export function updateEntry(stepName) {
    addEntry(stepName);
}

/**
 * Appends the "Create in SillyTavern" button if all steps are completed.
 * Removes any existing button first to prevent duplicates.
 */
function appendCreateButtonIfReady() {
    if (!state.$container) return;
    state.$container.find('.tsb-create-all-container').remove();

    const allDone = STEPS.every(s => isStepCompleted(s));
    if (!allDone) return;

    const html =
        '<div class="tsb-create-all-container">' +
            '<button class="tsb-btn tsb-btn-create-all menu_button">' +
                '<i class="fa-solid fa-hammer"></i> Create in SillyTavern' +
            '</button>' +
        '</div>';
    state.$container.append(html);
}

/**
 * Builds the accordion HTML for a given step.
 * @param {string} stepName - The step name.
 * @returns {string} HTML string for the accordion.
 */
function buildAccordionHtml(stepName) {
    const meta = STEP_META[stepName] || { label: stepName, icon: 'fa-solid fa-file' };
    const preview = getPreviewText(stepName);
    const fullContent = getFullContent(stepName);

    return (
        `<div class="tsb-accordion" data-step="${stepName}">` +
            `<div class="tsb-accordion-header">` +
                `<i class="fa-solid fa-chevron-right tsb-accordion-icon"></i>` +
                `<i class="${escapeHTML(meta.icon)} tsb-accordion-step-icon"></i>` +
                `<span class="tsb-accordion-title">${escapeHTML(meta.label)}</span>` +
                `<button class="tsb-entry-edit-btn" data-step="${stepName}" title="Edit">` +
                    `<i class="fa-solid fa-pen"></i>` +
                `</button>` +
            `</div>` +
            `<div class="tsb-accordion-body" style="display:none;">` +
                `<div class="tsb-accordion-preview">${escapeHTML(preview)}</div>` +
                `<div class="tsb-accordion-full">${escapeHTML(fullContent)}</div>` +
            `</div>` +
        `</div>`
    );
}

/**
 * Gets a short preview (first 3 lines) for a step's accepted content.
 * @param {string} stepName - The step name.
 * @returns {string} Preview text.
 */
function getPreviewText(stepName) {
    const data = getStepData(stepName);
    let text = '';

    switch (stepName) {
        case 'scenario':
            text = data?.accepted || '';
            break;
        case 'persona':
            text = data?.accepted || '';
            break;
        case 'character': {
            const name = data?.fields?.name || 'Unnamed';
            const lorebookCount = Array.isArray(data?.lorebook) ? data.lorebook.length : 0;
            text = name + '\n' + lorebookCount + ' lorebook ' + (lorebookCount === 1 ? 'entry' : 'entries');
            break;
        }
        case 'firstMessage':
            text = data?.accepted || '';
            break;
        case 'location': {
            const entries = Array.isArray(data?.entries) ? data.entries : [];
            text = entries.length + ' world info ' + (entries.length === 1 ? 'entry' : 'entries');
            if (entries.length > 0) {
                text += '\n' + entries.map(e => e.title || 'Untitled').join(', ');
            }
            break;
        }
        default:
            text = '';
    }

    // Return first 3 lines
    const lines = text.split('\n').filter(l => l.trim());
    return lines.slice(0, 3).join('\n');
}

/**
 * Gets the full content for a step's accordion body.
 * @param {string} stepName - The step name.
 * @returns {string} Full content text.
 */
function getFullContent(stepName) {
    const data = getStepData(stepName);

    switch (stepName) {
        case 'scenario':
            return data?.accepted || '';
        case 'persona':
            return data?.accepted || '';
        case 'character':
            return buildCharacterContent(data);
        case 'location':
            return buildLocationContent(data);
        case 'firstMessage':
            return data?.accepted || '';
        default:
            return '';
    }
}

/**
 * Builds a full text summary of character data for the entries accordion.
 * @param {object} data - The character step data.
 * @returns {string} Formatted text with sub-sections.
 */
function buildCharacterContent(data) {
    const fields = data?.fields || {};
    const lorebook = data?.lorebook || [];
    const lines = [];

    if (fields.name) lines.push('Name: ' + fields.name);

    // Physical
    const physical = ['hair', 'eyes', 'skin', 'body', 'height', 'age_appearance', 'clothing_style', 'distinguishing_features']
        .filter(k => fields[k])
        .map(k => fields[k]);
    if (physical.length) lines.push('\n— Physical Description —\n' + physical.join('. '));

    // Personality
    const personality = ['personality_overview', 'strengths', 'flaws', 'fears', 'desires', 'quirks_habits']
        .filter(k => fields[k])
        .map(k => fields[k]);
    if (personality.length) lines.push('\n— Personality —\n' + personality.join('. '));

    // Advanced
    const advanced = ['backstory', 'relationships', 'world_info', 'system_prompt', 'post_history_instructions'];
    const advParts = advanced.filter(k => fields[k]);
    if (advParts.length) lines.push('\n— Advanced Definitions —\n' + advParts.map(k => fields[k]).join('\n'));

    // Lorebook
    lines.push('\n— Lorebook —\n' + lorebook.length + ' ' + (lorebook.length === 1 ? 'entry' : 'entries'));

    return lines.join('\n');
}

/**
 * Builds a full text summary of location data for the entries accordion.
 * @param {object} data - The location step data.
 * @returns {string} Formatted text listing all entries.
 */
function buildLocationContent(data) {
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    if (entries.length === 0) return 'No location entries.';

    return entries.map(e => {
        const title = e.title || 'Untitled';
        const keywords = Array.isArray(e.keywords) ? e.keywords.join(', ') : '';
        const content = e.content || '';
        return '— ' + title + ' —\nKeywords: ' + keywords + '\n' + content;
    }).join('\n\n');
}

/**
 * Toggles accordion body visibility on header click.
 * @param {Event} event - The delegated click event.
 */
function handleToggle(event) {
    const $header = $(event.currentTarget);
    const $accordion = $header.closest('.tsb-accordion');
    const $body = $accordion.find('.tsb-accordion-body');
    const $icon = $header.find('.tsb-accordion-icon');

    $body.slideToggle(200);
    $icon.toggleClass('tsb-accordion-open');
}

/**
 * Navigates to the step's tab when the edit button is clicked.
 * @param {Event} event - The delegated click event.
 */
function handleEditClick(event) {
    event.stopPropagation(); // Don't toggle the accordion
    const step = $(event.currentTarget).data('step');
    if (step) {
        // Dynamic import to avoid circular dependency with workspace.js
        import('./workspace.js').then(ws => ws.switchTab(step));
    }
}

/**
 * Cleans up event handlers and nulls references.
 */
export function destroy() {
    if (state.$overlayRoot) {
        state.$overlayRoot.off('.tsbEntries');
    }
    state.$container = null;
    state.$overlayRoot = null;
}
