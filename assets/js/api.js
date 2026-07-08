/**
 * api.js
 * Central communication layer with the Google Apps Script backend.
 * Every network call in the app should go through the functions below.
 */

import { CONFIG } from './config.js?v=2';

/**
 * Performs a GET request against the Apps Script web app.
 * @param {string} action - Backend action name (matches doGet switch case).
 * @param {Object} params - Additional query params.
 * @returns {Promise<Object>} Parsed JSON response.
 */
export async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  try {
    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) throw new Error('Network response was not OK (' + response.status + ')');
    return await response.json();
  } catch (err) {
    console.error('apiGet error:', err);
    return { success: false, message: 'Could not reach the server. Please check your connection.' };
  }
}

/**
 * Performs a POST request against the Apps Script web app.
 * @param {string} action - Backend action name (matches doPost switch case).
 * @param {Object} payload - Body data sent to the backend.
 * @returns {Promise<Object>} Parsed JSON response.
 */
export async function apiPost(action, payload = {}) {
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      // Apps Script requires a "simple" content type to avoid CORS preflight issues.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
    if (!response.ok) throw new Error('Network response was not OK (' + response.status + ')');
    return await response.json();
  } catch (err) {
    console.error('apiPost error:', err);
    return { success: false, message: 'Could not reach the server. Please check your connection.' };
  }
}
