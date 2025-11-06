// ===========================
// MJ Auto Batcher - Background Service Worker
// ===========================

let queue = [];
let currentJob = null;
let isRunning = false;
let isPaused = false;
let jobHistory = [];
let downloadedImages = new Set(); // Track đã tải

// Random delay để tránh bị detect là bot
const MIN_DELAY = 3000;  // 3 giây
const MAX_DELAY = 8000;  // 8 giây

function getRandomDelay() {
  const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
  console.log(`🎲 Random delay: ${delay}ms (${(delay/1000).toFixed(1)}s)`);
  return delay;
}

const MAX_HISTORY = 100;

// ===========================
// State Management
// ===========================

async function loadState() {
  try {
    const data = await chrome.storage.local.get(['queue', 'jobHistory', 'downloadedImages']);
    if (data.queue) queue = data.queue;
    if (data.jobHistory) jobHistory = data.jobHistory;
    if (data.downloadedImages) downloadedImages = new Set(data.downloadedImages);
    console.log('State loaded:', { 
      queueLength: queue.length, 
      historyLength: jobHistory.length,
      downloadedCount: downloadedImages.size
    });
  } catch (error) {
    console.error('Failed to load state:', error);
  }
}

async function saveState() {
  try {
    await chrome.storage.local.set({ 
      queue: queue,
      jobHistory: jobHistory.slice(-MAX_HISTORY),
      downloadedImages: Array.from(downloadedImages).slice(-1000) // Giữ 1000 URLs gần nhất
    });
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

// ===========================
// Queue Management
// ===========================

function addJob(job) {
  const newJob = {
    id: Date.now() + Math.random(),
    ...job,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  // Validate job type
  if (!['text2image', 'image2video'].includes(newJob.type)) {
    newJob.type = 'text2image'; // Default
  }
  
  queue.push(newJob);
  saveState();
  broadcastState();
  return newJob;
}

function removeJob(jobId) {
  const index = queue.findIndex(j => j.id === jobId);
  if (index !== -1) {
    queue.splice(index, 1);
    saveState();
    broadcastState();
    return true;
  }
  return false;
}

function clearQueue() {
  queue = [];
  currentJob = null;
  saveState();
  broadcastState();
}

function addToHistory(job) {
  jobHistory.unshift({
    ...job,
    completedAt: new Date().toISOString()
  });
  if (jobHistory.length > MAX_HISTORY) {
    jobHistory = jobHistory.slice(0, MAX_HISTORY);
  }
  saveState();
}

// ===========================
// Queue Processing
// ===========================

async function startQueue() {
  if (isRunning) {
    console.log('Queue already running');
    return;
  }

  isRunning = true;
  isPaused = false;
  broadcastState();

  console.log('Starting queue processing...');
  await processQueue();
}

// ===========================
// Settings
// ===========================

let settings = {
    // Text→Image Settings
    t2i_sendsPerRound: 3,
    t2i_roundInterval: 2 * 60 * 1000, // 2 minutes
    t2i_promptInterval: 30 * 1000, // 30 seconds
};

async function loadSettings() {
    const data = await chrome.storage.local.get('settings');
    if (data.settings) {
        settings = { ...settings, ...data.settings };
    }
}

async function saveSettings() {
    await chrome.storage.local.set({ settings });
}

async function processQueue() {
    let roundJobCount = 0;

    while (isRunning && queue.length > 0) {
        if (isPaused) {
            await sleep(1000);
            continue;
        }

        // Check if we need to start a new round
        if (roundJobCount >= settings.t2i_sendsPerRound) {
            console.log(`🏁 Round complete. Waiting for ${settings.t2i_roundInterval / 1000}s...`);
            await sleep(settings.t2i_roundInterval);
            roundJobCount = 0;
        }

        currentJob = queue[0];

        // We only apply round logic to text2image jobs
        if (currentJob.type !== 'text2image') {
            await processSingleJob(currentJob);
            continue;
        }

        currentJob.status = 'processing';
        broadcastState();

        try {
            console.log('Processing job:', currentJob);

            // Gửi job đến content script
            const tabs = await chrome.tabs.query({
                url: 'https://www.midjourney.com/*',
                active: true
            });

            if (tabs.length === 0) {
                throw new Error('No active Midjourney tab found. Please open https://www.midjourney.com/imagine');
            }

            const tab = tabs[0];

            await chrome.tabs.sendMessage(tab.id, {
                type: 'EXECUTE_JOB',
                job: currentJob
            });

            await waitForJobCompletion(currentJob.id);

            // Job thành công
            currentJob.status = 'completed';
            addToHistory(currentJob);
            queue.shift();
            saveState();
            roundJobCount++;

            console.log(`✅ Job ${currentJob.id} completed.`);

            if (queue.length > 0 && roundJobCount < settings.t2i_sendsPerRound) {
                console.log(`⏳ Waiting for prompt interval: ${settings.t2i_promptInterval / 1000}s`);
                await sleep(settings.t2i_promptInterval);
            }

        } catch (error) {
            console.error('Job failed:', error);
            currentJob.status = 'failed';
            currentJob.error = error.message;
            addToHistory(currentJob);
            queue.shift();
            saveState();
        }

        broadcastState();
    }

    isRunning = false;
    currentJob = null;
    broadcastState();
    console.log('Queue processing completed');
}

async function processSingleJob(job) {
    job.status = 'processing';
    broadcastState();

    try {
        const tabs = await chrome.tabs.query({ url: 'https://www.midjourney.com/*', active: true });
        if (tabs.length === 0) throw new Error('No active Midjourney tab found');

        await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXECUTE_JOB', job });
        await waitForJobCompletion(job.id);

        job.status = 'completed';
    } catch (error) {
        console.error('Single job failed:', error);
        job.status = 'failed';
        job.error = error.message;
    } finally {
        addToHistory(job);
        queue.shift();
        saveState();
        broadcastState();
    }
}

function waitForJobCompletion(jobId, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Job timeout after 2 minutes'));
    }, timeout);

    const listener = (message, sender) => {
      if (message.type === 'JOB_COMPLETED' && message.jobId === jobId) {
        cleanup();
        resolve(message.result);
      } else if (message.type === 'JOB_FAILED' && message.jobId === jobId) {
        cleanup();
        reject(new Error(message.error || 'Job failed'));
      }
    };

    function cleanup() {
      clearTimeout(timeoutId);
      chrome.runtime.onMessage.removeListener(listener);
    }

    chrome.runtime.onMessage.addListener(listener);
  });
}

function pauseQueue() {
  isPaused = true;
  broadcastState();
  console.log('Queue paused');
}

function resumeQueue() {
  isPaused = false;
  broadcastState();
  console.log('Queue resumed');
}

function stopQueue() {
  isRunning = false;
  isPaused = false;
  if (currentJob) {
    currentJob.status = 'cancelled';
    addToHistory(currentJob);
    currentJob = null;
  }
  broadcastState();
  console.log('Queue stopped');
}

// ===========================
// Auto Download Handler
// ===========================

async function downloadImage(imageUrl, jobId) {
  try {
    const url = new URL(imageUrl);
    const cleanUrl = `${url.origin}${url.pathname}`;

    // Kiểm tra đã tải chưa
    if (downloadedImages.has(cleanUrl)) {
      console.log('SKIP_DOWNLOAD: Image already downloaded:', cleanUrl);
      return { skipped: true, reason: 'already_downloaded' };
    }

    console.log('AUTO_DOWNLOAD:', cleanUrl);

    // Tạo filename an toàn
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const extension = cleanUrl.split('.').pop() || 'png';
    
    const safeFilename = `${timestamp}_${jobId.toString().slice(0, 8)}.${extension}`;
    const downloadPath = `midjourney_downloads/${safeFilename}`;

    const downloadId = await chrome.downloads.download({
      url: imageUrl,
      filename: downloadPath,
      saveAs: false
    });

    console.log('Download started:', { downloadId, filename: safeFilename });

    // Thêm vào set đã tải
    downloadedImages.add(cleanUrl);
    await saveState(); // Lưu ngay

    // Theo dõi download completion
    return new Promise((resolve, reject) => {
      const listener = (delta) => {
        if (delta.id === downloadId && delta.state) {
          if (delta.state.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
            resolve({ downloadId, filename: safeFilename, imageUrl });
          } else if (delta.state.current === 'interrupted') {
            chrome.downloads.onChanged.removeListener(listener);
            // Xóa khỏi set nếu download fail
            downloadedImages.delete(cleanUrl);
            saveState();
            reject(new Error('Download interrupted'));
          }
        }
      };
      chrome.downloads.onChanged.addListener(listener);

      // Timeout sau 60 giây
      setTimeout(() => {
        chrome.downloads.onChanged.removeListener(listener);
        downloadedImages.delete(cleanUrl);
        saveState();
        reject(new Error('Download timeout'));
      }, 60000);
    });

  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

// ===========================
// Message Handler
// ===========================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);

  (async () => {
    try {
      switch (message.type) {
        case 'ADD_JOB':
          const job = addJob(message.job);
          sendResponse({ success: true, job });
          break;

        case 'REMOVE_JOB':
          const removed = removeJob(message.jobId);
          sendResponse({ success: removed });
          break;

        case 'START_QUEUE':
          await startQueue();
          sendResponse({ success: true });
          break;

        case 'PAUSE_QUEUE':
          pauseQueue();
          sendResponse({ success: true });
          break;

        case 'RESUME_QUEUE':
          resumeQueue();
          sendResponse({ success: true });
          break;

        case 'STOP_QUEUE':
          stopQueue();
          sendResponse({ success: true });
          break;

        case 'CLEAR_QUEUE':
          clearQueue();
          sendResponse({ success: true });
          break;

        case 'GET_STATE':
          sendResponse({
            queue,
            currentJob,
            isRunning,
            isPaused,
            jobHistory: jobHistory.slice(0, 10),
            downloadedCount: downloadedImages.size
          });
          break;

        case 'CLEAR_DOWNLOADED_HISTORY':
          downloadedImages.clear();
          saveState();
          sendResponse({ success: true, message: 'Downloaded history cleared' });
          break;

        case 'DOWNLOAD_IMAGE':
          const result = await downloadImage(message.imageUrl, message.jobId);
          sendResponse({ success: true, result });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep channel open for async response
});

// ===========================
// State Broadcasting
// ===========================

async function broadcastState() {
  const state = {
    queue,
    currentJob,
    isRunning,
    isPaused,
    queueLength: queue.length,
    jobHistory: jobHistory.slice(0, 10)
  };

  // Broadcast đến tất cả tabs
  const tabs = await chrome.tabs.query({ url: 'https://www.midjourney.com/*' });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'STATE_UPDATE',
        state
      });
    } catch (error) {
      // Tab có thể đã đóng
    }
  }
}

// ===========================
// Utilities
// ===========================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===========================
// Initialization
// ===========================

chrome.runtime.onInstalled.addListener(() => {
  console.log('MJ Auto Batcher installed');
  loadState();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('MJ Auto Batcher started');
  loadState();
});

// Load state khi service worker khởi động
loadState();

console.log('MJ Auto Batcher background script loaded');
