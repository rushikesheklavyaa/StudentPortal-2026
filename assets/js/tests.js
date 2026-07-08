/**
 * tests.js
 * Handles Tests (create + list), Marks Entry, and Reports sections.
 */

import { apiGet, apiPost } from './api.js?v=2';
import { CONFIG } from './config.js?v=2';
import {
  showToast, showLoading, closeLoading, getTeacherSession,
  formatDateDisplay, initials, statusBadgeClass, qs, qsa, populateSelect, fileToUploadPayload, downloadReport
} from './utils.js?v=2';

let allTests = [];
let marksLoadedStudents = [];
let marksState = {};
let answerSheetsByStudent = {};
let currentMarksTest = null;

// ================================================================
// TESTS
// ================================================================

export function initTestsModule() {
  populateSelect(qs('#testStandard'), CONFIG.STANDARDS, 'Select Standard');
  populateSelect(qs('#testBoard'), CONFIG.BOARDS, 'Select Board');
  populateSelect(qs('#testBatch'), CONFIG.BATCHES, 'Select Batch');

  qs('#createTestForm').addEventListener('submit', handleCreateTest);

  loadTests();
}

export async function loadTests() {
  const tbody = qs('#testsTableBody');
  tbody.innerHTML = `<tr><td colspan="8"><div class="skeleton" style="height:16px;"></div></td></tr>`;

  const result = await apiGet('getTests');
  if (result.success) {
    allTests = result.tests;
    renderTestsTable();
    populateMarksTestDropdown();
  } else {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${result.message}</p></div></td></tr>`;
  }
}

function renderTestsTable() {
  const tbody = qs('#testsTableBody');
  if (!allTests.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-file-circle-xmark"></i><p>No tests created yet.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = allTests.map((t) => `
    <tr>
      <td>${escapeHtml(t.TestName)}</td>
      <td>${escapeHtml(t.Subject)}</td>
      <td>${escapeHtml(t.Standard)}</td>
      <td>${escapeHtml(t.Board)}</td>
      <td>${escapeHtml(t.Batch)}</td>
      <td>${formatDateDisplay(t.Date)}</td>
      <td>${escapeHtml(t.MaximumMarks)}</td>
      <td>
        <div class="answer-sheet-cell">
          ${t.TestPaperURL
            ? `<a class="file-link-btn" href="${t.TestPaperURL}" target="_blank"><i class="fa-solid fa-file-pdf"></i> Paper</a>`
            : `<button type="button" class="file-link-btn pending" data-attach="testPaper" data-test-id="${t.TestID}"><i class="fa-solid fa-upload"></i> Add Paper</button>`}
          ${t.ModelAnswerURL
            ? `<a class="file-link-btn" href="${t.ModelAnswerURL}" target="_blank"><i class="fa-solid fa-file-pdf"></i> Answer Key</a>`
            : `<button type="button" class="file-link-btn pending" data-attach="modelAnswer" data-test-id="${t.TestID}"><i class="fa-solid fa-upload"></i> Add Answer Key</button>`}
          <input type="file" class="attachment-input-hidden" accept="application/pdf" data-input-for="${t.TestID}">
        </div>
      </td>
    </tr>
  `).join('');

  qsa('[data-attach]').forEach((btn) => {
    btn.addEventListener('click', () => triggerAttachUpload(btn.dataset.testId, btn.dataset.attach));
  });
}

function triggerAttachUpload(testId, kind) {
  const input = qsa(`[data-input-for="${testId}"]`)[0];
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    let upload;
    try {
      upload = await fileToUploadPayload(file, 'pdf');
    } catch (err) {
      showToast(err.message, 'warning');
      return;
    }

    const payload = { testId };
    if (kind === 'testPaper') {
      payload.testPaperBase64 = upload.base64;
      payload.testPaperMimeType = upload.mimeType;
      payload.testPaperFileName = upload.fileName;
    } else {
      payload.modelAnswerBase64 = upload.base64;
      payload.modelAnswerMimeType = upload.mimeType;
      payload.modelAnswerFileName = upload.fileName;
    }

    showLoading('Uploading...');
    const result = await apiPost('updateTestFiles', payload);
    closeLoading();

    if (result.success) {
      showToast('File uploaded successfully.', 'success');
      loadTests();
    } else {
      showToast(result.message || 'Could not upload file.', 'error');
    }
  };
  input.click();
}

async function handleCreateTest(e) {
  e.preventDefault();
  const teacher = getTeacherSession();

  const payload = {
    testName: qs('#testName').value.trim(),
    subject: qs('#testSubject').value.trim(),
    standard: qs('#testStandard').value,
    board: qs('#testBoard').value,
    batch: qs('#testBatch').value,
    date: qs('#testDate').value,
    maximumMarks: qs('#testMaxMarks').value,
    teacher: teacher ? teacher.name : 'Teacher'
  };

  if (!payload.testName || !payload.subject || !payload.standard || !payload.board || !payload.batch || !payload.date || !payload.maximumMarks) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  const testPaperFile = qs('#testPaperInput').files[0];
  const modelAnswerFile = qs('#modelAnswerInput').files[0];

  try {
    if (testPaperFile) {
      const upload = await fileToUploadPayload(testPaperFile, 'pdf');
      payload.testPaperBase64 = upload.base64;
      payload.testPaperMimeType = upload.mimeType;
      payload.testPaperFileName = upload.fileName;
    }
    if (modelAnswerFile) {
      const upload = await fileToUploadPayload(modelAnswerFile, 'pdf');
      payload.modelAnswerBase64 = upload.base64;
      payload.modelAnswerMimeType = upload.mimeType;
      payload.modelAnswerFileName = upload.fileName;
    }
  } catch (err) {
    showToast(err.message, 'warning');
    return;
  }

  showLoading('Creating test...');
  const result = await apiPost('createTest', payload);
  closeLoading();

  if (result.success) {
    showToast(result.message, 'success');
    qs('#createTestForm').reset();
    loadTests();
  } else {
    showToast(result.message || 'Could not create test.', 'error');
  }
}

// ================================================================
// MARKS ENTRY
// ================================================================

export function initMarksModule() {
  qs('#loadMarksStudentsBtn').addEventListener('click', loadStudentsForMarks);
}

function populateMarksTestDropdown() {
  const select = qs('#marksTestSelect');
  select.innerHTML = '<option value="">Select a test...</option>';
  allTests.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.TestID;
    opt.textContent = `${t.TestName} — ${t.Subject} (${t.Standard} / ${t.Board} / ${t.Batch})`;
    select.appendChild(opt);
  });
}

async function loadStudentsForMarks() {
  const testId = qs('#marksTestSelect').value;
  const area = qs('#marksContentArea');

  if (!testId) {
    showToast('Please select a test first.', 'warning');
    return;
  }

  const test = allTests.find((t) => t.TestID === testId);
  area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading students...</p></div>`;

  const studentsRes = await apiGet('getStudents', {
    standard: test.Standard, board: test.Board, batch: test.Batch
  });

  if (!studentsRes.success) {
    area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${studentsRes.message}</p></div>`;
    return;
  }

  marksLoadedStudents = studentsRes.students.filter((s) => s.Status !== 'Inactive');

  if (!marksLoadedStudents.length) {
    area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-user-slash"></i><p>No active students found for this test's class and batch.</p></div>`;
    return;
  }

  marksState = {};
  marksLoadedStudents.forEach((s) => { marksState[s.StudentID] = ''; });

  currentMarksTest = test;
  answerSheetsByStudent = {};
  const answerSheetsRes = await apiGet('getAnswerSheets', { testId });
  if (answerSheetsRes.success) {
    (answerSheetsRes.answerSheets || []).forEach((a) => { answerSheetsByStudent[a.StudentID] = a; });
  }

  renderMarksGrid(test);
}

function renderMarksGrid(test) {
  const area = qs('#marksContentArea');

  area.innerHTML = `
    <div class="summary-chip" style="margin-bottom:16px; display:inline-block;">
      Maximum Marks: <b>${escapeHtml(test.MaximumMarks)}</b>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Roll No</th>
            <th>Student Name</th>
            <th>Marks Obtained</th>
            <th>Answer Sheet</th>
          </tr>
        </thead>
        <tbody id="marksTableBody">
          ${marksLoadedStudents.map((s) => `
            <tr>
              <td>${escapeHtml(s.RollNo)}</td>
              <td>
                <div class="name-cell">
                  <div class="avatar-chip">${initials(s.StudentName)}</div>
                  <div>${escapeHtml(s.StudentName)}</div>
                </div>
              </td>
              <td>
                <input type="number" min="0" max="${escapeHtml(test.MaximumMarks)}" class="marks-input" data-student-id="${s.StudentID}"
                  style="width:110px; padding:8px 10px; border:1.5px solid var(--border); border-radius:8px;" placeholder="0" />
              </td>
              <td>
                <div class="answer-sheet-cell" data-answer-sheet-cell="${s.StudentID}">
                  ${renderAnswerSheetCell(s.StudentID)}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <button class="btn btn-solid-primary" id="saveMarksBtn" style="margin-top:16px;"><i class="fa-solid fa-floppy-disk"></i> Save Marks</button>
  `;

  qsa('.marks-input').forEach((input) => {
    input.addEventListener('input', () => {
      marksState[input.dataset.studentId] = input.value;
    });
  });

  qsa('[data-upload-answer-sheet]').forEach((btn) => {
    btn.addEventListener('click', () => triggerAnswerSheetUpload(btn.dataset.uploadAnswerSheet));
  });

  qs('#saveMarksBtn').addEventListener('click', () => saveMarksHandler(test));
}

function renderAnswerSheetCell(studentId) {
  const existing = answerSheetsByStudent[studentId];
  return `
    ${existing ? `<a class="file-link-btn" href="${existing.FileURL}" target="_blank"><i class="fa-solid fa-file-pdf"></i> View</a>` : ''}
    <button type="button" class="file-link-btn ${existing ? '' : 'pending'}" data-upload-answer-sheet="${studentId}">
      <i class="fa-solid fa-upload"></i> ${existing ? 'Replace' : 'Upload'}
    </button>
    <input type="file" class="attachment-input-hidden" accept="application/pdf" data-answer-sheet-input="${studentId}">
  `;
}

function triggerAnswerSheetUpload(studentId) {
  const input = qsa(`[data-answer-sheet-input="${studentId}"]`)[0];
  input.onchange = async () => {
    const file = input.files[0];
    if (!file || !currentMarksTest) return;

    const teacher = getTeacherSession();
    const student = marksLoadedStudents.find((s) => s.StudentID === studentId);

    let upload;
    try {
      upload = await fileToUploadPayload(file, 'pdf');
    } catch (err) {
      showToast(err.message, 'warning');
      return;
    }

    showLoading('Uploading answer sheet...');
    const result = await apiPost('uploadAnswerSheet', {
      testId: currentMarksTest.TestID,
      studentId,
      studentName: student ? student.StudentName : '',
      fileBase64: upload.base64,
      mimeType: upload.mimeType,
      fileName: upload.fileName,
      uploadedBy: teacher ? teacher.name : 'Teacher',
      uploaderRole: 'Teacher'
    });
    closeLoading();

    if (result.success) {
      showToast('Answer sheet uploaded.', 'success');
      answerSheetsByStudent[studentId] = { FileURL: result.url };
      qs(`[data-answer-sheet-cell="${studentId}"]`).innerHTML = renderAnswerSheetCell(studentId);
      qsa(`[data-upload-answer-sheet="${studentId}"]`).forEach((btn) => {
        btn.addEventListener('click', () => triggerAnswerSheetUpload(studentId));
      });
    } else {
      showToast(result.message || 'Could not upload answer sheet.', 'error');
    }
  };
  input.click();
}

async function saveMarksHandler(test) {
  const teacher = getTeacherSession();

  const records = marksLoadedStudents
    .filter((s) => marksState[s.StudentID] !== '' && marksState[s.StudentID] !== undefined)
    .map((s) => ({
      studentId: s.StudentID,
      studentName: s.StudentName,
      marks: Number(marksState[s.StudentID])
    }));

  if (!records.length) {
    showToast('Please enter marks for at least one student.', 'warning');
    return;
  }

  showLoading('Saving marks...');
  const result = await apiPost('saveMarks', {
    testId: test.TestID,
    teacher: teacher ? teacher.name : 'Teacher',
    records
  });
  closeLoading();

  if (result.success) {
    showToast(result.message, 'success');
  } else {
    showToast(result.message || 'Could not save marks.', 'error');
  }
}

// ================================================================
// REPORTS
// ================================================================

export function initReportsModule() {
  const reportType = qs('#reportType');
  reportType.addEventListener('change', toggleReportFields);
  qs('#reportDate').value = new Date().toISOString().split('T')[0];
  qs('#generateReportBtn').addEventListener('click', generateReport);
  toggleReportFields();
}

function toggleReportFields() {
  const type = qs('#reportType').value;
  qs('#reportDateField').style.display = type === 'daily' ? 'flex' : 'none';
  qs('#reportMonthField').style.display = type === 'monthly' ? 'flex' : 'none';
  qs('#reportStudentField').style.display = type === 'student' ? 'flex' : 'none';
}

async function generateReport() {
  const type = qs('#reportType').value;
  const area = qs('#reportResultArea');
  area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Generating report...</p></div>`;

  if (type === 'daily') {
    const date = qs('#reportDate').value;
    if (!date) { showToast('Please select a date.', 'warning'); return; }
    const res = await apiGet('getAttendance', { date });
    renderAttendanceReport(res.attendance || [], `Daily Attendance — ${formatDateDisplay(date)}`);
  } else if (type === 'monthly') {
    const month = qs('#reportMonth').value; // yyyy-mm
    if (!month) { showToast('Please select a month.', 'warning'); return; }
    const fromDate = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const toDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    const res = await apiGet('getAttendance', { fromDate, toDate });
    renderAttendanceReport(res.attendance || [], `Monthly Attendance — ${month}`);
  } else if (type === 'student') {
    const studentId = qs('#reportStudentId').value.trim();
    if (!studentId) { showToast('Please enter a student ID.', 'warning'); return; }
    const res = await apiGet('getStudentDashboard', { studentId });
    if (!res.success) {
      area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${res.message}</p></div>`;
      return;
    }
    renderStudentReport(res);
  } else if (type === 'test') {
    renderTestReport();
  }
}

function renderAttendanceReport(records, title) {
  const area = qs('#reportResultArea');
  if (!records.length) {
    area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clipboard"></i><p>No attendance records found for this period.</p></div>`;
    return;
  }

  const present = records.filter((r) => r.Status === 'Present').length;
  const absent = records.filter((r) => r.Status === 'Absent').length;
  const late = records.filter((r) => r.Status === 'Late').length;
  const leave = records.filter((r) => r.Status === 'Leave').length;

  const contentHtml = `
    <div class="summary-row">
      <div class="summary-chip">Total Records <b>${records.length}</b></div>
      <div class="summary-chip">Present <b>${present}</b></div>
      <div class="summary-chip">Absent <b>${absent}</b></div>
      <div class="summary-chip">Late <b>${late}</b></div>
      <div class="summary-chip">Leave <b>${leave}</b></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Student</th><th>Standard</th><th>Board</th><th>Batch</th><th>Status</th></tr></thead>
      <tbody>
        ${records.slice(0, 500).map((r) => `
          <tr>
            <td>${formatDateDisplay(r.Date)}</td>
            <td>${escapeHtml(r.StudentName)}</td>
            <td>${escapeHtml(r.Standard)}</td>
            <td>${escapeHtml(r.Board)}</td>
            <td>${escapeHtml(r.Batch)}</td>
            <td><span class="badge ${statusBadgeClass(r.Status)}">${escapeHtml(r.Status)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  area.innerHTML = `
    <div class="report-toolbar" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
      <h4 style="font-size:14.5px;">${title}</h4>
      <button class="btn btn-outline" id="downloadReportBtn"><i class="fa-solid fa-download"></i> Download PDF</button>
    </div>
    <div class="attendance-summary-bar">
      <div class="summary-chip">Total Records: <b>${records.length}</b></div>
      <div class="summary-chip">Present: <b>${present}</b></div>
      <div class="summary-chip">Absent: <b>${absent}</b></div>
      <div class="summary-chip">Late: <b>${late}</b></div>
      <div class="summary-chip">Leave: <b>${leave}</b></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Student</th><th>Standard</th><th>Board</th><th>Batch</th><th>Status</th></tr></thead>
        <tbody>
          ${records.slice(0, 200).map((r) => `
            <tr>
              <td>${formatDateDisplay(r.Date)}</td>
              <td>${escapeHtml(r.StudentName)}</td>
              <td>${escapeHtml(r.Standard)}</td>
              <td>${escapeHtml(r.Board)}</td>
              <td>${escapeHtml(r.Batch)}</td>
              <td><span class="badge ${statusBadgeClass(r.Status)}">${escapeHtml(r.Status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  qs('#downloadReportBtn').addEventListener('click', () => downloadReport(title, `${records.length} records`, contentHtml));
}

function renderStudentReport(res) {
  const area = qs('#reportResultArea');
  const { student, attendance, marks } = res;
  const title = `Student Report Card`;
  const subtitle = `${student.studentName} (${student.studentId}) &middot; ${student.standard} ${student.board} ${student.batch}`;

  const contentHtml = `
    <div class="summary-row">
      <div class="summary-chip">Standard <b>${escapeHtml(student.standard)}</b></div>
      <div class="summary-chip">Board <b>${escapeHtml(student.board)}</b></div>
      <div class="summary-chip">Batch <b>${escapeHtml(student.batch)}</b></div>
      <div class="summary-chip">Attendance % <b>${attendance.percent}%</b></div>
      <div class="summary-chip">Average Marks <b>${marks.average}%</b></div>
      ${marks.highest !== null && marks.highest !== undefined ? `<div class="summary-chip">Highest <b>${marks.highest}%</b></div>` : ''}
    </div>
    <h4 style="font-size:13.5px; margin:14px 0 8px;">Attendance History</h4>
    <table>
      <thead><tr><th>Date</th><th>Status</th></tr></thead>
      <tbody>
        ${attendance.history.map((a) => `
          <tr><td>${formatDateDisplay(a.Date)}</td><td><span class="badge ${statusBadgeClass(a.Status)}">${escapeHtml(a.Status)}</span></td></tr>
        `).join('') || '<tr><td colspan="2">No attendance history.</td></tr>'}
      </tbody>
    </table>
    <h4 style="font-size:13.5px; margin:18px 0 8px;">Test / Marks History</h4>
    <table>
      <thead><tr><th>Test</th><th>Subject</th><th>Date</th><th>Marks</th></tr></thead>
      <tbody>
        ${(marks.recent || []).map((m) => `
          <tr><td>${escapeHtml(m.testName)}</td><td>${escapeHtml(m.subject)}</td><td>${formatDateDisplay(m.date)}</td><td>${escapeHtml(m.marks)} / ${escapeHtml(m.maximumMarks)}</td></tr>
        `).join('') || '<tr><td colspan="4">No test records yet.</td></tr>'}
      </tbody>
    </table>
  `;

  area.innerHTML = `
    <div class="report-toolbar" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
      <h4 style="font-size:14.5px;">Student Report — ${escapeHtml(student.studentName)} (${escapeHtml(student.studentId)})</h4>
      <button class="btn btn-outline" id="downloadReportBtn"><i class="fa-solid fa-download"></i> Download PDF</button>
    </div>
    <div class="attendance-summary-bar">
      <div class="summary-chip">Standard: <b>${escapeHtml(student.standard)}</b></div>
      <div class="summary-chip">Board: <b>${escapeHtml(student.board)}</b></div>
      <div class="summary-chip">Batch: <b>${escapeHtml(student.batch)}</b></div>
      <div class="summary-chip">Attendance %: <b>${attendance.percent}%</b></div>
      <div class="summary-chip">Average Marks: <b>${marks.average}%</b></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Status</th></tr></thead>
        <tbody>
          ${attendance.history.slice(0, 100).map((a) => `
            <tr><td>${formatDateDisplay(a.Date)}</td><td><span class="badge ${statusBadgeClass(a.Status)}">${escapeHtml(a.Status)}</span></td></tr>
          `).join('') || '<tr><td colspan="2">No attendance history.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  qs('#downloadReportBtn').addEventListener('click', () => downloadReport(title, subtitle, contentHtml));
}

function renderTestReport() {
  const area = qs('#reportResultArea');
  if (!allTests.length) {
    area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-file-circle-xmark"></i><p>No tests available yet.</p></div>`;
    return;
  }

  const title = 'Test Reports';
  const contentHtml = `
    <table>
      <thead><tr><th>Test Name</th><th>Subject</th><th>Standard</th><th>Board</th><th>Batch</th><th>Date</th><th>Max Marks</th></tr></thead>
      <tbody>
        ${allTests.map((t) => `
          <tr>
            <td>${escapeHtml(t.TestName)}</td>
            <td>${escapeHtml(t.Subject)}</td>
            <td>${escapeHtml(t.Standard)}</td>
            <td>${escapeHtml(t.Board)}</td>
            <td>${escapeHtml(t.Batch)}</td>
            <td>${formatDateDisplay(t.Date)}</td>
            <td>${escapeHtml(t.MaximumMarks)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  area.innerHTML = `
    <div class="report-toolbar" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
      <h4 style="font-size:14.5px;">${title}</h4>
      <button class="btn btn-outline" id="downloadReportBtn"><i class="fa-solid fa-download"></i> Download PDF</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Test Name</th><th>Subject</th><th>Standard</th><th>Board</th><th>Batch</th><th>Date</th><th>Max Marks</th></tr></thead>
        <tbody>
          ${allTests.map((t) => `
            <tr>
              <td>${escapeHtml(t.TestName)}</td>
              <td>${escapeHtml(t.Subject)}</td>
              <td>${escapeHtml(t.Standard)}</td>
              <td>${escapeHtml(t.Board)}</td>
              <td>${escapeHtml(t.Batch)}</td>
              <td>${formatDateDisplay(t.Date)}</td>
              <td>${escapeHtml(t.MaximumMarks)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  qs('#downloadReportBtn').addEventListener('click', () => downloadReport(title, `${allTests.length} tests`, contentHtml));
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
