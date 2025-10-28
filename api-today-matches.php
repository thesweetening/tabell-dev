<?php
// API endpoint för att hämta dagens matcher via PHP
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
    
    // Dagens datum
    $today = date('Y-m-d');
    
    // Hämta dagens matcher från Airtable
    $filterFormula = "IS_SAME(match_date,'{$today}')";
    $url = "https://api.airtable.com/v0/{$baseId}/Matches?filterByFormula=" . urlencode($filterFormula) . "&sort%5B0%5D%5Bfield%5D=match_time&sort%5B0%5D%5Bdirection%5D=asc";
    
    $context = stream_context_create([
        'http' => [
            'header' => "Authorization: Bearer {$apiKey}\r\n"
        ]
    ]);
    
    $response = file_get_contents($url, false, $context);
    if ($response === false) {
        throw new Exception('Kunde inte hämta matcher från Airtable');
    }
    
    $data = json_decode($response, true);
    if (!$data) {
        throw new Exception('Ogiltig JSON från Airtable');
    }
    
    echo json_encode([
        'success' => true,
        'data' => $data['records'] ?? [],
        'date' => $today,
        'count' => count($data['records'] ?? [])
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>