// ===========================
// MJ Auto Batcher - Popup Script
// ===========================

console.log('Popup script loaded');

// ===========================
// Elements
// ===========================

const statusEl = document.getElementById('popup-status');
const queueCountEl = document.getElementById('popup-queue-count');
const currentEl = document.getElementById('popup-current');
const openMJBtn = document.getElementById('popup-open-midjourney');
const refreshBtn = document.getElementById('popup-refresh-state');
const statCompletedEl = document.getElementById('stat-completed');
const statFailedEl = document.getElementById('stat-failed');
const statPendingEl = document.getElementById('stat-pending');

// ===========================
// Load State
// ===========================

async function loadState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    updateUI(response);
  } catch (error) {
    console.error('Failed to load state:', error);
    showError();
  }
}

function updateUI(state) {
  // Status
  if (state.isRunning) {
    statusEl.textContent = state.isPaused ? 'Paused' : 'Running';
    statusEl.className = 'status-value ' + (state.isPaused ? 'status-paused' : 'status-running');
  } else {
    statusEl.textContent = 'Idle';
    statusEl.className = 'status-value status-idle';
  }

  // Queue count
  queueCountEl.textContent = `${state.queueLength || 0} job${state.queueLength !== 1 ? 's' : ''}`;

  // Current job
  if (state.currentJob) {
    currentEl.textContent = truncate(state.currentJob.prompt, 40);
    currentEl.title = state.currentJob.prompt;
  } else {
    currentEl.textContent = '-';
    currentEl.title = '';
  }

  // Stats
  const completed = state.jobHistory ? state.jobHistory.filter(j => j.status === 'completed').length : 0;
  const failed = state.jobHistory ? state.jobHistory.filter(j => j.status === 'failed').length : 0;
  const pending = state.queueLength || 0;

  statCompletedEl.textContent = completed;
  statFailedEl.textContent = failed;
  statPendingEl.textContent = pending;
}

function showError() {
  statusEl.textContent = 'Error';
  statusEl.className = 'status-value status-error';
  queueCountEl.textContent = '-';
  currentEl.textContent = 'Failed to connect';
}

// ===========================
// Event Listeners
// ===========================

openMJBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.midjourney.com/imagine' });
  window.close();
});

refreshBtn.addEventListener('click', () => {
  loadState();
});

// ===========================
// Utilities
// ===========================

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

// ===========================
// Initialize
// ===========================

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  
  // Auto refresh every 2 seconds
  setInterval(loadState, 2000);
});

console.log('Popup script ready');
