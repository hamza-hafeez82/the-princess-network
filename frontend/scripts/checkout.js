import { supabase } from './auth.js';

window.processCheckout = async function (e) {
    if (e) e.preventDefault();
    console.log('Initiating Palace Transaction...');

    const cartStr = localStorage.getItem('tpn_cart');
    const cart = JSON.parse(cartStr) || [];
    const email = document.getElementById('email')?.value;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    console.log('Order Summary:', { items: cart.length, email, method: paymentMethod });

    if (cart.length === 0) {
        showToast('Your royal cart is empty.');
        return;
    }

    if (!email) {
        showToast('Please enter your email address.');
        return;
    }

    const firstName = document.getElementById('firstName')?.value;
    const lastName = document.getElementById('lastName')?.value;
    const address = document.getElementById('address')?.value;
    const city = document.getElementById('city')?.value;
    const state = document.getElementById('state')?.value;
    const zip = document.getElementById('zip')?.value;
    const country = document.getElementById('country')?.value || 'United States';

    const shippingAddress = {
        line1: address,
        city: city,
        state: state,
        postal_code: zip,
        country: country,
        name: `${firstName} ${lastName}`
    };

    const subtotal = cart.reduce((sum, item) => {
        let p = item.price;
        if (typeof p === 'string') p = p.replace('$', '');
        const priceNum = parseFloat(p) || 0;
        const qtyNum = parseInt(item.qty) || 0;
        return sum + (priceNum * qtyNum);
    }, 0);

    const shippingCost = subtotal >= 75 ? 0 : 10;
    const total = subtotal + shippingCost;

    const btn = document.getElementById('submitOrderBtn');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Processing Your Order...';

    try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Validate Dummy Card (42442 or 16 digits)
        if (paymentMethod === 'stripe') {
            const cardInput = document.querySelector('input[placeholder*="Card number"]');
            const cardNumber = cardInput ? cardInput.value.replace(/\s/g, '') : '';
            console.log('Validating Card... Token length:', cardNumber.length);

            if (!cardNumber || (cardNumber !== '42442' && cardNumber.length < 16)) {
                throw new Error('Please enter the royal testing card (42442) or a valid 16-digit card.');
            }
        }

        // 2. Prepare Payload
        const payload = {
            userId: user?.id || null,
            email,
            items: cart,
            total,
            paymentMethod,
            shippingAddress
        };

        console.log('Sending Payload to Palace Treasury:', payload);

        // 3. Submit to Palace Treasury
        const res = await fetch(`http://localhost:3000/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'The palace treasury rejected this order.');
        }

        const order = await res.json();
        console.log('Order Successfully Recorded:', order.id);

        // 4. Success Response
        showToast('♛ Your royal order has been received!');
        localStorage.removeItem('tpn_cart');

        setTimeout(() => {
            window.location.href = `success.html?order_id=${order.id}`;
        }, 1500);

    } catch (err) {
        console.error('Palace Acquisition Failed:', err);
        showToast('Royal Oversight: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Complete Order ♛';
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Royal Checkout Initializing...');
    renderCheckoutSummary();
    await initCheckout();

    // Bind form submission
    const form = document.getElementById('checkoutForm');
    if (form) {
        form.addEventListener('submit', window.processCheckout);
        console.log('Palace Form bound successfully.');
    }
});

async function initCheckout() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        console.log('Recognized Member:', user.email);
        // Logged in: Load profile data
        await loadUserData(user.id, user.email);
        document.getElementById('authPrompt').innerHTML = `
            <div style="padding: 20px; background: rgba(178, 147, 93, 0.05); border-radius: 16px; border: 1px solid rgba(178, 147, 93, 0.2); font-size: 14px; color: var(--gold);">
                Welcome back, <strong style="color: var(--ink);">${user.user_metadata?.full_name || 'Princess'}</strong>! Your royal details have been pre-filled for your convenience.
            </div>
        `;
    } else {
        // Guest: Show humble invitation
        document.getElementById('authPrompt').innerHTML = `
            <div style="padding: 30px; background: #fffaf6; border-radius: 20px; border: 1px dashed rgba(196, 132, 138, 0.3); text-align: center;">
                <h3 style="font-family: 'Cinzel', serif; font-size: 18px; margin-bottom: 12px; color: var(--ink);">Join the Inner Circle?</h3>
                <p style="font-size: 14px; color: var(--gray); line-height: 1.6; max-width: 400px; margin: 0 auto 20px;">
                    Members of our royal circle enjoy faster checkouts, order tracking, and exclusive collection previews. 
                    Would you like to <a href="signin.html" style="color: var(--gold); font-weight: 600; text-decoration: none;">Sign In</a> or 
                    <a href="signup.html" style="color: var(--gold); font-weight: 600; text-decoration: none;">Create an Account</a> before you proceed?
                </p>
                <div style="font-size: 12px; color: var(--gold); text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">— Or continue as our honored guest below —</div>
            </div>
        `;
    }
}

async function loadUserData(userId, userEmail) {
    try {
        console.log('Fetching Palace profile for:', userId);
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.warn('Profile record not yet synchronized:', error.message);
            // Even if profile fails, we can still fill the email from the auth user
            if (document.getElementById('email')) document.getElementById('email').value = userEmail || '';
            return;
        }

        if (profile) {
            console.log('Palace Profile Found:', profile.full_name);
            if (document.getElementById('email')) {
                document.getElementById('email').value = userEmail || '';
            }

            const fullName = profile.full_name || '';
            const names = fullName.split(' ');
            if (document.getElementById('firstName')) document.getElementById('firstName').value = names[0] || '';
            if (document.getElementById('lastName')) document.getElementById('lastName').value = names.slice(1).join(' ') || '';

            if (profile.shipping_address) {
                if (document.getElementById('address')) document.getElementById('address').value = profile.shipping_address.line1 || '';
                if (document.getElementById('city')) document.getElementById('city').value = profile.shipping_address.city || '';
                if (document.getElementById('zip')) document.getElementById('zip').value = profile.shipping_address.zip || '';
                if (document.getElementById('country') && profile.shipping_address.country) document.getElementById('country').value = profile.shipping_address.country;
                if (document.getElementById('state') && profile.shipping_address.state) document.getElementById('state').value = profile.shipping_address.state;
            }
        }
    } catch (err) {
        console.error('Error loading user data:', err);
    }
}

window.updatePaymentUI = function (method) {
    const track = document.getElementById('paymentTrack');
    if (!track) return;

    if (method === 'stripe') {
        track.style.transform = 'translateX(0%)';
    } else if (method === 'paypal') {
        track.style.transform = 'translateX(-33.333%)';
    } else if (method === 'bank') {
        track.style.transform = 'translateX(-66.666%)';
    }

    // Update styling for cards
    document.querySelectorAll('.payment-option-card').forEach(card => {
        const input = card.querySelector('input');
        if (input.checked) {
            card.style.borderColor = 'var(--gold)';
            card.style.background = 'white';
            card.style.boxShadow = '0 10px 20px rgba(178, 147, 93, 0.08)';
        } else {
            card.style.borderColor = 'rgba(196, 132, 138, 0.2)';
            card.style.background = 'transparent';
            card.style.boxShadow = 'none';
        }
    });
};

function renderCheckoutSummary() {
    const cartStr = localStorage.getItem('tpn_cart');
    console.log('Rendering Cart from localStorage:', cartStr);

    const cart = JSON.parse(cartStr) || [];
    const checkoutItems = document.getElementById('checkoutItems');
    const coSubtotal = document.getElementById('coSubtotal');
    const coTotal = document.getElementById('coTotal');
    const coShipping = document.getElementById('coShipping');

    if (!checkoutItems || !coSubtotal || !coTotal) {
        console.error('Checkout summary elements missing from DOM');
        return;
    }

    if (cart.length === 0) {
        checkoutItems.innerHTML = '<div style="color: var(--gray); text-align: center; padding: 20px;">Your palace cart is empty.</div>';
        coSubtotal.textContent = '$0.00';
        coTotal.textContent = '$0.00';
        return;
    }

    let subtotal = 0;
    checkoutItems.innerHTML = '';

    cart.forEach(item => {
        let p = item.price;
        if (typeof p === 'string') p = p.replace('$', '');
        const itemPrice = parseFloat(p) || 0;
        const itemQty = parseInt(item.qty) || 0;
        subtotal += itemPrice * itemQty;

        checkoutItems.innerHTML += `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="width: 64px; height: 64px; border-radius: 12px; background-image: url('${item.image}'); background-size: cover; background-position: center; border: 1px solid rgba(196, 132, 138, 0.2); position: relative;">
          <span style="position: absolute; top: -8px; right: -8px; background: var(--gold); color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;">${itemQty}</span>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 14px; margin-bottom: 4px; font-weight: 500;">${item.name}</div>
          <div style="font-size: 12px; color: var(--gray);">$${itemPrice.toFixed(2)}</div>
        </div>
        <div style="font-size: 14px; font-weight: 600; color: var(--ink);">$${(itemPrice * itemQty).toFixed(2)}</div>
      </div>
    `;
    });

    const shippingCost = subtotal >= 75 ? 0 : 10;
    coSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    coShipping.textContent = shippingCost === 0 ? 'Complimentary' : `$${shippingCost.toFixed(2)}`;

    const total = subtotal + shippingCost;
    coTotal.textContent = `$${total.toFixed(2)} USD`;
    console.log('Royal Summary Perfected. Total:', total);
}

window.processCheckout = async function (e) {
    if (e) e.preventDefault();
    console.log('Initiating Palace Transaction...');

    const cartStr = localStorage.getItem('tpn_cart');
    const cart = JSON.parse(cartStr) || [];
    const email = document.getElementById('email')?.value;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    console.log('Order Summary:', { items: cart.length, email, method: paymentMethod });

    if (cart.length === 0) {
        showToast('Your royal cart is empty.');
        return;
    }

    if (!email) {
        showToast('Please enter your email address.');
        return;
    }

    const firstName = document.getElementById('firstName')?.value;
    const lastName = document.getElementById('lastName')?.value;
    const address = document.getElementById('address')?.value;
    const city = document.getElementById('city')?.value;
    const state = document.getElementById('state')?.value;
    const zip = document.getElementById('zip')?.value;
    const country = document.getElementById('country')?.value || 'United States';

    const shippingAddress = {
        line1: address,
        city: city,
        state: state,
        postal_code: zip,
        country: country,
        name: `${firstName} ${lastName}`
    };

    const subtotal = cart.reduce((sum, item) => {
        const p = parseFloat(item.price) || 0;
        const q = parseInt(item.qty) || 0;
        return sum + (p * q);
    }, 0);

    const shippingCost = subtotal >= 75 ? 0 : 10;
    const total = subtotal + shippingCost;

    const btn = document.getElementById('submitOrderBtn');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Processing Your Order...';

    try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Validate Dummy Card (42442 or 16 digits)
        if (paymentMethod === 'stripe') {
            const cardInput = document.querySelector('input[placeholder*="Card number"]');
            const cardNumber = cardInput ? cardInput.value.replace(/\s/g, '') : '';
            console.log('Validating Card... Token length:', cardNumber.length);

            if (!cardNumber || (cardNumber !== '42442' && cardNumber.length < 16)) {
                throw new Error('Please enter the royal testing card (42442) or a valid 16-digit card.');
            }
        }

        // 2. Prepare Payload
        const payload = {
            userId: user?.id || null,
            email,
            items: cart,
            total,
            paymentMethod,
            shippingAddress
        };

        console.log('Sending Payload to Palace Treasury:', payload);

        // 3. Submit to Palace Treasury
        const res = await fetch(`http://localhost:3000/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'The palace treasury rejected this order.');
        }

        const order = await res.json();
        console.log('Order Successfully Recorded:', order.id);

        // 4. Success Response
        showToast('♛ Your royal order has been received!');
        localStorage.removeItem('tpn_cart');

        setTimeout(() => {
            window.location.href = `success.html?order_id=${order.id}`;
        }, 1500);

    } catch (err) {
        console.error('Palace Acquisition Failed:', err);
        showToast('Royal Oversight: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Complete Order ♛';
    }
};

function showToast(message) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}
