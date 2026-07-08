/**
 * login.js
 * Handles the teacher login form: validation, API call, session storage,
 * and small UX niceties (ripple effect, PIN visibility toggle).
 */

import { apiPost } from './api.js?v=2';
import { showToast, saveTeacherSession, getTeacherSession, applyAcademyLogo } from './utils.js?v=2';

applyAcademyLogo();

const form = document.getElementById('loginForm');
const nameInput = document.getElementById('teacherName');
const pinInput = document.getElementById('teacherPin');
const togglePinBtn = document.getElementById('togglePin');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');

// If already logged in, skip straight to the dashboard.
if (getTeacherSession()) {
  window.location.href = 'dashboard.html';
}

// PIN visibility toggle
togglePinBtn.addEventListener('click', () => {
  const isPassword = pinInput.type === 'password';
  pinInput.type = isPassword ? 'text' : 'password';
  togglePinBtn.innerHTML = isPassword
    ? '<i class="fa-solid fa-eye-slash"></i>'
    : '<i class="fa-solid fa-eye"></i>';
});

// Ripple effect on the primary button
loginBtn.addEventListener('click', function (e) {
  const rect = this.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  this.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const pin = pinInput.value.trim();

  if (!name || !pin) {
    showToast('Please enter both your name and PIN.', 'warning');
    return;
  }

  setLoading(true);

  const result = await apiPost('loginTeacher', { name, pin });

  setLoading(false);

  if (result.success) {
    saveTeacherSession(result.teacher);
    showToast('Welcome back, ' + result.teacher.name + '!', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
  } else {
    showToast(result.message || 'Invalid name or PIN.', 'error');
    pinInput.value = '';
    pinInput.focus();
  }
});

function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtnText.innerHTML = isLoading
    ? '<span class="spinner"></span> Signing in...'
    : 'Sign In';
}
