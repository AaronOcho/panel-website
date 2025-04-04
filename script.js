document.addEventListener('DOMContentLoaded', function() {
    loadKeys();
    document.querySelector('.filter-btn').addEventListener('click', filterKeys);
    document.querySelector('.add-key-btn').addEventListener('click', showAddKeyModal);
    document.querySelector('.close').addEventListener('click', hideAddKeyModal);
    document.getElementById('generateKey').addEventListener('click', generateRandomKey);
    document.getElementById('addKeyForm').addEventListener('submit', handleAddKey);

    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('addKeyModal')) {
            hideAddKeyModal();
        }
    });
});

function loadKeys() {
    fetch('check_key.php')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (Array.isArray(data)) {
                updateTable(data);
            } else {
                console.error('Received non-array data:', data);
            }
        })
        .catch(error => {
            console.error('Error loading keys:', error);
        });
}

function updateTable(keys) {
    const tbody = document.getElementById('keyTableBody');
    tbody.innerHTML = '';

    if (keys && keys.length > 0) {
        keys.forEach(key => {
            const row = document.createElement('tr');
            row.dataset.status = key.status || 'unused';
            row.innerHTML = `
                <td>${key.key_value || ''}</td>
                <td class="device-id">${key.device_id || 'Not assigned'}</td>
                <td>${key.status || 'unused'}</td>
                <td>${formatDate(key.created_at)}</td>
                <td>${formatDate(key.expires_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view-btn" onclick="viewKey('${key.key_value}')">View</button>
                        <button class="action-btn renew-btn" onclick="renewKey('${key.key_value}')">Renew</button>
                        <button class="action-btn delete-btn" onclick="deleteKey('${key.key_value}')">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString();
    } catch (e) {
        return dateString;
    }
}

function showAddKeyModal() {
    document.getElementById('addKeyModal').style.display = 'block';
    const today = new Date();
    const minDateTime = today.toISOString().slice(0, 16);
    document.getElementById('expirationDate').min = minDateTime;
    document.getElementById('keyValue').value = '';
    document.getElementById('deviceId').value = '';
    document.getElementById('expirationDate').value = '';
}

function hideAddKeyModal() {
    document.getElementById('addKeyModal').style.display = 'none';
    document.getElementById('addKeyForm').reset();
}

function generateRandomKey() {
    const length = 32;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('keyValue').value = key;
}

async function handleAddKey(event) {
    event.preventDefault();

    const keyValue = document.getElementById('keyValue').value.trim();
    const deviceId = document.getElementById('deviceId').value.trim();
    const expirationDate = document.getElementById('expirationDate').value;

    if (!keyValue || !deviceId || !expirationDate) {
        alert('Please fill in all fields');
        return;
    }

    const formData = {
        key_value: keyValue,
        device_id: deviceId,
        expires_at: new Date(expirationDate).toISOString()
    };

    try {
        const response = await fetch('check_key.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            hideAddKeyModal();
            loadKeys();
            alert('Key added successfully');
        } else {
            throw new Error(result.message || 'Failed to add key');
        }
    } catch (error) {
        alert(`Error adding key: ${error.message}`);
    }
}

function filterKeys() {
    const searchTerm = encodeURIComponent(document.getElementById('searchKey').value.trim());
    const searchDevice = encodeURIComponent(document.getElementById('searchDevice').value.trim());
    const status = encodeURIComponent(document.getElementById('filterStatus').value);

    fetch(`check_key.php?search=${searchTerm}&device=${searchDevice}&status=${status}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (Array.isArray(data)) {
                updateTable(data);
            }
        })
        .catch(error => console.error('Error:', error));
}

async function viewKey(key) {
    try {
        const response = await fetch(`check_key.php?key=${encodeURIComponent(key)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            const keyInfo = data[0];
            alert(
                `Key Details:\n` +
                `Key: ${keyInfo.key_value}\n` +
                `Device ID: ${keyInfo.device_id || 'Not assigned'}\n` +
                `Status: ${keyInfo.status}\n` +
                `Created: ${formatDate(keyInfo.created_at)}\n` +
                `Expires: ${formatDate(keyInfo.expires_at)}\n` +
                `Total Uses: ${keyInfo.total_uses || 0}`
            );
        }
    } catch (error) {
        console.error('Error viewing key:', error);
        alert('Error viewing key details');
    }
}

async function renewKey(key) {
    const newExpirationDate = prompt('Enter new expiration date (YYYY-MM-DD HH:mm:ss):');
    if (!newExpirationDate) return;

    try {
        const response = await fetch('check_key.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key_value: key,
                expires_at: newExpirationDate
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');
        
        const result = await response.json();
        if (result.success) {
            loadKeys();
            alert('Key renewed successfully');
        } else {
            throw new Error(result.message || 'Failed to renew key');
        }
    } catch (error) {
        alert(`Error renewing key: ${error.message}`);
    }
}

async function deleteKey(key) {
    if (!confirm('Are you sure you want to delete this key?')) return;

    try {
        const response = await fetch('check_key.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key_value: key
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');
        
        const result = await response.json();
        if (result.success) {
            loadKeys();
            alert('Key deleted successfully');
        } else {
            throw new Error(result.message || 'Failed to delete key');
        }
    } catch (error) {
        alert(`Error deleting key: ${error.message}`);
    }
}