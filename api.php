<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$db_url = "your_database_connection_string_here";

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

    $action = $_GET['action'] ?? '';
    $data = json_decode(file_get_contents('php://input'), true);

    switch($action) {
        case 'list':
            $where = [];
            $params = [];
            
            if (!empty($_GET['search'])) {
                $where[] = "key_value LIKE ?";
                $params[] = "%{$_GET['search']}%";
            }
            
            if (!empty($_GET['device'])) {
                $where[] = "device_id LIKE ?";
                $params[] = "%{$_GET['device']}%";
            }
            
            if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
                $where[] = "status = ?";
                $params[] = $_GET['status'];
            }
            
            $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
            $stmt = $conn->prepare("SELECT * FROM license_keys $whereClause ORDER BY created_at DESC");
            $stmt->execute($params);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'add':
            $stmt = $conn->prepare("INSERT INTO license_keys (key_value, device_id, expires_at, status) VALUES (?, ?, ?, 'unused')");
            $result = $stmt->execute([$data['key'], $data['deviceId'], $data['expirationDate']]);
            echo json_encode(['success' => $result]);
            break;

        case 'view':
            $stmt = $conn->prepare("SELECT * FROM license_keys WHERE key_value = ?");
            $stmt->execute([$_GET['key']]);
            echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
            break;

        case 'renew':
            $stmt = $conn->prepare("UPDATE license_keys SET expires_at = ? WHERE key_value = ?");
            $result = $stmt->execute([$data['newDate'], $data['key']]);
            echo json_encode(['success' => $result]);
            break;

        case 'delete':
            $stmt = $conn->prepare("DELETE FROM license_keys WHERE key_value = ?");
            $result = $stmt->execute([$data['key']]);
            echo json_encode(['success' => $result]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>