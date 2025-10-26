<?php
// Läser .env-filen och returnerar konfiguration som JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

try {
    $envPath = __DIR__ . '/.env';
    
    if (!file_exists($envPath)) {
        throw new Exception('.env fil hittades inte');
    }
    
    $envVars = [];
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue; // Hoppa över kommentarer
        
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $envVars[trim($key)] = trim($value);
        }
    }
    
    // Returnera bara det som behövs för frontend
    echo json_encode([
        'airtable' => [
            'apiKey' => $envVars['AIRTABLE_API_KEY'] ?? '',
            'baseId' => $envVars['AIRTABLE_BASE_ID'] ?? ''
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>