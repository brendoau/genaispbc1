'use strict';

/**
 * AI Asset Tagging Worker - Optimized for Pre-warmed Containers (1024MB)
 * 
 * This action is configured to use Adobe I/O Runtime pre-warmed containers
 * for improved performance and reduced cold start times.
 * 
 * Memory limit: 1024MB (supports files up to ~50MB)
 * Runtime: nodejs:22 (default)
 */

const { Core } = require('@adobe/aio-sdk');

const {
    // Reused functions from worker/utils.js (unchanged)
    saveToTempFile,
    convertFileToBase64,
    cleanupTempFiles,
    getTagsFromOpenAI,
    processAIResults,
    
    // NEW adapted functions
    buildPromptFromRequestParams,      // Instead of buildPromptFromInstructions
    downloadRenditionFromAEMDirect,    
    getAccessTokenFromEnv,             
    
    // Extracted metadata functions
    updateAssetMetadata
} = require('./utils');

exports.main = async function main(params) {
    const startTime = Date.now();
    const logger = Core.Logger('ai-asset-tagging', { level: params.LOG_LEVEL || 'info' });
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

    logInfo('=== AI Asset Tagging Started ===');

    try {
        // STEP 0: Input validation and parameter extraction
        logInfo('Step 0 - Input validation');
        debugLogs.push('Step 0 - Input validation');
        const { assetPath: requestAssetPath, promptConfigs, aemInstanceUrl } = params;
        
        if (!requestAssetPath || !promptConfigs || !aemInstanceUrl) {
            throw new Error('Missing assetPath, promptConfigs, or aemInstanceUrl in request body');
        }
        
        assetPath = requestAssetPath;
        logInfo(`Processing asset: ${assetPath}`);
        logInfo(`Using AEM instance: ${aemInstanceUrl}`);

        
        // STEP 1: Build AI prompt from request parameters (not Asset Compute instructions)
        logInfo('Step 1 - Building prompt from request parameters');
        debugLogs.push('Step 1 - Building prompt from request parameters');
        const { prompt } = buildPromptFromRequestParams(promptConfigs, assetPath, logger);
        logInfo(`Generated prompt length: ${prompt.length} characters`);

        // STEP 2: Download rendition from AEM (using environment auth)
        logInfo('Step 2 - Download rendition from AEM');
        debugLogs.push('Step 2 - Download rendition from AEM');
        const renditionResult = await downloadRenditionFromAEMDirect(
            assetPath,
            aemInstanceUrl, 
            params,
            logger,
            debugLogs
        );
        logInfo(`Rendition downloaded successfully: ${renditionResult.size} bytes (${renditionResult.contentType})`);
        logInfo(`Used rendition: ${renditionResult.usedRendition}`);
        debugLogs.push(`Used rendition: ${renditionResult.usedRendition}`);

        // STEP 3: Save to temp file (memory-safe processing)
        logInfo('Step 3 - Save rendition to local storage');
        debugLogs.push('Step 3 - Save rendition to local storage');
        const tempFilePath = await saveToTempFile(renditionResult.buffer, assetPath);
        tempFilePaths.push(tempFilePath);
        logInfo(`File saved to local storage: ${tempFilePath}`);

        // STEP 4: Read file and convert to base64
        logInfo(`Step 4 - Convert to base64: ${tempFilePath}`);
        debugLogs.push('Step 4 - Convert to base64');
        const base64Image = await convertFileToBase64(tempFilePath);
        logInfo(`Base64 conversion complete: ${base64Image.length} characters`);

        // STEP 5: Process with AI
        logInfo('Step 5 - Process with Azure OpenAI');
        debugLogs.push('Step 5 - Process with Azure OpenAI');
        const aiResult = await getTagsFromOpenAI(logger, params, base64Image, prompt);
        
        // Process AI results and create properties object
        const properties = processAIResults(logger, aiResult);
        logInfo(`Properties from AI: ${JSON.stringify(properties)}`);

        // STEP 6: Update AEM metadata directly (not XMP rendition)
        if (Object.keys(properties).length > 0) {
            logInfo('Step 6 - Update AEM metadata');
            debugLogs.push('Step 6 - Update AEM metadata');
            
            // Get access token using environment parameters
            //const accessToken = await getAccessTokenFromEnv(params, logger);
            const accessToken = "eyJhbGciOiJSUzI1NiIsIng1dSI6Imltc19uYTEta2V5LWF0LTEuY2VyIiwia2lkIjoiaW1zX25hMS1rZXktYXQtMSIsIml0dCI6ImF0In0.eyJpZCI6IjE3NjM5MDEyMDc5NjZfOGU4ZjY2ZTQtNWRjMy00ZjMzLWI1OGItZWExMzllOTU3MzgxX3V3MiIsInR5cGUiOiJhY2Nlc3NfdG9rZW4iLCJjbGllbnRfaWQiOiJkZXYtY29uc29sZS1wcm9kIiwidXNlcl9pZCI6IkI1Njg3RjIyNjJEQ0U1OTAwQTQ5NUZBREBiMGZiNTJjODYyZGNiYWEwNDk1ZWMzLmUiLCJzdGF0ZSI6Im0wa3lzTVJ1RzBleHRobTc2RkJWWTAxWSIsImFzIjoiaW1zLW5hMSIsImFhX2lkIjoiMDk0MjcyMDQ2MkEyQ0JDNzBBNDk1QzU1QEFkb2JlSUQiLCJjdHAiOjAsImZnIjoiWjdLQzJONERWTE01QURXMkZDUVZLWEFBWlkiLCJzaWQiOiIxNzU5MjM4MTcxMzY4X2I5YjJiMTI0LWYxMGEtNGU1Yy04Njk3LTA3OTBlODhmODhjYV91dzIiLCJydGlkIjoiMTc2MzkwMTIwNzk2N19mOTVhMTlhMS1hYTE2LTRiMWMtOWM2NS0yMjMwNzIxNmM0MGVfdXcyIiwibW9pIjoiODAzOGUyZTYiLCJwYmEiOiJNZWRTZWNOb0VWLExvd1NlYyIsInJ0ZWEiOiIxNzY1MTEwODA3OTY3IiwiZXhwaXJlc19pbiI6Ijg2NDAwMDAwIiwic2NvcGUiOiJBZG9iZUlELG9wZW5pZCxyZWFkX29yZ2FuaXphdGlvbnMsYWRkaXRpb25hbF9pbmZvLnByb2plY3RlZFByb2R1Y3RDb250ZXh0LGFkZGl0aW9uYWxfaW5mby5yb2xlcyIsImNyZWF0ZWRfYXQiOiIxNzYzOTAxMjA3OTY2In0.HYh0tfyXk7rzoeCfryQLeiOD9DVtM4POxHAb6X4XxCGN2niFamh6uUiLE4tVVu71tHaJZ-mHggxZ1pUQYsX3Df9DonnZCTukBQvciEuxCI4QaCWhIm2t8ouFmuS2Fdrcn4SiXiNPs8arbqBAZKGD-NVxqNeoWQCrNHNzb2LmM_mZHoQuYDDzquCj1qaOJfTeh5jySeZuW12PHRYHrAVpQe1K0OuRLL4r-bFrD5-yXNDVqhLU2alDyXZssZ082H6JjjsR-oT89YjCZ_EnUCz2cyoxa6gMDYN3zYFqRXXcHTqwFsq8XndUF4B3gQuAJ6mLTgjdZqQa6UO1xqjuBqrUiw";
            // Set processing status
            properties["aigen:status"] = "processed";
            
            // Use dual API approach (Assets HTTP API + JCR fallback)
            let metadataUpdateSucceeded = false;
            
            try {
                logInfo('PRIMARY: Attempting Assets HTTP API update...');
                await updateAssetMetadata(assetPath, properties, aemInstanceUrl, accessToken, logger, debugLogs);
                logInfo('SUCCESS: Assets HTTP API update completed successfully');
                metadataUpdateSucceeded = true;
                debugLogs.push(`AI Asset Tagging processed in ${Date.now() - startTime} milliseconds for ${assetPath}`);
                logInfo(`AI Asset Tagging processed in ${Date.now() - startTime} milliseconds for ${assetPath}`);
            } catch (apiError) {
                logError(`FAILED: Assets HTTP API failed: ${apiError.message}`);
                // The updateAssetMetadata function already handles JCR fallback internally
                throw apiError;
            }
            
            if (metadataUpdateSucceeded) {
                logInfo('Metadata updated successfully');
                logInfo(`AI Asset Tagging processed in ${Date.now() - startTime} milliseconds for ${assetPath}`);
            }
        } else {
            logInfo('No properties to update - AI returned empty results');
        }

        // STEP 7: Return success response with debug logs
        debugLogs.push('STEP 7: === AI Asset Tagging Completed Successfully ===');
        
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                status: 'success',
                assetPath: assetPath,
                updatedProperties: Object.keys(properties),
                propertiesCount: Object.keys(properties).length,
                processingTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                debugLogs: debugLogs
            }
        };

    } catch (error) {
        logError('AI Asset Tagging failed:', error.message);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                status: 'error',
                error: error.message,
                assetPath: assetPath,
                processingTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                debugLogs: debugLogs
            }
        };
    } finally {
        // STEP 8: Clean up temp files (always executed)
        logInfo('Step 8 - Clean up temp files');
        debugLogs.push('Step 8 - Clean up temp files');
        await cleanupTempFiles(logger, tempFilePaths);
        logInfo(`AI Asset Tagging processed in ${Date.now() - startTime} milliseconds for ${assetPath}`);
        debugLogs.push(`AI Asset Tagging processed in ${Date.now() - startTime} milliseconds for ${assetPath}`);
        logInfo('=== AI Asset Tagging END ===');
    }
};
