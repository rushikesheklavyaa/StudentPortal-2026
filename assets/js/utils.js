/**
 * utils.js
 * Shared helper functions used across the portal: notifications,
 * session storage helpers, formatting and small DOM utilities.
 */

import { CONFIG } from './config.js?v=2';

// ---------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------

export function showToast(message, type = 'success') {
  const colors = {
    success: 'linear-gradient(135deg,#22C55E,#16a34a)',
    error: 'linear-gradient(135deg,#EF4444,#b91c1c)',
    info: 'linear-gradient(135deg,#2563EB,#1E3A8A)',
    warning: 'linear-gradient(135deg,#F59E0B,#d97706)'
  };

  Toastify({
    text: message,
    duration: 3200,
    gravity: 'top',
    position: 'right',
    stopOnFocus: true,
    style: {
      background: colors[type] || colors.info,
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
      fontFamily: 'Poppins, sans-serif',
      fontSize: '14px',
      padding: '14px 20px'
    }
  }).showToast();
}

export function showLoading(title = 'Please wait...') {
  Swal.fire({
    title,
    html: '<div class="ea-swal-spinner"></div>',
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    background: '#FFFFFF',
    customClass: { popup: 'ea-swal-popup' }
  });
}

export function closeLoading() {
  Swal.close();
}

export function confirmAction({ title, text, confirmText = 'Yes, proceed', icon = 'warning' }) {
  return Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#EF4444',
    cancelButtonColor: '#94a3b8',
    reverseButtons: true,
    customClass: { popup: 'ea-swal-popup' }
  }).then((res) => res.isConfirmed);
}

export function alertSuccess(title, text = '') {
  return Swal.fire({
    title,
    text,
    icon: 'success',
    confirmButtonColor: '#2563EB',
    customClass: { popup: 'ea-swal-popup' }
  });
}

export function alertError(title, text = '') {
  return Swal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonColor: '#2563EB',
    customClass: { popup: 'ea-swal-popup' }
  });
}

// ---------------------------------------------------------------
// SESSION
// ---------------------------------------------------------------

export function saveTeacherSession(teacher) {
  sessionStorage.setItem(CONFIG.STORAGE_KEYS.TEACHER, JSON.stringify(teacher));
}

export function getTeacherSession() {
  const raw = sessionStorage.getItem(CONFIG.STORAGE_KEYS.TEACHER);
  return raw ? JSON.parse(raw) : null;
}

export function clearTeacherSession() {
  sessionStorage.removeItem(CONFIG.STORAGE_KEYS.TEACHER);
}

export function requireTeacherAuth() {
  const teacher = getTeacherSession();
  if (!teacher) {
    window.location.href = 'index.html';
    return null;
  }
  return teacher;
}

// ---------------------------------------------------------------
// FORMATTING / MISC
// ---------------------------------------------------------------

export function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().split('T')[0];
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function statusBadgeClass(status) {
  const map = {
    Present: 'badge-success',
    Absent: 'badge-danger',
    Late: 'badge-warning',
    Leave: 'badge-info'
  };
  return map[status] || 'badge-info';
}

export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------------------------------------------------------------
// FILE UPLOADS
// ---------------------------------------------------------------

/**
 * Reads a File into a { base64, mimeType, fileName } object ready to send
 * to the backend. Validates type + size against CONFIG.UPLOAD_LIMITS first.
 * @param {File} file
 * @param {'image'|'pdf'} kind
 * @returns {Promise<{base64:string,mimeType:string,fileName:string}>}
 */
export function fileToUploadPayload(file, kind = 'image') {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('No file selected.')); return; }

    const allowedTypes = kind === 'pdf' ? CONFIG.UPLOAD_LIMITS.PDF_TYPES : CONFIG.UPLOAD_LIMITS.IMAGE_TYPES;
    const maxMb = kind === 'pdf' ? CONFIG.UPLOAD_LIMITS.PDF_MAX_MB : CONFIG.UPLOAD_LIMITS.IMAGE_MAX_MB;

    if (allowedTypes.indexOf(file.type) === -1) {
      reject(new Error(kind === 'pdf' ? 'Please choose a PDF file.' : 'Please choose a JPG, PNG or WEBP image.'));
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      reject(new Error(`File is too large. Maximum allowed size is ${maxMb} MB.`));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      // reader.result looks like "data:application/pdf;base64,AAAA..."
      const base64 = String(reader.result).split(',')[1] || '';
      resolve({ base64, mimeType: file.type, fileName: file.name });
    };
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------
// ACADEMY LOGO
// ---------------------------------------------------------------

/**
 * Replaces every .logo-badge element on the page with the academy logo
 * image if one has been uploaded (Settings.LogoURL). Leaves the existing
 * "EA" text badge untouched if no logo is set yet, or on error.
 */
export async function applyAcademyLogo() {
  const renderLogo = (url) => {
    qsa('.logo-badge').forEach((badge) => {
      badge.innerHTML = '';
      const img = document.createElement('img');
      img.src = url;
      img.alt = CONFIG.ACADEMY_NAME;
      // If even this URL fails to load, fall back to the plain text badge
      // instead of showing a broken-image icon.
      img.onerror = () => {
        badge.innerHTML = '';
        badge.textContent = CONFIG.ACADEMY_NAME.charAt(0);
      };
      badge.appendChild(img);
    });
  };

  try {
    const { apiGet } = await import('./api.js?v=2');
    const result = await apiGet('getSettings');
    const logoUrl = result && result.success && result.settings ? result.settings.LogoURL : '';
    // Use the Admin-uploaded logo if one exists, otherwise fall back to the
    // logo hosted on GitHub so the badge is never empty/broken.
    renderLogo(logoUrl || CONFIG.FALLBACK_LOGO_URL);
  } catch (err) {
    // Backend unreachable (e.g. not deployed yet) — still show the GitHub logo.
    console.warn('Could not load academy logo from backend, using fallback:', err);
    renderLogo(CONFIG.FALLBACK_LOGO_URL);
  }
}

export function populateSelect(selectEl, options, placeholder) {
  selectEl.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    selectEl.appendChild(opt);
  }
  options.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    selectEl.appendChild(opt);
  });
}
