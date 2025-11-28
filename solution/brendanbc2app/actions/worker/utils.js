// Core dependencies
const auth = require('@adobe/jwt-auth');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { serializeXmp } = require('@adobe/asset-compute-xmp');

// Constants
const ARRAY_BUFFER_TIMEOUT_MS = 25000; // 25 seconds
const DC_NAMESPACE = 'http://purl.org/dc/elements/1.1/';
const EXCLUDED_INSTRUCTION_KEYS = ['embedBinaryLimit', 'target', 'userData', 'worker', 'fmt'];
const FETCH_TIMEOUT_MS = 30000; // 30 seconds
const IMS_ENDPOINT = 'https://ims-na1.adobelogin.com';
const OPENAI_MAX_TOKENS = 900;
const OPENAI_TEMPERATURE = 0.10;
const OPENAI_TIMEOUT_MS = 10000; // 10 seconds
const RENDITION_NAMESPACE = 'http://ns.adobe.com/rendition/1.0/';
const JCR_CONTENT_RENDITIONS = '/jcr:content/renditions';
const TEMP_DIR = '/tmp';
const USER_AGENT = 'AdobeAssetCompute/1.0';

/**
 * Builds the AI prompt from rendition instructions
 * 
 * @param {Object} instructions - The rendition instructions
 * @returns {Object} Object containing prompt and namespaces
 */
function buildPromptFromInstructions(instructions, assetPath) {
    let prompt = 'Please follow these tagging instructions for product images, then return the corresponding tags in JSON format. Please do not add any markdown or special formatting characters. Here are the suggested keys: ';
    let namespaces;
    let valueSet = '';
    const instructionKeys = Object.keys(instructions);

    instructionKeys.forEach(key => {
        if (key === 'namespace') {
            const parsed = JSON.parse(instructions[key]);
            parsed['dc'] = DC_NAMESPACE;
            parsed['rendition'] = RENDITION_NAMESPACE;
            namespaces = { namespaces: parsed };
        } else if (!EXCLUDED_INSTRUCTION_KEYS.includes(key)) {
            prompt += `${key}/`;
            // Add assetPath to aigen_brand value
            if (key === 'aigen_brand') {
                const folderPath = assetPath ? path.dirname(assetPath) : '';
                valueSet += instructions[key] + ' Here is the folder path for reference: ' + folderPath + '. ';
            } else {
                valueSet += instructions[key] + ' ';
            }
        }
    });

    const lastSlash = prompt.lastIndexOf('/');
    if (lastSlash !== -1) prompt = prompt.slice(0, lastSlash) + '. ';
    prompt = prompt.replaceAll('/', ', ') + valueSet;
    // Append file name to the prompt
    const fileName = path.basename(assetPath || '');
    prompt += ' Here is the file name as reference: ' + fileName + '.';
    return { prompt, namespaces };
}

/**
 * Process AI results and convert to properties object
 * 
 * @param {Object} logger - Logger instance
 * @param {string} result - The AI result string
 * @returns {Object} Properties object with namespaces
 */
function processAIResults(logger, result) {
    const properties = {};

    if (result) {
        const jsonResult = JSON.parse(result);
        for (const key in jsonResult) {
            if (Object.prototype.hasOwnProperty.call(jsonResult, key)) {
                let keyWithNamespace = key.replace('_', ':');
                properties[keyWithNamespace] = jsonResult[key];
            }
        }
    } else {
        logger.warn('Image-tagging-service: No results received from AI analysis');
    }
    return properties;
}

/**
 * Create temporary file and save buffer to it
 * 
 * @param {Object} buffer - Buffer to save
 * @param {string} assetPath - Path to the asset
 * @returns {string} Path to the temporary file
 */
async function saveToTempFile(buffer, assetPath) {
    const assetName = path.basename(assetPath, path.extname(assetPath));
    const tempFileName = `${assetName}_${Date.now()}.jpeg`;
    const tempFilePath = path.join(TEMP_DIR, tempFileName);

    await fs.writeFile(tempFilePath, buffer);

    return tempFilePath;
}

/**
 * Read file and convert to base64
 * 
 * @param {string} tempFilePath - Path to the temporary file
 * @returns {string} Base64 encoded string
 */
async function convertFileToBase64(tempFilePath) {
    const fileBuffer = await fs.readFile(tempFilePath);
    const base64 = fileBuffer.toString('base64');

    return base64;
}

/**
 * Sleep function to add delay between retries
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} A promise that resolves after the specified time
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get tags from Azure OpenAI with retry mechanism
 * 
 * @param {Object} logger - Logger instance
 * @param {Object} params - Parameters
 * @param {string} base64Image - Base64 encoded image
 * @param {string} prompt - Prompt for OpenAI
 * @returns {string|null} OpenAI response content or null if no content
 */
async function getTagsFromOpenAI(logger, params, base64Image, prompt) {
    const azureAPIEndpoint = params.AZURE_OPENAI_ENDPOINT;
    const azureAPIKey = params.AZURE_OPENAI_API_KEY;
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 1000; // 3 second delay between retries

    if (!azureAPIEndpoint || !azureAPIKey) {
        throw new Error('Azure OpenAI credentials missing');
    }

    let lastError = null;

    // Try the request up to MAX_RETRIES + 1 times (initial attempt + retries)
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            // If this is a retry, log it and wait before trying again
            if (attempt > 0) {
                logger.info(`Image-tagging-service: Retry attempt ${attempt} of ${MAX_RETRIES} for Azure OpenAI request`);
                await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
            }

            const response = await fetch(azureAPIEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': azureAPIKey,
                    'User-Agent': USER_AGENT
                },
                timeout: OPENAI_TIMEOUT_MS,
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: prompt
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:image/jpeg;base64,${base64Image}`
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: OPENAI_TEMPERATURE,
                    max_tokens: OPENAI_MAX_TOKENS
                })
            });

            // If response is not ok, handle the error but allow for retries
            if (!response.ok) {
                const errorText = await response.text();
                lastError = new Error(`Azure OpenAI failed: ${response.status} ${response.statusText} - ${errorText}`);
                logger.error(`Image-tagging-service: Azure OpenAI failed with status ${response.status}: ${errorText}`);

                // If this was the last attempt, throw the error
                if (attempt === MAX_RETRIES) {
                    throw lastError;
                }

                // Otherwise continue to the next retry attempt
                continue;
            }

            // Process successful response
            const jsonResponse = await response.json();
            const choicesArray = jsonResponse.choices;
            if (choicesArray && choicesArray.length > 0) {
                const firstChoice = choicesArray[0];
                const message = firstChoice.message;
                if (message) {
                    if (attempt > 0) {
                        logger.info(`Image-tagging-service: Successfully retrieved tags from Azure OpenAI after ${attempt} retries`);
                    }
                    return message.content;
                }
            }

            logger.warn('Image-tagging-service: No AI response content received');
            return null;

        } catch (error) {
            lastError = error;
            logger.error(`Image-tagging-service: Error during Azure OpenAI request (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${error.message}`);

            // If this was the last attempt, throw the error
            if (attempt === MAX_RETRIES) {
                throw error;
            }

            // Otherwise continue to the next retry attempt
        }
    }
}

/**
 * Clean up temporary files
 * 
 * @param {Object} logger - Logger instance
 * @param {string[]} tempFilePaths - Array of paths to temporary files
 * @returns {Promise<void>}
 */
async function cleanupTempFiles(logger, tempFilePaths) {
    // Clean up local temp files
    for (const tempPath of tempFilePaths) {
        try {
            await fs.unlink(tempPath);
        } catch (error) {
            logger.warn(`Image-tagging-service: Failed to delete temp file ${tempPath}: ${error.message}`);
        }
    }
}

/**
 * Get the access token to authenticate with Adobe IMS
 *
 * @param {Object} developerConsoleCredentials - The credentials from the Adobe Developer Console
 * @returns {string} The access token
 */
async function getAccessToken(developerConsoleCredentials) {
    if (developerConsoleCredentials.accessToken) {
        // This is a Local Development access token
        return developerConsoleCredentials.accessToken;
    } else {
        // This is the Service Credentials JSON object that must be exchanged with Adobe IMS for an access token
        const serviceCredentials = developerConsoleCredentials.integration;

        // Use the @adobe/jwt-auth library to exchange service credentials for an access token
        const { access_token } = await auth({
            clientId: serviceCredentials.technicalAccount.clientId,
            technicalAccountId: serviceCredentials.id,
            orgId: serviceCredentials.org,
            clientSecret: serviceCredentials.technicalAccount.clientSecret,
            privateKey: serviceCredentials.privateKey,
            metaScopes: serviceCredentials.metascopes.split(','),
            ims: IMS_ENDPOINT,
        });

        return access_token;
    }
}

/**
 * Download rendition from AEM using JCR Direct Access approach with retry mechanism
 * 
 * @param {Object} logger - Logger instance
 * @param {string} assetPath - Path to the asset in AEM
 * @param {string} aemInstanceUrl - AEM instance URL
 * @param {Object} params - Parameters containing GDAM_TOKEN
 * @returns {Object} Object containing buffer, size and contentType
 */
async function getRenditionListFromAEM(logger, assetPath, aemInstanceUrl, accessToken) {
    // Use JCR Direct Access pattern
    const renditionUrl = `${aemInstanceUrl}${assetPath}${JCR_CONTENT_RENDITIONS}.1.json`;
    logger.info(`Image-tagging-service: List rendition from AEM: ${renditionUrl}`);

    const response = await fetch(renditionUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        timeout: FETCH_TIMEOUT_MS
    });

    // If response is not ok, handle the error but allow for retries
    if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Image-tagging-service: Rendition list from AEM failed with status ${response.status}: ${errorText}`);
        new Error(`Rendition list from AEM failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return { renditionList: await response.json(), status: response.status };
}
function prepareRenditionPath(renditionList) {
    const keys = Object.keys(renditionList);

    // Filter only 'web' and 'thumbnail'
    const filtered = keys.filter(item =>
        item.includes('web') || item.includes('thumbnail')
    );
    // Sort: web first, thumbnails descending order by max size
    const sorted = filtered.sort((a, b) => {
        if (a.includes('web')) return -1;
        if (b.includes('web')) return 1;
        const numA = Math.max(...a.match(/\d+/g).map(Number));
        const numB = Math.max(...b.match(/\d+/g).map(Number));
        return numB - numA; // Descending
    });
    if (sorted.length === 0) {
        throw new Error(`Image rendition list from AEM failed: no web or thumbnail rendition avaialable`);
    }
    // Pop the first one
    return JCR_CONTENT_RENDITIONS + "/" + sorted.shift();

}
/**
 * Download rendition from AEM using JCR Direct Access approach with retry mechanism
 * 
 * @param {Object} logger - Logger instance
 * @param {string} assetPath - Path to the asset in AEM
 * @param {string} aemInstanceUrl - AEM instance URL
 * @param {Object} params - Parameters containing GDAM_TOKEN
 * @returns {Object} Object containing buffer, size and contentType
 */
async function downloadRenditionFromAEM(logger, assetPath, aemInstanceUrl, params) {
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 1000; // 1 second delay between retries
    let lastError = null;

    // Try the request up to MAX_RETRIES + 1 times (initial attempt + retries)
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            // If this is a retry, log it and wait before trying again
            if (attempt > 0) {
                logger.info(`Image-tagging-service: Retry attempt ${attempt} of ${MAX_RETRIES} for downloading rendition from AEM`);
                await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
            }

            const gdamToken = JSON.parse(params.GDAM_TOKEN);
            const accessToken = await getAccessToken(gdamToken);

            logger.info(`Image-tagging-service: Fetch rendition list`);
            const { renditionList, status } = await getRenditionListFromAEM(logger, assetPath, aemInstanceUrl, accessToken);

            if (status === 200) {
                // Use JCR Direct Access pattern
                const renditionUrl = `${aemInstanceUrl}${assetPath}${prepareRenditionPath(renditionList)}`;
                logger.info(`Image-tagging-service: Downloading rendition: ${renditionUrl}`);

                const response = await fetch(renditionUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'User-Agent': USER_AGENT,
                        'Accept': 'image/*'
                    },
                    timeout: FETCH_TIMEOUT_MS
                });

                // If response is not ok, handle the error but allow for retries
                if (!response.ok) {
                    const errorText = await response.text();
                    lastError = new Error(`Image download from AEM failed: ${response.status} ${response.statusText} - ${errorText}`);
                    logger.error(`Image-tagging-service: Image download from AEM failed with status ${response.status}: ${errorText}`);

                    // If this was the last attempt, throw the error
                    if (attempt === MAX_RETRIES) {
                        throw lastError;
                    }

                    // Otherwise continue to the next retry attempt
                    continue;
                }

                // Add timeout for the arrayBuffer conversion
                const arrayBufferPromise = response.arrayBuffer();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`ArrayBuffer conversion timeout after ${ARRAY_BUFFER_TIMEOUT_MS / 1000} seconds`)),
                        ARRAY_BUFFER_TIMEOUT_MS)
                );

                try {
                    const arrayBuffer = await Promise.race([arrayBufferPromise, timeoutPromise]);
                    const assetSize = response.headers.get('content-length') || arrayBuffer.byteLength;

                    if (attempt > 0) {
                        logger.info(`Image-tagging-service: Successfully downloaded rendition from AEM after ${attempt} retries`);
                    }

                    return {
                        buffer: Buffer.from(arrayBuffer),
                        size: parseInt(assetSize),
                        contentType: response.headers.get('content-type')
                    };
                } catch (bufferError) {
                    // Handle arrayBuffer conversion errors
                    lastError = bufferError;
                    logger.error(`Image-tagging-service: Error during arrayBuffer conversion (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${bufferError.message}`);

                    // If this was the last attempt, throw the error
                    if (attempt === MAX_RETRIES) {
                        throw bufferError;
                    }

                    // Otherwise continue to the next retry attempt
                    continue;
                }
            } else {
                throw new Error(`Image rendition list from AEM failed: ${status}`);
            }
        } catch (error) {
            lastError = error;
            logger.error(`Image-tagging-service: Error during rendition download (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${error.message}`);

            // If this was the last attempt, throw the error
            if (attempt === MAX_RETRIES) {
                throw error;
            }

            // Otherwise continue to the next retry attempt
        }
    }
}

/**
 * Updates the metadata of a rendition by serializing properties to XMP format and writing to the rendition file
 * 
 * @param {Object} rendition - The rendition object containing the path to write to
 * @param {Object} properties - The properties object containing metadata key-value pairs
 * @param {Object} namespaces - The namespaces object defining XML namespaces for the metadata
 * @returns {Promise<void>} A promise that resolves when the metadata has been written
 */
async function updateMetadata(rendition, properties, namespaces) {
    const xmp = serializeXmp(properties, namespaces);
    await fs.writeFile(rendition.path, xmp, 'utf-8');
}

/**
 * Sets a processing status flag in the rendition's metadata
 * 
 * @param {Object} rendition - The rendition object to update
 * @param {string} flag - The status flag value to set (e.g., 'processing', 'complete', 'error')
 * @returns {Promise<void>} A promise that resolves when the processing flag has been set
 */
async function setProcessingFlag(rendition, flag) {
    const properties = { "aigen:status": flag };
    const namespaces = { namespaces: { "aigen": "http://ns.adobe.com/xap/1.0/aigen/" } };
    await updateMetadata(rendition, properties, namespaces);
}
module.exports = {
    buildPromptFromInstructions,
    cleanupTempFiles,
    convertFileToBase64,
    downloadRenditionFromAEM,
    getTagsFromOpenAI,
    processAIResults,
    saveToTempFile,
    updateMetadata,
    setProcessingFlag
};