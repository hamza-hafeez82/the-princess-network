require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const supabase = require('./utils/supabase');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up image upload configuration via multer (in-memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Security Middleware
app.use(helmet());

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000'
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this royal site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { status: 'error', message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

app.use(express.json());

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'The Princess Network Backend is running! 👑' });
});

// --- AUTHENTICATION ROUTES ---

// 1. Signup
app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name }
        }
    });

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Signup successful! Please check your email.', user: data.user });
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) return res.status(401).json({ error: error.message });
    res.json({ message: 'Login successful!', session: data.session });
});

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- STORE ROUTES ---

// 0. Fetch Products
app.get('/api/products', async (req, res) => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// 1. Stripe Checkout Route
app.post('/api/checkout', async (req, res) => {
    const { cart, email } = req.body;

    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }

    try {
        // Create line items for Stripe
        const lineItems = cart.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name,
                    images: [item.image.startsWith('http') ? item.image : `${process.env.FRONTEND_URL}/${item.image}`],
                },
                unit_amount: Math.round(item.price * 100), // Stripe expects cents
            },
            quantity: item.qty,
        }));

        // Add shipping if subtotal < 75
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
        if (subtotal < 75) {
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Shipping' },
                    unit_amount: 1000, // $10.00
                },
                quantity: 1,
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            customer_email: email,
            success_url: `${process.env.FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/index.html`,
            metadata: {
                userId: req.body.userId || '',
                cart: JSON.stringify(cart.map(i => ({ id: i.id, qty: i.qty, name: i.name, image: i.image, price: i.price }))),
                shippingAddress: JSON.stringify(req.body.shippingAddress || {})
            }
        });

        res.json({ id: session.id, url: session.url });
    } catch (err) {
        console.error('Stripe Error:', err);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Helper: Send Order Emails (User + Admin)
async function sendOrderEmails(order) {
    try {
        const itemsList = order.items.map(item =>
            `<li style="margin-bottom: 10px; border-bottom: 1px solid #f0f0f0; padding-bottom: 5px;">
                <strong>${item.name}</strong> x${item.qty} - <span style="color: #b2935d;">$${(item.price * item.qty).toFixed(2)}</span>
            </li>`
        ).join('');

        const userEmailHtml = `
            <div style="font-family: 'Jost', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden; background: #fff;">
                <div style="background: #111; padding: 40px; text-align: center; color: #fff;">
                    <div style="font-size: 40px; margin-bottom: 20px;">♛</div>
                    <h1 style="font-family: 'Cinzel', serif; margin: 0; letter-spacing: 4px; text-transform: uppercase; font-size: 24px;">Royal Confirmation</h1>
                </div>
                <div style="padding: 40px;">
                    <p style="font-size: 16px; line-height: 1.6; color: #444;">Your presence in the Inner Circle is honored. We have received your order and our curators are already preparing your selections.</p>
                    
                    <div style="background: #faf4ee; padding: 25px; border-radius: 15px; margin: 30px 0; border: 1px solid rgba(178,147,93,0.1);">
                        <h3 style="margin-top: 0; color: #b2935d; font-family: 'Cinzel', serif; letter-spacing: 1px;">Order Details (#${order.id.slice(0, 8).toUpperCase()})</h3>
                        <ul style="padding-left: 0; list-style: none; margin: 20px 0;">
                            ${itemsList}
                        </ul>
                        <hr style="border: none; border-top: 1px solid rgba(178,147,93,0.2); margin: 20px 0;">
                        <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 18px; color: #111;">
                            <span>Royal Total</span>
                            <span style="color: #b2935d;">$${order.total_amount.toFixed(2)}</span>
                        </div>
                    </div>

                    <div style="margin-top: 30px; padding: 20px; border-left: 4px solid #b2935d; background: #fcfcfc;">
                        <h4 style="margin-top: 0; font-family: 'Cinzel', serif; size: 14px;">Cancellation Information</h4>
                        <p style="font-size: 13px; color: #666; line-height: 1.5;">Should you wish to rescind your acquisition, please contact our curators at <strong>support@theprincessnetwork.com</strong> within 12 hours of placing your order. Once our curators have dispatched your items from the palace, cancellations are no longer possible.</p>
                    </div>

                    <p style="font-size: 14px; color: #888; margin-top: 30px; text-align: center;">We will notify you once your items have been dispatched from the palace.</p>
                </div>
                <div style="padding: 20px; background: #111; text-align: center; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 2px;">
                    &copy; 2026 The Princess Network • Palace Curators
                </div>
            </div>
        `;

        const adminEmailHtml = `
            <div style="font-family: 'Jost', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #111; background: #fff;">
                <div style="background: #b2935d; padding: 20px; text-align: center; color: #fff;">
                    <h2 style="font-family: 'Cinzel', serif; margin: 0; letter-spacing: 2px;">NEW ROYAL ACQUISITION</h2>
                </div>
                <div style="padding: 30px;">
                    <p style="font-size: 16px; margin-bottom: 20px;">A new order has been received and requires your royal attention.</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Order ID:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">#${order.id.slice(0, 8).toUpperCase()}</td></tr>
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Customer:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${order.customer_email}</td></tr>
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Method:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${order.payment_method}</td></tr>
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Total:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee; color: #b2935d; font-weight: bold;">$${order.total_amount.toFixed(2)}</td></tr>
                    </table>

                    <div style="background: #fafafa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h4 style="margin-top: 0;">Items:</h4>
                        <ul style="padding-left: 20px;">${itemsList}</ul>
                    </div>

                    <a href="${process.env.FRONTEND_URL}/admin-orders.html" style="display: block; background: #111; color: #fff; padding: 15px; text-align: center; text-decoration: none; font-family: 'Cinzel', serif; letter-spacing: 2px; border-radius: 5px;">MANAGE ORDER IN PALACE</a>
                </div>
            </div>
        `;

        // 1. Send to User
        const userRes = await resend.emails.send({
            from: 'The Princess Network <onboarding@resend.dev>', // Using Resend's testing domain for reliability
            to: order.customer_email,
            subject: '♛ Your Royal Order is Confirmed!',
            html: userEmailHtml
        });
        if (userRes.error) {
            console.error('User Confirmation Failed:', userRes.error.message);
        } else {
            console.log('User Confirmation Dispatched:', userRes.data?.id);
        }

        // 2. Send to Admin
        const adminRes = await resend.emails.send({
            from: 'The Princess Network System <onboarding@resend.dev>',
            to: process.env.ADMIN_EMAIL || 'admin@theprincessnetwork.com',
            subject: `NEW ORDER: #${order.id.slice(0, 8).toUpperCase()} - $${order.total_amount.toFixed(2)}`,
            html: adminEmailHtml
        });
        if (adminRes.error) {
            console.error('Admin Alert Failed:', adminRes.error.message);
        } else {
            console.log('Admin Alert Dispatched:', adminRes.data?.id);
        }

        console.log('Royal Order emails processed for:', order.id);
    } catch (err) {
        console.error('Failed to process royal order emails:', err);
    }
}

// 2. Stripe Webhook
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        try {
            // 1. Save order to Supabase
            const { data: order, error: dbError } = await supabase
                .from('orders')
                .insert([{
                    user_id: session.metadata.userId || null,
                    customer_email: session.customer_details.email,
                    total_amount: session.amount_total / 100,
                    stripe_session_id: session.id,
                    status: 'paid',
                    payment_method: 'stripe',
                    items: JSON.parse(session.metadata.cart || '[]'),
                    shipping_address: JSON.parse(session.metadata.shippingAddress || '{}')
                }])
                .select()
                .single();

            if (dbError) throw dbError;

            // 2. Send confirmation emails
            await sendOrderEmails(order);

            console.log('Order processed successfully via Webhook:', order.id);
        } catch (err) {
            console.error('Error processing webhook order:', err);
        }
    }

    res.json({ received: true });
});

// 3. Orders Route (Supabase)
app.get('/api/orders', async (req, res) => {
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// 3.1 Create Order (Manual/Guest/Other Payments)
app.post('/api/orders', async (req, res) => {
    const { userId, email, items, total, paymentMethod, shippingAddress } = req.body;

    try {
        const { data: order, error } = await supabase
            .from('orders')
            .insert([{
                user_id: userId || null,
                customer_email: email,
                items,
                total_amount: total,
                payment_method: paymentMethod,
                status: (paymentMethod === 'bank') ? 'pending' : 'paid',
                shipping_address: shippingAddress
            }])
            .select()
            .single();

        if (error) throw error;

        // Send emails
        await sendOrderEmails(order);

        res.status(201).json(order);
    } catch (err) {
        console.error('Manual Order Error:', err);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// --- ADMIN ROUTES ---

// Admin Check Middleware
const isAdmin = async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (error || profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access only' });
    }
    next();
};

// 1. Product CRUD
app.post('/api/admin/products', isAdmin, async (req, res) => {
    const { name, price, image, category, badge, is_active } = req.body;
    const { data, error } = await supabase
        .from('products')
        .insert([{ name, price, image, category, badge, is_active: is_active ?? true }])
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
});

app.put('/api/admin/products/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, price, image, category, badge, is_active } = req.body;
    const { data, error } = await supabase
        .from('products')
        .update({ name, price, image, category, badge, is_active })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

app.delete('/api/admin/products/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Product successfully removed from treasury' });
});

// Image Upload Endpoint (bypasses RLS utilizing the backend service_role key)
app.post('/api/admin/upload-image', isAdmin, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    try {
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('product-images')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

        res.status(200).json({ url: publicUrl });
    } catch (err) {
        console.error('Image Upload Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Order Management
app.get('/api/admin/orders', isAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

app.patch('/api/admin/orders/:id/status', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const { data, error } = await supabase
        .from('orders')
        .update({ status, admin_notes: adminNotes })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// 3. User Management
app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        // Fetch profiles
        const { data: profiles, error: pErr } = await supabase
            .from('profiles')
            .select('*')
            .order('updated_at', { ascending: false });
        if (pErr) throw pErr;

        // Fetch auth users using service role key
        const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
        if (uErr) throw uErr;

        // Merge email into profiles
        const merged = profiles.map(p => {
            const user = users.find(u => u.id === p.id);
            return { ...p, email: user ? user.email : null };
        });

        res.json(merged);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.patch('/api/admin/users/:id/role', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid royal role' });
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// 4. Palace Metrics (Stats)
app.get('/api/admin/stats', isAdmin, async (req, res) => {
    try {
        const { data: orders } = await supabase.from('orders').select('total_amount');
        const { count: users } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: products } = await supabase.from('products').select('*', { count: 'exact', head: true });

        const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

        res.json({
            totalRevenue,
            orderCount: orders.length,
            userCount: users,
            productCount: products
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to compute palace metrics' });
    }
});

// 4. Cart Routes
app.get('/api/cart', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const { data, error } = await supabase
        .from('cart_items')
        .select(`
            qty,
            products (*)
        `)
        .eq('user_id', userId);

    if (error) return res.status(400).json({ error: error.message });

    // Format to match frontend cart structure
    const formatted = data.map(item => ({
        ...item.products,
        qty: item.qty
    }));
    res.json(formatted);
});

app.post('/api/cart/sync', async (req, res) => {
    const { userId, cart } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        // 1. Clear existing cart
        await supabase.from('cart_items').delete().eq('user_id', userId);

        // 2. Insert new cart items
        const itemsToInsert = cart.map(item => ({
            user_id: userId,
            product_id: item.id,
            qty: item.qty
        }));

        if (itemsToInsert.length > 0) {
            const { error } = await supabase.from('cart_items').insert(itemsToInsert);
            if (error) throw error;
        }

        res.json({ message: 'Cart synchronized successfully' });
    } catch (err) {
        console.error('Cart Sync Error:', err);
        res.status(500).json({ error: 'Failed to sync cart' });
    }
});

// 5. Profile Route
app.get('/api/profile', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
