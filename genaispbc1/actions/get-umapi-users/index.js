/**
 * get-umapi-users
 *
 * Inputs:
 *  - UMAPI_PROXY_URL (env)
 *  - USE_MOCK_DATA (env) - set to 'true' to use mock data instead of calling UMAPI
 *
 * Output:
 *  {
 *    group: "group-name",
 *    users: [{ email, firstName, lastName }],
 *    access: { ... }   // basic access.json-like structure
 *  }
 */

const fetch = require('node-fetch');

// Mock data based on actual UMAPI response (for testing/bootcamp to avoid rate limits)
const MOCK_UMAPI_RESPONSE = {
  "count": 7,
  "emails": ["nmalhotra@adobe.com", "downes@adobe.com", "vvenkata@adobe.com", "kunalj@adobe.com", "pritams@adobe.com", "mhaack@adobe.com", "apa@adobe.com"],
  "group": "EDS_Sandbox_Users",
  "imsUserIds": ["B7A4036062DCE5900A495FB8@b0fb52c862dcbaa0495ec3.e", "B9B0493162DCE5900A495E48@b0fb52c862dcbaa0495ec3.e", "B5B3487062DCE5910A495ED3@b0fb52c862dcbaa0495ec3.e", "3D411E1B67933B3C0A495FDD@b0fb52c862dcbaa0495ec3.e", "1B83206867ECC6C10A495FB3@b0fb52c862dcbaa0495ec3.e", "CAD12274685BBFBF0A495F9C@b0fb52c862dcbaa0495ec3.e", "16B523ED685E35B30A495CD0@b0fb52c862dcbaa0495ec3.e"],
  "users": [
    {
      "email": "nmalhotra@adobe.com",
      "firstName": "Nitin",
      "id": "B7A4036062DCE5900A495FB8@b0fb52c862dcbaa0495ec3.e",
      "lastName": "Malhotra"
    },
    {
      "email": "downes@adobe.com",
      "firstName": "Brendan",
      "id": "B9B0493162DCE5900A495E48@b0fb52c862dcbaa0495ec3.e",
      "lastName": "Downes"
    },
    {
      "email": "vvenkata@adobe.com",
      "firstName": "Varun",
      "id": "B5B3487062DCE5910A495ED3@b0fb52c862dcbaa0495ec3.e",
      "lastName": "Venkataraman"
    },
    {
      "email": "kunalj@adobe.com",
      "firstName": "Kunal",
      "id": "3D411E1B67933B3C0A495FDD@b0fb52c862dcbaa0495ec3.e",
      "lastName": "Jaiswal"
    },
    {
      "email": "pritams@adobe.com",
      "firstName": "Pritam",
      "id": "1B83206867ECC6C10A495FB3@b0fb52c862dcbaa0495ec3.e",
      "lastName": "Singh"
    },
    {
      "email": "mhaack@adobe.com",
      "firstName": "Markus",
      "id": "CAD12274685BBFBF0A495F9C@b0fb52c862dcbaa0495ec3.e",
      "lastName": "Haack"
    },
    {
      "email": "apa@adobe.com",
      "firstName": "Aparna",
      "id": "16B523ED685E35B30A495CD0@b0fb52c862dcbaa0495ec3.e",
      "lastName": "Chilla"
    }
  ]
};

async function main(params) {
  const useMockData = params.USE_MOCK_DATA === 'true';
  
  let data;
  
  if (useMockData) {
    // Use mock data to avoid UMAPI rate limits during bootcamp
    console.log('Using mock UMAPI data');
    data = MOCK_UMAPI_RESPONSE;
  } else {
    // Call real UMAPI proxy
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

      data = JSON.parse(text);
    } catch (err) {
      return {
        statusCode: 500,
        body: { error: 'get-umapi-users failed', detail: err.message }
      };
    }
  }

  // Process the data (same whether mock or real)
    
  const group = data.group || 'unknown';

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
      access,
      _mock: useMockData  // indicator if mock data was used
    }
  };
}

exports.main = main;