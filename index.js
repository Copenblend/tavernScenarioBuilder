/**
 * Tavern Scenario Builder — Entry Point
 *
 * Extension initialization, sidebar button injection, and overlay lifecycle.
 * This is the main entry point loaded by SillyTavern's extension system.
 */

import { saveSettingsDebounced } from '/script.js';
import { extension_settings } from '/scripts/extensions.js';

const extensionName = 'TavernScenarioBuilder';

const DEFAULT_SETTINGS = {
    splitRatio: 75,
    savedSession: null,
};

/**
 * Merges default settings with any previously saved extension settings.
 */
function loadSettings() {
    extension_settings[extensionName] = {
        ...DEFAULT_SETTINGS,
        ...extension_settings[extensionName],
    };
}

/**
 * Creates the sidebar button and inserts it into SillyTavern's character panel.
 * Guards against duplicate insertion.
 */
function addTsbButton() {
    if ($('#rm_button_tsb').length > 0) {
        return;
    }

    const $button = $('<div>', {
        id: 'rm_button_tsb',
        class: 'menu_button fa-solid fa-hat-wizard',
        title: 'Tavern Scenario Builder',
    });

    $button.on('click', function (event) {
        event.stopPropagation();
        openTsb();
    });

    $('#rm_button_group_chats').after($button);

    console.log('[TavernScenarioBuilder] Sidebar button added');
}

/**
 * Opens the Tavern Scenario Builder overlay.
 * If the overlay already exists, brings it to the front instead of duplicating.
 */
function openTsb() {
    if ($('#tsb-overlay').length > 0) {
        return;
    }

    const $overlay = $('<div>', {
        id: 'tsb-overlay',
        class: 'tsb-overlay',
    });

    $overlay.html(`
        <div class="tsb-header">
            <div class="tsb-header-title">
                <i class="fa-solid fa-hat-wizard"></i>
                <span>Tavern Scenario Builder</span>
            </div>
            <button class="tsb-close-btn menu_button" title="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `);

    $(document.body).append($overlay);

    console.log('[TavernScenarioBuilder] Overlay opened');
}

/**
 * Closes the overlay and removes it from the DOM.
 */
function closeTsb() {
    $('#tsb-overlay').remove();
    console.log('[TavernScenarioBuilder] Overlay closed');
}

// Delegate close button click on document so it works with dynamically created overlay
$(document).on('click', '.tsb-close-btn', closeTsb);

// Extension initialization
jQuery(async () => {
    loadSettings();
    addTsbButton();
});
