<?php
/**
 * Database Connection Configuration
 * Uppdatera med dina DirectAdmin database credentials
 */

class Database {
    private $host = 'localhost';
    private $db_name = 'shl_simulator';  // ÄNDRA: Din databas från DirectAdmin
    private $username = 'your_username'; // ÄNDRA: Ditt databasanvändarnamn
    private $password = 'your_password'; // ÄNDRA: Ditt databaslösenord
    private $conn;

    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4",
                $this->username,
                $this->password,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch(PDOException $exception) {
            error_log("Connection error: " . $exception->getMessage());
            throw new Exception("Database connection failed");
        }

        return $this->conn;
    }
}

/**
 * Response helper functions
 */
function sendJsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function sendError($message, $status = 400) {
    sendJsonResponse(['error' => $message, 'success' => false], $status);
}

function sendSuccess($data = [], $message = null) {
    $response = ['success' => true];
    if ($message) $response['message'] = $message;
    if (!empty($data)) $response = array_merge($response, $data);
    sendJsonResponse($response);
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    sendJsonResponse(['status' => 'OK']);
}
?>