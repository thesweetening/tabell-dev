<?php
/**
 * Reset Matches API Endpoint
 * Återställer alla matcher och tabellstatistik
 */

require_once 'config.php';

// Endast POST requests tillåtna
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError("Endast POST requests tillåtna", 405);
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Börja transaktion
    $db->beginTransaction();
    
    // Återställ alla matcher
    $reset_matches = "
        UPDATE matches 
        SET home_score = NULL, 
            away_score = NULL, 
            match_type = 'regular',
            is_completed = 0,
            completed_at = NULL
    ";
    $stmt1 = $db->prepare($reset_matches);
    $stmt1->execute();
    
    // Återställ all statistik
    $reset_stats = "
        UPDATE team_stats 
        SET games_played = 0,
            wins = 0, 
            ot_wins = 0, 
            ot_losses = 0, 
            losses = 0,
            goals_for = 0, 
            goals_against = 0, 
            points = 0
    ";
    $stmt2 = $db->prepare($reset_stats);
    $stmt2->execute();
    
    // Commit transaktion
    $db->commit();
    
    $matches_reset = $stmt1->rowCount();
    
    sendSuccess([
        'matches_reset' => $matches_reset
    ], 'Alla matcher återställda');
    
} catch (Exception $e) {
    // Rollback vid fel
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    
    error_log("Reset Matches Error: " . $e->getMessage());
    sendError("Fel vid återställning: " . $e->getMessage(), 500);
}
?>