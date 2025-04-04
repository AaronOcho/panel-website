<?php
header('Content-Type: application/json');

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

    $conn->exec("
        CREATE TABLE IF NOT EXISTS license_keys (
            id SERIAL PRIMARY KEY,
            key_value VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            is_used BOOLEAN DEFAULT FALSE
        )
    ");

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $conn->prepare("INSERT INTO license_keys (key_value, status, expires_at) VALUES (?, 'unused', ?)");
        $stmt->execute([$data['key_value'], $data['expires_at']]);
        
        echo json_encode(['success' => true]);
        exit;
    }

    $search = $_GET['search'] ?? '';
    $status = $_GET['status'] ?? 'all';

    $query = "SELECT * FROM license_keys WHERE 1=1";
    $params = [];

    if ($search) {
        $query .= " AND key_value LIKE ?";
        $params[] = "%$search%";
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

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>