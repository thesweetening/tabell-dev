// SHL Simulator JavaScript - Backend API Version

class SHLSimulator {
    constructor() {
        this.teams = []; // För lagnamn (Teams-tabellen)
        this.teamStats = []; // För statistik (Team_Stats-tabellen)
        this.matches = [];
        this.simulatedResults = new Map(); // matchId -> {homeScore, awayScore}
        this.originalStats = new Map(); // backup av ursprunglig statistik
        
        // Backend API URL
        this.API_BASE_URL = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : 'https://your-backend-domain.com'; // TODO: Uppdatera för produktion
            
        // Säker konfiguration laddas från backend
        this.CONFIG = null;
            
        this.init();
    }

    async init() {
        console.log('🏒 Initierar SHL Simulator...');
        
        try {
            // Ladda säker konfiguration först
            await this.loadConfig();
            
            // Kontrollera autentisering
            await this.checkAuthentication();
            
            // Ladda data från backend API
            await this.loadTeamsData();
            await this.loadTeamStatsData();
            await this.loadMatchesData();
            
            // Rendera gränssnittet
            this.renderTable();
            this.renderMatches();
            this.setupEventListeners();
            
            console.log('✅ SHL Simulator redo!');
        } catch (error) {
            console.error('❌ Fel vid initiering:', error);
            if (error.message.includes('autentisering')) {
                this.showError('Du måste logga in för att använda simulatorn. <br><a href="admin-login.html" style="color: #dc143c;">🔑 Logga in här</a>');
            } else {
                this.showError(error.message || 'Det gick inte att ladda data från servern.');
            }
        }
    }

    async loadConfig() {
        try {
            console.log('🔧 Laddar säker konfiguration...');
            const response = await fetch(`${this.API_BASE_URL}/api/auth/config`);
            
            if (!response.ok) {
                throw new Error(`Config API fel: ${response.status}`);
            }
            
            this.CONFIG = await response.json();
            console.log('✅ Säker konfiguration laddad');
            
        } catch (error) {
            console.error('❌ Fel vid laddning av konfiguration:', error);
            throw new Error('Kunde inte ladda konfiguration från servern');
        }
    }

    async checkAuthentication() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/auth/status`, {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (!data.authenticated) {
                throw new Error('Autentisering krävs för att använda simulatorn');
            }
            
            console.log('✅ Användare autentiserad:', data.user.email);
            
        } catch (error) {
            console.error('❌ Autentiseringsfel:', error);
            throw new Error('Autentisering krävs för att använda simulatorn');
        }
    }

    async apiRequest(endpoint, options = {}) {
        const url = `${this.API_BASE_URL}/api/${endpoint}`;
        
        const config = {
            credentials: 'include', // Viktigt för sessions
            headers: {
                'Content-Type': 'application/json'
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            return data;
            
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    async loadTeamsData() {
        console.log('👥 Laddar lagnamn från backend...');
        
        try {
            const response = await this.apiRequest('teams');
            
            this.teams = response.data.map(record => ({
                id: record.id,
                ...record.fields
            }));

            console.log(`✅ Laddade ${this.teams.length} lagnamn`);
        } catch (error) {
            console.error('❌ Fel vid laddning av lagnamn:', error);
            throw new Error('Kunde inte ladda lagnamn: ' + error.message);
        }
    }

    async loadTeamStatsData() {
        console.log('📊 Laddar lagstatistik från backend...');
        
        try {
            const response = await this.apiRequest('team-stats');
            
            this.teamStats = response.data.map(record => ({
                id: record.id,
                ...record.fields
            }));

            // Backup av ursprunglig statistik
            this.teamStats.forEach(team => {
                this.originalStats.set(team.id, { ...team });
            });

            console.log(`✅ Laddade statistik för ${this.teamStats.length} lag`);
        } catch (error) {
            console.error('❌ Fel vid laddning av statistik:', error);
            throw new Error('Kunde inte ladda lagstatistik: ' + error.message);
        }
    }

    async loadMatchesData() {
        console.log('🎯 Laddar matchdata från backend...');
        
        try {
            const response = await this.apiRequest('matches');
            
            this.matches = response.data.map(record => ({
                id: record.id,
                ...record.fields
            }));

            console.log(`✅ Laddade ${this.matches.length} kommande matcher`);
            
            if (this.matches.length === 0) {
                console.log('ℹ️ Inga kommande matcher hittades.');
            }
            
        } catch (error) {
            console.error('❌ Fel vid laddning av matchdata:', error);
            throw new Error('Kunde inte ladda matcher: ' + error.message);
        }
    }

    renderTable() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        // Sortera lag efter poäng
        const sortedTeams = [...this.teamStats].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if ((b.goals_for - b.goals_against) !== (a.goals_for - a.goals_against)) {
                return (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against);
            }
            return b.goals_for - a.goals_for;
        });

        tbody.innerHTML = sortedTeams.map((teamStat, index) => {
            const position = index + 1;
            let rowClass = '';
            
            // Färgkoda positioner
            if (position <= 6) rowClass = 'playoff';
            else if (position <= 10) rowClass = 'qualification';
            else if (position >= 13) rowClass = 'relegation';

            // Hitta lagnamnet från Teams-tabellen via team_id kopplingen
            const teamName = this.getTeamNameFromStats(teamStat);

            return `
                <tr class="${rowClass}">
                    <td class="position">${position}</td>
                    <td class="team-name">${teamName}</td>
                    <td>${teamStat.games_played || 0}</td>
                    <td>${teamStat.wins || 0}</td>
                    <td>${teamStat.overtime_wins || 0}</td>
                    <td>${teamStat.overtime_losses || 0}</td>
                    <td>${teamStat.losses || 0}</td>
                    <td>${(teamStat.goals_for || 0) - (teamStat.goals_against || 0)}</td>
                    <td><strong>${teamStat.points || 0}</strong></td>
                </tr>
            `;
        }).join('');
    }

    renderMatches() {
        const container = document.getElementById('matchesList');
        if (!container) return;

        if (this.matches.length === 0) {
            container.innerHTML = '<div class="loading">Inga kommande matcher hittades.</div>';
            return;
        }

        container.innerHTML = this.matches.map(match => {
            const matchDate = new Date(match.match_date).toLocaleDateString('sv-SE');
            const matchTime = match.match_time || 'Tid ej angiven';
            const homeTeam = this.getTeamName(match.home_team);
            const awayTeam = this.getTeamName(match.away_team);
            
            const result = this.simulatedResults.get(match.id);
            const hasResult = result && (result.homeScore !== '' || result.awayScore !== '');

            return `
                <div class="match-card ${hasResult ? 'has-result' : ''}" data-match-id="${match.id}">
                    <div class="match-header">
                        <span class="match-date">${matchDate}</span>
                        <span class="match-time">${matchTime}</span>
                    </div>
                    <div class="match-teams">
                        ${homeTeam} - ${awayTeam}
                    </div>
                    <div class="match-result">
                        <input type="number" 
                               class="score-input home-score" 
                               min="0" 
                               max="20" 
                               placeholder="0"
                               value="${result ? result.homeScore : ''}"
                               data-match-id="${match.id}"
                               data-team="home">
                        <span class="score-separator">-</span>
                        <input type="number" 
                               class="score-input away-score" 
                               min="0" 
                               max="20" 
                               placeholder="0"
                               value="${result ? result.awayScore : ''}"
                               data-match-id="${match.id}"
                               data-team="away">
                    </div>
                </div>
            `;
        }).join('');
    }

    getTeamName(teamIds) {
        if (!teamIds || !Array.isArray(teamIds)) return 'Okänt lag';
        
        const teamId = teamIds[0];
        const team = this.teams.find(t => t.id === teamId);
        return team ? team.name : 'Okänt lag';
    }

    getTeamNameFromStats(teamStat) {
        // Team_Stats har ett team_id fält som länkar till Teams-tabellen
        if (teamStat.team_id && Array.isArray(teamStat.team_id)) {
            const teamId = teamStat.team_id[0];
            const team = this.teams.find(t => t.id === teamId);
            return team ? team.name : 'Okänt lag';
        }
        
        // Fallback: använd name-fältet från teamStat om det finns
        return teamStat.name || 'Okänt lag';
    }

    setupEventListeners() {
        // Resultatinmatning
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('score-input')) {
                this.handleScoreInput(e.target);
            }
        });

        // Återställ tabell
        document.getElementById('resetTable')?.addEventListener('click', () => {
            this.resetSimulation();
        });

        // Rensa resultat
        document.getElementById('clearResults')?.addEventListener('click', () => {
            this.clearAllResults();
        });

        // Datumfilter
        document.getElementById('dateFilter')?.addEventListener('change', (e) => {
            this.filterMatchesByDate(e.target.value);
        });

        // Spara simulering (placeholder)
        document.getElementById('saveSimulation')?.addEventListener('click', () => {
            this.saveSimulation();
        });
    }

    handleScoreInput(input) {
        const matchId = input.dataset.matchId;
        const team = input.dataset.team;
        const value = input.value;

        if (!this.simulatedResults.has(matchId)) {
            this.simulatedResults.set(matchId, { homeScore: '', awayScore: '' });
        }

        const result = this.simulatedResults.get(matchId);
        if (team === 'home') {
            result.homeScore = value;
        } else {
            result.awayScore = value;
        }

        // Uppdatera visuell feedback
        const matchCard = input.closest('.match-card');
        const hasCompleteResult = result.homeScore !== '' && result.awayScore !== '';
        matchCard.classList.toggle('has-result', hasCompleteResult);

        // Uppdatera tabellen om båda resultat är ifyllda
        if (hasCompleteResult) {
            this.updateTableWithResults();
        }
    }

    updateTableWithResults() {
        // Återställ till ursprunglig statistik
        this.teamStats.forEach(team => {
            const original = this.originalStats.get(team.id);
            Object.assign(team, original);
        });

        // Applicera alla simulerade resultat
        this.simulatedResults.forEach((result, matchId) => {
            if (result.homeScore !== '' && result.awayScore !== '') {
                this.applyMatchResult(matchId, parseInt(result.homeScore), parseInt(result.awayScore));
            }
        });

        // Uppdatera tabellen
        this.renderTable();
    }

    applyMatchResult(matchId, homeScore, awayScore) {
        const match = this.matches.find(m => m.id === matchId);
        if (!match) return;

        const homeTeamId = match.home_team[0];
        const awayTeamId = match.away_team[0];
        
        // Hitta lag i Team_Stats via team_id kopplingen
        const homeTeam = this.teamStats.find(t => t.team_id && t.team_id[0] === homeTeamId);
        const awayTeam = this.teamStats.find(t => t.team_id && t.team_id[0] === awayTeamId);
        
        if (!homeTeam || !awayTeam) return;

        // Uppdatera statistik
        homeTeam.games_played += 1;
        awayTeam.games_played += 1;
        
        homeTeam.goals_for += homeScore;
        homeTeam.goals_against += awayScore;
        awayTeam.goals_for += awayScore;
        awayTeam.goals_against += homeScore;

        // Bestäm vinnare och poäng
        if (homeScore > awayScore) {
            homeTeam.wins += 1;
            homeTeam.points += 3;
            awayTeam.losses += 1;
        } else if (awayScore > homeScore) {
            awayTeam.wins += 1;
            awayTeam.points += 3;
            homeTeam.losses += 1;
        } else {
            // Oavgjort - simulera övertid/straffläggning
            homeTeam.overtime_wins += 1;
            homeTeam.points += 2;
            awayTeam.overtime_losses += 1;
            awayTeam.points += 1;
        }
    }

    resetSimulation() {
        this.simulatedResults.clear();
        
        // Återställ till ursprunglig statistik
        this.teamStats.forEach(team => {
            const original = this.originalStats.get(team.id);
            Object.assign(team, original);
        });

        this.renderTable();
        this.renderMatches();
    }

    clearAllResults() {
        this.simulatedResults.clear();
        this.renderMatches();
        
        // Återställ tabell till ursprungligt läge
        this.teamStats.forEach(team => {
            const original = this.originalStats.get(team.id);
            Object.assign(team, original);
        });
        this.renderTable();
    }

    filterMatchesByDate(date) {
        const matchCards = document.querySelectorAll('.match-card');
        
        matchCards.forEach(card => {
            const matchDate = card.querySelector('.match-date').textContent;
            const cardDate = new Date(matchDate.split('.').reverse().join('-')).toISOString().split('T')[0];
            
            if (!date || cardDate === date) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    saveSimulation() {
        // Placeholder för att spara simulering till Airtable
        const simulationData = {
            timestamp: new Date().toISOString(),
            results: Array.from(this.simulatedResults.entries()).map(([matchId, result]) => ({
                matchId,
                homeScore: result.homeScore,
                awayScore: result.awayScore
            }))
        };

        console.log('💾 Simulering att spara:', simulationData);
        alert('Funktionen för att spara simuleringar kommer snart! 🚀');
    }

    showError(message) {
        const container = document.querySelector('.simulator-container');
        if (container) {
            container.innerHTML = `
                <div class="error">
                    ❌ ${message}
                </div>
            `;
        }
    }
}

// Starta simulatorn när sidan laddats
document.addEventListener('DOMContentLoaded', () => {
    new SHLSimulator();
});