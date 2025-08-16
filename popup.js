class RobloxRichPlayersFinder {
    constructor() {
        this.currentCommunityId = null;
        this.isSearching = false;
        this.cachedResults = null;
        
        this.initializeEventListeners();
        this.loadFromStorage();
    }

    initializeEventListeners() {
        const searchBtn = document.getElementById('searchBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const communityUrl = document.getElementById('communityUrl');

        searchBtn.addEventListener('click', () => this.searchPlayers());
        refreshBtn.addEventListener('click', () => this.refreshResults());
        
        // Allow Enter key to trigger search
        communityUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isSearching) {
                this.searchPlayers();
            }
        });
    }

    async loadFromStorage() {
        try {
            const result = await chrome.storage.local.get(['lastCommunityUrl', 'lastResults']);
            if (result.lastCommunityUrl) {
                document.getElementById('communityUrl').value = result.lastCommunityUrl;
            }
            if (result.lastResults) {
                this.cachedResults = result.lastResults;
                this.displayResults(this.cachedResults);
                document.getElementById('refreshBtn').disabled = false;
            }
        } catch (error) {
            console.error('Error loading from storage:', error);
        }
    }

    async saveToStorage(url, results) {
        try {
            await chrome.storage.local.set({
                lastCommunityUrl: url,
                lastResults: results
            });
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }

    parseCommunityUrl(url) {
        try {
            // Handle 2025 format: https://www.roblox.com/communities/35461612/Z9-Market#!/about
            const urlObj = new URL(url);
            
            if (!urlObj.hostname.includes('roblox.com')) {
                throw new Error('Not a valid Roblox URL');
            }

            // Extract community ID from path
            const pathMatch = urlObj.pathname.match(/\/communities\/(\d+)/);
            if (!pathMatch || !pathMatch[1]) {
                throw new Error('Community ID not found in URL');
            }

            const communityId = pathMatch[1];
            
            // Validate community ID is numeric and reasonable length
            if (!/^\d{1,20}$/.test(communityId)) {
                throw new Error('Invalid community ID format');
            }

            return communityId;
        } catch (error) {
            throw new Error(`Invalid URL format: ${error.message}`);
        }
    }

    async searchPlayers() {
        const urlInput = document.getElementById('communityUrl');
        const url = urlInput.value.trim();

        if (!url) {
            this.showError('Please enter a Roblox community URL');
            return;
        }

        try {
            this.currentCommunityId = this.parseCommunityUrl(url);
            this.setSearching(true);
            
            this.showLoading('Fetching community members...');
            
            const members = await this.fetchCommunityMembers(this.currentCommunityId);
            
            if (members.length === 0) {
                this.showError('No members found in this community or community does not exist');
                return;
            }

            this.showLoading(`Analyzing ${members.length} members' inventories...`);
            
            const richPlayers = await this.analyzePlayersWealth(members);
            
            this.cachedResults = richPlayers;
            await this.saveToStorage(url, richPlayers);
            
            this.displayResults(richPlayers);
            document.getElementById('refreshBtn').disabled = false;

        } catch (error) {
            console.error('Search error:', error);
            this.showError(error.message);
        } finally {
            this.setSearching(false);
        }
    }

    async refreshResults() {
        if (!this.currentCommunityId) {
            this.showError('No community to refresh');
            return;
        }

        // Clear cached results and re-search
        this.cachedResults = null;
        await this.searchPlayers();
    }

    async fetchCommunityMembers(communityId) {
        const members = [];
        let cursor = null;
        let pageCount = 0;
        const maxPages = 10; // Limit to prevent excessive API calls

        try {
            do {
                const url = `https://groups.roblox.com/v1/groups/${communityId}/users?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    if (response.status === 400) {
                        throw new Error('Invalid community ID or community does not exist');
                    } else if (response.status === 429) {
                        throw new Error('Too many requests. Please wait a moment and try again');
                    } else {
                        throw new Error(`Failed to fetch community members (${response.status})`);
                    }
                }

                const data = await response.json();
                
                if (data.data && data.data.length > 0) {
                    members.push(...data.data);
                }

                cursor = data.nextPageCursor;
                pageCount++;

                // Update progress
                this.updateProgress((pageCount / maxPages) * 50); // First 50% for fetching members

            } while (cursor && pageCount < maxPages);

            return members;

        } catch (error) {
            throw new Error(`Error fetching community members: ${error.message}`);
        }
    }

    async analyzePlayersWealth(members) {
        const richPlayers = [];
        const minValue = 10000; // Minimum value threshold in Robux
        
        for (let i = 0; i < Math.min(members.length, 50); i++) { // Limit to 50 players to avoid timeouts
            const member = members[i];
            
            try {
                this.showLoading(`Analyzing player ${i + 1}/${Math.min(members.length, 50)}: ${member.user.displayName || member.user.name}`);
                this.updateProgress(50 + (i / Math.min(members.length, 50)) * 50); // Second 50% for analysis

                const totalValue = await this.calculatePlayerWealth(member.user.userId);
                
                if (totalValue >= minValue) {
                    richPlayers.push({
                        userId: member.user.userId,
                        username: member.user.name,
                        displayName: member.user.displayName,
                        totalValue: totalValue,
                        rank: member.role?.rank || 0
                    });
                }

                // Small delay to avoid rate limiting
                await this.delay(100);

            } catch (error) {
                console.warn(`Error analyzing player ${member.user.name}:`, error);
                // Continue with next player instead of failing entire search
            }
        }

        // Sort by total value (descending)
        richPlayers.sort((a, b) => b.totalValue - a.totalValue);

        return richPlayers;
    }

    async calculatePlayerWealth(userId) {
        try {
            // Try multiple approaches to get limited items value
            const rolimonValue = await this.getRolimonValue(userId);
            if (rolimonValue > 0) {
                return rolimonValue;
            }

            // Fallback: try to get basic inventory info
            return await this.getBasicInventoryValue(userId);

        } catch (error) {
            console.warn(`Error calculating wealth for user ${userId}:`, error);
            return 0;
        }
    }

    async getRolimonValue(userId) {
        try {
            // Use Rolimon's API for item values (they track limited item values)
            const response = await fetch(`https://api.rolimons.com/players/v1/playerinfo/${userId}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.playerinfo && data.playerinfo[userId]) {
                    const playerInfo = data.playerinfo[userId];
                    return playerInfo.value || 0;
                }
            }
        } catch (error) {
            console.warn('Rolimon API error:', error);
        }
        return 0;
    }

    async getBasicInventoryValue(userId) {
        try {
            // Alternative approach using Roblox's own APIs
            const response = await fetch(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`);
            
            if (response.ok) {
                const data = await response.json();
                let totalValue = 0;

                if (data.data) {
                    // This is a simplified estimation - in reality, you'd need real item value data
                    totalValue = data.data.length * 1000; // Rough estimate
                }

                return totalValue;
            }
        } catch (error) {
            console.warn('Inventory API error:', error);
        }
        return 0;
    }

    displayResults(players) {
        const resultsDiv = document.getElementById('results');
        
        if (!players || players.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">No rich players found in this community (min 10,000 Robux in limiteds)</div>';
            return;
        }

        let html = `<div style="margin-bottom: 10px; font-size: 14px; opacity: 0.9;">Found ${players.length} rich players:</div>`;
        
        players.forEach((player, index) => {
            const displayName = player.displayName || player.username;
            const formattedValue = this.formatRobux(player.totalValue);
            
            html += `
                <div class="player-item">
                    <div class="player-rank">${index + 1}</div>
                    <div class="player-info">
                        <div class="player-name">${this.escapeHtml(displayName)}</div>
                        <div class="player-value">💎 ${formattedValue} Robux in limiteds</div>
                    </div>
                </div>
            `;
        });

        resultsDiv.innerHTML = html;
    }

    showLoading(message) {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `
            <div class="loading">
                <div>${message}</div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
            </div>
        `;
    }

    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        }
    }

    showError(message) {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `
            <div class="error">
                ❌ ${this.escapeHtml(message)}
            </div>
            <div class="no-results">
                Please check the URL and try again.
            </div>
        `;
    }

    setSearching(searching) {
        this.isSearching = searching;
        const searchBtn = document.getElementById('searchBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        
        searchBtn.disabled = searching;
        searchBtn.textContent = searching ? '🔍 Searching...' : '🔍 Search for List';
        
        if (!searching && this.cachedResults) {
            refreshBtn.disabled = false;
        }
    }

    formatRobux(value) {
        if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}K`;
        }
        return value.toLocaleString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RobloxRichPlayersFinder();
});