/**
 * students.js
 * Handles the Student Management section: list, search, filter,
 * pagination, add / edit / delete via modal form.
 */

import { apiGet, apiPost } from './api.js?v=2';
import { CONFIG } from './config.js?v=2';
import {
  showToast, showLoading, closeLoading, confirmAction,
  initials, debounce, qs, qsa, populateSelect
} from './utils.js?v=2';

const PAGE_SIZE = 8;

let allStudents = [];
let filteredStudents = [];
let currentPage = 1;

export function initStudentsModule() {
  populateFilterDropdowns();
  bindEvents();
  loadStudents();
}

function populateFilterDropdowns() {
  populateSelect(qs('#filterStandard'), CONFIG.STANDARDS, 'All Standards');
  populateSelect(qs('#filterBoard'), CONFIG.BOARDS, 'All Boards');
  populateSelect(qs('#filterBatch'), CONFIG.BATCHES, 'All Batches');

  populateSelect(qs('#studentStandard'), CONFIG.STANDARDS, 'Select Standard');
  populateSelect(qs('#studentBoard'), CONFIG.BOARDS, 'Select Board');
  populateSelect(qs('#studentBatch'), CONFIG.BATCHES, 'Select Batch');
}

function bindEvents() {
  qs('#openAddStudentBtn').addEventListener('click', () => openStudentModal());
  qs('#closeStudentModal').addEventListener('click', closeStudentModal);
  qs('#cancelStudentModal').addEventListener('click', closeStudentModal);
  qs('#studentModal').addEventListener('click', (e) => {
    if (e.target.id === 'studentModal') closeStudentModal();
  });

  qs('#studentForm').addEventListener('submit', handleStudentFormSubmit);

  qs('#studentSearchInput').addEventListener('input', debounce(applyFilters, 250));
  qs('#filterStandard').addEventListener('change', applyFilters);
  qs('#filterBoard').addEventListener('change', applyFilters);
  qs('#filterBatch').addEventListener('change', applyFilters);

  qs('#resetStudentFilters').addEventListener('click', () => {
    qs('#studentSearchInput').value = '';
    qs('#filterStandard').value = '';
    qs('#filterBoard').value = '';
    qs('#filterBatch').value = '';
    applyFilters();
  });

  // Quick action from dashboard view
  qsa('[data-quick="add-student"]').forEach((btn) => {
    btn.addEventListener('click', () => setTimeout(() => openStudentModal(), 150));
  });
}

export async function loadStudents() {
  const tbody = qs('#studentsTableBody');
  tbody.innerHTML = skeletonRows(4);

  const result = await apiGet('getStudents');
  if (result.success) {
    allStudents = result.students;
    applyFilters();
  } else {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${result.message || 'Could not load students.'}</p></div></td></tr>`;
  }
}

function applyFilters() {
  const search = qs('#studentSearchInput').value.trim().toLowerCase();
  const standard = qs('#filterStandard').value;
  const board = qs('#filterBoard').value;
  const batch = qs('#filterBatch').value;

  filteredStudents = allStudents.filter((s) => {
    const matchesSearch = !search ||
      String(s.StudentName).toLowerCase().includes(search) ||
      String(s.StudentID).toLowerCase().includes(search) ||
      String(s.RollNo).toLowerCase().includes(search);
    const matchesStandard = !standard || String(s.Standard) === standard;
    const matchesBoard = !board || String(s.Board) === board;
    const matchesBatch = !batch || String(s.Batch) === batch;
    return matchesSearch && matchesStandard && matchesBoard && matchesBatch;
  });

  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = qs('#studentsTableBody');
  const pagination = qs('#studentsPagination');

  if (!filteredStudents.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa-solid fa-user-slash"></i><p>No students found. Try adjusting filters or add a new student.</p></div></td></tr>`;
    pagination.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);
  currentPage = Math.min(currentPage, totalPages) || 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredStudents.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageItems.map((s) => `
    <tr>
      <td>
        <div class="name-cell">
          <div class="avatar-chip">${initials(s.StudentName)}</div>
          <div>${escapeHtml(s.StudentName)}</div>
        </div>
      </td>
      <td>${escapeHtml(s.StudentID)}</td>
      <td>${escapeHtml(s.Standard)}</td>
      <td>${escapeHtml(s.Board)}</td>
      <td>${escapeHtml(s.Batch)}</td>
      <td>${escapeHtml(s.RollNo)}</td>
      <td>${escapeHtml(s.ParentName || '-')}</td>
      <td><span class="badge ${s.Status === 'Inactive' ? 'badge-muted' : 'badge-success'}">${escapeHtml(s.Status)}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline btn-icon" data-action="edit" data-id="${s.StudentID}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-solid-danger btn-icon" data-action="delete" data-id="${s.StudentID}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  qsa('[data-action="edit"]', tbody).forEach((btn) =>
    btn.addEventListener('click', () => openStudentModal(btn.dataset.id)));
  qsa('[data-action="delete"]', tbody).forEach((btn) =>
    btn.addEventListener('click', () => handleDeleteStudent(btn.dataset.id)));

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = qs('#studentsPagination');
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }

  let pagesHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    pagesHtml += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  pagination.innerHTML = `
    <div class="info">Showing ${filteredStudents.length} student(s) — Page ${currentPage} of ${totalPages}</div>
    <div class="pages">${pagesHtml}</div>
  `;

  qsa('[data-page]', pagination).forEach((btn) => {
    btn.addEventListener('click', () => { currentPage = Number(btn.dataset.page); renderTable(); });
  });
}

function openStudentModal(studentId = null) {
  const form = qs('#studentForm');
  form.reset();
  qs('#editStudentId').value = '';

  if (studentId) {
    const student = allStudents.find((s) => s.StudentID === studentId);
    if (!student) return;
    qs('#studentModalTitle').textContent = 'Edit Student';
    qs('#editStudentId').value = student.StudentID;
    qs('#studentName').value = student.StudentName;
    qs('#studentRollNo').value = student.RollNo;
    qs('#studentStandard').value = student.Standard;
    qs('#studentBoard').value = student.Board;
    qs('#studentBatch').value = student.Batch;
    qs('#studentStatus').value = student.Status || 'Active';
    qs('#parentName').value = student.ParentName || '';
    qs('#parentMobile').value = student.ParentMobile || '';
    qs('#parentEmail').value = student.ParentEmail || '';

    const totalFeeEl = qs('#studentTotalFee');
    if (totalFeeEl) {
      apiGet('getFees', { studentId: student.StudentID }).then((res) => {
        const rec = res.success && res.fees && res.fees[0];
        qs('#studentTotalFee').value = rec ? rec.TotalFee : '';
        qs('#studentAmountPaid').value = rec ? rec.AmountPaid : '';
        qs('#studentPaymentMode').value = rec ? rec.PaymentMode : 'Full';
      });
    }
  } else {
    qs('#studentModalTitle').textContent = 'Add Student';
  }

  qs('#studentModal').classList.add('active');
}

function closeStudentModal() {
  qs('#studentModal').classList.remove('active');
}

async function handleStudentFormSubmit(e) {
  e.preventDefault();

  const editId = qs('#editStudentId').value;
  const payload = {
    studentName: qs('#studentName').value.trim(),
    rollNo: qs('#studentRollNo').value.trim(),
    standard: qs('#studentStandard').value,
    board: qs('#studentBoard').value,
    batch: qs('#studentBatch').value,
    status: qs('#studentStatus').value,
    parentName: qs('#parentName').value.trim(),
    parentMobile: qs('#parentMobile').value.trim(),
    parentEmail: qs('#parentEmail').value.trim()
  };

  if (!payload.studentName || !payload.rollNo || !payload.standard || !payload.board || !payload.batch) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  showLoading(editId ? 'Updating student...' : 'Adding student...');

  const result = editId
    ? await apiPost('updateStudent', { ...payload, studentId: editId })
    : await apiPost('addStudent', payload);

  // Fee fields only exist in the DOM for Admins (removed for teachers).
  // Save them as a separate fee record, keyed to the new/edited student.
  const totalFeeEl = qs('#studentTotalFee');
  if (result.success && totalFeeEl) {
    const studentId = editId || result.studentId;
    const totalFee = Number(totalFeeEl.value) || 0;
    const amountPaid = Number(qs('#studentAmountPaid').value) || 0;
    const paymentMode = qs('#studentPaymentMode').value;
    if (studentId && (totalFee > 0 || amountPaid > 0)) {
      await apiPost('saveFees', {
        studentId, studentName: payload.studentName,
        totalFee, amountPaid, paymentMode, installments: [], teacher: 'Admin'
      });
    }
  }

  closeLoading();

  if (result.success) {
    showToast(result.message, 'success');
    closeStudentModal();
    loadStudents();
  } else {
    showToast(result.message || 'Something went wrong.', 'error');
  }
}

async function handleDeleteStudent(studentId) {
  const student = allStudents.find((s) => s.StudentID === studentId);
  const confirmed = await confirmAction({
    title: 'Delete this student?',
    text: `This will permanently remove ${student ? student.StudentName : 'this student'} from the system.`,
    confirmText: 'Yes, delete'
  });

  if (!confirmed) return;

  showLoading('Deleting student...');
  const result = await apiPost('deleteStudent', { studentId });
  closeLoading();

  if (result.success) {
    showToast(result.message, 'success');
    loadStudents();
  } else {
    showToast(result.message || 'Could not delete student.', 'error');
  }
}

function skeletonRows(count) {
  return Array.from({ length: count }).map(() => `
    <tr>
      ${Array.from({ length: 9 }).map(() => `<td><div class="skeleton" style="height:16px;width:80%;"></div></td>`).join('')}
    </tr>
  `).join('');
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Exported so other modules (attendance/tests) can reuse the cached list.
export function getCachedStudents() {
  return allStudents;
}
