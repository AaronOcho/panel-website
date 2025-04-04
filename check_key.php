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

    $alterTableCommands = [
        "ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS device_id VARCHAR(255)",
        "ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT FALSE",
        "ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS hwid VARCHAR(255)",
        "ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS last_check TIMESTAMP",
        "ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS activation_date TIMESTAMP",
        "ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS total_uses INTEGER DEFAULT 0"
    ];

    foreach ($alterTableCommands as $alterCommand) {
        try {
            $conn->exec($alterCommand);
        } catch (PDOException $e) {
            continue;
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['key']) && isset($_GET['hwid'])) {
        $key = $_GET['key'];
        $hwid = $_GET['hwid'];

        $stmt = $conn->prepare("SELECT * FROM license_keys WHERE key_value = ?");
        $stmt->execute([$key]);
        $key_data = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($key_data) {
            $expires_at = new DateTime($key_data['expires_at']);
            $current_time = new DateTime();

            if ($expires_at > $current_time) {
                if (!$key_data['hwid']) {
                    $update_stmt = $conn->prepare("
                        UPDATE license_keys 
                        SET hwid = ?, 
                            status = 'active', 
                            activation_date = CURRENT_TIMESTAMP,
                            last_check = CURRENT_TIMESTAMP,
                            total_uses = 1
                        WHERE key_value = ?
                    ");
                    $update_stmt->execute([$hwid, $key]);
                    echo json_encode([
                        'valid' => true,
                        'status' => 'active',
                        'expires_at' => $key_data['expires_at'],
                        'message' => 'Key activated successfully',
                        'activation_date' => date('Y-m-d H:i:s')
                    ]);
                } elseif ($key_data['hwid'] === $hwid) {
                    $update_stmt = $conn->prepare("
                        UPDATE license_keys 
                        SET last_check = CURRENT_TIMESTAMP,
                            total_uses = total_uses + 1
                        WHERE key_value = ?
                    ");
                    $update_stmt->execute([$key]);
                    echo json_encode([
                        'valid' => true,
                        'status' => $key_data['status'],
                        'expires_at' => $key_data['expires_at'],
                        'message' => 'Key valid',
                        'activation_date' => $key_data['activation_date'],
                        'total_uses' => $key_data['total_uses'] + 1
                    ]);
                } else {
                    echo json_encode([
                        'valid' => false,
                        'message' => 'Key is bound to a different device'
                    ]);
                }
            } else {
                $update_stmt = $conn->prepare("UPDATE license_keys SET status = 'expired' WHERE key_value = ?");
                $update_stmt->execute([$key]);
                echo json_encode([
                    'valid' => false,
                    'message' => 'Key expired'
                ]);
            }
        } else {
            echo json_encode([
                'valid' => false,
                'message' => 'Invalid key'
            ]);
        }
        exit;
    }

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

        $query = "SELECT * FROM license_keys WHERE 1=1";
        $params = [];

        if ($key) {
            $query .= " AND key_value = ?";
            $params[] = $key;
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