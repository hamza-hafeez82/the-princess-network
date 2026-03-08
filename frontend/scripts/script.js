import { supabase, signIn, signUp, signOut, onAuthChange, uploadAvatar } from './auth.js';

// Scroll header
window.addEventListener('scroll', () => {
  const hdr = document.getElementById('hdr');
  if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 50);
});

// Scroll reveal
const ro = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
}, { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach(el => ro.observe(el));

// --- IndexedDB for Avatar Persistence ---
async function getPendingAvatar(email) {
  return new Promise((resolve) => {
    const request = indexedDB.open('RoyalPalaceDB', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pendingAvatars')) return resolve(null);
      const transaction = db.transaction('pendingAvatars', 'readonly');
      const store = transaction.objectStore('pendingAvatars');
      const getReq = store.get(email);
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

async function clearPendingAvatar(email) {
  const request = indexedDB.open('RoyalPalaceDB', 1);
  request.onsuccess = (e) => {
    const db = e.target.result;
    const transaction = db.transaction('pendingAvatars', 'readwrite');
    transaction.objectStore('pendingAvatars').delete(email);
  };
}

// --- CART LOGIC ---
let cart = JSON.parse(localStorage.getItem('tpn_cart')) || [];

function saveCart() {
  localStorage.setItem('tpn_cart', JSON.stringify(cart));
}

function renderCart() {
  const cartList = document.getElementById('cartList');
  const cartNum = document.getElementById('cartNum');
  const subtotalEl = document.getElementById('cartSubtotal');

  if (!cartList) return;

  let subtotal = 0;
  let totalItems = 0;

  cartList.innerHTML = '';

  if (cart.length === 0) {
    cartList.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: var(--gray);">Your royal cart is empty.</div>';
  } else {
    cart.forEach(item => {
      subtotal += item.price * item.qty;
      totalItems += item.qty;

      cartList.innerHTML += `
        <div class="cart-item">
          <div class="ci-thumb" style="background-image: url('${item.image}'); background-size: cover; background-position: center;"></div>
          <div class="ci-info">
            <div class="ci-name">${item.name}</div>
            <div class="ci-price">$${item.price.toFixed(2)}</div>
            <div class="ci-qty">
              <button class="qb" onclick="changeQty('${item.id}', -1)">−</button>
              <span>${item.qty}</span>
              <button class="qb" onclick="changeQty('${item.id}', 1)">+</button>
            </div>
          </div>
          <button class="ci-remove" onclick="removeFromCart('${item.id}')" style="background:none; border:none; color:var(--gray); cursor:pointer; font-size: 18px; margin-left: 10px;">✕</button>
        </div>
      `;
    });
  }

  if (cartNum) cartNum.textContent = totalItems;
  const cartBadges = document.querySelectorAll('.cart-badge');
  cartBadges.forEach(badge => {
    badge.textContent = totalItems > 0 ? totalItems : '';
    badge.style.display = totalItems > 0 ? '' : 'none';
  });
  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
}

window.toggleCart = function () {
  const overlay = document.getElementById('cartOverlay');
  if (overlay) overlay.classList.toggle('open');
}

window.closeOnBg = function (e) {
  if (e.target.id === 'cartOverlay') window.toggleCart();
}

window.addToCart = function (id, name, price, image) {
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name, price, qty: 1, image });
  }
  saveCart();
  renderCart();

  showToast('♛ ' + name + ' added to your royal cart!');

  const overlay = document.getElementById('cartOverlay');
  if (overlay && !overlay.classList.contains('open')) {
    window.toggleCart();
  }
}

window.changeQty = function (id, delta) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      window.removeFromCart(id);
    } else {
      saveCart();
      renderCart();
    }
  }
}

window.removeFromCart = function (id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCart();
}

// Wishlist toggle
window.toggleWish = function (btn) {
  btn.classList.toggle('loved');
  btn.textContent = btn.classList.contains('loved') ? '♥' : '♡';
}

window.filterProducts = function (btn, cat) {
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const cards = document.querySelectorAll('.pcard');
  let count = 0;
  cards.forEach(card => {
    const match = cat === 'all' || card.dataset.cat === cat;
    card.style.display = match ? '' : 'none';
    if (match) count++;
  });
  const pCount = document.getElementById('pCount');
  if (pCount) pCount.textContent = count;
}

window.toggleMobileDropdown = function (element) {
  const dropdown = element.parentElement;
  if (dropdown) dropdown.classList.toggle('open');
}

window.toggleMobileMenu = function () {
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileOverlay');
  if (menu) menu.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

window.closeMobileMenu = function () {
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileOverlay');
  if (menu) menu.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

const API_URL = 'http://localhost:3000';

// --- PRODUCT LOADING ---
async function loadProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  try {
    const res = await fetch(`${API_URL}/api/products`);
    const products = await res.json();

    if (products && products.length > 0) {
      grid.innerHTML = '';
      products.forEach((p, i) => {
        const delayClass = `d${(i % 3) + 1}`;
        const badgeHTML = p.badge ? `<span class="pbadge ${p.badge.toLowerCase().includes('sale') ? 'badge-sale' : ''}">${p.badge}</span>` : '';

        grid.innerHTML += `
          <div class="pcard reveal ${delayClass}" data-cat="${p.category || 'all'}">
            <div class="pcard-img">
              ${badgeHTML}
              <button class="pwish" onclick="toggleWish(this)">♡</button>
              <img src="${p.image}" alt="${p.name}">
              <div class="pcard-cta"><button onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${p.image}')">Add to Bag</button></div>
            </div>
            <div class="pcard-body">
              <div class="pcard-cat">${p.category || 'Princess Collection'}</div>
              <div class="pcard-name">${p.name}</div>
              <div class="pcard-row">
                <div class="pcard-price">$${p.price.toFixed(2)}</div>
                <div class="pcard-stars">★★★★★</div>
              </div>
            </div>
          </div>
        `;
      });
      document.querySelectorAll('.reveal').forEach(el => ro.observe(el));
    }
  } catch (err) {
    console.error('Royal products could not be gathered:', err);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  loadProducts();

  onAuthChange(async (event, session) => {
    const user = session?.user || null;

    if (event === 'SIGNED_IN') {
      showToast('Welcome to the Royal Circle! ♛');

      const pending = await getPendingAvatar(user.email);
      if (pending && pending.file) {
        showToast('Finalizing your royal portrait... ✧');
        const { publicUrl, error } = await uploadAvatar(pending.file, user.id);
        if (!error) {
          await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
          await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
          await clearPendingAvatar(user.email);
          const { data: { user: updatedUser } } = await supabase.auth.getUser();
          updateAuthUI(updatedUser);
        } else {
          updateAuthUI(user);
        }
      } else {
        updateAuthUI(user);
      }

      await syncCartWithDB(user.id);
      await loadCartFromDB(user.id);
    } else {
      updateAuthUI(user);
    }

    if (event === 'SIGNED_OUT') {
      showToast('Farewell, Princess. ✧');
      cart = [];
      saveCart();
      renderCart();
    }
  });
});

async function syncCartWithDB(userId) {
  if (!userId) return;
  try {
    await fetch(`${API_URL}/api/cart/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, cart })
    });
  } catch (err) {
    console.error('Cart sync failed:', err);
  }
}

async function loadCartFromDB(userId) {
  if (!userId) return;
  try {
    const res = await fetch(`${API_URL}/api/cart?userId=${userId}`);
    const dbCart = await res.json();
    if (dbCart && dbCart.length > 0) {
      cart = dbCart;
      saveCart();
      renderCart();
    }
  } catch (err) {
    console.error('Failed to load cart from DB:', err);
  }
}

// --- AUTH UI LOGIC ---
async function updateAuthUI(user) {
  const menus = document.querySelectorAll('.user-dropdown-menu');
  const accountPills = document.querySelectorAll('.account-wrapper .icon-pill');

  if (menus.length === 0) return;

  let avatarUrl = user?.user_metadata?.avatar_url;
  let fullName = user?.user_metadata?.full_name || 'Princess';

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
      avatarUrl = profile.avatar_url;
      fullName = profile.full_name || fullName;
      user.role = profile.role; // Store role for UI logic
    }
  }

  const content = user
    ? `
      <div class="dropdown-header">Royal Profile</div>
      <div style="padding: 10px 20px; font-size: 13px; color: var(--gold); font-weight: 500;">Hello, ${fullName}</div>
      <div class="dropdown-divider"></div>
      ${user.role === 'admin' ? '<a href="admin.html" style="color: var(--gold); font-weight: 600;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg> Palace Command</a>' : ''}
      <a href="dashboard.html"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Dashboard</a>
      <a href="orders.html"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg> My Orders</a>
      <div class="dropdown-divider"></div>
      <button onclick="handleSignOut()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Sign Out</button>
    `
    : `
      <div class="dropdown-header">Guest Account</div>
      <a href="signin.html"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg> Sign In</a>
      <a href="signup.html"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg> Create Account</a>
    `;

  menus.forEach(menu => { menu.innerHTML = content; });

  accountPills.forEach(pill => {
    if (avatarUrl) {
      pill.innerHTML = `<img src="${avatarUrl}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      pill.style.padding = '0';
      pill.style.overflow = 'hidden';
      pill.style.border = '2px solid var(--gold)';
    } else {
      pill.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="5" stroke="currentColor" stroke-width="2" />
          <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      `;
      pill.style.padding = '';
      pill.style.overflow = '';
      pill.style.border = '';
    }
  });
}

window.toggleUserMenu = function (e) {
  if (e) e.stopPropagation();
  const wrapper = e.currentTarget.closest('.account-wrapper');
  if (!wrapper) return;
  const menu = wrapper.querySelector('.user-dropdown-menu');
  if (menu) {
    const wasOpen = menu.classList.contains('open');
    document.querySelectorAll('.user-dropdown-menu').forEach(m => m.classList.remove('open'));
    if (!wasOpen) menu.classList.add('open');

    if (menu.classList.contains('open')) {
      const closeHandler = (event) => {
        if (!event.target.closest('.account-wrapper')) {
          menu.classList.remove('open');
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 10);
    }
  }
};

window.handleSignOut = async function () {
  const { error } = await signOut();
  if (error) showToast('Error signing out: ' + error.message);
  document.querySelectorAll('.user-dropdown-menu').forEach(m => m.classList.remove('open'));
};

window.showToast = function (msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}