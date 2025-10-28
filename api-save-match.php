<?php
// API endpoint för att sätta matchresultat via PHP (fallback när backend inte finns)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Only POST method allowed']);
    exit;
}

try {
    // Läs .env filen
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
    
    // Hämta POST data
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    $matchId = $_GET['match_id'] ?? null;
    $homeScore = $input['homeScore'] ?? null;
    $awayScore = $input['awayScore'] ?? null;
    $resultType = $input['resultType'] ?? 'regulation';
    
    if (!$matchId) {
        throw new Exception('Match ID saknas');
    }
    
    if ($homeScore === null || $awayScore === null) {
        throw new Exception('Matchresultat saknas');
    }
    
    if ($homeScore === $awayScore) {
        throw new Exception('Matcher kan inte sluta oavgjort i SHL');
    }
    
    // Uppdatera match i Airtable
    $url = "https://api.airtable.com/v0/{$baseId}/Matches";
    
    $data = [
        'records' => [
            [
                'id' => $matchId,
                'fields' => [
                    'home_goals' => intval($homeScore),
                    'away_goals' => intval($awayScore),
                    'finished' => true,
                    'result_type' => $resultType
                ]
            ]
        ]
    ];
    
    $context = stream_context_create([
        'http' => [
            'method' => 'PATCH',
            'header' => [
                "Authorization: Bearer {$apiKey}",
                "Content-Type: application/json"
            ],
            'content' => json_encode($data)
        ]
    ]);
    
    $response = file_get_contents($url, false, $context);
    if ($response === false) {
        throw new Exception('Kunde inte uppdatera match i Airtable');
    }
    
    $responseData = json_decode($response, true);
    if (!$responseData) {
        throw new Exception('Ogiltig respons från Airtable');
    }
    
    echo json_encode([
        'success' => true,
        'message' => "Matchresultat sparat: {$homeScore}-{$awayScore}",
        'match' => [
            'id' => $matchId,
            'homeScore' => intval($homeScore),
            'awayScore' => intval($awayScore),
            'resultType' => $resultType,
            'finished' => true
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>