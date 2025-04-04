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
    fetch('/check_key')
        .then(response => response.json())
        .then(data => {
            updateTable(data);
        })
        .catch(error => console.error('Error:', error));
}

function updateTable(keys) {
    const tbody = document.getElementById('keyTableBody');
    tbody.innerHTML = '';

    keys.forEach(key => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${key.key_value}</td>
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
    const expirationDate = document.getElementById('expirationDate').value;

    if (!keyValue || !expirationDate) {
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
                expires_at: expirationDate
            })
        });

        if (response.ok) {
            hideAddKeyModal();
            loadKeys();
            document.getElementById('addKeyForm').reset();
        } else {
            throw new Error('Failed to add key');
        }
    } catch (error) {
        alert('Error adding key: ' + error.message);
    }
}

function filterKeys() {
    const searchTerm = document.getElementById('searchKey').value;
    const status = document.getElementById('filterStatus').value;
    
    fetch(`/check_key?search=${searchTerm}&status=${status}`)
        .then(response => response.json())
        .then(data => {
            updateTable(data);
        })
        .catch(error => console.error('Error:', error));
}

function viewKey(key) {
    alert(`Key Details:\n${key}`);
}

function renewKey(key) {
    const newExpirationDate = prompt('Enter new expiration date (YYYY-MM-DD HH:mm:ss):');
    if (newExpirationDate) {
        fetch('/check_key', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key_value: key,
                expires_at: newExpirationDate
            })
        })
        .then(response => {
            if (response.ok) {
                loadKeys();
                alert('Key renewed successfully');
            } else {
                throw new Error('Failed to renew key');
            }
        })
        .catch(error => alert('Error renewing key: ' + error.message));
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

            if (response.ok) {
                loadKeys();
                alert('Key deleted successfully');
            } else {
                throw new Error('Failed to delete key');
            }
        } catch (error) {
            alert('Error deleting key: ' + error.message);
        }
    }
}