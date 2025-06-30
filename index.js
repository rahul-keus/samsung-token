const express = require('express');
const axios = require('axios');
const qs = require('qs');

const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = 5000;

// From CLI
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

// Step 1: Start OAuth flow
app.get('/login', (req, res) => {
  const authUrl = `https://auth-global.api.smartthings.com/oauth/authorize?` +
    qs.stringify({
      client_id: clientId,
      response_type: 'code',
      scope: 'r:devices:* x:devices:*',
      redirect_uri: redirectUri
    });
    console.log(`Redirecting to: ${authUrl}`);
  
  res.redirect(authUrl);
});

// Step 2: Receive callback
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const response = await axios.post(
      'https://auth-global.api.smartthings.com/oauth/token',
      qs.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('Token exchange successful:', response.data);
    const { access_token, refresh_token, expires_in } = response.data;

    res.send(`
      <h2>Token Received</h2>
      <p><strong>Access Token:</strong> ${access_token}</p>
      <p><strong>Refresh Token:</strong> ${refresh_token}</p>
      <p><strong>Expires In:</strong> ${expires_in} seconds</p>
    `);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Token exchange failed.');
  }
});

app.listen(port, () => {
  console.log(`Keus OAuth app listening at http://localhost:${port}`);
});
