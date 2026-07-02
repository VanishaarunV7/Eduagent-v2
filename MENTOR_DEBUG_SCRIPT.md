# EduAgent-V2 Live Debugging Script & Request Lifecycles

This script is prepared to guide you through your live debugging demonstration for your mentor review. It covers **Flow 1 (Login)**, **Flow 2 (Dashboard)**, and **Flow 3 (Chatbot - Router, Analytics, and RAG)** in detail.

---

## Part 1: Architecture & Request Lifecycles

### 1. Overall Request Lifecycle
Every HTTP request initiated by the student user goes through a unified, secure path:
1. **Frontend Trigger**: The Angular frontend (running at `http://localhost:4200`) makes an HTTP request using Angular's `HttpClient`.
2. **Authorization Interceptor**: For authenticated routes, an Angular HTTP Interceptor checks `localStorage` for a JWT token. If present, it attaches it as a header: `Authorization: Bearer <JWT_TOKEN>`.
3. **Express Routing**: The request arrives at the Node.js/Express backend (running at `http://localhost:3000`).
4. **Auth Middleware**: If the route is protected, the request passes through the `authenticateJWT` middleware which extracts and decrypts the JWT token. If valid, user info is attached to `req.user`.
5. **Controller Routing**: The request is routed to the designated controller (e.g. `dashboardController`, `chatController`).
6. **Data Storage & External Services**: The controller queries MongoDB (using Mongoose schemas) and, if required, vector stores (ChromaDB) and external LLM endpoints (Groq API).
7. **JSON Response**: The backend compiles an aggregated JSON payload and returns it to the client with an appropriate HTTP status code (200, 201, 400, 401, etc.).
8. **Angular UI Render**: Angular consumes the JSON data and updates its reactive templates using custom components, services, and routing rules.

---

### 2. JWT Lifecycle
JSON Web Tokens (JWT) secure user sessions statelessly:
1. **Generation (Login)**: Upon verifying email and password hash, the backend builds a JSON payload: `{ userId, role, student_id, program_id }`.
2. **Signing**: The backend signs this payload with a high-entropy secret key (`JWT_SECRET`) and configures an expiration window (7 days).
3. **Storage**: The signed JWT string is returned to Angular and stored in the browser's `localStorage` (as `token` and `user`).
4. **Transmission**: For every subsequent API call, Angular attaches the JWT inside the `Authorization` header.
5. **Stateless Verification**: The backend intercepts the token, decrypts it with `JWT_SECRET`, checks the signature validity and expiration. No database hit is required just to check session validity.
6. **Destruction (Logout)**: Logging out is stateless. Angular deletes the token from local storage, making all subsequent requests unauthorized.

---

### 3. Dashboard Lifecycle
The Dashboard dynamically populates student academic states:
1. **Route Activation**: When the dashboard page is visited, Angular retrieves the active student's session details from storage and requests: `GET /api/dashboard/:studentId/:courseId`.
2. **Parallel Retrieval**: The controller receives the request, identifies the student ID, and queries multiple MongoDB collections (`results`, `attendances`, `assignments`, `examschedules`, `studymaterials`) simultaneously using `Promise.all`.
3. **Node.js Aggregations**: Node.js calculates stats in-memory:
   - **GPA**: Computed from exam marks average divided by 25.
   - **Topic Performance**: Deterministic scores computed dynamically to check strong, average, or weak topics.
   - **Attendance Percentage**: Aggregated status counts (`Present` / `Absent`).
   - **Assignments status**: Categorized as Reviewed, Submitted, Not Started, or Overdue.
4. **Response**: A single large JSON response containing the unified payload is returned to Angular, which binds the properties to the charts and progress circles.

---

### 4. Chatbot Multi-Agent Routing Lifecycle
The AI Chatbot routes prompts dynamically depending on intent:
1. **Prompt Entry**: The student enters a prompt (e.g. *"What are my weak topics?"* or *"What is Paging?"*).
2. **Post Request**: Angular dispatches: `POST /api/chat` with `{ message, course_id, session_id }`.
3. **Router Agent (Classifier)**: The backend invokes `RouterAgent.js`. The Router uses custom regexes for greetings/forbidden topics first. If they do not match, it sends the prompt to Groq (`llama-3.3-70b-versatile`) with routing definitions.
4. **Intent Dispatching**:
   - **Analytics Agent**: If the intent is classified as `Analytics`, the query routes to `analyticsAgent.js`. The agent queries academic performance from MongoDB, calculates averages and stats, compiles a text-based context string (`structuredContext`), and queries Groq to explain the results in natural language.
   - **RAG Agent**: If the intent is classified as `RAG` (and PDFs exist), the query routes to `ragAgent.js`. The agent queries ChromaDB using Xenova embeddings to pull matching text snippets from uploaded PDF files, injects these text snippets into the prompt, and queries Groq to answer based on the notes.
5. **Reply Returned**: The response object is compiled: `{ agent: "...", reply: "...", analysis: {...} }` and sent back to Angular to render in the chat feed.

---
---

## Part 2: Step-by-Step Live Debugging Walkthrough

### Preparation Steps before Mentor Review:
1. Open the project in VS Code.
2. Ensure you have the Chrome browser open at `http://localhost:4200`.
3. Set VS Code debugging to attach to your Node.js backend.
4. Open the files below and place breakpoints at the exact lines indicated.

---

### FLOW 1: Student Login → Authentication → JWT → Angular

```
  [ Browser (Angular Login) ]
              │
              ▼  (POST /api/auth/login)
  [ authController.js ]
        ├─ BP 1: Extract credentials from req.body
        ├─ BP 2: Query user document from MongoDB
        ├─ BP 3: Bcrypt verification of password
        ├─ BP 4: Build payload & sign JWT token
        └─ BP 5: Return JSON response (token + profile)
              │
              ▼
  [ Browser (Angular redirect to Dashboard) ]
```

#### Breakpoint 1: Receive Login Request
* **File Name**: [authController.js](file:///c:/EduAgent-V2/backend/src/controllers/authController.js)
* **Line Number**: `48`
* **Target Code**: `const { email, password } = req.body;`
* **What to do**:
  1. Open the **Browser**, go to the Login screen, enter email `student@example.com` and password `password123`.
  2. Click **Login**.
  3. **Switch to VS Code** (the debugger will pause at Breakpoint 1).
* **Hover & Inspect**:
  * `req.body`
* **Expected Value**:
  * `req.body` = `{ email: "student@example.com", password: "password123" }`
* **Explain to Mentor**:
  > "The Angular frontend has sent a login POST request to `/api/auth/login`. Here at Breakpoint 1, the backend controller is extracting the student's email and password credentials from the request body."
* **Next Action**: Press **F10** (Step Over) to proceed.

---

#### Breakpoint 2: Query User Document
* **File Name**: [authController.js](file:///c:/EduAgent-V2/backend/src/controllers/authController.js)
* **Line Number**: `77`
* **Target Code**: `let user = await User.findByEmailWithPassword(email);`
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `email`
  * `user` (after pressing F10)
* **Expected Value**:
  * `email` = `"student@example.com"`
  * `user` = A Mongoose document representing the student user containing fields: `_id`, `userId`, `role: "student"`, and the hashed password.
* **Explain to Mentor**:
  > "Now, the backend queries the `users` collection in MongoDB Atlas to find the record corresponding to the provided email identifier. We retrieve the full user profile including the salt-hashed password."
* **Next Action**: Press **F10** (Step Over) twice to pass through checks and reach Breakpoint 3.

---

#### Breakpoint 3: Bcrypt Compare Passwords
* **File Name**: [authController.js](file:///c:/EduAgent-V2/backend/src/controllers/authController.js)
* **Line Number**: `109`
* **Target Code**: `const isMatch = await user.comparePassword(password);`
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `password`
  * `user.password`
  * `isMatch` (after pressing F10)
* **Expected Value**:
  * `password` = `"password123"`
  * `isMatch` = `true`
* **Explain to Mentor**:
  > "For security, we never store passwords in plain text. Here, the backend uses `bcrypt.compare` to hash the incoming login password and compare it against the cryptographically hashed password stored in MongoDB."
* **Next Action**: Press **F10** (Step Over) twice to reach Breakpoint 4.

---

#### Breakpoint 4: Build Token Payload & JWT Sign
* **File Name**: [authController.js](file:///c:/EduAgent-V2/backend/src/controllers/authController.js)
* **Line Number**: `134`
* **Target Code**: `const payload = buildTokenPayload(user);`
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `payload`
  * `token` (after pressing F10)
* **Expected Value**:
  * `payload` = `{ userId: "...", name: "...", email: "student@example.com", role: "student", student_id: "STU10001", program_id: "CS_UNDERGRAD" }`
  * `token` = `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."` (A long JWT base64 string)
* **Explain to Mentor**:
  > "Since password authentication was successful, we construct the JWT payload. It includes the student's ID, role, and program parameters, which are signed using the backend's secret key. This token secures future API calls statelessly."
* **Next Action**: Press **F10** (Step Over) to reach Breakpoint 5.

---

#### Breakpoint 5: Send Login Response
* **File Name**: [authController.js](file:///c:/EduAgent-V2/backend/src/controllers/authController.js)
* **Line Number**: `156`
* **Target Code**: `return res.status(200).json({`
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `token`
* **Expected Value**:
  * `token` = `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
* **Explain to Mentor**:
  > "Finally, we return the generated token and safe user details back to the Angular client. The frontend will store this token in `localStorage` and redirect the student to the dashboard."
* **Next Action**: Press **F5** (Continue) and **Switch to Browser**. The dashboard page will load.

---
---

### FLOW 2: Dashboard → Authentication Middleware → MongoDB → Dashboard Response

```
  [ Browser (Dashboard Page Init) ]
              │
              ▼  (GET /api/dashboard/STU10001/CS101 with Header Authorization)
  [ auth.js ] (Middleware)
        ├─ BP 6: Intercept header authorization & extract token
        └─ BP 7: Verify token signature and attach req.user
              │
              ▼
  [ dashboardController.js ]
        ├─ BP 8: Extract studentId & courseId parameters
        ├─ BP 9: Fetch results, attendance, assignments, and exams in parallel (Promise.all)
        └─ BP 10: Aggregate results & return JSON payload
              │
              ▼
  [ Browser (Renders charts, average grades, and schedules) ]
```

#### Breakpoint 6: Intercept Authorization Header
* **File Name**: [auth.js](file:///c:/EduAgent-V2/backend/src/middleware/auth.js)
* **Line Number**: `20`
* **Target Code**: `const authHeader = req.headers.authorization;`
* **What to do**:
  1. Once the dashboard page loads in the **Browser**, it initiates the dashboard details fetch.
  2. The debugger will pause at Breakpoint 6 in the authentication middleware.
* **Hover & Inspect**:
  * `authHeader`
* **Expected Value**:
  * `authHeader` = `"Bearer eyJhbGciOi..."`
* **Explain to Mentor**:
  > "For every protected request, the Angular client attaches the JWT token to the Authorization header. This middleware intercepts the incoming request and extracts the token."
* **Next Action**: Press **F10** (Step Over) a few times to pass validation and reach Breakpoint 7.

---

#### Breakpoint 7: Verify Token Signature
* **File Name**: [auth.js](file:///c:/EduAgent-V2/backend/src/middleware/auth.js)
* **Line Number**: `47`
* **Target Code**: `const decoded = jwt.verify(token, JWT_SECRET);`
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `token`
  * `decoded` (after pressing F10)
  * `req.user` (after pressing F10)
* **Expected Value**:
  * `decoded` = `{ userId: "...", role: "student", student_id: "STU10001", program_id: "CS_UNDERGRAD", ... }`
* **Explain to Mentor**:
  > "Here, we decrypt and verify the token signature using the server's `JWT_SECRET`. Once validated, the decoded payload details are attached to `req.user` so downstream controllers know which student is making the request."
* **Next Action**: Press **F5** (Continue) to proceed into the controller.

---

#### Breakpoint 8: Student ID Extraction
* **File Name**: [dashboardController.js](file:///c:/EduAgent-V2/backend/src/controllers/dashboardController.js)
* **Line Number**: `19`
* **Target Code**: `try { const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;`
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `req.user.student_id`
  * `req.params.courseId`
* **Expected Value**:
  * `req.user.student_id` = `"STU10001"`
  * `req.params.courseId` = `"CS101"`
* **Explain to Mentor**:
  > "The request enters the Dashboard controller. We extract the course ID from the parameters and securely identify the student's ID from the JWT payload context rather than trusting client parameters blindly."
* **Next Action**: Press **F5** (Continue) to run queries and hit Breakpoint 9.

---

#### Breakpoint 9: Parallel MongoDB Queries
* **File Name**: [dashboardController.js](file:///c:/EduAgent-V2/backend/src/controllers/dashboardController.js)
* **Line Number**: `71`
* **Target Code**: `const [results, topics, outcomes, examSchedule, attendanceLogs, assignments, submissions, announcements, studyMaterials] = await Promise.all([`
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `results` (after pressing F10)
  * `attendanceLogs` (after pressing F10)
  * `assignments` (after pressing F10)
  * `examSchedule` (after pressing F10)
* **Expected Value**:
  * `results` = Array of objects containing exam marks records for this student.
  * `attendanceLogs` = Array of attendance logs.
  * `assignments` = Array of assignment deadlines.
* **Explain to Mentor**:
  > "To load the dashboard efficiently, we perform parallel database queries using `Promise.all`. We fetch the student's academic marks, class attendance logs, assignments, exam schedules, and course announcements in a single concurrent step, reducing request roundtrip latency."
* **Next Action**: Press **F5** (Continue) to pass calculations and reach Breakpoint 10.

---

#### Breakpoint 10: Aggregate and Return Dashboard Response
* **File Name**: [dashboardController.js](file:///c:/EduAgent-V2/backend/src/controllers/dashboardController.js)
* **Line Number**: `255`
* **Target Code**: `res.status(200).json({`
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `attendance` (aggregated percentage number)
  * `gpa` (calculated GPA)
  * `academicStatus` (e.g. "Good Standing")
  * `topicPerformanceList` (array of topic scores)
* **Expected Value**:
  * `attendance` = `85` (example percentage)
  * `gpa` = `3.4` (example GPA)
  * `academicStatus` = `"Good Standing"`
* **Explain to Mentor**:
  > "After retrieving raw documents, Node.js aggregates them: we compute the overall attendance percentage, calculate the GPA from grades, and evaluate weak and strong topics. Finally, we package these metrics into a unified JSON structure and return it back to Angular."
* **Next Action**: Press **F5** (Continue) and **Switch to Browser**. See the dashboard displays student charts.

---
---

### FLOW 3: Chatbot → Router Agent → Analytics Agent / RAG Agent → MongoDB → Groq → Response

```
  [ Browser (Types "What are my weak topics?") ]
                       │
                       ▼  (POST /api/chat)
  [ chatController.js ]
        └─ BP 11: Receive student query message
              │
              ▼
  [ routerAgent.js ]
        └─ BP 12: Route query to specialized agent
              │
              ├─► (Analytics Intent matched)
              │   [ analyticsAgent.js ]
              │         └─ BP 13: Fetch student logs, calculate stats, build prompt & call Groq
              │
              └─► (RAG Intent matched)
                  [ ragAgent.js ]
                        └─ BP 14: Query ChromaDB Vector Store & call Groq using PDF context
              │
              ▼
  [ chatController.js ]
        └─ BP 15: Send AI reply back to Angular
              │
              ▼
  [ Browser (Renders chatbot conversation response) ]
```

#### Breakpoint 11: Receive Chat Message
* **File Name**: [chatController.js](file:///c:/EduAgent-V2/backend/src/controllers/chatController.js)
* **Line Number**: `13`
* **Target Code**: `try {` (Right inside `handleChat` function)
* **What to do**:
  1. In the **Browser**, open the AI Chatbot panel.
  2. Type: *"What are my weak topics?"* and press **Send**.
  3. The debugger will pause at Breakpoint 11 in `chatController.js`.
* **Hover & Inspect**:
  * `req.body.message`
* **Expected Value**:
  * `req.body.message` = `"What are my weak topics?"`
* **Explain to Mentor**:
  > "The chatbot receives the student's question prompt at `/api/chat`. We retrieve the message text, which we will route into our multi-agent framework to identify how to handle this query."
* **Next Action**: Press **F5** (Continue) to dispatch to the orchestrator.

---

#### Breakpoint 12: Router Agent Intent Detection
* **File Name**: [routerAgent.js](file:///c:/EduAgent-V2/backend/src/agents/routerAgent.js)
* **Line Number**: `82`
* **Target Code**: `try {` (Right inside `classifyQuery` method)
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `message`
  * `cleanClassification` (Step over Groq query call to inspect this)
* **Expected Value**:
  * `message` = `"What are my weak topics?"`
  * `cleanClassification` = `"Analytics"`
* **Explain to Mentor**:
  > "The Router Agent acts as the orchestrator. It uses a semantic rules prompt sent to Groq's Llama-3.3 model to classify the intent of the prompt. If the student asks about marks or topics progress, it classifies it as 'Analytics'. If they ask specific questions about uploaded PDFs, it classifies it as 'RAG'."
* **Next Action**: Press **F5** (Continue). Since the prompt was about weak topics, it routes to `analyticsAgent.js` and pauses at Breakpoint 13.

---

#### Breakpoint 13: Analytics Agent Context Preparation
* **File Name**: [analyticsAgent.js](file:///c:/EduAgent-V2/backend/src/agents/analyticsAgent.js)
* **Line Number**: `761`
* **Target Code**: `// ===========================================` (Right after aggregating statistics)
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `results`
  * `analysis`
  * `structuredContext`
  * `messages`
* **Expected Value**:
  * `structuredContext` = A text summary block listing exam averages, attendance logs, and syllabus details.
  * `messages` = Array including the system instructions (instructing the model not to calculate math itself) and user messages.
* **Explain to Mentor**:
  > "Since intent is 'Analytics', the Analytics Agent takes over. It queries the student's academic records, aggregates them in Node.js (calculating GPA, weak areas, and trends), and formats them into a structured text context. We feed this structured data context to Groq to generate a natural, supportive guidance response without allowing the LLM to hallucinate or miscalculate numbers."
* **Next Action**: Press **F5** (Continue) to complete the call and hit Breakpoint 15 in `chatController.js`.

---

#### Breakpoint 14: RAG Agent Vector Retrieval (Alternative path for PDF queries)
* **File Name**: [ragAgent.js](file:///c:/EduAgent-V2/backend/src/agents/ragAgent.js)
* **Line Number**: `39`
* **Target Code**: `chunks = await retriever.retrieveContext(message, studentId, courseId, 8);`
* **What to do**:
  * *Note: To demonstrate this path, play out the previous Analytics response (Press F5) then in the chatbot browser, upload a PDF notes file and type: "What is Paging?" or similar topic from the notes.*
  * The Router Agent classifies the query as `"RAG"` and dispatches to the RAG Agent, pausing at Breakpoint 14.
* **Hover & Inspect**:
  * `message`
  * `chunks` (Step over retriever call to inspect this)
* **Expected Value**:
  * `message` = `"What is Paging?"`
  * `chunks` = Array of text snippets matching the term paging retrieved from the vector store.
* **Explain to Mentor**:
  > "When the student asks about concepts covered in uploaded materials, the request routes to the RAG Agent. It converts the question into vector embeddings and queries our ChromaDB vector database to locate the most similar text segments. It retrieves these matching chunks and forwards them as system context to Groq so the LLM writes an explanation restricted to the student's study material."
* **Next Action**: Press **F5** (Continue) to proceed back to `chatController.js`.

---

#### Breakpoint 15: Send Final Chatbot Response
* **File Name**: [chatController.js](file:///c:/EduAgent-V2/backend/src/controllers/chatController.js)
* **Line Number**: `54`
* **Target Code**: `return res.status(200).json({`
* **What to do**: Debugger is paused here.
* **Hover & Inspect**:
  * `result.agent`
  * `result.reply`
* **Expected Value**:
  * `result.agent` = `"Analytics Agent"` (or `"RAG Agent"`)
  * `result.reply` = The conversational explanation returned by the LLM.
* **Explain to Mentor**:
  > "The specialized agent completes processing. We return the natural language reply back to Angular, specifying which agent resolved it so the UI can format the chatbot message accordingly."
* **Next Action**: Press **F5** (Continue) and **Switch to Browser**. See the chatbot message appear on the screen!
