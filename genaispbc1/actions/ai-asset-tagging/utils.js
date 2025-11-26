const workerUtils = require('../worker/utils');
const auth = require('@adobe/jwt-auth');
const fetch = require('node-fetch');
const path = require('path');

// Re-export existing functions as-is
const {
    saveToTempFile,
    convertFileToBase64,
    cleanupTempFiles,
    getTagsFromOpenAI,
    processAIResults
} = workerUtils;

// Constants for new functions
const DC_NAMESPACE = 'http://purl.org/dc/elements/1.1/';
const RENDITION_NAMESPACE = 'http://ns.adobe.com/rendition/1.0/';
const EXCLUDED_INSTRUCTION_KEYS = ['embedBinaryLimit', 'target', 'userData', 'worker', 'fmt'];
const FETCH_TIMEOUT_MS = 30000;
const ARRAY_BUFFER_TIMEOUT_MS = 25000;
const IMS_ENDPOINT = 'https://ims-na1.adobelogin.com';

/**
 * Build AI prompt from request parameters (NOT from Asset Compute instructions)
 * Adapted from buildPromptFromInstructions but uses promptConfigs param
 * 
 * @param {Object} promptConfigs - The prompt configurations from request
 * @param {string} assetPath - Path to the asset
 * @param {Object} logger - Logger instance
 * @returns {Object} Object containing prompt and namespaces
 */
function buildPromptFromRequestParams(promptConfigs, assetPath, logger) {
    logger.info(`Building prompt from request params for asset: ${assetPath}`);
    
    let prompt = 'Please follow these tagging instructions for product images, then return the corresponding tags in JSON format. Please do not add any markdown or special formatting characters. Here are the suggested keys: ';
    let namespaces;
    let valueSet = '';
    
    const configKeys = Object.keys(promptConfigs);
    logger.info(`Processing config keys: ${configKeys}`);

    configKeys.forEach(key => {
        if (key === 'namespace') {
            const parsed = typeof promptConfigs[key] === 'string' ? 
                JSON.parse(promptConfigs[key]) : promptConfigs[key];
            parsed['dc'] = DC_NAMESPACE;
            parsed['rendition'] = RENDITION_NAMESPACE;
            namespaces = { namespaces: parsed };
        } else if (!EXCLUDED_INSTRUCTION_KEYS.includes(key)) {
            prompt += `${key}/`;
            
            // Add assetPath to aigen_brand value for context
            if (key === 'aigen_brand') {
                const folderPath = path.dirname(assetPath);
                logger.info(`Asset folder path: ${folderPath}`);
                valueSet += promptConfigs[key] + ' Here is the folder path for reference:' + folderPath + '. ';
            } else {
                valueSet += promptConfigs[key] + ' ';
            }
        }
    });

    // Clean up prompt formatting (same as worker/utils.js)
    const lastSlash = prompt.lastIndexOf('/');
    if (lastSlash !== -1) prompt = prompt.slice(0, lastSlash) + '. ';
    prompt = prompt.replace(/\//g, ', ') + valueSet;

    // Append file name to the prompt
    const fileName = path.basename(assetPath);
    prompt += ' Here is the file name as reference: ' + fileName + '.';
    
    logger.info(`Generated prompt: ${prompt}`);
    return { prompt, namespaces };
}

/**
 * Get access token using environment variables (NO hardcoded credentials)
 * Adapted from worker/utils.js getAccessToken but ensures environment-based auth
 * 
 * @param {Object} params - Parameters containing GDAM_TOKEN
 * @param {Object} logger - Logger instance  
 * @returns {string} The access token
 */
async function getAccessTokenFromEnv(params, logger) {
    logger.info('Getting AEM access token from environment...');
    
    if (!params.GDAM_TOKEN) {
        throw new Error('GDAM_TOKEN missing from environment parameters');
    }
    
    const gdamToken = JSON.parse(params.GDAM_TOKEN);
    
    if (gdamToken.accessToken) {
        logger.info('Using provided access token from environment');
        return gdamToken.accessToken;
    } else {
        logger.info('Generating JWT access token from environment credentials');
        const serviceCredentials = gdamToken.integration;
        
        if (!serviceCredentials) {
            throw new Error('Integration credentials missing from GDAM_TOKEN');
        }
        
        const { access_token } = await auth({
            clientId: serviceCredentials.technicalAccount.clientId,
            technicalAccountId: serviceCredentials.id,
            orgId: serviceCredentials.org,
            clientSecret: serviceCredentials.technicalAccount.clientSecret,
            privateKey: serviceCredentials.privateKey,
            metaScopes: serviceCredentials.metascopes.split(','),
            ims: IMS_ENDPOINT,
        });
        
        logger.info('JWT access token generated successfully from environment');
        return access_token;
    }
}

/**
 * Download rendition using environment-based auth (NOT Asset Compute context)
 * Simplified version that uses direct rendition URL instead of dynamic selection
 * 
 * @param {string} assetPath - Path to the asset in AEM
 * @param {string} aemInstanceUrl - AEM instance URL
 * @param {Object} params - Parameters containing GDAM_TOKEN
 * @param {Object} logger - Logger instance
 * @param {Array} debugLogs - Debug logs array
 * @returns {Object} Object containing buffer, size and contentType
 */
async function downloadRenditionFromAEMDirect(assetPath, aemInstanceUrl, params, logger, debugLogs = [], options = {}) {
    // Define rendition fallback chain based on your AEM structure
    // Order: Best quality to lowest quality
    const renditionFallbacks = options.renditionPaths || [    
        '/jcr:content/renditions/cq5dam.web.1280.1280.jpeg',      // High quality web (current default)
        '/jcr:content/renditions/cq5dam.thumbnail.319.319.png',   // Large thumbnail
        '/jcr:content/renditions/cq5dam.thumbnail.140.100.png',   // Medium thumbnail
        '/jcr:content/renditions/cq5dam.thumbnail.48.48.png',     // Small thumbnail (last resort)
    ];

    const maxRetries = 3;
    // Get access token from request parameters (not hardcoded)
    // Token is passed securely from the calling service
    const accessToken = params.accessToken;
    logger.info(`Starting rendition download with ${renditionFallbacks.length} fallback options`);
    debugLogs.push(`Available renditions to try: ${renditionFallbacks.length}`);

    // Try each rendition in order until one succeeds
    for (let renditionIndex = 0; renditionIndex < renditionFallbacks.length; renditionIndex++) {
        const renditionPath = renditionFallbacks[renditionIndex];
        const renditionUrl = `${aemInstanceUrl}${assetPath}${renditionPath}`;
        
        logger.info(`Trying rendition ${renditionIndex + 1}/${renditionFallbacks.length}: ${renditionPath}`);
        debugLogs.push(`Trying rendition ${renditionIndex + 1}: ${renditionPath}`);
        debugLogs.push(`RenditionURL : ${renditionUrl}`);
        
        // Try this rendition with retries
        let success = false;
        for (let attempt = 0; attempt < maxRetries && !success; attempt++) {
            try {
                if (attempt > 0) {
                    await delay(2000 * attempt); // Progressive delay for retries
                    debugLogs.push(`Retry attempt ${attempt + 1}/${maxRetries} for ${renditionPath}`);
                }
                
                const response = await fetch(renditionUrl, {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`,
                        'User-Agent': 'AITaggingWorker/1.0',
                        'Accept': 'image/*'
                    },
                    timeout: FETCH_TIMEOUT_MS
                });

                logger.info(`Response status: ${response.status} ${response.statusText} for ${renditionPath}`);
                debugLogs.push(`Response: ${response.status} ${response.statusText} for ${renditionPath}`);

                if (response.ok) {
                    // SUCCESS - Process the response
                    logger.info(`SUCCESS: Found and downloading rendition ${renditionPath}`);
                    debugLogs.push(`SUCCESS: Using rendition ${renditionPath}`);
                    
                    // Convert response to buffer with timeout protection
                    const arrayBufferPromise = response.arrayBuffer();
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Download timeout after 25 seconds')), ARRAY_BUFFER_TIMEOUT_MS)
                    );
                    
                    const arrayBuffer = await Promise.race([arrayBufferPromise, timeoutPromise]);
                    const assetSize = response.headers.get('content-length') || arrayBuffer.byteLength;
                    
                    logger.info(`Download completed: ${arrayBuffer.byteLength} bytes from ${renditionPath}`);
                    debugLogs.push(`Download completed: ${arrayBuffer.byteLength} bytes from ${renditionPath}`);
                    
                    return {
                        buffer: Buffer.from(arrayBuffer),
                        size: parseInt(assetSize),
                        contentType: response.headers.get('content-type'),
                        usedRendition: renditionPath,
                        renditionIndex: renditionIndex
                    };
                } else if (response.status === 404) {
                    // Rendition not found - try next one
                    logger.info(`Rendition not found (404): ${renditionPath}, trying next fallback...`);
                    debugLogs.push(`404 - Rendition not found: ${renditionPath}`);
                    break; // Exit retry loop, try next rendition
                } else {
                    // Other error - retry this rendition
                    const errorText = await response.text();
                    logger.warn(`Rendition download error (${response.status}): ${renditionPath} - ${errorText}`);
                    debugLogs.push(`Error ${response.status} for ${renditionPath}: ${errorText}`);
                    
                    if (attempt === maxRetries - 1) {
                        logger.info(`Max retries reached for ${renditionPath}, trying next fallback...`);
                        debugLogs.push(`Max retries reached for ${renditionPath}`);
                    }
                }
                
            } catch (error) {
                logger.error(`Network error for ${renditionPath} (attempt ${attempt + 1}): ${error.message}`);
                debugLogs.push(`Network error for ${renditionPath}: ${error.message}`);
                
                if (attempt === maxRetries - 1) {
                    logger.info(`Network retries exhausted for ${renditionPath}, trying next fallback...`);
                    debugLogs.push(`Network retries exhausted for ${renditionPath}`);
                }
            }
        }
    }

    // If we get here, all renditions failed
    const errorMessage = `No suitable rendition found after trying ${renditionFallbacks.length} fallback options`;
    logger.error(errorMessage);
    debugLogs.push(errorMessage);
    debugLogs.push('Tried renditions: ' + renditionFallbacks.join(', '));
    throw new Error(errorMessage);
}

/**
 * Delay function for retry logic
 * 
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Update the Asset Metadata for assets in AEM using Assets HTTP API
 * @param {*} assetPath the full asset path
 * @param {*} properties the asset metadata properties
 * @param {*} aemInstanceUrl the target AEM URL
 * @param {*} accessToken the access token to use to authenticate with AEM
 * @param {*} logger logger instance
 * @param {*} debugLogs debug logs array
 * @return message
 **/
async function updateAssetMetadata(assetPath, properties, aemInstanceUrl, accessToken, logger, debugLogs) {
    const maxRetries = 3;
    let attempt = 0;
    let assetStatus = '';
    
    const assetName = path.basename(assetPath);
    logger.info(`Starting Assets HTTP API metadata update for: ${assetPath}`);
    debugLogs.push(`Starting Assets HTTP API metadata update for: ${assetPath}`);

    while (attempt < maxRetries && assetStatus !== 'Finished') {
        try {
            await delay(1000);
            debugLogs.push(`Assets API metadata update attempt ${attempt + 1}/${maxRetries}`);
            
            const resp = await updateAssetMetadataAPI(assetPath, properties, aemInstanceUrl, accessToken, logger, debugLogs);
            if (resp.properties?.['status.code'] === 200) {
                assetStatus = 'Finished';
                logger.info(`Asset metadata updated successfully for asset: ${assetName}`);
                debugLogs.push(`Assets API metadata update completed successfully`);
            } else {
                const statusCode = resp.properties ? resp.properties['status.code'] : 'unknown';
                const statusMessage = resp.properties ? resp.properties['status.message'] : 'unknown';
                logger.error(`Status code: ${statusCode}, Failed to update metadata for asset: ${assetName}, Error Response Text: ${statusMessage}`);
                debugLogs.push(`Error ${statusCode}: ${statusMessage}`);
                throw new Error(statusMessage);
            }
        } catch (error) {
            logger.error(`Error during updateAssetMetadata attempt ${attempt + 1}, Error Response Text: ${error.message}`);
            debugLogs.push(`Error attempt ${attempt + 1}: ${error.message}`);
            attempt++;
            if (attempt < maxRetries) {
                logger.info(`Retrying updateAssetMetadataAPI... Attempt ${attempt + 1}`);
                debugLogs.push(`Retrying in 2 seconds... Attempt ${attempt + 1}`);
                await delay(2000);
            }
        }
    }

    if (assetStatus !== 'Finished') {
        const errorMsg = `Failed to update asset metadata after ${maxRetries} attempts`;
        logger.error(errorMsg);
        debugLogs.push(errorMsg);
        throw new Error(errorMsg);
    }
}

/**
 * Update asset metadata using AEM Assets HTTP API
 */
async function updateAssetMetadataAPI(assetPath, properties, aemInstanceUrl, accessToken, logger, debugLogs) {
    const assetName = path.basename(assetPath);
    logger.info("Updating asset metadata in AEM using Assets HTTP API for asset: " + assetName);
    debugLogs.push("Updating asset metadata using Assets HTTP API for asset: " + assetName);
    
    // Fix: Strip /content/dam from assetPath for correct API path
    const apiPath = assetPath.replace(/^\/content\/dam/, '');
    const updateUrl = `${aemInstanceUrl}/api/assets${apiPath}`;
    logger.info("Assets HTTP API Update URL: " + updateUrl);
    debugLogs.push("Assets HTTP API Update URL: " + updateUrl);
    
    try {
        // Add metadata/ prefix to ensure properties land in metadata node (not jcr:content)
        const metadataProperties = {};
        for (const key in properties) {
            const metadataKey = `metadata/${key}`;
            metadataProperties[metadataKey] = properties[key];
            logger.info(`Processing metadata field: ${key} -> ${metadataKey}`);
            debugLogs.push(`Processing metadata field: ${key} -> ${metadataKey}`);
        }
        
        logger.info(`Original properties:`, properties);
        logger.info(`Metadata-prefixed properties:`, metadataProperties);
        debugLogs.push(`Processing metadata: ${Object.keys(properties).length} properties with metadata/ prefix`);

        const response = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'AITaggingWorker/1.0',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                class: 'asset',
                properties: metadataProperties
            })
        });
        
        logger.info(`Assets HTTP API response: ${response.status} ${response.statusText}`);
        debugLogs.push(`Assets HTTP API response: ${response.status} ${response.statusText}`);
        
        let responseBody = null;
        let responseText = '';
        
        // Read response body once and handle both JSON and text cases
        try {
            responseText = await response.text();
            debugLogs.push(`Response body received: ${responseText.length} chars`);
            
            // Try to parse as JSON if response has content
            if (responseText) {
                try {
                    responseBody = JSON.parse(responseText);
                    logger.info(`JSON Response from updating metadata: ${JSON.stringify(responseBody, null, 2)}`);
                    debugLogs.push(`JSON response parsed successfully`);
                } catch (parseError) {
                    logger.info(`Response is not JSON, treating as text: ${responseText}`);
                    debugLogs.push(`Response is not JSON: ${parseError.message}`);
                }
            }
        } catch (readError) {
            logger.error(`Failed to read response body: ${readError.message}`);
            debugLogs.push(`Failed to read response body: ${readError.message}`);
        }
        
        if (!response.ok || (responseBody?.properties && responseBody.properties['status.code'] != 200)) {
            const statusCode = responseBody?.properties ? responseBody.properties['status.code'] : response.status;
            const errorMessage = responseBody?.properties?.['status.message'] || responseText || response.statusText;
            logger.error(`Status Code: ${statusCode}, Error Response: ${errorMessage}`);
            debugLogs.push(`Error ${statusCode}: ${errorMessage}`);
            throw new Error(`Assets HTTP API failed (${statusCode}): ${errorMessage}`);
        }

        logger.info(`Successfully updated metadata for asset: ${assetName}`);
        debugLogs.push(`Assets HTTP API metadata update successful`);
        return { ...responseBody };
    } catch (error) {
        logger.error(`Error Response Text: ${error.message}`);
        debugLogs.push(`Assets HTTP API error: ${error.message}`);
        return { error: error.message };
    }
}

/**
 * Update AEM asset metadata directly at JCR content metadata node
 */
async function updateJCRMetadata(assetPath, properties, aemInstanceUrl, accessToken, logger, debugLogs) {
    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    // Construct direct JCR metadata path
    const metadataNodePath = `${assetPath}/jcr:content/metadata`;
    const metadataUrl = `${aemInstanceUrl}${metadataNodePath}`;
    
    logger.info(`Updating metadata directly at JCR node: ${metadataUrl}`);
    debugLogs.push(`Target JCR metadata node: ${metadataNodePath}`);
    debugLogs.push(`Metadata URL: ${metadataUrl}`);

    while (attempt < maxRetries && !success) {
        try {
            await delay(1000);
            debugLogs.push(`JCR metadata update attempt ${attempt + 1}/${maxRetries}`);
            
            // Create form data for Sling POST servlet
            const formData = new URLSearchParams();
            
            // Add each property to form data
            for (const [key, value] of Object.entries(properties)) {
                if (Array.isArray(value)) {
                    // Handle array values
                    value.forEach(item => formData.append(key, item));
                } else {
                    formData.append(key, value);
                }
                debugLogs.push(`Added property: ${key} = ${value}`);
            }
            
            const response = await fetch(metadataUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'AITaggingWorker/1.0'
                },
                body: formData
            });
            
            logger.info(`JCR metadata update response: ${response.status} ${response.statusText}`);
            debugLogs.push(`Response status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                success = true;
                debugLogs.push('JCR metadata update completed successfully');
                logger.info('JCR metadata update successful');
                
                // Try to get response text for debugging
                try {
                    const responseText = await response.text();
                    if (responseText) {
                        logger.info('Response body:', responseText);
                        debugLogs.push(`Response received: ${responseText.length} chars`);
                    }
                } catch (e) {
                    // Response might be empty, which is OK
                    debugLogs.push('Response body empty (normal for Sling POST)');
                }
            } else {
                const errorText = await response.text();
                logger.error(`JCR metadata update failed: ${response.status} - ${errorText}`);
                debugLogs.push(`Error ${response.status}: ${errorText}`);
                throw new Error(`JCR metadata update failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
        } catch (error) {
            logger.error(`Error during JCR metadata update attempt ${attempt + 1}: ${error.message}`);
            debugLogs.push(`Error attempt ${attempt + 1}: ${error.message}`);
            attempt++;
            
            if (attempt < maxRetries) {
                logger.info(`Retrying JCR metadata update... Attempt ${attempt + 1}`);
                debugLogs.push(`Retrying in 2 seconds... Attempt ${attempt + 1}`);
                await delay(2000);
            }
        }
    }

    if (!success) {
        const errorMsg = `Failed to update JCR metadata after ${maxRetries} attempts`;
        logger.error(errorMsg);
        debugLogs.push(errorMsg);
        throw new Error(errorMsg);
    }
}

module.exports = {
    // Reused from worker/utils.js (unchanged)
    saveToTempFile,
    convertFileToBase64,
    cleanupTempFiles,
    getTagsFromOpenAI,
    processAIResults,
    
    // NEW functions for ai-asset-tagging
    buildPromptFromRequestParams,      // NEW - adapted for request params
    downloadRenditionFromAEMDirect,    // NEW - adapted for environment auth  
    getAccessTokenFromEnv,             // NEW - secure environment-based auth
    
    // Extracted from ai-asset-tagging
    updateAssetMetadata,
    updateAssetMetadataAPI,
    updateJCRMetadata,
    delay
};
