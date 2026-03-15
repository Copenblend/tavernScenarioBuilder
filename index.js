/**
 * Tavern Scenario Builder — Entry Point
 *
 * Extension initialization, sidebar button injection, overlay lifecycle,
 * and split-panel resize handling.
 */

import { renderExtensionTemplateAsync } from '/scripts/extensions.js';
import { loadSettings, getSetting, setSetting } from './modules/state.js';

const extensionFolderPath = 'third-party/SillyTavern-TavernScenarioBuilder';

/** Resize tracking state — active only while dragging the split handle */
let resizeState = null;

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
 * Loads the workspace template and applies saved split ratio.
 */
async function openTsb() {
    if ($('#tsb-overlay').length > 0) {
        return;
    }

    const templateHtml = await renderExtensionTemplateAsync(extensionFolderPath, 'templates/workspace');

    const $overlay = $('<div>', {
        id: 'tsb-overlay',
        class: 'tsb-overlay',
    });

    $overlay.html(templateHtml);

    // Apply saved split ratio as explicit width percentage
    const ratio = getSetting('splitRatio');
    $overlay.find('.tsb-workspace').css('width', ratio + '%');

    // Delegate close button click within the overlay
    $overlay.on('click', '.tsb-close-btn', closeTsb);

    // Set up resize handle
    $overlay.on('mousedown', '.tsb-split-handle', onResizeStart);

    $(document.body).append($overlay);

    console.log('[TavernScenarioBuilder] Overlay opened');
}

/**
 * Closes the overlay, cleans up event listeners, and removes it from DOM.
 */
function closeTsb() {
    cleanupResize();
    $('#tsb-overlay').remove();
    console.log('[TavernScenarioBuilder] Overlay closed');
}

/**
 * Begins tracking a split-handle drag.
 * @param {MouseEvent} event - The mousedown event on the split handle.
 */
function onResizeStart(event) {
    event.preventDefault();

    const body = document.querySelector('#tsb-overlay .tsb-body');
    const bodyRect = body.getBoundingClientRect();

    resizeState = {
        bodyLeft: bodyRect.left,
        bodyWidth: bodyRect.width,
        rafId: null,
        lastRatio: null,
    };

    // Prevent text selection and set resize cursor on entire page during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    body.classList.add('tsb-resizing');

    $(document).on('mousemove.tsbResize', onResizeMove);
    $(document).on('mouseup.tsbResize', onResizeEnd);
}

/**
 * Handles mouse movement during a split-handle drag.
 * Maps mouse X position directly to workspace width percentage.
 * @param {MouseEvent} event - The mousemove event.
 */
function onResizeMove(event) {
    if (!resizeState) return;

    // Direct mapping: mouse X → workspace width as percentage of body
    let ratio = ((event.clientX - resizeState.bodyLeft) / resizeState.bodyWidth) * 100;
    ratio = Math.max(25, Math.min(75, ratio));

    resizeState.lastRatio = ratio;

    if (!resizeState.rafId) {
        resizeState.rafId = requestAnimationFrame(applyResize);
    }
}

/**
 * Applies the pending width inside a requestAnimationFrame callback.
 */
function applyResize() {
    if (!resizeState || resizeState.lastRatio === null) return;

    const workspace = document.querySelector('#tsb-overlay .tsb-workspace');
    if (workspace) {
        workspace.style.width = resizeState.lastRatio + '%';
    }
    resizeState.rafId = null;
}

/**
 * Ends the resize drag and persists the final split ratio.
 */
function onResizeEnd() {
    if (resizeState) {
        if (resizeState.rafId) {
            cancelAnimationFrame(resizeState.rafId);
        }
        // Apply and persist final value
        if (resizeState.lastRatio !== null) {
            const workspace = document.querySelector('#tsb-overlay .tsb-workspace');
            if (workspace) {
                workspace.style.width = resizeState.lastRatio + '%';
            }
            setSetting('splitRatio', Math.round(resizeState.lastRatio));
        }
    }

    cleanupResize();
}

/**
 * Removes resize event listeners and clears tracking state.
 */
function cleanupResize() {
    if (resizeState?.rafId) {
        cancelAnimationFrame(resizeState.rafId);
    }
    resizeState = null;
    $(document).off('.tsbResize');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    const body = document.querySelector('#tsb-overlay .tsb-body');
    if (body) body.classList.remove('tsb-resizing');
}

// Extension initialization
jQuery(async () => {
    loadSettings();
    addTsbButton();
});
