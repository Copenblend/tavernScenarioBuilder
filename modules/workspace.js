/**
 * Tavern Scenario Builder — Workspace & Tab Management
 *
 * Manages the left panel: tab bar rendering, tab switching,
 * and step content area. Step-specific content rendering is
 * added in later tickets.
 */

import { escapeHTML } from './utils.js';

/** Tab definitions: step name → display label + icon */
const TABS = [
    { step: 'scenario', label: 'Scenario', icon: 'fa-solid fa-scroll' },
    { step: 'persona', label: 'Persona', icon: 'fa-solid fa-user' },
    { step: 'character', label: 'Character', icon: 'fa-solid fa-id-card' },
    { step: 'location', label: 'Location', icon: 'fa-solid fa-map-location-dot' },
    { step: 'firstMessage', label: 'First Message', icon: 'fa-solid fa-message' },
];

/** @type {{ $container: jQuery|null, activeTab: string|null, generationId: number }} */
const state = {
    $container: null,
    activeTab: null,
    generationId: 0,
};

/**
 * Initializes the workspace module.
 * Renders the tab bar, activates the Scenario tab, and binds event delegation.
 * @param {jQuery} $container - The overlay root element.
 */
export function init($container) {
    state.$container = $container;
    renderTabBar();
    switchTab('scenario');

    // Delegated tab click handler
    $container.on('click.tsbWorkspace', '.tsb-tab', handleTabClick);
}

/**
 * Renders tab buttons into the tab bar.
 * Only the Scenario tab is visible initially; others are locked (hidden).
 */
function renderTabBar() {
    const parts = [];
    for (const tab of TABS) {
        const lockedClass = tab.step === 'scenario' ? '' : ' tsb-tab-locked';
        parts.push(
            `<div class="tsb-tab${lockedClass}" data-step="${tab.step}">` +
            `<i class="${escapeHTML(tab.icon)}"></i>` +
            `<span>${escapeHTML(tab.label)}</span>` +
            `</div>`,
        );
    }
    state.$container.find('.tsb-tab-bar').html(parts.join(''));
}

/**
 * Switches the active tab and renders its content.
 * @param {string} stepName - The step to activate (e.g. 'scenario').
 */
export function switchTab(stepName) {
    const $tab = state.$container.find(`.tsb-tab[data-step="${stepName}"]`);
    if ($tab.hasClass('tsb-tab-locked')) return;

    // Update active state in tab bar
    state.$container.find('.tsb-tab').removeClass('tsb-tab-active');
    $tab.addClass('tsb-tab-active');
    state.activeTab = stepName;

    // Render placeholder content for the step
    const label = TABS.find(t => t.step === stepName)?.label ?? stepName;
    state.$container.find('.tsb-tab-content').html(
        `<div class="tsb-step-placeholder">${escapeHTML(label)} content will appear here.</div>`,
    );
}

/**
 * Makes a locked tab visible in the tab bar.
 * @param {string} stepName - The step to unlock.
 */
export function unlockTab(stepName) {
    state.$container
        .find(`.tsb-tab[data-step="${stepName}"]`)
        .removeClass('tsb-tab-locked');
}

/**
 * Handles click on a tab element.
 * @param {Event} event - The delegated click event.
 */
function handleTabClick(event) {
    const step = $(event.currentTarget).data('step');
    if (step) switchTab(step);
}

/**
 * Cleans up event handlers and nulls references.
 */
export function destroy() {
    if (state.$container) {
        state.$container.off('.tsbWorkspace');
    }
    state.$container = null;
    state.activeTab = null;
}
