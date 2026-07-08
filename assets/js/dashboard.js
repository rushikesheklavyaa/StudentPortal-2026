/**
 * dashboard.js
 * Entry point / orchestrator for dashboard.html. Handles session guard,
 * sidebar navigation, the overview stats + chart, and wires up the
 * feature modules (students, attendance, tests, marks, reports).
 */

import { apiGet } from './api.js?v=2';
import { requireTeacherAuth, clearTeacherSession, initials, qs, qsa, applyAcademyLogo } from './utils.js?v=2';
import { initStudentsModule } from './students.js?v=2';
import { initAttendanceModule } from './attendance.js?v=2';
import { initTestsModule, initMarksModule, initReportsModule, loadTests } from './tests.js?v=2';
import { initFeesModule, loadFees } from './fees.js?v=2';
import { initNoticesModule, loadNotices } from './notices.js?v=2';
import { initSettingsModule, loadCurrentLogo } from './settings.js?v=2';

// ---------------------------------------------------------------
// SESSION GUARD
// ---------------------------------------------------------------

const teacher = requireTeacherAuth();
applyAcademyLogo();

if (teacher) {
  qs('#teacherNameChip').textContent = teacher.name;
  qs('#teacherAvatar').textContent = initials(teacher.name);
  qs('#teacherRoleChip').textContent = teacher.role === 'Admin' ? 'Administrator' : 'Instructor';

  if (teacher.role !== 'Admin') {
    qsa('.admin-only').forEach((el) => el.remove());
  }
}

// ---------------------------------------------------------------
// NAVIGATION
// ---------------------------------------------------------------

const pageTitles = {
  'view-dashboard': ['Dashboard', "Welcome back! Here's what's happening today."],
  'view-students': ['Students', 'Manage your enrolled students'],
  'view-attendance': ['Attendance', "Mark and track today's attendance"],
  'view-tests': ['Tests', 'Create and manage tests'],
  'view-marks': ['Marks Entry', 'Enter and review test scores'],
  'view-reports': ['Reports', 'Attendance and performance reports'],
  'view-notices': ['Notices & Appreciation', 'Post updates and appreciation for students'],
  'view-fees': ['Fees', 'Track payments and outstanding balances'],
  'view-settings': ['Settings', 'Academy branding and configuration']
};

function switchView(viewId) {
  qsa('.view-section').forEach((section) => section.classList.toggle('active', section.id === viewId));
  qsa('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === viewId));

  const [title, subtitle] = pageTitles[viewId] || ['Dashboard', ''];
  qs('#pageTitle').textContent = title;
  qs('#pageSubtitle').textContent = subtitle;

  if (viewId === 'view-dashboard') loadDashboardStats();
  if (viewId === 'view-tests' || viewId === 'view-marks') loadTests();
  if (viewId === 'view-notices') loadNotices();
  if (viewId === 'view-fees') loadFees();
  if (viewId === 'view-settings') loadCurrentLogo();

  closeSidebarOnMobile();
}

qsa('[data-view]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    switchView(el.dataset.view);
  });
});

// ---------------------------------------------------------------
// SIDEBAR (mobile)
// ---------------------------------------------------------------

const sidebar = qs('#sidebar');
const sidebarOverlay = qs('#sidebarOverlay');

qs('#menuToggle').addEventListener('click', () => {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('active');
});

sidebarOverlay.addEventListener('click', closeSidebarOnMobile);

function closeSidebarOnMobile() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
}

// ---------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------

qs('#logoutBtn').addEventListener('click', () => {
  Swal.fire({
    title: 'Log out?',
    text: 'You will need your name and PIN to sign in again.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, log out',
    confirmButtonColor: '#EF4444',
    cancelButtonColor: '#94a3b8',
    customClass: { popup: 'ea-swal-popup' }
  }).then((res) => {
    if (res.isConfirmed) {
      clearTeacherSession();
      window.location.href = 'index.html';
    }
  });
});

// ---------------------------------------------------------------
// DASHBOARD STATS + CHART
// ---------------------------------------------------------------

let trendChart = null;

async function loadDashboardStats() {
  const result = await apiGet('getDashboardStats');
  if (!result.success) return;

  const { stats, recentActivity } = result;

  animateCount('#statTotalStudents', stats.totalStudents);
  animateCount('#statPresentToday', stats.presentToday);
  animateCount('#statAbsentToday', stats.absentToday);
  animateCount('#statTotalTests', stats.totalTests);

  renderActivity(recentActivity);
  renderTrendChart();
}

function animateCount(selector, target) {
  const el = qs(selector);
  const start = 0;
  const duration = 600;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    el.textContent = Math.round(start + (target - start) * progress);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderActivity(activity) {
  const list = qs('#activityList');
  if (!activity || !activity.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clock"></i><p>No recent activity yet.</p></div>`;
    return;
  }

  list.innerHTML = activity.map((a) => `
    <div class="activity-item">
      <div class="activity-icon ${a.type === 'test' ? 'test' : 'att'}">
        <i class="fa-solid ${a.type === 'test' ? 'fa-file-pen' : 'fa-user-check'}"></i>
      </div>
      <div>
        <div class="activity-text">${escapeHtml(a.text)}</div>
        <div class="activity-time">${timeAgo(a.time)}</div>
      </div>
    </div>
  `).join('');
}

async function renderTrendChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const results = await Promise.all(days.map((date) => apiGet('getAttendance', { date })));

  const presentCounts = results.map((r) => (r.attendance || []).filter((a) => a.Status === 'Present' || a.Status === 'Late').length);
  const absentCounts = results.map((r) => (r.attendance || []).filter((a) => a.Status === 'Absent').length);

  const labels = days.map((d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short' }));

  const ctx = qs('#attendanceTrendChart').getContext('2d');
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Present',
          data: presentCounts,
          borderColor: '#22C55E',
          backgroundColor: 'rgba(34,197,94,0.12)',
          tension: 0.4,
          fill: true,
          pointRadius: 4
        },
        {
          label: 'Absent',
          data: absentCounts,
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Poppins' }, boxWidth: 12 } } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { grid: { display: false } }
      }
    }
  });
}

function timeAgo(timestamp) {
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return '';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return Math.floor(diffSec / 60) + ' min ago';
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' hr ago';
  return Math.floor(diffSec / 86400) + ' day(s) ago';
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------

initStudentsModule();
initAttendanceModule();
initTestsModule();
initMarksModule();
initReportsModule();
initNoticesModule(teacher);
if (teacher.role === 'Admin') initFeesModule();
if (teacher.role === 'Admin') initSettingsModule();
loadDashboardStats();
