let addKeyModal;
let viewKeyModal;

document.addEventListener('DOMContentLoaded', function() {
    addKeyModal = new bootstrap.Modal(document.getElementById('addKeyModal'));
    viewKeyModal = new bootstrap.Modal(document.getElementById('viewKeyModal'));
    loadKeys();
});

function showAddModal() {
    const now = new Date();
    document.getElementById('expirationDate').min = now.toISOString().slice(0, 16);
    addKeyModal.show();
}

function generateKey() {
    const length = 32;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('keyValue').value = key;
}

async function addKey() {
    const keyValue = document.getElementById('keyValue').value.trim();
    const deviceId = document.getElementById('deviceId').value.trim();
    const expirationDate = document.getElementById('expirationDate').value;

    if (!keyValue || !deviceId || !expirationDate) {
        alert('Please fill all required fields');
        return;
    }

    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'add',
                key: keyValue,
                deviceId: deviceId,
                expirationDate: expirationDate
            })
        });

        const data = await response.json();
        if (data.success) {
            addKeyModal.hide();
            document.getElementById('addKeyForm').reset();
            loadKeys();
            alert('Key added successfully');
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadKeys() {
    try {
        const response = await fetch('api.php?action=list');
        const data = await response.json();
        
        const tbody = document.getElementById('keysTableBody');
        tbody.innerHTML = '';

        data.forEach(key => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${key.key_value}</td>
                <td>${key.device_id || 'Not assigned'}</td>
                <td><span class="status-badge status-${key.status.toLowerCase()}">${key.status}</span></td>
                <td>${formatDate(key.created_at)}</td>
                <td>${formatDate(key.expires_at)}</td>
                <td>
                    <button class="btn btn-info btn-sm action-btn" onclick="viewKeyDetails('${key.key_value}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-warning btn-sm action-btn" onclick="renewKey('${key.key_value}')">
                        <i class="fas fa-sync"></i>
                    </button>
                    <button class="btn btn-danger btn-sm action-btn" onclick="deleteKey('${key.key_value}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading keys:', error);
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

async function viewKeyDetails(keyValue) {
    try {
        const response = await fetch(`api.php?action=view&key=${keyValue}`);
        const data = await response.json();
        
        document.getElementById('keyDetails').innerHTML = `
            <div class="mb-3">
                <strong>Key:</strong> ${data.key_value}
            </div>
            <div class="mb-3">
                <strong>Device ID:</strong> ${data.device_id || 'Not assigned'}
            </div>
            <div class="mb-3">
                <strong>Status:</strong> ${data.status}
            </div>
            <div class="mb-3">
                <strong>Created:</strong> ${formatDate(data.created_at)}
            </div>
            <div class="mb-3">
                <strong>Expires:</strong> ${formatDate(data.expires_at)}
            </div>
            <div class="mb-3">
                <strong>Total Uses:</strong> ${data.total_uses || 0}
            </div>
        `;
        
        viewKeyModal.show();
    } catch (error) {
        alert('Error loading key details');
    }
}

async function renewKey(keyValue) {
    const newDate = prompt('Enter new expiration date (YYYY-MM-DD HH:mm:ss):');
    if (!newDate) return;

    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'renew',
                key: keyValue,
                newDate: newDate
            })
        });

        const data = await response.json();
        if (data.success) {
            loadKeys();
            alert('Key renewed successfully');
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        alert('Error renewing key: ' + error.message);
    }
}

async function deleteKey(keyValue) {
    if (!confirm('Are you sure you want to delete this key?')) return;

    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'delete',
                key: keyValue
            })
        });

        const data = await response.json();
        if (data.success) {
            loadKeys();
            alert('Key deleted successfully');
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        alert('Error deleting key: ' + error.message);
    }
}

function filterKeys() {
    const searchKey = document.getElementById('searchKey').value;
    const searchDevice = document.getElementById('searchDevice').value;
    const status = document.getElementById('statusFilter').value;
    
    fetch(`api.php?action=list&search=${searchKey}&device=${searchDevice}&status=${status}`)
        .then(response => response.json())
        .then(data => {
            updateKeysTable(data);
        })
        .catch(error => {
            console.error('Error filtering keys:', error);
        });
}