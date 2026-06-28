/**
 * Detect user intent based on keyword mapping
 * @param {string} message - User query message
 * @returns {string} Intent name
 */
exports.detectIntent = (message) => {
  if (!message || typeof message !== 'string') {
    return 'UNKNOWN';
  }

  const msg = message.toLowerCase().trim();

  // Greeting check
  if (/\b(hello|hi|hey|greetings|yo|morning|afternoon|evening)\b/i.test(msg)) {
    return 'GREETING';
  }

  // Profile details check
  if (/(profile|who am i|my details|my batch|my program|student details|student info)/i.test(msg)) {
    return 'PROFILE';
  }

  // Enrolled courses check
  if (/(what are my courses|enrolled courses|my subjects|what courses|list courses|courses)/i.test(msg)) {
    return 'COURSES';
  }

  // Weak topics check
  if (/(weak|struggle|struggling|worst|difficult|bad|failing|improve|needs work)/i.test(msg) && /(topic|chapter|subject|area)/i.test(msg)) {
    return 'WEAK_TOPICS';
  }
  if (/(weak|struggle|struggling|worst|difficult|bad|failing|needs work)/i.test(msg)) {
    return 'WEAK_TOPICS';
  }

  // Strong topics check
  if (/(strong|excel|master|best|great|good|proficient)/i.test(msg) && /(topic|chapter|subject|area)/i.test(msg)) {
    return 'STRONG_TOPICS';
  }
  if (/(strong|excel|master|best|great|good|proficient)/i.test(msg)) {
    return 'STRONG_TOPICS';
  }

  // Outcomes attainment check
  if (/(outcome|co|attainment|attain|course outcome)/i.test(msg)) {
    return 'OUTCOMES';
  }

  // Next exam schedule check
  if (/(exam|test|schedule|upcoming exam|next exam|when is my exam|room|date)/i.test(msg)) {
    return 'NEXT_EXAM';
  }

  // Class Comparison check
  if (/(compare|comparison|class average|against class|how do i compare|cohort)/i.test(msg)) {
    return 'COMPARISON';
  }

  // Performance analytics check
  if (/(performance|marks|score|grade|result|internal|average|highest|lowest|improvement)/i.test(msg)) {
    return 'PERFORMANCE';
  }

  // Study plan check
  if (/(plan|study plan|schedule|prepare|preparation|study schedule|strategy|guide)/i.test(msg)) {
    return 'STUDY_PLAN';
  }

  return 'UNKNOWN';
};
