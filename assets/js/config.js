/**
 * config.js
 * Global configuration for the Eklavyaa Academy Attendance Portal.
 * Replace API_URL with your deployed Google Apps Script Web App URL.
 */

export const CONFIG = {
  // Paste your Apps Script Web App deployment URL here.
  API_URL: 'https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID_HERE/exec',

  ACADEMY_NAME: 'Eklavyaa Academy',

  // Fallback logo — served directly from GitHub (raw.githubusercontent.com).
  // Shown until an Admin uploads a logo through Settings, or if that upload/backend is unavailable.
  FALLBACK_LOGO_URL: 'https://raw.githubusercontent.com/rushikesheklavyaa/StudentPortal-2026/main/logo.jpg',

  STANDARDS: ['5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'],
  BOARDS: ['SSC', 'CBSE', 'ICSE', 'IB'],
  BATCHES: ['Morning', 'Afternoon', 'Evening', 'Weekend'],

  ATTENDANCE_STATUSES: ['Present', 'Absent', 'Late', 'Leave'],

  STORAGE_KEYS: {
    TEACHER: 'eklavyaa_teacher_session'
  },

  UPLOAD_LIMITS: {
    IMAGE_MAX_MB: 4,
    PDF_MAX_MB: 10,
    IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    PDF_TYPES: ['application/pdf']
  }
};
