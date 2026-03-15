/**
 * Tavern Scenario Builder — Workspace & Tab Management
 *
 * Manages the left panel: tab bar rendering, tab switching,
 * step content rendering, and user interactions (Generate, Accept, Regenerate).
 */

import { escapeHTML } from './utils.js';
import {
    getStepData, updateStepData, acceptStep,
    getCompletedSteps, STEPS, getSetting, setSetting,
} from './state.js';
import { generateScenario, regenerateScenario, generatePersona, regeneratePersona } from './generation.js';
import { renderAllEntries, addEntry } from './entries.js';
import { converter } from '/script.js';

/** Tab definitions: step name → display label + icon */
const TABS = [
    { step: 'scenario', label: 'Scenario', icon: 'fa-solid fa-scroll' },
    { step: 'persona', label: 'Persona', icon: 'fa-solid fa-user' },
    { step: 'character', label: 'Character', icon: 'fa-solid fa-id-card' },
    { step: 'location', label: 'Location', icon: 'fa-solid fa-map-location-dot' },
    { step: 'firstMessage', label: 'First Message', icon: 'fa-solid fa-message' },
];

/** @type {{ $container: jQuery|null, activeTab: string|null, generationId: number, generating: boolean }} */
const state = {
    $container: null,
    activeTab: null,
    generationId: 0,
    generating: false,
};

/**
 * Initializes the workspace module.
 * Renders the tab bar, activates the appropriate tab, and binds event delegation.
 * @param {jQuery} $container - The overlay root element.
 */
export function init($container) {
    state.$container = $container;
    state.generating = false;
    renderTabBar();

    // Unlock completed steps' tabs and show the current step
    const completed = getCompletedSteps();
    for (const step of completed) {
        unlockTab(step);
        // Also unlock the next tab after each completed step
        const idx = STEPS.indexOf(step);
        if (idx >= 0 && idx < STEPS.length - 1) {
            unlockTab(STEPS[idx + 1]);
        }
    }

    // Show the first incomplete step, or scenario if all done
    const firstIncomplete = STEPS.find(s => !completed.includes(s)) || 'scenario';
    switchTab(firstIncomplete);

    // Delegated event handlers
    $container.on('click.tsbWorkspace', '.tsb-tab', handleTabClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-generate', handleGenerateClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-accept', handleAcceptClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-regenerate', handleRegenerateClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-edit', handleEditClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-save', handleSaveClick);

    // Constraint inputs — persist on change
    $container.on('input.tsbWorkspace', '#tsb-hooks', function () {
        setSetting('scenarioHooks', parseInt($(this).val()) || 0);
    });
    $container.on('input.tsbWorkspace', '#tsb-max-response-tokens', function () {
        setSetting('scenarioMaxTokens', parseInt($(this).val()) || 0);
    });
    $container.on('input.tsbWorkspace', '#tsb-persona-max-tokens', function () {
        setSetting('personaMaxTokens', parseInt($(this).val()) || 0);
    });

    // Section toggles — rebuild enabled list on change
    $container.on('change.tsbWorkspace', '.tsb-section-toggle input', function () {
        const enabled = [];
        $container.find('.tsb-section-toggle input:checked').each(function () {
            enabled.push($(this).data('section'));
        });
        setSetting('scenarioSections', enabled);
    });

    // Tooltip positioning — use fixed position so it escapes overflow containers
    $container.on('mouseenter.tsbWorkspace', '.tsb-tooltip', function () {
        const $tip = $(this).find('.tsb-tooltip-text');
        const rect = this.getBoundingClientRect();
        $tip.css({
            display: 'block',
            top: (rect.bottom + 8) + 'px',
            left: Math.max(8, rect.left - 120) + 'px',
        });
    });
    $container.on('mouseleave.tsbWorkspace', '.tsb-tooltip', function () {
        $(this).find('.tsb-tooltip-text').css('display', 'none');
    });
}

/**
 * Renders tab buttons into the tab bar.
 * Only the Scenario tab is visible initially; others are locked (hidden).
 * Completed steps show a checkmark.
 */
function renderTabBar() {
    const completed = getCompletedSteps();
    const parts = [];
    for (const tab of TABS) {
        const lockedClass = tab.step === 'scenario' ? '' : ' tsb-tab-locked';
        const completedIcon = completed.includes(tab.step)
            ? ' <i class="fa-solid fa-check"></i>'
            : '';
        parts.push(
            `<div class="tsb-tab${lockedClass}" data-step="${tab.step}">` +
            `<i class="${escapeHTML(tab.icon)}"></i>` +
            `<span>${escapeHTML(tab.label)}</span>` +
            completedIcon +
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

    // Render step-specific content
    renderStepContent(stepName);
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
 * Renders the content area for a specific step.
 * @param {string} stepName - The step to render.
 */
function renderStepContent(stepName) {
    switch (stepName) {
        case 'scenario':
            renderScenarioStep();
            break;
        case 'persona':
            renderPersonaStep();
            break;
        default: {
            // Placeholder for unimplemented steps
            const label = TABS.find(t => t.step === stepName)?.label ?? stepName;
            state.$container.find('.tsb-tab-content').html(
                `<div class="tsb-step-placeholder">${escapeHTML(label)} content will appear here.</div>`,
            );
        }
    }
}

/**
 * Renders markdown content as sanitized HTML.
 * @param {string} markdown - Raw markdown text.
 * @returns {string} Sanitized HTML string.
 */
function renderMarkdown(markdown) {
    const html = converter.makeHtml(markdown);
    return DOMPurify.sanitize(html);
}

/**
 * Reads current scenario constraint settings.
 * @returns {{ hooks: number, maxTokens: number, sections: string[] }}
 */
function getScenarioConstraints() {
    return {
        hooks: getSetting('scenarioHooks'),
        maxTokens: getSetting('scenarioMaxTokens'),
        sections: getSetting('scenarioSections') || [],
    };
}

/**
 * Reads current persona constraint settings.
 * @returns {{ maxTokens: number }}
 */
function getPersonaConstraints() {
    return {
        maxTokens: getSetting('personaMaxTokens'),
    };
}

/** Section definitions for the scenario output format */
const SCENARIO_SECTIONS = [
    { key: 'setting', label: 'Setting' },
    { key: 'timePeriod', label: 'Time Period' },
    { key: 'premise', label: 'Premise' },
    { key: 'keyThemes', label: 'Key Themes' },
    { key: 'toneAtmosphere', label: 'Tone & Atmosphere' },
    { key: 'storyHooks', label: 'Story Hooks' },
];

/**
 * Renders the Scenario step UI: prompt, markdown preview or textarea, Generate/Accept/Regenerate buttons.
 */
function renderScenarioStep() {
    const stepData = getStepData('scenario');

    // Determine what to show in the output area
    const outputContent = stepData.accepted || stepData.generated || '';
    const hasOutput = !!outputContent;

    const hooks = getSetting('scenarioHooks');
    const maxTokens = getSetting('scenarioMaxTokens');
    const enabledSections = getSetting('scenarioSections') || [];

    // Build section checkboxes
    const sectionChecks = SCENARIO_SECTIONS.map(s => {
        const checked = enabledSections.includes(s.key) ? ' checked' : '';
        return '<label class="tsb-section-toggle">' +
            '<input type="checkbox" data-section="' + s.key + '"' + checked + ' />' +
            '<span>' + escapeHTML(s.label) + '</span>' +
        '</label>';
    }).join('');

    const html =
        '<div class="tsb-step" data-step="scenario">' +
            '<div class="tsb-step-input">' +
                '<label class="tsb-step-label">Briefly describe the story/scenario for your chat' +
                    '<span class="tsb-tooltip">' +
                        '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                        '<span class="tsb-tooltip-text">This scenario will be included as context for every subsequent generation (persona, character, location, first message). Be as detailed as you can, but keep in mind that longer scenarios consume more of your AI context window, leaving less room for other content.</span>' +
                    '</span>' +
                '</label>' +
                '<textarea class="tsb-input-area" placeholder="e.g. A dark fantasy world where an exiled knight seeks redemption...">' +
                    escapeHTML(stepData.userInput) +
                '</textarea>' +
                '<div class="tsb-constraints">' +
                    '<div class="tsb-constraint">' +
                        '<label for="tsb-hooks">Story Hooks</label>' +
                        '<input type="number" id="tsb-hooks" class="tsb-constraint-input text_pole" ' +
                            'min="0" max="20" step="1" value="' + hooks + '" ' +
                            'title="Number of story hooks to generate (0 = none)" />' +
                    '</div>' +
                    '<div class="tsb-constraint">' +
                        '<label for="tsb-max-response-tokens">Max Tokens</label>' +
                        '<input type="number" id="tsb-max-response-tokens" class="tsb-constraint-input text_pole" ' +
                            'min="0" max="100000" step="50" value="' + maxTokens + '" ' +
                            'title="Maximum response tokens (0 = no limit)" />' +
                    '</div>' +
                '</div>' +
                '<div class="tsb-section-toggles">' +
                    '<label class="tsb-step-label tsb-section-toggles-label">Output Sections</label>' +
                    '<div class="tsb-section-toggles-list">' +
                        sectionChecks +
                    '</div>' +
                '</div>' +
                '<div class="tsb-step-actions">' +
                    '<button class="tsb-btn tsb-btn-generate menu_button" ' +
                        (hasOutput ? 'style="display:none"' : '') + '>' +
                        '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="tsb-step-output" ' + (hasOutput ? '' : 'style="display:none"') + '>' +
                '<div class="tsb-output-header">' +
                    '<label class="tsb-step-label">Generated Scenario' +
                        '<span class="tsb-tooltip">' +
                            '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                            '<span class="tsb-tooltip-text">Review and edit the generated scenario to ensure your story stays consistent. Any changes you make here will carry through to all subsequent generations.</span>' +
                        '</span>' +
                    '</label>' +
                    '<button class="tsb-btn tsb-btn-edit menu_button" title="Edit">' +
                        '<i class="fa-solid fa-pen"></i> Edit' +
                    '</button>' +
                '</div>' +
                '<div class="tsb-markdown-preview">' +
                    (hasOutput ? renderMarkdown(outputContent) : '') +
                '</div>' +
                '<textarea class="tsb-output-area" style="display:none">' +
                    escapeHTML(outputContent) +
                '</textarea>' +
                '<div class="tsb-step-actions">' +
                    '<button class="tsb-btn tsb-btn-accept menu_button">' +
                        '<i class="fa-solid fa-check"></i> Accept' +
                    '</button>' +
                    '<button class="tsb-btn tsb-btn-regenerate menu_button">' +
                        '<i class="fa-solid fa-rotate"></i> Regenerate' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    state.$container.find('.tsb-tab-content').html(html);
}

/**
 * Renders the Persona step UI: prompt, textarea, Generate/Accept/Regenerate buttons.
 * Same structure as scenario but without constraint controls or section toggles.
 * Persona output is prose, not markdown with headers.
 */
function renderPersonaStep() {
    const stepData = getStepData('persona');
    const outputContent = stepData.accepted || stepData.generated || '';
    const hasOutput = !!outputContent;
    const maxTokens = getSetting('personaMaxTokens');

    const html =
        '<div class="tsb-step" data-step="persona">' +
            '<div class="tsb-step-input">' +
                '<label class="tsb-step-label">Describe your player persona for this scenario' +
                    '<span class="tsb-tooltip">' +
                        '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                        '<span class="tsb-tooltip-text">This is for your player character. Consider keeping the output under 300 tokens to save on context window space — the persona is included in every subsequent generation.</span>' +
                    '</span>' +
                '</label>' +
                '<textarea class="tsb-input-area" placeholder="e.g. A disgraced noble seeking to reclaim their family honor...">' +
                    escapeHTML(stepData.userInput) +
                '</textarea>' +
                '<div class="tsb-constraints">' +
                    '<div class="tsb-constraint">' +
                        '<label for="tsb-persona-max-tokens">Max Tokens</label>' +
                        '<input type="number" id="tsb-persona-max-tokens" class="tsb-constraint-input text_pole" ' +
                            'min="0" max="100000" step="50" value="' + maxTokens + '" ' +
                            'title="Maximum response tokens (0 = no limit)" />' +
                    '</div>' +
                '</div>' +
                '<div class="tsb-step-actions">' +
                    '<button class="tsb-btn tsb-btn-generate menu_button" ' +
                        (hasOutput ? 'style="display:none"' : '') + '>' +
                        '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="tsb-step-output" ' + (hasOutput ? '' : 'style="display:none"') + '>' +
                '<div class="tsb-output-header">' +
                    '<label class="tsb-step-label">Generated Persona</label>' +
                    '<button class="tsb-btn tsb-btn-edit menu_button" title="Edit">' +
                        '<i class="fa-solid fa-pen"></i> Edit' +
                    '</button>' +
                '</div>' +
                '<div class="tsb-markdown-preview">' +
                    (hasOutput ? renderMarkdown(outputContent) : '') +
                '</div>' +
                '<textarea class="tsb-output-area" style="display:none">' +
                    escapeHTML(outputContent) +
                '</textarea>' +
                '<div class="tsb-step-actions">' +
                    '<button class="tsb-btn tsb-btn-accept menu_button">' +
                        '<i class="fa-solid fa-check"></i> Accept' +
                    '</button>' +
                    '<button class="tsb-btn tsb-btn-regenerate menu_button">' +
                        '<i class="fa-solid fa-rotate"></i> Regenerate' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    state.$container.find('.tsb-tab-content').html(html);
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
 * Handles clicking the Generate button.
 * Reads user input, calls AI generation, and displays the result.
 * @param {Event} event - The delegated click event.
 */
async function handleGenerateClick(event) {
    if (state.generating) return;

    const $step = $(event.currentTarget).closest('.tsb-step');
    const stepName = $step.data('step');
    const userInput = $step.find('.tsb-input-area').val()?.trim();

    if (!userInput) {
        toastr.warning('Please enter a description first.');
        return;
    }

    // Save user input to state
    updateStepData(stepName, { userInput });

    // Stale generation guard
    const currentGenId = ++state.generationId;
    state.generating = true;
    setButtonsDisabled(true);
    showLoading();

    try {
        let result = '';
        if (stepName === 'scenario') {
            result = await generateScenario(userInput, getScenarioConstraints());
        } else if (stepName === 'persona') {
            result = await generatePersona(userInput, getPersonaConstraints());
        }

        // Guard against stale result
        if (currentGenId !== state.generationId) return;

        if (!result) {
            toastr.warning('AI returned an empty response. Try generating again.');
            return;
        }

        // Store generated output and show it
        updateStepData(stepName, { generated: result });

        const $output = $step.find('.tsb-step-output');
        $output.find('.tsb-output-area').val(result);
        $output.find('.tsb-markdown-preview').html(renderMarkdown(result)).show();
        $output.find('.tsb-output-area').hide();
        $output.find('.tsb-btn-edit').html('<i class="fa-solid fa-pen"></i> Edit');
        $output.show();
        $step.find('.tsb-btn-generate').hide();
    } catch (err) {
        if (currentGenId !== state.generationId) return;
        console.error('[TavernScenarioBuilder] Generation failed:', err);
        toastr.error('Generation failed. Please check your connection and try again.');
    } finally {
        if (currentGenId === state.generationId) {
            state.generating = false;
            setButtonsDisabled(false);
            hideLoading();
        }
    }
}

/**
 * Handles clicking the Accept button.
 * Stores accepted content, updates entries panel, unlocks next tab.
 * If in edit mode, saves the textarea content first.
 * @param {Event} event - The delegated click event.
 */
function handleAcceptClick(event) {
    const $step = $(event.currentTarget).closest('.tsb-step');
    const stepName = $step.data('step');

    // If user is editing, grab the textarea value; otherwise use state
    const $textarea = $step.find('.tsb-output-area');
    const isEditing = $textarea.is(':visible');
    const stepData = getStepData(stepName);
    let editedText;

    if (isEditing) {
        editedText = $textarea.val()?.trim();
        // Save edits back to state and switch to preview
        if (editedText) {
            updateStepData(stepName, { generated: editedText });
            $step.find('.tsb-markdown-preview').html(renderMarkdown(editedText)).show();
            $textarea.hide();
            $step.find('.tsb-btn-edit')
                .removeClass('tsb-btn-save').addClass('tsb-btn-edit')
                .html('<i class="fa-solid fa-pen"></i> Edit');
        }
    } else {
        editedText = stepData.generated || stepData.accepted || '';
    }

    if (!editedText) {
        toastr.warning('Nothing to accept. Generate content first.');
        return;
    }

    // Save accepted content
    updateStepData(stepName, { accepted: editedText });
    acceptStep(stepName);

    // Update entries panel
    addEntry(stepName);

    // Unlock the next tab and switch to it
    const currentIndex = STEPS.indexOf(stepName);
    if (currentIndex >= 0 && currentIndex < STEPS.length - 1) {
        const nextStep = STEPS[currentIndex + 1];
        unlockTab(nextStep);
        // Mark current tab as completed in the tab bar
        state.$container.find(`.tsb-tab[data-step="${stepName}"]`)
            .addClass('tsb-tab-completed')
            .append(' <i class="fa-solid fa-check"></i>');
        switchTab(nextStep);
    }

    toastr.success(`${TABS.find(t => t.step === stepName)?.label || stepName} accepted!`);
}

/**
 * Handles clicking the Regenerate button.
 * Re-generates content with a variation instruction.
 * @param {Event} event - The delegated click event.
 */
async function handleRegenerateClick(event) {
    if (state.generating) return;

    const $step = $(event.currentTarget).closest('.tsb-step');
    const stepName = $step.data('step');
    const stepData = getStepData(stepName);

    // Read current prompt from textarea — user may have edited it since last generate
    const currentInput = $step.find('.tsb-input-area').val()?.trim();
    const userInput = currentInput || stepData.userInput;
    const previousOutput = stepData.generated || stepData.accepted || '';

    if (!userInput) {
        toastr.warning('No input to regenerate from.');
        return;
    }

    // Persist the (possibly updated) prompt
    if (currentInput) {
        updateStepData(stepName, { userInput });
    }

    const currentGenId = ++state.generationId;
    state.generating = true;
    setButtonsDisabled(true);
    showLoading();

    try {
        let result = '';
        if (stepName === 'scenario') {
            result = await regenerateScenario(userInput, previousOutput, getScenarioConstraints());
        } else if (stepName === 'persona') {
            result = await regeneratePersona(userInput, previousOutput, getPersonaConstraints());
        }

        if (currentGenId !== state.generationId) return;

        if (!result) {
            toastr.warning('AI returned an empty response. Try regenerating again.');
            return;
        }

        updateStepData(stepName, { generated: result });
        $step.find('.tsb-output-area').val(result);
        $step.find('.tsb-markdown-preview').html(renderMarkdown(result)).show();
        $step.find('.tsb-output-area').hide();
        $step.find('.tsb-btn-edit').html('<i class="fa-solid fa-pen"></i> Edit');
    } catch (err) {
        if (currentGenId !== state.generationId) return;
        console.error('[TavernScenarioBuilder] Regeneration failed:', err);
        toastr.error('Regeneration failed. Please check your connection and try again.');
    } finally {
        if (currentGenId === state.generationId) {
            state.generating = false;
            setButtonsDisabled(false);
            hideLoading();
        }
    }
}

/**
 * Handles clicking the Edit button.
 * Switches from markdown preview to textarea for editing.
 * @param {Event} event - The delegated click event.
 */
function handleEditClick(event) {
    const $step = $(event.currentTarget).closest('.tsb-step');
    const $preview = $step.find('.tsb-markdown-preview');
    const $textarea = $step.find('.tsb-output-area');
    const $btn = $(event.currentTarget);

    // Switch to edit mode
    $preview.hide();
    $textarea.show().focus();

    // Change button to Save
    $btn.removeClass('tsb-btn-edit').addClass('tsb-btn-save')
        .html('<i class="fa-solid fa-floppy-disk"></i> Save');
}

/**
 * Handles clicking the Save button (after editing).
 * Saves textarea content to state and switches back to markdown preview.
 * @param {Event} event - The delegated click event.
 */
function handleSaveClick(event) {
    const $step = $(event.currentTarget).closest('.tsb-step');
    const stepName = $step.data('step');
    const $preview = $step.find('.tsb-markdown-preview');
    const $textarea = $step.find('.tsb-output-area');
    const $btn = $(event.currentTarget);

    const editedText = $textarea.val()?.trim();
    if (editedText) {
        updateStepData(stepName, { generated: editedText });
        $preview.html(renderMarkdown(editedText));
    }

    // Switch back to preview mode
    $textarea.hide();
    $preview.show();

    // Change button back to Edit
    $btn.removeClass('tsb-btn-save').addClass('tsb-btn-edit')
        .html('<i class="fa-solid fa-pen"></i> Edit');
}

/**
 * Shows a loading overlay over the tab content area.
 */
function showLoading() {
    const $content = state.$container?.find('.tsb-tab-content');
    if (!$content || $content.find('.tsb-loading').length > 0) return;
    $content.append(
        '<div class="tsb-loading">' +
            '<div class="tsb-loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>' +
            '<span>Generating...</span>' +
        '</div>',
    );
}

/**
 * Removes the loading overlay from the tab content area.
 */
function hideLoading() {
    state.$container?.find('.tsb-loading').remove();
}

/**
 * Enables or disables all action buttons during generation.
 * @param {boolean} disabled - Whether to disable buttons.
 */
function setButtonsDisabled(disabled) {
    state.$container?.find('.tsb-btn').prop('disabled', disabled);
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
    state.generating = false;
}
