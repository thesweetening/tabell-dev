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
        
        // Staging/produktion - använder PHP config istället för backend
        if (hostname.includes('tabell.top')) {
            return null; // Använder direktaccess med PHP config
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
            // För staging: försök läsa från PHP config
            if (window.location.hostname.includes('tabell.top')) {
                console.log('🌐 Laddar konfiguration från PHP...');
                const response = await fetch('api-config.php');
                if (response.ok) {
                    this.CONFIG = await response.json();
                    console.log('✅ Konfiguration laddad från server PHP');
                    return;
                }
            }
            
            // För localhost: försök läsa från localStorage (admin-panelen)
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
            <table class="shl-table" style="color: #333 !important;">
                <thead>
                    <tr style="background: #dc2626; color: white;">
                        <th>Pos</th>
                        <th>Lag</th>
                        <th>M</th>
                        <th>V</th>
                        <th>VÖ</th>
                        <th>F</th>
                        <th>FÖ</th>
                        <th>GM</th>
                        <th>IM</th>
                        <th>+/-</th>
                        <th style="font-weight: bold; background: #b91c1c;">Poäng</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedStats.map((stat, index) => {
                        const team = this.teams.find(t => t.id === stat.teamId);
                        const teamName = team ? team.name : `Okänt lag (${stat.teamId})`;
                        const goalDiff = (stat.GF || 0) - (stat.GA || 0);
                        
                        return `
                            <tr style="color: #333 !important; border-bottom: 1px solid #e5e7eb;">
                                <td style="text-align: center; font-weight: bold; color: #333 !important;">${index + 1}</td>
                                <td class="team-name" style="font-weight: bold; color: #dc2626 !important;">${teamName}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.GP || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.W || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${(stat.wins || 0) + (stat.overtime_wins || 0)}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.L || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.OTL || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.GF || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.GA || 0}</td>
                                <td style="text-align: center; color: ${goalDiff > 0 ? '#2e7d32' : goalDiff < 0 ? '#d32f2f' : '#333'} !important; font-weight: bold;">${goalDiff > 0 ? '+' : ''}${goalDiff}</td>
                                <td style="text-align: center; font-weight: bold; background: #fef2f2; color: #dc2626 !important; border-left: 2px solid #dc2626;">${stat.P || 0}</td>
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

        // Lägg till kontroller för matchvisning
        const matchControlsHTML = `
            <div class="match-controls" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">
                    Antal matcher att visa:
                    <select id="matches-limit" style="margin-left: 8px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; color: #333;">
                        <option value="5">5 matcher</option>
                        <option value="10" selected>10 matcher</option>
                        <option value="15">15 matcher</option>
                        <option value="20">20 matcher</option>
                        <option value="all">Alla matcher</option>
                    </select>
                </label>
                <p style="margin: 5px 0; font-size: 14px; color: #666;">
                    Välj resultat-typ (Ordinarie tid/Övertid/Straffläggning) och klicka "Tillämpa" för att uppdatera tabellen.
                </p>
            </div>
        `;

        // Hämta valt antal matcher att visa
        const matchesLimitSelect = document.getElementById('matches-limit');
        const limitValue = matchesLimitSelect ? matchesLimitSelect.value : '10';
        const matchesToShow = limitValue === 'all' ? upcomingMatches : upcomingMatches.slice(0, parseInt(limitValue) || 10);

        const matchesHTML = matchesToShow.map(match => {
            const homeTeam = this.teams.find(t => t.id === match.homeTeamId);
            const awayTeam = this.teams.find(t => t.id === match.awayTeamId);
            
            const homeTeamName = homeTeam ? homeTeam.name : 'Okänt lag';
            const awayTeamName = awayTeam ? awayTeam.name : 'Okänt lag';
            
            const simResult = this.simulatedResults.get(match.id);
            
            return `
                <div class="match-item" data-match-id="${match.id}" style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; color: #333;">
                    <div class="match-date" style="font-size: 12px; color: #666; text-align: center; margin-bottom: 8px;">${this.formatDate(match.date)}</div>
                    <div class="match-teams" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <div class="team home-team" style="display: flex; align-items: center; flex: 1;">
                            <span class="team-name" style="font-weight: bold; color: #333; margin-right: 8px; min-width: 80px; text-align: right;">${homeTeamName}</span>
                            <input type="number" 
                                   class="score-input home-score" 
                                   min="0" 
                                   max="20" 
                                   placeholder="0"
                                   value="${simResult ? simResult.homeScore : ''}"
                                   data-match-id="${match.id}"
                                   data-team-type="home"
                                   data-team="${homeTeamName}"
                                   style="width: 50px; padding: 4px; text-align: center; border: 1px solid #ccc; border-radius: 4px; color: #333;">
                        </div>
                        <div class="vs" style="margin: 0 10px; font-weight: bold; color: #666;">-</div>
                        <div class="team away-team" style="display: flex; align-items: center; flex: 1;">
                            <input type="number" 
                                   class="score-input away-score" 
                                   min="0" 
                                   max="20" 
                                   placeholder="0"
                                   value="${simResult ? simResult.awayScore : ''}"
                                   data-match-id="${match.id}"
                                   data-team-type="away"
                                   data-team="${awayTeamName}"
                                   style="width: 50px; padding: 4px; text-align: center; border: 1px solid #ccc; border-radius: 4px; color: #333; margin-right: 8px;">
                            <span class="team-name" style="font-weight: bold; color: #333; min-width: 80px; text-align: left;">${awayTeamName}</span>
                        </div>
                    </div>
                    <div class="match-options" style="text-align: center;">
                        <select class="result-type" data-match-id="${match.id}" style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; color: #333; margin-right: 8px;">
                            <option value="regular">Ordinarie tid</option>
                            <option value="overtime">Övertid</option>
                            <option value="shootout">Straffläggning</option>
                        </select>
                        <button class="apply-result" data-match-id="${match.id}" 
                                style="padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            Tillämpa
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        const finalHTML = matchControlsHTML + matchesHTML;
        console.log('📄 Sätter HTML för matcher, längd:', finalHTML.length);
        matchesContainer.innerHTML = finalHTML;
        
        // Lägg till event listener för matches-limit dropdown
        const limitSelectElement = document.getElementById('matches-limit');
        if (limitSelectElement) {
            limitSelectElement.addEventListener('change', () => {
                this.renderMatches();
            });
        }
        
        console.log('✅ Matcher HTML uppsatt');
    }

    setupEventListeners() {
        // Lyssna på ändringar i resultat-inputs
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('score-input')) {
                // Auto-update vid input-ändring (behåller gamla funktionaliteten)
                // this.handleScoreInput(e.target);
            }
        });

        // Lyssna på "Tillämpa"-knappar
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('apply-result')) {
                this.applyMatchResult(e.target.dataset.matchId);
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

    applyMatchResult(matchId) {
        console.log('Applying match result for match:', matchId);
        
        const matchContainer = document.querySelector(`[data-match-id="${matchId}"]`).closest('.match-item');
        if (!matchContainer) {
            console.error('Match container not found');
            return;
        }
        
        // Hämta hemmalag och bortalag
        const homeInput = matchContainer.querySelector('.score-input[data-team-type="home"]');
        const awayInput = matchContainer.querySelector('.score-input[data-team-type="away"]');
        const resultSelect = matchContainer.querySelector('.result-type');
        
        if (!homeInput || !awayInput) {
            console.error('Score inputs not found');
            return;
        }
        
        const homeScore = parseInt(homeInput.value) || 0;
        const awayScore = parseInt(awayInput.value) || 0;
        const resultType = resultSelect ? resultSelect.value : 'regular';
        
        if (homeScore === 0 && awayScore === 0) {
            alert('Ange resultat för matchen först');
            return;
        }
        
        const homeTeam = homeInput.dataset.team;
        const awayTeam = awayInput.dataset.team;
        
        console.log(`Applying result: ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} (${resultType})`);
        
        // Uppdatera statistik baserat på resultat
        this.updateTeamStats(homeTeam, awayTeam, homeScore, awayScore, resultType);
        
        // Markera matchen som spelad
        matchContainer.style.backgroundColor = '#f0f8f0';
        matchContainer.style.border = '1px solid #4CAF50';
        
        // Uppdatera tabellen
        this.renderTable();
    }

    updateTeamStats(homeTeam, awayTeam, homeScore, awayScore, resultType) {
        const homeStats = this.teamStats.find(team => team.name === homeTeam);
        const awayStats = this.teamStats.find(team => team.name === awayTeam);
        
        if (!homeStats || !awayStats) {
            console.error('Team stats not found:', homeTeam, awayTeam);
            return;
        }
        
        // Uppdatera matcher spelade
        homeStats.GP = (homeStats.GP || 0) + 1;
        awayStats.GP = (awayStats.GP || 0) + 1;
        
        // Uppdatera mål
        homeStats.GF = (homeStats.GF || 0) + homeScore;
        homeStats.GA = (homeStats.GA || 0) + awayScore;
        awayStats.GF = (awayStats.GF || 0) + awayScore;
        awayStats.GA = (awayStats.GA || 0) + homeScore;
        
        // Bestäm vinnare och uppdatera vinster/förluster
        let homeWin = false;
        let awayWin = false;
        
        if (homeScore > awayScore) {
            homeWin = true;
            homeStats.W = (homeStats.W || 0) + 1;
            if (resultType === 'regular') {
                awayStats.L = (awayStats.L || 0) + 1;
            }
        } else if (awayScore > homeScore) {
            awayWin = true;
            awayStats.W = (awayStats.W || 0) + 1;
            if (resultType === 'regular') {
                homeStats.L = (homeStats.L || 0) + 1;
            }
        }
        
        // Hantera poäng baserat på matchtyp
        if (resultType === 'overtime' || resultType === 'shootout') {
            // Förlängning eller straffläggning - förloraren får 1 poäng
            if (homeWin) {
                homeStats.P = (homeStats.P || 0) + 2; // Vinst i förlängning/straffar = 2p
                awayStats.P = (awayStats.P || 0) + 1; // Förlust i förlängning/straffar = 1p
                awayStats.OTL = (awayStats.OTL || 0) + 1; // Övertidsförlust
            } else {
                awayStats.P = (awayStats.P || 0) + 2;
                homeStats.P = (homeStats.P || 0) + 1;
                homeStats.OTL = (homeStats.OTL || 0) + 1;
            }
        } else {
            // Ordinarie tid - bara vinnaren får poäng
            if (homeWin) {
                homeStats.P = (homeStats.P || 0) + 2;
            } else if (awayWin) {
                awayStats.P = (awayStats.P || 0) + 2;
            }
        }
        
        console.log('Updated stats for:', homeTeam, homeStats);
        console.log('Updated stats for:', awayTeam, awayStats);
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

        // Rensa alla inputs och återställ match-styling
        document.querySelectorAll('.match-item').forEach(matchItem => {
            // Rensa inputs
            matchItem.querySelectorAll('.score-input').forEach(input => {
                input.value = '';
            });
            
            // Återställ result-type dropdown
            const resultSelect = matchItem.querySelector('.result-type');
            if (resultSelect) {
                resultSelect.value = 'regular';
            }
            
            // Återställ styling
            matchItem.style.backgroundColor = '';
            matchItem.style.border = '';
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
