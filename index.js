// smartthings-oauth.js
const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Configuration from your SmartThings app
const config = {
  clientId: process.env.SMARTTHINGS_CLIENT_ID,
  clientSecret: process.env.SMARTTHINGS_CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI || 'https://samsung-keus.onrender.com/callback',
  scope: 'r:devices:* x:devices:* r:devices:$ x:devices:$'
};

const fs = require('fs');
const path = require('path');

// Store tokens (file-based storage for Render deployment)
const TOKEN_FILE = path.join(__dirname, 'tokens.json');

let tokens = {
  access_token: null,
  refresh_token: null,
  expires_at: null
};

// Load tokens from file on startup
function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      tokens = JSON.parse(data);
      console.log('Tokens loaded from file');
    }
  } catch (error) {
    console.log('No existing tokens found, starting fresh');
  }
}

// Save tokens to file
function saveTokens() {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log('Tokens saved to file');
  } catch (error) {
    console.error('Error saving tokens:', error.message);
  }
}

// Load tokens on startup
loadTokens();

// Validate environment variables
function validateConfig() {
  const missing = [];

  if (!config.clientId) missing.push('SMARTTHINGS_CLIENT_ID');
  if (!config.clientSecret) missing.push('SMARTTHINGS_CLIENT_SECRET');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set these in your Render environment variables');
    return false;
  }

  console.log('✅ Environment variables validated');
  return true;
}

// Validate config on startup
const configValid = validateConfig();

// Home route - starts OAuth flow
app.get('/', (req, res) => {
  const isTokenValid = tokens.access_token && Date.now() < tokens.expires_at;
  const timeToExpiry = tokens.expires_at ? Math.max(0, Math.floor((tokens.expires_at - Date.now()) / 1000 / 60)) : 0;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Samsung SmartThings Controller</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .warning { background-color: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .error { background-color: #f8d7da; color: #721c24; border: 1px solid #f1aeb5; }
        .button { display: inline-block; padding: 10px 20px; margin: 5px; text-decoration: none; 
                 border-radius: 5px; background-color: #007bff; color: white; }
        .api-links { margin-top: 20px; }
        .api-links a { display: block; margin: 5px 0; }
      </style>
    </head>
    <body>
      <h1>Samsung SmartThings TV Controller</h1>
      
      ${!configValid ? `
        <div class="status error">
          <strong>❌ Configuration Error:</strong> Missing environment variables. 
          Please set SMARTTHINGS_CLIENT_ID and SMARTTHINGS_CLIENT_SECRET in Render.
        </div>
      ` : ''}
      
      ${!tokens.access_token ? `
        <div class="status warning">
          <strong>⚠️ Not Authenticated:</strong> Click below to authenticate with SmartThings
        </div>
        <a href="/auth" class="button">🔐 Connect to SmartThings</a>
      ` : ''}
      
      ${isTokenValid ? `
        <div class="status success">
          <strong>✅ Authenticated:</strong> Token valid for ${timeToExpiry} minutes
        </div>
        <div class="api-links">
          <h3>Available Endpoints:</h3>
          <a href="/devices">📱 List All Devices</a>
          <a href="/tvs">📺 List Samsung TVs</a>
        </div>
        
        <h3>TV Control APIs:</h3>
        <p><strong>POST</strong> /tvs/{deviceId}/power - Body: {"action": "on/off"}</p>
        <p><strong>POST</strong> /tvs/{deviceId}/volume - Body: {"level": 0-100}</p>
        <p><strong>POST</strong> /tvs/{deviceId}/channel - Body: {"channel": "channelNumber"}</p>
      ` : ''}
      
      ${tokens.access_token && !isTokenValid ? `
        <div class="status error">
          <strong>❌ Token Expired:</strong> Please re-authenticate
        </div>
        <a href="/auth" class="button">🔐 Re-authenticate</a>
      ` : ''}
      
      <div style="margin-top: 30px; font-size: 12px; color: #666;">
        <p>App URL: ${config.redirectUri}</p>
        <p>SmartThings OAuth Scopes: ${config.scope}</p>
      </div>
    </body>
    </html>
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

    // Save tokens to file
    saveTokens();

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

    // Save refreshed tokens to file
    saveTokens();

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

// Samsung TV specific routes
app.get('/tvs', ensureValidToken, async (req, res) => {
  try {
    const response = await axios.get('https://api.smartthings.com/v1/devices', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json'
      }
    });

    // Filter for Samsung TVs
    const tvs = response.data.items.filter(device =>
      device.deviceTypeName === 'Samsung OCF TV' ||
      device.deviceTypeName === 'Samsung TV' ||
      device.name.toLowerCase().includes('tv') ||
      device.label?.toLowerCase().includes('tv')
    );

    res.json({
      tvs: tvs,
      count: tvs.length,
      message: tvs.length > 0 ? 'Samsung TVs found' : 'No Samsung TVs found'
    });
  } catch (error) {
    console.error('Error fetching TVs:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error fetching TVs', details: error.message });
  }
});

// TV Control Commands
app.post('/tvs/:deviceId/power', ensureValidToken, async (req, res) => {
  const { deviceId } = req.params;
  const { action } = req.body; // 'on' or 'off'

  try {
    const command = action === 'on' ? 'on' : 'off';
    const response = await axios.post(
      `https://api.smartthings.com/v1/devices/${deviceId}/commands`,
      {
        commands: [{
          component: 'main',
          capability: 'switch',
          command: command
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true, action: command, response: response.data });
  } catch (error) {
    console.error('Error controlling TV power:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error controlling TV power', details: error.message });
  }
});

app.post('/tvs/:deviceId/volume', ensureValidToken, express.json(), async (req, res) => {
  const { deviceId } = req.params;
  const { level } = req.body; // volume level 0-100

  try {
    const response = await axios.post(
      `https://api.smartthings.com/v1/devices/${deviceId}/commands`,
      {
        commands: [{
          component: 'main',
          capability: 'audioVolume',
          command: 'setVolume',
          arguments: [parseInt(level)]
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true, volume: level, response: response.data });
  } catch (error) {
    console.error('Error setting TV volume:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error setting TV volume', details: error.message });
  }
});

app.post('/tvs/:deviceId/channel', ensureValidToken, express.json(), async (req, res) => {
  const { deviceId } = req.params;
  const { channel } = req.body;

  try {
    const response = await axios.post(
      `https://api.smartthings.com/v1/devices/${deviceId}/commands`,
      {
        commands: [{
          component: 'main',
          capability: 'tvChannel',
          command: 'setTvChannel',
          arguments: [channel.toString()]
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true, channel: channel, response: response.data });
  } catch (error) {
    console.error('Error changing TV channel:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error changing TV channel', details: error.message });
  }
});

// Example: Control a device (generic)
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
    res.status(500).json({ error: 'Error sending command', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`SmartThings OAuth app listening at http://localhost:${port}`);
  console.log('Make sure to set these environment variables:');
  console.log(`- SMARTTHINGS_CLIENT_ID ` + process.env.SMARTTHINGS_CLIENT_ID);
  console.log(`- SMARTTHINGS_CLIENT_SECRET ` + process.env.SMARTTHINGS_CLIENT_SECRET);
  console.log(`- REDIRECT_URI (optional, defaults to ${process.env.REDIRECT_URI})`);
});