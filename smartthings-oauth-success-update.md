# Updated Email to SmartThings Support Team

**To:** build@smartthings.com  
**Subject:** [RESOLVED] OAuth 2.0 Implementation Success - Documentation of Basic Auth Discovery

---

Dear SmartThings Developer Support Team,

**Update:** We have successfully resolved our OAuth 2.0 implementation issue and wanted to share our findings with your team for documentation and to help other developers.

## **Issue Resolution Summary**

- ✅ **RESOLVED**: OAuth token exchange now working correctly
- 🔑 **Key Discovery**: SmartThings requires Basic Authentication for client credentials
- 📚 **Documentation Gap**: This requirement wasn't clearly documented

## **The Solution That Worked**

### **Problem Was**: Form Data Authentication (Standard OAuth)

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=XXXX&
client_id=XXXX&
client_secret=XXXX&
redirect_uri=XXXX
```

**Result**: 401 Unauthorized with `www-authenticate: Basic realm="oauth2/client"`

### **Solution**: Basic Authentication for Client Credentials

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=authorization_code&
code=XXXX&
redirect_uri=XXXX
```

**Result**: ✅ Success - proper OAuth error responses and successful token exchange

## **Implementation Details**

### **Working App Configuration**

```
App Type: API_ONLY (with OAuth support)
OAuth Client ID: ba146c31-971a-4325-8414-3d411007dc48
OAuth Client Secret: 4e4f0e8a-c238-4d4c-b8b0-de0a0d993b4c
Scopes: r:devices:*, x:devices:*
Redirect URI: https://samsung-keus.onrender.com/callback
Principal Type: LOCATION
```

### **Working Token Exchange Code (Node.js)**

```javascript
const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

const response = await axios({
  method: "POST",
  url: "https://api.smartthings.com/oauth/token",
  data: new URLSearchParams({
    grant_type: "authorization_code",
    code: authorizationCode,
    redirect_uri: redirectUri,
    // Note: NO client credentials in form data
  }).toString(),
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    Authorization: `Basic ${basicAuth}`, // Client credentials here
  },
});
```

## **Key Learnings**

### **1. Authentication Method**

- SmartThings OAuth requires Basic Auth for client credentials
- This differs from many OAuth providers that accept form data
- The `www-authenticate: Basic realm="oauth2/client"` header was the key clue

### **2. App Type Compatibility**

- `API_ONLY` apps with OAuth configuration work perfectly
- No need for `WEBAPP_SMARTAPP` type for OAuth flows
- CLI app creation produces correct OAuth-enabled configurations

### **3. Authorization Code Behavior**

- Codes expire within 10 minutes (possibly less)
- Single-use only - cannot retry with same code
- Proper error responses: `{"error":"invalid_grant","error_description":"Invalid authorization code: XXXX"}`

## **Documentation Suggestion**

Consider updating the OAuth documentation to clearly specify:

1. **Basic Authentication Requirement**:

   ```
   Client credentials MUST be sent via Authorization header using Basic authentication,
   not in the form data body.
   ```

2. **Code Example**:

   ```javascript
   // Correct method for SmartThings OAuth
   headers: {
     'Authorization': `Basic ${Buffer.from(clientId + ':' + clientSecret).toString('base64')}`
   }
   ```

3. **Common Pitfall Warning**:
   ```
   ⚠️ Unlike some OAuth providers, SmartThings does NOT accept client credentials
   in the form data. Use Basic Auth header instead.
   ```

## **Business Impact**

- ✅ Successfully migrated from daily-expiring PATs to long-term OAuth tokens
- ✅ Production Samsung TV control application now has stable authentication
- ✅ Automatic token refresh eliminates daily maintenance

## **Thank You**

While we resolved this independently, the robust error responses from your OAuth endpoints (especially the `www-authenticate` header) provided the crucial clues needed for success.

This implementation is now working perfectly for Samsung TV control via SmartThings API.

## **For Other Developers**

If this helps update documentation or assists other developers facing similar issues, we're happy to have contributed to the community knowledge base.

Best regards,

---

**App Details:**

- App ID: a6901030-4064-436f-a660-31490c64e744
- Use Case: Samsung TV Control via OAuth
- Status: ✅ Production Ready

**Technical Environment:**

- Platform: Node.js on Render
- Application: https://samsung-keus.onrender.com
- OAuth Flow: Authorization Code with Basic Auth
