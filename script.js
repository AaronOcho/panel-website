document.addEventListener('DOMContentLoaded', function() {
    loadKeys();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    document.querySelector('.filter-btn').addEventListener('click', filterKeys);
    document.querySelector('.add-key-btn').addEventListener('click', showAddKeyModal);
    document.querySelectorAll('.close').forEach(el => {
        el.addEventListener('click', function() {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    document.getElementById('generateKey').addEventListener('click', generateRandomKey);
    document.getElementById('addKeyForm').addEventListener('submit', handleAddKey);

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
});

function updateDateTime() {
    const now = new Date();
    document.getElementById('currentDateTime').textContent = now.toLocaleString();
}

function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function updateStats(keys) {
    const stats = {
        active: 0,
        expired: 0,
        unused: 0
    };
    
    keys.forEach(key => {
        stats[key.status]++;
    });
    
    document.getElementById('activeKeys').textContent = stats.active;
    document.getElementById('expiredKeys').textContent = stats.expired;
    document.getElementById('unusedKeys').textContent = stats.unused;
}

function loadKeys() {
    document.querySelector('.table-container').classList.add('loading');
    return fetch('/check_key')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            updateTable(data);
            updateStats(data);
            document.querySelector('.table-container').classList.remove('loading');
        })
        .catch(error => {
            showToast(`Error loading keys: ${error.message}`, 'error');
            document.querySelector('.table-container').classList.remove('loading');
        });
}

function updateTable(keys) {
    const tbody = document.getElementById('keyTableBody');
    tbody.innerHTML = '';
    keys.forEach(key => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${key.key_value}</code></td>
            <td><code>${key.hwid || 'Not assigned'}</code></td>
            <td><span class="status-badge ${key.status}">${key.status}</span></td>
            <td>${formatDate(key.created_at)}</td>
            <td>${formatDate(key.expires_at)}</td>
            <td>${key.total_uses || 0}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn" onclick="viewKey('${key.key_value}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="action-btn renew-btn" onclick="renewKey('${key.key_value}')">
                        <i class="fas fa-sync"></i> Renew
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteKey('${key.key_value}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
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
    document.getElementById('addKeyForm').reset();
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
    const keyAmount = parseInt(document.getElementById('keyAmount').value) || 1;

    if (!keyValue || !expirationDate) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    document.querySelector('.submit-btn').disabled = true;
    
    try {
        const response = await fetch('/check_key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key_value: keyValue,
                expires_at: expirationDate,
                amount: keyAmount
            })
        });

        const result = await response.json();
        
        if (result.success) {
            hideAddKeyModal();
            await loadKeys();
            showToast(result.message, 'success');
        } else {
            throw new Error(result.message || 'Failed to add key');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        document.querySelector('.submit-btn').disabled = false;
    }
}

function filterKeys() {
    const searchTerm = document.getElementById('searchKey').value;
    const searchDevice = document.getElementById('searchDevice').value;
    const status = document.getElementById('filterStatus').value;
    
    document.querySelector('.table-container').classList.add('loading');
    
    fetch(`/check_key?search=${searchTerm}&device=${searchDevice}&status=${status}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            updateTable(data);
            updateStats(data);
            document.querySelector('.table-container').classList.remove('loading');
        })
        .catch(error => {
            showToast(`Error filtering keys: ${error.message}`, 'error');
            document.querySelector('.table-container').classList.remove('loading');
        });
}

async function viewKey(key) {
    try {
        const response = await fetch(`/check_key?key=${key}`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        if (data.length > 0) {
            const keyInfo = data[0];
            const detailsHtml = `
                <div class="key-info">
                    <p><strong>Key:</strong> <code>${keyInfo.key_value}</code></p>
                    <p><strong>HWID:</strong> <code>${keyInfo.hwid || 'Not assigned'}</code></p>
                    <p><strong>Status:</strong> <span class="status-badge ${keyInfo.status}">${keyInfo.status}</span></p>
                    <p><strong>Created:</strong> ${formatDate(keyInfo.created_at)}</p>
                    <p><strong>Expires:</strong> ${formatDate(keyInfo.expires_at)}</p>
                    <p><strong>Total Uses:</strong> ${keyInfo.total_uses || 0}</p>
                    <p><strong>Last Check:</strong> ${formatDate(keyInfo.last_check)}</p>
                    <p><strong>Activation Date:</strong> ${formatDate(keyInfo.activation_date)}</p>
                </div>
            `;
            document.getElementById('keyDetails').innerHTML = detailsHtml;
            document.getElementById('viewKeyModal').style.display = 'block';
        }
    } catch (error) {
        showToast(`Error viewing key details: ${error.message}`, 'error');
    }
}

async function renewKey(key) {
    const newExpirationDate = prompt('Enter new expiration date (YYYY-MM-DD HH:mm:ss):');
    if (!newExpirationDate) return;

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
            showToast('Key renewed successfully', 'success');
        } else {
            throw new Error(result.message || 'Failed to renew key');
        }
    } catch (error) {
        showToast(`Error renewing key: ${error.message}`, 'error');
    }
}

async function deleteKey(key) {
    if (!confirm('Are you sure you want to delete this key?')) return;

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
            showToast(result.message, 'success');
        } else {
            throw new Error(result.message || 'Failed to delete key');
        }
    } catch (error) {
        showToast(`Error deleting key: ${error.message}`, 'error');
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy text', 'error');
    });
}


document.addEventListener('click', function(event) {
    if (event.target.tagName === 'CODE') {
        copyToClipboard(event.target.textContent);
    }
});