# APAC C&C GenAI Sub-practice - Bootcamp 1 - Lab 1

## Lab 1 Overview

In this lab, you will:

1. Create an AEM Edge Delivery Services (EDS) site, using Document Authoring (DA) for the  content authoring method.
2. Harden DA to restrict authoring to only an admin + specific users from an IMS group.
3. Harden EDS to restrict preview and publishing to only an admin + specific users from an IMS group.
4. Utilize App Builder to create runtime actions that will leverage the [UMAPI API](https://developer.adobe.com/umapi/) and the [AEM Admin API](https://www.aem.live/docs/admin.html) to automate the hardening of preview and publishing permissions to users from a specific IMS group.

```mermaid
graph LR
    A[App Builder] -->|1. Get IMS group users| B[User Management API]
    B -->|2. Return user list| A
    A -->|3. Update EDS publishing access<br/>with IMS user IDs| C[EDS Admin API]
```

## Concepts / References

### DA / EDS
- https://www.aem.live/developer/tutorial
- https://www.aem.live/docs/config-service-setup#create-your-organization
- https://tools.aem.live
- https://da.live
- https://docs.da.live/administrators/guides/permissions
- https://docs.da.live/administrators/guides/permissions#a-common-pitfall
- https://www.aem.live/docs/authentication-setup-authoring
- https://www.aem.live/docs/admin.html

### App Builder
- https://developer.adobe.com/app-builder/docs/get_started/runtime_getting_started

### User Management API
- https://developer.adobe.com/umapi/
- https://adobe-apiplatform.github.io/umapi-documentation/en/

## Prerequisites

### Install Node.js and npm

Node.js version 20.7.0 or higher is required for Adobe App Builder. npm comes bundled with Node.js.

> **Note:** Adobe App Builder officially supports the three latest Node.js versions (20, 22, 24). See [official runtime documentation](https://developer.adobe.com/app-builder/docs/guides/runtime_guides/reference_docs/runtimes) for the current supported versions.

#### Mac Installation

**Option 1: Using Homebrew (Recommended)**

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js (includes npm)
brew install node@20

# Verify installation
node --version
npm --version
```

**Option 2: Using Official Installer**

1. Go to [https://nodejs.org/](https://nodejs.org/)
2. Download the LTS (Long Term Support) version for macOS
3. Run the installer and follow the prompts
4. Open Terminal and verify:

```bash
node --version
npm --version
```

#### Windows Installation

**Using Official Installer**

1. Go to [https://nodejs.org/](https://nodejs.org/)
2. Download the LTS (Long Term Support) version for Windows
3. Run the `.msi` installer
4. Follow the installation wizard (use default settings)
5. Open Command Prompt or PowerShell and verify:

```bash
node --version
npm --version
```

**Note:** You may need to restart your terminal/command prompt after installation for the commands to be recognized.

### Install Adobe I/O CLI (aio)

```
npm install -g @adobe/aio-cli
aio --version
```

## Create Document Authoring (DA) and Edge Delivery Services (EDS) AEM project

1. Go to https://www.aem.live/
2. Click **Create your site**
3. You end up here https://www.aem.live/developer/tutorial.  Follow this tutorial.

### Create boilerplate GitHub repo

1. Sign up for new github account or use an existing.
2. Clone the boilerplate [https://github.com/adobe/aem-boilerplate](https://github.com/adobe/aem-boilerplate)

    ![alt text](images/image_1763012440317_0.png)
    ![alt text](images/image_1763012474886_0.png)

3. Set repo to public.
4. Install the [AEM Code Sync](https://github.com/apps/aem-code-sync) on your repository.
    
    ![alt text](images/image_1763012522803_0.png)

5. In the `Repository access` settings of the AEM Code Sync App, make sure you select `Only select Repositories` (not `All Repositories`). Then select your newly created repository, and click `Save`.

    ![alt text](images/image_1763012548047_0.png)

    ![alt text](images/image_1763012629496_0.png)

6. Check new website running on `https://<branch>--<repo>--<owner>.aem.page/` In the example above that’s `https://main--mysite--aemtutorial.aem.page/`

    ![alt text](images/image_1763012800529_0.png)
    ![alt text](images/image_1763012808374_0.png)

### Verify EDS site admins using User Admin Tool

- https://tools.aem.live/
- https://www.aem.live/docs/config-service-setup

  ![alt text](images/image_1763076534000_0.png)

### Add Project

  ![alt text](images/image_1763076766184_0.png)
  ![alt text](images/image_1763076785448_0.png)

  ![alt text](images/image_1763080129428_0.png)  

### Edit, Preview and Publish Content in Document Authoring

1. Navigate to Author on [https://da.live/](https://da.live/) and find the example content.

  ![alt text](images/image_1763079894381_0.png)

2. Add new https://da.live/start

  ![alt text](images/image_1763079935465_0.png)
  ![alt text](images/image_1763080085793_0.png)

3. Edit index.html

  ![alt text](images/image_1763080176950_0.png)

4. Preview and Publish

  ![alt text](images/image_1763080183776_0.png)
  ![alt text](images/image_1763080191521_0.png)


> At this point we can edit preview and publish content as ANY user. DA and EDS permissions are fully open

### Harden DA permissions

https://docs.da.live/administrators/guides/permissions

1. Add your admin user to DA permissions (config and authoring)
2. Add all users from IMS Group ??? in `acs-apac-internal` group to DA permissions (config and authoring)

> At this point the admin user and anyone in the IMS group will be able to author in DA, but not preview or publish!

### Harden EDS permissions

#### View current state of EDS site access using EDS Admin API

#### Restrict access to specific user

#### Verify only this user can preview publish and others cannot

> At this point you should have an understanding of the concepts that drive DA and EDS permissions.  Next we will move onto automating this configuration at scale.

## Create App Builder App

### Sign in from the CLI

```
aio login
```

A browser window should open, asking you to sign in with your Adobe ID. 

Once you've logged in, you can close the browser window and go back to Terminal. 


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
curl "https://391665-885ivorypike-stage.adobeioruntime.net/api/v1/web/genaispbc1/get-umapi-users" | jq '{_mock, group, count, access}'
```

Expected: `_mock: true`, 7 users from EDS_Sandbox_Users group

**2. Test sync-umapi-to-eds (End-to-End):**
```bash
curl "https://391665-885ivorypike-stage.adobeioruntime.net/api/v1/web/genaispbc1/sync-umapi-to-eds" | jq .
```

Expected: Both steps succeed (requires EDS_ADMIN_TOKEN in .env)
```json
{
  "step1": {
    "group": "EDS_Sandbox_Users",
    "count": 7
  },
  "step2": {
    "message": "access.json updated successfully"
  }
}
```

**3. Verify EDS permissions were set:**

Check via API:
```bash
curl "https://admin.hlx.page/config/<YOUR_ORG>/sites/<YOUR_SITE>/access.json" \
  -H "x-auth-token: <YOUR_ADMIN_TOKEN>" | jq .
```

Expected: All 7 IMS user IDs in `admin.role.publish` array

Or check EDS Admin UI that users were synced:

![EDS Admin UI showing synced users](images/Xnip2025-11-20_23-52-47.jpg)

**4. Test Publishing:**

Verify you can publish site from DA authoring interface:

![DA authoring interface](images/Xnip2025-11-20_23-55-17.jpg)
![Publishing confirmation](images/Xnip2025-11-20_23-55-43.jpg)

### Test with Live Data (Optional)

Set `USE_MOCK_DATA=false` in `.env` and redeploy to use live UMAPI data. Note: 25 req/min rate limit applies.

🎉🎉🎉 LAB Complete

