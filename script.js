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
    return fetch('/check_key')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            updateTable(data);
        })
        .catch(error => {
            console.error('Error loading keys:', error);
            alert('Error loading keys: ' + error.message);
        });
}

function updateTable(keys) {
    const tbody = document.getElementById('keyTableBody');
    tbody.innerHTML = '';

    keys.forEach(key => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${key.key_value}</td>
            <td class="device-id">${key.device_id || 'Not assigned'}</td>
            <td>${key.status}</td>
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

function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

function showAddKeyModal() {
    document.getElementById('addKeyModal').style.display = 'block';
    const today = new Date();
    const minDateTime = today.toISOString().slice(0, 16);
    document.getElementById('expirationDate').min = minDateTime;
}

function hideAddKeyModal() {
    document.getElementById('addKeyModal').style.display = 'none';
}

function generateRandomKey() {
    const length = 32;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('keyValue').value = key;
}

async function handleAddKey(event) {
    event.preventDefault();

    const keyValue = document.getElementById('keyValue').value;
    const deviceId = document.getElementById('deviceId').value;
    const expirationDate = document.getElementById('expirationDate').value;

    if (!keyValue || !deviceId || !expirationDate) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const response = await fetch('/check_key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key_value: keyValue,
                device_id: deviceId,
                expires_at: expirationDate
            })
        });

        const result = await response.json();

        if (result.success) {
            hideAddKeyModal();
            await loadKeys();
            document.getElementById('addKeyForm').reset();
        } else {
            throw new Error(result.message || 'Failed to add key');
        }
    } catch (error) {
        alert('Error adding key: ' + error.message);
    }
}

function filterKeys() {
    const searchTerm = document.getElementById('searchKey').value;
    const searchDevice = document.getElementById('searchDevice').value;
    const status = document.getElementById('filterStatus').value;

    fetch(`/check_key?search=${searchTerm}&device=${searchDevice}&status=${status}`)
        .then(response => response.json())
        .then(data => {
            updateTable(data);
        })
        .catch(error => console.error('Error:', error));
}

function viewKey(key) {
    fetch(`/check_key?key=${key}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const keyInfo = data[0];
                alert(`Key Details:\nKey: ${keyInfo.key_value}\nDevice ID: ${keyInfo.device_id || 'Not assigned'}\nStatus: ${keyInfo.status}\nCreated: ${formatDate(keyInfo.created_at)}\nExpires: ${formatDate(keyInfo.expires_at)}`);
            }
        })
        .catch(error => console.error('Error:', error));
}

async function renewKey(key) {
    const newExpirationDate = prompt('Enter new expiration date (YYYY-MM-DD HH:mm:ss):');
    if (newExpirationDate) {
        try {
            const response = await fetch('/check_key', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key_value: key,
                    expires_at: newExpirationDate
                })
            });

            const result = await response.json();

            if (result.success) {
                await loadKeys();
                alert('Key renewed successfully');
            } else {
                throw new Error(result.message || 'Failed to renew key');
            }
        } catch (error) {
            alert('Error renewing key: ' + error.message);
        }
    }
}

async function deleteKey(key) {
    if (confirm('Are you sure you want to delete this key?')) {
        try {
            const response = await fetch('/check_key', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key_value: key
                })
            });

            const result = await response.json();

            if (result.success) {
                await loadKeys();
                alert(result.message);
            } else {
                throw new Error(result.message || 'Failed to delete key');
            }
        } catch (error) {
            alert('Error deleting key: ' + error.message);
        }
    }
}