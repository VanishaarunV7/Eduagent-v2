const fs = require('fs');
const https = require('https');
const path = require('path');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
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
  const pdfUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
  const pdfPath = path.join(__dirname, 'test_sample.pdf');
  
  console.log(`[Test] Downloading test PDF from ${pdfUrl}...`);
  await downloadFile(pdfUrl, pdfPath);
  console.log(`[Test] Saved test PDF to ${pdfPath}`);

  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;
  console.log(`[Test] Testing against server at ${baseUrl}`);

  try {
    // 1. Upload PDF
    console.log("\n--- [Test 1] Testing PDF Upload ---");
    const fileBuffer = fs.readFileSync(pdfPath);
    const formData = new FormData();
    formData.append('student_id', 'stu001');
    formData.append('course', 'cs_dbms');
    formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), 'dummy.pdf');

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

    // 2. Query Chat API - Supported Question (Answer should be found)
    console.log("\n--- [Test 2] Testing Chat Query (Supported Question) ---");
    const chatRes1 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'cs_dbms',
        message: 'What is the title of the dummy PDF file?'
      })
    });
    
    const chatData1 = await chatRes1.json();
    console.log("Chat Response 1 Status:", chatRes1.status);
    console.log("Chat Response 1 Body:", JSON.stringify(chatData1, null, 2));

    // 3. Query Chat API - Unsupported Question (Answer should NOT be found)
    console.log("\n--- [Test 3] Testing Chat Query (Unsupported Question - Strict Fallback) ---");
    const chatRes2 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'cs_dbms',
        message: 'What is normalisation in DBMS?'
      })
    });
    
    const chatData2 = await chatRes2.json();
    console.log("Chat Response 2 Status:", chatRes2.status);
    console.log("Chat Response 2 Body:", JSON.stringify(chatData2, null, 2));

    // 4. Query Chat API - Different course (No PDFs uploaded for bio_genetics)
    // Should route to academic agent fallback rather than RAG (since hasPdfs is false)
    console.log("\n--- [Test 4] Testing Chat Query (Different Course - Fallback to Academic Agent) ---");
    const chatRes3 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu001',
        course_id: 'bio_genetics',
        message: 'Explain what genetics is.'
      })
    });
    
    const chatData3 = await chatRes3.json();
    console.log("Chat Response 3 Status:", chatRes3.status);
    console.log("Chat Response 3 Body:", JSON.stringify(chatData3, null, 2));

    console.log("\nE2E Integration Test Completed successfully!");
    process.exit(0);

  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  } finally {
    // Cleanup local test file
    if (fs.existsSync(pdfPath)) {
      try {
        fs.unlinkSync(pdfPath);
      } catch (e) {}
    }
  }
}

run();
