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
            console.log('🔍 DEBUG: Startar laddning av Teams...');
            await this.loadTeamsData();
            console.log('🔍 DEBUG: Startar laddning av Team_Stats...');
            await this.loadTeamStatsData();
            console.log('🔍 DEBUG: Startar laddning av Matches...');
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
        
        // Försök PHP-fallback först
        if (endpoint === 'matches') {
            try {
                console.log('🔄 Försöker PHP-fallback för matches...');
                const response = await fetch('api-matches.php');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        console.log(`✅ PHP-fallback: ${data.total} matcher hämtade`);
                        return { data: data.data };
                    }
                }
            } catch (error) {
                console.log('⚠️ PHP-fallback misslyckades, försöker direktaccess');
            }
        }
        
        // Om vi har giltig localStorage-config, försök direktaccess med paginering
        if (this.CONFIG?.airtable?.apiKey && this.CONFIG?.airtable?.baseId) {
            const table = this.getTableForEndpoint(endpoint);
            
            try {
                // För matches, hämta alla med paginering
                if (endpoint === 'matches') {
                    let allRecords = [];
                    let offset = '';
                    
                    do {
                        const url = `https://api.airtable.com/v0/${this.CONFIG.airtable.baseId}/${table}?sort%5B0%5D%5Bfield%5D=match_date&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=100${offset ? '&offset=' + offset : ''}`;
                        
                        const response = await fetch(url, {
                            headers: {
                                'Authorization': `Bearer ${this.CONFIG.airtable.apiKey}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Airtable API fel: ${response.status}`);
                        }
                        
                        const data = await response.json();
                        allRecords = allRecords.concat(data.records);
                        offset = data.offset;
                        
                        console.log(`📄 Batch: ${allRecords.length} matcher hämtade så långt...`);
                    } while (offset);
                    
                    console.log(`✅ Direktaccess: Totalt ${allRecords.length} matcher`);
                    return { data: allRecords };
                } else {
                    // För andra endpoints, vanlig single request
                    const url = `https://api.airtable.com/v0/${this.CONFIG.airtable.baseId}/${table}`;
                    
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
                }
                
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
            console.log('🔍 DEBUG: Team_Stats API response:', response);
            
            // Debug: Skriv ut första posten för att se vad vi får från Airtable
            if (response.data.length > 0) {
                console.log('🔍 Debug - Första Team_Stats post från Airtable:', response.data[0]);
                console.log('🔍 Debug - Fält i första posten:', response.data[0].fields);
            }

            this.teamStats = response.data.map(record => {
                console.log('🔍 Mapping record:', record.id, 'fields:', Object.keys(record.fields));
                return {
                    id: record.id,
                    teamId: Array.isArray(record.fields.Teams) ? record.fields.Teams[0] : record.fields.Teams,
                    // Använd bracket notation för ALLA fält för konsistens
                    games: record.fields["games"],
                    wins: record.fields["wins"],
                    overtime_wins: record.fields["overtime_wins"],
                    losses: record.fields["losses"],
                    overtime_losses: record.fields["overtime_losses"],
                    goals_for: record.fields["goals_for"],
                    goals_against: record.fields["goals_against"],
                    goal_difference: record.fields["goal_difference"],
                    points: record.fields["points"],
                    season: record.fields["season"],
                    ...record.fields
                };
            });

            // Debug: Hitta och logga Frölundas specifika rådata
            const frolandaRaw = response.data.find(record => {
                return record.fields['name (from Teams)'] && record.fields['name (from Teams)'][0] === 'Frölunda HC';
            });
            if (frolandaRaw) {
                console.log('🔍 Debug - Frölunda RAW data från Airtable:', frolandaRaw);
                console.log('🔍 Debug - Frölunda fields:', frolandaRaw.fields);
            }

            // Debug: Skriv ut mappade data för Frölunda
            const frolandaStats = this.teamStats.find(stat => {
                const team = this.teams.find(t => t.id === stat.teamId);
                return team && team.name && team.name.includes('Frölunda');
            });
            if (frolandaStats) {
                console.log('🔍 Debug - Frölunda mappade stats:', frolandaStats);
            }

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
            console.log('📥 Rå matcher-data från Airtable:', response.data?.length, 'records');
            
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

            console.log(`✅ Laddade ${this.matches.length} matcher från Matches-tabell`);
            console.log('🔍 Exempel matcher:', this.matches.slice(0, 3).map(m => ({
                id: m.id,
                date: m.match_date || m.date,
                finished: m.finished,
                teams: `${m.homeTeamId} vs ${m.awayTeamId}`
            })));
        } catch (error) {
            console.error('❌ Fel vid laddning av matcher:', error);
            throw new Error('Kunde inte ladda matcher: ' + error.message);
        }
    }

    renderTable() {
        console.log('🎯 renderTable() ANROPAD - börjar rendera tabell');
        
        const tableContainer = document.getElementById('standings-table');
        if (!tableContainer) {
            console.error('❌ Kunde inte hitta standings-table element');
            return;
        }
        
        console.log('📋 Renderar tabell med', this.teamStats.length, 'lag');
        console.log('Teams:', this.teams.map(t => `${t.id}: ${t.Lag}`));
        console.log('Stats teamIds:', this.teamStats.map(s => s.teamId));

        // Sortera enligt SHL-regler: 1) Poäng 2) Målskillnad 3) Gjorda mål
        const sortedStats = [...this.teamStats].sort((a, b) => {
            // 1. Sortera efter poäng (högst först)
            const pointsDiff = (b.points || 0) - (a.points || 0);
            if (pointsDiff !== 0) return pointsDiff;
            
            // 2. Om lika poäng, sortera efter målskillnad (bäst först)
            const aGoalDiff = a.goal_difference !== undefined ? a.goal_difference : ((a.goals_for || 0) - (a.goals_against || 0));
            const bGoalDiff = b.goal_difference !== undefined ? b.goal_difference : ((b.goals_for || 0) - (b.goals_against || 0));
            if (bGoalDiff !== aGoalDiff) {
                return bGoalDiff - aGoalDiff; // Bättre målskillnad först
            }
            
            // 3. Om även målskillnad är lika, sortera efter gjorda mål (flest först)
            return (b.goals_for || 0) - (a.goals_for || 0); // Fler gjorda mål först
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
                        // Använd formula-fält från Airtable om tillgängligt, annars beräkna
                        const goalDiff = stat.goal_difference !== undefined 
                            ? stat.goal_difference 
                            : (stat.goals_for || 0) - (stat.goals_against || 0);
                        
                        return `
                            <tr style="color: #333 !important; border-bottom: 1px solid #e5e7eb;">
                                <td style="text-align: center; font-weight: bold; color: #333 !important;">${index + 1}</td>
                                <td class="team-name" style="font-weight: bold; color: #dc2626 !important;">${teamName}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.games || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.wins || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.overtime_wins || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.losses || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.overtime_losses || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.goals_for || 0}</td>
                                <td style="text-align: center; color: #333 !important;">${stat.goals_against || 0}</td>
                                <td style="text-align: center; color: ${goalDiff > 0 ? '#2e7d32' : goalDiff < 0 ? '#d32f2f' : '#333'} !important; font-weight: bold;">${goalDiff > 0 ? '+' : ''}${goalDiff}</td>
                                <td style="text-align: center; font-weight: bold; background: #fef2f2; color: #dc2626 !important; border-left: 2px solid #dc2626;">${stat.points || 0}</td>
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

        // Filtrera matcher som inte är färdiga enligt "finished" fältet från Airtable
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Sätt till början av dagen
        
        const upcomingMatches = this.matches
            .filter(match => {
                const matchDateStr = match.match_date || match.date || '';
                const isFinished = match.finished === true || match.finished === 1 || match.finished === "true";
                
                // Debug för 2025-10-28 matcher
                if (matchDateStr.includes('2025-10-28')) {
                    console.log(`🎯 2025-10-28 match debug:`, {
                        id: match.id,
                        date: matchDateStr,
                        finished: match.finished,
                        isFinished: isFinished,
                        homeTeam: match.homeTeamId,
                        awayTeam: match.awayTeamId
                    });
                }
                
                // Använd "finished" från Airtable som är mer tillförlitligt
                if (isFinished) {
                    console.log(`🏁 Match ${match.id} markerad som färdig i Airtable`);
                    return false;
                }
                
                // Filtrera bort gamla matcher (före idag) - men behåll idag och framåt
                const matchDate = new Date(matchDateStr);
                matchDate.setHours(0, 0, 0, 0);
                if (matchDate < today) {
                    console.log(`📅 Gammal match: ${match.id} från ${matchDateStr}`);
                    return false;
                }
                
                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.match_date || a.date || '');
                const dateB = new Date(b.match_date || b.date || '');
                return dateA - dateB; // Sortera från tidigast till senast
            });
        
        console.log(`🏒 Hittade ${upcomingMatches.length} ej färdiga matcher att visa`);
        const matchesByDateDebug = upcomingMatches.reduce((acc, match) => {
            const date = match.match_date || match.date;
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        console.log('📅 Matcher per datum:', matchesByDateDebug);
        
        // Debug specifikt för 28 oktober
        const oct28Matches = upcomingMatches.filter(m => (m.match_date || m.date || '').includes('2025-10-28'));
        console.log(`🎯 Matcher 2025-10-28: ${oct28Matches.length} st`, oct28Matches.map(m => `${m.id}: ${m.homeTeamId} vs ${m.awayTeamId}`));

        if (upcomingMatches.length === 0) {
            matchesContainer.innerHTML = '<p class="no-matches">Inga kommande matcher att simulera.</p>';
            return;
        }

        // Lägg till kontroller för matchvisning
        const matchControlsHTML = `
            <div class="match-controls" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">
                    Antal omgångar att visa:
                    <select id="rounds-limit" style="margin-left: 10px; padding: 5px; border: 1px solid #ddd; border-radius: 4px; color: #333;">
                        <option value="1">1 omgång</option>
                        <option value="3" selected>3 omgångar</option>
                        <option value="5">5 omgångar</option>
                        <option value="all">Alla omgångar</option>
                    </select>
                </label>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">
                    En omgång = alla matcher som spelas samma datum. Fyll i resultat så uppdateras tabellen automatiskt!
                </p>
            </div>
        `;

        // Gruppera matcher efter datum (omgångar)
        const matchesByRound = new Map();
        upcomingMatches.forEach(match => {
            const matchDate = match.match_date || match.date || 'Inget datum';
            if (!matchesByRound.has(matchDate)) {
                matchesByRound.set(matchDate, []);
            }
            matchesByRound.get(matchDate).push(match);
        });

        // Hämta valt antal omgångar att visa
        const roundsLimitSelect = document.getElementById('rounds-limit');
        const roundsLimit = roundsLimitSelect ? roundsLimitSelect.value : '1';
        
        // Konvertera till array av omgångar och begränsa
        const roundsArray = Array.from(matchesByRound.entries());
        const roundsToShow = roundsLimit === 'all' ? roundsArray : roundsArray.slice(0, parseInt(roundsLimit) || 1);
        
        // Generera HTML för matcher med omgång-headers  
        const totalMatches = roundsToShow.reduce((sum, [date, matches]) => sum + matches.length, 0);
        const matchesHTML = roundsToShow.map(([date, matches], index) => {
            const roundNumber = index + 1;
            const roundHeader = '<div class="round-header" style="background: #d32f2f; color: white; padding: 8px 12px; margin: 15px 0 10px 0; border-radius: 6px; font-weight: bold; text-align: center;">📅 Omgång ' + this.formatDate(date) + ' (' + matches.length + ' matcher)</div>';
            
            const matchCards = matches.map(match => {
                const homeTeam = this.teams.find(t => t.id === match.homeTeamId);
                const awayTeam = this.teams.find(t => t.id === match.awayTeamId);
                const homeTeamName = homeTeam ? (homeTeam.name || homeTeam.Lag || homeTeam["name (from Teams)"]) : 'Okänt lag';
                const awayTeamName = awayTeam ? (awayTeam.name || awayTeam.Lag || awayTeam["name (from Teams)"]) : 'Okänt lag';
                const simResult = this.simulatedResults.get(match.id);
                
                return '<div class="match-item" data-match-id="' + match.id + '" style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; color: #333;">' +
                    '<div class="match-teams" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">' +
                        '<div class="team home-team" style="display: flex; align-items: center; flex: 1;">' +
                            '<span class="team-name" style="font-weight: bold; color: #333; margin-right: 6px; min-width: 70px; text-align: right; font-size: 0.85rem;">' + homeTeamName + '</span>' +
                            '<input type="number" class="score-input home-score" min="0" max="20" placeholder="0" value="' + (simResult ? simResult.homeScore : '') + '" data-match-id="' + match.id + '" data-team-type="home" data-team="' + homeTeamName + '" style="width: 50px; padding: 4px; text-align: center; border: 1px solid #ccc; border-radius: 4px; color: #333;">' +
                        '</div>' +
                        '<div class="vs" style="margin: 0 10px; font-weight: bold; color: #666;">-</div>' +
                        '<div class="team away-team" style="display: flex; align-items: center; flex: 1;">' +
                            '<input type="number" class="score-input away-score" min="0" max="20" placeholder="0" value="' + (simResult ? simResult.awayScore : '') + '" data-match-id="' + match.id + '" data-team-type="away" data-team="' + awayTeamName + '" style="width: 50px; padding: 4px; text-align: center; border: 1px solid #ccc; border-radius: 4px; color: #333; margin-right: 8px;">' +
                            '<span class="team-name" style="font-weight: bold; color: #333; min-width: 70px; text-align: left; font-size: 0.85rem;">' + awayTeamName + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="match-options" style="text-align: center;">' +
                        '<select class="result-type" data-match-id="' + match.id + '" style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; color: #333;">' +
                            '<option value="regular">Ordinarie tid</option>' +
                            '<option value="overtime">Övertid</option>' +
                            '<option value="shootout">Straffläggning</option>' +
                        '</select>' +
                    '</div>' +
                '</div>';
            }).join('');
            
            return roundHeader + matchCards;
        }).join('');

        const finalHTML = matchControlsHTML + matchesHTML;
        console.log('📄 Sätter HTML för matcher, längd:', finalHTML.length);
        matchesContainer.innerHTML = finalHTML;
        
        // Lägg till event listener för rounds-limit dropdown
        const roundsSelectElement = document.getElementById('rounds-limit');
        if (roundsSelectElement) {
            roundsSelectElement.addEventListener('change', () => {
                this.renderMatches();
            });
        }
        
        console.log('✅ Matcher HTML uppsatt');
    }

    setupEventListeners() {
        // Lyssna på ändringar i resultat-inputs för auto-uppdatering
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('score-input')) {
                this.handleScoreInput(e.target);
            }
        });

        // Lyssna på ändringar i resultat-typ dropdown
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('result-type')) {
                const matchId = e.target.dataset.matchId;
                this.handleScoreInput(document.querySelector(`[data-match-id="${matchId}"].score-input`));
            }
        });

        // Reset-knapp
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSimulation());
        }
    }

    handleScoreInput(inputElement) {
        if (!inputElement) return;
        
        const matchId = inputElement.dataset.matchId;
        const matchContainer = inputElement.closest('.match-item');
        
        if (!matchContainer) return;

        const homeInput = matchContainer.querySelector('.score-input[data-team-type="home"]');
        const awayInput = matchContainer.querySelector('.score-input[data-team-type="away"]');
        const resultSelect = matchContainer.querySelector('.result-type');
        
        if (!homeInput || !awayInput) return;

        const homeScore = homeInput.value ? parseInt(homeInput.value) : null;
        const awayScore = awayInput.value ? parseInt(awayInput.value) : null;
        
        // Uppdatera om minst ett score är ifyllt
        if (homeScore !== null || awayScore !== null) {
            const resultType = resultSelect ? resultSelect.value : 'regular';
            const homeTeam = homeInput.dataset.team;
            const awayTeam = awayInput.dataset.team;
            
            // Spara simulerat resultat
            this.simulatedResults.set(matchId, {
                homeScore: homeScore,
                awayScore: awayScore,
                resultType: resultType,
                homeTeam: homeTeam,
                awayTeam: awayTeam
            });
            
            // Debug-loggning
            console.log(`🏒 Simulerar: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (${resultType})`);
            console.log(`📊 Före updateTeamStats - antal teamStats:`, this.teamStats.length);
            
            // Uppdatera statistik
            this.updateTeamStats(homeTeam, awayTeam, homeScore || 0, awayScore || 0, resultType);
            
            // Markera matchen som simulerad
            matchContainer.style.backgroundColor = '#f0f8f0';
            matchContainer.style.border = '1px solid #4CAF50';
            
            // Uppdatera tabellen direkt
            console.log('📊 Anropar renderTable efter simulering...');
            this.renderTable();
            console.log('✅ renderTable klar');
        } else {
            // Ta bort simulering om scores rensas
            if (this.simulatedResults.has(matchId)) {
                this.simulatedResults.delete(matchId);
                // Återställ originaldata och rendera om
                this.loadTeamStats().then(() => {
                    // Återapplicera alla aktiva simuleringar
                    for (const [simMatchId, simResult] of this.simulatedResults) {
                        this.updateTeamStats(simResult.homeTeam, simResult.awayTeam, 
                                           simResult.homeScore, simResult.awayScore, simResult.resultType);
                    }
                    this.renderTable();
                });
                
                // Återställ matchens utseende
                matchContainer.style.backgroundColor = '';
                matchContainer.style.border = '';
            }
        }
    }







    updateTeamStats(homeTeam, awayTeam, homeScore, awayScore, resultType) {
        console.log(`🔍 updateTeamStats called with:`, {homeTeam, awayTeam, homeScore, awayScore, resultType});
        
        // Debug alla lagnamn från båda källor
        console.log('📋 Alla lagnamn i teamStats:', this.teamStats.map(t => ({id: t.teamId, name: t.name})));
        console.log('🏒 Söker efter lag:', {homeTeam, awayTeam});
        
        const homeStats = this.teamStats.find(team => team.name === homeTeam);
        const awayStats = this.teamStats.find(team => team.name === awayTeam);
        
        if (!homeStats) {
            console.error('❌ Hemmalag ej hittat:', homeTeam);
            console.error('Tillgängliga lagnamn:', this.teamStats.map(t => t.name));
        }
        if (!awayStats) {
            console.error('❌ Bortalag ej hittat:', awayTeam);  
        }
        
        if (!homeStats || !awayStats) {
            return;
        }
        
        console.log('✅ Hittat båda lagen:', homeStats.name, 'vs', awayStats.name);
        
        // Uppdatera matcher spelade
        homeStats.GP = (homeStats.GP || 0) + 1;
        awayStats.GP = (awayStats.GP || 0) + 1;
        
        // Uppdatera mål - både nya och gamla fält
        homeStats.goals_for = (homeStats.goals_for || 0) + homeScore;
        homeStats.GF = (homeStats.GF || 0) + homeScore; // Behåll för compatibility
        homeStats.goals_against = (homeStats.goals_against || 0) + awayScore;
        homeStats.GA = (homeStats.GA || 0) + awayScore; // Behåll för compatibility
        awayStats.goals_for = (awayStats.goals_for || 0) + awayScore;
        awayStats.GF = (awayStats.GF || 0) + awayScore; // Behåll för compatibility
        awayStats.goals_against = (awayStats.goals_against || 0) + homeScore;
        awayStats.GA = (awayStats.GA || 0) + homeScore; // Behåll för compatibility
        
        // Bestäm vinnare och uppdatera vinster/förluster
        let homeWin = false;
        let awayWin = false;
        
        if (homeScore > awayScore) {
            homeWin = true;
            homeStats.wins = (homeStats.wins || 0) + 1;
            homeStats.W = (homeStats.W || 0) + 1; // Behåll för compatibility
            if (resultType === 'regular') {
                awayStats.losses = (awayStats.losses || 0) + 1;
                awayStats.L = (awayStats.L || 0) + 1; // Behåll för compatibility
            }
        } else if (awayScore > homeScore) {
            awayWin = true;
            awayStats.wins = (awayStats.wins || 0) + 1;
            awayStats.W = (awayStats.W || 0) + 1; // Behåll för compatibility
            if (resultType === 'regular') {
                homeStats.losses = (homeStats.losses || 0) + 1;
                homeStats.L = (homeStats.L || 0) + 1; // Behåll för compatibility
            }
        }
        
        // Hantera poäng baserat på matchtyp
        if (resultType === 'overtime' || resultType === 'shootout') {
            // Förlängning eller straffläggning - förloraren får 1 poäng
            if (homeWin) {
                homeStats.points = (homeStats.points || 0) + 2; // Korrekt fält
                homeStats.P = (homeStats.P || 0) + 2; // Behåll för compatibility
                awayStats.points = (awayStats.points || 0) + 1; // Korrekt fält
                awayStats.P = (awayStats.P || 0) + 1; // Behåll för compatibility
                awayStats.overtime_losses = (awayStats.overtime_losses || 0) + 1; // Korrekt fält
                awayStats.OTL = (awayStats.OTL || 0) + 1; // Behåll för compatibility
                if (resultType === 'overtime') {
                    homeStats.overtime_wins = (homeStats.overtime_wins || 0) + 1;
                }
            } else {
                awayStats.points = (awayStats.points || 0) + 2; // Korrekt fält
                awayStats.P = (awayStats.P || 0) + 2; // Behåll för compatibility
                homeStats.points = (homeStats.points || 0) + 1; // Korrekt fält
                homeStats.P = (homeStats.P || 0) + 1; // Behåll för compatibility
                homeStats.overtime_losses = (homeStats.overtime_losses || 0) + 1; // Korrekt fält
                homeStats.OTL = (homeStats.OTL || 0) + 1; // Behåll för compatibility
                if (resultType === 'overtime') {
                    awayStats.overtime_wins = (awayStats.overtime_wins || 0) + 1;
                }
            }
        } else {
            // Ordinarie tid - SHL-regler: 3 poäng för vinst, 0 för förlust
            if (homeWin) {
                homeStats.points = (homeStats.points || 0) + 3; // Vinst i ordinarie tid = 3p (SHL-regler)
                homeStats.P = (homeStats.P || 0) + 3; // Behåll för compatibility
            } else if (awayWin) {
                awayStats.points = (awayStats.points || 0) + 3; // Vinst i ordinarie tid = 3p (SHL-regler)
                awayStats.P = (awayStats.P || 0) + 3; // Behåll för compatibility
            }
            // Förloraren får 0 poäng i ordinarie tid
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
            errorContainer.innerHTML = '<div class="error-message">❌ <strong>Fel:</strong> ' + message + '</div>';
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
