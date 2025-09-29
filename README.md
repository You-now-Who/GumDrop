# Gumdrop Chrome Extension

A hackathon-ready Chrome extension that helps users plan their stays around Eventbrite events.

## Features

- 🎯 **Eventbrite Integration**: Automatically scrapes event details (title, date, location) from Eventbrite pages
- ✨ **Modern UI**: Glassmorphism design with Tailwind CSS and playful animations
- 🏨 **Stay Planning**: Framework ready for AI-powered hotel recommendations
- 🎨 **Gumdrop Theme**: Custom yellow-gold color scheme with modern gradients

## Project Structure

```
GumDrop/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html            # Main popup interface
├── popup.js              # Popup functionality
├── background.js         # Service worker for data management
├── content.js            # Eventbrite page scraping
├── assets/               # Icons and images
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Setup

1. **Install Dependencies**: The extension uses Tailwind CSS via CDN - no build process needed!

2. **Load Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

3. **Test**:
   - Navigate to any Eventbrite event page
   - Click the Gumdrop extension icon
   - The extension will automatically scrape event details

## Usage

1. **Navigate** to an Eventbrite event page
2. **Click** the Gumdrop extension icon in your toolbar
3. **View** automatically scraped event details
4. **Click** "Generate Stay Plan" (ready for API integration)

## Development Notes

- **Manifest V3**: Uses modern Chrome extension architecture
- **Tailwind CSS**: Styling via CDN for rapid development
- **Minimal Dependencies**: No build process required
- **Hackathon Ready**: Easy to extend with API integrations

## Next Steps (API Integration Ready)

- Add AI service integration for stay recommendations
- Integrate hotel booking APIs
- Add user preferences storage
- Implement result caching

## Permissions

- `activeTab`: Access current Eventbrite tab
- `storage`: Save event data locally
- `host_permissions`: Access Eventbrite domains

Perfect for hackathons - just plug in your APIs! 🚀