const fs = require('fs');
const path = require('path');
const https = require('https');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;
  console.log(`[Test] Running E2E Study Assistant tests against ${baseUrl}`);

  const docxUrl = "https://raw.githubusercontent.com/rounakdatta/CorrectLy/master/sample.docx";
  const docxPath = path.join(__dirname, 'test_notes.docx');
  const imagePath = path.join(__dirname, 'test_image.png');

  try {
    // 0. Clean up existing files in the database for a clean E2E run
    console.log("[Test] Cleaning up old test files for student 'stu001' and course 'cs_dbms'...");
    const initialListRes = await fetch(`${baseUrl}/api/upload/student/stu001/course/cs_dbms`);
    const initialList = await initialListRes.json();
    for (const item of initialList) {
      await fetch(`${baseUrl}/api/upload/${item._id}`, { method: 'DELETE' });
    }
    console.log(`[Test] Deleted ${initialList.length} residual test files.`);

    console.log(`[Test] Downloading valid sample DOCX from ${docxUrl}...`);
    await downloadFile(docxUrl, docxPath);
    console.log(`[Test] Saved sample DOCX to ${docxPath}`);

    // Create 1x1 transparent PNG buffer
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    fs.writeFileSync(imagePath, pngBuffer);
    console.log(`[Test] Created valid 1x1 PNG image at ${imagePath}`);

    // 1. Upload DOCX Document
    console.log("\n--- [Test 1] Testing DOCX Upload ---");
    const docxBuffer = fs.readFileSync(docxPath);
    const formData = new FormData();
    formData.append('student_id', 'stu001');
    formData.append('course', 'cs_dbms');
    formData.append('subject', 'DBMS Normalization');
    formData.append('file', new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'test_notes.docx');

    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const uploadData = await uploadRes.json();
    console.log("Upload Status:", uploadRes.status);
    console.log("Upload Response:", JSON.stringify(uploadData, null, 2));

    if (uploadRes.status !== 200) {
      throw new Error(`Upload failed with status ${uploadRes.status}`);
    }

    const documentId = uploadData._id;
    if (!documentId) {
      throw new Error("No _id returned in upload response metadata");
    }

    // 2. Upload Image Document (OCR test)
    console.log("\n--- [Test 2] Testing Image OCR Upload ---");
    const imageFileBuffer = fs.readFileSync(imagePath);
    const imgFormData = new FormData();
    imgFormData.append('student_id', 'stu001');
    imgFormData.append('course', 'cs_dbms');
    imgFormData.append('subject', 'DBMS Visual Chart');
    imgFormData.append('file', new Blob([imageFileBuffer], { type: 'image/png' }), 'test_image.png');

    const imgUploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: imgFormData
    });
    const imgUploadData = await imgUploadRes.json();
    console.log("Image Upload Status:", imgUploadRes.status);
    console.log("Image Upload Response:", JSON.stringify(imgUploadData, null, 2));

    // 3. List Uploaded Study Materials
    console.log("\n--- [Test 3] Testing List Study Materials ---");
    const listRes = await fetch(`${baseUrl}/api/upload/student/stu001/course/cs_dbms`);
    const listData = await listRes.json();
    console.log("List Status:", listRes.status);
    console.log("List count:", listData.length);

    if (listRes.status !== 200 || listData.length === 0) {
      throw new Error("Failed to list study materials or list is empty");
    }

    // 4. Test MCQ Generator
    console.log("\n--- [Test 4] Testing MCQ Generation Intent ---");
    const chatRes1 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'cs_dbms',
        message: 'Generate some MCQs from my notes.'
      })
    });
    const chatData1 = await chatRes1.json();
    console.log("MCQ Response Status:", chatRes1.status);
    console.log("MCQ Response Agent:", chatData1.agent);
    console.log("MCQ Reply Preview:\n", chatData1.reply?.slice(0, 150) + "...\n");

    // 5. Test Topic Analyzer (Feature 4)
    console.log("\n--- [Test 5] Testing Topic Analyzer Intent ---");
    const chatRes2 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'cs_dbms',
        message: 'What are the most important topics in my notes?'
      })
    });
    const chatData2 = await chatRes2.json();
    console.log("Topic Analyzer Status:", chatRes2.status);
    console.log("Topic Analyzer Reply Preview:\n", chatData2.reply?.slice(0, 200) + "...\n");

    // 6. Test PYQ Analyzer (Feature 5)
    console.log("\n--- [Test 6] Testing PYQ Analyzer Intent ---");
    const chatRes3 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'cs_dbms',
        message: 'Get previous year questions for DBMS.'
      })
    });
    const chatData3 = await chatRes3.json();
    console.log("PYQ Analyzer Status:", chatRes3.status);
    console.log("PYQ Analyzer Reply Preview:\n", chatData3.reply?.slice(0, 200) + "...\n");

    // 7. Test Question Prediction (Feature 6)
    console.log("\n--- [Test 7] Testing Question Prediction Engine ---");
    const chatRes4 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'cs_dbms',
        message: 'Predict expected exam questions for DBMS.'
      })
    });
    const chatData4 = await chatRes4.json();
    console.log("Prediction Status:", chatRes4.status);
    console.log("Prediction Reply Preview:\n", chatData4.reply?.slice(0, 300) + "...\n");

    if (!chatData4.reply.includes("Confidence Score") || !chatData4.reply.includes("Frequency") || !chatData4.reply.includes("Source Type")) {
      throw new Error("Expected prediction output to contain: Confidence Score, Frequency, and Source Type fields");
    }
    if (!chatData4.reply.includes("These predictions are generated using previous year trends and educational resources. They are not guaranteed examination questions.")) {
      throw new Error("Expected prediction output to contain the exact requested disclaimer statement");
    }

    // 8. Test Strict Fact Validation Fallback (Feature 3)
    console.log("\n--- [Test 8] Testing Strict RAG Warning Fallback ---");
    const chatRes5 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'cs_dbms',
        message: 'Explain how photosynthesis works in biology.'
      })
    });
    const chatData5 = await chatRes5.json();
    console.log("RAG Warning Status:", chatRes5.status);
    console.log("RAG Warning Reply:", chatData5.reply);

    if (!chatData5.reply.includes("The requested information is not available in your uploaded study material")) {
      throw new Error(`Expected RAG fallback warning, but received: "${chatData5.reply}"`);
    }

    // 8.1. Test Forbidden Query Check
    console.log("\n--- [Test 8.1] Testing Forbidden Non-Academic Query ---");
    const chatResForbidden = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'cs_dbms',
        message: 'Who is the current Chief Minister of Karnataka and what is the IPL score?'
      })
    });
    const chatDataForbidden = await chatResForbidden.json();
    console.log("Forbidden Status:", chatResForbidden.status);
    console.log("Forbidden Agent:", chatDataForbidden.agent);
    console.log("Forbidden Reply:", chatDataForbidden.reply);
    if (!chatDataForbidden.reply.includes("I'm designed specifically for educational assistance")) {
      throw new Error(`Expected forbidden refusal message, but got: "${chatDataForbidden.reply}"`);
    }

    // 8.2. Test Allowed General Educational Query
    console.log("\n--- [Test 8.2] Testing Allowed General Educational Query ---");
    const chatResGenEd = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'cs_dbms',
        message: 'Explain Binary Tree and Operating System structure.'
      })
    });
    const chatDataGenEd = await chatResGenEd.json();
    console.log("General Educational Status:", chatResGenEd.status);
    console.log("General Educational Agent:", chatDataGenEd.agent);
    console.log("General Educational Reply Preview:\n", chatDataGenEd.reply?.slice(0, 150) + "...\n");
    if (chatDataGenEd.reply.includes("The requested information is not available")) {
      throw new Error("Expected a general educational explanation, but got study material missing message");
    }

    // 8.3. Test Empty Database Analytics Fallback
    console.log("\n--- [Test 8.3] Testing Empty Database Analytics Fallback ---");
    const chatResEmptyDB = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu_nonexistent_999',
        course_id: 'course_nonexistent_999',
        message: 'what are my weak topics?'
      })
    });
    const chatDataEmptyDB = await chatResEmptyDB.json();
    console.log("Empty DB Status:", chatResEmptyDB.status);
    console.log("Empty DB Reply:", chatDataEmptyDB.reply);
    if (chatDataEmptyDB.reply !== "No student performance data is available.") {
      throw new Error(`Expected "No student performance data is available.", but got: "${chatDataEmptyDB.reply}"`);
    }

    // 9. Cleanup uploaded materials via Delete API
    console.log("\n--- [Test 9] Testing Delete Study Materials ---");
    const deleteRes = await fetch(`${baseUrl}/api/upload/${documentId}`, { method: 'DELETE' });
    console.log("Delete Docx Status:", deleteRes.status);
    
    if (imgUploadData._id) {
      const deleteImgRes = await fetch(`${baseUrl}/api/upload/${imgUploadData._id}`, { method: 'DELETE' });
      console.log("Delete Image Status:", deleteImgRes.status);
    }

    // Verify deletion
    const listRes2 = await fetch(`${baseUrl}/api/upload/student/stu001/course/cs_dbms`);
    const listData2 = await listRes2.json();
    console.log("Verify List Count After Deletion:", listData2.length);
    if (listData2.length !== 0) {
      throw new Error("Files metadata were not deleted successfully");
    }

    console.log("\nAll E2E Study Assistant Tests Passed Successfully!");
    process.exit(0);

  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  } finally {
    if (fs.existsSync(docxPath)) {
      try { fs.unlinkSync(docxPath); } catch (e) {}
    }
    if (fs.existsSync(imagePath)) {
      try { fs.unlinkSync(imagePath); } catch (e) {}
    }
  }
}

run();
