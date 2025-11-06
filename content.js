// ===========================
// MJ Auto Batcher - Content Script
// ===========================

console.log('MJ Auto Batcher content script loaded');

let currentJobId = null;
let imageObserver = null;

// ===========================
// Selectors (có fallback)
// ===========================

const SELECTORS = {
  inputBox: [
    'textarea[placeholder*="imagine"]',
    'textarea[placeholder*="Imagine"]',
    'textarea[placeholder*="What will you"]',
    'div[contenteditable="true"]',
    'input[type="text"]'
  ],
  imageUploadButton: [
    'button[aria-label*="Add Images"]',
    'button[aria-label*="add images"]',
    'button:has(svg):has-text("Add Images")',
    '[class*="addImage"]',
    '[class*="uploadButton"]'
  ],
  fileInput: [
    'input[type="file"]',
    'input[accept*="image"]'
  ],
  imageContainer: [
    'div[class*="image"]',
    'div[class*="result"]',
    'div[class*="grid"]',
    'img[src*="cdn.midjourney.com"]'
  ],
  imageElement: [
    // Midjourney CDN
    'img[src*="cdn.midjourney"]',
    'img[src*="media.midjourney"]',
    'img[src*="mj-gallery"]',
    // Video frames (for image→video)
    'video[src*="cdn.midjourney"]',
    'video[src*="media.midjourney"]',
    'img[alt*="image"]',
    'img[alt*="video"]',
    // AWS/S3
    'img[src*="amazonaws"]',
    'video[src*="amazonaws"]',
    // Generic high-res images
    'img[src*="?width="]',
    'img[class*="result"]',
    'img[class*="generated"]'
  ]
};

// ===========================
// Wait for Element
// ===========================

function waitForElement(selectors, timeout = 10000) {
  return new Promise((resolve) => {
    // Thử tìm ngay lập tức
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Found element immediately:', selector);
        return resolve(element);
      }
    }

    // Nếu không tìm thấy, dùng MutationObserver
    const observer = new MutationObserver(() => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          console.log('Found element via observer:', selector);
          observer.disconnect();
          return resolve(element);
        }
      }
    });

    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    // Timeout
    setTimeout(() => {
      observer.disconnect();
      console.warn('Element not found after timeout');
      resolve(null);
    }, timeout);
  });
}

// ===========================
// Image Upload (for Image→Video)
// ===========================

async function clickStartingFrameButton() {
  try {
    console.log('🔍 Looking for Starting Frame button...');
    
    // Selectors for the Starting Frame button/section
    const buttonSelectors = [
      'button:has-text("Starting Frame")',
      '[aria-label*="Starting Frame"]',
      '[data-testid*="starting-frame"]',
      // Text content based
      'div:has-text("Starting Frame")',
      'button:has-text("Animate an image")',
      // Class based
      '[class*="StartingFrame"]',
      '[class*="starting-frame"]'
    ];
    
    let clicked = false;
    
    // Try to find by text content (MOST RELIABLE)
    const allElements = document.querySelectorAll('button, div[role="button"], div, span');
    for (const el of allElements) {
      // Skip extension panel
      if (el.closest('#mj-auto-batcher-panel')) continue;
      
      const text = el.textContent?.trim().toLowerCase() || '';
      const innerHTML = el.innerHTML?.toLowerCase() || '';
      
      if (text === 'starting frame' || 
          text.includes('animate an image') ||
          innerHTML.includes('starting frame')) {
        console.log('✅ Found Starting Frame element by text, clicking...');
        el.click();
        clicked = true;
        await sleep(1500); // Wait longer for panel to fully open
        break;
      }
    }
    
    // Try selectors if text search failed
    if (!clicked) {
      for (const selector of buttonSelectors) {
        try {
          const btn = document.querySelector(selector);
          if (btn && !btn.closest('#mj-auto-batcher-panel')) {
            console.log('✅ Found Starting Frame button:', selector);
            btn.click();
            clicked = true;
            await sleep(1500);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (clicked) {
      console.log('✅ Starting Frame button clicked, waiting for panel...');
      
      // Wait for upload area to appear
      let attempts = 0;
      while (attempts < 10) {
        const uploadArea = Array.from(document.querySelectorAll('div')).find(div => 
          !div.closest('#mj-auto-batcher-panel') &&
          div.textContent?.toLowerCase().includes('upload a file')
        );
        
        if (uploadArea) {
          console.log('✅ Upload area appeared!');
          return true;
        }
        
        await sleep(300);
        attempts++;
      }
      
      console.log('⚠️ Upload area not appeared after clicking, but continuing...');
      return true;
    }
    
    console.log('⚠️ Starting Frame button not found - may already be open or UI changed');
    return false;
    
  } catch (error) {
    console.error('❌ Error clicking Starting Frame button:', error);
    return false;
  }
}

function findInputInShadowDom(rootNode) {
    // 1. Search in the current root node (light DOM)
    const mainInputs = rootNode.querySelectorAll('input[type="file"]');
    for (const input of mainInputs) {
        if (!input.closest('#mj-auto-batcher-panel')) {
            console.log('Found input in light DOM:', input);
            return input;
        }
    }

    // 2. Walk through all elements to find shadow roots
    const allElements = rootNode.querySelectorAll('*');
    for (const element of allElements) {
        if (element.shadowRoot) {
            // Recurse into the shadow root
            const inputInShadow = findInputInShadowDom(element.shadowRoot);
            if (inputInShadow) {
                 console.log('Found input in Shadow DOM of:', element);
                return inputInShadow;
            }
        }
    }

    return null;
}

async function imageDataToFile(imageData, fileName) {
    if (typeof imageData === 'string') {
        const blob = await fetch(imageData).then(r => r.blob());
        return new File([blob], fileName, { type: blob.type });
    } else if (imageData instanceof Blob) {
        return new File([imageData], fileName, { type: imageData.type });
    }
    throw new Error('Invalid image data format');
}

async function uploadImage(imageData, fileName) {
  try {
    console.log('🖼️ Uploading image for Image→Video:', fileName);

    // CRITICAL: Ensure Starting Frame is open FIRST!
    console.log('📂 Opening Starting Frame...');
    await ensureStartingFrameOpen();
    await sleep(1000); // Wait for panel to fully open and input to appear

    // STEP 1: Find Midjourney's file input (with Shadow DOM support)
    console.log('🔍 Looking for Midjourney file input (including Shadow DOM)...');
    
    const fileInput = findInputInShadowDom(document.body);

    if (!fileInput) {
      throw new Error('❌ Cannot find Midjourney file input. Starting Frame may not be open or Midjourney UI changed.');
    }

    console.log('📂 Midjourney file input found:', fileInput);
    console.log('   - ID:', fileInput.id);
    console.log('   - Class:', fileInput.className);
    console.log('   - Accept:', fileInput.accept);
    console.log('   - Multiple:', fileInput.multiple);

    // STEP 2: Convert imageData to File object
    const file = await imageDataToFile(imageData, fileName);

    console.log('📦 Created file object:', file.name, file.size, 'bytes');

    // STEP 3: Use METHOD 1 - Standard DataTransfer + change event
    // This is THE SIMPLEST method that works!
    console.log('🚀 Applying Method 1: Standard DataTransfer...');
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    
    console.log('✅ Files set:', fileInput.files.length, 'file(s)');
    
    // Trigger change event (the magic that makes it work!)
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log('✅ Change event dispatched');
    console.log('⏳ Waiting for preview to appear...');

    // STEP 4: Wait for preview to appear
    const hasPreview = await waitForImageUploadInStartingFrame(fileName);

    if (hasPreview) {
      console.log('🎉 Image uploaded successfully to Starting Frame!');
      return true;
    } else {
      console.log('⚠️ No preview detected, but continuing anyway...');
      // Don't fail - maybe preview detection failed but upload worked
      return true;
    }

  } catch (error) {
    console.error('❌ Failed to upload image:', error);
    throw error;
  }
}

async function ensureStartingFrameOpen() {
  // Check if Starting Frame panel is already open
  const panel = document.querySelector('[class*="StartingFrame"], [class*="starting-frame"]');
  if (panel && panel.offsetParent !== null) {
    console.log('✅ Starting Frame already open');
    return true;
  }

  // Find and click Starting Frame button
  console.log('🔍 Looking for Starting Frame button...');
  
  // Try multiple selectors
  const buttonSelectors = [
    'button:has-text("Starting Frame")',
    'div:has-text("Starting Frame")',
    '[data-testid*="starting"]',
    '[class*="Starting"]'
  ];

  // Search by text content
  const allButtons = document.querySelectorAll('button, div[role="button"]');
  for (const btn of allButtons) {
    const text = btn.textContent?.trim() || '';
    if (text.toLowerCase().includes('starting frame')) {
      console.log('✅ Found Starting Frame button, clicking...');
      btn.click();
      await sleep(500);
      return true;
    }
  }

  console.log('⚠️ Starting Frame button not found - assuming it\'s already open');
  return false;
}

async function waitForManualUpload(timeout = 45000) {
  const startTime = Date.now();
  
  console.log('⏳ Waiting for you to upload manually...');
  
  let attempts = 0;
  while (Date.now() - startTime < timeout) {
    attempts++;
    
    // Check for image in Starting Frame
    const startingFrameContainer = document.querySelector('[class*="StartingFrame"], [class*="starting-frame"], [class*="frame"]');
    
    if (startingFrameContainer) {
      const previewSelectors = [
        'img[src^="blob:"]',
        'img[src*="amazonaws"]',
        'img[src*="media"]',
        'img[src*="cdn"]',
        '[class*="preview"] img'
      ];
      
      for (const selector of previewSelectors) {
        const preview = startingFrameContainer.querySelector(selector);
        if (preview && preview.complete && preview.naturalHeight > 0) {
          console.log('✅ Manual upload detected!');
          return true;
        }
      }
    }
    
    // Log progress every 10 seconds
    if (attempts % 10 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.round((timeout - (Date.now() - startTime)) / 1000);
      console.log(`⏳ Still waiting... (${elapsed}s elapsed, ${remaining}s remaining)`);
    }
    
    await sleep(1000);
  }
  
  console.error('❌ Manual upload timeout');
  return false;
}

async function waitForImageUpload(fileName, timeout = 30000) {
  const startTime = Date.now();
  
  console.log('⏳ Waiting for image upload preview...');
  
  let attempts = 0;
  while (Date.now() - startTime < timeout) {
    attempts++;
    
    // Check nhiều loại preview elements
    const previewSelectors = [
      'img[src^="blob:"]',                    // Blob URLs
      'img[src*="amazonaws"]',                 // S3 URLs
      '[class*="preview"]',                    // Preview containers
      '[class*="upload"]',                     // Upload containers
      '[data-testid*="image-preview"]',       // Test IDs
      'img[alt*="upload"]',                    // Alt text
      'div[role="img"]',                       // ARIA images
      '[class*="ImagePreview"]',              // React components
      '[class*="StartingFrame"]',             // Midjourney specific
      'img[src*="media"]',                     // Media URLs
      '[class*="Frame"]'                       // Frame containers
    ];
    
    for (const selector of previewSelectors) {
      const previews = document.querySelectorAll(selector);
      if (previews.length > 0) {
        console.log('✅ Image upload complete - preview detected:', selector);
        await sleep(500); // Extra wait for stability
        return true;
      }
    }
    
    // Log progress every 5 seconds
    if (attempts % 10 === 0) {
      console.log(`⏳ Still waiting for preview... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    }
    
    await sleep(500);
  }
  
  // TIMEOUT - Enable manual fallback
  console.error('❌ Image upload timeout - no preview detected after 30s');
  console.log('💡 MANUAL FALLBACK: Please upload the image manually if needed');
  
  // Don't throw error, just return false to allow manual upload
  return false;
}

async function waitForImageUploadInStartingFrame(fileName, timeout = 10000) {
  const startTime = Date.now();
  
  console.log('⏳ Waiting for image preview in Starting Frame...');
  
  let attempts = 0;
  while (Date.now() - startTime < timeout) {
    attempts++;
    
    // Based on test results, preview appears as: img[src^="blob:"]
    // Check for blob URL images (uploaded files show as blob URLs)
    const previewSelectors = [
      'img[src^="blob:"]',           // Primary - test confirmed this works!
      'img[src*="amazonaws"]',        // Backup - after upload to S3
      'img[src*="media"]',            // Backup - CDN URLs
    ];
    
    for (const selector of previewSelectors) {
      const previews = document.querySelectorAll(selector);
      for (const preview of previews) {
        if (preview.complete && preview.naturalHeight > 0) {
          console.log('✅ Image preview detected!', selector);
          await sleep(300); // Small delay for stability
          return true;
        }
      }
    }
    
    // Log progress every 2 seconds
    if (attempts % 10 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏳ Still waiting... (${elapsed}s)`);
    }
    
    await sleep(200);
  }
  
  console.log('⚠️ Preview timeout - but continuing anyway (upload may have worked)');
  return false; // Don't throw - let job continue
}

// ===========================
// Inject Prompt (Modern Method)
// ===========================

async function injectPrompt(text) {
  try {
    console.log('📝 Injecting prompt:', text);

    // Tìm input box với nhiều cách hơn
    let input = null;
    
    // Method 1: Wait for standard selectors
    for (const selector of SELECTORS.inputBox) {
      input = document.querySelector(selector);
      if (input) {
        console.log('✅ Found input via selector:', selector);
        break;
      }
    }
    
    // Method 2: Tìm theo placeholder text
    if (!input) {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        const placeholder = ta.placeholder.toLowerCase();
        if (placeholder.includes('imagine') || placeholder.includes('what will')) {
          input = ta;
          console.log('✅ Found input via placeholder');
          break;
        }
      }
    }
    
    // Method 3: Tìm bất kỳ textarea visible nào
    if (!input) {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.offsetHeight > 0 && !ta.disabled) {
          input = ta;
          console.log('✅ Found input via visible textarea');
          break;
        }
      }
    }
    
    if (!input) {
      throw new Error('❌ Cannot find input box after trying all methods');
    }

    console.log('📍 Input found:', input.tagName, input.placeholder || '(no placeholder)');

    // Focus vào input
    input.focus();
    input.click(); // Extra click to ensure focus
    await sleep(500);

    // Set value bằng native setter
    const tagName = input.tagName.toLowerCase();
    let nativeInputValueSetter;

    if (tagName === 'textarea') {
      nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 
        'value'
      ).set;
    } else if (tagName === 'input') {
      nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 
        'value'
      ).set;
    } else if (tagName === 'div' && input.contentEditable === 'true') {
      // ContentEditable div
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(500);
      await pressEnter(input);
      console.log('✅ Prompt injected to contentEditable');
      return;
    }

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, text);
    } else {
      input.value = text;
    }

    // Trigger events
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    await sleep(300);

    console.log('✅ Prompt set, pressing Enter...');

    // Press Enter
    await pressEnter(input);

    console.log('✅ Prompt injected successfully');
    return true;

  } catch (error) {
    console.error('❌ Failed to inject prompt:', error);
    throw error;
  }
}

// ===========================
// Press Enter Key
// ===========================

async function pressEnter(element) {
  const events = [
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    }),
    new KeyboardEvent('keypress', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    }),
    new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    })
  ];

  for (const event of events) {
    element.dispatchEvent(event);
    await sleep(50);
  }

  // Fallback: click submit button nếu có
  await sleep(200);
  const submitButton = document.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.click();
  }
}

// ===========================
// Image Detection & Download
// ===========================

function startImageObserver(jobId, existingImages, jobStartTime, timeout = 180000) {
  return new Promise((resolve, reject) => {
    console.log('👀 Starting image observer for job:', jobId);
    
    currentJobId = jobId;
    let foundImages = new Set();
    let downloadedCount = 0;
    let timeoutId;
    let gracePeriodTimeout = null;

    const cleanup = () => {
      if (imageObserver) {
        imageObserver.disconnect();
        imageObserver = null;
      }
      clearTimeout(timeoutId);
      clearTimeout(gracePeriodTimeout);
      currentJobId = null;
    };

    // Main timeout (3 minutes for video generation)
    timeoutId = setTimeout(() => {
      cleanup();
      if (downloadedCount > 0) {
        console.log(`⏱️ Timeout reached but ${downloadedCount} file(s) downloaded - SUCCESS`);
        resolve({ 
          success: true, 
          imageCount: downloadedCount,
          images: Array.from(foundImages)
        });
      } else {
        console.error('❌ Observer timeout - no files detected after 3 minutes');
        reject(new Error('Image detection timeout after 3 minutes'));
      }
    }, timeout);

    // Tạo observer
    imageObserver = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        // Kiểm tra added nodes
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Tìm images trong node (CHỈ ảnh MỚI)
            const images = findNewImages(node, foundImages, existingImages);
            
            if (images.length > 0) {
              console.log(`📸 Found ${images.length} NEW element(s)! (ignoring ${existingImages.size} existing)`);
              
              for (const img of images) {
                try {
                  const src = img.src || img.currentSrc || img.poster;
                  if (!src) continue;
                  
                  console.log(`📥 Downloading: ${src.substring(0, 80)}...`);
                  
                  // Gửi về background để download
                  const response = await chrome.runtime.sendMessage({
                    type: 'DOWNLOAD_IMAGE',
                    imageUrl: src,
                    jobId: jobId
                  });
                  
                  if (!response.skipped) {
                    foundImages.add(src);
                    downloadedCount++;
                    console.log(`✅ Downloaded ${downloadedCount} file(s)`);
                  } else {
                    console.log('⏭️ Skipped (already downloaded)');
                  }
                } catch (error) {
                  console.error('❌ Download failed:', error);
                }
              }

              // Nếu đã tải được ít nhất 1 file
              if (downloadedCount > 0) {
                // Clear previous grace period if any
                if (gracePeriodTimeout) {
                  clearTimeout(gracePeriodTimeout);
                }
                
                // Đợi 2 giây sau file đầu tiên (nhanh hơn để không delay job)
                console.log('⏳ Grace period: waiting 2s for more files...');
                gracePeriodTimeout = setTimeout(() => {
                  cleanup();
                  console.log(`🎉 Job complete! Downloaded ${downloadedCount} file(s)`);
                  resolve({ 
                    success: true, 
                    imageCount: downloadedCount,
                    images: Array.from(foundImages)
                  });
                }, 2000); // Giảm từ 5s xuống 2s
              }
            }
          }
        }
      }
    });

    // Bắt đầu observe
    imageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log(`👁️ Observer started - will ignore existing ${existingImages.size} images and only download NEW images`);
  });
}

function findNewImages(rootNode, foundImages, existingImages = new Set()) {
  const newImages = [];
  
  for (const selector of SELECTORS.imageElement) {
    const elements = rootNode.querySelectorAll ? 
      rootNode.querySelectorAll(selector) : 
      [];
    
    elements.forEach(el => {
      let src = el.src || el.currentSrc;
      
      // For video elements, also check poster
      if (el.tagName === 'VIDEO' && el.poster) {
        src = el.poster;
      }
      
      if (src && 
          !foundImages.has(src) && 
          !existingImages.has(src)) {
        
        // For images, check complete
        if (el.tagName === 'IMG') {
          if (el.complete && el.naturalHeight > 0) {
            newImages.push(el);
          }
        } 
        // For videos, just check if src exists
        else if (el.tagName === 'VIDEO') {
          newImages.push(el);
        }
      }
    });
  }

  // Kiểm tra nếu rootNode chính là một image/video
  if ((rootNode.tagName === 'IMG' || rootNode.tagName === 'VIDEO') && 
      rootNode.src && 
      !foundImages.has(rootNode.src) &&
      !existingImages.has(rootNode.src)) {
    
    if (rootNode.tagName === 'IMG') {
      if (rootNode.complete && rootNode.naturalHeight > 0) {
        newImages.push(rootNode);
      }
    } else {
      newImages.push(rootNode);
    }
  }

  return newImages;
}

// ===========================
// Job Execution
// ===========================

async function executeJob(job) {
  try {
    console.log('Executing job:', job);

    // Validate job
    if (!job.prompt || job.prompt.trim().length === 0) {
      throw new Error('Prompt is empty');
    }

    // Sanitize prompt
    const sanitizedPrompt = job.prompt.trim();

    // Đánh dấu thời điểm bắt đầu job
    const jobStartTime = Date.now();
    
    // Lấy snapshot của tất cả ảnh HIỆN TẠI (để ignore sau này)
    const existingImages = new Set();
    document.querySelectorAll('img[src*="cdn.midjourney"], img[src*="media.midjourney"]').forEach(img => {
      if (img.src && img.complete) {
        existingImages.add(img.src);
      }
    });
    
    console.log(`Job start - Existing images: ${existingImages.size}`);

    // === SPECIAL HANDLING FOR IMAGE→VIDEO ===
    if (job.type === 'image2video') {
      console.log('🎬 Image→Video job detected');
      console.log('🚀 AUTO-UPLOADING image to Midjourney...');

      // Step 1: AUTO UPLOAD image using proven Method 1
      if (job.imageData && job.imageFileName) {
        try {
          await uploadImage(job.imageData, job.imageFileName);
          console.log('✅ Image uploaded successfully!');
          await sleep(1000); // Wait for UI to stabilize
        } catch (error) {
          console.error('❌ Auto-upload failed:', error);
          throw new Error(`Image upload failed: ${error.message}`);
        }
      } else {
        throw new Error('Image data missing for image2video job');
      }

      // Step 2: Inject prompt
      if (sanitizedPrompt && sanitizedPrompt !== '') {
        await injectPrompt(sanitizedPrompt);
      } else {
        // Nếu không có prompt, chỉ cần nhấn Enter
        const input = document.querySelector('textarea') || document.activeElement;
        await pressEnter(input || document.body);
      }

    } else {
      // === NORMAL TEXT→IMAGE ===
      await injectPrompt(sanitizedPrompt);
    }

    // Đợi và theo dõi kết quả (CHỈ ảnh mới)
    await sleep(2000); // Đợi command được gửi

    const result = await startImageObserver(job.id, existingImages, jobStartTime);

    // Thông báo thành công
    chrome.runtime.sendMessage({
      type: 'JOB_COMPLETED',
      jobId: job.id,
      result: result
    });

    return result;

  } catch (error) {
    console.error('Job execution failed:', error);
    
    // Thông báo lỗi
    chrome.runtime.sendMessage({
      type: 'JOB_FAILED',
      jobId: job.id,
      error: error.message
    });

    throw error;
  }
}

// ===========================
// Message Handler
// ===========================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received:', message.type);

  if (message.type === 'EXECUTE_JOB') {
    // Wrap in try-catch và set timeout để tránh channel close
    (async () => {
      try {
        const result = await executeJob(message.job);
        
        // Try to send response
        try {
          sendResponse({ success: true, result });
        } catch (e) {
          console.error('Failed to send response (channel may be closed):', e);
        }
      } catch (error) {
        console.error('Job execution error:', error);
        
        // Try to send error response
        try {
          sendResponse({ success: false, error: error.message });
        } catch (e) {
          console.error('Failed to send error response:', e);
          
          // Fallback: Send message directly to background
          chrome.runtime.sendMessage({
            type: 'JOB_FAILED',
            jobId: message.job?.id,
            error: error.message
          }).catch(err => {
            console.error('Failed to notify background of error:', err);
          });
        }
      }
    })();
    
    return true; // Keep channel open for async response
  }

  if (message.type === 'STATE_UPDATE') {
    // Broadcast state update đến floating panel
    try {
      window.postMessage({
        type: 'MJ_BATCHER_STATE_UPDATE',
        state: message.state
      }, '*');
    } catch (e) {
      console.error('Failed to broadcast state update:', e);
    }
    return;
  }

  if (message.type === 'PING') {
    sendResponse({ success: true, message: 'Content script is active' });
    return;
  }
});

// ===========================
// Utilities
// ===========================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===========================
// Notification System
// ===========================

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 999999;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

console.log('MJ Auto Batcher content script ready');
