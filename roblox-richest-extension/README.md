# Roblox Community Richest Finder (Chrome Extension)

Find the richest members of any Roblox community (group) by summing the RAP of Roblox-made limiteds (≥ 10,000 Robux) owned by each member. Enter a community link like `https://www.roblox.com/communities/35461612/Whatever#!/about` or just the numeric ID.

## Install (Load Unpacked)
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the folder: `roblox-richest-extension`
5. Click the extension icon → pin it → open the popup

## Usage
- Paste a Roblox community link or numeric ID
- Click "Search for list"
- The extension will:
  - Validate the community ID
  - Fetch all members by roles
  - For each member, fetch collectibles and sum RAP of Roblox-created limiteds with RAP ≥ 10,000
  - Sort members by total RAP
- Use "Refresh" to re-run the aggregation

## Notes
- The parser targets modern 2025 URLs under `/communities/<id>/...` and also supports legacy `/groups/<id>/...`. It ignores friendly slugs and fragments.
- Roblox APIs enforce rate limits. Large communities may take time.
- Some inventories may be unavailable or error; those users are counted as 0.

## Permissions
- The extension fetches data from `groups.roblox.com`, `inventory.roblox.com`, and `thumbnails.roblox.com`.
- No cookies are read or stored; requests include credentials to honor Roblox session for public endpoints.