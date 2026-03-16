/**
 * Tavern Scenario Builder — Workspace & Tab Management
 *
 * Manages the left panel: tab bar rendering, tab switching,
 * step content rendering, and user interactions (Generate, Accept, Regenerate).
 */

import { escapeHTML, debounce } from './utils.js';
import {
    getStepData, updateStepData, acceptStep,
    getCompletedSteps, STEPS, getSetting, setSetting,
    setCharacterField, setCharacterLorebook, setLocationEntries,
} from './state.js';
import {
    generateScenario, regenerateScenario,
    generatePersona, regeneratePersona,
    generateCharacter, regenerateCharacterField,
    generateCharacterLorebook, generateSingleLorebookEntry, regenerateLorebookEntry,
    generateLocation, generateSingleLocationEntry, regenerateLocationEntry,
    generateSpeechExample,
    generateFirstMessage, regenerateFirstMessage,
} from './generation.js';
import { renderAllEntries, addEntry } from './entries.js';
import { createAll } from './creation.js';
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

    // Character field handlers
    $container.on('click.tsbWorkspace', '.tsb-btn-regen-field', handleFieldRegenerateClick);
    $container.on('input.tsbWorkspace', '.tsb-field-input[data-field]', handleFieldInput);
    $container.on('input.tsbWorkspace', '.tsb-speech-example-input', handleSpeechExampleInput);
    $container.on('click.tsbWorkspace', '.tsb-btn-add-example', handleAddExampleClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-remove-example', handleRemoveExampleClick);

    // Lorebook handlers
    $container.on('click.tsbWorkspace', '.tsb-btn-gen-lorebook', handleGenLorebookClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-regen-lorebook', handleRegenLorebookClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-remove-lorebook', handleRemoveLorebookClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-add-lorebook', handleAddLorebookClick);
    $container.on('input.tsbWorkspace', '.tsb-lorebook-title-input', handleLorebookTitleInput);
    $container.on('input.tsbWorkspace', '.tsb-lorebook-keywords-input', handleLorebookKeywordsInput);
    $container.on('input.tsbWorkspace', '.tsb-lorebook-content', handleLorebookContentInput);
    $container.on('input.tsbWorkspace', '.tsb-lorebook-prompt-input', handleLorebookPromptInput);

    // Location handlers
    $container.on('click.tsbWorkspace', '.tsb-btn-gen-location', handleGenLocationClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-regen-location', handleRegenLocationClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-remove-location', handleRemoveLocationClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-add-location', handleAddLocationClick);
    $container.on('input.tsbWorkspace', '.tsb-location-title-input', handleLocationTitleInput);
    $container.on('input.tsbWorkspace', '.tsb-location-keywords-input', handleLocationKeywordsInput);
    $container.on('input.tsbWorkspace', '.tsb-location-content', handleLocationContentInput);
    $container.on('input.tsbWorkspace', '.tsb-location-prompt-input', handleLocationPromptInput);

    // Speech example handlers
    $container.on('click.tsbWorkspace', '.tsb-btn-gen-example', handleGenerateExampleClick);

    // First message handlers
    $container.on('click.tsbWorkspace', '.tsb-btn-generate-first-message', handleGenerateFirstMessageClick);
    $container.on('click.tsbWorkspace', '.tsb-btn-create-all', handleCreateAllClick);

    // Avatar upload handler
    $container.on('change.tsbWorkspace', '.tsb-avatar-file-input', handleAvatarUpload);

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

    // Persona name input
    $container.on('input.tsbWorkspace', '.tsb-persona-name-input', function () {
        const stepData = getStepData('persona');
        stepData.personaName = $(this).val() || '';
    });

    // Character detail level
    $container.on('change.tsbWorkspace', '#tsb-character-detail-level', function () {
        setSetting('characterDetailLevel', $(this).val());
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
        case 'character':
            renderCharacterStep();
            break;
        case 'location':
            renderLocationStep();
            break;
        case 'firstMessage':
            renderFirstMessageStep();
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

/**
 * Reads current character constraint settings.
 * @returns {{ detailLevel: string }}
 */
function getCharacterConstraints() {
    return {
        detailLevel: getSetting('characterDetailLevel') || 'balanced',
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

    const personaName = stepData.personaName || '';

    const html =
        '<div class="tsb-step" data-step="persona">' +
            '<div class="tsb-step-input">' +
                '<div class="tsb-avatar-upload" data-target="persona">' +
                    '<div class="tsb-avatar-preview">' +
                        (stepData.avatarDataUrl
                            ? '<img src="' + escapeHTML(stepData.avatarDataUrl) + '" alt="Persona avatar" />'
                            : '<i class="fa-solid fa-user tsb-avatar-placeholder-icon"></i>') +
                    '</div>' +
                    '<label class="tsb-btn tsb-btn-upload-avatar menu_button">' +
                        '<i class="fa-solid fa-upload"></i> Upload Avatar' +
                        '<input type="file" class="tsb-avatar-file-input" data-target="persona" accept="image/*" style="display:none" />' +
                    '</label>' +
                '</div>' +
                '<div class="tsb-field-group tsb-persona-name-group">' +
                    '<label class="tsb-field-label">Name' +
                        '<span class="tsb-tooltip">' +
                            '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                            '<span class="tsb-tooltip-text">Enter your persona\'s name. This will become {{user}} in the final SillyTavern persona and will be included in generation prompts for consistency.</span>' +
                        '</span>' +
                    '</label>' +
                    '<input type="text" class="tsb-persona-name-input text_pole" placeholder="e.g. Aelric, Mira, etc." value="' + escapeHTML(personaName) + '" />' +
                '</div>' +
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

/** Character field definitions organized into display sections */
const CHARACTER_SECTIONS = [
    {
        title: 'Basic',
        fields: [
            { key: 'name', label: 'Name', tooltip: 'The character\'s name. This will become {{char}} in the final SillyTavern character card — all references to the character name will be replaced with the {{char}} macro.' },
            { key: 'age', label: 'Age' },
        ],
    },
    {
        title: 'Physical Description',
        fields: [
            { key: 'hair', label: 'Hair' },
            { key: 'eyes', label: 'Eyes' },
            { key: 'height', label: 'Height' },
            { key: 'body', label: 'Body', tall: true },
            { key: 'face', label: 'Face' },
            { key: 'features', label: 'Features' },
        ],
    },
    {
        title: 'Personality',
        fields: [
            { key: 'traits', label: 'Traits' },
            { key: 'habits', label: 'Habits' },
            { key: 'behavior', label: 'Behavior' },
        ],
    },
    {
        title: 'Preferences',
        fields: [
            { key: 'likes', label: 'Likes' },
            { key: 'dislikes', label: 'Dislikes' },
        ],
    },
    {
        title: 'Sexuality',
        fields: [
            { key: 'sexuality_orientation', label: 'Orientation' },
            { key: 'sexuality_kinks', label: 'Kinks', tall: true },
            { key: 'sexuality_likes', label: 'Likes', tall: true },
            { key: 'sexuality_dislikes', label: 'Dislikes', tall: true },
        ],
    },
    {
        title: 'Speaking',
        fields: [
            { key: 'speaking_style', label: 'Style' },
            { key: 'speaking_quirks', label: 'Quirks' },
        ],
    },
    {
        title: 'Advanced Definitions',
        fields: [
            { key: 'personality_summary', label: 'Personality Summary', tall: true },
            { key: 'scenario', label: 'Scenario', tall: true },
            { key: 'character_note', label: 'Character Note', tall: true },
        ],
    },
];

/**
 * Renders the Character step UI: prompt textarea, Generate button, and
 * a field grid (hidden until generation) with per-field regeneration.
 * Speech examples are handled as a separate sub-section with add/remove.
 * No Accept button — that comes in tsb-8 with lorebook generation.
 */
function renderCharacterStep() {
    const stepData = getStepData('character');
    const fields = stepData.fields || {};
    const hasFields = !!fields.name;
    const detailLevel = getSetting('characterDetailLevel') || 'balanced';

    // Build input section
    let html =
        '<div class="tsb-step" data-step="character">' +
            '<div class="tsb-step-input">' +
                '<div class="tsb-avatar-upload" data-target="character">' +
                    '<div class="tsb-avatar-preview">' +
                        (stepData.avatarDataUrl
                            ? '<img src="' + escapeHTML(stepData.avatarDataUrl) + '" alt="Character avatar" />'
                            : '<i class="fa-solid fa-id-card tsb-avatar-placeholder-icon"></i>') +
                    '</div>' +
                    '<label class="tsb-btn tsb-btn-upload-avatar menu_button">' +
                        '<i class="fa-solid fa-upload"></i> Upload Avatar' +
                        '<input type="file" class="tsb-avatar-file-input" data-target="character" accept="image/*" style="display:none" />' +
                    '</label>' +
                '</div>' +
                '<label class="tsb-step-label">Describe the chat character' +
                    '<span class="tsb-tooltip">' +
                        '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                        '<span class="tsb-tooltip-text">Describe the character you want to create. Generate will produce a complete character card with all fields populated from your description, using the scenario and persona as context.</span>' +
                    '</span>' +
                '</label>' +
                '<textarea class="tsb-input-area" placeholder="e.g. A mysterious elven sorceress with a dark past...">' +
                    escapeHTML(stepData.userInput) +
                '</textarea>' +
                '<div class="tsb-constraints">' +
                    '<div class="tsb-constraint">' +
                        '<label>Detail Level' +
                            '<span class="tsb-tooltip">' +
                                '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                                '<span class="tsb-tooltip-text">Controls how detailed each character field will be. Minimal (~1000 tokens) for concise cards, Balanced (~2000 tokens) for moderate detail, Verbose (~5000 tokens) for maximum detail, or use your Connection Profile token limit.</span>' +
                            '</span>' +
                        '</label>' +
                        '<select id="tsb-character-detail-level" class="tsb-constraint-input text_pole">' +
                            '<option value="minimal"' + (detailLevel === 'minimal' ? ' selected' : '') + '>Minimal (~1000 tokens)</option>' +
                            '<option value="balanced"' + (detailLevel === 'balanced' ? ' selected' : '') + '>Balanced (~2000 tokens)</option>' +
                            '<option value="verbose"' + (detailLevel === 'verbose' ? ' selected' : '') + '>Verbose (~5000 tokens)</option>' +
                            '<option value="connection"' + (detailLevel === 'connection' ? ' selected' : '') + '>Connection Profile Limit</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="tsb-step-actions">' +
                    '<button class="tsb-btn tsb-btn-generate menu_button" ' +
                        (hasFields ? 'style="display:none"' : '') + '>' +
                        '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Character' +
                    '</button>' +
                '</div>' +
            '</div>';

    // Build fields section (hidden if no fields yet)
    html += '<div class="tsb-character-fields" ' + (hasFields ? '' : 'style="display:none"') + '>';

    // Render each section with its fields
    for (const section of CHARACTER_SECTIONS) {
        html += '<div class="tsb-fields-section">' +
            '<div class="tsb-fields-section-title">' + escapeHTML(section.title) + '</div>';

        for (const field of section.fields) {
            const value = fields[field.key] || '';
            const tallClass = field.tall ? ' tsb-field-input-tall' : '';
            const tooltipHtml = field.tooltip
                ? '<span class="tsb-tooltip">' +
                      '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                      '<span class="tsb-tooltip-text">' + field.tooltip + '</span>' +
                  '</span>'
                : '';
            html +=
                '<div class="tsb-field-group">' +
                    '<label class="tsb-field-label">' + escapeHTML(field.label) + tooltipHtml + '</label>' +
                    '<textarea class="tsb-field-input' + tallClass + '" data-field="' + field.key + '">' +
                        escapeHTML(value) +
                    '</textarea>' +
                    '<button class="tsb-btn tsb-btn-regen-field menu_button" data-field="' + field.key + '" title="Regenerate ' + escapeHTML(field.label) + '">' +
                        '<i class="fa-solid fa-rotate"></i>' +
                    '</button>' +
                '</div>';
        }

        html += '</div>';
    }

    // Speech examples sub-section
    const examples = Array.isArray(fields.speech_examples) ? fields.speech_examples : [];
    html += '<div class="tsb-fields-section">' +
        '<div class="tsb-fields-section-title">Speech Examples' +
            '<span class="tsb-tooltip">' +
                '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                '<span class="tsb-tooltip-text">Example messages showing the character\'s speaking style. Each example will be wrapped in &lt;START&gt;&lt;/START&gt; tags automatically when building the final character card.</span>' +
            '</span>' +
        '</div>' +
        '<div class="tsb-speech-examples">';

    for (let i = 0; i < examples.length; i++) {
        html +=
            '<div class="tsb-speech-example" data-index="' + i + '">' +
                '<textarea class="tsb-field-input tsb-field-input-tall tsb-speech-example-input" data-index="' + i + '">' +
                    escapeHTML(examples[i]) +
                '</textarea>' +
                '<button class="tsb-btn tsb-btn-remove-example menu_button" data-index="' + i + '" title="Remove example">' +
                    '<i class="fa-solid fa-trash"></i>' +
                '</button>' +
            '</div>';
    }

    html += '</div>' +
        '<div class="tsb-speech-example-buttons">' +
            '<button class="tsb-btn tsb-btn-add-example menu_button">' +
                '<i class="fa-solid fa-plus"></i> Add Speech Example' +
            '</button>' +
            '<button class="tsb-btn tsb-btn-gen-example menu_button">' +
                '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Speech Example' +
            '</button>' +
        '</div>' +
        '</div>';

    // Regenerate all button
    html += '<div class="tsb-step-actions">' +
        '<button class="tsb-btn tsb-btn-regenerate menu_button">' +
            '<i class="fa-solid fa-rotate"></i> Regenerate All' +
        '</button>' +
    '</div>';

    // Character lorebooks section
    const lorebook = Array.isArray(stepData.lorebook) ? stepData.lorebook : [];
    const hasLorebook = lorebook.length > 0;

    html += '<div class="tsb-fields-section tsb-lorebook-section">' +
        '<div class="tsb-fields-section-title">Character Lorebooks' +
            '<span class="tsb-tooltip">' +
                '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                '<span class="tsb-tooltip-text">Lorebook entries provide additional character lore that activates when matching keywords appear in conversation. They enrich the character without bloating the main description. To generate a single entry, click Add Entry then use the regenerate button on that entry.</span>' +
            '</span>' +
        '</div>' +
        '<div class="tsb-lorebook-list">';

    if (hasLorebook) {
        for (let i = 0; i < lorebook.length; i++) {
            html += buildLorebookCardHtml(lorebook[i], i);
        }
    }

    html += '</div>' + // close tsb-lorebook-list
        '<div class="tsb-step-actions tsb-lorebook-actions-row">' +
            '<button class="tsb-btn tsb-btn-gen-lorebook menu_button">' +
                '<i class="fa-solid fa-wand-magic-sparkles"></i> ' +
                (hasLorebook ? 'Regenerate Lorebooks' : 'Generate Lorebooks') +
            '</button>' +
            '<button class="tsb-btn tsb-btn-add-lorebook menu_button">' +
                '<i class="fa-solid fa-plus"></i> Add Entry' +
            '</button>' +
        '</div>' +
    '</div>'; // close tsb-fields-section

    // Accept Character button
    html += '<div class="tsb-step-actions">' +
        '<button class="tsb-btn tsb-btn-accept menu_button" data-step="character">' +
            '<i class="fa-solid fa-check"></i> Accept Character' +
        '</button>' +
    '</div>';

    html += '</div>'; // close tsb-character-fields
    html += '</div>'; // close tsb-step

    state.$container.find('.tsb-tab-content').html(html);
}

/**
 * Builds the HTML for a single location entry card.
 * @param {object} entry - The location entry { title, keywords, content }.
 * @param {number} index - The entry's index.
 * @returns {string} HTML string for the card.
 */
function buildLocationCardHtml(entry, index) {
    const keywordsStr = Array.isArray(entry.keywords) ? entry.keywords.join(', ') : '';
    const isNew = !entry.content && !entry.title;
    const btnIcon = isNew ? 'fa-wand-magic-sparkles' : 'fa-rotate';
    const btnTitle = isNew ? 'Generate entry' : 'Regenerate entry';
    return (
        '<div class="tsb-lorebook-card tsb-location-card" data-index="' + index + '">' +
            '<div class="tsb-entry-prompt-row">' +
                '<input type="text" class="tsb-location-prompt-input text_pole" data-index="' + index + '" ' +
                    'placeholder="Describe what this entry should be about..." ' +
                    'value="' + escapeHTML(entry.userPrompt || '') + '" />' +
            '</div>' +
            '<div class="tsb-lorebook-card-header">' +
                '<input type="text" class="tsb-location-title-input text_pole" data-index="' + index + '" ' +
                    'placeholder="Entry title" value="' + escapeHTML(entry.title || '') + '" />' +
                '<div class="tsb-lorebook-card-actions">' +
                    '<button class="tsb-btn tsb-btn-regen-location menu_button" data-index="' + index + '" title="' + btnTitle + '">' +
                        '<i class="fa-solid ' + btnIcon + '"></i>' +
                    '</button>' +
                    '<button class="tsb-btn tsb-btn-remove-location menu_button" data-index="' + index + '" title="Remove entry">' +
                        '<i class="fa-solid fa-trash"></i>' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="tsb-lorebook-keywords-row">' +
                '<label class="tsb-field-label">Keywords</label>' +
                '<input type="text" class="tsb-location-keywords-input text_pole" data-index="' + index + '" ' +
                    'placeholder="keyword1, keyword2, ..." value="' + escapeHTML(keywordsStr) + '" />' +
            '</div>' +
            '<textarea class="tsb-location-content tsb-lorebook-content" data-index="' + index + '" ' +
                'placeholder="World info entry content...">' +
                escapeHTML(entry.content || '') +
            '</textarea>' +
        '</div>'
    );
}

/**
 * Renders the Location step content.
 * Shows input area, generate button, location entry cards, and accept button.
 */
function renderLocationStep() {
    const stepData = getStepData('location');
    const entries = Array.isArray(stepData.entries) ? stepData.entries : [];
    const hasEntries = entries.length > 0;

    let html =
        '<div class="tsb-step" data-step="location">' +
            '<div class="tsb-step-input">' +
                '<label class="tsb-input-label">Describe the location of the scenario/story' +
                    '<span class="tsb-tooltip">' +
                        '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                        '<span class="tsb-tooltip-text">Describe where the story takes place. This will generate world info lorebook entries that activate when matching keywords appear in conversation.</span>' +
                    '</span>' +
                '</label>' +
                '<span class="tsb-input-helper">(e.g., "Earth 2047, Old Ohio, My House" or just "My house")</span>' +
                '<textarea class="tsb-input-area text_pole" placeholder="Describe the location...">' +
                    escapeHTML(stepData.userInput || '') +
                '</textarea>' +
            '</div>' +
            '<div class="tsb-step-actions">' +
                '<button class="tsb-btn tsb-btn-gen-location menu_button">' +
                    '<i class="fa-solid fa-wand-magic-sparkles"></i> ' +
                    (hasEntries ? 'Regenerate Location' : 'Generate Location') +
                '</button>' +
            '</div>';

    // Location entries section
    html += '<div class="tsb-location-list">';
    if (hasEntries) {
        for (let i = 0; i < entries.length; i++) {
            html += buildLocationCardHtml(entries[i], i);
        }
    }
    html += '</div>';

    // Add Entry + Accept buttons
    html += '<div class="tsb-step-actions tsb-location-actions-row">' +
        '<button class="tsb-btn tsb-btn-add-location menu_button">' +
            '<i class="fa-solid fa-plus"></i> Add Entry' +
        '</button>' +
    '</div>';

    html += '<div class="tsb-step-actions">' +
        '<button class="tsb-btn tsb-btn-accept menu_button" data-step="location">' +
            '<i class="fa-solid fa-check"></i> Accept Location' +
        '</button>' +
    '</div>';

    html += '</div>'; // close tsb-step

    state.$container.find('.tsb-tab-content').html(html);
}

/**
 * Renders the First Message step UI.
 * No input textarea — auto-generates from all accumulated context.
 * Shows Generate button, output area with Accept/Regenerate, and Create All button after accept.
 */
function renderFirstMessageStep() {
    const stepData = getStepData('firstMessage');
    const outputContent = stepData.accepted || stepData.generated || '';
    const hasOutput = !!outputContent;
    const isAccepted = !!stepData.accepted;

    const html =
        '<div class="tsb-step" data-step="firstMessage">' +
            '<div class="tsb-step-input">' +
                '<label class="tsb-step-label">Describe the opening scene' +
                    '<span class="tsb-tooltip">' +
                        '<i class="fa-solid fa-circle-question tsb-tooltip-icon"></i>' +
                        '<span class="tsb-tooltip-text">Optionally describe what you want the opening message to look like — the setting, mood, time of day, or situation. Leave blank to let the AI decide based on all established context.</span>' +
                    '</span>' +
                '</label>' +
                '<textarea class="tsb-input-area" placeholder="e.g. The character is waiting at a rain-soaked bus stop at midnight, lost in thought...">' +
                    escapeHTML(stepData.userInput || '') +
                '</textarea>' +
                '<div class="tsb-step-actions">' +
                    '<button class="tsb-btn tsb-btn-generate-first-message menu_button" ' +
                        (hasOutput ? 'style="display:none"' : '') + '>' +
                        '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate First Message' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="tsb-step-output" ' + (hasOutput ? '' : 'style="display:none"') + '>' +
                '<div class="tsb-output-header">' +
                    '<label class="tsb-step-label">Generated First Message</label>' +
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
        if (stepName === 'character') {
            // Character step: generate all fields as JSON
            const result = await generateCharacter(userInput, getCharacterConstraints());

            if (currentGenId !== state.generationId) return;

            if (!result) {
                toastr.error('Could not parse character data from AI response. Try generating again.');
                return;
            }

            // Store fields in session state
            const stepData = getStepData('character');
            Object.assign(stepData.fields, result);

            // Re-render the character step to show populated fields
            renderCharacterStep();
            toastr.success('Character fields generated!');
        } else {
            // Scenario / Persona: generate text output
            let result = '';
            if (stepName === 'scenario') {
                result = await generateScenario(userInput, getScenarioConstraints());
            } else if (stepName === 'persona') {
                const personaName = getStepData('persona').personaName || '';
                result = await generatePersona(userInput, getPersonaConstraints(), personaName);
            }

            if (currentGenId !== state.generationId) return;

            if (!result) {
                toastr.warning('AI returned an empty response. Try generating again.');
                return;
            }

            updateStepData(stepName, { generated: result });

            const $output = $step.find('.tsb-step-output');
            $output.find('.tsb-output-area').val(result);
            $output.find('.tsb-markdown-preview').html(renderMarkdown(result)).show();
            $output.find('.tsb-output-area').hide();
            $output.find('.tsb-btn-edit').html('<i class="fa-solid fa-pen"></i> Edit');
            $output.show();
            $step.find('.tsb-btn-generate').hide();
        }
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

    // Character step has special accept logic (fields + lorebook, no textarea)
    if (stepName === 'character') {
        const stepData = getStepData('character');
        if (!stepData.fields?.name) {
            toastr.warning('Nothing to accept. Generate character fields first.');
            return;
        }

        // Mark accepted with a summary string for entries display
        updateStepData('character', { accepted: stepData.fields.name });
        acceptStep('character');
        addEntry('character');

        const currentIndex = STEPS.indexOf('character');
        if (currentIndex >= 0 && currentIndex < STEPS.length - 1) {
            const nextStep = STEPS[currentIndex + 1];
            unlockTab(nextStep);
            const $tab = state.$container.find('.tsb-tab[data-step="character"]');
            if (!$tab.hasClass('tsb-tab-completed')) {
                $tab.addClass('tsb-tab-completed')
                    .append(' <i class="fa-solid fa-check"></i>');
            }
            switchTab(nextStep);
        }

        toastr.success('Character accepted!');
        return;
    }

    // Location step has special accept logic (entries array, no textarea)
    if (stepName === 'location') {
        const stepData = getStepData('location');
        if (!Array.isArray(stepData.entries) || stepData.entries.length === 0) {
            toastr.warning('Nothing to accept. Generate location entries first.');
            return;
        }

        // Store user input as accepted summary for entries display
        updateStepData('location', { accepted: stepData.userInput || 'Location' });
        setLocationEntries(stepData.entries);
        acceptStep('location');
        addEntry('location');

        const currentIndex = STEPS.indexOf('location');
        if (currentIndex >= 0 && currentIndex < STEPS.length - 1) {
            const nextStep = STEPS[currentIndex + 1];
            unlockTab(nextStep);
            const $tab = state.$container.find('.tsb-tab[data-step="location"]');
            if (!$tab.hasClass('tsb-tab-completed')) {
                $tab.addClass('tsb-tab-completed')
                    .append(' <i class="fa-solid fa-check"></i>');
            }
            switchTab(nextStep);
        }

        toastr.success('Location accepted!');
        return;
    }

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
        // Mark current tab as completed in the tab bar (only add checkmark once)
        const $tab = state.$container.find(`.tsb-tab[data-step="${stepName}"]`);
        if (!$tab.hasClass('tsb-tab-completed')) {
            $tab.addClass('tsb-tab-completed')
                .append(' <i class="fa-solid fa-check"></i>');
        }
        switchTab(nextStep);
    }

    // First message is the last step — mark tab as completed
    if (stepName === 'firstMessage') {
        const $tab = state.$container.find('.tsb-tab[data-step="firstMessage"]');
        if (!$tab.hasClass('tsb-tab-completed')) {
            $tab.addClass('tsb-tab-completed')
                .append(' <i class="fa-solid fa-check"></i>');
        }
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

    // First message regeneration — reads optional user input from textarea
    if (stepName === 'firstMessage') {
        const previousOutput = stepData.generated || stepData.accepted || '';
        const userInput = $step.find('.tsb-input-area').val()?.trim() || '';

        // Persist user input
        updateStepData('firstMessage', { userInput });

        const currentGenId = ++state.generationId;
        state.generating = true;
        setButtonsDisabled(true);
        showLoading();

        try {
            const result = await regenerateFirstMessage(previousOutput, userInput);

            if (currentGenId !== state.generationId) return;

            if (!result) {
                toastr.warning('AI returned an empty response. Try regenerating again.');
                return;
            }

            updateStepData('firstMessage', { generated: result });
            const $output = $step.find('.tsb-step-output');
            $output.find('.tsb-output-area').val(result);
            $output.find('.tsb-markdown-preview').html(renderMarkdown(result)).show();
            $output.find('.tsb-output-area').hide();
            $output.find('.tsb-btn-edit').html('<i class="fa-solid fa-pen"></i> Edit');
        } catch (err) {
            if (currentGenId !== state.generationId) return;
            console.error('[TavernScenarioBuilder] First message regeneration failed:', err);
            toastr.error('Regeneration failed. Please check your connection and try again.');
        } finally {
            if (currentGenId === state.generationId) {
                state.generating = false;
                setButtonsDisabled(false);
                hideLoading();
            }
        }
        return;
    }

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
        if (stepName === 'character') {
            // Regenerate all character fields
            const result = await generateCharacter(userInput, getCharacterConstraints());

            if (currentGenId !== state.generationId) return;

            if (!result) {
                toastr.error('Could not parse character data from AI response. Try again.');
                return;
            }

            const stepData = getStepData('character');
            Object.assign(stepData.fields, result);
            renderCharacterStep();
            toastr.success('Character fields regenerated!');
        } else {
            let result = '';
            if (stepName === 'scenario') {
                result = await regenerateScenario(userInput, previousOutput, getScenarioConstraints());
            } else if (stepName === 'persona') {
                const personaName = getStepData('persona').personaName || '';
                result = await regeneratePersona(userInput, previousOutput, getPersonaConstraints(), personaName);
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
        }
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
    $content.addClass('tsb-loading-active');
    const overlayHeight = Math.max($content[0].scrollHeight, $content[0].clientHeight);
    $content.append(
        '<div class="tsb-loading" style="height:' + overlayHeight + 'px">' +
            '<div class="tsb-loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>' +
            '<span>Generating...</span>' +
        '</div>',
    );
}

/**
 * Removes the loading overlay from the tab content area.
 */
function hideLoading() {
    state.$container?.find('.tsb-tab-content').removeClass('tsb-loading-active');
    state.$container?.find('.tsb-loading').remove();
}

/**
 * Enables or disables all action buttons during generation.
 * @param {boolean} disabled - Whether to disable buttons.
 */
function setButtonsDisabled(disabled) {
    state.$container?.find('.tsb-btn').prop('disabled', disabled);
}

// === Character field handlers ===

/**
 * Handles clicking a per-field Regenerate button on the character step.
 * Regenerates only the targeted field while keeping all others intact.
 * @param {Event} event - The delegated click event.
 */
async function handleFieldRegenerateClick(event) {
    if (state.generating) return;

    const $btn = $(event.currentTarget);
    const fieldName = $btn.data('field');
    if (!fieldName) return;

    const stepData = getStepData('character');
    const userInput = stepData.userInput || '';
    const currentFields = stepData.fields || {};

    const currentGenId = ++state.generationId;
    state.generating = true;
    $btn.prop('disabled', true);

    // Show a mini spinner on the button
    const originalHtml = $btn.html();
    $btn.html('<i class="fa-solid fa-spinner fa-spin"></i>');

    try {
        const result = await regenerateCharacterField(fieldName, userInput, currentFields);

        if (currentGenId !== state.generationId) return;

        if (!result) {
            toastr.warning('AI returned an empty response for this field.');
            return;
        }

        // Update state and the specific textarea
        setCharacterField(fieldName, result);
        state.$container
            .find(`.tsb-field-input[data-field="${fieldName}"]`)
            .val(result);

        toastr.success(`${fieldName} regenerated!`);
    } catch (err) {
        if (currentGenId !== state.generationId) return;
        console.error('[TavernScenarioBuilder] Field regeneration failed:', err);
        toastr.error('Field regeneration failed. Please try again.');
    } finally {
        if (currentGenId === state.generationId) {
            state.generating = false;
            $btn.prop('disabled', false).html(originalHtml);
        }
    }
}

/** Debounced handler for character field text input — syncs edits to state */
const handleFieldInput = debounce(function (event) {
    const $textarea = $(event.target);
    const fieldName = $textarea.data('field');
    if (fieldName) {
        setCharacterField(fieldName, $textarea.val() || '');
    }
}, 300);

/**
 * Handles debounced input on speech example textareas.
 * Updates the specific speech_examples array index in state.
 */
const handleSpeechExampleInput = debounce(function (event) {
    const $textarea = $(event.target);
    const index = parseInt($textarea.data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('character');
    if (!Array.isArray(stepData.fields.speech_examples)) {
        stepData.fields.speech_examples = [];
    }
    stepData.fields.speech_examples[index] = $textarea.val() || '';
}, 300);

/**
 * Handles clicking the "Add Speech Example" button.
 * Appends a new blank speech example and re-renders.
 */
function handleAddExampleClick() {
    const stepData = getStepData('character');
    if (!Array.isArray(stepData.fields.speech_examples)) {
        stepData.fields.speech_examples = [];
    }
    stepData.fields.speech_examples.push('');
    renderCharacterStep();
}

/**
 * Handles clicking the remove button on a speech example.
 * Removes the targeted example by index and re-renders.
 * @param {Event} event - The delegated click event.
 */
function handleRemoveExampleClick(event) {
    const index = parseInt($(event.currentTarget).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('character');
    if (Array.isArray(stepData.fields.speech_examples)) {
        stepData.fields.speech_examples.splice(index, 1);
    }
    renderCharacterStep();
}

/**
 * Handles clicking the "Generate Speech Example" button.
 * Uses AI to generate a new speech example for the character.
 */
async function handleGenerateExampleClick() {
    if (state.generating) return;

    const stepData = getStepData('character');
    if (!stepData.fields?.name) {
        toastr.warning('Generate character fields first before generating speech examples.');
        return;
    }

    const currentGenId = ++state.generationId;
    state.generating = true;
    const $btn = state.$container.find('.tsb-btn-gen-example');
    $btn.prop('disabled', true);
    const originalHtml = $btn.html();
    $btn.html('<i class="fa-solid fa-spinner fa-spin"></i> Generating...');

    try {
        const result = await generateSpeechExample();

        if (currentGenId !== state.generationId) return;

        if (!result) {
            toastr.warning('AI returned an empty speech example. Try again.');
            return;
        }

        if (!Array.isArray(stepData.fields.speech_examples)) {
            stepData.fields.speech_examples = [];
        }
        stepData.fields.speech_examples.push(result);
        renderCharacterStep();
        toastr.success('Speech example generated!');
    } catch (err) {
        if (currentGenId !== state.generationId) return;
        console.error('[TavernScenarioBuilder] Speech example generation failed:', err);
        toastr.error('Speech example generation failed. Please try again.');
    } finally {
        if (currentGenId === state.generationId) {
            state.generating = false;
            $btn.prop('disabled', false).html(originalHtml);
        }
    }
}

// === Lorebook handlers ===

/**
 * Builds the HTML for a single lorebook entry card.
 * @param {object} entry - The lorebook entry { title, keywords, content }.
 * @param {number} index - The entry's index.
 * @returns {string} HTML string for the card.
 */
function buildLorebookCardHtml(entry, index) {
    const keywordsStr = Array.isArray(entry.keywords) ? entry.keywords.join(', ') : '';
    const isNew = !entry.content && !entry.title;
    const btnIcon = isNew ? 'fa-wand-magic-sparkles' : 'fa-rotate';
    const btnTitle = isNew ? 'Generate entry' : 'Regenerate entry';
    return (
        '<div class="tsb-lorebook-card" data-index="' + index + '">' +
            '<div class="tsb-entry-prompt-row">' +
                '<input type="text" class="tsb-lorebook-prompt-input text_pole" data-index="' + index + '" ' +
                    'placeholder="Describe what this entry should be about..." ' +
                    'value="' + escapeHTML(entry.userPrompt || '') + '" />' +
            '</div>' +
            '<div class="tsb-lorebook-card-header">' +
                '<input type="text" class="tsb-lorebook-title-input text_pole" data-index="' + index + '" ' +
                    'placeholder="Entry title" value="' + escapeHTML(entry.title || '') + '" />' +
                '<div class="tsb-lorebook-card-actions">' +
                    '<button class="tsb-btn tsb-btn-regen-lorebook menu_button" data-index="' + index + '" title="' + btnTitle + '">' +
                        '<i class="fa-solid ' + btnIcon + '"></i>' +
                    '</button>' +
                    '<button class="tsb-btn tsb-btn-remove-lorebook menu_button" data-index="' + index + '" title="Remove entry">' +
                        '<i class="fa-solid fa-trash"></i>' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="tsb-lorebook-keywords-row">' +
                '<label class="tsb-field-label">Keywords</label>' +
                '<input type="text" class="tsb-lorebook-keywords-input text_pole" data-index="' + index + '" ' +
                    'placeholder="keyword1, keyword2, ..." value="' + escapeHTML(keywordsStr) + '" />' +
            '</div>' +
            '<textarea class="tsb-lorebook-content" data-index="' + index + '" ' +
                'placeholder="Lorebook entry content...">' +
                escapeHTML(entry.content || '') +
            '</textarea>' +
        '</div>'
    );
}

/**
 * Handles clicking the "Generate Lorebooks" button.
 * Generates lorebook entries for the current character.
 */
async function handleGenLorebookClick() {
    if (state.generating) return;

    const stepData = getStepData('character');
    if (!stepData.fields?.name) {
        toastr.warning('Generate character fields first before generating lorebooks.');
        return;
    }

    const currentGenId = ++state.generationId;
    state.generating = true;
    setButtonsDisabled(true);
    showLoading();

    try {
        const result = await generateCharacterLorebook();

        if (currentGenId !== state.generationId) return;

        if (!result || !Array.isArray(result) || result.length === 0) {
            toastr.error('Could not parse lorebook data from AI response. Try generating again.');
            return;
        }

        // Store in state
        setCharacterLorebook(result);

        // Re-render to show the entries
        renderCharacterStep();
        toastr.success(`${result.length} lorebook entries generated!`);
    } catch (err) {
        if (currentGenId !== state.generationId) return;
        console.error('[TavernScenarioBuilder] Lorebook generation failed:', err);
        toastr.error('Lorebook generation failed. Please try again.');
    } finally {
        if (currentGenId === state.generationId) {
            state.generating = false;
            setButtonsDisabled(false);
            hideLoading();
        }
    }
}

/**
 * Handles clicking the Regenerate button on a lorebook entry.
 * Regenerates only the targeted entry.
 * @param {Event} event - The delegated click event.
 */
async function handleRegenLorebookClick(event) {
    if (state.generating) return;

    const $btn = $(event.currentTarget);
    const index = parseInt($btn.data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('character');
    const lorebook = stepData.lorebook || [];
    if (index >= lorebook.length) return;

    const entry = lorebook[index];
    const isNew = !entry.content && !entry.title;
    const userPrompt = entry.userPrompt || '';

    // For new entries, require a user prompt
    if (isNew && !userPrompt) {
        toastr.warning('Please describe what this entry should be about first.');
        return;
    }

    const currentGenId = ++state.generationId;
    state.generating = true;
    $btn.prop('disabled', true);

    const originalHtml = $btn.html();
    $btn.html('<i class="fa-solid fa-spinner fa-spin"></i>');

    try {
        let result;
        if (isNew) {
            result = await generateSingleLorebookEntry(userPrompt);
        } else {
            result = await regenerateLorebookEntry(entry, index, userPrompt || undefined);
        }

        if (currentGenId !== state.generationId) return;

        if (!result) {
            toastr.warning('AI returned an empty response for this entry.');
            return;
        }

        // Preserve userPrompt in the result
        result.userPrompt = userPrompt;

        // Update state
        lorebook[index] = result;
        setCharacterLorebook(lorebook);

        // Re-render to update button state (Generate → Regenerate)
        renderCharacterStep();

        toastr.success(isNew ? 'Lorebook entry generated!' : 'Lorebook entry regenerated!');
    } catch (err) {
        if (currentGenId !== state.generationId) return;
        console.error('[TavernScenarioBuilder] Lorebook entry generation failed:', err);
        toastr.error('Entry generation failed. Please try again.');
    } finally {
        if (currentGenId === state.generationId) {
            state.generating = false;
            $btn.prop('disabled', false).html(originalHtml);
        }
    }
}

/**
 * Handles clicking the Remove button on a lorebook entry.
 * Removes the entry and re-renders.
 * @param {Event} event - The delegated click event.
 */
function handleRemoveLorebookClick(event) {
    const index = parseInt($(event.currentTarget).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('character');
    if (Array.isArray(stepData.lorebook)) {
        stepData.lorebook.splice(index, 1);
        setCharacterLorebook(stepData.lorebook);
    }
    renderCharacterStep();
}

/**
 * Handles clicking the "Add Entry" button for lorebooks.
 * Appends a blank lorebook entry and re-renders.
 */
function handleAddLorebookClick() {
    const stepData = getStepData('character');
    if (!Array.isArray(stepData.lorebook)) {
        stepData.lorebook = [];
    }
    stepData.lorebook.push({ title: '', keywords: [], content: '', userPrompt: '' });
    setCharacterLorebook(stepData.lorebook);
    renderCharacterStep();
}

/** Debounced handler for lorebook title input */
const handleLorebookTitleInput = debounce(function (event) {
    const index = parseInt($(event.target).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('character');
    if (Array.isArray(stepData.lorebook) && stepData.lorebook[index]) {
        stepData.lorebook[index].title = $(event.target).val() || '';
    }
}, 300);

/** Debounced handler for lorebook keywords input — splits on comma */
const handleLorebookKeywordsInput = debounce(function (event) {
    const index = parseInt($(event.target).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('character');
    if (Array.isArray(stepData.lorebook) && stepData.lorebook[index]) {
        const raw = $(event.target).val() || '';
        stepData.lorebook[index].keywords = raw.split(',').map(k => k.trim()).filter(Boolean);
    }
}, 300);

/** Debounced handler for lorebook content textarea */
const handleLorebookContentInput = debounce(function (event) {
    const index = parseInt($(event.target).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('character');
    if (Array.isArray(stepData.lorebook) && stepData.lorebook[index]) {
        stepData.lorebook[index].content = $(event.target).val() || '';
    }
}, 300);

/** Debounced handler for lorebook prompt input */
const handleLorebookPromptInput = debounce(function (event) {
    const index = parseInt($(event.target).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('character');
    if (Array.isArray(stepData.lorebook) && stepData.lorebook[index]) {
        stepData.lorebook[index].userPrompt = $(event.target).val() || '';
    }
}, 300);

// === Location handlers ===

/**
 * Handles clicking the "Generate Location" button.
 * Generates world info entries for the described location.
 */
async function handleGenLocationClick() {
    if (state.generating) return;

    const $step = state.$container.find('.tsb-step[data-step="location"]');
    const userInput = $step.find('.tsb-input-area').val()?.trim();

    if (!userInput) {
        toastr.warning('Please enter a location description first.');
        return;
    }

    updateStepData('location', { userInput });

    const currentGenId = ++state.generationId;
    state.generating = true;
    setButtonsDisabled(true);
    showLoading();

    try {
        const result = await generateLocation(userInput);

        if (currentGenId !== state.generationId) return;

        if (!result || !Array.isArray(result) || result.length === 0) {
            toastr.error('Could not parse location data from AI response. Try generating again.');
            return;
        }

        setLocationEntries(result);
        renderLocationStep();
        toastr.success(`${result.length} location entries generated!`);
    } catch (err) {
        if (currentGenId !== state.generationId) return;
        console.error('[TavernScenarioBuilder] Location generation failed:', err);
        toastr.error('Location generation failed. Please try again.');
    } finally {
        if (currentGenId === state.generationId) {
            state.generating = false;
            setButtonsDisabled(false);
            hideLoading();
        }
    }
}

/**
 * Handles clicking the Regenerate button on a location entry.
 * Regenerates only the targeted entry.
 * @param {Event} event - The delegated click event.
 */
async function handleRegenLocationClick(event) {
    if (state.generating) return;

    const $btn = $(event.currentTarget);
    const index = parseInt($btn.data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('location');
    const entries = stepData.entries || [];
    if (index >= entries.length) return;

    const entry = entries[index];
    const isNew = !entry.content && !entry.title;
    const userPrompt = entry.userPrompt || '';
    const userInput = stepData.userInput || '';

    // For new entries, require a user prompt
    if (isNew && !userPrompt) {
        toastr.warning('Please describe what this entry should be about first.');
        return;
    }

    const currentGenId = ++state.generationId;
    state.generating = true;
    $btn.prop('disabled', true);

    const originalHtml = $btn.html();
    $btn.html('<i class="fa-solid fa-spinner fa-spin"></i>');

    try {
        let result;
        if (isNew) {
            result = await generateSingleLocationEntry(userPrompt, userInput);
        } else {
            result = await regenerateLocationEntry(entry, index, userInput, userPrompt || undefined);
        }

        if (currentGenId !== state.generationId) return;

        if (!result) {
            toastr.warning('AI returned an empty response for this entry.');
            return;
        }

        // Preserve userPrompt in the result
        result.userPrompt = userPrompt;

        entries[index] = result;
        setLocationEntries(entries);

        // Re-render to update button state (Generate → Regenerate)
        renderLocationStep();

        toastr.success(isNew ? 'Location entry generated!' : 'Location entry regenerated!');
    } catch (err) {
        if (currentGenId !== state.generationId) return;
        console.error('[TavernScenarioBuilder] Location entry generation failed:', err);
        toastr.error('Entry generation failed. Please try again.');
    } finally {
        if (currentGenId === state.generationId) {
            state.generating = false;
            $btn.prop('disabled', false).html(originalHtml);
        }
    }
}

/**
 * Handles clicking the Remove button on a location entry.
 * Removes the entry and re-renders.
 * @param {Event} event - The delegated click event.
 */
function handleRemoveLocationClick(event) {
    const index = parseInt($(event.currentTarget).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('location');
    if (Array.isArray(stepData.entries)) {
        stepData.entries.splice(index, 1);
        setLocationEntries(stepData.entries);
    }
    renderLocationStep();
}

/**
 * Handles clicking the "Add Entry" button for location entries.
 * Appends a blank entry and re-renders.
 */
function handleAddLocationClick() {
    const stepData = getStepData('location');
    if (!Array.isArray(stepData.entries)) {
        stepData.entries = [];
    }
    stepData.entries.push({ title: '', keywords: [], content: '', userPrompt: '' });
    setLocationEntries(stepData.entries);
    renderLocationStep();
}

/** Debounced handler for location entry title input */
const handleLocationTitleInput = debounce(function (event) {
    const index = parseInt($(event.target).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('location');
    if (Array.isArray(stepData.entries) && stepData.entries[index]) {
        stepData.entries[index].title = $(event.target).val() || '';
    }
}, 300);

/** Debounced handler for location entry keywords input — splits on comma */
const handleLocationKeywordsInput = debounce(function (event) {
    const index = parseInt($(event.target).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('location');
    if (Array.isArray(stepData.entries) && stepData.entries[index]) {
        const raw = $(event.target).val() || '';
        stepData.entries[index].keywords = raw.split(',').map(k => k.trim()).filter(Boolean);
    }
}, 300);

/** Debounced handler for location entry content textarea */
const handleLocationContentInput = debounce(function (event) {
    const index = parseInt($(event.target).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('location');
    if (Array.isArray(stepData.entries) && stepData.entries[index]) {
        stepData.entries[index].content = $(event.target).val() || '';
    }
}, 300);

/** Debounced handler for location prompt input */
const handleLocationPromptInput = debounce(function (event) {
    const index = parseInt($(event.target).data('index'));
    if (isNaN(index)) return;

    const stepData = getStepData('location');
    if (Array.isArray(stepData.entries) && stepData.entries[index]) {
        stepData.entries[index].userPrompt = $(event.target).val() || '';
    }
}, 300);

/**
 * Handles clicking "Generate First Message".
 * Calls AI generation using all accumulated context, no user input needed.
 */
async function handleGenerateFirstMessageClick() {
    if (state.generating) return;

    const $step = state.$container.find('.tsb-step[data-step="firstMessage"]');
    const userInput = $step.find('.tsb-input-area').val()?.trim() || '';

    // Persist user input
    updateStepData('firstMessage', { userInput });

    const currentGenId = ++state.generationId;
    state.generating = true;
    setButtonsDisabled(true);
    showLoading();

    try {
        const result = await generateFirstMessage(userInput);

        if (currentGenId !== state.generationId) return;

        if (!result) {
            toastr.warning('AI returned an empty response. Try generating again.');
            return;
        }

        updateStepData('firstMessage', { generated: result });

        const $step = state.$container.find('.tsb-step[data-step="firstMessage"]');
        const $output = $step.find('.tsb-step-output');
        $output.find('.tsb-output-area').val(result);
        $output.find('.tsb-markdown-preview').html(renderMarkdown(result)).show();
        $output.find('.tsb-output-area').hide();
        $output.find('.tsb-btn-edit').html('<i class="fa-solid fa-pen"></i> Edit');
        $output.show();
        $step.find('.tsb-btn-generate-first-message').hide();
    } catch (err) {
        if (currentGenId !== state.generationId) return;
        console.error('[TavernScenarioBuilder] First message generation failed:', err);
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
 * Handles avatar file input change.
 * Reads the selected image file and stores it as a data URL in session state.
 * @param {Event} event - The delegated change event.
 */
function handleAvatarUpload(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const target = $(input).data('target'); // 'persona' or 'character'
    const reader = new FileReader();

    reader.onload = function (e) {
        const dataUrl = e.target.result;
        updateStepData(target, { avatarDataUrl: dataUrl });

        // Update the preview image
        const $upload = $(input).closest('.tsb-avatar-upload');
        $upload.find('.tsb-avatar-preview').html(
            '<img src="' + escapeHTML(dataUrl) + '" alt="Avatar" />',
        );
    };

    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    input.value = '';
}

/**
 * Handles clicking "Create in SillyTavern".
 * Creates character card, world info, and persona in SillyTavern.
 */
async function handleCreateAllClick() {
    const $btn = state.$container.find('.tsb-btn-create-all');
    const originalHtml = $btn.html();
    $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Creating...');

    try {
        const result = await createAll();

        if (result.errors.length === 0) {
            toastr.success(
                `Character: ${result.character}<br>` +
                `World Info: ${result.worldInfo}<br>` +
                `Persona: ${result.persona}`,
                'All artifacts created in SillyTavern!',
            );
        } else if (result.errors.length < 3) {
            const created = [];
            if (result.character) created.push(`Character: ${result.character}`);
            if (result.worldInfo) created.push(`World Info: ${result.worldInfo}`);
            if (result.persona) created.push(`Persona: ${result.persona}`);
            toastr.warning(
                `Created: ${created.join(', ')}<br>Failed: ${result.errors.join(', ')}`,
                'Partial creation — some artifacts failed',
            );
        } else {
            toastr.error('All artifact creation failed. Please check your connection and try again.');
        }
    } catch (err) {
        console.error('[TavernScenarioBuilder] Create all failed:', err);
        toastr.error('Failed to create artifacts. Please check your connection and try again.');
    } finally {
        $btn.prop('disabled', false).html(originalHtml);
    }
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
