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
  const proxyUrl = params.UMAPI_PROXY_URL;

  if (!proxyUrl) {
    return {
      statusCode: 500,
      body: { error: 'UMAPI_PROXY_URL not configured in env' }
    };
  }

  try {
    const resp = await fetch(proxyUrl);
    const text = await resp.text();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: { error: 'UMAPI proxy error', detail: text }
      };
    }

    const data = JSON.parse(text);

    const users = (data.users || []).map(u => ({
      email: u.email,
      firstName: u.firstName || u.firstname || '',
      lastName: u.lastName || u.lastname || ''
    }));

    // Simple EDS-style access JSON (you can adapt to your real schema)
    const access = {
      version: 1,
      group,
      users: users.map(u => ({
        email: u.email,
        name: `${u.firstName} ${u.lastName}`.trim(),
        role: 'author'
      }))
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
  } catch (err) {
    return {
      statusCode: 500,
      body: { error: 'get-umapi-users failed', detail: err.message }
    };
  }
}

exports.main = main;