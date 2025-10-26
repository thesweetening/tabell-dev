// SHL Simulator JavaScript

class SHLSimulator {
    constructor() {
        this.teams = [];
        this.matches = [];
        this.simulatedResults = new Map(); // matchId -> {homeScore, awayScore}
        this.originalStats = new Map(); // backup av ursprunglig statistik
        
        this.init();
    }

    async init() {
        console.log('🏒 Initierar SHL Simulator...');
        
        try {
            // Först: ladda API-konfiguration
            await this.loadConfig();
            
            // Sedan: ladda data från Airtable
            await this.loadTeamsData();
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
        try {
            // Först: försök läsa från localStorage (admin-panelen)
            const savedApiKey = localStorage.getItem('airtable_api_key');
            const savedBaseId = localStorage.getItem('airtable_base_id');
            
            if (savedApiKey && savedBaseId) {
                AIRTABLE_CONFIG.apiKey = savedApiKey;
                AIRTABLE_CONFIG.baseId = savedBaseId;
                console.log('✅ Konfiguration laddad från localStorage');
                return;
            }

            // Annars: försök läsa från .env fil
            const response = await fetch('.env');
            if (response.ok) {
                const envText = await response.text();
                const lines = envText.split('\n');
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        const [key, value] = trimmedLine.split('=');
                        if (key && value) {
                            if (key.trim() === 'AIRTABLE_API_KEY') {
                                AIRTABLE_CONFIG.apiKey = value.trim();
                            } else if (key.trim() === 'AIRTABLE_BASE_ID') {
                                AIRTABLE_CONFIG.baseId = value.trim();
                            }
                        }
                    }
                }
            }

            // Validera att vi har nödvändiga värden
            if (!AIRTABLE_CONFIG.apiKey || AIRTABLE_CONFIG.apiKey === 'your_personal_access_token_here') {
                throw new Error('⚠️ Airtable API-nyckel saknas! Gå till admin-panelen (airtable-admin.html) för att konfigurera.');
            }
            
            if (!AIRTABLE_CONFIG.baseId || AIRTABLE_CONFIG.baseId === 'your_base_id_here') {
                throw new Error('⚠️ Airtable Base ID saknas! Gå till admin-panelen (airtable-admin.html) för att konfigurera.');
            }

            console.log('✅ Konfiguration laddad från .env fil');
            
        } catch (error) {
            console.error('❌ Fel vid laddning av konfiguration:', error);
            throw error;
        }
    }

    async loadTeamsData() {
        console.log('📊 Laddar lagdata...');
        
        try {
            const response = await fetch(`${AIRTABLE_CONFIG.apiUrl}/${AIRTABLE_CONFIG.baseId}/Team_Stats?sort%5B0%5D%5Bfield%5D=points&sort%5B0%5D%5Bdirection%5D=desc`, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_CONFIG.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('🔑 Ogiltig API-nyckel! Kontrollera din Airtable API-nyckel i admin-panelen.');
                } else if (response.status === 404) {
                    throw new Error('❌ Hittar inte Team_Stats tabellen! Kontrollera Base ID och tabellnamn.');
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }

            const data = await response.json();
            
            if (!data.records || data.records.length === 0) {
                throw new Error('⚠️ Inga lag hittades i Team_Stats tabellen! Har data importerats korrekt?');
            }
            
            this.teams = data.records.map(record => ({
                id: record.id,
                ...record.fields
            }));

            // Backup av ursprunglig statistik
            this.teams.forEach(team => {
                this.originalStats.set(team.id, { ...team });
            });

            console.log(`✅ Laddade ${this.teams.length} lag`);
        } catch (error) {
            console.error('❌ Fel vid laddning av lagdata:', error);
            throw error;
        }
    }

    async loadMatchesData() {
        console.log('🎯 Laddar matchdata...');
        
        try {
            // Hämta kommande matcher (datum framåt)
            const today = new Date().toISOString().split('T')[0];
            
            const response = await fetch(`${AIRTABLE_CONFIG.apiUrl}/${AIRTABLE_CONFIG.baseId}/Matches?filterByFormula=IS_AFTER(match_date%2C'${today}')&sort%5B0%5D%5Bfield%5D=match_date&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=50`, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_CONFIG.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('🔑 Ogiltig API-nyckel för matchdata!');
                } else if (response.status === 404) {
                    throw new Error('❌ Hittar inte Matches tabellen! Kontrollera tabellnamnet.');
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }

            const data = await response.json();
            
            this.matches = data.records.map(record => ({
                id: record.id,
                ...record.fields
            }));

            console.log(`✅ Laddade ${this.matches.length} kommande matcher`);
            
            if (this.matches.length === 0) {
                console.log('ℹ️ Inga kommande matcher hittades. Visar meddelande till användaren.');
            }
            
        } catch (error) {
            console.error('❌ Fel vid laddning av matchdata:', error);
            throw error;
        }
    }

    renderTable() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        // Sortera lag efter poäng
        const sortedTeams = [...this.teams].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if ((b.goals_for - b.goals_against) !== (a.goals_for - a.goals_against)) {
                return (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against);
            }
            return b.goals_for - a.goals_for;
        });

        tbody.innerHTML = sortedTeams.map((team, index) => {
            const position = index + 1;
            let rowClass = '';
            
            // Färgkoda positioner
            if (position <= 6) rowClass = 'playoff';
            else if (position <= 10) rowClass = 'qualification';
            else if (position >= 13) rowClass = 'relegation';

            return `
                <tr class="${rowClass}">
                    <td class="position">${position}</td>
                    <td class="team-name">${team.name || 'Okänt lag'}</td>
                    <td>${team.games_played || 0}</td>
                    <td>${team.wins || 0}</td>
                    <td>${team.overtime_wins || 0}</td>
                    <td>${team.overtime_losses || 0}</td>
                    <td>${team.losses || 0}</td>
                    <td>${(team.goals_for || 0) - (team.goals_against || 0)}</td>
                    <td><strong>${team.points || 0}</strong></td>
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
        this.teams.forEach(team => {
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
        
        const homeTeam = this.teams.find(t => t.id === homeTeamId);
        const awayTeam = this.teams.find(t => t.id === awayTeamId);
        
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
        this.teams.forEach(team => {
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
        this.teams.forEach(team => {
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
            let helpText = '';
            
            if (message.includes('API-nyckel')) {
                helpText = '<br><br>💡 <strong>Lösning:</strong> Gå till <a href="airtable-admin.html" style="color: #dc143c;">admin-panelen</a> för att konfigurera API-nycklar.';
            } else if (message.includes('tabellen')) {
                helpText = '<br><br>💡 <strong>Lösning:</strong> Kontrollera att Airtable-databasen är korrekt uppsatt och att data har importerats.';
            }
            
            container.innerHTML = `
                <div class="error">
                    ❌ ${message}
                    ${helpText}
                </div>
            `;
        }
    }
}

// Starta simulatorn när sidan laddats
document.addEventListener('DOMContentLoaded', () => {
    new SHLSimulator();
});