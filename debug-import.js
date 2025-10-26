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
        
        return {
            teamsFromAirtable: teams,
            teamsFromCSV: Array.from(csvTeams),
            missingTeams: missingTeams,
            firstMatch: firstMatch
        };
        
    } catch (error) {
        console.error('❌ Debug-fel:', error);
        throw error;
    }
}

// Gör funktionen tillgänglig globalt
window.debugImportIssues = debugImportIssues;