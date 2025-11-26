/**
 * get-umapi-users
 *
 * Inputs:
 *  - UMAPI_PROXY_URL (env)
 *
 * Output:
 *  {
 *    group: "group-name",
 *    users: [{ email, firstName, lastName }],
 *    access: { ... }   // basic access.json-like structure
 *  }
 */

const fetch = require('node-fetch');

async function main(params) {
  // Call UMAPI proxy
  const proxyUrl = params.UMAPI_PROXY_URL;

  if (!proxyUrl) {
    return {
      statusCode: 500,
      body: { error: 'UMAPI_PROXY_URL not configured in env' }
    };
  }

  let data;

  try {
    const resp = await fetch(proxyUrl);
    const text = await resp.text();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: { error: 'UMAPI proxy error', detail: text }
      };
    }

    data = JSON.parse(text);
  } catch (err) {
    return {
      statusCode: 500,
      body: { error: 'get-umapi-users failed', detail: err.message }
    };
  }

  // Process the data
  const group = data.group || 'unknown';

  const users = (data.users || []).map(u => ({
    email: u.email,
    firstName: u.firstName || u.firstname || '',
    lastName: u.lastName || u.lastname || ''
  }));

  // Get IMS user IDs from the data
  const imsUserIds = data.imsUserIds || data.users.map(u => u.id).filter(Boolean);

  // EDS access.json format - IMS user IDs go in publish array
  const access = {
    admin: {
      requireAuth: "true",
      role: {
        admin: [],
        author: [],
        publish: imsUserIds
      }
    }
  };

  return {
    statusCode: 200,
    body: {
      group,
      count: users.length,
      users,
      access
    }
  };
}

exports.main = main;