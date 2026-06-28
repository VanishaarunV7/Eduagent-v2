const path = require('path');

async function test() {
  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;
  console.log(`[E2E Agents Test] Testing against chatbot server at ${baseUrl}`);

  const testCases = [
    {
      name: "Conversational / Mentoring query",
      body: {
        student_id: "stu001",
        course_id: "cs_dbms",
        message: "Hello! Can you give me some tips on how to improve my learning focus?"
      },
      expectedAgent: "Mentor Agent"
    },
    {
      name: "Analytics / Performance query",
      body: {
        student_id: "stu001",
        course_id: "cs_dbms",
        message: "What is my current marks average and how do I compare against the class cohort?"
      },
      expectedAgent: "Analytics Agent"
    },
    {
      name: "Exam Schedule query",
      body: {
        student_id: "stu001",
        course_id: "cs_dbms",
        message: "When is my upcoming exam and what room is it scheduled in?"
      },
      expectedAgent: "Exam Agent"
    },
    {
      name: "Study Planner query",
      body: {
        student_id: "stu001",
        course_id: "cs_dbms",
        message: "Can you create a weekly revision study plan for my DBMS course?"
      },
      expectedAgent: "Study Planner Agent"
    },
    {
      name: "RAG / PDF notes query",
      body: {
        student_id: "stu001",
        course_id: "cs_dbms",
        message: "What is the title of the dummy PDF file?"
      },
      expectedAgent: "RAG Agent"
    }
  ];

  for (const tc of testCases) {
    console.log(`\n--- Executing Test Case: ${tc.name} ---`);
    console.log(`Query message: "${tc.body.message}"`);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tc.body)
      });

      console.log(`HTTP Status: ${res.status}`);
      const data = await res.json();
      console.log(`Selected Agent: ${data.agent}`);
      console.log(`Reply snippet: "${data.reply ? data.reply.slice(0, 150) : 'No reply'}..."`);

      if (data.agent !== tc.expectedAgent) {
        console.warn(`⚠️ Warning: Expected agent to be "${tc.expectedAgent}" but got "${data.agent}"`);
      } else {
        console.log(`✔ Success: routed correctly to ${data.agent}!`);
      }
    } catch (e) {
      console.error(`❌ Failed to execute test case:`, e.message);
    }
  }
}

test();
