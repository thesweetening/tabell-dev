// SHL Simulator JavaScript - Backend API Version

class SHLSimulator {
    constructor() {
        this.teams = []; // För lagnamn (Teams-tabellen)
        this.teamStats = []; // För statistik (Team_Stats-tabellen)
        this.matches = [];
        this.simulatedResults = new Map(); // matchId -> {homeScore, awayScore}
        this.originalStats = new Map(); // backup av ursprunglig statistik
        
        // Backend API URL - fallback till frontend när backend inte är tillgängligt
        this.API_BASE_URL = this.getBackendUrl();
            
        // Säker konfiguration laddas från backend
        this.CONFIG = null;
            
        this.init();
    }

    getBackendUrl() {
        const hostname = window.location.hostname;
        
        // Localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3001';
        }
        
        // Staging/produktion
        if (hostname.includes('tabell.top')) {
            return 'https://tabell.top/api';
        }
        
        // Fallback
        return null;
    }

    async init() {
        console.log('🏒 Initierar SHL Simulator (Backend Version)...');
        
        try {
            // Först: ladda konfiguration
            await this.loadConfig();
            
            // Kontrollera autentisering om backend är tillgängligt
            if (this.API_BASE_URL) {
                await this.checkAuthentication();
            }
            
            // Ladda data
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
            this.showError(error.message || 'Det gick inte att ladda data från databasen.');
        }
    }

    async loadConfig() {
        // Om ingen backend URL eller localhost, försök direktaccess
        if (!this.API_BASE_URL) {
            console.log('🔄 Backend inte tillgängligt, använder direktaccess...');
            return this.loadDirectConfig();
        }
        
        try {
            console.log('🔧 Laddar säker konfiguration från backend...');
            const response = await fetch(`${this.API_BASE_URL}/api/auth/config`);
            
            if (!response.ok) {
                throw new Error(`Config API fel: ${response.status}`);
            }
            
            this.CONFIG = await response.json();
            console.log('✅ Säker konfiguration laddad från backend');
            
        } catch (error) {
            console.error('❌ Backend inte tillgängligt, fallback till direktaccess:', error);
            return this.loadDirectConfig();
        }
    }

    async loadDirectConfig() {
        try {
            // Försök läsa från localStorage (admin-panelen)
            const savedApiKey = localStorage.getItem('airtable_api_key');
            const savedBaseId = localStorage.getItem('airtable_base_id');
            
            if (savedApiKey && savedBaseId && savedApiKey !== 'demo_mode') {
                this.CONFIG = {
                    airtable: {
                        apiKey: savedApiKey,
                        baseId: savedBaseId
                    }
                };
                console.log('✅ Konfiguration laddad från localStorage');
                return;
            }

            // Fallback till demo-data endast som sista utväg
            this.CONFIG = {
                airtable: {
                    apiKey: 'demo_mode',
                    baseId: 'demo_mode'
                }
            };
            console.log('⚠️ Demo-läge aktiverat - använder inbyggd data');
            
        } catch (error) {
            console.error('❌ Fel vid direktaccess-konfiguration:', error);
            throw new Error('Kunde inte ladda konfiguration');
        }
    }

    async checkAuthentication() {
        // Hoppa över autentisering i direktaccess-läge
        if (!this.API_BASE_URL) {
            console.log('ℹ️ Direktaccess-läge - hoppar över autentisering');
            return;
        }
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/auth/status`, {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (!data.authenticated) {
                console.log('⚠️ Inte inloggad - använder demo-läge');
                this.API_BASE_URL = null; // Byt till demo-läge
                await this.loadDirectConfig();
                return;
            }
            
            console.log('✅ Användare autentiserad:', data.user.email);
            
        } catch (error) {
            console.error('❌ Autentiseringsfel:', error);
            this.API_BASE_URL = null; // Byt till demo-läge
            await this.loadDirectConfig();
        }
    }

    async apiRequest(endpoint, options = {}) {
        // Direktaccess-läge - använd Airtable direkt
        if (!this.API_BASE_URL) {
            return this.directAirtableRequest(endpoint, options);
        }
        
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

    async directAirtableRequest(endpoint, options = {}) {
        // Demo-data för staging när ingen backend är tillgänglig
        if (this.CONFIG?.airtable?.apiKey === 'demo_mode') {
            return this.getDemoData(endpoint);
        }
        
        // Om vi har giltig localStorage-config, försök direktaccess
        if (this.CONFIG?.airtable?.apiKey && this.CONFIG?.airtable?.baseId) {
            const table = this.getTableForEndpoint(endpoint);
            const url = `https://api.airtable.com/v0/${this.CONFIG.airtable.baseId}/${table}`;
            
            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${this.CONFIG.airtable.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    ...options
                });
                
                if (!response.ok) {
                    throw new Error(`Airtable API fel: ${response.status}`);
                }
                
                const data = await response.json();
                return { data: data.records };
                
            } catch (error) {
                console.error('Direktaccess fel, använder demo-data:', error);
                return this.getDemoData(endpoint);
            }
        }
        
        // Fallback till demo-data
        return this.getDemoData(endpoint);
    }

    getTableForEndpoint(endpoint) {
        const endpointToTable = {
            'teams': 'Teams',
            'team-stats': 'Team_Stats', 
            'matches': 'Matches'
        };
        return endpointToTable[endpoint] || endpoint;
    }

    getDemoData(endpoint) {
        console.log(`📋 Använder demo-data för ${endpoint}`);
        
        const demoData = {
            teams: {
                data: [
                    { id: 'demo1', fields: { Lag: 'Färjestad BK', Förkortning: 'FBK' } },
                    { id: 'demo2', fields: { Lag: 'Frölunda HC', Förkortning: 'FHC' } },
                    { id: 'demo3', fields: { Lag: 'Malmö Redhawks', Förkortning: 'MIF' } },
                    { id: 'demo4', fields: { Lag: 'Luleå HF', Förkortning: 'LHF' } },
                    { id: 'demo5', fields: { Lag: 'Örebro HK', Förkortning: 'ÖHK' } },
                    { id: 'demo6', fields: { Lag: 'Skellefteå AIK', Förkortning: 'SAIK' } },
                    { id: 'demo7', fields: { Lag: 'HV71', Förkortning: 'HV71' } },
                    { id: 'demo8', fields: { Lag: 'Linköping HC', Förkortning: 'LHC' } }
                ]
            },
            'team-stats': {
                data: [
                    { id: 'stats1', fields: { Lag: ['demo1'], GP: 12, W: 9, L: 2, OTL: 1, P: 28, GF: 42, GA: 22 } },
                    { id: 'stats2', fields: { Lag: ['demo2'], GP: 12, W: 8, L: 3, OTL: 1, P: 25, GF: 38, GA: 28 } },
                    { id: 'stats3', fields: { Lag: ['demo3'], GP: 12, W: 7, L: 4, OTL: 1, P: 22, GF: 35, GA: 32 } },
                    { id: 'stats4', fields: { Lag: ['demo4'], GP: 12, W: 6, L: 5, OTL: 1, P: 19, GF: 33, GA: 35 } },
                    { id: 'stats5', fields: { Lag: ['demo5'], GP: 12, W: 5, L: 6, OTL: 1, P: 16, GF: 28, GA: 38 } },
                    { id: 'stats6', fields: { Lag: ['demo6'], GP: 12, W: 4, L: 7, OTL: 1, P: 13, GF: 25, GA: 40 } },
                    { id: 'stats7', fields: { Lag: ['demo7'], GP: 12, W: 3, L: 8, OTL: 1, P: 10, GF: 22, GA: 42 } },
                    { id: 'stats8', fields: { Lag: ['demo8'], GP: 12, W: 2, L: 9, OTL: 1, P: 7, GF: 18, GA: 45 } }
                ]
            },
            matches: {
                data: [
                    { id: 'match1', fields: { Hemmalag: ['demo1'], Bortalag: ['demo2'], Datum: '2025-11-01', Hemmaresultat: null, Bortaresultat: null } },
                    { id: 'match2', fields: { Hemmalag: ['demo3'], Bortalag: ['demo4'], Datum: '2025-11-02', Hemmaresultat: null, Bortaresultat: null } },
                    { id: 'match3', fields: { Hemmalag: ['demo5'], Bortalag: ['demo6'], Datum: '2025-11-03', Hemmaresultat: null, Bortaresultat: null } },
                    { id: 'match4', fields: { Hemmalag: ['demo7'], Bortalag: ['demo8'], Datum: '2025-11-04', Hemmaresultat: null, Bortaresultat: null } }
                ]
            }
        };
        
        return demoData[endpoint] || { data: [] };
    }

    async loadTeamsData() {
        console.log('👥 Laddar lagnamn...');
        
        try {
            const response = await this.apiRequest('teams');
            
            this.teams = response.data.map(record => ({
                id: record.id,
                name: record.fields.name,
                short_name: record.fields.short_name,
                ...record.fields
            }));

            console.log(`✅ Laddade ${this.teams.length} lagnamn`);
        } catch (error) {
            console.error('❌ Fel vid laddning av lagnamn:', error);
            throw new Error('Kunde inte ladda lagnamn: ' + error.message);
        }
    }

    async loadTeamStatsData() {
        console.log('📊 Laddar lagstatistik...');
        
        try {
            const response = await this.apiRequest('team-stats');
            
            this.teamStats = response.data.map(record => ({
                id: record.id,
                teamId: Array.isArray(record.fields.Teams) ? record.fields.Teams[0] : record.fields.Teams,
                GP: record.fields.games,
                W: record.fields.wins,
                L: record.fields.losses,
                OTL: record.fields.overtime_losses,
                P: record.fields.points,
                GF: record.fields.goals_for,
                GA: record.fields.goals_against,
                ...record.fields
            }));

            // Backup original stats för reset-funktionalitet
            this.originalStats.clear();
            this.teamStats.forEach(stat => {
                this.originalStats.set(stat.teamId, { ...stat });
            });

            console.log(`✅ Laddade statistik för ${this.teamStats.length} lag`);
        } catch (error) {
            console.error('❌ Fel vid laddning av lagstatistik:', error);
            throw new Error('Kunde inte ladda lagstatistik: ' + error.message);
        }
    }

    async loadMatchesData() {
        console.log('🏒 Laddar matcher...');
        
        try {
            const response = await this.apiRequest('matches');
            
            this.matches = response.data.map(record => ({
                id: record.id,
                homeTeamId: Array.isArray(record.fields.home_team) ? record.fields.home_team[0] : record.fields.home_team,
                awayTeamId: Array.isArray(record.fields.away_team) ? record.fields.away_team[0] : record.fields.away_team,
                homeScore: record.fields.home_goals || null,
                awayScore: record.fields.away_goals || null,
                date: record.fields.match_date,
                finished: record.fields.finished,
                ...record.fields
            }));

            console.log(`✅ Laddade ${this.matches.length} matcher`);
        } catch (error) {
            console.error('❌ Fel vid laddning av matcher:', error);
            throw new Error('Kunde inte ladda matcher: ' + error.message);
        }
    }

    renderTable() {
        const tableContainer = document.getElementById('standings-table');
        if (!tableContainer) {
            console.error('❌ Kunde inte hitta standings-table element');
            return;
        }
        
        console.log('📋 Renderar tabell med', this.teamStats.length, 'lag');
        console.log('Teams:', this.teams.map(t => `${t.id}: ${t.Lag}`));
        console.log('Stats teamIds:', this.teamStats.map(s => s.teamId));

        // Sortera lag efter poäng (P) och sedan efter målskillnad
        const sortedStats = [...this.teamStats].sort((a, b) => {
            const pointsDiff = (b.P || 0) - (a.P || 0);
            if (pointsDiff !== 0) return pointsDiff;
            
            const aGoalDiff = (a.GF || 0) - (a.GA || 0);
            const bGoalDiff = (b.GF || 0) - (b.GA || 0);
            return bGoalDiff - aGoalDiff;
        });

        const tableHTML = `
            <table class="shl-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Lag</th>
                        <th>GP</th>
                        <th>W</th>
                        <th>L</th>
                        <th>OTL</th>
                        <th>P</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>+/-</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedStats.map((stat, index) => {
                        const team = this.teams.find(t => t.id === stat.teamId);
                        const teamName = team ? team.name : `Okänt lag (${stat.teamId})`;
                        const goalDiff = (stat.GF || 0) - (stat.GA || 0);
                        const goalDiffClass = goalDiff > 0 ? 'positive' : goalDiff < 0 ? 'negative' : '';
                        
                        return `
                            <tr>
                                <td>${index + 1}</td>
                                <td class="team-name">${teamName}</td>
                                <td>${stat.GP || 0}</td>
                                <td>${stat.W || 0}</td>
                                <td>${stat.L || 0}</td>
                                <td>${stat.OTL || 0}</td>
                                <td class="points">${stat.P || 0}</td>
                                <td>${stat.GF || 0}</td>
                                <td>${stat.GA || 0}</td>
                                <td class="goal-diff ${goalDiffClass}">${goalDiff > 0 ? '+' : ''}${goalDiff}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        console.log('📄 Sätter HTML för tabell, längd:', tableHTML.length);
        tableContainer.innerHTML = tableHTML;
        console.log('✅ Tabell HTML uppsatt');
    }

    renderMatches() {
        const matchesContainer = document.getElementById('matches-container');
        if (!matchesContainer) {
            console.error('❌ Kunde inte hitta matches-container element');
            return;
        }
        
        console.log('🏒 Renderar matcher:', this.matches.length, 'totalt');

        // Filtrera matcher som inte är färdiga
        const upcomingMatches = this.matches.filter(match => 
            !match.finished && (match.homeScore === null || match.awayScore === null)
        );

        if (upcomingMatches.length === 0) {
            matchesContainer.innerHTML = '<p class="no-matches">Inga kommande matcher att simulera.</p>';
            return;
        }

        const matchesHTML = upcomingMatches.map(match => {
            const homeTeam = this.teams.find(t => t.id === match.homeTeamId);
            const awayTeam = this.teams.find(t => t.id === match.awayTeamId);
            
            const homeTeamName = homeTeam ? homeTeam.name : 'Okänt lag';
            const awayTeamName = awayTeam ? awayTeam.name : 'Okänt lag';
            
            const simResult = this.simulatedResults.get(match.id);
            
            return `
                <div class="match-card" data-match-id="${match.id}">
                    <div class="match-date">${this.formatDate(match.date)}</div>
                    <div class="match-teams">
                        <div class="team home-team">
                            <span class="team-name">${homeTeamName}</span>
                            <input type="number" 
                                   class="score-input home-score" 
                                   min="0" 
                                   max="20" 
                                   placeholder="0"
                                   value="${simResult ? simResult.homeScore : ''}"
                                   data-match-id="${match.id}"
                                   data-team="home">
                        </div>
                        <div class="vs">VS</div>
                        <div class="team away-team">
                            <input type="number" 
                                   class="score-input away-score" 
                                   min="0" 
                                   max="20" 
                                   placeholder="0"
                                   value="${simResult ? simResult.awayScore : ''}"
                                   data-match-id="${match.id}"
                                   data-team="away">
                            <span class="team-name">${awayTeamName}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        console.log('📄 Sätter HTML för matcher, längd:', matchesHTML.length);
        matchesContainer.innerHTML = matchesHTML;
        console.log('✅ Matcher HTML uppsatt');
    }

    setupEventListeners() {
        // Lyssna på ändringar i resultat-inputs
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('score-input')) {
                this.handleScoreInput(e.target);
            }
        });

        // Reset-knapp
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSimulation());
        }
    }

    handleScoreInput(input) {
        const matchId = input.dataset.matchId;
        const team = input.dataset.team;
        const score = parseInt(input.value) || 0;

        // Hämta eller skapa simulerat resultat för denna match
        let result = this.simulatedResults.get(matchId) || { homeScore: null, awayScore: null };
        
        if (team === 'home') {
            result.homeScore = score;
        } else {
            result.awayScore = score;
        }

        this.simulatedResults.set(matchId, result);

        // Uppdatera statistik om båda resultat finns
        if (result.homeScore !== null && result.awayScore !== null) {
            this.updateTeamStats(matchId, result.homeScore, result.awayScore);
            this.renderTable(); // Uppdatera tabellen
        }
    }

    updateTeamStats(matchId, homeScore, awayScore) {
        const match = this.matches.find(m => m.id === matchId);
        if (!match) return;

        // Hitta lag-statistik
        const homeStats = this.teamStats.find(s => s.teamId === match.homeTeamId);
        const awayStats = this.teamStats.find(s => s.teamId === match.awayTeamId);

        if (!homeStats || !awayStats) return;

        // Återställ till ursprunglig statistik först
        const originalHome = this.originalStats.get(match.homeTeamId);
        const originalAway = this.originalStats.get(match.awayTeamId);

        if (originalHome) {
            Object.assign(homeStats, { ...originalHome });
        }
        if (originalAway) {
            Object.assign(awayStats, { ...originalAway });
        }

        // Lägg till alla simulerade resultat
        this.simulatedResults.forEach((result, simMatchId) => {
            if (result.homeScore !== null && result.awayScore !== null) {
                const simMatch = this.matches.find(m => m.id === simMatchId);
                if (!simMatch) return;

                const simHomeStats = this.teamStats.find(s => s.teamId === simMatch.homeTeamId);
                const simAwayStats = this.teamStats.find(s => s.teamId === simMatch.awayTeamId);

                if (!simHomeStats || !simAwayStats) return;

                // Uppdatera statistik baserat på resultatet
                simHomeStats.GP = (simHomeStats.GP || 0) + 1;
                simAwayStats.GP = (simAwayStats.GP || 0) + 1;
                
                simHomeStats.GF = (simHomeStats.GF || 0) + result.homeScore;
                simHomeStats.GA = (simHomeStats.GA || 0) + result.awayScore;
                simAwayStats.GF = (simAwayStats.GF || 0) + result.awayScore;
                simAwayStats.GA = (simAwayStats.GA || 0) + result.homeScore;

                if (result.homeScore > result.awayScore) {
                    // Hemmaseger
                    simHomeStats.W = (simHomeStats.W || 0) + 1;
                    simHomeStats.P = (simHomeStats.P || 0) + 3;
                    simAwayStats.L = (simAwayStats.L || 0) + 1;
                } else if (result.awayScore > result.homeScore) {
                    // Bortaseger
                    simAwayStats.W = (simAwayStats.W || 0) + 1;
                    simAwayStats.P = (simAwayStats.P || 0) + 3;
                    simHomeStats.L = (simHomeStats.L || 0) + 1;
                } else {
                    // Oavgjort (overtime loss för båda i detta fall)
                    simHomeStats.OTL = (simHomeStats.OTL || 0) + 1;
                    simHomeStats.P = (simHomeStats.P || 0) + 1;
                    simAwayStats.OTL = (simAwayStats.OTL || 0) + 1;
                    simAwayStats.P = (simAwayStats.P || 0) + 1;
                }
            }
        });
    }

    resetSimulation() {
        // Töm simulerade resultat
        this.simulatedResults.clear();
        
        // Återställ till ursprunglig statistik
        this.teamStats.forEach(stat => {
            const original = this.originalStats.get(stat.teamId);
            if (original) {
                Object.assign(stat, { ...original });
            }
        });

        // Uppdatera visningen
        this.renderTable();
        this.renderMatches();
        
        console.log('🔄 Simulation återställd');
    }

    formatDate(dateString) {
        try {
            if (!dateString) return 'Inget datum';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('sv-SE');
        } catch (error) {
            console.warn('Datum-formaterings-fel:', error, dateString);
            return dateString || 'Okänt datum';
        }
    }

    showError(message) {
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="error-message">
                    ❌ <strong>Fel:</strong> ${message}
                </div>
            `;
            errorContainer.style.display = 'block';
        } else {
            alert('Fel: ' + message);
        }
    }
}

// Starta simulatorn när sidan laddas
document.addEventListener('DOMContentLoaded', () => {
    window.shlSimulator = new SHLSimulator();
});
