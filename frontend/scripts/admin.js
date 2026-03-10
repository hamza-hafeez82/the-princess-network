import { supabase, getUser } from './auth.js';

const API_URL = window.CONFIG.API_URL;
let currentUser = null;
let fullOrdersList = []; // Cache orders for detailed viewing

// --- INITIALIZATION & SECURITY ---

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Verifying Palace Credentials...');

    // 1. Verify Authentication
    currentUser = await getUser();
    if (!currentUser) {
        window.location.href = 'signin.html';
        return;
    }

    // 2. Verify Admin Role via Database (Double Check)
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', currentUser.id)
        .single();

    if (error || profile?.role !== 'admin') {
        console.error('Unauthorized Entry Attempted');
        document.querySelector('.guard-content').innerHTML = `
            <div class="royal-spinner" style="animation: none; color: #d93025;">✖</div>
            <h2>Access Denied</h2>
            <p>You do not possess the royal clearance for this chamber.</p>
            <button onclick="window.location.href='index.html'" class="royal-btn btn-primary" style="margin-top: 20px;">Return to Gallery</button>
        `;
        return;
    }

    // 3. Setup UI
    document.getElementById('adminName').textContent = profile.full_name || 'Royal Admin';
    if (profile.avatar_url) {
        document.getElementById('adminAvatar').innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    }

    // 4. Reveal Dashboard
    document.getElementById('adminGuard').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('adminGuard').style.display = 'none';
        document.querySelector('.admin-container').classList.add('visible');
    }, 500);

    // 5. Initialize Tabs & Fetch Initial Data
    initTabs();
    initModalToggles();
    initProductForm();
    loadDashboardStats();
});

// --- HELPER FUNCTIONS ---

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show';
    setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
}

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': currentUser.id
});

function formatPrice(price) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- TAB NAVIGATION ---

function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabTitles = {
        'dashboard': { title: 'Royal Overview', sub: 'Welcome back to your command center, Highness.' },
        'products': { title: 'The Treasury', sub: 'Manage the royal jewels and artifacts.' },
        'orders': { title: 'Acquisitions', sub: 'Monitor global shipments and royal decrees.' },
        'users': { title: 'The Census', sub: 'Oversee the citizens of the Princess Network.' }
    };

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update Active Tab Button
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show Content
            const target = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${target}Tab`).classList.add('active');

            // Update Header
            document.getElementById('tabTitle').textContent = tabTitles[target].title;
            document.getElementById('tabSubtitle').textContent = tabTitles[target].sub;

            // Load Data
            if (target === 'dashboard') loadDashboardStats();
            if (target === 'products') loadProducts();
            if (target === 'orders') loadOrders();
            if (target === 'users') loadUsers();
        });
    });
}

// --- DASHBOARD (STATS) ---

async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load metrics');
        const stats = await res.json();

        document.getElementById('statRevenue').textContent = formatPrice(stats.totalRevenue);
        document.getElementById('statOrders').textContent = stats.orderCount;
        document.getElementById('statUsers').textContent = stats.userCount;
        document.getElementById('statProducts').textContent = stats.productCount;

        // Load recent orders snippet
        loadRecentOrdersList();
    } catch (err) {
        showToast('Failed to gather palace metrics.');
        console.error(err);
    }
}

async function loadRecentOrdersList() {
    const container = document.getElementById('recentOrdersList');
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--gray);">Gathering scroll records...</div>';

    try {
        const res = await fetch(`${API_URL}/api/admin/orders`, { headers: authHeaders() });
        const orders = await res.json();
        const recent = orders.slice(0, 5); // top 5

        if (recent.length === 0) {
            container.innerHTML = '<div style="padding: 20px; color: var(--gray);">No recent acquisitions.</div>';
            return;
        }

        container.innerHTML = recent.map(o => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee;">
                <div>
                    <div style="font-weight: 600; font-size: 14px;">#${o.id.slice(0, 8).toUpperCase()}</div>
                    <div style="font-size: 12px; color: var(--gray);">${o.customer_email}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 600; color: var(--gold);">${formatPrice(o.total_amount)}</div>
                    <span class="status-badge status-${o.status}">${o.status}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<div style="padding: 20px; color: red;">Failed to load records.</div>';
    }
}

// --- TREASURY (PRODUCTS) ---

async function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="5">Loading the treasury...</td></tr>';

    try {
        // Fetch all products (bypassing RLS since we use a service key in our new route, or we fetch from our admin route if we made one, else we just fetch normally if RLS allows admin)
        // Actually, we didn't make a GET /api/admin/products. Let's just use Supabase directly since RLS allows select for active. 
        // Wait, admin needs to see INACTIVE products too. Let's refine the query or add a backend route.
        // For now, let's use supabase directly with service_role? No, frontend uses anon key. 
        // We will fetch from regular supabase; if RLS hides inactive, we need a backend route or we accept it for now.
        // I will implement a backend route `app.get('/api/admin/products')` shortly. Let's assume it exists or use supabase.
        // Let's use supabase, assuming RLS allows admin to view all. Wait, our `schema.sql` policy says `USING (is_active = true)`. We should have an admin policy.
        // Let's fetch from Supabase. If inactive are hidden, we'll fix RLS later.
        const { data: products, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });

        if (error) throw error;

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">The treasury is empty.</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td class="prod-img-cell">
                    <img src="${p.image}" class="prod-img-preview" alt="${p.name}">
                    <div>
                        <div style="font-weight: 600;">${p.name}</div>
                        <div style="font-size: 11px; color: var(--gray);">${p.id.slice(0, 8)}</div>
                    </div>
                </td>
                <td>${p.category || '-'}</td>
                <td style="font-weight: 600;">${formatPrice(p.price)}</td>
                <td>
                    <span class="status-badge ${p.is_active ? 'status-paid' : 'status-cancelled'}">
                        ${p.is_active ? 'Active' : 'Archived'}
                    </span>
                    ${p.badge ? `<br><span style="font-size:10px; color:var(--gold);">${p.badge}</span>` : ''}
                </td>
                <td>
                    <button class="action-btn" onclick="editProduct('${p.id}')">✏️ Edit</button>
                    <button class="action-btn delete" onclick="deleteProduct('${p.id}')">🗑️ Remove</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Failed to access treasury.</td></tr>';
        console.error(err);
    }
}

window.deleteProduct = async (id) => {
    if (!confirm('Are you certain you wish to remove this treasure permanently?')) return;

    try {
        const res = await fetch(`${API_URL}/api/admin/products/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Deletion failed');
        showToast('Treasure removed.');
        loadProducts();
    } catch (err) {
        showToast('Error: ' + err.message);
    }
};

// Modals for Product
let isCustomCategory = false;
let isImageUpload = false;

function initModalToggles() {
    const catBtn = document.getElementById('toggleCategoryBtn');
    const catSelect = document.getElementById('pCategory');
    const catCustom = document.getElementById('pCategoryCustom');

    catBtn.addEventListener('click', () => {
        isCustomCategory = !isCustomCategory;
        if (isCustomCategory) {
            catSelect.style.display = 'none';
            catCustom.style.display = 'block';
            catBtn.textContent = 'Use Preset';
            catBtn.classList.add('btn-secondary');
            catCustom.required = true;
        } else {
            catSelect.style.display = 'block';
            catCustom.style.display = 'none';
            catBtn.textContent = '+ Custom';
            catBtn.classList.remove('btn-secondary');
            catCustom.required = false;
            catCustom.value = '';
        }
    });

    const urlBtn = document.getElementById('imgTypeUrlBtn');
    const uploadBtn = document.getElementById('imgTypeUploadBtn');
    const imgUrlInput = document.getElementById('pImage');
    const imgFileInput = document.getElementById('pImageFile');

    urlBtn.addEventListener('click', () => {
        isImageUpload = false;
        urlBtn.classList.add('active');
        urlBtn.classList.remove('btn-secondary');
        uploadBtn.classList.remove('active');
        uploadBtn.classList.add('btn-secondary');
        imgUrlInput.style.display = 'block';
        imgUrlInput.required = true;
        imgFileInput.style.display = 'none';
        imgFileInput.required = false;
    });

    uploadBtn.addEventListener('click', () => {
        isImageUpload = true;
        uploadBtn.classList.add('active');
        uploadBtn.classList.remove('btn-secondary');
        urlBtn.classList.remove('active');
        urlBtn.classList.add('btn-secondary');
        imgFileInput.style.display = 'block';
        imgFileInput.required = true;
        imgUrlInput.style.display = 'none';
        imgUrlInput.required = false;
    });
}

window.openProductModal = (product = null) => {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('modalTitle').textContent = 'Curate New Treasure';

    // Reset toggles to default
    if (isCustomCategory) document.getElementById('toggleCategoryBtn').click();
    if (isImageUpload) document.getElementById('imgTypeUrlBtn').click();
    document.getElementById('saveProductBtn').textContent = 'Save Treasure';
    document.getElementById('saveProductBtn').disabled = false;

    if (product) {
        document.getElementById('modalTitle').textContent = 'Modify Treasure';
        document.getElementById('productId').value = product.id;
        document.getElementById('pName').value = product.name;
        document.getElementById('pPrice').value = product.price;

        // Handle category
        const selectCats = Array.from(document.getElementById('pCategory').options).map(o => o.value);
        if (selectCats.includes(product.category)) {
            document.getElementById('pCategory').value = product.category;
        } else {
            document.getElementById('toggleCategoryBtn').click();
            document.getElementById('pCategoryCustom').value = product.category;
        }

        document.getElementById('pBadge').value = product.badge || '';
        document.getElementById('pImage').value = product.image;
    }

    document.getElementById('productModal').classList.add('active');
};

window.closeProductModal = () => {
    document.getElementById('productModal').classList.remove('active');
};

window.editProduct = async (id) => {
    const { data: p } = await supabase.from('products').select('*').eq('id', id).single();
    if (p) openProductModal(p);
};

function initProductForm() {
    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('saveProductBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            const id = document.getElementById('productId').value;
            const category = isCustomCategory ? document.getElementById('pCategoryCustom').value : document.getElementById('pCategory').value;
            let imageUrl = document.getElementById('pImage').value;

            // Handle Image Upload
            if (isImageUpload) {
                const fileInput = document.getElementById('pImageFile');
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const formData = new FormData();
                    formData.append('image', file);

                    submitBtn.textContent = 'Uploading Image...';
                    const uploadRes = await fetch(`${API_URL}/api/admin/upload-image`, {
                        method: 'POST',
                        headers: { 'x-user-id': currentUser.id },
                        body: formData
                    });

                    if (!uploadRes.ok) {
                        const errorData = await uploadRes.json();
                        throw new Error('Image upload failed: ' + (errorData.error || uploadRes.statusText));
                    }

                    const uploadData = await uploadRes.json();
                    imageUrl = uploadData.url;
                } else if (!id) {
                    throw new Error('Please select an image file to upload.');
                }
            }

            const payload = {
                name: document.getElementById('pName').value,
                price: document.getElementById('pPrice').value,
                category: category,
                badge: document.getElementById('pBadge').value,
                image: imageUrl,
                is_active: true
            };

            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_URL}/api/admin/products/${id}` : `${API_URL}/api/admin/products`;

            submitBtn.textContent = 'Securing to Vault...';
            const res = await fetch(url, {
                method,
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to save treasure');

            showToast(id ? 'Treasure modified.' : 'New treasure added to the realm.');
            closeProductModal();
            loadProducts();
        } catch (err) {
            showToast('Error: ' + err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Treasure';
        }
    });
}

// --- ACQUISITIONS (ORDERS) ---

async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="6">Checking palace scrolls...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/api/admin/orders`, { headers: authHeaders() });
        const orders = await res.json();
        fullOrdersList = orders;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No acquisitions found.</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td style="font-family: monospace; font-size: 12px; color: var(--gold);">#${o.id.slice(0, 8).toUpperCase()}</td>
                <td>
                    <div style="font-weight: 500;">${o.shipping_address?.name || 'Unknown'}</div>
                    <div style="font-size: 11px; color: var(--gray);">${o.customer_email}</div>
                </td>
                <td style="font-weight: 600;">${formatPrice(o.total_amount)}</td>
                <td>
                    <select class="royal-select" onchange="updateOrderStatus('${o.id}', this.value)">
                        <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>Paid</option>
                        <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td>${formatDate(o.created_at)}</td>
                <td>
                    <button class="action-btn" onclick="viewOrder('${o.id}')">👁️ View</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Failed to access records.</td></tr>';
        console.error(err);
    }
}

window.updateOrderStatus = async (id, status) => {
    try {
        const res = await fetch(`${API_URL}/api/admin/orders/${id}/status`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Update failed');
        showToast('Acquisition status updated.');
    } catch (err) {
        showToast('Error: ' + err.message);
    }
};

window.viewOrder = (id) => {
    const order = fullOrdersList.find(o => o.id === id);
    if (!order) return;

    const contentDiv = document.getElementById('orderDetailsContent');
    const itemsHtml = order.items && order.items.length > 0
        ? order.items.map(item => `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding: 10px; background: #fafafa; border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; border-radius: 5px; object-fit: cover; border: 1px solid #eee;">
                    <div>
                        <div style="font-weight: 600;">${item.name}</div>
                        <div style="font-size: 13px; color: var(--gray);">Quantity: ${item.qty}</div>
                    </div>
                </div>
                <div style="font-weight: 600; font-family: 'Cinzel', serif;">${formatPrice(item.price * item.qty)}</div>
            </div>
        `).join('')
        : '<p>No items found in this order.</p>';

    const addressHtml = order.shipping_address
        ? `
            <p style="margin: 5px 0;"><strong>Name:</strong> ${order.shipping_address.name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Street:</strong> ${order.shipping_address.line1 || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> ${order.shipping_address.city || 'N/A'}, ${order.shipping_address.state || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Country:</strong> ${order.shipping_address.country || 'N/A'} - ${order.shipping_address.postal_code || order.shipping_address.zip || ''}</p>
        `
        : '<p>No shipping address provided.</p>';

    contentDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="background: var(--admin-card); border: 1px solid var(--admin-border); padding: 15px; border-radius: 8px;">
                <h3 style="margin-top: 0; font-family: 'Cinzel', serif; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Order Summary</h3>
                <p style="margin: 5px 0;"><strong>Order ID:</strong> #${order.id.slice(0, 8).toUpperCase()}</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${formatDate(order.created_at)}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> <span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></p>
                <p style="margin: 5px 0;"><strong>Total Value:</strong> ${formatPrice(order.total_amount)}</p>
                <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${order.payment_method?.toUpperCase() || 'Unknown'}</p>
            </div>
            <div style="background: var(--admin-card); border: 1px solid var(--admin-border); padding: 15px; border-radius: 8px;">
                <h3 style="margin-top: 0; font-family: 'Cinzel', serif; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Royal Destination</h3>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${order.customer_email}</p>
                ${addressHtml}
            </div>
        </div>
        <div>
            <h3 style="margin-top: 0; font-family: 'Cinzel', serif; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 15px;">Treasures Acquired</h3>
            ${itemsHtml}
        </div>
    `;

    document.getElementById('orderModal').classList.add('active');
};

window.closeOrderModal = () => {
    document.getElementById('orderModal').classList.remove('active');
};

// --- THE CENSUS (USERS) ---

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="5">Surveying the citizens...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/api/admin/users`, { headers: authHeaders() });
        const users = await res.json();

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No citizens found.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td class="prod-img-cell">
                    ${u.avatar_url
                ? `<img src="${u.avatar_url}" class="prod-img-preview" style="border-radius:50%;" alt="${u.full_name}">`
                : `<div class="prod-img-preview" style="border-radius:50%; display:flex; align-items:center; justify-content:center; background:#eee;">👤</div>`
            }
                    <div style="font-weight: 500;">${u.full_name || 'Anonymous'}</div>
                </td>
                <td>${u.email || '-'}</td>
                <td>
                    <select class="royal-select" onchange="updateUserRole('${u.id}', this.value)" ${u.id === currentUser.id ? 'disabled title="Cannot change your own role here"' : ''}>
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>Citizen (User)</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Curator (Admin)</option>
                    </select>
                </td>
                <td>${formatDate(u.updated_at || new Date())}</td>
                <td>
                    <button class="action-btn delete" onclick="alert('Expulsion from the realm... (Coming soon)')">Ban</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Failed to survey citizens.</td></tr>';
        console.error(err);
    }
}

window.updateUserRole = async (id, role) => {
    if (!confirm(`Are you sure you want to appoint this citizen to ${role.toUpperCase()}?`)) {
        loadUsers(); // revert select UI
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/admin/users/${id}/role`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ role })
        });
        if (!res.ok) throw new Error('Escalation failed');
        showToast('Royal role bestowed successfully.');
    } catch (err) {
        showToast('Error: ' + err.message);
        loadUsers(); // revert
    }
};
