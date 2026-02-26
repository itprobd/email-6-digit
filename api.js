// api.js - COMPLETE Email Verification API
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

// RATE LIMITING - 5 req/15min per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: {error: 'Too many requests'}
});
app.use('/send-code', limiter);

// IN-MEMORY OTP STORAGE
const otpStore = new Map();
const EXPIRY = 10 * 60 * 1000; // 10 minutes

// SendGrid Config - FREE 100/day
const transporter = nodemailer.createTransporter({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY // Your free API key
    }
});

// Gmail Alternative
// const transporter = nodemailer.createTransporter({
//     service: 'gmail',
//     auth: {
//         user: process.env.GMAIL_USER,
//         pass: process.env.GMAIL_APP_PASSWORD
//     }
// });

// 🎯 MAIN ENDPOINT
app.post('/send-code', async (req, res) => {
    const { email, customCode } = req.body;
    
    if (!email) {
        return res.status(422).json({ error: 'Email required' });
    }
    
    // Generate or use custom 6-digit code
    const code = customCode || crypto.randomInt(100000, 999999).toString();
    
    // Store OTP
    otpStore.set(email, {
        code,
        expires: Date.now() + EXPIRY
    });
    
    // Send email
    try {
        await transporter.sendMail({
            from: '"Email Verify" <noreply@yourapp.com>',
            to: email,
            subject: 'Your 6-digit verification code',
            html: `
                <div style="font-family: Arial; max-width: 500px; margin: 0 auto;">
                    <h2>🔐 Your Verification Code</h2>
                    <div style="background: #007bff; color: white; font-size: 48px; font-weight: bold; padding: 20px; text-align: center; border-radius: 10px; letter-spacing: 10px;">
                        ${code}
                    </div>
                    <p>This code expires in 10 minutes.</p>
                </div>
            `
        });
        
        console.log(`✅ SENT ${code} → ${email}`);
        res.json({ success: true, message: 'Code sent!', code }); // Remove code in prod
        
    } catch (error) {
        console.error('❌ Send failed:', error);
        res.status(500).json({ error: 'Delivery failed' });
    }
});

// 🔍 VERIFY CODE
app.post('/verify-code', (req, res) => {
    const { email, code } = req.body;
    
    const stored = otpStore.get(email);
    if (!stored || Date.now() > stored.expires) {
        return res.status(400).json({ error: 'Invalid/expired code' });
    }
    
    if (stored.code !== code) {
        return res.status(400).json({ error: 'Wrong code' });
    }
    
    // SUCCESS - Clear OTP
    otpStore.delete(email);
    res.json({ success: true, message: 'Verified!' });
});

// 🎯 PENTEST ENDPOINT - GitHub Repo Scanner
app.post('/github-pentest', async (req, res) => {
    const { repo, email } = req.body;
    const targets = [
        `https://${repo.replace('/', '-')}.github.io/send-code`,
        `https://${repo.split('/')[1]}.vercel.app/api/send-code`,
        `https://${repo.split('/')[1]}-app.netlify.app/verify`
    ];
    
    const results = [];
    for (let url of targets) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            results.push({ url, status: response.status });
        } catch (e) {
            results.push({ url, error: e.message });
        }
    }
    
    res.json({ results });
});

// HEALTH CHECK
app.get('/', (req, res) => res.json({ status: 'Email API LIVE', endpoints: ['/send-code', '/verify-code'] }));

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API LIVE: http://localhost:${PORT}`);
    console.log(`🔑 Set SENDGRID_API_KEY env var`);
});
