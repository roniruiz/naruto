<?php
// Enhanced error handling and response structure
header('Content-Type: application/json');
session_start();

// Improved database connection with retry mechanism
function getDbConnection($config, $maxRetries = 3) {
    $attempts = 0;
    while ($attempts < $maxRetries) {
        try {
            $conn = new PDO(
                "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4",
                $config['db_user'],
                $config['db_pass'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
            return $conn;
        } catch (PDOException $e) {
            $attempts++;
            if ($attempts >= $maxRetries) {
                throw $e;
            }
            sleep(1); // Wait before retrying
        }
    }
}

function sendResponse($success, $data = null, $message = '') {
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
        'timestamp' => date('c')
    ]);
    exit;
}

function handleError($error) {
    error_log($error); // Log error server-side
    sendResponse(false, null, 'Ha ocurrido un error en el servidor');
}

try {
    require_once 'config.php';
    $conn = getDbConnection($config);
    
    // Validate session/authentication
    if (!isset($_SESSION['user_id'])) {
        sendResponse(false, null, 'Sesión no válida');
    }
    
    // Get and validate action
    $action = filter_input(INPUT_POST, 'action') ?? filter_input(INPUT_GET, 'action');
    if (!$action) {
        sendResponse(false, null, 'Acción no especificada');
    }
    
    // Input validation function
    function validateInput($input, $type = 'string') {
        switch($type) {
            case 'int':
                return filter_var($input, FILTER_VALIDATE_INT);
            case 'float':
                return filter_var($input, FILTER_VALIDATE_FLOAT);
            case 'email':
                return filter_var($input, FILTER_VALIDATE_EMAIL);
            default:
                return htmlspecialchars(trim($input));
        }
    }

    // Enhanced security with prepared statements
    switch($action) {
        case 'login':
            $username = validateInput($_POST['username']);
            $password = validateInput($_POST['password']);
            
            if (!$username || !$password) {
                sendResponse(false, null, 'Credenciales inválidas');
            }
            
            $stmt = $conn->prepare("SELECT * FROM users WHERE username = ? AND password = ?");
            $stmt->execute([$username, hash('sha256', $password)]);
            $user = $stmt->fetch();
            
            if ($user) {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                sendResponse(true, $user, 'Login exitoso');
            } else {
                sendResponse(false, null, 'Credenciales inválidas');
            }
            break;
        
        case 'addInventoryItem':
            $type = validateInput($_POST['type']);
            $name = validateInput($_POST['name']);
            $quantity = validateInput($_POST['quantity'], 'int');
            $price = validateInput($_POST['price'], 'float');
            $status = validateInput($_POST['status']);
            
            if (!$type || !$name || !$quantity || !$price || !$status) {
                sendResponse(false, null, 'Datos inválidos');
            }
            
            $stmt = $conn->prepare("INSERT INTO inventory (type, name, quantity, price, status) VALUES (?, ?, ?, ?, ?)");
            $result = $stmt->execute([$type, $name, $quantity, $price, $status]);
            
            if ($result) {
                sendResponse(true, null, 'Ítem agregado con éxito');
            } else {
                sendResponse(false, null, 'Error al agregar ítem');
            }
            break;
            
        case 'updateInventoryItem':
            $id = validateInput($_POST['id'], 'int');
            $type = validateInput($_POST['type']);
            $name = validateInput($_POST['name']);
            $quantity = validateInput($_POST['quantity'], 'int');
            $price = validateInput($_POST['price'], 'float');
            $status = validateInput($_POST['status']);
            
            if (!$id || !$type || !$name || !$quantity || !$price || !$status) {
                sendResponse(false, null, 'Datos inválidos');
            }
            
            $stmt = $conn->prepare("UPDATE inventory SET type = ?, name = ?, quantity = ?, price = ?, status = ? WHERE id = ?");
            $result = $stmt->execute([$type, $name, $quantity, $price, $status, $id]);
            
            if ($result) {
                sendResponse(true, null, 'Ítem actualizado con éxito');
            } else {
                sendResponse(false, null, 'Error al actualizar ítem');
            }
            break;
            
        case 'deleteInventoryItem':
            $id = validateInput($_POST['id'], 'int');
            
            if (!$id) {
                sendResponse(false, null, 'ID inválido');
            }
            
            $stmt = $conn->prepare("DELETE FROM inventory WHERE id = ?");
            $result = $stmt->execute([$id]);
            
            if ($result) {
                sendResponse(true, null, 'Ítem eliminado con éxito');
            } else {
                sendResponse(false, null, 'Error al eliminar ítem');
            }
            break;
            
        case 'addSale':
            try {
                $conn->beginTransaction();
                
                // Add sale header
                $clientId = validateInput($_POST['clientId'], 'int');
                $total = validateInput($_POST['total'], 'float');
                $status = validateInput($_POST['status']);
                $sellerId = validateInput($_POST['sellerId'], 'int');
                
                if (!$clientId || !$total || !$status || !$sellerId) {
                    sendResponse(false, null, 'Datos inválidos');
                }
                
                $stmt = $conn->prepare("INSERT INTO sales (client_id, total, status, seller_id) VALUES (?, ?, ?, ?)");
                $stmt->execute([$clientId, $total, $status, $sellerId]);
                $saleId = $conn->lastInsertId();
                
                // Add sale details and update inventory
                $items = json_decode($_POST['items'], true);
                foreach ($items as $item) {
                    // Add sale detail
                    $stmt = $conn->prepare("INSERT INTO sale_details (sale_id, item_id, quantity, price) VALUES (?, ?, ?, ?)");
                    $stmt->execute([$saleId, $item['id'], $item['quantity'], $item['price']]);
                    
                    // Update inventory
                    $stmt = $conn->prepare("UPDATE inventory SET quantity = quantity - ? WHERE id = ?");
                    $stmt->execute([$item['quantity'], $item['id']]);
                }
                
                $conn->commit();
                sendResponse(true, null, 'Venta registrada con éxito');
                
            } catch (Exception $e) {
                $conn->rollBack();
                sendResponse(false, null, 'Error al registrar venta: ' . $e->getMessage());
            }
            break;
            
        case 'updateSale':
            try {
                $conn->beginTransaction();
                
                $saleId = validateInput($_POST['saleId'], 'int');
                $status = validateInput($_POST['status']);
                
                if (!$saleId || !$status) {
                    sendResponse(false, null, 'Datos inválidos');
                }
                
                // Update sale status
                $stmt = $conn->prepare("UPDATE sales SET status = ? WHERE id = ?");
                $stmt->execute([$status, $saleId]);
                
                $conn->commit();
                sendResponse(true, null, 'Venta actualizada con éxito');
                
            } catch (Exception $e) {
                $conn->rollBack();
                sendResponse(false, null, 'Error al actualizar venta: ' . $e->getMessage());
            }
            break;
            
        case 'deleteSale':
            try {
                $conn->beginTransaction();
                
                $saleId = validateInput($_POST['saleId'], 'int');
                
                if (!$saleId) {
                    sendResponse(false, null, 'ID inválido');
                }
                
                // Get sale details to restore inventory
                $stmt = $conn->prepare("SELECT * FROM sale_details WHERE sale_id = ?");
                $stmt->execute([$saleId]);
                $details = $stmt->fetchAll();
                
                // Restore inventory quantities
                foreach ($details as $detail) {
                    $stmt = $conn->prepare("UPDATE inventory SET quantity = quantity + ? WHERE id = ?");
                    $stmt->execute([$detail['quantity'], $detail['item_id']]);
                }
                
                // Delete sale details
                $stmt = $conn->prepare("DELETE FROM sale_details WHERE sale_id = ?");
                $stmt->execute([$saleId]);
                
                // Delete sale
                $stmt = $conn->prepare("DELETE FROM sales WHERE id = ?");
                $stmt->execute([$saleId]);
                
                $conn->commit();
                sendResponse(true, null, 'Venta eliminada con éxito');
                
            } catch (Exception $e) {
                $conn->rollBack();
                sendResponse(false, null, 'Error al eliminar venta: ' . $e->getMessage());
            }
            break;
            
        case 'addClient':
            $name = validateInput($_POST['name']);
            $clientId = validateInput($_POST['clientId']);
            $phone = validateInput($_POST['phone']);
            $address = validateInput($_POST['address']);
            $email = validateInput($_POST['email'], 'email');
            
            if (!$name || !$clientId || !$phone || !$address || !$email) {
                sendResponse(false, null, 'Datos inválidos');
            }
            
            $stmt = $conn->prepare("INSERT INTO clients (name, client_id, phone, address, email) VALUES (?, ?, ?, ?, ?)");
            $result = $stmt->execute([$name, $clientId, $phone, $address, $email]);
            
            if ($result) {
                sendResponse(true, null, 'Cliente agregado con éxito');
            } else {
                sendResponse(false, null, 'Error al agregar cliente');
            }
            break;
            
        case 'updateClient':
            $id = validateInput($_POST['id'], 'int');
            $name = validateInput($_POST['name']);
            $clientId = validateInput($_POST['clientId']);
            $phone = validateInput($_POST['phone']);
            $address = validateInput($_POST['address']);
            $email = validateInput($_POST['email'], 'email');
            
            if (!$id || !$name || !$clientId || !$phone || !$address || !$email) {
                sendResponse(false, null, 'Datos inválidos');
            }
            
            $stmt = $conn->prepare("UPDATE clients SET name = ?, client_id = ?, phone = ?, address = ?, email = ? WHERE id = ?");
            $result = $stmt->execute([$name, $clientId, $phone, $address, $email, $id]);
            
            if ($result) {
                sendResponse(true, null, 'Cliente actualizado con éxito');
            } else {
                sendResponse(false, null, 'Error al actualizar cliente');
            }
            break;
            
        case 'deleteClient':
            $id = validateInput($_POST['id'], 'int');
            
            if (!$id) {
                sendResponse(false, null, 'ID inválido');
            }
            
            $stmt = $conn->prepare("DELETE FROM clients WHERE id = ?");
            $result = $stmt->execute([$id]);
            
            if ($result) {
                sendResponse(true, null, 'Cliente eliminado con éxito');
            } else {
                sendResponse(false, null, 'Error al eliminar cliente');
            }
            break;
            
        case 'getCashMovements':
            $userId = validateInput($_GET['userId'], 'int');
            $startDate = validateInput($_GET['startDate']);
            $endDate = validateInput($_GET['endDate']);
            
            $sql = "SELECT * FROM cash_movements WHERE user_id = ?";
            $params = [$userId];
            
            if ($startDate && $endDate) {
                $sql .= " AND date BETWEEN ? AND ?";
                $params[] = $startDate;
                $params[] = $endDate;
            }
            
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
            $movements = $stmt->fetchAll();
            
            sendResponse(true, $movements, 'Movimientos de caja obtenidos con éxito');
            break;
            
        case 'addCashMovement':
            $userId = validateInput($_POST['userId'], 'int');
            $type = validateInput($_POST['type']);
            $amount = validateInput($_POST['amount'], 'float');
            $description = validateInput($_POST['description']);
            
            if (!$userId || !$type || !$amount || !$description) {
                sendResponse(false, null, 'Datos inválidos');
            }
            
            $stmt = $conn->prepare("INSERT INTO cash_movements (user_id, type, amount, description) VALUES (?, ?, ?, ?)");
            $result = $stmt->execute([$userId, $type, $amount, $description]);
            
            if ($result) {
                sendResponse(true, null, 'Movimiento de caja agregado con éxito');
            } else {
                sendResponse(false, null, 'Error al agregar movimiento de caja');
            }
            break;
            
        default:
            sendResponse(false, null, 'Acción no válida');
    }
    
} catch(PDOException $e) {
    handleError($e->getMessage());
} catch(Exception $e) {
    handleError($e->getMessage());
}