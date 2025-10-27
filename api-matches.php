<?php
// API endpoint för att hämta ALL matcher från Airtable Matches-tabell
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
        if (strpos(trim($line), '#') === 0) continue;
        
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $envVars[trim($key)] = trim($value);
        }
    }
    
    $apiKey = $envVars['AIRTABLE_API_KEY'] ?? '';
    $baseId = $envVars['AIRTABLE_BASE_ID'] ?? '';
    
    if (empty($apiKey) || empty($baseId)) {
        throw new Exception('Airtable konfiguration saknas');
    }
    
    // Hämta alla matcher med paginering
    $allRecords = [];
    $offset = '';
    
    do {
        $url = "https://api.airtable.com/v0/{$baseId}/Matches?sort%5B0%5D%5Bfield%5D=match_date&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=100";
        if ($offset) {
            $url .= "&offset=" . urlencode($offset);
        }
        
        $context = stream_context_create([
            'http' => [
                'header' => "Authorization: Bearer {$apiKey}\r\n"
            ]
        ]);
        
        $response = file_get_contents($url, false, $context);
        if ($response === false) {
            throw new Exception('Kunde inte hämta data från Airtable');
        }
        
        $data = json_decode($response, true);
        if (!$data) {
            throw new Exception('Ogiltig JSON från Airtable');
        }
        
        $allRecords = array_merge($allRecords, $data['records'] ?? []);
        $offset = $data['offset'] ?? '';
        
    } while ($offset);
    
    echo json_encode([
        'success' => true,
        'data' => $allRecords,
        'total' => count($allRecords)
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => $e->getMessage()
    ]);
}
?>