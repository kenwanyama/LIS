const API = "https://lis-xrus.onrender.com";

let token = null;
let currentRole = null;
let currentUserId = null;
let sessionCreatedUsers = [];
let usersListVisible = false;
let currentUserName = null;

// Restore session on page load
window.addEventListener("load", () => {
    const saved = sessionStorage.getItem("lis_session");
    if (saved) {
        const s = JSON.parse(saved);
        token = s.token;
        currentRole = s.role;
        currentUserId = s.user_id;
        currentUserName = s.name;

        document.getElementById("loginModal").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        document.getElementById("welcome").innerText = `Logged in as ${currentRole}`;
        applyRolePermissions();
        loadEntries();
    }
});

// Login
function login() {
    const name = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch(`${API}/login/?name=${name}&password=${password}`, {
        method: "POST"
    })
    .then(res => {
        if (!res.ok) {
            throw new Error("Invalid credentials");
        }
        return res.json();
    })
    .then(data => {
        token = data.token;
        currentRole = data.role;
        currentUserId = data.user_id;
        currentUserName = data.name;

        document.getElementById("loginModal").style.display = "none";
        document.getElementById("dashboard").style.display = "block";

        document.getElementById("welcome").innerText = `Logged in as ${currentRole} (${currentUserName})`;
        

        applyRolePermissions();
        loadEntries();

        sessionStorage.setItem("lis_session", JSON.stringify({ token: data.token, role: data.role, user_id: data.user_id, name: data.name }));

    })
    .catch(error => {
        document.getElementById("loginError").innerText = error.message;
    });
}

function createUser() {
    const name = document.getElementById("newName").value;
    const password = document.getElementById("newPassword").value;
    const role = document.getElementById("newRole").value;

    fetch(`${API}/Users/?name=${name}&password=${password}&role=${role}`, {
        method: "POST",
        headers: { "token": token }
    })
    .then(res => res.json())
    .then(data => {
        if (data.detail) {
            alert(data.detail);
        } else {
            // Clear inputs
            document.getElementById("newName").value = "";
            document.getElementById("newPassword").value = "";
            // Refresh user table if it's open
            if (usersListVisible) {
                fetch(`${API}/Users/`, { headers: { "token": token } })
                .then(res => res.json())
                .then(renderUserTable);
            }
        }
    });
}

function loadSessionUsers() {
    const container = document.getElementById("sessionUserList");
    if (sessionCreatedUsers.length === 0) {
        container.innerHTML = "<p>No users created this session.</p>";
        return;
    }
    let html = `<table><thead><tr><th>ID</th><th>Name</th><th>Role</th></tr></thead><tbody>`;
    sessionCreatedUsers.forEach(u => {
        html += `<tr><td>${u.id}</td><td>${u.name}</td><td>${u.role}</td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// Apply role-based UI permissions
function applyRolePermissions() {
    // Hide all role panels first
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("techPanel").style.display = "none";
    document.getElementById("supervisorPanel").style.display = "none";

    if (currentRole === "Admin") {
        document.getElementById("adminPanel").style.display = "block";
    }
    if (currentRole === "Technician") {
        document.getElementById("techPanel").style.display = "block";
    }
    if (currentRole === "Supervisor") {
        document.getElementById("supervisorPanel").style.display = "block";
    }

}

function loadAllUsers() {
    // Toggle off if already visible
    const container = document.getElementById("allUsersList");
    if (usersListVisible) {
        container.innerHTML = "";
        usersListVisible = false;
        return;
    }

    fetch(`${API}/Users/`, { headers: { "token": token } })
    .then(res => res.json())
    .then(renderUserTable);
}

function renderUserTable(users) {
    const container = document.getElementById("allUsersList");
    let html = `<table><thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Actions</th></tr></thead><tbody>`;
    users.forEach(u => {
        html += `<tr>
            <td>${u.id}</td>
            <td>${u.name}</td>
            <td>${u.role}</td>
            <td>
                <button class="danger" onclick="deleteUser('${u.id}')">🗑 Delete</button>
                <select id="promote_${u.id}">
                    <option value="Admin">Admin</option>
                    <option value="Technician">Technician</option>
                    <option value="Supervisor">Supervisor</option>
                </select>
                <button onclick="promoteUser('${u.id}')">⬆ Promote</button>
            </td>
        </tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
    usersListVisible = true;
}

function deleteUser(targetId) {
    if (!confirm(`Delete user ${targetId}?`)) return;
    fetch(`${API}/Users/${targetId}?admin_id=${currentUserId}`, {
        method: "DELETE",
        headers: { "token": token }
    })
    .then(res => res.json())
    .then(data => {
        alert(data.detail);
        loadAllUsers();
    });
}

function promoteUser(targetId) {
    const newRole = document.getElementById(`promote_${targetId}`).value;
    fetch(`${API}/Users/${targetId}/promote?new_role=${newRole}&admin_id=${currentUserId}`, {
        method: "POST",
        headers: { "token": token }
    })
    .then(res => res.json())
    .then(data => {
        alert(data.detail);
        loadAllUsers();
    });
}

// Helper to toggle sections
function toggleSection(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === "none" ? "block" : "none";
}

// Generate patients
function generateAndLoadPatients() {
    fetch(`${API}/Entry/`)
    .then(res => res.json())
    .then(entries => {
        const usedPatientIds = new Set(entries.map(e => String(e.patient_id)));

        fetch(`${API}/Patients/`, { method: "POST" })
        .then(res => res.json())
        .then(patients => {
            console.log("Patients response:", patients);   // ADD THIS
            const available = patients.filter(p => !usedPatientIds.has(String(p.id)));
            renderPatientTable(available);
        });
    });
}
// Load and display patients in table
function loadPatients() {
    fetch(`${API}/Entry/`)
    .then(res => res.json())
    .then(entries => {
        const usedPatientIds = new Set(entries.map(e => String(e.patient_id)));
        fetch(`${API}/Patients/`)
        .then(res => res.json())
        .then(patients => {
            const available = patients.filter(p => !usedPatientIds.has(String(p.id)));
            renderPatientTable(available);
        });
    });
}

function renderPatientTable(data) {
    const container = document.getElementById("patientList");
    container.innerHTML = "";

    if (data.length === 0) {
        container.innerHTML = "<p style='color:var(--muted); margin-top:8px;'>No available patients. Press ⟳ to generate more.</p>";
        return;
    }

    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr>
                <th>Patient ID</th>
                <th>Patient Name</th>
                <th>Test Name</th>
            </tr>
        </thead>
        <tbody id="patientTableBody"></tbody>
    `;
    container.appendChild(table);

    const tbody = document.getElementById("patientTableBody");
    data.forEach(p => {
        const row = document.createElement("tr");
        let createButton = "";
        if (currentRole === "Technician") {
            createButton = `<button onclick="createEntry(${p.id}, '${p.test_name}')">Create Entry</button>`;
        }
        row.innerHTML = `
            <td>${p.id}</td>
            <td>${p.name || 'N/A'}</td>
            <td>${p.test_name}</td>
        `;
        tbody.appendChild(row);
    });
}

// Create entry from patient list
function createEntry(patientId, testName) {
    fetch(`${API}/Entry/?patient_id=${patientId}&test_name=${encodeURIComponent(testName)}&user_id=${currentUserId}&user_name=${currentUserName}`, {
        method: "POST"
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || 'Failed to create entry');
        }
        return data;
    })
    .then(data => {
        loadEntries();
  
    })
    .catch(error => {
        alert(`Error: ${error.message}`);
    });
}

// Create entry manually
function createManualEntry() {
    const patientId = document.getElementById("manualPatientId").value.trim();
    const testName = document.getElementById("manualTestName").value.trim();

    if (!patientId) {
        alert("Please enter a Patient ID");
        return;
    }
    if (!testName || testName === "Not found") {
        alert("Patient ID not found in the current list");
        return;
    }

    fetch(`${API}/Entry/?patient_id=${patientId}&test_name=${encodeURIComponent(testName)}&user_id=${currentUserId}&user_name=${currentUserName}`, {
        method: "POST"
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to create entry');
        return data;
    })
    .then(() => {
        document.getElementById("manualPatientId").value = "";
        document.getElementById("manualPatientName").value = "";
        document.getElementById("manualTestName").value = "";
        loadEntries();
    })
    .catch(error => alert(`Error: ${error.message}`));
}

// Load and display entries in table
function loadEntries() {
    fetch(`${API}/Entry/`)
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById("entryList");
        container.innerHTML = "";

        const table = document.createElement("table");
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Entry ID</th>
                    <th>Patient ID</th>
                    <th>Test Name</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="entryTableBody"></tbody>
        `;
        container.appendChild(table);

        const tbody = document.getElementById("entryTableBody");

        data.forEach(e => {
            let actions = "";

            // Technician sees Process button on Pending entries
            if ((currentRole === "Technician" || currentRole === "Admin" || currentRole === "Supervisor") && e.status === "Pending") {
                actions = `<button onclick="processEntry(${e.id})">▶ Process</button>`;
            }

            // Supervisor or Admin sees result dropdown + Verify on Processed entries
            if ((currentRole === "Supervisor" || currentRole === "Admin") && e.status === "Processed") {
                actions = `
                    <select id="result_${e.id}">
                        <option value="Positive">Positive</option>
                        <option value="Negative">Negative</option>
                    </select>
                    <button onclick="verifyEntry(${e.id})">✔ Verify</button>
                `;
            }

            // Badge color based on status
            const statusBadge = `<span class="badge badge-${e.status.toLowerCase()}">${e.status}</span>`;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${e.id}</td>
                <td>${e.patient_id}</td>
                <td>${e.test_name}</td>
                <td>${statusBadge}</td>
                <td>${e.result || '-'}</td>
                <td>${actions}</td>
            `;
            tbody.appendChild(row);
        });
    });
}

// Process entry
function processEntry(entryId) {
    fetch(`${API}/Entry/${entryId}/process?user_id=${currentUserId}`, {
        method: "POST"
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || 'Failed to process entry');
        }
        return data;
    })
    .then(data => {
        alert(`✓ Entry #${entryId} processed successfully!`);
        loadEntries();
    })
    .catch(error => {
        alert(`Error: ${error.message}`);
    });
}

// Verify entry
function verifyEntry(entryId) {
    const result = document.getElementById(`result_${entryId}`).value;

    fetch(`${API}/Entry/${entryId}/verify?result=${result}&user_id=${currentUserId}`, {
        method: "POST"
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to verify entry');
        return data;
    })
    .then(() => loadEntries())
    .catch(error => alert(`Error: ${error.message}`));
}

// Logout
function logout() {
    sessionStorage.removeItem("lis_session");
    token = null;
    currentRole = null;
    currentUserId = null;
    location.reload();
}


setTimeout(() => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            if (m.removedNodes.length > 0) {
                console.trace("patientList was modified here");
            }
        });
    });
    const el = document.getElementById("patientList");
    if (el) observer.observe(el, { childList: true, subtree: true });
}, 1000);

function lookupPatient() {
    const patientId = document.getElementById("manualPatientId").value.trim();
    if (!patientId) {
        document.getElementById("manualPatientName").value = "";
        document.getElementById("manualTestName").value = "";
        return;
    }

    fetch(`${API}/Patients/`)
    .then(res => res.json())
    .then(patients => {
        const match = patients.find(p => p.id === patientId);
        if (match) {
            document.getElementById("manualPatientName").value = match.name;
            document.getElementById("manualTestName").value = match.test_name;
        } else {
            document.getElementById("manualPatientName").value = "Not found";
            document.getElementById("manualTestName").value = "";
        }
    });
}
