const Groq = require('groq-sdk');

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.warn('⚠️ Warning: GROQ_API_KEY is not defined in environment variables.');
}

const groq = new Groq({
  apiKey: apiKey || ''
});

module.exports = groq;
