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

> **Note:** The actual implementation code can be obtained from the repository or provided separately.

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
AZURE_OPENAI_ENDPOINT=<your api key>
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

Or just hit the curl command:

curl --location 'https://391665-207tancrayfish-development.adobeioruntime.net/api/v1/web/genaispbc1/ai-asset-tagging' \
--header 'Content-Type: application/json' \
--data '{
  "assetPath": "/content/dam/bootcamp/sample-psd-files9.psd",
  "aemInstanceUrl": "https://author-p106442-e1666219.adobeaemcloud.com",
  "accessToken": "<<access token to be provided>>",
  "promptConfigs": {
    "namespace": {
      "aigen": "http://ns.adobe.com/xap/1.0/aigen/"
    },
    "aigenDescription": "Analyze the image then generate a 50-word description in Australian English, incorporating details of the text overlay; for regular photos, the description needs to have good phrases for semantic search.",
    "aigenKeywords": "Generate relevant and descriptive keywords in a string array for supermarket-related images in Australian English. The keywords should be based on the content, themes, and context of the image. Include the following considerations: Main Subjects: Key objects, people, or elements in the image. Identify the branch based on the main colours used in the image such as orange colour is for Everyday, Blue is for Big W and green is for Woolworths. For food packages with a visible logo, include keywords such as '\''Woolworths Food Company,'\'' '\''WFC,'\'' or '\''Owned brand.'\'' For food or meal photos, categorize based on: Cuisine Type: e.g., Italian cuisine, vegetarian, plant-based. Meal Type/Occasion: e.g., lunch, dinner, family dinner, light meal. Dish Characteristics: e.g., Bolognese, oven-baked, roasted vegetables. For employee uniforms, describe attire such as '\''apron,'\'' '\''polo,'\'' '\''vest,'\'' '\''jacket,'\'' or '\''hi-vis.'\'' For seasonal festival images, include keywords like '\''Easter'\'' for Easter eggs or '\''Christmas'\'' for tinsel. If a name badge is visible, include keywords like '\''name badge'\'' and '\''BigW.'\'' Setting and Environment: Describe where the scene takes place and its broader context (e.g., outdoor, studio, supermarket). Actions or Interactions: Describe activities or interactions occurring in the image (e.g., shopping, holding, preparing). Visual Style and Composition: Mention photographic perspective, mood, and color schemes (e.g., overhead shot, close-up, bright colors). Relevant Themes: Include related concepts or use cases (e.g., comfort food, healthy eating, family interaction, customer engagement). Text Overlay: Identify overlay text present in the image. Orientation: Mention orientation of the image such as '\''top-down view.'\'' Licensed Characters: If visible, include keywords for licensed characters such as '\''Hello Kitty'\'' or '\''Spiderman.'\'' Store Department: Identify the store department for woolworths brand only visible in the image such as '\''deli,'\'' '\''seafood,'\'' '\''fresh,'\'' '\''party section,'\'' etc. Specific Food or Meat Types: Recognize and categorize food types such as '\''meat,'\'' '\''mince,'\'' '\''vegetables,'\'' but do not use meat name such as lamb, beef, etc for mince meat type. Assign these keywords to the aigen_keywords property.",
    "aigenBrand": "If the brand name or logo is clearly visible on the product, or a unique pattern for a brand is used, use that to assign the brand tag.",
    "aigenTitle": "Analyze the image then generate a 7-word title in Australian English.",
    "aigenConfidence": "Assign a confidence value. The confidence value represents a percentage that indicates the system'\''s level of certainty in the tagging results."
  }
}'

```

### 6.2 Expected Response

```json
{
  "assetPath": "/content/dam/bootcamp/sample-psd-files9.psd",
  "debugLogs": [
    "[INFO] === AI Asset Tagging Started ===",
    "[INFO] Step 0 - Input validation",
    "Step 0 - Input validation",
    "[INFO] Processing asset: /content/dam/bootcamp/sample-psd-files9.psd",
    "[INFO] Using AEM instance: https://author-p106442-e1666219.adobeaemcloud.com",
    "[INFO] Step 1 - Building prompt from request parameters",
    "Step 1 - Building prompt from request parameters",
    "[INFO] Generated prompt length: 3111 characters",
    "[INFO] Step 2 - Download rendition from AEM",
    "Step 2 - Download rendition from AEM",
    "Available renditions to try: 4",
    "Trying rendition 1: /jcr:content/renditions/cq5dam.web.1280.1280.jpeg",
    "RenditionURL : https://author-p106442-e1666219.adobeaemcloud.com/content/dam/bootcamp/sample-psd-files9.psd/jcr:content/renditions/cq5dam.web.1280.1280.jpeg",
    "Response: 200 OK for /jcr:content/renditions/cq5dam.web.1280.1280.jpeg",
    "SUCCESS: Using rendition /jcr:content/renditions/cq5dam.web.1280.1280.jpeg",
    "Download completed: 332071 bytes from /jcr:content/renditions/cq5dam.web.1280.1280.jpeg",
    "[INFO] Rendition downloaded successfully: 332071 bytes (image/jpeg)",
    "[INFO] Used rendition: /jcr:content/renditions/cq5dam.web.1280.1280.jpeg",
    "Used rendition: /jcr:content/renditions/cq5dam.web.1280.1280.jpeg",
    "[INFO] Step 3 - Save rendition to local storage",
    "Step 3 - Save rendition to local storage",
    "[INFO] File saved to local storage: /tmp/sample-psd-files9_1764212944567.jpeg",
    "[INFO] Step 4 - Convert to base64: /tmp/sample-psd-files9_1764212944567.jpeg",
    "Step 4 - Convert to base64",
    "[INFO] Base64 conversion complete: 442764 characters",
    "[INFO] Step 5 - Process with Azure OpenAI",
    "Step 5 - Process with Azure OpenAI",
    "[INFO] Properties from AI: {\"aigenBrand\":null,\"aigenConfidence\":85,\"aigenDescription\":\"A stunning outdoor landscape featuring illuminated blue light trails across a grassy field under a vibrant twilight sky with star streaks. The scene captures a serene and artistic atmosphere, blending natural beauty with creative light effects. Trees line the horizon, adding depth and contrast to the composition.\",\"aigenKeywords\":[\"outdoor\",\"landscape\",\"light trails\",\"twilight sky\",\"star streaks\",\"grassy field\",\"artistic\",\"serene\",\"creative lighting\",\"nature\"],\"aigenTitle\":\"Illuminated field under twilight starry sky\"}",
    "[INFO] Step 6 - Update AEM metadata",
    "Step 6 - Update AEM metadata",
    "[INFO] PRIMARY: Attempting Assets HTTP API update...",
    "Starting Assets HTTP API metadata update for: /content/dam/bootcamp/sample-psd-files9.psd",
    "Assets API metadata update attempt 1/3",
    "Updating asset metadata using Assets HTTP API for asset: sample-psd-files9.psd",
    "Assets HTTP API Update URL: https://author-p106442-e1666219.adobeaemcloud.com/api/assets/bootcamp/sample-psd-files9.psd",
    "Processing metadata field: aigenBrand -> metadata/aigenBrand",
    "Processing metadata field: aigenConfidence -> metadata/aigenConfidence",
    "Processing metadata field: aigenDescription -> metadata/aigenDescription",
    "Processing metadata field: aigenKeywords -> metadata/aigenKeywords",
    "Processing metadata field: aigenTitle -> metadata/aigenTitle",
    "Processing metadata field: aigen:status -> metadata/aigen:status",
    "Processing metadata: 6 properties with metadata/ prefix",
    "Assets HTTP API response: 200 OK",
    "Response body received: 411 chars",
    "JSON response parsed successfully",
    "Assets HTTP API metadata update successful",
    "Assets API metadata update completed successfully",
    "[INFO] SUCCESS: Assets HTTP API update completed successfully",
    "AI Asset Tagging processed in 8430 milliseconds for /content/dam/bootcamp/sample-psd-files9.psd",
    "[INFO] AI Asset Tagging processed in 8430 milliseconds for /content/dam/bootcamp/sample-psd-files9.psd",
    "[INFO] Metadata updated successfully",
    "[INFO] AI Asset Tagging processed in 8430 milliseconds for /content/dam/bootcamp/sample-psd-files9.psd",
    "STEP 7: === AI Asset Tagging Completed Successfully ===",
    "[INFO] Step 8 - Clean up temp files",
    "Step 8 - Clean up temp files",
    "[INFO] AI Asset Tagging processed in 8431 milliseconds for /content/dam/bootcamp/sample-psd-files9.psd",
    "AI Asset Tagging processed in 8431 milliseconds for /content/dam/bootcamp/sample-psd-files9.psd",
    "[INFO] === AI Asset Tagging END ==="
  ],
  "processingTimeMs": 8430,
  "propertiesCount": 6,
  "status": "success",
  "timestamp": "2025-11-27T03:09:12.749Z",
  "updatedProperties": [
    "aigenBrand",
    "aigenConfidence",
    "aigenDescription",
    "aigenKeywords",
    "aigenTitle",
    "aigen:status"
  ]
}  
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


