
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, PUT');
header('Access-Control-Allow-Headers: Content-Type');

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

    $conn->exec("CREATE TABLE IF NOT EXISTS license_keys (
        id SERIAL PRIMARY KEY,
        key_value VARCHAR(255) UNIQUE NOT NULL,
        device_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'unused',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT FALSE
    )");

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $data = json_decode(file_get_contents('php://input'), true);
        $conn->beginTransaction();
        try {
            $stmt = $conn->prepare("DELETE FROM license_keys WHERE key_value = ?");
            $result = $stmt->execute([$data['key_value']]);
            if ($result && $stmt->rowCount() > 0) {
                $conn->commit();
                echo json_encode(['success' => true, 'message' => 'Key deleted successfully']);
            } else {
                $conn->rollBack();
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Key not found']);
            }
        } catch (Exception $e) {
            $conn->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to delete key']);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        $conn->beginTransaction();
        try {
            $stmt = $conn->prepare("UPDATE license_keys SET expires_at = ? WHERE key_value = ?");
            $result = $stmt->execute([$data['expires_at'], $data['key_value']]);
            if ($result && $stmt->rowCount() > 0) {
                $conn->commit();
                echo json_encode(['success' => true, 'message' => 'Key renewed successfully']);
            } else {
                $conn->rollBack();
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Key not found']);
            }
        } catch (Exception $e) {
            $conn->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to renew key']);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $conn->beginTransaction();
        try {
            $stmt = $conn->prepare("INSERT INTO license_keys (key_value, device_id, expires_at) VALUES (?, ?, ?)");
            $result = $stmt->execute([$data['key_value'], $data['device_id'], $data['expires_at']]);
            if ($result) {
                $conn->commit();
                echo json_encode(['success' => true, 'message' => 'Key added successfully']);
            } else {
                $conn->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to add key']);
            }
        } catch (Exception $e) {
            $conn->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to add key']);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $search = $_GET['search'] ?? '';
        $device = $_GET['device'] ?? '';
        $status = $_GET['status'] ?? 'all';
        $key = $_GET['key'] ?? '';
        $specific_device = $_GET['specific_device'] ?? '';

        $query = "SELECT * FROM license_keys WHERE 1=1";
        $params = [];

        if ($key) {
            $query .= " AND key_value = ?";
            $params[] = $key;
        }

        if ($specific_device) {
            $query .= " AND device_id = ? AND status != 'expired'";
            $params[] = $specific_device;
        }

        if ($search) {
            $query .= " AND key_value LIKE ?";
            $params[] = "%$search%";
        }

        if ($device) {
            $query .= " AND device_id LIKE ?";
            $params[] = "%$device%";
        }

        if ($status !== 'all') {
            $query .= " AND status = ?";
            $params[] = $status;
        }

        $query .= " ORDER BY created_at DESC";

        $stmt = $conn->prepare($query);
        $stmt->execute($params);
        $keys = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($keys);
        exit;
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>