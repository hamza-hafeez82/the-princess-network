// Scroll header
window.addEventListener('scroll', () => {
  document.getElementById('hdr').classList.toggle('scrolled', scrollY > 50);
});

// Scroll reveal
const ro = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
}, { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach(el => ro.observe(el));

// --- CART LOGIC ---
let cart = JSON.parse(localStorage.getItem('tpn_cart')) || [];

function saveCart() {
  localStorage.setItem('tpn_cart', JSON.stringify(cart));
}

function renderCart() {
  const cartList = document.getElementById('cartList');
  const cartNum = document.getElementById('cartNum');
  const cartNumBadge = document.querySelector('.icon-btn .badge'); // Header badge
  const subtotalEl = document.getElementById('cartSubtotal');

  if (!cartList) return; // Not on a page with cart drawer

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

function toggleCart() {
  document.getElementById('cartOverlay').classList.toggle('open');
}

function closeOnBg(e) {
  if (e.target.id === 'cartOverlay') toggleCart();
}

function addToCart(id, name, price, image) {
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name, price, qty: 1, image });
  }
  saveCart();
  renderCart();

  const t = document.getElementById('toast');
  t.textContent = '♛  ' + name + ' added to your royal cart!';
  t.classList.add('show');

  if (!document.getElementById('cartOverlay').classList.contains('open')) {
    toggleCart(); // Auto open cart to show the added item
  }

  setTimeout(() => t.classList.remove('show'), 2800);
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      removeFromCart(id);
    } else {
      saveCart();
      renderCart();
    }
  }
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCart();
}

// Wishlist toggle
function toggleWish(btn) {
  btn.classList.toggle('loved');
  btn.textContent = btn.classList.contains('loved') ? '♥' : '♡';
}

// Filter products
function filterProducts(btn, cat) {
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const cards = document.querySelectorAll('.pcard');
  let count = 0;
  cards.forEach(card => {
    const match = cat === 'all' || card.dataset.cat === cat;
    card.style.display = match ? '' : 'none';
    if (match) count++;
  });
  document.getElementById('pCount').textContent = count;
}

// Mobile dropdown toggle
function toggleMobileDropdown(element) {
  const dropdown = element.parentElement;
  dropdown.classList.toggle('open');
}

// Mobile menu
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileOverlay');
  menu.classList.toggle('open');
  overlay.classList.toggle('open');
}
function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileOverlay');
  menu.classList.remove('open');
  overlay.classList.remove('open');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderCart();
});