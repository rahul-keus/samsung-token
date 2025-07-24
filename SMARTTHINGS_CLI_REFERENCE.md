# SmartThings CLI Commands Reference Guide

**Complete reference of commands used during Samsung TV OAuth implementation**

---

## 📋 **Table of Contents**

1. [App Management Commands](#app-management-commands)
2. [OAuth Configuration Commands](#oauth-configuration-commands)
3. [Debugging & Information Commands](#debugging--information-commands)
4. [Command Patterns & Workflows](#command-patterns--workflows)
5. [Important Warnings & Best Practices](#important-warnings--best-practices)

---

## 🚀 **App Management Commands**

### **1. List All Apps**

```bash
smartthings apps:list
```

**Purpose**: View all SmartThings apps in your developer account
**Output**: Shows App ID, Display Name, App Type, Classifications
**When to use**:

- Check what apps you have
- Find App IDs for other commands
- Verify app creation was successful

### **2. View Specific App Details**

```bash
smartthings apps [APP_ID]
smartthings apps a6901030-4064-436f-a660-31490c64e744
```

**Purpose**: Get detailed information about a specific app
**Output**: Display Name, App ID, App Name, Description, Single Instance, Classifications, App Type
**When to use**:

- Verify app configuration
- Check app status (active/disabled)
- Confirm app exists before OAuth operations

### **3. Create New OAuth-Enabled App**

```bash
smartthings apps:create
```

**Interactive Process**:

1. **App Type**: Select `OAuth-In` (not API_ONLY initially)
2. **Display Name**: e.g., "Keus Samsung TV Controller"
3. **Description**: e.g., "OAuth-enabled app for controlling Samsung TVs"
4. **Target URL**: Leave blank for OAuth apps
5. **Scopes**: Select `r:devices:*`, `x:devices:*`
6. **Redirect URIs**: Add your callback URL

**Output**: Creates app with OAuth configuration
**Result**: App Type becomes `API_ONLY` with OAuth support

### **4. Delete App (Use with Caution)**

```bash
smartthings apps:delete [APP_ID]
```

**Purpose**: Permanently delete a SmartThings app
**⚠️ Warning**: This is irreversible and will invalidate all tokens

---

## 🔐 **OAuth Configuration Commands**

### **5. View OAuth Configuration (Safe)**

```bash
smartthings apps:oauth [APP_ID]
smartthings apps:oauth a6901030-4064-436f-a660-31490c64e744
```

**Purpose**: View OAuth settings without exposing credentials
**Output**: Client Name, Scope, Redirect URIs
**Safe**: ✅ Does NOT show client ID/secret
**When to use**:

- Verify redirect URIs are correct
- Check scope configuration
- Confirm OAuth is properly configured

### **6. View OAuth Configuration (JSON Format)**

```bash
smartthings apps:oauth [APP_ID] --json
smartthings apps:oauth a6901030-4064-436f-a660-31490c64e744 --json
```

**Purpose**: Same as above but in JSON format for easier parsing
**Output**: Structured JSON with scope array and redirect URIs

### **7. Generate NEW OAuth Credentials (DANGEROUS)**

```bash
smartthings apps:oauth:generate [APP_ID]
smartthings apps:oauth:generate a6901030-4064-436f-a660-31490c64e744
```

**Purpose**: Generate NEW OAuth client ID and secret
**Output**: New Client ID and Client Secret
**⚠️ CRITICAL WARNING**:

- **INVALIDATES** all existing tokens
- **BREAKS** all existing OAuth integrations
- Use only when absolutely necessary
- Update environment variables immediately after

---

## 🔍 **Debugging & Information Commands**

### **8. Get Help for Any Command**

```bash
smartthings apps --help
smartthings apps:oauth --help
smartthings apps:create --help
```

**Purpose**: Show available options and usage patterns
**When to use**: Understand command syntax and available flags

### **9. Check CLI Configuration**

```bash
smartthings --version
smartthings config
```

**Purpose**: Verify CLI is properly installed and configured
**When to use**: Troubleshoot CLI connection issues

---

## 🔄 **Command Patterns & Workflows**

### **Initial Setup Workflow**

```bash
# 1. Check existing apps
smartthings apps:list

# 2. Create new OAuth app (if needed)
smartthings apps:create

# 3. Verify app creation
smartthings apps [NEW_APP_ID]

# 4. Check OAuth configuration
smartthings apps:oauth [NEW_APP_ID]
```

### **Debugging OAuth Issues Workflow**

```bash
# 1. Verify app exists and is active
smartthings apps [APP_ID]

# 2. Check OAuth configuration
smartthings apps:oauth [APP_ID]

# 3. If credentials are wrong, generate new ones (last resort)
smartthings apps:oauth:generate [APP_ID]
```

### **Production Deployment Workflow**

```bash
# 1. Create app with proper configuration
smartthings apps:create

# 2. Verify OAuth settings
smartthings apps:oauth [APP_ID] --json

# 3. Record credentials securely
# 4. Update environment variables
# 5. NEVER run generate again unless necessary
```

---

## ⚠️ **Important Warnings & Best Practices**

### **🚨 Critical Warnings**

#### **OAuth Credential Generation**

- `smartthings apps:oauth:generate` creates **NEW** credentials every time
- **INVALIDATES** all existing tokens immediately
- Must update environment variables immediately
- Causes production downtime if not coordinated

#### **App Deletion**

- `smartthings apps:delete` is **PERMANENT**
- Destroys all OAuth configurations
- Breaks all existing integrations
- No recovery possible

### **✅ Best Practices**

#### **Credential Management**

1. **Record credentials immediately** after generation
2. **Store securely** in environment variables
3. **Never regenerate** unless absolutely necessary
4. **Test thoroughly** after any credential changes

#### **Development Workflow**

1. **Use development apps** for testing
2. **Create separate production apps** when ready
3. **Document all App IDs** and their purposes
4. **Keep OAuth configurations minimal** (only required scopes)

#### **Troubleshooting Approach**

1. **Check app existence** first: `smartthings apps [APP_ID]`
2. **Verify OAuth config** next: `smartthings apps:oauth [APP_ID]`
3. **Check environment variables** match CLI output
4. **Generate new credentials** only as last resort

---

## 📝 **Command Quick Reference**

| Command                    | Purpose           | Safe? | Output                   |
| -------------------------- | ----------------- | ----- | ------------------------ |
| `apps:list`                | List all apps     | ✅    | App list                 |
| `apps [ID]`                | App details       | ✅    | App info                 |
| `apps:create`              | Create new app    | ✅    | New app with OAuth       |
| `apps:oauth [ID]`          | View OAuth config | ✅    | Config only              |
| `apps:oauth:generate [ID]` | New credentials   | ⚠️    | **NEW** Client ID/Secret |
| `apps:delete [ID]`         | Delete app        | ❌    | App destroyed            |

---

## 🎯 **Our Implementation Journey**

### **Apps Created During Development**

1. **First App**: `ecd7f039-6fae-49e1-b234-02989e1e347b` (API_ONLY, no OAuth)
2. **Second App**: `ba146c31-971a-4325-8414-3d411007dc48` (Credentials from first OAuth app)
3. **Final App**: `a6901030-4064-436f-a660-31490c64e744` (Working OAuth app)
   - **Final Credentials**: `b3ba9571-ecac-44f9-8f80-ae7ba7e4b3a1`

### **Key Discovery**

- CLI creates `API_ONLY` apps with OAuth support
- OAuth credentials change each time `generate` is run
- Basic Auth required for SmartThings token exchange

---

## 🚀 **Future Reference**

### **For New Projects**

```bash
# Complete setup in one session
smartthings apps:create
# → Record App ID immediately
smartthings apps:oauth [APP_ID]
# → Record Client ID/Secret immediately
# → Update environment variables
# → Test OAuth flow
# → NEVER run generate again
```

### **For Troubleshooting**

```bash
# Diagnosis workflow
smartthings apps:list
smartthings apps [SUSPECTED_APP_ID]
smartthings apps:oauth [APP_ID]
# → Compare with environment variables
# → Update if mismatch found
```

### **For Production**

- **Document all App IDs** in secure location
- **Never regenerate credentials** in production
- **Use staging apps** for testing changes
- **Monitor token expiry** and refresh patterns

---

**📚 Additional Resources:**

- [SmartThings CLI Documentation](https://github.com/SmartThingsCommunity/smartthings-cli)
- [SmartThings Developer Portal](https://developer.smartthings.com/)
- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
