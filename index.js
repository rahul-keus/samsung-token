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

// Debug configuration endpoint
app.get('/debug', (req, res) => {
  res.json({
    environment: 'Render',
    configValid: configValid,
    config: {
      clientId: config.clientId,
      clientSecret: config.clientSecret ? 'SET' : 'NOT SET',
      redirectUri: config.redirectUri,
      scope: config.scope
    },
    tokens: {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresAt: tokens.expires_at ? new Date(tokens.expires_at).toISOString() : null,
      isExpired: tokens.expires_at ? Date.now() > tokens.expires_at : null
    },
    currentTime: new Date().toISOString()
  });
});

// Start OAuth flow
app.get('/auth', (req, res) => {
  if (!configValid) {
    return res.send(`
      <h1>❌ Configuration Error</h1>
      <p>Please set the required environment variables in Render:</p>
      <ul>
        <li>SMARTTHINGS_CLIENT_ID</li>
        <li>SMARTTHINGS_CLIENT_SECRET</li>
      </ul>
      <a href="/">← Back to Home</a>
    `);
  }

  const authUrl = `https://api.smartthings.com/oauth/authorize?` +
    `client_id=${config.clientId}&` +
    `scope=${encodeURIComponent(config.scope)}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(config.redirectUri)}`;

  console.log('=== Starting OAuth Flow ===');
  console.log('Auth URL:', authUrl);
  console.log('Client ID:', config.clientId);
  console.log('Redirect URI:', config.redirectUri);
  console.log('Scope:', config.scope);

  res.redirect(authUrl);
});

// OAuth callback
app.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;

  console.log('=== OAuth Callback Debug ===');
  console.log('Query parameters:', req.query);
  console.log('Code received:', code);
  console.log('Error received:', error);
  console.log('Config being used:', {
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    clientSecret: config.clientSecret ? '***SET***' : 'NOT SET'
  });

  if (error) {
    console.error('OAuth error received:', error);
    return res.send(`Error: ${error}`);
  }

  if (!code) {
    console.error('No authorization code received');
    return res.send('No authorization code received');
  }

  try {
    console.log('Attempting token exchange...');

    // SmartThings expects Basic Auth for client credentials (discovered from www-authenticate header)
    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    // Prepare token exchange request (WITHOUT client credentials in body)
    const tokenRequestData = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: config.redirectUri
    };

    console.log('Token request data (Basic Auth method):', tokenRequestData);
    console.log('Using Basic Auth header with client credentials');

    // Exchange authorization code for tokens
    console.log('Making token exchange request to:', 'https://api.smartthings.com/oauth/token');

    const requestHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Authorization': `Basic ${basicAuth}`,
      'User-Agent': 'Keus-Samsung-TV-Controller/1.0'
    };

    console.log('Request headers (auth hidden):', {
      ...requestHeaders,
      'Authorization': 'Basic ***HIDDEN***'
    });

    const requestBody = new URLSearchParams(tokenRequestData);
    console.log('Request body (URL encoded):', requestBody.toString());

    const tokenResponse = await axios({
      method: 'POST',
      url: 'https://api.smartthings.com/oauth/token',
      data: requestBody.toString(),
      headers: requestHeaders,
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: function (status) {
        return status >= 200 && status < 600; // Don't throw on any status to see full response
      }
    });

    console.log('Token exchange response status:', tokenResponse.status);
    console.log('Token exchange response data:', tokenResponse.data);
    console.log('Token exchange response headers:', tokenResponse.headers);

    // Check if the response was successful
    if (tokenResponse.status >= 200 && tokenResponse.status < 300) {
      console.log('Token exchange successful!');

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
    } else {
      // Handle non-success status codes
      throw new Error(`Token exchange failed with status ${tokenResponse.status}: ${JSON.stringify(tokenResponse.data)}`);
    }
  } catch (error) {
    console.error('=== Token Exchange Failed ===');
    console.error('Error status:', error.response?.status);
    console.error('Error status text:', error.response?.statusText);
    console.error('Error message:', error.message);
    console.error('Response data:', error.response?.data);
    console.error('Response headers:', error.response?.headers);
    console.error('Request URL:', error.config?.url);
    console.error('Request method:', error.config?.method);
    console.error('Request data:', error.config?.data);
    console.error('Request headers:', error.config?.headers);

    // Additional debugging for SmartThings specific issues
    console.error('=== SmartThings OAuth Debug ===');
    console.error('Client ID used:', config.clientId);
    console.error('Redirect URI used:', config.redirectUri);
    console.error('Authorization code received:', code?.substring(0, 10) + '...');
    console.error('Full request payload:', 'tokenRequestData not available in error scope');

    // Check for specific 401 error patterns
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - This usually means:');
      console.error('1. Invalid client_id or client_secret');
      console.error('2. Authorization code has expired or already been used');
      console.error('3. Redirect URI mismatch');
      console.error('4. Client not configured properly in SmartThings Developer Console');
    }

    res.send(`
      <h1>❌ Error getting tokens</h1>
      <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Status: ${error.response?.status || 'Unknown'}</h3>
        <p><strong>Error:</strong> ${error.message}</p>
        ${error.response?.data ? `<p><strong>Details:</strong> ${JSON.stringify(error.response.data, null, 2)}</p>` : ''}
      </div>
      
      <h3>🔧 Troubleshooting Steps:</h3>
      <ol>
        <li>Check your SmartThings Developer Console OAuth settings</li>
        <li>Verify redirect URI matches exactly: <code>${config.redirectUri}</code></li>
        <li>Ensure client credentials are correct</li>
        <li>Try the authentication flow again (authorization codes expire quickly)</li>
      </ol>
      
      <a href="/" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">← Back to Home</a>
      
      <details style="margin-top: 30px;">
        <summary>Debug Information</summary>
        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">
Config:
- Client ID: ${config.clientId}
- Redirect URI: ${config.redirectUri}
- Client Secret: ${config.clientSecret ? 'SET' : 'NOT SET'}

Error Details:
${JSON.stringify({
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    }, null, 2)}
        </pre>
      </details>
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