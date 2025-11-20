/**
 * update-eds-access
 *
 * Inputs:
 *   - EDS_ORG (env)
 *   - EDS_SITE (env)
 *   - EDS_ADMIN_TOKEN (env)
 *   - access: { ... }  (required in body or params.access)
 */

const fetch = require('node-fetch');

async function main(params) {
  const org = params.EDS_ORG;
  const site = params.EDS_SITE;
  const token = params.EDS_ADMIN_TOKEN;

  if (!org || !site) {
    return {
      statusCode: 500,
      body: { error: 'EDS_ORG or EDS_SITE not configured' }
    };
  }

  if (!token) {
    return {
      statusCode: 500,
      body: { error: 'EDS_ADMIN_TOKEN not configured' }
    };
  }

  let access = params.access;

  // If invoked via HTTP with JSON body
  if (!access && params.__ow_body) {
    try {
      const body = JSON.parse(params.__ow_body);
      access = body.access;
    } catch (e) {
      return {
        statusCode: 400,
        body: { error: 'Invalid JSON body', detail: e.message }
      };
    }
  }

  if (!access) {
    return {
      statusCode: 400,
      body: { error: 'Missing access payload. Provide { "access": { ... } }.' }
    };
  }

  const url = `https://admin.hlx.page/config/${org}/sites/${site}/access.json`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'x-auth-token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(access)
    });

    const text = await resp.text();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: { error: 'Failed to update access.json', detail: text }
      };
    }

    return {
      statusCode: 200,
      body: { message: 'access.json updated successfully', detail: text }
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: { error: 'update-eds-access failed', detail: err.message }
    };
  }
}

exports.main = main;