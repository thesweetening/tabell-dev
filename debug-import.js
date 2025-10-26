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
 * Hämtar en befintlig match från Airtable för att se strukturen
 */
async function testSingleMatchImport() {
    console.log('🔍 Hämtar befintliga matcher för att se fältstrukturen...');
    
    try {
        await window.SHLImporter.loadConfig();
        
        console.log('📥 Hämtar första matchen från Airtable Matches-tabellen...');
        
        const response = await window.SHLImporter.airtableRequest(
            `${window.SHLImporter.config.matchesTable}?maxRecords=1`
        );
        
        if (response.records && response.records.length > 0) {
            const firstMatch = response.records[0];
            console.log('✅ HITTADE BEFINTLIG MATCH:');
            console.log('📊 Record ID:', firstMatch.id);
            console.log('📋 Alla fält i Matches-tabellen:', Object.keys(firstMatch.fields));
            console.log('📝 Fältdata:', JSON.stringify(firstMatch.fields, null, 2));
            
            return true;
        } else {
            console.log('📭 Inga matcher finns i Airtable Matches-tabellen ännu');
            console.log('💡 Det här förklarar varför importen kan ha problem');
            
            // Testa att hämta schema istället
            console.log('🔍 Försöker hämta tabellstruktur...');
            const schemaResponse = await window.SHLImporter.airtableRequest(
                `${window.SHLImporter.config.matchesTable}?maxRecords=0`
            );
            console.log('📋 Tabellsvar (utan records):', schemaResponse);
            
            return false;
        }
        
    } catch (error) {
        console.error('❌ KUNDE INTE HÄMTA MATCHER:', error);
        
        // Om tabellen inte finns eller är tom, visa vad vi vet
        console.log('🤔 Möjliga problem:');
        console.log('  1. Matches-tabellen är helt tom');
        console.log('  2. Fältnamnen är annorlunda än förväntat');
        console.log('  3. Tabellnamnet är fel (borde vara "Matches")');
        console.log('  4. API-behörigheter räcker inte till');
        
        return false;
    }
}

// Gör funktionerna tillgängliga globalt
window.debugImportIssues = debugImportIssues;
window.testSingleMatchImport = testSingleMatchImport;