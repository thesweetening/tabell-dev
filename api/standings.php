<?php
/**
 * Standings API Endpoint
 * Returnerar aktuell tabell baserad på spelade matcher
 */

require_once 'config.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Hämta tabellstatistik med automatiskt beräknade värden
    $query = "
        SELECT 
            ts.*,
            t.name as team_name,
            t.short_name,
            t.city
        FROM team_stats ts
        JOIN teams t ON ts.team_id = t.id
        ORDER BY 
            ts.points DESC, 
            (ts.goals_for - ts.goals_against) DESC,
            ts.goals_for DESC,
            t.name ASC
    ";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $standings = $stmt->fetchAll();
    
    sendSuccess(['standings' => $standings]);
    
} catch (Exception $e) {
    error_log("Standings API Error: " . $e->getMessage());
    sendError("Fel vid hämtning av tabell: " . $e->getMessage(), 500);
}
?>