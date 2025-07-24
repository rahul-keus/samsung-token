# Samsung SmartThings TV Controller - Deployment Guide

## Overview

This application implements SmartThings OAuth 2.0 flow to obtain user access tokens and refresh tokens for controlling Samsung TVs through the SmartThings API. Unlike Personal Access Tokens (PAT) that expire quickly, this OAuth implementation provides long-term access with automatic token refresh.

## 🚀 Render Deployment Setup

### 1. Create Render Web Service

1. Connect your GitHub repository to Render
2. Create a new **Web Service**
3. Configure the following:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

### 2. Environment Variables in Render

Set these environment variables in your Render dashboard:

```
SMARTTHINGS_CLIENT_ID=your_client_id_here
SMARTTHINGS_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=https://your-app-name.onrender.com/callback
```

## 🔧 SmartThings Developer Console Setup

### 1. Create SmartThings App

1. Go to [SmartThings Developer Portal](https://developer.smartthings.com/)
2. Sign in with your Samsung account
3. Click **"Create Project"** → **"Device Integration"** → **"SmartApp"**

### 2. Configure OAuth Settings

1. In your SmartThings app settings:
   - **App Type**: WebHook Endpoint
   - **Target URL**: `https://your-app-name.onrender.com/callback`
   - **OAuth2 Configuration**:
     - **Client ID**: Copy this to your Render environment variables
     - **Client Secret**: Copy this to your Render environment variables
     - **Redirect URIs**: `https://your-app-name.onrender.com/callback`
     - **Scope**: `r:devices:* x:devices:*`

### 3. App Permissions

Grant these permissions:

- **Devices**: Read and Execute
- **Locations**: Read (if needed)

## 📱 Authentication Flow

### How OAuth Works vs PAT

- **PAT (Personal Access Token)**: Expires in 24 hours, requires manual regeneration
- **OAuth**: Long-lived access tokens with automatic refresh, better security

### Authentication Steps

1. User visits your app: `https://your-app-name.onrender.com/`
2. Click "Connect to SmartThings" → Redirected to SmartThings OAuth
3. User grants permissions → SmartThings redirects back with authorization code
4. App exchanges code for access_token + refresh_token
5. Tokens are automatically refreshed when needed

## 🎮 API Endpoints

### Device Management

- `GET /devices` - List all SmartThings devices
- `GET /tvs` - List Samsung TVs only

### TV Control

- `POST /tvs/{deviceId}/power` - Turn TV on/off

  ```json
  { "action": "on" } // or "off"
  ```

- `POST /tvs/{deviceId}/volume` - Set volume (0-100)

  ```json
  { "level": 50 }
  ```

- `POST /tvs/{deviceId}/channel` - Change channel
  ```json
  { "channel": "123" }
  ```

## 🔍 Testing Your Setup

### 1. Check App Status

Visit `https://your-app-name.onrender.com/` to see:

- Configuration validation
- Authentication status
- Available endpoints

### 2. Test TV Discovery

```bash
curl https://your-app-name.onrender.com/tvs
```

### 3. Test TV Control

```bash
# Turn TV on
curl -X POST https://your-app-name.onrender.com/tvs/DEVICE_ID/power \
  -H "Content-Type: application/json" \
  -d '{"action": "on"}'

# Set volume to 50
curl -X POST https://your-app-name.onrender.com/tvs/DEVICE_ID/volume \
  -H "Content-Type: application/json" \
  -d '{"level": 50}'
```

## 🛠️ Troubleshooting

### Common Issues

1. **"Missing environment variables"**

   - Ensure `SMARTTHINGS_CLIENT_ID` and `SMARTTHINGS_CLIENT_SECRET` are set in Render

2. **"OAuth callback error"**

   - Verify redirect URI matches exactly: `https://your-app-name.onrender.com/callback`
   - Check SmartThings app OAuth configuration

3. **"No TVs found"**

   - Ensure your Samsung TV is connected to SmartThings
   - Check TV permissions in SmartThings app

4. **"Token expired"**
   - The app automatically refreshes tokens
   - If refresh fails, re-authenticate by visiting `/auth`

### Debug Logs

Check Render logs for detailed error information:

- Token refresh attempts
- API call responses
- OAuth flow steps

## 🔐 Security Notes

- Tokens are stored in `tokens.json` (excluded from git)
- Automatic token refresh prevents expiration
- Use HTTPS for all communications
- Environment variables protect sensitive data

## 📞 Support

If you encounter issues:

1. Check Render deployment logs
2. Verify SmartThings app configuration
3. Test OAuth flow step by step
4. Ensure Samsung TV is properly connected to SmartThings
