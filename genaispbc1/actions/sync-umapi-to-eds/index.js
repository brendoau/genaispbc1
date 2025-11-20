/**
 * sync-umapi-to-eds
 *
 * High-level orchestration:
 *  1. Call get-umapi-users.main(params) to get users and "access".
 *  2. Call update-eds-access.main({ ...params, access })
 */

const { main: getUmapiUsers } = require('../get-umapi-users/index.js');
const { main: updateEdsAccess } = require('../update-eds-access/index.js');

async function main(params) {
  // Step 1: fetch users from UMAPI via the proxy
  const getResult = await getUmapiUsers(params);

  if (getResult.statusCode !== 200) {
    return {
      statusCode: getResult.statusCode,
      body: {
        step: 'get-umapi-users',
        error: getResult.body.error || 'Failed to fetch users',
        detail: getResult.body.detail
      }
    };
  }

  const resultBody = getResult.body || {};
  const access = resultBody.access;

  if (!access) {
    return {
      statusCode: 500,
      body: {
        error: 'sync-umapi-to-eds: get-umapi-users did not return access payload'
      }
    };
  }

  // Step 2: update EDS access.json
  const updateParams = { ...params, access };
  const updateResult = await updateEdsAccess(updateParams);

  return {
    statusCode: updateResult.statusCode,
    body: {
      step1: {
        group: resultBody.group,
        count: resultBody.count
      },
      step2: updateResult.body
    }
  };
}

exports.main = main;