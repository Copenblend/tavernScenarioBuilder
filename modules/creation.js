/**
 * Tavern Scenario Builder — SillyTavern Artifact Creation
 *
 * Creates character cards, world info files, and personas in SillyTavern
 * from wizard session data using REST APIs and client-side functions.
 */

import { getRequestHeaders, saveSettingsDebounced, getCharacters } from '/script.js';
import { initPersona, getUserAvatars } from '/scripts/personas.js';
import { updateWorldInfoList } from '/scripts/world-info.js';
import { getSession } from './state.js';

/**
 * Composes a formatted character description from individual fields.
 * Sections with all empty fields are omitted.
 * @param {object} fields - The character fields object from session state.
 * @returns {string} Formatted description string.
 */
export function composeDescription(fields) {
    const parts = [];

    // Opening line
    if (fields.age) {
        parts.push(`{{char}} is ${fields.age}.`);
    }

    // Physical Description section
    const physical = [
        fields.hair && `- Hair: ${fields.hair}`,
        fields.eyes && `- Eyes: ${fields.eyes}`,
        fields.height && `- Height: ${fields.height}`,
        fields.body && `- Body: ${fields.body}`,
        fields.face && `- Face: ${fields.face}`,
        fields.features && `- Distinguishing Features: ${fields.features}`,
    ].filter(Boolean);
    if (physical.length) {
        parts.push('Physical Description:\n' + physical.join('\n'));
    }

    // Personality section
    const personality = [
        fields.traits && `- Traits: ${fields.traits}`,
        fields.habits && `- Habits: ${fields.habits}`,
        fields.behavior && `- Behavior: ${fields.behavior}`,
    ].filter(Boolean);
    if (personality.length) {
        parts.push('Personality:\n' + personality.join('\n'));
    }

    // Preferences section
    const preferences = [
        fields.likes && `- Likes: ${fields.likes}`,
        fields.dislikes && `- Dislikes: ${fields.dislikes}`,
    ].filter(Boolean);
    if (preferences.length) {
        parts.push('Preferences:\n' + preferences.join('\n'));
    }

    // Sexuality section
    const sexuality = [
        fields.sexuality_orientation && `- Orientation: ${fields.sexuality_orientation}`,
        fields.sexuality_kinks && `- Kinks: ${fields.sexuality_kinks}`,
        fields.sexuality_likes && `- Likes: ${fields.sexuality_likes}`,
        fields.sexuality_dislikes && `- Dislikes: ${fields.sexuality_dislikes}`,
    ].filter(Boolean);
    if (sexuality.length) {
        parts.push('Sexuality:\n' + sexuality.join('\n'));
    }

    // Speech section
    const speech = [
        fields.speaking_style && `- Style: ${fields.speaking_style}`,
        fields.speaking_quirks && `- Quirks: ${fields.speaking_quirks}`,
    ].filter(Boolean);
    if (speech.length) {
        parts.push('Speech:\n' + speech.join('\n'));
    }

    return parts.join('\n\n');
}

/**
 * Wraps speech examples with <START> tags for mes_example field.
 * @param {string[]} examples - Array of speech example strings.
 * @returns {string} Formatted speech examples string.
 */
function composeSpeechExamples(examples) {
    if (!examples || !examples.length) return '';
    return examples.map(ex => `<START>\n${ex}`).join('\n');
}

/**
 * Builds a world info entries object from an array of lorebook/location entries.
 * @param {Array} entryList - Array of { title, keywords, content } objects.
 * @returns {object} Entries object keyed by string index.
 */
function buildWorldInfoEntries(entryList) {
    const entries = {};
    entryList.forEach((entry, i) => {
        entries[String(i)] = {
            uid: String(i),
            key: Array.isArray(entry.keywords) ? entry.keywords : [],
            keysecondary: [],
            comment: entry.title || '',
            content: entry.content || '',
            constant: false,
            selective: false,
            order: 100,
            position: 0,
            disable: false,
            depth: 4,
            selectiveLogic: 0,
            matchWholeWords: false,
            caseSensitive: false,
            probability: 100,
            useProbability: true,
            group: '',
            scanDepth: null,
            extensions: {},
        };
    });
    return entries;
}

/**
 * Creates a World Info file in SillyTavern.
 * @param {string} name - The world info file name.
 * @param {Array} entryList - Array of { title, keywords, content } objects.
 * @returns {Promise<string>} The world info name.
 */
async function createWorldInfoFile(name, entryList) {
    const entries = buildWorldInfoEntries(entryList);

    const response = await fetch('/api/worldinfo/edit', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            name,
            data: { name, entries, extensions: {} },
        }),
    });

    if (!response.ok) {
        throw new Error(`World info creation failed (${name}): ${response.status} ${response.statusText}`);
    }

    return name;
}

/**
 * Creates a character card in SillyTavern with all session data.
 * Uses FormData to support avatar image upload.
 * @param {object} session - The current session state.
 * @returns {Promise<string>} The character name.
 */
async function createCharacterCard(session, charLorebookName) {
    const fields = session.character.fields;
    const charName = fields.name || 'Unknown';

    const formData = new FormData();
    formData.append('ch_name', charName);
    formData.append('description', composeDescription(fields));
    formData.append('personality', fields.personality_summary || '');
    formData.append('scenario', fields.scenario || '');
    formData.append('first_mes', session.firstMessage.accepted || '');
    formData.append('mes_example', composeSpeechExamples(fields.speech_examples));
    formData.append('system_prompt', '');
    formData.append('depth_prompt_prompt', fields.character_note || '');
    formData.append('depth_prompt_depth', '4');
    formData.append('depth_prompt_role', 'system');
    formData.append('world', charLorebookName || '');
    formData.append('creator', 'TavernScenarioBuilder');
    formData.append('creator_notes', '');

    // Attach avatar image if provided
    if (session.character.avatarDataUrl) {
        const blob = await dataUrlToBlob(session.character.avatarDataUrl);
        formData.append('avatar', blob, 'avatar.png');
    }

    const response = await fetch('/api/characters/create', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Character creation failed: ${response.status} ${response.statusText}`);
    }

    return charName;
}

/**
 * Creates a persona in SillyTavern from the accepted persona description.
 * Uploads an avatar image if provided, otherwise uses a default.
 * @param {object} session - The current session state.
 * @returns {Promise<string>} The persona name.
 */
async function createPersonaST(session) {
    const personaDescription = session.persona.accepted || '';
    let personaName = session.persona.personaName || '';
    if (!personaName) {
        const firstLine = personaDescription.split('\n')[0] || '';
        personaName = firstLine.split(/\s+/).slice(0, 3).join(' ') || 'New Persona';
    }

    const avatarId = `${Date.now()}-${personaName.replace(/[^a-zA-Z0-9]/g, '')}.png`;

    // Upload avatar image
    const formData = new FormData();
    if (session.persona.avatarDataUrl) {
        const blob = await dataUrlToBlob(session.persona.avatarDataUrl);
        formData.append('avatar', blob, 'avatar.png');
    } else {
        // Fetch the default user avatar as fallback
        const defaultRes = await fetch('/img/ai4.png');
        const defaultBlob = await defaultRes.blob();
        formData.append('avatar', defaultBlob, 'avatar.png');
    }
    formData.append('overwrite_name', avatarId);

    const uploadResponse = await fetch('/api/avatars/upload', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        cache: 'no-cache',
        body: formData,
    });

    if (!uploadResponse.ok) {
        throw new Error(`Persona avatar upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    // Register the persona metadata
    initPersona(avatarId, personaName, personaDescription, '');
    saveSettingsDebounced();

    return personaName;
}

/**
 * Converts a data URL to a Blob.
 * @param {string} dataUrl - The data URL string.
 * @returns {Promise<Blob>} The blob.
 */
async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return res.blob();
}

/**
 * Orchestrates creation of all SillyTavern artifacts from session data.
 * Creates world info, character card, and persona in order.
 * Reports partial failures via the errors array.
 * @returns {Promise<{character: string, worldInfo: string, persona: string, errors: string[]}>}
 */
export async function createAll() {
    const session = getSession();
    const errors = [];
    let worldInfoName = '';
    let characterName = '';
    let personaName = '';

    let charLorebookName = '';

    // 1. Create location world info (standalone, not linked to character)
    try {
        worldInfoName = await createWorldInfoFile(
            `${session.character.fields.name || 'Unknown'} Locations`,
            session.location.entries,
        );
    } catch (err) {
        console.error('[TavernScenarioBuilder] Location world info creation failed:', err);
        errors.push('Location World Info');
    }

    // 2. Create character lorebook as World Info and link to character
    if (session.character.lorebook && session.character.lorebook.length > 0) {
        try {
            charLorebookName = await createWorldInfoFile(
                `${session.character.fields.name || 'Unknown'} Lorebook`,
                session.character.lorebook,
            );
        } catch (err) {
            console.error('[TavernScenarioBuilder] Character lorebook creation failed:', err);
            errors.push('Character Lorebook');
        }
    }

    // 3. Create character card (linked to character lorebook via 'world' field)
    try {
        characterName = await createCharacterCard(session, charLorebookName);
    } catch (err) {
        console.error('[TavernScenarioBuilder] Character creation failed:', err);
        errors.push('Character Card');
    }

    // 4. Create persona (with avatar upload)
    try {
        personaName = await createPersonaST(session);
    } catch (err) {
        console.error('[TavernScenarioBuilder] Persona creation failed:', err);
        errors.push('Persona');
    }

    // 5. Refresh SillyTavern UI lists so new artifacts are visible
    try {
        await Promise.all([
            getCharacters(),
            updateWorldInfoList(),
            getUserAvatars(true),
        ]);
    } catch (err) {
        console.warn('[TavernScenarioBuilder] UI refresh failed (artifacts were still created):', err);
    }

    return { character: characterName, worldInfo: worldInfoName, persona: personaName, errors };
}
