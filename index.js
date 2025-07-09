// smartthings-oauth.js
const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 5000;

// Configuration from your SmartThings app
const config = {
  clientId: process.env.SMARTTHINGS_CLIENT_ID,
  clientSecret: process.env.SMARTTHINGS_CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI || 'https://samsung-keus.onrender.com/callback',
  scope: 'r:devices:* x:devices:* r:devices:$ x:devices:$ w:installedapps r:installedapps'
};

// Store tokens (in production, use proper storage)
let tokens = {
  access_token: null,
  refresh_token: null,
  expires_at: null
};

// Home route - starts OAuth flow
app.get('/', (req, res) => {
  res.send(`
    <h1>SmartThings OAuth Example</h1>
    <a href="/auth">Connect to SmartThings</a>
    <br><br>
    ${tokens.access_token ? `
      <p>Access Token: ${tokens.access_token.substring(0, 20)}...</p>
      <p>Expires at: ${new Date(tokens.expires_at).toLocaleString()}</p>
      <a href="/devices">List Devices</a>
    ` : '<p>Not authenticated</p>'}
  `);
});

// Start OAuth flow
app.get('/auth', (req, res) => {
  const authUrl = `https://api.smartthings.com/oauth/authorize?` +
    `client_id=${config.clientId}&` +
    `scope=${encodeURIComponent(config.scope)}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(config.redirectUri)}`;

  console.log('Redirecting to SmartThings OAuth:', authUrl);
  res.redirect(authUrl);
});

// OAuth callback
app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  console.log('OAuth callback received:', { code, error });

  if (error) {
    return res.send(`Error: ${error}`);
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      'https://api.smartthings.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // Store tokens
    tokens.access_token = tokenResponse.data.access_token;
    tokens.refresh_token = tokenResponse.data.refresh_token;
    tokens.expires_at = Date.now() + (tokenResponse.data.expires_in * 1000);

    console.log('Tokens received:', {
      access_token: tokens.access_token.substring(0, 20) + '...',
      refresh_token: tokens.refresh_token.substring(0, 20) + '...',
      expires_in: tokenResponse.data.expires_in
    });

    res.redirect('/');
  } catch (error) {
    console.error('Error exchanging code for tokens:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    res.send(`
      <h1>Error getting tokens</h1>
      <pre>${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>
      <p>Check server console for more details</p>
    `);

  }
});

// Function to refresh access token
async function refreshAccessToken() {
  if (!tokens.refresh_token) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post(
      'https://api.smartthings.com/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: config.clientId,
        client_secret: config.clientSecret
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // Update tokens
    tokens.access_token = response.data.access_token;
    if (response.data.refresh_token) {
      tokens.refresh_token = response.data.refresh_token;
    }
    tokens.expires_at = Date.now() + (response.data.expires_in * 1000);

    console.log('Token refreshed successfully');
    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    throw error;
  }
}

// Middleware to ensure valid access token
async function ensureValidToken(req, res, next) {
  if (!tokens.access_token) {
    return res.redirect('/auth');
  }

  // Check if token is expired or about to expire (5 minutes buffer)
  if (Date.now() >= tokens.expires_at - (5 * 60 * 1000)) {
    try {
      await refreshAccessToken();
    } catch (error) {
      return res.redirect('/auth');
    }
  }

  next();
}

// Example: List devices
app.get('/devices', ensureValidToken, async (req, res) => {
  try {
    const response = await axios.get('https://api.smartthings.com/v1/devices', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json'
      }
    });

    res.json({
      devices: response.data.items,
      count: response.data.items.length
    });
  } catch (error) {
    console.error('Error fetching devices:', error.response?.data || error.message);
    res.status(500).send('Error fetching devices');
  }
});

// Example: Control a device
app.post('/devices/:deviceId/commands', ensureValidToken, express.json(), async (req, res) => {
  const { deviceId } = req.params;
  const { commands } = req.body;

  try {
    const response = await axios.post(
      `https://api.smartthings.com/v1/devices/${deviceId}/commands`,
      { commands },
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error sending command:', error.response?.data || error.message);
    res.status(500).send('Error sending command');
  }
});

app.listen(port, () => {
  console.log(`SmartThings OAuth app listening at http://localhost:${port}`);
  console.log('Make sure to set these environment variables:');
  console.log(`- SMARTTHINGS_CLIENT_ID `+ process.env.SMARTTHINGS_CLIENT_ID);
  console.log(`- SMARTTHINGS_CLIENT_SECRET `+ process.env.SMARTTHINGS_CLIENT_SECRET);
  console.log(`- REDIRECT_URI (optional, defaults to ${process.env.REDIRECT_URI})`);
});