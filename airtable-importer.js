/**
 * SHL Airtable Data Importer
 * Importerar matchdata till Airtable och kopplar till befintliga lag
 */

// Konfigurations-objekt (kommer att laddas från .env fil)
let config = {
    apiKey: '',
    baseId: '',
    teamsTable: 'Teams',
    matchesTable: 'Matches',
    teamStatsTable: 'Team_Stats'
};

// Lagnamn-mappning för att säkerställa korrekt koppling
const teamNameMapping = {
    'Färjestad BK': 'Färjestad BK',
    'Frölunda HC': 'Frölunda HC', 
    'Växjö Lakers': 'Växjö Lakers',
    'Luleå Hockey': 'Luleå Hockey',
    'Djurgårdens IF': 'Djurgårdens IF',
    'Skellefteå AIK': 'Skellefteå AIK',
    'HV71': 'HV71',
    'Rögle BK': 'Rögle BK',
    'Leksands IF': 'Leksands IF',
    'Linköping HC': 'Linköping HC',
    'Malmö Redhawks': 'Malmö Redhawks',
    'Brynäs IF': 'Brynäs IF',
    'Timrå IK': 'Timrå IK',
    'Örebro Hockey': 'Örebro Hockey'
};

/**
 * Läser konfiguration från .env fil
 */
async function loadConfig() {
    try {
        const response = await fetch('.env');
        const text = await response.text();
        
        text.split('\n').forEach(line => {
            if (line.startsWith('#') || !line.includes('=')) return;
            
            const [key, value] = line.split('=');
            switch(key.trim()) {
                case 'AIRTABLE_API_KEY':
                    config.apiKey = value.trim();
                    break;
                case 'AIRTABLE_BASE_ID':
                    config.baseId = value.trim();
                    break;
                case 'TEAMS_TABLE':
                    config.teamsTable = value.trim();
                    break;
                case 'MATCHES_TABLE':
                    config.matchesTable = value.trim();
                    break;
                case 'TEAM_STATS_TABLE':
                    config.teamStatsTable = value.trim();
                    break;
            }
        });
        
        console.log('Konfiguration laddad:', {
            baseId: config.baseId,
            teamsTable: config.teamsTable,
            matchesTable: config.matchesTable
        });
        
    } catch (error) {
        console.error('Fel vid laddning av konfiguration:', error);
        throw new Error('Kunde inte ladda .env konfiguration');
    }
}

/**
 * Gör API-anrop till Airtable
 */
async function airtableRequest(endpoint, method = 'GET', data = null) {
    const url = `https://api.airtable.com/v0/${config.baseId}/${endpoint}`;
    
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    console.log(`API Request: ${method} ${url}`);
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Airtable API Error:', response.status, errorText);
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
}

/**
 * Hämtar alla lag från Airtable Teams-tabellen
 */
async function fetchTeams() {
    console.log('Hämtar lag från Airtable...');
    
    try {
        const response = await airtableRequest(config.teamsTable);
        const teams = {};
        
        response.records.forEach(record => {
            const teamName = record.fields.team_name || record.fields.name;
            if (teamName) {
                teams[teamName] = record.id;
                console.log(`Lag hittad: ${teamName} (ID: ${record.id})`);
            }
        });
        
        console.log(`Totalt ${Object.keys(teams).length} lag hämtade från Airtable`);
        return teams;
        
    } catch (error) {
        console.error('Fel vid hämtning av lag:', error);
        throw error;
    }
}

/**
 * Läser matchdata från CSV-fil
 */
async function loadMatchesFromCSV() {
    console.log('Läser matchdata från matches.csv...');
    
    try {
        const response = await fetch('matches.csv');
        const csvText = await response.text();
        
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        const matches = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const match = {};
            
            headers.forEach((header, index) => {
                match[header.trim()] = values[index] ? values[index].trim() : '';
            });
            
            matches.push(match);
        }
        
        console.log(`${matches.length} matcher laddade från CSV`);
        return matches;
        
    } catch (error) {
        console.error('Fel vid läsning av CSV:', error);
        throw error;
    }
}

/**
 * Konverterar matchdata till Airtable-format
 */
function convertMatchForAirtable(match, teams) {
    const homeTeamId = teams[match.home_team];
    const awayTeamId = teams[match.away_team];
    
    if (!homeTeamId || !awayTeamId) {
        console.warn(`Varning: Kunde inte hitta lag för match ${match.match_id}:`, 
                    `${match.home_team} (${homeTeamId}) vs ${match.away_team} (${awayTeamId})`);
        return null;
    }
    
    const airtableMatch = {
        fields: {
            match_id: match.match_id,
            date: match.date,
            time: match.time,
            home_team: [homeTeamId], // Array för länkade records
            away_team: [awayTeamId], // Array för länkade records
            arena: match.arena,
            status: match.status || 'Scheduled',
            round: parseInt(match.round) || 1,
            season: match.season || '2024-2025'
        }
    };
    
    // Lägg till mål om de finns
    if (match.home_goals && match.home_goals !== '') {
        airtableMatch.fields.home_goals = parseInt(match.home_goals);
    }
    if (match.away_goals && match.away_goals !== '') {
        airtableMatch.fields.away_goals = parseInt(match.away_goals);
    }
    
    return airtableMatch;
}

/**
 * Importerar matcher till Airtable i batches
 */
async function importMatches(matches, teams) {
    console.log('Importerar matcher till Airtable...');
    
    const batchSize = 10; // Airtable tillåter max 10 records per batch
    let imported = 0;
    let errors = 0;
    
    for (let i = 0; i < matches.length; i += batchSize) {
        const batch = matches.slice(i, i + batchSize);
        const airtableRecords = [];
        
        // Konvertera batch till Airtable-format
        for (const match of batch) {
            const airtableMatch = convertMatchForAirtable(match, teams);
            if (airtableMatch) {
                airtableRecords.push(airtableMatch);
            } else {
                errors++;
            }
        }
        
        if (airtableRecords.length === 0) {
            continue;
        }
        
        try {
            console.log(`Importerar batch ${Math.floor(i/batchSize) + 1}, ${airtableRecords.length} matcher...`);
            
            const response = await airtableRequest(config.matchesTable, 'POST', {
                records: airtableRecords
            });
            
            imported += response.records.length;
            console.log(`✓ Batch importerad: ${response.records.length} matcher`);
            
            // Vänta lite mellan batches för att inte överbelasta API:et
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } catch (error) {
            console.error(`Fel vid import av batch ${Math.floor(i/batchSize) + 1}:`, error);
            errors += airtableRecords.length;
        }
    }
    
    return { imported, errors };
}

/**
 * Kontrollerar om matcher redan finns i Airtable
 */
async function checkExistingMatches() {
    console.log('Kontrollerar befintliga matcher i Airtable...');
    
    try {
        const response = await airtableRequest(config.matchesTable);
        const existingMatches = new Set();
        
        response.records.forEach(record => {
            if (record.fields.match_id) {
                existingMatches.add(record.fields.match_id);
            }
        });
        
        console.log(`${existingMatches.size} matcher finns redan i Airtable`);
        return existingMatches;
        
    } catch (error) {
        console.error('Fel vid kontroll av befintliga matcher:', error);
        return new Set(); // Returnera tom set om det blir fel
    }
}

/**
 * Huvudfunktion för import
 */
async function importSHLMatches() {
    const startTime = new Date();
    console.log('🏒 SHL Matchimport startar...', startTime.toLocaleString());
    
    try {
        // 1. Ladda konfiguration
        await loadConfig();
        
        if (!config.apiKey || !config.baseId) {
            throw new Error('API-nyckel eller Base-ID saknas i .env filen');
        }
        
        // 2. Hämta lag från Airtable
        const teams = await fetchTeams();
        
        if (Object.keys(teams).length === 0) {
            throw new Error('Inga lag hittades i Airtable. Kontrollera att Teams-tabellen innehåller data.');
        }
        
        // 3. Ladda matchdata från CSV
        const csvMatches = await loadMatchesFromCSV();
        
        // 4. Kontrollera befintliga matcher
        const existingMatches = await checkExistingMatches();
        
        // 5. Filtrera bort matcher som redan finns
        const newMatches = csvMatches.filter(match => !existingMatches.has(match.match_id));
        
        console.log(`${csvMatches.length} matcher i CSV, ${existingMatches.size} finns redan, ${newMatches.length} nya att importera`);
        
        if (newMatches.length === 0) {
            console.log('✓ Alla matcher är redan importerade!');
            return;
        }
        
        // 6. Importera nya matcher
        const result = await importMatches(newMatches, teams);
        
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log('🎉 Import slutförd!');
        console.log(`✓ ${result.imported} matcher importerade`);
        console.log(`⚠️  ${result.errors} fel/varningar`);
        console.log(`⏱️  Tid: ${duration} sekunder`);
        
        return result;
        
    } catch (error) {
        console.error('❌ Import misslyckades:', error);
        throw error;
    }
}

/**
 * Testfunktion för att verifiera Airtable-anslutning
 */
async function testAirtableConnection() {
    console.log('🧪 Testar Airtable-anslutning...');
    
    try {
        await loadConfig();
        
        // Testa att hämta första recordet från Teams
        const response = await airtableRequest(`${config.teamsTable}?maxRecords=1`);
        
        console.log('✓ Airtable-anslutning fungerar!');
        console.log('📊 Base ID:', config.baseId);
        console.log('📋 Teams tabell:', response.records.length > 0 ? 'OK' : 'Tom');
        
        return true;
        
    } catch (error) {
        console.error('❌ Airtable-anslutning misslyckades:', error);
        return false;
    }
}

// Exportera funktioner för användning
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        importSHLMatches,
        testAirtableConnection,
        loadConfig
    };
} else {
    // Browser environment - gör funktioner globalt tillgängliga
    window.SHLImporter = {
        importSHLMatches,
        testAirtableConnection,
        loadConfig
    };
}