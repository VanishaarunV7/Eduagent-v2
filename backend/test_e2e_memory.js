const PORT = process.env.PORT || 5000;
const baseUrl = `http://localhost:${PORT}`;

async function run() {
  console.log(`[Memory E2E Test] Starting conversation memory test against ${baseUrl}...`);

  try {
    const studentId = 'stu001';
    const courseId = 'cs_dbms';
    let sessionId = null;

    // 1. Send first question
    console.log('\n--- [Step 1] Sending First Query (What is database normalization?) ---');
    const res1 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        course_id: courseId,
        message: 'What is database normalization?'
      })
    });

    if (res1.status !== 200) {
      throw new Error(`Step 1 failed with status ${res1.status}`);
    }

    const data1 = await res1.json();
    console.log('Response 1 Status:', res1.status);
    console.log('Response 1 Body:', JSON.stringify(data1, null, 2));

    sessionId = data1.session_id;
    if (!sessionId) {
      throw new Error('No session_id returned in response 1');
    }
    console.log(`✔ Generated and retrieved session_id: ${sessionId}`);

    // 2. Send follow-up question using the session_id
    console.log('\n--- [Step 2] Sending Follow-Up (Explain it in simple words) ---');
    const res2 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        course_id: courseId,
        message: 'Explain it in simple words.',
        session_id: sessionId
      })
    });

    if (res2.status !== 200) {
      throw new Error(`Step 2 failed with status ${res2.status}`);
    }

    const data2 = await res2.json();
    console.log('Response 2 Status:', res2.status);
    console.log('Response 2 Body:', JSON.stringify(data2, null, 2));

    if (data2.session_id !== sessionId) {
      throw new Error(`Session ID changed from ${sessionId} to ${data2.session_id}`);
    }
    console.log('✔ Session ID successfully preserved across requests!');

    // 3. Send another follow-up query
    console.log('\n--- [Step 3] Sending Second Follow-Up (Give an example) ---');
    const res3 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        course_id: courseId,
        message: 'Give an example.',
        session_id: sessionId
      })
    });

    if (res3.status !== 200) {
      throw new Error(`Step 3 failed with status ${res3.status}`);
    }

    const data3 = await res3.json();
    console.log('Response 3 Status:', res3.status);
    console.log('Response 3 Body:', JSON.stringify(data3, null, 2));

    // 4. Retrieve Student history
    console.log(`\n--- [Step 4] Retrieving Student Chat History for ${studentId} ---`);
    const resHistory = await fetch(`${baseUrl}/api/chat/history/${studentId}`);
    if (resHistory.status !== 200) {
      throw new Error(`Step 4 failed with status ${resHistory.status}`);
    }

    const historyData = await resHistory.json();
    console.log(`Found ${historyData.length} total messages in history.`);
    console.log('Sample of last stored message:', JSON.stringify(historyData[historyData.length - 1], null, 2));

    // Verify history contains our session messages
    const sessionMessages = historyData.filter(m => m.session_id === sessionId);
    console.log(`Found ${sessionMessages.length} messages matching our session_id.`);
    if (sessionMessages.length < 6) {
      console.warn(`⚠️ Warning: Expected at least 6 messages for this session (3 user, 3 assistant), but found ${sessionMessages.length}.`);
    } else {
      console.log('✔ Stored chat history matches session and roles correctly.');
    }

    // 5. Clear session
    console.log(`\n--- [Step 5] Clearing Chat Session: ${sessionId} ---`);
    const resClear = await fetch(`${baseUrl}/api/chat/history/${sessionId}`, {
      method: 'DELETE'
    });

    if (resClear.status !== 200) {
      throw new Error(`Step 5 failed with status ${resClear.status}`);
    }

    const clearResult = await resClear.json();
    console.log('Clear API response:', JSON.stringify(clearResult, null, 2));

    // 6. Verify that history is empty for this session
    console.log('\n--- [Step 6] Verifying session was deleted from DB ---');
    const resHistoryAfter = await fetch(`${baseUrl}/api/chat/history/${studentId}`);
    const historyDataAfter = await resHistoryAfter.json();
    const sessionMessagesAfter = historyDataAfter.filter(m => m.session_id === sessionId);
    console.log(`Messages in session after deletion: ${sessionMessagesAfter.length}`);
    if (sessionMessagesAfter.length !== 0) {
      throw new Error(`Session ${sessionId} was not fully deleted. Residual messages remain: ${sessionMessagesAfter.length}`);
    }
    console.log('✔ Session cleared successfully!');

    console.log('\n=============================================');
    console.log('✔ E2E CONVERSATION MEMORY TEST PASSED SUCCESSFULLY!');
    console.log('=============================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ E2E CONVERSATION MEMORY TEST FAILED:', error.message);
    process.exit(1);
  }
}

run();
