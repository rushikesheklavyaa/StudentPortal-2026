/**
 * attendance.js
 * Handles the Attendance section: selecting a class/batch, loading its
 * students, marking Present/Absent/Late/Leave, and saving to the sheet.
 */

import { apiGet, apiPost } from './api.js?v=2';
import { CONFIG } from './config.js?v=2';
import { showToast, showLoading, closeLoading, getTeacherSession, todayISO, initials, qs, qsa, populateSelect } from './utils.js?v=2';

let loadedStudents = [];
let attendanceState = {}; // { studentId: status }

export function initAttendanceModule() {
  populateSelect(qs('#attStandard'), CONFIG.STANDARDS, 'Select Standard');
  populateSelect(qs('#attBoard'), CONFIG.BOARDS, 'Select Board');
  populateSelect(qs('#attBatch'), CONFIG.BATCHES, 'Select Batch');
  qs('#attendanceDate').value = todayISO();
  qs('#attendanceDate').max = todayISO();

  qs('#loadAttendanceStudentsBtn').addEventListener('click', loadStudentsForAttendance);
}

async function loadStudentsForAttendance() {
  const date = qs('#attendanceDate').value;
  const standard = qs('#attStandard').value;
  const board = qs('#attBoard').value;
  const batch = qs('#attBatch').value;
  const area = qs('#attendanceContentArea');

  if (!date || !standard || !board || !batch) {
    showToast('Please select date, standard, board and batch.', 'warning');
    return;
  }

  area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading students...</p></div>`;

  const [studentsRes, attendanceRes] = await Promise.all([
    apiGet('getStudents', { standard, board, batch }),
    apiGet('getAttendance', { date, standard, board, batch })
  ]);

  if (!studentsRes.success) {
    area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${studentsRes.message}</p></div>`;
    return;
  }

  loadedStudents = studentsRes.students.filter((s) => s.Status !== 'Inactive');

  if (!loadedStudents.length) {
    area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-user-slash"></i><p>No active students found for this class and batch.</p></div>`;
    return;
  }

  // Pre-fill existing attendance for this date if it was already saved
  const existingByStudent = {};
  (attendanceRes.attendance || []).forEach((a) => { existingByStudent[a.StudentID] = a.Status; });

  attendanceState = {};
  loadedStudents.forEach((s) => {
    attendanceState[s.StudentID] = existingByStudent[s.StudentID] || 'Present';
  });

  renderAttendanceGrid();
}

function renderAttendanceGrid() {
  const area = qs('#attendanceContentArea');

  area.innerHTML = `
    <div class="attendance-summary-bar">
      <div class="summary-chip">Total: <b>${loadedStudents.length}</b></div>
      <div class="summary-chip">Present: <b id="countPresent">0</b></div>
      <div class="summary-chip">Absent: <b id="countAbsent">0</b></div>
      <div class="summary-chip">Late: <b id="countLate">0</b></div>
      <div class="summary-chip">Leave: <b id="countLeave">0</b></div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
      <button class="btn btn-solid-success btn-sm" id="markAllPresentBtn"><i class="fa-solid fa-check-double"></i> Mark All Present</button>
      <button class="btn btn-solid-danger btn-sm" id="markAllAbsentBtn"><i class="fa-solid fa-xmark"></i> Mark All Absent</button>
      <button class="btn btn-solid-primary btn-sm" id="saveAttendanceBtn" style="margin-left:auto;"><i class="fa-solid fa-floppy-disk"></i> Save Attendance</button>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Roll No</th>
            <th>Student Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="attendanceTableBody">
          ${loadedStudents.map((s) => `
            <tr>
              <td>${escapeHtml(s.RollNo)}</td>
              <td>
                <div class="name-cell">
                  <div class="avatar-chip">${initials(s.StudentName)}</div>
                  <div>${escapeHtml(s.StudentName)}</div>
                </div>
              </td>
              <td>
                <div class="status-pills" data-student-id="${s.StudentID}">
                  ${CONFIG.ATTENDANCE_STATUSES.map((status) => `
                    <button type="button" class="status-pill" data-status="${status}">${status}</button>
                  `).join('')}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  syncPillStates();

  qsa('.status-pills').forEach((group) => {
    qsa('.status-pill', group).forEach((pill) => {
      pill.addEventListener('click', () => {
        attendanceState[group.dataset.studentId] = pill.dataset.status;
        syncPillStates();
      });
    });
  });

  qs('#markAllPresentBtn').addEventListener('click', () => setAll('Present'));
  qs('#markAllAbsentBtn').addEventListener('click', () => setAll('Absent'));
  qs('#saveAttendanceBtn').addEventListener('click', saveAttendance);
}

function setAll(status) {
  loadedStudents.forEach((s) => { attendanceState[s.StudentID] = status; });
  syncPillStates();
}

function syncPillStates() {
  qsa('.status-pills').forEach((group) => {
    const currentStatus = attendanceState[group.dataset.studentId];
    qsa('.status-pill', group).forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.status === currentStatus);
    });
  });

  const counts = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  Object.values(attendanceState).forEach((status) => { if (counts[status] !== undefined) counts[status]++; });

  qs('#countPresent').textContent = counts.Present;
  qs('#countAbsent').textContent = counts.Absent;
  qs('#countLate').textContent = counts.Late;
  qs('#countLeave').textContent = counts.Leave;
}

async function saveAttendance() {
  const teacher = getTeacherSession();
  const date = qs('#attendanceDate').value;

  const records = loadedStudents.map((s) => ({
    studentId: s.StudentID,
    studentName: s.StudentName,
    standard: s.Standard,
    board: s.Board,
    batch: s.Batch,
    status: attendanceState[s.StudentID]
  }));

  showLoading('Saving attendance...');
  const result = await apiPost('markAttendance', {
    date,
    teacher: teacher ? teacher.name : 'Teacher',
    records
  });
  closeLoading();

  if (result.success) {
    showToast(result.message, 'success');
  } else {
    showToast(result.message || 'Could not save attendance.', 'error');
  }
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
