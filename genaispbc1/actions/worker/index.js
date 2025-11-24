'use strict';

// Core dependencies
const { Core } = require('@adobe/aio-sdk');
const { worker } = require('@adobe/asset-compute-sdk');

const {
    buildPromptFromInstructions,
    cleanupTempFiles,
    convertFileToBase64,
    downloadRenditionFromAEM,
    getTagsFromOpenAI,
    processAIResults,
    saveToTempFile,
    updateMetadata,
    setProcessingFlag
} = require('./utils');

// Constants
const DEFAULT_LOG_LEVEL = 'info';

exports.main = worker(async (source, rendition, params) => {
    const startTime = Date.now();
    const logger = Core.Logger('main', { level: params.LOG_LEVEL || DEFAULT_LOG_LEVEL });
    const debugLogs = [];
    let tempFilePaths = [];
    let assetPath;
    
    // Helper function to log to both logger and debug array
    function logInfo(message, data) {
        logger.info(message, data);
        debugLogs.push(`[INFO] ${message}`);
    }
    
    function logError(message, data) {
        logger.error(message, data);
        debugLogs.push(`[ERROR] ${message}`);
    }

    logInfo('Image-tagging-service: START');

    try {
        // Get asset path from instructions
        assetPath = rendition.instructions.userData?.assetPath;

        if (!assetPath) {
            throw new Error('Asset path missing in userData');
        }
        // STEP 0: Build AI prompt from instructions
        logInfo(`Image-tagging-service: Step 0 - Preparing prompt from instructions for asset - ${assetPath}`);
        debugLogs.push('STEP 0: Image-tagging-service: Step 0 - Preparing prompt from instructions for asset - ${assetPath}');
        const { prompt, namespaces } = buildPromptFromInstructions(rendition.instructions, assetPath);
        logInfo(`Image-tagging-service: Generated prompt: ${prompt}`);


        // STEP 1: Download rendition from AEM (JCR Direct Access)
        logInfo('Image-tagging-service: Step 1 - Download rendition from AEM');
        debugLogs.push('STEP 1: Image-tagging-service: Step 1 - Download rendition from AEM');
        const aemInstanceUrl = params.AEM_TARGET_URL;

        if (aemInstanceUrl) {
            const renditionResult = await downloadRenditionFromAEM(
                logger,
                assetPath,
                aemInstanceUrl,
                params
            );
            logInfo(`Image-tagging-service: Rendition downloaded successfully: ${renditionResult.size} bytes (${renditionResult.contentType})`);

            // STEP 2: Save to temp file
            logInfo('Image-tagging-service: Step 2 - Save Rendition to local storage');
            debugLogs.push('STEP 2: Image-tagging-service: Step 2 - Save Rendition to local storage');
            const tempFilePath = await saveToTempFile(renditionResult.buffer, assetPath);
            tempFilePaths.push(tempFilePath);
            logInfo(`Image-tagging-service: File copied to local storage - ${tempFilePath || 'failed'}`);

            // STEP 3: Read file and convert to base64
            logInfo(`Image-tagging-service: Step 3 - Convert to base64 - ${tempFilePath}`);
            debugLogs.push('STEP 3: Image-tagging-service: Step 3 - Convert to base64 - ${tempFilePath}');
            const base64Image = await convertFileToBase64(tempFilePath);
            logInfo(`Image-tagging-service: Base64 conversion complete: ${base64Image.length} characters`);

            // STEP 4: Process with AI
            logInfo('Image-tagging-service: Step 4 - Process with AI');
            debugLogs.push('STEP 4: Image-tagging-service: Step 4 - Process with AI');
            const result = await getTagsFromOpenAI(logger, params, base64Image, prompt);

            // Process AI results and create properties object
            const properties = processAIResults(logger, result);
            logInfo(`Image-tagging-service: Properties from AI - ${JSON.stringify(properties)}`);

            // STEP 5: Write back XMP properties to metadata
            logInfo(`Image-tagging-service: Step 5 - Write XMP metadata`);
            debugLogs.push('STEP 5: Image-tagging-service: Step 5 - Write XMP metadata');
            properties["aigen:status"] = "processed";
            
            // Add debug logs to metadata for troubleshooting
            properties["aigen:debugLogs"] = JSON.stringify(debugLogs);
            properties["aigen:processingTimeMs"] = Date.now() - startTime;
            
            await updateMetadata(rendition, properties, namespaces);
            logInfo('Image-tagging-service: Image Tagging Service Completed.');
            debugLogs.push('STEP 6: Image-tagging-service: Image Tagging Service Completed.');
            logInfo(`Image-tagging-service: Processed in ${(Date.now() - startTime)} milliseconds for ${assetPath}`);
        debugLogs.push(`Image-tagging-service: Processed in ${(Date.now() - startTime)} milliseconds for ${assetPath}`);
        }
    } catch (error) {
        logError('Image-tagging-service: Image Tagging Service failed:', error);
        logInfo('Image-tagging-service: Setting Flag to failed');
        await setProcessingFlag(rendition, "failed");
        throw error;
    } finally {
        // STEP 6: Clean up temp files
        logInfo('Image-tagging-service: Step 6 - Clean up');
        await cleanupTempFiles(logger, tempFilePaths);
        logInfo(`Image-tagging-service: Processed in ${(Date.now() - startTime)} milliseconds for ${assetPath}`);
        debugLogs.push(`Image-tagging-service: Processed in ${(Date.now() - startTime)} milliseconds for ${assetPath}`);
        logInfo('Image-tagging-service: END');
    }
});
