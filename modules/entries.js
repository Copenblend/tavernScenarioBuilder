/**
 * Tavern Scenario Builder — Entries Panel
 *
 * Renders the right-side entries panel as accordions showing
 * accepted content from each completed wizard step.
 * Accordion content rendering is implemented in later tickets.
 */

import { escapeHTML } from './utils.js';

/** @type {{ $container: jQuery|null }} */
const state = {
    $container: null,
};

/**
 * Initializes the entries module.
 * Stores a reference to the entries content container and renders the empty state.
 * @param {jQuery} $container - The overlay root element.
 */
export function init($container) {
    state.$container = $container.find('.tsb-entries-content');
    renderAllEntries();

    // Delegated accordion toggle
    $container.on('click.tsbEntries', '.tsb-accordion-header', handleToggle);
    // Delegated edit button → navigate to step tab
    $container.on('click.tsbEntries', '.tsb-entry-edit-btn', handleEditClick);
}

/**
 * Rebuilds the entire entries panel from current session state.
 * Currently renders the empty state; populated in later tickets.
 */
export function renderAllEntries() {
    if (!state.$container) return;
    state.$container.html(
        '<div class="tsb-entries-empty">' +
        '<i class="fa-solid fa-inbox"></i>' +
        '<span>No entries yet. Complete wizard steps to see your content here.</span>' +
        '</div>',
    );
}

/**
 * Adds or updates the accordion entry for a specific step.
 * Stub — implemented in tsb-5+.
 * @param {string} _stepName - The step to add an entry for.
 */
export function addEntry(_stepName) {
    // Implemented in tsb-5
}

/**
 * Updates an existing accordion entry for a specific step.
 * Stub — implemented in tsb-5+.
 * @param {string} _stepName - The step to update.
 */
export function updateEntry(_stepName) {
    // Implemented in tsb-5
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
        // Dynamic import to avoid circular dependency
        import('./workspace.js').then(ws => ws.switchTab(step));
    }
}

/**
 * Cleans up event handlers and nulls references.
 */
export function destroy() {
    if (state.$container) {
        // Events were delegated on the overlay root ($container's parent context)
        // They'll be cleaned up when the overlay is removed from DOM
    }
    state.$container = null;
}
