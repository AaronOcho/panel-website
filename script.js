document.addEventListener('DOMContentLoaded', () => {
    loadKeys();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    document.querySelector('.filter-btn').addEventListener('click', filterKeys);
    document.querySelector('.add-key-btn').addEventListener('click', showAddKeyModal);
    document.querySelectorAll('.close').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        });
    });
    document.getElementById('generateKey').addEventListener('click', generateRandomKey);
    document.getElementById('addKeyForm').addEventListener('submit', handleAddKey);
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    });
});

function updateDateTime() {
    document.getElementById('currentDateTime').textContent = new Date().toLocaleString();
}

function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
}

function updateStats(data) {
    const stats = { active: 0, expired: 0, unused: 0 };
    if (Array.isArray(data)) {
        data.forEach(key => {
            if (key.status in stats) stats[key.status]++;
        });
    }
    Object.keys(stats).forEach(key => {
        document.getElementById(`${key}Keys`).textContent = stats[key];
    });
}

function loadKeys() {
    document.querySelector('.table-container').classList.add('loading');
    fetch('/check_key')
        .then(response => response.json())
        .then(data => {
            const keysArray = Array.isArray(data) ? data : [];
            updateTable(keysArray);
            updateStats(keysArray);
        })
        .catch(error => showToast(error.message, 'error'))
        .finally(() => document.querySelector('.table-container').classList.remove('loading'));
}

function updateTable(keys) {
    const tbody = document.getElementById('keyTableBody');
    tbody.innerHTML = '';
    keys.forEach(key => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code class="copyable">${key.key_value}</code></td>
            <td><code class="copyable">${key.hwid || 'Not assigned'}</code></td>
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
    return dateString ? new Date(dateString).toLocaleString() : 'N/A';
}

function showAddKeyModal() {
    const modal = document.getElementById('addKeyModal');
    modal.style.display = 'block';
    document.getElementById('expirationDate').min = new Date().toISOString().slice(0, 16);
}

function generateRandomKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const key = Array.from({length: 32}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    document.getElementById('keyValue').value = key;
}

async function handleAddKey(e) {
    e.preventDefault();
    const keyValue = document.getElementById('keyValue').value;
    const expirationDate = document.getElementById('expirationDate').value;
    const keyAmount = parseInt(document.getElementById('keyAmount').value) || 1;

    if (!keyValue || !expirationDate) {
        showToast('Please fill all fields', 'error');
        return;
    }

    try {
        const response = await fetch('/check_key', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({key_value: keyValue, expires_at: expirationDate, amount: keyAmount})
        });
        const result = await response.json();
        if (result.success) {
            document.getElementById('addKeyModal').style.display = 'none';
            document.getElementById('addKeyForm').reset();
            loadKeys();
            showToast('Key added successfully', 'success');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function filterKeys() {
    const searchKey = document.getElementById('searchKey').value;
    const searchDevice = document.getElementById('searchDevice').value;
    const status = document.getElementById('filterStatus').value;
    
    document.querySelector('.table-container').classList.add('loading');
    fetch(`/check_key?search=${searchKey}&device=${searchDevice}&status=${status}`)
        .then(response => response.json())
        .then(data => {
            updateTable(data);
            updateStats(data);
        })
        .catch(error => showToast(error.message, 'error'))
        .finally(() => document.querySelector('.table-container').classList.remove('loading'));
}

async function viewKey(key) {
    try {
        const response = await fetch(`/check_key?key=${key}`);
        const data = await response.json();
        if (data.length > 0) {
            const keyInfo = data[0];
            document.getElementById('keyDetails').innerHTML = `
                <div class="key-info">
                    <p><strong>Key:</strong> <code class="copyable">${keyInfo.key_value}</code></p>
                    <p><strong>HWID:</strong> <code class="copyable">${keyInfo.hwid || 'Not assigned'}</code></p>
                    <p><strong>Status:</strong> <span class="status-badge ${keyInfo.status}">${keyInfo.status}</span></p>
                    <p><strong>Created:</strong> ${formatDate(keyInfo.created_at)}</p>
                    <p><strong>Expires:</strong> ${formatDate(keyInfo.expires_at)}</p>
                    <p><strong>Total Uses:</strong> ${keyInfo.total_uses || 0}</p>
                    <p><strong>Last Check:</strong> ${formatDate(keyInfo.last_check)}</p>
                    <p><strong>Activation Date:</strong> ${formatDate(keyInfo.activation_date)}</p>
                </div>
            `;
            document.getElementById('viewKeyModal').style.display = 'block';
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function renewKey(key) {
    const newDate = prompt('Enter new expiration date (YYYY-MM-DD HH:mm:ss):');
    if (!newDate) return;

    try {
        const response = await fetch('/check_key', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({key_value: key, expires_at: newDate})
        });
        const result = await response.json();
        if (result.success) {
            loadKeys();
            showToast('Key renewed successfully', 'success');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteKey(key) {
    if (!confirm('Are you sure you want to delete this key?')) return;

    try {
        const response = await fetch('/check_key', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({key_value: key})
        });
        const result = await response.json();
        if (result.success) {
            loadKeys();
            showToast('Key deleted successfully', 'success');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

document.addEventListener('click', e => {
    if (e.target.classList.contains('copyable')) {
        navigator.clipboard.writeText(e.target.textContent)
            .then(() => showToast('Copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy text', 'error'));
    }
});