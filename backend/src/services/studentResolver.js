const Student = require('../models/Student');
const groqService = require('./groqService');

class StudentResolver {
  /**
   * Extract student reference (name or ID) from user message using Groq
   * @param {string} message 
   * @returns {Promise<{ studentName: string|null, studentId: string|null }>}
   */
  async extractStudentReference(message) {
    try {
      const systemPrompt = `You are a Student Entity Extractor for the EduAgent platform.
Your job is to identify if the teacher is asking about a specific student by name or student ID in their message.

If a student's name or student ID is mentioned, extract it.
Respond with a clean JSON object containing:
- "studentName": The extracted student name (string), or null if not found.
- "studentId": The extracted student ID (string), or null if not found.

Examples:
1. "Show Rahul's marks." -> {"studentName": "Rahul", "studentId": null}
2. "How is STU001 performing?" -> {"studentName": null, "studentId": "STU001"}
3. "Compare Priya's internal marks." -> {"studentName": "Priya", "studentId": null}
4. "What are Arun's weak topics?" -> {"studentName": "Arun", "studentId": null}
5. "Show students who are at attendance risk" -> {"studentName": null, "studentId": null}
6. "Who is the class topper?" -> {"studentName": null, "studentId": null}

Return ONLY the raw JSON object. Do NOT include markdown blocks, preambles, explanations, or any extra text.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Message: "${message}"` }
      ];

      const completion = await groqService.chatCompletion(messages);
      const cleaned = completion.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      
      try {
        const parsed = JSON.parse(cleaned);
        return {
          studentName: parsed.studentName || null,
          studentId: parsed.studentId || null
        };
      } catch (err) {
        console.warn('[StudentResolver] Failed to parse JSON from Groq completion:', completion);
        return this.fallbackRegexExtraction(message);
      }
    } catch (error) {
      console.error('[StudentResolver Extraction Error]:', error);
      return this.fallbackRegexExtraction(message);
    }
  }

  /**
   * Fallback regex-based extraction if Groq API fails or returns unexpected format
   */
  fallbackRegexExtraction(message) {
    const idMatch = message.match(/\b(stu\d+)\b/i);
    if (idMatch) {
      return { studentName: null, studentId: idMatch[1].toLowerCase() };
    }
    return { studentName: null, studentId: null };
  }

  /**
   * Resolve a student from name or ID, performing database lookup
   * @param {string} message 
   * @returns {Promise<{ resolved: boolean, studentId?: string, errorReply?: string, studentName?: string }>}
   */
  async resolveStudent(message) {
    const extraction = await this.extractStudentReference(message);

    // If neither studentId nor studentName is provided, it's a class-level query
    if (!extraction.studentId && !extraction.studentName) {
      return { resolved: false };
    }

    const searchTarget = extraction.studentName || extraction.studentId;
    console.log(`[Teacher Agent]\nUser Query:\n"${message}"\n`);
    console.log(`Extracted Student:\n${searchTarget}\n`);

    if (extraction.studentId) {
      // Lookup by student_id
      const studentId = extraction.studentId.trim();
      const student = await Student.findOne({
        student_id: { $regex: new RegExp(`^${studentId}$`, 'i') }
      });

      if (!student) {
        console.log(`[Teacher Agent] Student ID "${studentId}" not found in DB.`);
        return {
          resolved: false,
          errorReply: `I couldn't find a student with ID "${studentId}". Please check the ID or name.`
        };
      }

      console.log(`Resolved Student ID:\n${student.student_id}\n`);
      return { resolved: true, studentId: student.student_id, studentName: student.name };
    }

    if (extraction.studentName) {
      const name = extraction.studentName.trim().replace(/\s+/g, ' ');
      
      // Lookup in Students collection case-insensitively, supporting partial matches on word boundaries
      const query = {
        name: { $regex: new RegExp(`\\b${name}\\b`, 'i') }
      };

      const matches = await Student.find(query);

      if (matches.length === 0) {
        console.log(`[Teacher Agent] No student matching name "${name}" found in DB.`);
        return {
          resolved: false,
          errorReply: `I couldn't find a student named "${extraction.studentName}". Please check the spelling or provide the Student ID.`
        };
      }

      if (matches.length > 1) {
        console.log(`[Teacher Agent] Ambiguous matches for name "${name}":`, matches.map(s => s.name));
        return {
          resolved: false,
          errorReply: `Multiple students named ${extraction.studentName} were found. Please specify the Student ID.`
        };
      }

      console.log(`Resolved Student ID:\n${matches[0].student_id}\n`);
      return { resolved: true, studentId: matches[0].student_id, studentName: matches[0].name };
    }

    return { resolved: false };
  }
}

module.exports = new StudentResolver();
