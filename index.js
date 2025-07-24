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

let tokens = {
  access_token: null,
  refresh_token: null,
  expires_at: null
};

// Home route - starts OAuth flow
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Samsung SmartThings Controller</title>
    </head>
    <body>
      <h1>Samsung SmartThings TV Controller</h1>    
      <a href="/auth">🔐 Connect to SmartThings</a>
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
  console.log('Callback timestamp:', new Date().toISOString());
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
    console.log('Token exchange timestamp:', new Date().toISOString());

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

      console.log('Tokens received:', {
        access_token: tokens.access_token.substring(0, 20) + '...',
        refresh_token: tokens.refresh_token.substring(0, 20) + '...',
        expires_in: tokenResponse.data.expires_in
      });

      res.redirect('/');
    } else {
      // Handle non-success status codes with specific OAuth error handling
      const errorData = tokenResponse.data;

      if (errorData?.error === 'invalid_grant' && errorData?.error_description?.includes('Invalid authorization code')) {
        console.log('❌ Authorization code invalid or expired - user needs to re-authenticate');
        return res.send(`
          <h1>🔄 Authorization Code Expired</h1>
          <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Code Already Used or Expired</h3>
            <p><strong>Issue:</strong> ${errorData.error_description}</p>
            <p><strong>Reason:</strong> Authorization codes can only be used once and expire within 10 minutes.</p>
          </div>
          
          <h3>📝 What to do:</h3>
          <ol>
            <li>Authorization codes are single-use and expire quickly</li>
            <li>You need to start the OAuth flow again with a fresh code</li>
            <li>Don't refresh or go back - use the button below</li>
          </ol>
          
          <a href="/auth" style="display: inline-block; padding: 15px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; font-size: 16px; margin: 20px 0;">
            🔐 Start Fresh Authentication
          </a>
          
          <div style="margin-top: 30px; font-size: 12px; color: #666;">
            <p><strong>Debug Info:</strong> Code '${errorData.error_description?.split(': ')[1]}' has been consumed or expired</p>
          </div>
        `);
      }

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

app.listen(port, () => {
  console.log(`SmartThings OAuth app listening at http://localhost:${port}`);
  console.log('Make sure to set these environment variables:');
  console.log(`- SMARTTHINGS_CLIENT_ID ` + process.env.SMARTTHINGS_CLIENT_ID);
  console.log(`- SMARTTHINGS_CLIENT_SECRET ` + process.env.SMARTTHINGS_CLIENT_SECRET);
  console.log(`- REDIRECT_URI (optional, defaults to ${process.env.REDIRECT_URI})`);
});