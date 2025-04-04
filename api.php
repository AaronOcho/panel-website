<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, PUT');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$db_url = "postgresql://neondb_owner:npg_mhU6utZAG3eH@ep-damp-snowflake-a8nmpb59-pooler.eastus2.azure.neon.tech/neondb?sslmode=require";

try {
    $db_params = parse_url($db_url);
    $dsn = sprintf(
        "pgsql:host=%s;port=%s;dbname=%s;user=%s;password=%s;sslmode=require",
        $db_params['host'],
        isset($db_params['port']) ? $db_params['port'] : 5432,
        ltrim($db_params['path'], '/'),
        $db_params['user'],
        $db_params['pass']
    );
    
    $conn = new PDO($dsn);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    if (isset($_GET['key']) && isset($_GET['hwid'])) {
        $key = $_GET['key'];
        $hwid = $_GET['hwid'];
        
        $stmt = $conn->prepare("SELECT * FROM license_keys WHERE key_value = ?");
        $stmt->execute([$key]);
        $keyData = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$keyData) {
            echo json_encode(['valid' => false, 'message' => 'Invalid key']);
            exit;
        }
        
        if ($keyData['hwid'] && $keyData['hwid'] !== $hwid) {
            echo json_encode(['valid' => false, 'message' => 'HWID mismatch']);
            exit;
        }
        
        if (!$keyData['hwid']) {
            $updateStmt = $conn->prepare("UPDATE license_keys SET hwid = ?, activation_date = CURRENT_TIMESTAMP WHERE key_value = ?");
            $updateStmt->execute([$hwid, $key]);
        }
        
        $updateCheckStmt = $conn->prepare("UPDATE license_keys SET last_check = CURRENT_TIMESTAMP WHERE key_value = ?");
        $updateCheckStmt->execute([$key]);
        
        echo json_encode(['valid' => true, 'message' => 'Success']);
        exit;
    }

    if (isset($_GET['reset']) && isset($_GET['key'])) {
        $key = $_GET['key'];
        
        $stmt = $conn->prepare("UPDATE license_keys SET hwid = NULL, activation_date = NULL WHERE key_value = ?");
        $stmt->execute([$key]);
        
        echo json_encode(['success' => true, 'message' => 'Key reset successfully']);
        exit;
    }

    if (isset($_GET['delete']) && isset($_GET['key'])) {
        $key = $_GET['key'];
        
        $stmt = $conn->prepare("DELETE FROM license_keys WHERE key_value = ?");
        $stmt->execute([$key]);
        
        echo json_encode(['success' => true, 'message' => 'Key deleted successfully']);
        exit;
    }

    if (isset($_GET['add']) && isset($_GET['key'])) {
        $key = $_GET['key'];
        $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
        
        $stmt = $conn->prepare("INSERT INTO license_keys (key_value, expires_at) VALUES (?, ?)");
        $stmt->execute([$key, $expires]);
        
        echo json_encode(['success' => true, 'message' => 'Key added successfully']);
        exit;
    }

    if (isset($_GET['list'])) {
        $stmt = $conn->query("SELECT * FROM license_keys ORDER BY created_at DESC");
        $keys = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'keys' => $keys]);
        exit;
    }

    echo json_encode(['error' => 'Invalid request']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error', 'message' => $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => 'Request error', 'message' => $e->getMessage()]);
}
?>