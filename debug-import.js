/**
 * Debug-funktion för att diagnostisera import-problem
 */
async function debugImportIssues() {
    console.log('🔍 Startar debug-analys...');
    
    try {
        // 1. Ladda konfiguration
        await window.SHLImporter.loadConfig();
        console.log('✅ Konfiguration laddad');
        
        // 2. Hämta lag från Airtable
        console.log('🏒 Hämtar lag från Airtable...');
        const teams = await window.SHLImporter.fetchTeams();
        console.log('📊 Teams från Airtable:', Object.keys(teams));
        
        // 3. Ladda några matcher från CSV
        console.log('📋 Läser matchdata från CSV...');
        const matches = await window.SHLImporter.loadMatchesFromCSV();
        const firstMatch = matches[0];
        console.log('📋 Första matchen från CSV:', firstMatch);
        
        // 4. Testa lagnamn-mappning
        const teamNameMapping = {
            'Färjestad BK': 'Färjestad BK',
            'Frölunda HC': 'Frölunda HC', 
            'Växjö Lakers': 'Växjö Lakers',
            'Luleå Hockey': 'Luleå HF',
            'Djurgårdens IF': 'Djurgården IF',
            'Skellefteå AIK': 'Skellefteå AIK',
            'HV71': 'HV71',
            'Rögle BK': 'Rögle BK',
            'Leksands IF': 'Leksands IF',
            'Linköping HC': 'Linköping HC',
            'Malmö Redhawks': 'Malmö Redhawks',
            'Brynäs IF': 'Brynäs IF',
            'Timrå IK': 'Timrå',
            'Örebro Hockey': 'Örebro HK'
        };
        
        // Testa mappningen för första matchen
        const homeTeamCSV = firstMatch.home_team;
        const awayTeamCSV = firstMatch.away_team;
        const homeTeamMapped = teamNameMapping[homeTeamCSV] || homeTeamCSV;
        const awayTeamMapped = teamNameMapping[awayTeamCSV] || awayTeamCSV;
        
        console.log('🏒 Mappning test:');
        console.log(`  ${homeTeamCSV} → ${homeTeamMapped} (finns: ${!!teams[homeTeamMapped]})`);
        console.log(`  ${awayTeamCSV} → ${awayTeamMapped} (finns: ${!!teams[awayTeamMapped]})`);
        
        // 5. Kontrollera alla unika lagnamn i CSV
        const csvTeams = new Set();
        matches.forEach(match => {
            csvTeams.add(match.home_team);
            csvTeams.add(match.away_team);
        });
        
        console.log('📋 Alla lag i CSV:', Array.from(csvTeams).sort());
        
        // 6. Kontrollera vilka som saknas
        const missingTeams = [];
        csvTeams.forEach(csvTeam => {
            const mappedTeam = teamNameMapping[csvTeam] || csvTeam;
            if (!teams[mappedTeam]) {
                missingTeams.push({
                    csv: csvTeam,
                    mapped: mappedTeam,
                    available: Object.keys(teams)
                });
            }
        });
        
        if (missingTeams.length > 0) {
            console.error('❌ Saknade lag:', missingTeams);
        } else {
            console.log('✅ Alla lag kan mappas korrekt!');
        }
        
        // 7. Testa att konvertera första matchen EXAKT som import-funktionen gör
        console.log('🧪 Testar konvertering av första matchen...');
        
        const testMatch = firstMatch;
        const homeTeamAirtableName = teamNameMapping[testMatch.home_team] || testMatch.home_team;
        const awayTeamAirtableName = teamNameMapping[testMatch.away_team] || testMatch.away_team;
        
        const homeTeamId = teams[homeTeamAirtableName];
        const awayTeamId = teams[awayTeamAirtableName];
        
        console.log('🔍 Konverteringstest:', {
            matchId: testMatch.match_id,
            homeTeam: {
                csv: testMatch.home_team,
                mapped: homeTeamAirtableName,
                id: homeTeamId,
                exists: !!homeTeamId
            },
            awayTeam: {
                csv: testMatch.away_team,
                mapped: awayTeamAirtableName, 
                id: awayTeamId,
                exists: !!awayTeamId
            }
        });
        
        // 8. Testa att skapa Airtable-record format
        if (homeTeamId && awayTeamId) {
            const airtableMatch = {
                fields: {
                    match_id: testMatch.match_id,
                    date: testMatch.date,
                    time: testMatch.time,
                    home_team: [homeTeamId],
                    away_team: [awayTeamId],
                    arena: testMatch.arena,
                    status: testMatch.status || 'Scheduled',
                    round: parseInt(testMatch.round) || 1,
                    season: testMatch.season || '2024-2025'
                }
            };
            
            console.log('📝 Airtable record format:', airtableMatch);
            console.log('✅ Record-format ser korrekt ut!');
        } else {
            console.error('❌ Kunde inte skapa record - saknar team IDs');
        }
        
        return {
            teamsFromAirtable: teams,
            teamsFromCSV: Array.from(csvTeams),
            missingTeams: missingTeams,
            firstMatch: firstMatch,
            conversionTest: {
                homeTeamId,
                awayTeamId,
                canConvert: !!(homeTeamId && awayTeamId)
            }
        };
        
    } catch (error) {
        console.error('❌ Debug-fel:', error);
        throw error;
    }
}

/**
 * Testar att faktiskt skapa en match i Airtable
 */
async function testSingleMatchImport() {
    console.log('🧪 Testar att importera EN match...');
    
    try {
        await window.SHLImporter.loadConfig();
        const teams = await window.SHLImporter.fetchTeams();
        const matches = await window.SHLImporter.loadMatchesFromCSV();
        
        const testMatch = matches[0]; // Första matchen
        
        // Samma mappning som i huvudfunktionen
        const teamNameMapping = {
            'Färjestad BK': 'Färjestad BK',
            'Frölunda HC': 'Frölunda HC', 
            'Växjö Lakers': 'Växjö Lakers',
            'Luleå Hockey': 'Luleå HF',
            'Djurgårdens IF': 'Djurgården IF',
            'Skellefteå AIK': 'Skellefteå AIK',
            'HV71': 'HV71',
            'Rögle BK': 'Rögle BK',
            'Leksands IF': 'Leksands IF',
            'Linköping HC': 'Linköping HC',
            'Malmö Redhawks': 'Malmö Redhawks',
            'Brynäs IF': 'Brynäs IF',
            'Timrå IK': 'Timrå',
            'Örebro Hockey': 'Örebro HK'
        };
        
        const homeTeamAirtableName = teamNameMapping[testMatch.home_team] || testMatch.home_team;
        const awayTeamAirtableName = teamNameMapping[testMatch.away_team] || testMatch.away_team;
        
        const homeTeamId = teams[homeTeamAirtableName];
        const awayTeamId = teams[awayTeamAirtableName];
        
        if (!homeTeamId || !awayTeamId) {
            console.error('❌ Kan inte testa - saknar team IDs');
            return false;
        }
        
        const airtableMatch = {
            fields: {
                // match_id removed - det är ett computed field i Airtable
                date: testMatch.date,
                time: testMatch.time,
                home_team: [homeTeamId],
                away_team: [awayTeamId],
                arena: testMatch.arena,
                status: 'Scheduled',
                round: parseInt(testMatch.round) || 1,
                season: testMatch.season || '2024-2025'
            }
        };
        
        console.log('📤 Skickar test-match till Airtable:', airtableMatch);
        
        const response = await window.SHLImporter.airtableRequest(
            window.SHLImporter.config.matchesTable, 
            'POST', 
            { records: [airtableMatch] }
        );
        
        console.log('✅ TEST LYCKADES! Match skapad:', response);
        return true;
        
    } catch (error) {
        console.error('❌ TEST MISSLYCKADES:', error);
        return false;
    }
}

// Gör funktionerna tillgängliga globalt
window.debugImportIssues = debugImportIssues;
window.testSingleMatchImport = testSingleMatchImport;