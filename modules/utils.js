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
