# Roblox Community Rich Players Finder

A Google Chrome extension that analyzes Roblox communities to find the wealthiest players based on their limited items worth over 10,000 Robux.

## ✨ Features

- 🔍 **Smart URL Parsing**: Supports 2025 Roblox community URL format (`https://www.roblox.com/communities/{ID}/...`)
- 💎 **Wealth Analysis**: Identifies players with limiteds valued over 10,000 Robux
- 🏆 **Rich List Ranking**: Displays players sorted by total limited items value
- 🔄 **Refresh Functionality**: Update the list with fresh data
- 💾 **Data Persistence**: Remembers your last search for quick access
- 🎨 **Beautiful UI**: Modern, gradient design with smooth animations
- ⚡ **Progress Tracking**: Real-time progress indicators during analysis

## 🚀 Installation

### Method 1: Developer Mode (Recommended)

1. **Download the Extension**
   - Download all files from this repository
   - Create a folder named `roblox-rich-players-extension`
   - Place all files in this folder

2. **Enable Developer Mode**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Toggle "Developer mode" in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

4. **Pin the Extension**
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "Roblox Community Rich Players Finder"
   - Click the pin icon to keep it visible

## 📋 Usage

1. **Find a Roblox Community**
   - Go to any Roblox community page
   - Copy the URL (e.g., `https://www.roblox.com/communities/35461612/Z9-Market#!/about`)

2. **Analyze the Community**
   - Click the extension icon in your Chrome toolbar
   - Paste the community URL in the text field
   - Click "🔍 Search for List"

3. **View Results**
   - Wait for the analysis to complete (this may take a few minutes for large communities)
   - View the ranked list of wealthy players
   - See each player's estimated limited items value

4. **Refresh Data**
   - Click "🔄 Refresh" to get updated information
   - The extension remembers your last search

## ⚙️ How It Works

### URL Parsing
The extension automatically extracts the community ID from 2025 Roblox URLs:
```
https://www.roblox.com/communities/35461612/Z9-Market#!/about
                                  ^^^^^^^^
                                Community ID
```

### Data Collection Process
1. **Fetch Members**: Retrieves community member list using Roblox Groups API
2. **Analyze Inventories**: Checks each member's limited items collection
3. **Value Calculation**: Uses Rolimon's API and Roblox inventory data for valuations
4. **Filter & Sort**: Shows only players with 10K+ Robux in limiteds, sorted by wealth

### API Sources
- **Roblox Groups API**: For community member lists
- **Rolimon's API**: For accurate limited item valuations
- **Roblox Inventory API**: For backup item data

## 🔧 Technical Details

### File Structure
```
roblox-rich-players-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Main interface
├── popup.js             # Core functionality
├── icon16.png           # Extension icon (16x16)
├── icon48.png           # Extension icon (48x48)
├── icon128.png          # Extension icon (128x128)
└── README.md            # This file
```

### Permissions
The extension requires:
- `activeTab`: For basic functionality
- `storage`: To save search history
- Host permissions for Roblox and Rolimon APIs

### Rate Limiting
- Built-in delays to respect API rate limits
- Limited to analyzing 50 members per search
- Maximum 10 pages of community members

## ⚠️ Important Notes

### Limitations
- **Community Size**: Large communities (1000+ members) may take several minutes to analyze
- **API Dependencies**: Relies on external APIs that may have rate limits or downtime
- **Accuracy**: Limited item values are estimates and may not reflect current market prices
- **Member Limit**: Analyzes up to 50 members to prevent timeouts

### Privacy & Compliance
- ✅ No personal data is stored or transmitted
- ✅ Only uses publicly available Roblox data
- ✅ Complies with Roblox's terms of service for public data access
- ✅ No authentication tokens or private information required

### Performance Tips
- Use the extension during off-peak hours for better API response times
- Smaller communities (< 100 members) will analyze faster
- The refresh feature uses cached member lists for quicker updates

## 🐛 Troubleshooting

### Common Issues

**"Invalid community ID or community does not exist"**
- Check that the URL is from a valid Roblox community
- Ensure the community is public and accessible
- Try copying the URL directly from the community page

**"Too many requests. Please wait a moment and try again"**
- Wait 1-2 minutes before trying again
- This happens when API rate limits are reached

**"No rich players found"**
- The community may not have members with 10K+ Robux in limiteds
- Try a different, larger community
- Remember that only limited items count toward the wealth calculation

**Extension not loading**
- Ensure all files are in the correct folder
- Check that Developer Mode is enabled in Chrome
- Try reloading the extension from chrome://extensions/

## 🔄 Updates & Maintenance

The extension is designed to work with Roblox's 2025 API structure. If Roblox changes their API endpoints or URL format, the extension may need updates.

## 📜 License

This project is for educational purposes. Please respect Roblox's terms of service and API usage guidelines.

## 🤝 Contributing

Feel free to suggest improvements or report issues. This extension was created to demonstrate API integration and Chrome extension development.

---

*Made with ❤️ for the Roblox community*