# AI Asset Tagging Setup Guide

This guide provides step-by-step instructions to add AI-powered asset tagging functionality to your Adobe App Builder project.

## Prerequisites

- Existing App Builder project with actions deployed
- Azure OpenAI API access (API key and endpoint)
- AEM Cloud Service with Assets
- Node.js and npm installed
- Adobe I/O CLI installed

---

## Step 1: Create Action Folders and Files

### 1.1 Create Directory Structure

Run these commands from your project root (where `package.json` is located):

```bash
# Navigate to actions directory
cd actions

# Create ai-asset-tagging folder and files
mkdir -p ai-asset-tagging
touch ai-asset-tagging/index.js
touch ai-asset-tagging/utils.js

# Create worker folder and files
mkdir -p worker
touch worker/index.js
touch worker/utils.js

# Verify structure
ls -la ai-asset-tagging/
ls -la worker/
```

Expected output:
```
ai-asset-tagging/
  - index.js
  - utils.js

worker/
  - index.js
  - utils.js
```

### 1.2 Copy Action Code

You'll need to copy the implementation code into these files. The files should contain:

**`actions/ai-asset-tagging/index.js`**
- Main action entry point
- Handles HTTP requests for AI asset tagging
- Orchestrates the tagging workflow

**`actions/ai-asset-tagging/utils.js`**
- Helper functions for AEM integration
- Azure OpenAI API calls
- Metadata update functions

**`actions/worker/index.js`**
- Asset Compute worker implementation
- Processes assets via Asset Compute SDK

**`actions/worker/utils.js`**
- Shared utility functions
- File processing, base64 conversion
- XMP metadata handling

> **Note:** The actual implementation code can be found in the [lab2_sample_code](./lab2_sample_code/) folder.

---

## Step 2: Update package.json

### 2.1 Add Required Dependencies

Edit `package.json` and add these dependencies:

```json
{
  "dependencies": {
    "@adobe/aio-sdk": "^6",
    "@adobe/asset-compute-sdk": "^4.6.2",
    "@adobe/asset-compute-xmp": "^1.0.0",
    "@adobe/jwt-auth": "^2.0.0",
    "node-fetch": "^2.6.0"
  }
}
```

### 2.2 Install Dependencies

```bash
npm install
```

---

## Step 3: Update app.config.yaml

### 3.1 Add New Actions Configuration

Edit `app.config.yaml` and add the following actions under the `actions:` section:

```yaml
application:
  actions: actions
  runtimeManifest:
    packages:
      genaispbc1:
        license: Apache-2.0
        actions:
          # ... your existing actions (generic, get-umapi-users, etc.) ...
          
          # ADD THESE NEW ACTIONS:
          
          worker:
            function: actions/worker/index.js
            web: 'yes'
            runtime: nodejs:22
            limits:
              concurrency: 10
              memory: 1024
              timeout: 3600000
            inputs:
              AZURE_OPENAI_API_KEY: $AZURE_OPENAI_API_KEY
              AZURE_OPENAI_ENDPOINT: $AZURE_OPENAI_ENDPOINT
              AEM_TARGET_URL: $AEM_TARGET_URL
              GDAM_TOKEN: $GDAM_TOKEN
            annotations:
              require-adobe-auth: true
              
          ai-asset-tagging:
            function: actions/ai-asset-tagging/index.js
            web: 'yes'
            runtime: nodejs:22
            limits:
              concurrency: 5
              memory: 1024
              timeout: 300000
            inputs:
              AZURE_OPENAI_API_KEY: $AZURE_OPENAI_API_KEY
              AZURE_OPENAI_ENDPOINT: $AZURE_OPENAI_ENDPOINT
              AEM_TARGET_URL: $AEM_TARGET_URL
              GDAM_TOKEN: $GDAM_TOKEN
              LOG_LEVEL: $LOG_LEVEL
            annotations:
              require-adobe-auth: false
```

### 3.2 Update Global Inputs

Add these environment variables to the `inputs:` section at the package level:

```yaml
        inputs:
          # Existing EDS configuration
          EDS_ORG: $EDS_ORG
          EDS_SITE: $EDS_SITE
          EDS_ADMIN_TOKEN: $EDS_ADMIN_TOKEN
          UMAPI_PROXY_URL: $UMAPI_PROXY_URL
          USE_MOCK_DATA: $USE_MOCK_DATA
          
          # ADD THESE NEW VARIABLES:
          AZURE_OPENAI_API_KEY: $AZURE_OPENAI_API_KEY
          AZURE_OPENAI_ENDPOINT: $AZURE_OPENAI_ENDPOINT
          AEM_TARGET_URL: $AEM_TARGET_URL
          GDAM_TOKEN: $GDAM_TOKEN
          LOG_LEVEL: $LOG_LEVEL
```

---

## Step 4: Update .env File

### 4.1 Add Azure OpenAI Configuration

Edit your `.env` file and add the following variables:

```bash
# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://acs-api.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=<<To be provided during lab session>>

# AEM/GDAM Configuration  
AEM_TARGET_URL=https://author-p15699-e36869.adobeaemcloud.com
GDAM_TOKEN={"ok":true,"integration":{"imsEndpoint":"ims-na1.adobelogin.com","metascopes":"ent_aem_cloud_api","technicalAccount":{"clientId":"your-client-id","clientSecret":"your-client-secret"},"email":"your-tech-account@techacct.adobe.com","id":"your-tech-account-id","org":"YOUR_ORG_ID@AdobeOrg","privateKey":"-----BEGIN RSA PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END RSA PRIVATE KEY-----\n"}}

# Logging Level
LOG_LEVEL=debug
```

### 4.2 How to Get These Values


#### AEM/GDAM Configuration:

1. **AEM_TARGET_URL**:
   - Your AEM Cloud Service author URL
   - Format: `https://author-pXXXXX-eXXXXX.adobeaemcloud.com`

2. **GDAM_TOKEN**:
   - Go to Adobe Developer Console
   - Select your project with AEM integration
   - Go to service account credentials
   - Download JSON or copy the configuration
   - The token should include:
     - `clientId`, `clientSecret`
     - `email`, `id`, `org`
     - `privateKey` (RSA private key)

### 4.3 Complete .env Example

Your complete `.env` file should look like this:

```bash
# Runtime Configuration
AIO_runtime_auth=YOUR_AUTH_TOKEN
AIO_runtime_namespace=YOUR_NAMESPACE
AIO_runtime_apihost=https://adobeioruntime.net

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://acs-api.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=<your api key>

# AEM/GDAM Configuration
AEM_TARGET_URL=https://author-p15699-e36869.adobeaemcloud.com
GDAM_TOKEN={"ok":true,"integration":{...complete JSON...}}

# Logging
LOG_LEVEL=debug

# EDS Configuration (existing)
EDS_ORG=your-eds-org
EDS_SITE=your-eds-site
EDS_ADMIN_TOKEN=your-eds-token

# UMAPI Configuration (existing)
UMAPI_PROXY_URL=your-umapi-proxy-url
USE_MOCK_DATA=true
```

---

## Step 5: Deploy the Updated Application

### 5.1 Verify Configuration

Before deploying, verify your setup:

```bash
# Check you're in the right workspace
aio where

# Check .env has required variables
grep AZURE_OPENAI .env
```

### 5.2 Deploy

```bash
aio app deploy
```

Expected output:
```
✔ Built 6 action(s) for 'application'
✔ Deployed 6 action(s) for 'application'

Your deployed actions:
web actions:
  -> https://YOUR_NAMESPACE.adobeioruntime.net/api/v1/web/genaispbc1/ai-asset-tagging
  -> https://YOUR_NAMESPACE.adobeioruntime.net/api/v1/web/genaispbc1/worker
  -> (other existing actions...)

Successful deployment 🏄
```

### 5.3 Verify Deployment

```bash
# List all deployed actions
aio runtime action list

# Get specific action details
aio runtime action get genaispbc1/ai-asset-tagging

# Get action URL
aio runtime action get genaispbc1/ai-asset-tagging --url
```

---

## Step 6: Test the AI Asset Tagging Action

### 6.1 Test with postman

```bash
Use the postman collection provided to test the integration.
```

### 6.2 Expected Response

```json
{
  "status": "success",
  "assetPath": "/content/dam/your-folder/test-image.jpg",
  "updatedProperties": [
    "dc:subject",
    "product:category",
    "product:color",
    "aigen:status"
  ],
  "propertiesCount": 4,
  "processingTimeMs": 2500,
  "timestamp": "2025-11-26T10:30:00.000Z",
  "debugLogs": [
    "Step 1 - Building prompt",
    "Step 2 - Download rendition from AEM",
    "Step 3 - Save to temp file",
    "Step 4 - Convert to base64",
    "Step 5 - Process with Azure OpenAI",
    "Step 6 - Update AEM metadata",
    "SUCCESS"
  ]
}
```

### 6.3 View Logs

```bash
# View latest activation
aio runtime activation list --limit 1

# View logs for last activation
aio runtime activation logs --last

# Get specific activation details
aio runtime activation get <ACTIVATION_ID>
```

---

## Troubleshooting

### Issue 1: Missing Dependencies

**Error:** `Module not found: @adobe/asset-compute-sdk`

**Solution:**
```bash
npm install
npm list @adobe/asset-compute-sdk
```

### Issue 2: Azure OpenAI Authentication Failed

**Error:** `401 Unauthorized` or `Access denied`

**Solution:**
- Verify `AZURE_OPENAI_API_KEY` is correct
- Check endpoint format includes API version
- Test endpoint manually:
  ```bash
  curl -H "api-key: YOUR_KEY" "YOUR_ENDPOINT"
  ```

### Issue 3: AEM Authentication Failed

**Error:** `403 Forbidden` when accessing AEM

**Solution:**
- Verify `GDAM_TOKEN` or `Access Token` is valid JSON
- Check service account has proper permissions in AEM
- Verify private key format (includes `\n` for line breaks)
- Test with:
  ```bash
  aio runtime activation logs --last
  ```

### Issue 4: Deployment Fails

**Error:** `403 Forbidden` during deployment

**Solution:**
- Verify namespace configuration:
  ```bash
  aio where
  ```
- Check `.env` has correct `AIO_runtime_namespace`
- Ensure `console.json` matches your project
- Clear cache:
  ```bash
  aio config:delete runtime.namespace
  aio config:delete runtime.auth
  ```


## Configuration Summary

### Files Modified:
- ✅ `package.json` - Added dependencies
- ✅ `app.config.yaml` - Added 2 new actions + inputs
- ✅ `.env` - Added Azure OpenAI and AEM configuration

### Files Created:
- ✅ `actions/ai-asset-tagging/index.js`
- ✅ `actions/ai-asset-tagging/utils.js`
- ✅ `actions/worker/index.js`
- ✅ `actions/worker/utils.js`

### Actions Deployed:
- ✅ `ai-asset-tagging` - Standalone AI tagging endpoint
- ✅ `worker` - Asset Compute worker

---

## Next Steps

1. **Test with Real Assets**: Try tagging actual assets in your AEM instance
2. **Customize Prompts**: Modify `promptConfigs` for your use case
3. **Batch Processing**: Use the `worker` action for bulk operations
4. **Monitor Performance**: Check activation logs regularly
5. **Optimize**: Adjust memory/timeout based on your asset sizes

---

## Quick Reference Commands

```bash
# Deploy
aio app deploy

# List actions
aio runtime action list

# View logs
aio runtime activation logs --last

# Test action
curl -X POST "YOUR_ACTION_URL" -H "Content-Type: application/json" -d '{...}'

# Check configuration
aio where
cat app.config.yaml | grep -A 10 "ai-asset-tagging"
grep AZURE .env
```

---

## Support

If you encounter issues:
1. Check activation logs: `aio runtime activation logs --last`
2. Verify environment variables in `.env`
3. Ensure AEM service account has proper permissions
4. Test Azure OpenAI endpoint separately
5. Review debug logs in the action response

🎉 **Setup Complete!** Your AI asset tagging functionality is now ready to use.

