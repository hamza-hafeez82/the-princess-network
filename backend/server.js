require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'The Princess Network Backend is running! 👑' });
});

// --- PLACEHOLDER ROUTES ---

// 1. Stripe Checkout Route
app.post('/api/checkout', async (req, res) => {
    // TODO: Implement Stripe Checkout Session creation
    res.json({ message: 'Checkout endpoint' });
});

// 2. Stripe Webhook (must use raw body)
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    // TODO: Implement Stripe Webhook handling for successful payments
    res.send();
});

// 3. Orders Route (Supabase)
app.get('/api/orders', async (req, res) => {
    // TODO: Fetch user orders from Supabase
    res.json({ message: 'Orders endpoint' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
