/**
 * settings.js
 * Admin-only Settings screen: upload/replace the academy logo shown on
 * the login page, dashboard sidebar and student portal header.
 */

import { apiGet, apiPost } from './api.js?v=2';
import { showToast, showLoading, closeLoading, getTeacherSession, fileToUploadPayload, qs, applyAcademyLogo } from './utils.js?v=2';

export function initSettingsModule() {
  qs('#logoUploadForm').addEventListener('submit', handleLogoUpload);
  loadCurrentLogo();
}

export async function loadCurrentLogo() {
  const preview = qs('#currentLogoPreview');
  let logoUrl = '';
  try {
    const result = await apiGet('getSettings');
    logoUrl = result && result.success && result.settings ? result.settings.LogoURL : '';
  } catch (err) {
    console.warn('Could not reach backend for settings, using fallback logo preview:', err);
  }

  const { CONFIG } = await import('./config.js?v=2');
  preview.innerHTML = `<img src="${logoUrl || CONFIG.FALLBACK_LOGO_URL}" alt="Academy logo">`;
}

async function handleLogoUpload(e) {
  e.preventDefault();
  const teacher = getTeacherSession();
  const fileInput = qs('#logoFileInput');
  const file = fileInput.files[0];

  if (!file) {
    showToast('Please choose an image file first.', 'warning');
    return;
  }

  let upload;
  try {
    upload = await fileToUploadPayload(file, 'image');
  } catch (err) {
    showToast(err.message, 'warning');
    return;
  }

  showLoading('Uploading logo...');
  const result = await apiPost('uploadLogo', {
    teacherId: teacher ? teacher.teacherId : '',
    imageBase64: upload.base64,
    mimeType: upload.mimeType,
    fileName: upload.fileName
  });
  closeLoading();

  if (result.success) {
    showToast('Logo updated successfully.', 'success');
    fileInput.value = '';
    loadCurrentLogo();
    applyAcademyLogo(); // refresh the sidebar badge on this same page too
  } else {
    showToast(result.message || 'Could not upload logo.', 'error');
  }
}
