const https = require('https');
const Course = require('../../models/Course');
const PreviousYearAnalysis = require('../../models/PreviousYearAnalysis');
const groqService = require('../../services/groqService');

/**
 * Execute a search request to DuckDuckGo HTML
 * @param {string} query 
 * @returns {Promise<string>} HTML body
 */
function searchDuckDuckGo(query) {
  return new Promise((resolve, reject) => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse results from DuckDuckGo HTML output
 */
function parseDuckDuckGoSnippets(html) {
  const snippets = [];
  const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const titleRegex = /<a class="result__url"[^>]*>([\s\S]*?)<\/a>/gi;
  
  let match;
  // Match snippets
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < 6) {
    const cleanText = match[1]
      .replace(/<[^>]*>/g, '') // remove HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanText) {
      snippets.push(cleanText);
    }
  }
  
  return snippets;
}

/**
 * Process Previous Year Question Analysis (Feature 5)
 */
exports.process = async (studentId, courseId, query, contextChunks, historyMessages = []) => {
  console.log(`[PYQAnalyzer] Retrieving course details for ID: ${courseId}`);
  
  // 1. Fetch course details to formulate search
  let courseName = courseId;
  try {
    const course = await Course.findOne({ course_id: courseId });
    if (course && course.course_name) {
      courseName = course.course_name;
    }
  } catch (err) {
    console.warn('[PYQAnalyzer] Failed to query Course model:', err.message);
  }

  const searchQueryTerm = `${courseName} university previous year questions exam papers`;
  
  // 2. Check MongoDB cache first to make it extremely fast & reliable
  try {
    const cachedAnalysis = await PreviousYearAnalysis.findOne({ courseId, queryTerm: searchQueryTerm });
    if (cachedAnalysis) {
      console.log(`[PYQAnalyzer] Found cached analysis in MongoDB for course: ${courseId}`);
      return cachedAnalysis.analysisData;
    }
  } catch (cacheErr) {
    console.error('[PYQAnalyzer Cache Read Error]:', cacheErr.message);
  }

  console.log(`[PYQAnalyzer] Conducting live web search: "${searchQueryTerm}"`);
  
  let searchSnippets = [];
  try {
    const html = await searchDuckDuckGo(searchQueryTerm);
    searchSnippets = parseDuckDuckGoSnippets(html);
    console.log(`[PYQAnalyzer] Live search fetched ${searchSnippets.length} snippets.`);
  } catch (searchErr) {
    console.warn(`[PYQAnalyzer] Web search request failed: ${searchErr.message}. Relying on syllabus standards...`);
  }

  // If live search returned no snippets, we return the strict educational fallback phrase
  if (searchSnippets.length === 0) {
    console.log('[PYQAnalyzer] No search snippets retrieved. Returning standard empty papers response.');
    return "No reliable previous year question papers were found for this subject.";
  }

  const searchContext = `LIVE WEB SEARCH SUMMARIES OF PAST EXAM PAPERS:\n=====================================\n${searchSnippets.join('\n\n')}\n=====================================`;

  const systemPrompt = `You are the Previous Year Question (PYQ) Analyzer for the EduAgent Study Assistant.
Your task is to analyze repeated question patterns and chapter weightages for: "${courseName}" (${courseId}).

INSTRUCTIONS:
1. Search and summarize standard, reliable university exam patterns and questions.
2. Use the provided search snippets representing actual university sites and past papers if available:
${searchContext}
3. Identify:
   - Frequently repeated topics across multiple years.
   - Chapter/topic weightages (marks distribution).
   - Recurring question patterns (e.g., Short 2-mark vs long-form 10-mark).
4. Do NOT fabricate previous year questions. Only output standard, verifiable questions and patterns for "${courseName}".
5. Format the analysis beautifully in Markdown with headings, bullet points, and tables if appropriate.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: query }
  ];

  const responseText = await groqService.chatCompletion(messages);

  // 3. Cache the analysis in MongoDB for future instant retrieval
  try {
    const newAnalysis = new PreviousYearAnalysis({
      courseId: courseId,
      queryTerm: searchQueryTerm,
      analysisData: responseText,
      sources: searchSnippets.map((s, i) => ({ title: `Search result snippet ${i + 1}`, url: 'https://duckduckgo.com' }))
    });
    await newAnalysis.save();
    console.log(`[PYQAnalyzer] Saved analysis cache to MongoDB.`);
  } catch (saveErr) {
    console.error('[PYQAnalyzer Cache Save Error]:', saveErr.message);
  }

  return responseText;
};
