document.addEventListener('DOMContentLoaded', () => {
    renderCheckoutSummary();
});

function renderCheckoutSummary() {
    const cart = JSON.parse(localStorage.getItem('tpn_cart')) || [];
    const checkoutItems = document.getElementById('checkoutItems');
    const coSubtotal = document.getElementById('coSubtotal');
    const coTotal = document.getElementById('coTotal');
    const coShipping = document.getElementById('coShipping');

    if (cart.length === 0) {
        checkoutItems.innerHTML = '<div style="color: var(--gray); text-align: center;">Your cart is empty.</div>';
        coSubtotal.textContent = '$0.00';
        coTotal.textContent = '$0.00';
        return;
    }

    let subtotal = 0;
    checkoutItems.innerHTML = '';

    cart.forEach(item => {
        subtotal += item.price * item.qty;
        checkoutItems.innerHTML += `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="width: 64px; height: 64px; border-radius: 12px; background-image: url('${item.image}'); background-size: cover; background-position: center; border: 1px solid rgba(196, 132, 138, 0.2); position: relative;">
          <span style="position: absolute; top: -8px; right: -8px; background: var(--gray); color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px;">${item.qty}</span>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 14px; margin-bottom: 4px;">${item.name}</div>
          <div style="font-size: 12px; color: var(--gray);">$${item.price.toFixed(2)}</div>
        </div>
        <div style="font-size: 14px; font-weight: 500;">$${(item.price * item.qty).toFixed(2)}</div>
      </div>
    `;
    });

    const shippingCost = subtotal >= 75 ? 0 : 10; // Free shipping over $75

    coSubtotal.textContent = `$${subtotal.toFixed(2)}`;

    if (shippingCost === 0) {
        coShipping.textContent = 'Free';
    } else {
        coShipping.textContent = `$${shippingCost.toFixed(2)}`;
    }

    const total = subtotal + shippingCost;
    coTotal.textContent = `$${total.toFixed(2)} USD`;
}

function processCheckout() {
    const cart = JSON.parse(localStorage.getItem('tpn_cart')) || [];
    if (cart.length === 0) {
        showToast('Your cart is empty.');
        return;
    }

    showToast('Processing your royal order... ✨');
    setTimeout(() => {
        localStorage.removeItem('tpn_cart'); // Clear cart after successful checkout
        window.location.href = 'index.html'; // Redirect to home (or a success page)
    }, 3000);
}

function showToast(message) {
    const t = document.getElementById('toast');
    t.textContent = message;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}
