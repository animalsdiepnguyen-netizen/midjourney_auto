# 🎨 MJ Auto Batcher

**Batch processing extension for Midjourney** - Automatically send multiple prompts and download results.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Chrome](https://img.shields.io/badge/Chrome-Extension-green)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## ✨ Features

- 🚀 **Batch Processing** - Send multiple prompts in queue
- 📥 **Auto Download** - Automatically save images to `Downloads/midjourney_downloads/`
- 🎯 **Multiple Modes** - Text→Image, Image→Image, Image→Video
- 🎨 **Floating Panel** - Easy access UI on Midjourney page
- ⏸️ **Queue Control** - Start, Pause, Resume, Stop
- 📊 **Job History** - Track completed and failed jobs
- 💾 **Persistent Queue** - Saves queue between sessions

---

## 📦 Installation

### Method 1: Load Unpacked Extension

1. **Download or clone this repository**
   ```bash
   git clone https://github.com/yourusername/mj-auto-batcher.git
   # Or download as ZIP and extract
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Or Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the switch in top-right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `mj_auto_batcher` folder

5. **Grant permissions**
   - The extension needs access to `https://www.midjourney.com/*`
   - Click "Allow" when prompted

### Method 2: From Chrome Web Store
*(Coming soon...)*

---

## 🎯 How to Use

### Quick Start

1. **Open Midjourney**
   - Go to [midjourney.com/imagine](https://www.midjourney.com/imagine)
   - Make sure you're logged in

2. **Open the Panel**
   - Look for the floating purple button on the right side
   - Click it to open the control panel

3. **Add Prompts**
   - Switch to "Text → Image" tab
   - Enter your prompts (one per line)
   - Click "Add to Queue"

4. **Start Processing**
   - Click "▶ Start" button
   - Watch as prompts are sent automatically
   - Images will download to `Downloads/midjourney_downloads/`

### Example Prompts

```
a beautiful sunset over mountains, photorealistic
futuristic city at night, cyberpunk style
abstract painting of emotions, colorful
cute robot playing guitar, cartoon style
serene forest landscape, oil painting
```

---

## 🎮 Controls

| Button | Action |
|--------|--------|
| **▶ Start** | Begin processing queue |
| **⏸ Pause** | Pause current queue |
| **▶ Resume** | Resume paused queue |
| **⏹ Stop** | Stop and cancel current job |
| **🗑 Clear Queue** | Remove all pending jobs |

---

## ⚙️ Settings & Configuration

### Download Location

Images are automatically saved to:
```
Windows: C:\Users\<YourName>\Downloads\midjourney_downloads\
Mac: /Users/<YourName>/Downloads/midjourney_downloads/
Linux: /home/<YourName>/Downloads/midjourney_downloads/
```

### Delay Between Jobs

Default: **5 seconds** (configurable in `background.js`)

```javascript
const DELAY_BETWEEN_JOBS = 5000; // Change this value (in milliseconds)
```

### Job Timeout

Default: **2 minutes** per job

```javascript
const timeout = 120000; // Change in background.js
```

---

## 🐛 Troubleshooting

### Issue: Floating button not appearing

**Solution:**
1. Refresh the Midjourney page (`Ctrl+R` or `Cmd+R`)
2. Wait 3-5 seconds for injection
3. Check browser console (`F12`) for errors

### Issue: Prompts not being sent

**Solution:**
1. Make sure you're on `/imagine` page
2. Check that input box is visible
3. Try sending one prompt manually first
4. Check console for error messages

### Issue: Images not downloading

**Solution:**
1. Check download permissions in `chrome://settings/content/downloads`
2. Make sure "Ask where to save each file before downloading" is OFF
3. Check that `Downloads` folder exists and is writable

### Issue: Extension stopped working

**Solution:**
1. Reload the extension:
   - Go to `chrome://extensions/`
   - Click reload icon on the extension card
2. Refresh Midjourney page
3. Check for Chrome/browser updates

---

## 📁 Project Structure

```
mj_auto_batcher/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (queue management)
├── content.js            # Inject prompts & detect images
├── floating.js           # Floating panel UI logic
├── floating.css          # Panel styles
├── popup.html            # Extension popup
├── popup.js              # Popup logic
├── styles.css            # Popup styles
└── icons/
    ├── icon16.png
    ├── icon32.png
    └── icon128.png
```

---

## 🔧 Advanced Usage

### Custom Prompts Format

You can use Midjourney's advanced parameters:

```
a cat --ar 16:9 --v 6
landscape --chaos 50 --stylize 1000
portrait --quality 2 --seed 12345
```

### Batch with Different Styles

```
cyberpunk city --style raw
cyberpunk city --style anime
cyberpunk city --style photorealistic
```

---

## 🛡️ Privacy & Security

- ✅ **No data collection** - Everything runs locally
- ✅ **No external servers** - Direct communication with Midjourney
- ✅ **Open source** - Code is fully auditable
- ✅ **Minimal permissions** - Only requests necessary access

### Required Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Save queue between sessions |
| `activeTab` | Interact with Midjourney tab |
| `scripting` | Inject content scripts |
| `downloads` | Auto-download images |
| `host_permissions` | Access midjourney.com |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone the repository
2. Make changes to the code
3. Test by loading unpacked extension
4. Submit PR with description of changes

### Reporting Bugs

Please open an issue with:
- Chrome version
- Extension version
- Steps to reproduce
- Console errors (if any)

---

## 📝 Changelog

### v1.0.0 (2024-11-02)
- ✨ Initial release
- ✅ Batch processing for text→image
- ✅ Auto-download functionality
- ✅ Floating panel UI
- ✅ Queue management (Start/Pause/Stop)
- ✅ Job history tracking
- ✅ Persistent storage

---

## 📄 License

MIT License - feel free to use and modify!

---

## 💡 Tips & Best Practices

1. **Start Small** - Test with 2-3 prompts first
2. **Use Delays** - Don't overwhelm Midjourney servers
3. **Monitor Queue** - Check progress in floating panel
4. **Save Prompts** - Keep a text file of your favorite prompts
5. **Organize Downloads** - Periodically clean up download folder

---

## 🌟 Support

If you find this extension helpful:
- ⭐ Star the repository
- 🐛 Report bugs
- 💡 Suggest features
- 🔄 Share with friends

---

## ⚠️ Disclaimer

This is an unofficial third-party extension. Not affiliated with Midjourney.

Use responsibly and respect Midjourney's Terms of Service.

---

## 📞 Contact

- GitHub: [@yourusername](https://github.com/yourusername)
- Issues: [Report here](https://github.com/yourusername/mj-auto-batcher/issues)

---

**Made with 💜 for the Midjourney community**
