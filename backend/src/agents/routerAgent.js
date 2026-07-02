const groqService = require('../services/groqService');
const ragService = require('../services/ragService');

class RouterAgent {
  constructor() {
    this.modelName = 'llama-3.3-70b-versatile';
  }

  /**
   * Check if a query belongs to a strictly forbidden non-academic topic
   * @param {string} message 
   * @returns {boolean}
   */
  isForbiddenQuery(message) {
    const msg = message.toLowerCase().trim();

    // 1. Let greetings pass so they can go to General
    const isGreeting = /^(hi|hello|hey|yo|greetings|morning|afternoon|evening|hola)\b/i.test(msg) && msg.split(' ').length <= 4;
    if (isGreeting) {
      return false;
    }

    // 2. Match forbidden non-academic categories
    const forbiddenPatterns = [
      // Politics & Politicians
      /\b(chief minister|prime minister|president|minister|politics|political|election|elections|voting|government|cabinet|congress|bjp|parliament|democrat|republican|senate|campaign|candidate|governor|mayor)\b/i,
      
      // Sports & Cricket
      /\b(ipl|cricket|score|match|runs|wickets|overs|batsman|bowler|stadium|football|soccer|tennis|sports|olympics|nba|league|fifa|wicket|world cup|athlete|team)\b/i,
      
      // Movies & Entertainment
      /\b(movie|film|review|reviews|actor|actress|celebrity|hollywood|bollywood|netflix|cinema|theater|gossip|song|singer|music|album|director|concert|show|episode|series|drama|dance|comedy)\b/i,
      
      // Weather
      /\b(weather|temperature|forecast|rain|snow|wind|humidity|storm|cloud|climate)\b/i,
      
      // Travel & Tourism
      /\b(travel|flight|hotel|booking|ticket|trip|vacation|tourism|destination|luggage|tour|cruise)\b/i,
      
      // Finance & Stock Market
      /\b(finance|stock|share|crypto|bitcoin|investment|loan|credit card|insurance|mortgage|banking|pricing|market|trading|wallet|tax|inflation|economy|wealth)\b/i,
      
      // Shopping & Commercial
      /\b(shopping|buy|discount|coupon|deal|store|price|sale|cart|purchase|shipping|order|amazon|ebay|flipkart|shopify)\b/i,
      
      // Current affairs & general news
      /\b(current affairs|news|headline|headlines|strike|protest|war|protests|breaking news|rumor|dating|star|wedding)\b/i,
      
      // Unrelated Programming / Professional stuff
      /\b(production deploy|aws production|aws billing|commercial site|enterprise app|monetize|job description|startup|hiring|recruit|resume builder|make money)\b/i,
      
      // General non-academic questions (e.g. tell me a joke, favorite food, how are you, who are you)
      /^(tell me|write|make|sing)\s+a?\s*(joke|song|poem|story|recipe|riddle)\b/i,
      /\b(favorite|favourite)\s+(food|color|colour|movie|actor|sport|team|hobby|game)\b/i,
      /\b(how are you|who are you|what is your name|are you human|do you love|marry me|what is your age|how old are you|where do you live)\b/i
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(msg)) {
        return true;
      }
    }

    // General non-academic subjects/verbs
    const isNonAcademicGeneral = /(bake|cake|restaurant|car|recipe|cook|food|fashion|beauty|makeup|dating|love|relationship|game|playstation|xbox|toy|music|song|movie|travel|joke)/i.test(msg);
    if (isNonAcademicGeneral) {
      return true;
    }

    return false;
  }

  /**
   * Classify user query and return the target specialized agent name
   * @param {string} studentId 
   * @param {string} courseId 
   * @param {string} message 
   * @returns {Promise<string>} Target agent key
   */
  async classifyQuery(studentId, courseId, message, conversationMemory = '') {
    // ===========================================
    // MENTOR DEMO - BREAKPOINT 12
    // Place breakpoint here.
    //
    // Explain:
    // How the Router chooses between Analytics Agent or RAG Agent.
    // First, it applies regex checks for forbidden and common query terms. If those don't trigger, it queries Groq (Llama-3.3) with a system prompt detailing the specialties of each agent, and returns the classified agent intent.
    //
    // Inspect:
    // message
    // hasPdfs
    //
    // Expected value:
    // message: "What are my weak topics?" (or "What is Paging?")
    // hasPdfs: true (if notes uploaded) or false (if none uploaded)
    //
    // Press F10.
    // ===========================================
    try {
      const msg = message.toLowerCase().trim();

      // Check local forbidden query filters.
      if (this.isForbiddenQuery(message)) {
        console.log('[RouterAgent] Local check matched forbidden query. Fast-routing to Forbidden.');
        return 'Forbidden';
      }

      // 2. Fast regex checks for obvious matches to optimize latency
      if (/^(hi|hello|hey|yo|greetings|morning|afternoon|evening)/i.test(msg) && msg.split(' ').length <= 3) {
        console.log('[RouterAgent] Fast-routed greeting to General');
        return 'General';
      }

      if (/(previous year|pyq|frequently asked|university question|expected exam|predict important|expected question|likely question|probable question|repeated question)/i.test(msg)) {
        console.log('[RouterAgent] Fast-routed prediction/PYQ query to PYQ');
        return 'PYQ';
      }

      if (/(marks|score|grade|performance|result|average|internal|weak|strong|gpa|attendance|cohort|compare)/i.test(msg)) {
        console.log('[RouterAgent] Fast-routed performance query to Analytics');
        return 'Analytics';
      }

      // Check if student has uploaded documents for this course
      const hasPdfs = await ragService.hasUploadedDocuments(studentId, courseId).catch(() => false);

      // Querying Groq LLM to classify query intent.
      const systemPrompt = `You are the central Router Agent for EduAgent, an AI academic analytics and student mentor platform.
Your job is to classify the user's message into exactly one of the following categories:

1. "Analytics": If the user is asking about their marks, internal test scores, grades, overall performance, weak topics, strong topics, outcome attainments, class cohort comparison, or asking for an explanation of their analytics.
2. "RAG": If the user is asking specifically about the *uploaded notes, documents, chapters, or files* (e.g., "summarize my notes", "explain chapter 4 of the uploaded PDF", "what does the uploaded syllabus say").
3. "PYQ": If the user is asking about previous year question papers, past exams, university questions, expected questions, exam predictions, or high-weightage repeated topics.
4. "GeneralEducational": If the user is asking general academic/educational questions (e.g. "Explain Binary Tree", "What is Machine Learning?", "Difference between Stack and Queue", "Explain Operating System"). Groq answers this directly using general knowledge.
5. "Exam": If the user is asking about exam schedule, timetables, dates, room numbers, or exam reminders.
6. "StudyPlan": If the user is asking for a study plan, weekly preparation schedule, revision timeline, or daily study tasks.
7. "Mentoring": If the user is asking for motivation, learning strategies, career advice, productivity advice, study tips, or general academic guidance.
8. "General": For simple greetings (hi, hello, etc.).
9. "Forbidden": If the user is asking about non-academic or general topics that are NOT related to education (e.g. politics, IPL/sports, weather, movies, shopping, celebrities, current affairs, non-academic chitchat).

CRITICAL RULES:
- Has uploaded study materials: ${hasPdfs ? 'YES' : 'NO'}.
  * If this is YES: Any academic, concept, or topic explanation queries MUST be classified as "RAG" so they are strictly answered using the uploaded study materials, EXCEPT for general Computer Science, IT, or Programming concepts (like binary tree, stack, queue, database normalization, algorithms, coding) which should be classified as "GeneralEducational".
  * If this is NO: You MUST NOT select "RAG". Select "GeneralEducational" for academic, concept, or topic questions instead, so they can be answered using general knowledge.
- Respond with ONLY the exact name of the category (e.g. "Analytics", "RAG", "PYQ", "GeneralEducational", "Exam", "StudyPlan", "Mentoring", "General", "Forbidden").
- Do NOT include any formatting, markdown, punctuation, preambles, or explanations. Just return the single word.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `CONVERSATION HISTORY:\n=======================\n${conversationMemory || 'No previous conversation history.'}\n=======================\n` },
        { role: 'user', content: `Message to classify: "${message}"` }
      ];

      console.log('[RouterAgent] Querying Groq to classify query intent...');
      const classification = await groqService.chatCompletion(messages);
      const cleanClassification = classification.replace(/[^a-zA-Z]/g, '').trim();

      // Routing decision resolved. Inspect cleanClassification.
      const validCategories = ['Analytics', 'RAG', 'PYQ', 'GeneralEducational', 'Exam', 'StudyPlan', 'Mentoring', 'General', 'Forbidden'];
      if (validCategories.includes(cleanClassification)) {
        let finalClassification = cleanClassification;
        if (hasPdfs && finalClassification === 'GeneralEducational') {
          // Only allow CS/IT/Engineering general concepts to route to GeneralEducational when notes exist.
          // Other subjects (like biology/photosynthesis) fallback to RAG to enforce note boundaries.
          const isCSEConcept = /(binary tree|machine learning|operating system|stack|queue|normalization|dbms|sql|join|database|algorithm|compiler|packet|routing|network|programming|code|java|python|c\+\+|software|hardware|dijkstra|avl tree|computer|thread|process|memory|ip address|data structure)/i.test(message);
          if (!isCSEConcept) {
            console.log('[RouterAgent] Overriding GeneralEducational to RAG for non-CSE concept when notes exist.');
            finalClassification = 'RAG';
          }
        }
        console.log(`[RouterAgent] Successfully classified query as: ${finalClassification}`);
        return finalClassification;
      }

      // Fallback logic if LLM output is not clean or unexpected
      console.warn(`[RouterAgent] Unexpected classification response: "${classification}". Falling back to regex.`);
      return this.fallbackRegexClassifier(message, hasPdfs);

    } catch (error) {
      console.error('[RouterAgent Error]:', error);
      const hasPdfs = await ragService.hasUploadedDocuments(studentId, courseId).catch(() => false);
      return this.fallbackRegexClassifier(message, hasPdfs);
    }
  }

  /**
   * Fallback regex-based classifier in case of LLM failures
   * @param {string} message 
   * @param {boolean} hasPdfs 
   * @returns {string} Category name
   */
  fallbackRegexClassifier(message, hasPdfs) {
    const msg = message.toLowerCase().trim();

    if (this.isForbiddenQuery(message)) {
      return 'Forbidden';
    }
    if (/(exam|test|schedule|timetable|room|upcoming exam|when is my exam|date)/i.test(msg)) {
      return 'Exam';
    }
    if (/(plan|study plan|prepare|preparation|schedule|timeline|weekly|daily task)/i.test(msg)) {
      return 'StudyPlan';
    }
    if (/(marks|score|grade|performance|result|average|internal|weak|strong|gpa|attendance|cohort|compare)/i.test(msg)) {
      return 'Analytics';
    }
    if (/(previous year|pyq|frequently asked|university question|expected exam|predict important|expected question|likely question|probable question|repeated question)/i.test(msg)) {
      return 'PYQ';
    }
    if (/(explain binary tree|machine learning|operating system|stack|queue|explain|what is|difference between)/i.test(msg)) {
      return hasPdfs ? 'RAG' : 'GeneralEducational';
    }
    if (/(career|advice|motivate|motivation|inspiration|strategy|strategies|productivity|advice)/i.test(msg)) {
      return 'Mentoring';
    }
    if (hasPdfs) {
      return 'RAG';
    }
    if (/(hello|hi|hey|yo|greetings|morning|afternoon|evening)/i.test(msg)) {
      return 'General';
    }

    return hasPdfs ? 'RAG' : 'GeneralEducational'; // Default fallback to answering directly
  }
}

module.exports = new RouterAgent();

