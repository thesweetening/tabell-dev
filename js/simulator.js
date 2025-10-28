/**
 * SHL Simulator - Main JavaScript
 * Hanterar all funktionalitet för SHL tabellsimulatorn
 */

class SHLSimulator {
    constructor() {
        this.teams = [];
        this.standings = [];
        this.matches = [];
        this.currentRound = 'all';
        this.simulatedMatches = new Set();
        
        // API endpoints
        this.apiBase = '/api';
        
        // Initialize when DOM is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('🏒 Initialiserar SHL Simulator...');
        
        try {
            // Setup navigation
            this.setupNavigation();
            
            // Load initial data
            await this.loadTeams();
            await this.loadMatches();
            await this.loadStandings();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Show content
            this.hideLoadingStates();
            
            console.log('✅ SHL Simulator redo!');
            this.showMessage('Simulator laddad och redo att använda!', 'success');
            
        } catch (error) {
            console.error('❌ Fel vid initialisering:', error);
            this.showMessage('Fel vid laddning av data. Försök uppdatera sidan.', 'error');
        }
    }

    // ============================================================================
    // API CALLS
    // ============================================================================

    async loadTeams() {
        try {
            const response = await fetch(`${this.apiBase}/teams.php`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.teams = data.teams || [];
            
            console.log(`📊 Laddade ${this.teams.length} lag`);
        } catch (error) {
            console.error('Fel vid laddning av lag:', error);
            // Fallback med statiska lag
            this.teams = this.getFallbackTeams();
        }
    }

    async loadMatches() {
        try {
            const response = await fetch(`${this.apiBase}/matches.php`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.matches = data.matches || [];
            
            // Update simulated matches set
            this.simulatedMatches.clear();
            this.matches.forEach(match => {
                if (match.home_score !== null && match.away_score !== null) {
                    this.simulatedMatches.add(match.id);
                }
            });
            
            console.log(`⚽ Laddade ${this.matches.length} matcher`);
            this.renderMatches();
            this.updateRoundSelect();
            
        } catch (error) {
            console.error('Fel vid laddning av matcher:', error);
            // Fallback med testmatcher
            this.matches = this.getFallbackMatches();
            this.renderMatches();
        }
    }

    async loadStandings() {
        try {
            const response = await fetch(`${this.apiBase}/standings.php`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.standings = data.standings || [];
            
            console.log(`🏆 Laddade tabelldata för ${this.standings.length} lag`);
            this.renderStandings();
            
        } catch (error) {
            console.error('Fel vid laddning av tabell:', error);
            // Generate fallback standings
            this.standings = this.generateFallbackStandings();
            this.renderStandings();
        }
    }

    async submitMatchResult(matchId, homeScore, awayScore, matchType = 'regular') {
        try {
            const response = await fetch(`${this.apiBase}/submit-result.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    match_id: matchId,
                    home_score: homeScore,
                    away_score: awayScore,
                    match_type: matchType
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.success) {
                // Mark match as simulated
                this.simulatedMatches.add(matchId);
                
                // Update match in local data
                const match = this.matches.find(m => m.id === matchId);
                if (match) {
                    match.home_score = homeScore;
                    match.away_score = awayScore;
                    match.match_type = matchType;
                }
                
                // Reload standings
                await this.loadStandings();
                
                // Update UI
                this.renderMatches();
                this.showMessage(`Match uppdaterad: ${data.match_info}`, 'success');
                
            } else {
                throw new Error(data.error || 'Okänt fel');
            }
            
        } catch (error) {
            console.error('Fel vid matchresultat:', error);
            this.showMessage(`Fel vid uppdatering: ${error.message}`, 'error');
        }
    }

    // ============================================================================
    // UI RENDERING
    // ============================================================================

    renderMatches() {
        const container = document.getElementById('matchesList');
        if (!container) return;

        // Group matches by round
        const matchesByRound = {};
        this.matches.forEach(match => {
            const round = match.round || 1;
            if (!matchesByRound[round]) {
                matchesByRound[round] = [];
            }
            matchesByRound[round].push(match);
        });

        let html = '';
        
        // Sort rounds numerically
        const sortedRounds = Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b));
        
        sortedRounds.forEach(round => {
            // Skip if filtering by specific round and this isn't it
            if (this.currentRound !== 'all' && parseInt(round) !== parseInt(this.currentRound)) {
                return;
            }
            
            html += `<div class="round-header">Omgång ${round}</div>`;
            
            matchesByRound[round].forEach(match => {
                const isSimulated = this.simulatedMatches.has(match.id);
                
                html += `
                    <div class="match-item ${isSimulated ? 'simulated' : ''}" data-match-id="${match.id}">
                        <div class="match-teams">
                            <div class="team home-team">
                                <span class="team-name">${match.home_team}</span>
                                <input type="number" 
                                       class="score-input home-score" 
                                       min="0" 
                                       max="20"
                                       value="${match.home_score || ''}"
                                       placeholder="0"
                                       ${isSimulated ? '' : ''}>
                            </div>
                            
                            <span class="vs">-</span>
                            
                            <div class="team away-team">
                                <input type="number" 
                                       class="score-input away-score" 
                                       min="0" 
                                       max="20"
                                       value="${match.away_score || ''}"
                                       placeholder="0"
                                       ${isSimulated ? '' : ''}>
                                <span class="team-name">${match.away_team}</span>
                            </div>
                        </div>
                        
                        <select class="match-type-select">
                            <option value="regular" ${match.match_type === 'regular' ? 'selected' : ''}>Ordinarie tid</option>
                            <option value="overtime" ${match.match_type === 'overtime' ? 'selected' : ''}>Övertid</option>
                            <option value="shootout" ${match.match_type === 'shootout' ? 'selected' : ''}>Straffläggning</option>
                        </select>
                    </div>
                `;
            });
        });

        container.innerHTML = html || '<p>Inga matcher att visa</p>';
        
        // Add event listeners for score inputs
        this.setupMatchEventListeners();
    }

    renderStandings() {
        const tbody = document.getElementById('standingsBody');
        if (!tbody) return;

        let html = '';
        
        this.standings.forEach((team, index) => {
            const position = index + 1;
            const goalDiff = team.goals_for - team.goals_against;
            
            html += `
                <tr>
                    <td><span class="position">${position}</span></td>
                    <td class="team-name-cell">${team.team_name}</td>
                    <td>${team.games_played}</td>
                    <td>${team.wins}</td>
                    <td>${team.ot_wins}</td>
                    <td>${team.ot_losses}</td>
                    <td>${team.losses}</td>
                    <td>${team.goals_for}</td>
                    <td>${team.goals_against}</td>
                    <td class="${goalDiff > 0 ? 'positive' : goalDiff < 0 ? 'negative' : ''}">
                        ${goalDiff > 0 ? '+' : ''}${goalDiff}
                    </td>
                    <td class="points">${team.points}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    updateRoundSelect() {
        const select = document.getElementById('roundSelect');
        if (!select) return;

        // Get unique rounds
        const rounds = [...new Set(this.matches.map(m => m.round || 1))].sort((a, b) => a - b);
        
        let html = '<option value="all">Alla omgångar</option>';
        rounds.forEach(round => {
            html += `<option value="${round}">Omgång ${round}</option>`;
        });
        
        select.innerHTML = html;
    }

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    setupEventListeners() {
        // Round selector
        const roundSelect = document.getElementById('roundSelect');
        if (roundSelect) {
            roundSelect.addEventListener('change', (e) => {
                this.currentRound = e.target.value;
                this.renderMatches();
            });
        }

        // Navigation toggle for mobile
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }
    }

    setupMatchEventListeners() {
        // Score input listeners
        document.querySelectorAll('.score-input').forEach(input => {
            input.addEventListener('blur', (e) => {
                this.handleScoreChange(e);
            });
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
        });

        // Match type selector listeners
        document.querySelectorAll('.match-type-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleMatchTypeChange(e);
            });
        });
    }

    handleScoreChange(event) {
        const input = event.target;
        const matchItem = input.closest('.match-item');
        const matchId = parseInt(matchItem.dataset.matchId);
        
        const homeScoreInput = matchItem.querySelector('.home-score');
        const awayScoreInput = matchItem.querySelector('.away-score');
        const matchTypeSelect = matchItem.querySelector('.match-type-select');
        
        const homeScore = parseInt(homeScoreInput.value);
        const awayScore = parseInt(awayScoreInput.value);
        
        // Only submit if both scores are valid numbers
        if (!isNaN(homeScore) && !isNaN(awayScore) && homeScore >= 0 && awayScore >= 0) {
            const matchType = matchTypeSelect.value;
            this.submitMatchResult(matchId, homeScore, awayScore, matchType);
        }
    }

    handleMatchTypeChange(event) {
        const select = event.target;
        const matchItem = select.closest('.match-item');
        
        // If match already has scores, resubmit with new type
        const homeScoreInput = matchItem.querySelector('.home-score');
        const awayScoreInput = matchItem.querySelector('.away-score');
        
        const homeScore = parseInt(homeScoreInput.value);
        const awayScore = parseInt(awayScoreInput.value);
        
        if (!isNaN(homeScore) && !isNaN(awayScore)) {
            const matchId = parseInt(matchItem.dataset.matchId);
            this.submitMatchResult(matchId, homeScore, awayScore, select.value);
        }
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    setupNavigation() {
        // Highlight current page in navigation
        const currentPage = window.location.pathname;
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('href') === currentPage || 
                (currentPage.includes('simulator') && link.getAttribute('href').includes('simulator'))) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    hideLoadingStates() {
        document.getElementById('matchesLoading')?.style.setProperty('display', 'none');
        document.getElementById('tableLoading')?.style.setProperty('display', 'none');
        document.getElementById('matchesList')?.style.setProperty('display', 'block');
        document.getElementById('standingsTable')?.style.setProperty('display', 'block');
    }

    showMessage(message, type = 'info') {
        const info = document.getElementById('simulationInfo');
        const messageEl = document.getElementById('simulationMessage');
        
        if (info && messageEl) {
            messageEl.textContent = message;
            info.className = `simulation-info ${type}`;
            info.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                info.style.display = 'none';
            }, 5000);
        }
    }

    // ============================================================================
    // PUBLIC METHODS (called from buttons)
    // ============================================================================

    showUnplayedMatches() {
        // Filter to show only unplayed matches
        const matchItems = document.querySelectorAll('.match-item');
        matchItems.forEach(item => {
            if (item.classList.contains('simulated')) {
                item.style.display = 'none';
            } else {
                item.style.display = 'block';
            }
        });
        this.showMessage('Visar endast ospelande matcher', 'info');
    }

    showSimulatedMatches() {
        // Filter to show only simulated matches
        const matchItems = document.querySelectorAll('.match-item');
        matchItems.forEach(item => {
            if (item.classList.contains('simulated')) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
        this.showMessage('Visar endast simulerade matcher', 'info');
    }

    async resetAllMatches() {
        if (!confirm('Är du säker på att du vill återställa alla matchresultat?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/reset-matches.php`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.success) {
                this.simulatedMatches.clear();
                await this.loadMatches();
                await this.loadStandings();
                this.showMessage('Alla matcher återställda!', 'success');
            } else {
                throw new Error(data.error || 'Fel vid återställning');
            }
            
        } catch (error) {
            console.error('Fel vid återställning:', error);
            this.showMessage(`Fel: ${error.message}`, 'error');
        }
    }

    async simulateAllRemaining() {
        if (!confirm('Simulera slumpmässiga resultat för alla kvarvarande matcher?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/simulate-remaining.php`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.success) {
                await this.loadMatches();
                await this.loadStandings();
                this.showMessage(`Simulerade ${data.simulated_count} matcher!`, 'success');
            } else {
                throw new Error(data.error || 'Fel vid simulering');
            }
            
        } catch (error) {
            console.error('Fel vid simulering:', error);
            this.showMessage(`Fel: ${error.message}`, 'error');
        }
    }

    exportResults() {
        // Create CSV export of current standings
        let csv = 'Position,Lag,GP,W,OTW,OTL,L,GF,GA,+/-,Pts\n';
        
        this.standings.forEach((team, index) => {
            const position = index + 1;
            const goalDiff = team.goals_for - team.goals_against;
            
            csv += `${position},"${team.team_name}",${team.games_played},${team.wins},${team.ot_wins},${team.ot_losses},${team.losses},${team.goals_for},${team.goals_against},${goalDiff},${team.points}\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `shl-tabell-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showMessage('Tabelldata exporterad!', 'success');
    }

    // ============================================================================
    // FALLBACK DATA
    // ============================================================================

    getFallbackTeams() {
        return [
            { id: 1, name: 'Färjestad BK', short_name: 'FBK' },
            { id: 2, name: 'Frölunda HC', short_name: 'FHC' },
            { id: 3, name: 'Djurgården IF', short_name: 'DIF' },
            { id: 4, name: 'Malmö Redhawks', short_name: 'MIF' },
            { id: 5, name: 'Örebro HK', short_name: 'ÖHK' },
            { id: 6, name: 'Växjö Lakers', short_name: 'VLH' },
            { id: 7, name: 'Skellefteå AIK', short_name: 'SAIK' },
            { id: 8, name: 'Luleå HF', short_name: 'LHF' },
            { id: 9, name: 'Linköping HC', short_name: 'LHC' },
            { id: 10, name: 'HV71', short_name: 'HV71' },
            { id: 11, name: 'Brynäs IF', short_name: 'BIF' },
            { id: 12, name: 'Rögle BK', short_name: 'RBK' },
            { id: 13, name: 'Leksands IF', short_name: 'LIF' },
            { id: 14, name: 'Timrå IK', short_name: 'TIK' }
        ];
    }

    getFallbackMatches() {
        // Generate a few test matches
        return [
            { id: 1, round: 1, home_team: 'Färjestad BK', away_team: 'Frölunda HC', home_score: null, away_score: null },
            { id: 2, round: 1, home_team: 'Djurgården IF', away_team: 'Malmö Redhawks', home_score: null, away_score: null },
            { id: 3, round: 1, home_team: 'Örebro HK', away_team: 'Växjö Lakers', home_score: null, away_score: null }
        ];
    }

    generateFallbackStandings() {
        return this.getFallbackTeams().map((team, index) => ({
            team_name: team.name,
            games_played: 0,
            wins: 0,
            ot_wins: 0,
            ot_losses: 0,
            losses: 0,
            goals_for: 0,
            goals_against: 0,
            points: 0
        }));
    }
}

// Initialize the simulator
const simulator = new SHLSimulator();

// Make it globally available for button onclick handlers
window.simulator = simulator;