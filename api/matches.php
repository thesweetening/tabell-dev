<?php
/**
 * Matches API Endpoint
 * Returnerar alla matcher med aktuella resultat
 */

require_once 'config.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Hämta alla matcher med lagnamn
    $query = "
        SELECT 
            m.id,
            m.round,
            m.match_date,
            m.home_score,
            m.away_score,
            m.match_type,
            m.is_completed,
            ht.name as home_team,
            ht.short_name as home_team_short,
            at.name as away_team,
            at.short_name as away_team_short
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        ORDER BY m.round, m.match_date, m.id
    ";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $matches = $stmt->fetchAll();
    
    sendSuccess(['matches' => $matches]);
    
} catch (Exception $e) {
    error_log("Matches API Error: " . $e->getMessage());
    sendError("Fel vid hämtning av matcher: " . $e->getMessage(), 500);
}
?>