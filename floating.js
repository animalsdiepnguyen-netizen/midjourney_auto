// ===========================
// MJ Auto Batcher - Floating Panel
// ===========================

console.log('Floating panel script loading...');

let panelInjected = false;
let currentState = null;

// ===========================
// Inject Panel (with retry)
// ===========================

function injectPanel() {
  if (panelInjected) return;

  console.log('Injecting floating panel...');

  // Tạo floating button
  const floatingBtn = document.createElement('div');
  floatingBtn.id = 'mj-batcher-float-btn';
  floatingBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="9" y1="9" x2="15" y2="9"></line>
      <line x1="9" y1="12" x2="15" y2="12"></line>
      <line x1="9" y1="15" x2="15" y2="15"></line>
    </svg>
  `;
  floatingBtn.title = 'MJ Auto Batcher';

  // Tạo panel
  const panel = document.createElement('div');
  panel.id = 'mj-batcher-panel';
  panel.innerHTML = createPanelHTML();

  // Append vào body
  document.body.appendChild(floatingBtn);
  document.body.appendChild(panel);

  // Event listeners
  attachEventListeners(floatingBtn, panel);

  panelInjected = true;
  console.log('Floating panel injected successfully');

  // Load initial state
  loadState();
}

// ===========================
// Panel HTML
// ===========================

function createPanelHTML() {
  return `
    <div class="mj-panel-header">
      <h3>🎨 MJ Auto Batcher</h3>
      <button id="mj-panel-close" class="mj-btn-icon">×</button>
    </div>

    <div class="mj-panel-body">
      <!-- Status -->
      <div class="mj-status-section">
        <div class="mj-status-badge" id="mj-status">
          <span class="mj-status-dot"></span>
          <span id="mj-status-text">Idle</span>
        </div>
        <div class="mj-queue-info">
          Queue: <strong id="mj-queue-count">0</strong> jobs
        </div>
      </div>

      <!-- Current Job -->
      <div class="mj-current-job" id="mj-current-job" style="display: none;">
        <div class="mj-section-title">Current Job</div>
        <div class="mj-job-card">
          <div class="mj-job-prompt" id="mj-current-prompt">-</div>
          <div class="mj-job-progress">
            <div class="mj-progress-bar">
              <div class="mj-progress-fill"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Job Form -->
      <div class="mj-section">
        <div class="mj-section-title">Add Job</div>
        
        <div class="mj-tabs">
          <button class="mj-tab active" data-tab="text">Text → Image</button>
          <button class="mj-tab" data-tab="image">Image → Image</button>
          <button class="mj-tab" data-tab="video">Image → Video</button>
        </div>

        <div class="mj-tab-content active" data-content="text">
          <textarea 
            id="mj-prompt-input" 
            placeholder="Enter your prompts (one per line)&#10;&#10;Example:&#10;a beautiful sunset over mountains&#10;a futuristic city at night&#10;an abstract painting of emotions"
            rows="6"
          ></textarea>
          <button id="mj-add-jobs-btn" class="mj-btn mj-btn-primary">
            Add to Queue
          </button>
        </div>

        <div class="mj-tab-content" data-content="image">
          <input type="file" id="mj-image-input" accept="image/*" multiple>
          <textarea 
            id="mj-image-prompt" 
            placeholder="Optional: Add prompt for image processing"
            rows="3"
          ></textarea>
          <button id="mj-add-image-jobs-btn" class="mj-btn mj-btn-primary">
            Add Image Jobs
          </button>
        </div>

        <div class="mj-tab-content" data-content="video">
          <div class="mj-upload-section">
            <div class="mj-upload-area" id="mj-video-drop-zone">
              <input type="file" id="mj-video-images-input" accept="image/*,.webp" multiple hidden>
              <div class="mj-upload-placeholder">
                <div class="mj-upload-icon">📁</div>
                <div class="mj-upload-text">
                  <strong>Drag & Drop images here</strong>
                  <br>or click to browse
                </div>
                <div class="mj-upload-hint">
                  Supports: PNG, JPG, WEBP | <strong>No limit!</strong> Upload as many as you want (100, 200, 500+)
                </div>
              </div>
              <div id="mj-video-images-count" class="mj-images-count" style="display: none;"></div>
              <div id="mj-video-preview-grid" class="mj-preview-grid" style="display: none;"></div>
              <button id="mj-toggle-preview" class="mj-btn-link" style="display: none;">
                Show/Hide Preview
              </button>
            </div>

            <div class="mj-prompt-section">
              <label class="mj-label">
                <strong>Prompts for videos (optional)</strong>
              </label>
              
              <div class="mj-prompt-options">
                <label class="mj-radio-label">
                  <input type="radio" name="prompt-mode" value="global" checked>
                  <span>Same prompt for all images</span>
                </label>
                <label class="mj-radio-label">
                  <input type="radio" name="prompt-mode" value="individual">
                  <span>Individual prompts (not recommended for 100+ images)</span>
                </label>
                <label class="mj-radio-label">
                  <input type="radio" name="prompt-mode" value="file">
                  <span>Import from .txt file (recommended for large batches)</span>
                </label>
              </div>

              <div id="mj-global-prompt-area" class="mj-prompt-area">
                <textarea 
                  id="mj-video-global-prompt" 
                  placeholder="Enter prompt for all images (leave empty for default video generation)"
                  rows="2"
                ></textarea>
              </div>

              <div id="mj-file-prompt-area" class="mj-prompt-area" style="display: none;">
                <input type="file" id="mj-prompts-file-input" accept=".txt" hidden>
                <button class="mj-btn mj-btn-secondary" id="mj-upload-prompts-btn">
                  📄 Upload Prompts (.txt)
                </button>
                <div id="mj-prompts-preview" class="mj-prompts-preview"></div>
              </div>

              <div id="mj-individual-prompt-area" class="mj-prompt-area" style="display: none;">
                <div class="mj-info-box">
                  ℹ️ Individual prompts will appear for first 20 images only (performance reason)
                </div>
              </div>
            </div>

            <button id="mj-add-video-jobs-btn" class="mj-btn mj-btn-primary" disabled>
              <span id="mj-add-jobs-text">Add to Queue</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="mj-controls">
        <button id="mj-start-btn" class="mj-btn mj-btn-success">
          ▶ Start
        </button>
        <button id="mj-pause-btn" class="mj-btn mj-btn-warning" style="display: none;">
          ⏸ Pause
        </button>
        <button id="mj-resume-btn" class="mj-btn mj-btn-success" style="display: none;">
          ▶ Resume
        </button>
        <button id="mj-stop-btn" class="mj-btn mj-btn-danger">
          ⏹ Stop
        </button>
        <button id="mj-clear-btn" class="mj-btn mj-btn-secondary">
          🗑 Clear Queue
        </button>
      </div>

      <!-- Queue List -->
      <div class="mj-section">
        <div class="mj-section-title">Queue</div>
        <div id="mj-queue-list" class="mj-queue-list">
          <div class="mj-empty-state">No jobs in queue</div>
        </div>
      </div>

      <!-- History -->
      <div class="mj-section">
        <div class="mj-section-title">Recent History</div>
        <div id="mj-history-list" class="mj-history-list">
          <div class="mj-empty-state">No completed jobs yet</div>
        </div>
      </div>

      <!-- Settings -->
      <div class="mj-section">
        <div class="mj-section-title">⚙️ Settings</div>
        
        <div class="mj-settings-grid">
          <div class="mj-setting-item">
            <label class="mj-setting-label">
              <input type="checkbox" id="mj-setting-auto-download" checked>
              <span>Auto-download images</span>
            </label>
          </div>

          <div class="mj-setting-item">
            <label class="mj-setting-label">
              <span>Download limit per job:</span>
            </label>
            <select id="mj-setting-download-limit" class="mj-select">
              <option value="1">1 image (best only)</option>
              <option value="4" selected>4 images (all variations)</option>
              <option value="999">Unlimited</option>
            </select>
          </div>

          <div class="mj-setting-item">
            <label class="mj-setting-label">
              <span>Job delay (seconds):</span>
            </label>
            <input type="number" id="mj-setting-delay" value="5" min="1" max="60" class="mj-input-number">
          </div>

          <div class="mj-setting-item">
            <button id="mj-clear-downloaded-history" class="mj-btn mj-btn-secondary mj-btn-small">
              Clear Downloaded History (0)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ===========================
// Event Listeners
// ===========================

function attachEventListeners(floatingBtn, panel) {
  // Toggle panel
  floatingBtn.addEventListener('click', () => {
    panel.classList.toggle('active');
  });

  // Close button
  const closeBtn = panel.querySelector('#mj-panel-close');
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('active');
  });

  // Tabs
  const tabs = panel.querySelectorAll('.mj-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active content
      const contents = panel.querySelectorAll('.mj-tab-content');
      contents.forEach(content => {
        if (content.dataset.content === tabName) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    });
  });

  // Add text jobs
  const addJobsBtn = panel.querySelector('#mj-add-jobs-btn');
  addJobsBtn.addEventListener('click', () => addTextJobs());

  // Image→Video batch upload
  setupImageToVideoUpload(panel);

  // Toggle preview for large batches
  const togglePreviewBtn = panel.querySelector('#mj-toggle-preview');
  if (togglePreviewBtn) {
    let previewVisible = true;
    togglePreviewBtn.addEventListener('click', () => {
      const grid = panel.querySelector('#mj-video-preview-grid');
      previewVisible = !previewVisible;
      grid.style.display = previewVisible ? 'grid' : 'none';
      togglePreviewBtn.textContent = previewVisible ? 'Hide Preview' : 'Show Preview';
    });
  }

  // Control buttons
  panel.querySelector('#mj-start-btn').addEventListener('click', () => startQueue());
  panel.querySelector('#mj-pause-btn').addEventListener('click', () => pauseQueue());
  panel.querySelector('#mj-resume-btn').addEventListener('click', () => resumeQueue());
  panel.querySelector('#mj-stop-btn').addEventListener('click', () => stopQueue());
  panel.querySelector('#mj-clear-btn').addEventListener('click', () => clearQueue());

  // Settings
  panel.querySelector('#mj-clear-downloaded-history').addEventListener('click', () => clearDownloadedHistory());
}

// ===========================
// Add Jobs
// ===========================

async function addTextJobs() {
  const textarea = document.getElementById('mj-prompt-input');
  const prompts = textarea.value
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (prompts.length === 0) {
    showToast('Please enter at least one prompt', 'error');
    return;
  }

  for (const prompt of prompts) {
    await chrome.runtime.sendMessage({
      type: 'ADD_JOB',
      job: {
        type: 'text2image',
        prompt: prompt
      }
    });
  }

  textarea.value = '';
  showToast(`Added ${prompts.length} job(s) to queue`, 'success');
  loadState();
}

// ===========================
// Queue Controls
// ===========================

async function startQueue() {
  try {
    await chrome.runtime.sendMessage({ type: 'START_QUEUE' });
    showToast('Queue started', 'success');
  } catch (error) {
    showToast('Failed to start queue: ' + error.message, 'error');
  }
}

async function pauseQueue() {
  try {
    await chrome.runtime.sendMessage({ type: 'PAUSE_QUEUE' });
    showToast('Queue paused', 'info');
  } catch (error) {
    showToast('Failed to pause queue: ' + error.message, 'error');
  }
}

async function resumeQueue() {
  try {
    await chrome.runtime.sendMessage({ type: 'RESUME_QUEUE' });
    showToast('Queue resumed', 'success');
  } catch (error) {
    showToast('Failed to resume queue: ' + error.message, 'error');
  }
}

async function stopQueue() {
  try {
    await chrome.runtime.sendMessage({ type: 'STOP_QUEUE' });
    showToast('Queue stopped', 'info');
  } catch (error) {
    showToast('Failed to stop queue: ' + error.message, 'error');
  }
}

async function clearQueue() {
  if (!confirm('Are you sure you want to clear the entire queue?')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_QUEUE' });
    showToast('Queue cleared', 'info');
    loadState();
  } catch (error) {
    showToast('Failed to clear queue: ' + error.message, 'error');
  }
}

async function clearDownloadedHistory() {
  if (!confirm('Clear downloaded images history? This will allow re-downloading of previously downloaded images.')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: 'CLEAR_DOWNLOADED_HISTORY' });
    if (response.success) {
      showToast('Downloaded history cleared', 'success');
      loadState();
    }
  } catch (error) {
    showToast('Failed to clear history: ' + error.message, 'error');
  }
}

// ===========================
// Image→Video Batch Upload
// ===========================

let selectedImages = [];
let promptsData = [];

function setupImageToVideoUpload(panel) {
  const dropZone = panel.querySelector('#mj-video-drop-zone');
  const imagesInput = panel.querySelector('#mj-video-images-input');
  const previewGrid = panel.querySelector('#mj-video-preview-grid');
  const addJobsBtn = panel.querySelector('#mj-add-video-jobs-btn');
  const promptModes = panel.querySelectorAll('input[name="prompt-mode"]');
  const uploadPromptsBtn = panel.querySelector('#mj-upload-prompts-btn');
  const promptsFileInput = panel.querySelector('#mj-prompts-file-input');

  // Click to browse
  dropZone.addEventListener('click', (e) => {
    if (e.target === dropZone || e.target.closest('.mj-upload-placeholder')) {
      imagesInput.click();
    }
  });

  // Drag & Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragging');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragging');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
    
    const files = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      handleImagesSelected(files, previewGrid, addJobsBtn);
    }
  });

  // File input change
  imagesInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleImagesSelected(files, previewGrid, addJobsBtn);
    }
  });

  // Prompt mode change
  promptModes.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updatePromptMode(e.target.value);
    });
  });

  // Upload prompts file
  uploadPromptsBtn.addEventListener('click', () => {
    promptsFileInput.click();
  });

  promptsFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.txt')) {
      await handlePromptsFileUpload(file);
    }
  });

  // Add jobs button
  addJobsBtn.addEventListener('click', () => {
    addImageToVideoJobs();
  });
}

async function handleImagesSelected(files, previewGrid, addJobsBtn) {
  const totalFiles = files.length;
  
  // NO LIMIT! Accept all files
  showToast(`Processing ${totalFiles} image(s)...`, 'info');

  selectedImages = [];
  
  // Process files in batches for better performance
  const BATCH_SIZE = 20;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          selectedImages.push({
            file: file,
            name: file.name,
            dataURL: e.target.result,
            prompt: ''
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }));
    
    // Update progress
    const progress = Math.min(100, Math.round(((i + batch.length) / totalFiles) * 100));
    if (progress < 100) {
      showToast(`Loading images: ${progress}%`, 'info');
    }
  }

  renderImagePreviews(previewGrid, addJobsBtn);
  showToast(`✅ ${selectedImages.length} image(s) ready!`, 'success');
  
  // Update count display
  updateImagesCount(selectedImages.length);
}

function renderImagePreviews(previewGrid, addJobsBtn) {
  if (selectedImages.length === 0) {
    previewGrid.style.display = 'none';
    addJobsBtn.disabled = true;
    document.getElementById('mj-toggle-preview').style.display = 'none';
    return;
  }

  previewGrid.style.display = 'grid';
  addJobsBtn.disabled = false;
  
  // Update button text with count
  const addJobsText = document.getElementById('mj-add-jobs-text');
  if (addJobsText) {
    addJobsText.textContent = `Add ${selectedImages.length} Job(s) to Queue`;
  }

  const promptMode = document.querySelector('input[name="prompt-mode"]:checked').value;

  // Only render first 20 images for performance
  const PREVIEW_LIMIT = 20;
  const imagesToShow = selectedImages.slice(0, PREVIEW_LIMIT);
  const hasMore = selectedImages.length > PREVIEW_LIMIT;

  previewGrid.innerHTML = imagesToShow.map((img, index) => `
    <div class="mj-preview-item" data-index="${index}">
      <img src="${img.dataURL}" alt="${img.name}">
      <div class="mj-preview-info">
        <div class="mj-preview-name">${truncate(img.name, 20)}</div>
        ${promptMode === 'individual' ? `
          <textarea 
            class="mj-preview-prompt" 
            placeholder="Prompt for this image..."
            data-index="${index}"
          >${img.prompt}</textarea>
        ` : ''}
      </div>
      <button class="mj-preview-remove" data-index="${index}">×</button>
    </div>
  `).join('');

  if (hasMore) {
    previewGrid.innerHTML += `
      <div class="mj-preview-more">
        <div class="mj-preview-more-text">
          + ${selectedImages.length - PREVIEW_LIMIT} more images
        </div>
        <div class="mj-preview-more-hint">
          All ${selectedImages.length} will be added to queue
        </div>
      </div>
    `;
  }

  // Toggle preview button for large batches
  const toggleBtn = document.getElementById('mj-toggle-preview');
  if (selectedImages.length > 20) {
    toggleBtn.style.display = 'block';
  }

  // Event listeners for remove buttons
  previewGrid.querySelectorAll('.mj-preview-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      selectedImages.splice(index, 1);
      renderImagePreviews(previewGrid, addJobsBtn);
      updateImagesCount(selectedImages.length);
      if (selectedImages.length === 0) {
        showToast('All images removed', 'info');
      }
    });
  });

  // Event listeners for individual prompts
  if (promptMode === 'individual') {
    previewGrid.querySelectorAll('.mj-preview-prompt').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        selectedImages[index].prompt = e.target.value;
      });
    });
  }
}

function updateImagesCount(count) {
  const countEl = document.getElementById('mj-video-images-count');
  if (count > 0) {
    countEl.style.display = 'block';
    countEl.innerHTML = `
      <div class="mj-count-badge">
        <strong>${count}</strong> image(s) selected
      </div>
      ${count > 100 ? `
        <div class="mj-count-estimate">
          ⏱ Estimated processing time: ~${Math.round(count * 2.5 / 60)} hours<br>
          💡 Tip: Let it run overnight or in background
        </div>
      ` : count > 20 ? `
        <div class="mj-count-estimate">
          ⏱ Estimated time: ~${Math.round(count * 2.5)} minutes
        </div>
      ` : ''}
    `;
  } else {
    countEl.style.display = 'none';
  }
}

function updatePromptMode(mode) {
  const globalArea = document.getElementById('mj-global-prompt-area');
  const fileArea = document.getElementById('mj-file-prompt-area');
  const individualArea = document.getElementById('mj-individual-prompt-area');
  const previewGrid = document.getElementById('mj-video-preview-grid');
  const addJobsBtn = document.getElementById('mj-add-video-jobs-btn');

  globalArea.style.display = mode === 'global' ? 'block' : 'none';
  fileArea.style.display = mode === 'file' ? 'block' : 'none';
  individualArea.style.display = mode === 'individual' ? 'block' : 'none';

  // Re-render previews nếu đã có ảnh
  if (selectedImages.length > 0) {
    renderImagePreviews(previewGrid, addJobsBtn);
  }
}

async function handlePromptsFileUpload(file) {
  try {
    const text = await file.text();
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    promptsData = lines;

    const preview = document.getElementById('mj-prompts-preview');
    preview.innerHTML = `
      <div class="mj-prompts-loaded">
        ✅ Loaded ${lines.length} prompt(s) from file
        <div class="mj-prompts-list">
          ${lines.slice(0, 3).map((line, i) => 
            `<div>${i + 1}. ${truncate(line, 50)}</div>`
          ).join('')}
          ${lines.length > 3 ? `<div>... and ${lines.length - 3} more</div>` : ''}
        </div>
      </div>
    `;

    showToast(`Loaded ${lines.length} prompts`, 'success');

    // Auto-assign prompts nếu đã có ảnh
    if (selectedImages.length > 0) {
      assignPromptsToImages();
    }

  } catch (error) {
    showToast('Failed to read prompts file: ' + error.message, 'error');
  }
}

function assignPromptsToImages() {
  selectedImages.forEach((img, index) => {
    if (promptsData[index]) {
      img.prompt = promptsData[index];
    }
  });

  showToast(`Assigned prompts to ${Math.min(selectedImages.length, promptsData.length)} image(s)`, 'info');
}

async function addImageToVideoJobs() {
  if (selectedImages.length === 0) {
    showToast('Please select images first', 'error');
    return;
  }

  const promptMode = document.querySelector('input[name="prompt-mode"]:checked').value;
  let globalPrompt = '';

  if (promptMode === 'global') {
    globalPrompt = document.getElementById('mj-video-global-prompt').value.trim();
  } else if (promptMode === 'file') {
    // Prompts đã được assign
    if (promptsData.length === 0) {
      showToast('Please upload prompts file first', 'error');
      return;
    }
  }

  let addedCount = 0;

  for (let i = 0; i < selectedImages.length; i++) {
    const img = selectedImages[i];
    
    let jobPrompt = '';
    if (promptMode === 'global') {
      jobPrompt = globalPrompt;
    } else if (promptMode === 'file') {
      jobPrompt = promptsData[i] || '';
    } else if (promptMode === 'individual') {
      jobPrompt = img.prompt || '';
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'ADD_JOB',
        job: {
          type: 'image2video',
          prompt: jobPrompt,
          imageData: img.dataURL,
          imageFileName: img.name
        }
      });
      addedCount++;
    } catch (error) {
      console.error('Failed to add job:', error);
    }
  }

  // Clear selection
  selectedImages = [];
  promptsData = [];
  document.getElementById('mj-video-images-input').value = '';
  document.getElementById('mj-video-global-prompt').value = '';
  document.getElementById('mj-prompts-preview').innerHTML = '';
  
  const previewGrid = document.getElementById('mj-video-preview-grid');
  const addJobsBtn = document.getElementById('mj-add-video-jobs-btn');
  renderImagePreviews(previewGrid, addJobsBtn);

  showToast(`Added ${addedCount} image→video job(s) to queue`, 'success');
  loadState();
}

// ===========================
// Load & Update State
// ===========================

async function loadState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    updateUI(response);
  } catch (error) {
    console.error('Failed to load state:', error);
  }
}

function updateUI(state) {
  currentState = state;

  // Update status
  const statusText = document.getElementById('mj-status-text');
  const statusBadge = document.getElementById('mj-status');
  
  if (state.isRunning) {
    statusText.textContent = state.isPaused ? 'Paused' : 'Running';
    statusBadge.className = 'mj-status-badge ' + (state.isPaused ? 'paused' : 'running');
  } else {
    statusText.textContent = 'Idle';
    statusBadge.className = 'mj-status-badge idle';
  }

  // Update queue count
  document.getElementById('mj-queue-count').textContent = state.queueLength || 0;

  // Update downloaded count in settings button
  const clearHistoryBtn = document.getElementById('mj-clear-downloaded-history');
  if (clearHistoryBtn) {
    const btnText = clearHistoryBtn.textContent.split('(')[0].trim();
    clearHistoryBtn.textContent = `${btnText} (${state.downloadedCount || 0})`;
  }

  // Update control buttons
  const startBtn = document.getElementById('mj-start-btn');
  const pauseBtn = document.getElementById('mj-pause-btn');
  const resumeBtn = document.getElementById('mj-resume-btn');

  if (state.isRunning && !state.isPaused) {
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    resumeBtn.style.display = 'none';
  } else if (state.isRunning && state.isPaused) {
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'inline-block';
  } else {
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'none';
  }

  // Update current job
  const currentJobSection = document.getElementById('mj-current-job');
  if (state.currentJob) {
    currentJobSection.style.display = 'block';
    document.getElementById('mj-current-prompt').textContent = 
      truncate(state.currentJob.prompt, 100);
  } else {
    currentJobSection.style.display = 'none';
  }

  // Update queue list
  updateQueueList(state.queue || []);

  // Update history list
  updateHistoryList(state.jobHistory || []);
}

function updateQueueList(queue) {
  const container = document.getElementById('mj-queue-list');
  
  if (queue.length === 0) {
    container.innerHTML = '<div class="mj-empty-state">No jobs in queue</div>';
    return;
  }

  container.innerHTML = queue.map((job, index) => `
    <div class="mj-job-item">
      <div class="mj-job-number">#${index + 1}</div>
      <div class="mj-job-content">
        <div class="mj-job-prompt">${escapeHtml(truncate(job.prompt, 80))}</div>
        <div class="mj-job-meta">
          <span class="mj-job-type">${job.type || 'text2image'}</span>
          <span class="mj-job-status">${job.status || 'pending'}</span>
        </div>
      </div>
      <button class="mj-btn-icon mj-job-remove" data-job-id="${job.id}">×</button>
    </div>
  `).join('');

  // Attach remove listeners
  container.querySelectorAll('.mj-job-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const jobId = parseFloat(e.target.dataset.jobId);
      await chrome.runtime.sendMessage({
        type: 'REMOVE_JOB',
        jobId: jobId
      });
      loadState();
    });
  });
}

function updateHistoryList(history) {
  const container = document.getElementById('mj-history-list');
  
  if (history.length === 0) {
    container.innerHTML = '<div class="mj-empty-state">No completed jobs yet</div>';
    return;
  }

  container.innerHTML = history.slice(0, 5).map(job => `
    <div class="mj-history-item">
      <div class="mj-history-status ${job.status}">
        ${job.status === 'completed' ? '✓' : '✗'}
      </div>
      <div class="mj-history-content">
        <div class="mj-job-prompt">${escapeHtml(truncate(job.prompt, 60))}</div>
        <div class="mj-job-time">${formatTime(job.completedAt)}</div>
      </div>
    </div>
  `).join('');
}

// ===========================
// Listen for State Updates
// ===========================

window.addEventListener('message', (event) => {
  if (event.data.type === 'MJ_BATCHER_STATE_UPDATE') {
    updateUI(event.data.state);
  }
});

// ===========================
// Utilities
// ===========================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `mj-toast mj-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ===========================
// Initialize with Retry
// ===========================

function tryInject(retries = 3, delay = 2000) {
  if (retries <= 0) {
    console.error('Failed to inject panel after multiple retries');
    return;
  }

  // Đợi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => injectPanel(), 1000);
    });
  } else {
    setTimeout(() => {
      try {
        injectPanel();
      } catch (error) {
        console.error('Injection attempt failed:', error);
        console.log(`Retrying... (${retries - 1} attempts left)`);
        setTimeout(() => tryInject(retries - 1, delay), delay);
      }
    }, delay);
  }
}

// Start injection with retry
tryInject(3, 2000);

console.log('Floating panel script loaded');
