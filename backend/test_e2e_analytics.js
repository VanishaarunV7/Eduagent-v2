const PORT = process.env.PORT || 5000;
const baseUrl = `http://localhost:${PORT}`;

async function run() {
  console.log(`[Analytics Agent E2E Test] Sending query to ${baseUrl}/api/chat...`);

  try {
    const payload = {
      student_id: 'stu001',
      course_id: 'cs_dbms',
      message: 'Compare Internal 1, Internal 2 and Internal 3. What are my weak topics and how can I improve?'
    };

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('HTTP Status:', res.status);
    if (res.status !== 200) {
      throw new Error(`Unexpected status code: ${res.status}`);
    }

    const data = await res.json();
    console.log('Response Payload:', JSON.stringify(data, null, 2));

    // Validations
    console.log('\n--- Validating Response Structure ---');
    
    if (data.agent !== 'Analytics Agent') {
      throw new Error(`Expected agent to be "Analytics Agent" but got "${data.agent}"`);
    }
    console.log('✔ Agent verified: Analytics Agent');

    if (!data.intent) {
      throw new Error('Expected "intent" field to be present in response');
    }
    console.log(`✔ Intent verified: "${data.intent}"`);

    if (!data.analysis) {
      throw new Error('Expected "analysis" object to be present in response');
    }
    console.log('✔ Analysis object exists');

    const expectedKeys = ['average', 'trend', 'weakTopics', 'strongTopics', 'courseOutcomes', 'examReadiness'];
    expectedKeys.forEach(key => {
      if (!(key in data.analysis)) {
        throw new Error(`Expected key "${key}" to exist inside analysis object`);
      }
    });
    console.log('✔ All analysis keys are present');

    console.log('Average Marks calculated:', data.analysis.average);
    console.log('Performance Trend calculated:', data.analysis.trend);
    console.log('Weak Topics found:', data.analysis.weakTopics);
    console.log('Strong Topics found:', data.analysis.strongTopics);
    console.log('Exam Readiness calculated:', data.analysis.examReadiness);

    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('Expected "reply" to contain natural language explanation text');
    }
    console.log('✔ Natural language reply is valid');

    console.log('\n======================================================');
    console.log('✔ E2E ANALYTICS AGENT VERIFICATION PASSED SUCCESSFULLY!');
    console.log('======================================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ E2E ANALYTICS AGENT VERIFICATION FAILED:', error.message);
    process.exit(1);
  }
}

run();
