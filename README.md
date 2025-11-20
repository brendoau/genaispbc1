# APAC C&C GenAI Bootcamp 1

## Prerequisites

### 1. Install Node.js and npm

```
node --version
npm --version
```

### 2. Install Adobe I/O CLI (aio)

```
npm install -g @adobe/aio-cli
aio --version
```

### 3. Sign in from the CLI

```
aio login
```

A browser window should open, asking you to sign in with your Adobe ID. 

Once you've logged in, you can close the browser window and go back to Terminal. 

## Create App Builder App

### Create the project in Developer Console

1.	Go to Adobe Developer Console https://developer.adobe.com/console
2.  Go to `acs-apac-internal` org.
3.  Click “Create project from template”
4.  Choose Adobe App Builder
5. Give the project a title (e.g. brendanbc1).  Ensure you keep checked "Include Runtime".  Click Save.
    
### Generate the App Builder project locally

NB: There is a sample project build locally under `genaispbc1` which you can reference (TODO, COULD PUT THIS IN SOLUTION BRANCH INSTEAD)

Create a folder on your local
You will be prompted with a few questions about how you want your app to be boostrapped and configured.

```
mkdir genaispbc1
cd genaispbc1

aio app init genaispbc1 --standalone-app
```

When prompted:

- Select org - `acs-apac-internal`
- Select project - `<Your project name from above>`
- Select features to enable - Actions only.
  - Sample actions - `Generic`
    - Name of sample application - `generic`

## Implement Lab 1 Actions

### Define actions via `app.config.yaml` under `actions`

```
get-umapi-users:
  function: actions/get-umapi-users/index.js
  web: 'yes'
  runtime: nodejs:22
  inputs:
    LOG_LEVEL: debug
  annotations:
    require-adobe-auth: false
    final: true
update-eds-access:
  function: actions/update-eds-access/index.js
  web: 'yes'
  runtime: nodejs:22
  inputs:
    LOG_LEVEL: debug
  annotations:
    require-adobe-auth: false
    final: true
sync-umapi-to-eds:
  function: actions/sync-umapi-to-eds/index.js
  web: 'yes'
  runtime: nodejs:22
  inputs:
    LOG_LEVEL: debug
  annotations:
    require-adobe-auth: false
    final: true
```

### Define actions inputs via `app.config.yaml` below `actions`

```
inputs:
  # EDS configuration
  EDS_ORG: $EDS_ORG
  EDS_SITE: $EDS_SITE
  EDS_ADMIN_TOKEN: $EDS_ADMIN_TOKEN
  # UMAPI proxy
  UMAPI_PROXY_URL: $UMAPI_PROXY_URL
```

### Set env vars

Set env vars in `.env` file: EDS_ORG, EDS_SITE, EDS_ADMIN_TOKEN, UMAPI_PROXY_URL, USE_MOCK_DATA

Example

```
UMAPI_PROXY_URL=https://391665-478whitegayal-stage.adobeioruntime.net/api/v1/web/umapi-proxy-app/umapi-proxy-action?secret=<ASK>
EDS_ORG=brendoaugh2
EDS_SITE=genaibc1
EDS_ADMIN_TOKEN=

# Use mock UMAPI data to avoid rate limits (set to 'true' for bootcamp)
# UMAPI has a limit of 25 requests/minute. With 30 attendees, mock data avoids rate limit issues.
# Mock data is based on real EDS_Sandbox_Users group and only changes once daily.
USE_MOCK_DATA=true
```

**Important:** During the bootcamp, keep `USE_MOCK_DATA=true` to avoid UMAPI rate limits (25 req/min). With 30 attendees, everyone would hit rate limits testing simultaneously. Set to `false` only for production use or when you need live data.

### Add action code for get-umapi-users

Add to actions/get-umapi-users/index.js (see example code in genaispbc1 folder)

### Add action code for update-eds-access

Add to actions/update-eds-access/index.js (see example code in genaispbc1 folder)

### Add action code for sync-umapi-to-eds

Add to actions/sync-umapi-to-eds/index.js (see example code in genaispbc1 folder)

## Deploy Lab 1 actions

```
aio app deploy
```

## Verify

### Test with Mock Data (Recommended for Bootcamp)

With `USE_MOCK_DATA=true` in `.env`, test without hitting UMAPI rate limits:

**1. Test get-umapi-users:**
```bash
curl "https://391665-885ivorypike-stage.adobeioruntime.net/api/v1/web/genaispbc1/get-umapi-users" | jq '{_mock, group, count, first_user: .users[0]}'
```

Expected: `_mock: true`, 7 users from EDS_Sandbox_Users group

**2. Test sync-umapi-to-eds:**
```bash
curl "https://391665-885ivorypike-stage.adobeioruntime.net/api/v1/web/genaispbc1/sync-umapi-to-eds" | jq .
```

Expected: Step 1 shows 7 users, Step 2 updates EDS (requires EDS_ADMIN_TOKEN)

**3. Verify EDS permissions:**
- Check EDS Admin UI that users were synced
- Verify you can publish site from DA authoring interface

### Test with Live Data (Optional)

Set `USE_MOCK_DATA=false` in `.env` and redeploy to use live UMAPI data. Note: 25 req/min rate limit applies.

🎉🎉🎉 LAB Complete

