const groq = require('../config/groq');

/**
 * Request completion from Groq llama-3.3-70b-versatile model
 * @param {Array<{role: string, content: string}>} messages - Conversation message array
 * @returns {Promise<string>} Completion response
 */
exports.chatCompletion = async (messages) => {
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
  
  for (const modelName of models) {
    let retries = 2;
    let delay = 1500;

    while (retries > 0) {
      try {
        console.log(`[Groq Service] Requesting completion using model: ${modelName}...`);
        const response = await groq.chat.completions.create({
          messages: messages,
          model: modelName,
          temperature: 0.3,
          max_tokens: 700
        });

        if (response && response.choices && response.choices[0] && response.choices[0].message) {
          return response.choices[0].message.content;
        }
        
        throw new Error('Empty or invalid response structure received from Groq API.');

      } catch (error) {
        console.error(`[Groq Service] Model ${modelName} failed (remaining retries: ${retries - 1}):`, error.message);
        
        const errorMessage = error.message ? error.message.toLowerCase() : '';
        const isRateLimit = error.status === 429 || errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || errorMessage.includes('quota');
        const isTransient = error.status >= 500 || errorMessage.includes('timeout') || errorMessage.includes('deadline');
        const isModelUnsupported = error.status === 400 && (errorMessage.includes('decommissioned') || errorMessage.includes('unknown model') || errorMessage.includes('does not exist') || errorMessage.includes('model not found'));

        // If the model is decommissioned/unsupported or rate-limited on the final retry, fallback immediately
        if (isModelUnsupported || (isRateLimit && retries === 1)) {
          console.warn(`[Groq Service] Fallback triggered from ${modelName} to next model.`);
          break; // break retry loop, proceeds to next model
        }

        if ((isRateLimit || isTransient) && retries > 1) {
          retries--;
          console.log(`[Groq Service] Rate limit or transient error. Retrying ${modelName} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5;
          continue;
        }

        if (error.status === 401 || errorMessage.includes('api key') || errorMessage.includes('unauthorized') || errorMessage.includes('invalid api key')) {
          return "⚠️ Service Authentication Error: The AI service could not be authorized. Please verify the Groq API key configuration in the .env file.";
        }

        break; // break retry loop to try next model
      }
    }
  }

  return "🚦 Rate Limit Exceeded: The AI models are currently receiving high traffic. Please wait a few seconds and try resubmitting your query.";
};
