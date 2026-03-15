/**
 * Shared utility functions for Tavern Scenario Builder.
 * @module utils
 */

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text - Raw text to escape.
 * @returns {string} Escaped HTML-safe string. Returns empty string for falsy input.
 */
export function escapeHTML(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Creates a debounced version of a function that delays invocation
 * until after the specified wait period has elapsed since the last call.
 * @param {Function} fn - The function to debounce.
 * @param {number} ms - Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
export function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Extracts a JSON object or array from AI output text.
 * Tries: direct parse → markdown code block extraction → regex match for {...} or [...].
 * @param {string} text - Raw AI output text.
 * @returns {object|Array|null} Parsed JSON, or null on failure.
 */
export function extractJSON(text) {
    if (!text) return null;

    // Try direct parse
    try {
        return JSON.parse(text);
    } catch { /* continue */ }

    // Try extracting from markdown code block (```json ... ``` or ``` ... ```)
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
        try {
            return JSON.parse(codeBlockMatch[1].trim());
        } catch { /* continue */ }
    }

    // Try matching first {...} or [...] block
    const braceMatch = text.match(/(\{[\s\S]*\})/);
    if (braceMatch) {
        try {
            return JSON.parse(braceMatch[1]);
        } catch { /* continue */ }
    }
    const bracketMatch = text.match(/(\[[\s\S]*\])/);
    if (bracketMatch) {
        try {
            return JSON.parse(bracketMatch[1]);
        } catch { /* continue */ }
    }

    return null;
}
