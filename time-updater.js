/**
 * SHL Time Updater
 * Uppdaterar matchtider från UTC till svensk tid (+1 timme)
 * Uppdaterar i bakvänd ordning för att undvika dubbeluppdateringar
 */

// Tidskonverteringar som ska göras (bakifrån)
const timeUpdates = [
    { from: '18:00', to: '19:00' },  // Först denna
    { from: '17:00', to: '18:00' },  // Sedan denna  
    { from: '14:15', to: '15:15' }   // Sist denna
];

/**
 * Uppdaterar matchtider i Airtable
 */
async function updateMatchTimes() {
    const startTime = new Date();
    console.log('🕐 Startar uppdatering av matchtider...', startTime.toLocaleString());
    
    try {
        // 1. Ladda konfiguration
        await window.SHLImporter.loadConfig();
        
        let totalUpdated = 0;
        
        // 2. Gå igenom varje tidsuppdatering i rätt ordning
        for (let i = 0; i < timeUpdates.length; i++) {
            const update = timeUpdates[i];
            console.log(`🔄 Steg ${i + 1}: Ändrar ${update.from} → ${update.to}`);
            
            // Hämta matcher med denna tid
            const filter = encodeURIComponent(`{match_time} = "${update.from}"`);
            const response = await window.SHLImporter.airtableRequest(
                `${window.SHLImporter.config.matchesTable}?filterByFormula=${filter}`
            );
            
            if (response.records && response.records.length > 0) {
                console.log(`📋 Hittade ${response.records.length} matcher med tid ${update.from}`);
                
                // Uppdatera i batches om 10
                const batchSize = 10;
                let updated = 0;
                
                for (let j = 0; j < response.records.length; j += batchSize) {
                    const batch = response.records.slice(j, j + batchSize);
                    const updateRecords = batch.map(record => ({
                        id: record.id,
                        fields: {
                            match_time: update.to
                        }
                    }));
                    
                    console.log(`📤 Uppdaterar batch ${Math.floor(j/batchSize) + 1}/${Math.ceil(response.records.length/batchSize)}: ${updateRecords.length} matcher`);
                    
                    const updateResponse = await window.SHLImporter.airtableRequest(
                        window.SHLImporter.config.matchesTable,
                        'PATCH',
                        { records: updateRecords }
                    );
                    
                    updated += updateResponse.records.length;
                    console.log(`✅ Uppdaterade ${updateResponse.records.length} matcher`);
                    
                    // Vänta lite mellan batches
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                totalUpdated += updated;
                console.log(`✅ Klar med ${update.from} → ${update.to}: ${updated} matcher uppdaterade`);
                
            } else {
                console.log(`ℹ️ Inga matcher hittades med tid ${update.from}`);
            }
        }
        
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log('🎉 Tidsuppdatering slutförd!');
        console.log(`✅ ${totalUpdated} matcher fick uppdaterad tid`);
        console.log(`⏱️ Tid: ${duration} sekunder`);
        
        return { updated: totalUpdated, duration };
        
    } catch (error) {
        console.error('❌ Tidsuppdatering misslyckades:', error);
        throw error;
    }
}

// Gör funktionen tillgänglig globalt
window.updateMatchTimes = updateMatchTimes;