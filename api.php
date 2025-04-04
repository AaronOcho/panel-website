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

    $createTableSQL = "
    CREATE TABLE IF NOT EXISTS license_keys (
        id SERIAL PRIMARY KEY,
        key_value VARCHAR(255) UNIQUE NOT NULL,
        device_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'unused',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        hwid VARCHAR(255),
        last_check TIMESTAMP,
        activation_date TIMESTAMP,
        total_uses INTEGER DEFAULT 0
    )";
    
    $conn->exec($createTableSQL);

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

        case 'check':
            $key = $_GET['key'] ?? '';
            $hwid = $_GET['hwid'] ?? '';
            
            if (empty($key) || empty($hwid)) {
                throw new Exception('Missing key or HWID');
            }
            
            $stmt = $conn->prepare("SELECT * FROM license_keys WHERE key_value = ?");
            $stmt->execute([$key]);
            $keyData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$keyData) {
                echo json_encode(['valid' => false, 'message' => 'Invalid key']);
                break;
            }
            
            if ($keyData['is_used'] && $keyData['hwid'] !== $hwid) {
                echo json_encode(['valid' => false, 'message' => 'Key bound to different hardware']);
                break;
            }
            
            if (strtotime($keyData['expires_at']) < time()) {
                echo json_encode(['valid' => false, 'message' => 'Key expired']);
                break;
            }
            
            if (!$keyData['is_used']) {
                $updateStmt = $conn->prepare("UPDATE license_keys SET is_used = TRUE, hwid = ?, activation_date = CURRENT_TIMESTAMP WHERE key_value = ?");
                $updateStmt->execute([$hwid, $key]);
            }
            
            $updateUsageStmt = $conn->prepare("UPDATE license_keys SET last_check = CURRENT_TIMESTAMP, total_uses = total_uses + 1 WHERE key_value = ?");
            $updateUsageStmt->execute([$key]);
            
            echo json_encode(['valid' => true, 'message' => 'Key valid', 'data' => $keyData]);
            break;

        case 'reset':
            $stmt = $conn->prepare("UPDATE license_keys SET is_used = FALSE, hwid = NULL, activation_date = NULL WHERE key_value = ?");
            $result = $stmt->execute([$data['key']]);
            echo json_encode(['success' => $result]);
            break;

        case 'stats':
            $stats = [
                'total' => 0,
                'active' => 0,
                'expired' => 0,
                'unused' => 0
            ];
            
            $stmt = $conn->query("SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_used AND expires_at > CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN expires_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as expired,
                SUM(CASE WHEN NOT is_used THEN 1 ELSE 0 END) as unused
                FROM license_keys");
            
            $stats = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode($stats);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error', 'message' => $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => 'Request error', 'message' => $e->getMessage()]);
}
?>