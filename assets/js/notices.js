/**
 * notices.js
 * Teacher/Admin side of Notices & Appreciation: post a message targeted
 * at a student, a standard, a batch, or (Admin only) everyone, and view
 * everything that's been posted so far.
 */

import { apiGet, apiPost } from './api.js?v=2';
import { CONFIG } from './config.js?v=2';
import { showToast, showLoading, closeLoading, qs, populateSelect, fileToUploadPayload } from './utils.js?v=2';

let currentTeacherName = 'Teacher';
let isAdmin = false;

export function initNoticesModule(teacher) {
  currentTeacherName = teacher.name;
  isAdmin = teacher.role === 'Admin';

  populateSelect(qs('#noticeTargetStandard'), CONFIG.STANDARDS, 'Select Standard');
  populateSelect(qs('#noticeTargetBatch'), CONFIG.BATCHES, 'Select Batch');

  // Only Admin gets the "Everyone" option — hide it for regular teachers.
  qs('#noticeTargetType').querySelectorAll('.admin-only-option').forEach((opt) => {
    if (!isAdmin) opt.remove();
  });

  qs('#noticeTargetType').addEventListener('change', updateTargetFieldVisibility);
  updateTargetFieldVisibility();

  qs('#noticeForm').addEventListener('submit', handleNoticeSubmit);

  loadNotices();
}

function updateTargetFieldVisibility() {
  const type = qs('#noticeTargetType').value;
  qs('#noticeTargetStudentField').style.display = type === 'Student' ? '' : 'none';
  qs('#noticeTargetStandardField').style.display = type === 'Standard' ? '' : 'none';
  qs('#noticeTargetBatchField').style.display = type === 'Batch' ? '' : 'none';
}

async function handleNoticeSubmit(e) {
  e.preventDefault();

  const type = qs('#noticeType').value;
  const targetType = qs('#noticeTargetType').value;
  const title = qs('#noticeTitle').value.trim();
  const message = qs('#noticeMessage').value.trim();

  let targetValue = '';
  if (targetType === 'Student') targetValue = qs('#noticeTargetStudentId').value.trim();
  if (targetType === 'Standard') targetValue = qs('#noticeTargetStandard').value;
  if (targetType === 'Batch') targetValue = qs('#noticeTargetBatch').value;

  if (targetType !== 'All' && !targetValue) {
    showToast('Please choose who this should go to.', 'warning');
    return;
  }

  const payload = {
    type, title, message, targetType, targetValue,
    createdBy: currentTeacherName
  };

  const imageFile = qs('#noticeImageInput').files[0];
  if (imageFile) {
    try {
      const upload = await fileToUploadPayload(imageFile, 'image');
      payload.imageBase64 = upload.base64;
      payload.imageMimeType = upload.mimeType;
      payload.imageFileName = upload.fileName;
    } catch (err) {
      showToast(err.message, 'warning');
      return;
    }
  }

  showLoading('Posting...');
  const result = await apiPost('createNotice', payload);
  closeLoading();

  if (result.success) {
    showToast('Posted successfully.', 'success');
    qs('#noticeForm').reset();
    updateTargetFieldVisibility();
    loadNotices();
  } else {
    showToast(result.message || 'Could not post.', 'error');
  }
}

export async function loadNotices() {
  const list = qs('#noticesListArea');
  list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading...</p></div>`;

  const result = await apiGet('getNotices', { mode: 'all' });
  if (!result.success) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${result.message || 'Could not load posts.'}</p></div>`;
    return;
  }

  if (!result.notices.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bullhorn"></i><p>No notices or appreciation posts yet.</p></div>`;
    return;
  }

  list.innerHTML = result.notices.map((n) => {
    const isAppreciation = n.Type === 'Appreciation';
    const targetLabel = n.TargetType === 'All' ? 'Everyone'
      : n.TargetType === 'Standard' ? `Standard ${n.TargetValue}`
      : n.TargetType === 'Batch' ? `${n.TargetValue} Batch`
      : `Student ${n.TargetValue}`;

    return `
      <div class="activity-item">
        <div class="activity-icon ${isAppreciation ? 'test' : 'att'}">
          <i class="fa-solid ${isAppreciation ? 'fa-star' : 'fa-bullhorn'}"></i>
        </div>
        <div style="flex:1;">
          <div class="activity-text"><strong>${escapeHtml(n.Title)}</strong> &middot; <span class="badge badge-info">${targetLabel}</span></div>
          <div class="activity-text" style="margin-top:4px;">${escapeHtml(n.Message)}</div>
          ${n.ImageURL ? `<img src="${n.ImageURL}" class="notice-image-thumb" onclick="window.open('${n.ImageURL}','_blank')" alt="Attached image" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'notice-image-thumb',style:'display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;',textContent:'Image unavailable'}));">` : ''}
          <div class="activity-time">By ${escapeHtml(n.CreatedBy)} &middot; ${formatWhen(n.CreatedAt)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function formatWhen(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
