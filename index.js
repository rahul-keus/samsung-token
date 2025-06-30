const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const app = express();
dotenv.config();

const PORT = 5000;
const AUTH_BASE = 'https://auth-global.api.smartthings.com/oauth';

app.get('/', (req, res) => {
    res.send(`<a href="/login">Login with SmartThings</a>`);
});

app.get('/login', (req, res) => {
    const authUrl = `${AUTH_BASE}/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&scope=${encodeURIComponent(process.env.SCOPES)}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing authorization code');

    try {
        const tokenUrl = `${AUTH_BASE}/token`;
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('client_id', process.env.CLIENT_ID);
        params.append('client_secret', process.env.CLIENT_SECRET);
        params.append('redirect_uri', process.env.REDIRECT_URI);

        const response = await axios.post(tokenUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        res.send(`
            <h1>SmartThings Tokens</h1>
            <p><strong>Access Token:</strong> ${response.data.access_token}</p>
            <p><strong>Refresh Token:</strong> ${response.data.refresh_token}</p>
            <p><strong>Token Type:</strong> ${response.data.token_type}</p>
            <p><strong>Expires In:</strong> ${response.data.expires_in} seconds</p>
        `);
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).send('Failed to get tokens');
    }
});

app.listen(PORT, () => {
    console.log(`SmartThings OAuth app listening at http://localhost:${PORT}`);
});
