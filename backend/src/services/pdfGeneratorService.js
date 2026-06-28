/**
 * pdfGeneratorService.js
 *
 * Generates a professional, multi-section Study Plan PDF using PDFKit.
 * Returns the absolute path of the saved file.
 *
 * Sections:
 *  1. Cover Page
 *  2. Student Profile & Performance Summary
 *  3. Internal Marks & Trend Analysis
 *  4. Topic Performance (Weak / Average / Strong)
 *  5. Course Outcomes (CO Attainment)
 *  6. Exam Countdown & Schedule
 *  7. Daily Study Timetable (7 days)
 *  8. Weekly Study Plan Table (2 weeks)
 *  9. Recommended Resources
 * 10. Revision Strategy
 * 11. AI-Generated Tips
 * 12. Progress Checklist
 * 13. Footer
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ─── Constants ────────────────────────────────────────────────────────────────
const INDIGO      = '#6366f1';
const INDIGO_DARK = '#4f46e5';
const INDIGO_LIGHT = '#e0e7ff';
const SLATE_DARK  = '#1e293b';
const SLATE_MED   = '#334155';
const SLATE_LIGHT = '#64748b';
const BORDER_COLOR = '#e2e8f0';
const BG_LIGHT    = '#f8fafc';
const SUCCESS     = '#22c55e';
const WARNING     = '#f59e0b';
const DANGER      = '#ef4444';
const WHITE       = '#ffffff';

const OUTPUT_DIR = path.join(__dirname, '../../tmp/study-plans');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Draw a horizontal rule line
 */
function drawHRule(doc, { y, color = BORDER_COLOR, lineWidth = 0.5 } = {}) {
  const yPos = y !== undefined ? y : doc.y;
  doc
    .moveTo(50, yPos)
    .lineTo(doc.page.width - 50, yPos)
    .lineWidth(lineWidth)
    .strokeColor(color)
    .stroke();
}

/**
 * Draw a filled rounded rectangle
 */
function fillRect(doc, x, y, w, h, color, radius = 6) {
  doc.roundedRect(x, y, w, h, radius).fill(color);
}

/**
 * Add a section header (colored bar with white text)
 */
function sectionHeader(doc, title, icon = '') {
  ensurePageSpace(doc, 50);
  const y = doc.y + 10;
  fillRect(doc, 50, y, doc.page.width - 100, 28, INDIGO, 6);
  doc
    .fillColor(WHITE)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`${icon} ${title}`, 60, y + 8, { lineBreak: false });
  doc.y = y + 36;
  doc.fillColor(SLATE_DARK);
}

/**
 * Check remaining page space and add a new page if needed
 */
function ensurePageSpace(doc, needed = 80) {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
  }
}

/**
 * Draw a simple two-column table row
 */
function tableRow(doc, col1, col2, { bg = WHITE, bold = false, col1Color = SLATE_DARK, col2Color = SLATE_MED } = {}) {
  ensurePageSpace(doc, 24);
  const y = doc.y;
  const pageW = doc.page.width - 100;
  const col1W = pageW * 0.45;
  const col2W = pageW * 0.55;

  fillRect(doc, 50, y, col1W, 22, bg, 0);
  fillRect(doc, 50 + col1W, y, col2W, 22, bg, 0);

  doc
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(9)
    .fillColor(col1Color)
    .text(col1, 56, y + 6, { width: col1W - 10, lineBreak: false });

  doc
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(9)
    .fillColor(col2Color)
    .text(col2, 56 + col1W, y + 6, { width: col2W - 10, lineBreak: false });

  doc.y = y + 22;
}

/**
 * Bullet point row
 */
function bulletRow(doc, text, color = INDIGO, score = null) {
  ensurePageSpace(doc, 22);
  const y = doc.y;
  doc.circle(60, y + 6, 3).fill(color);
  const scoreStr = score !== null ? `  [${score}%]` : '';
  doc
    .fillColor(SLATE_DARK)
    .font('Helvetica')
    .fontSize(9.5)
    .text(`${text}${scoreStr}`, 70, y + 1, { width: doc.page.width - 130 });
  doc.y = Math.max(doc.y, y + 14);
}

/**
 * Checkbox row for checklist
 */
function checkboxRow(doc, text) {
  ensurePageSpace(doc, 22);
  const y = doc.y;
  doc.rect(58, y + 2, 11, 11).strokeColor(INDIGO).lineWidth(1).stroke();
  doc
    .fillColor(SLATE_DARK)
    .font('Helvetica')
    .fontSize(9.5)
    .text(text, 76, y + 3, { width: doc.page.width - 136 });
  doc.y = Math.max(doc.y, y + 18);
}

/**
 * Trend color helper
 */
function trendColor(trend) {
  if (trend === 'Improving') return SUCCESS;
  if (trend === 'Declining') return DANGER;
  return WARNING;
}

/**
 * Exam readiness color
 */
function readinessColor(status) {
  if (status === 'Ready') return SUCCESS;
  if (status === 'High Risk') return DANGER;
  return WARNING;
}

// ─── Main PDF Generator ──────────────────────────────────────────────────────

/**
 * Generate the study plan PDF.
 * @param {Object} planData - All structured data for the plan
 * @returns {Promise<{ filePath: string, fileId: string }>}
 */
async function generateStudyPlanPDF(planData) {
  ensureOutputDir();

  const fileId = uuidv4();
  const fileName = `study-plan-${fileId}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  const {
    student,
    programName,
    courseName,
    courseId,
    internals,
    average,
    highest,
    lowest,
    trend,
    improvementPct,
    weakTopics,
    averageTopics,
    strongTopics,
    courseOutcomes,
    highestCO,
    lowestCO,
    examReadiness,
    upcomingExam,
    planSections,       // AI-generated content object
    duration,
    generatedAt
  } = planData;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Study Plan — ${student.name} — ${courseName}`,
        Author: 'EduAgent AI',
        Subject: 'Personalized Academic Study Plan',
        CreationDate: new Date()
      }
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const pageW = doc.page.width - 100; // usable width (50px margins each side)

    // ── PAGE 1: COVER ───────────────────────────────────────────────────────

    // Deep indigo header block
    fillRect(doc, 0, 0, doc.page.width, 200, INDIGO_DARK, 0);

    // EduAgent branding
    doc
      .fillColor(INDIGO_LIGHT)
      .font('Helvetica')
      .fontSize(10)
      .text('EDUAGENT AI ACADEMIC PLATFORM', 50, 40, { align: 'center', width: pageW });

    // Title
    doc
      .fillColor(WHITE)
      .font('Helvetica-Bold')
      .fontSize(28)
      .text('PERSONALIZED', 50, 70, { align: 'center', width: pageW, lineBreak: false });

    doc
      .fillColor(INDIGO_LIGHT)
      .font('Helvetica-Bold')
      .fontSize(28)
      .text(' STUDY PLAN', { continued: false });

    doc
      .fillColor(WHITE)
      .font('Helvetica')
      .fontSize(12)
      .text(`${courseName}`, 50, 120, { align: 'center', width: pageW });

    // Accent bar under header
    fillRect(doc, 0, 200, doc.page.width, 6, '#818cf8', 0);

    // Student info card
    doc.y = 230;
    fillRect(doc, 50, 220, pageW, 110, BG_LIGHT, 8);
    doc.rect(50, 220, pageW, 110).strokeColor(BORDER_COLOR).lineWidth(1).stroke();

    doc
      .fillColor(SLATE_DARK)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(student.name, 70, 235);

    doc
      .fillColor(SLATE_LIGHT)
      .font('Helvetica')
      .fontSize(9)
      .text(`Student ID: ${student.student_id}  •  Program: ${programName}  •  Batch: ${student.batch || 'N/A'}`, 70, 253);

    drawHRule(doc, { y: 268, color: BORDER_COLOR });

    // 3-column stats in cover card
    const statY = 276;
    const statW = (pageW - 40) / 3;

    const stats = [
      { label: 'Overall Average', value: `${average}%`, color: average >= 75 ? SUCCESS : average >= 60 ? WARNING : DANGER },
      { label: 'Performance Trend', value: trend, color: trendColor(trend) },
      { label: 'Exam Readiness', value: examReadiness, color: readinessColor(examReadiness) }
    ];

    stats.forEach((s, i) => {
      const x = 70 + i * (statW + 20);
      doc.fillColor(s.color).font('Helvetica-Bold').fontSize(14).text(s.value, x, statY, { lineBreak: false });
      doc.fillColor(SLATE_LIGHT).font('Helvetica').fontSize(8).text(s.label, x, statY + 18);
    });

    doc.y = 350;

    // Plan metadata
    fillRect(doc, 50, 355, pageW, 60, INDIGO, 8);
    doc
      .fillColor(WHITE)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(`Duration: ${duration}`, 70, 368, { continued: true })
      .font('Helvetica')
      .text(`   |   Generated: ${new Date(generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, { continued: true })
      .text(`   |   Course ID: ${courseId}`);

    doc
      .fillColor(INDIGO_LIGHT)
      .font('Helvetica')
      .fontSize(8)
      .text('This plan is AI-generated based on your real academic performance data from MongoDB.', 70, 390, { width: pageW - 40 });

    // ── PAGE 2: PERFORMANCE SUMMARY ──────────────────────────────────────────
    doc.addPage();

    sectionHeader(doc, 'PERFORMANCE SUMMARY', '📊');

    // Internal marks table header
    const tableY = doc.y;
    const cols = ['Exam', 'Marks', 'Out Of', 'Status'];
    const colWidths = [pageW * 0.35, pageW * 0.2, pageW * 0.2, pageW * 0.25];
    let cx = 50;
    fillRect(doc, 50, tableY, pageW, 22, INDIGO_LIGHT, 4);
    cols.forEach((col, i) => {
      doc.fillColor(INDIGO_DARK).font('Helvetica-Bold').fontSize(9)
        .text(col, cx + 4, tableY + 6, { width: colWidths[i] - 8, lineBreak: false });
      cx += colWidths[i];
    });
    doc.y = tableY + 22;

    const examRows = [
      { label: 'Internal 1', marks: internals.internal1, total: 100 },
      { label: 'Internal 2', marks: internals.internal2, total: 100 },
      { label: 'Internal 3', marks: internals.internal3, total: 100 },
    ].filter(r => r.marks !== null);

    examRows.forEach((row, idx) => {
      const rowY = doc.y;
      const bg = idx % 2 === 0 ? WHITE : '#f1f5f9';
      fillRect(doc, 50, rowY, pageW, 22, bg, 0);
      let rx = 50;
      const pct = Math.round((row.marks / row.total) * 100);
      const status = pct >= 80 ? '✔ Strong' : pct >= 60 ? '◆ Average' : '✘ Needs Work';
      const statusColor = pct >= 80 ? SUCCESS : pct >= 60 ? WARNING : DANGER;
      [row.label, `${row.marks}`, `${row.total}`, ''].forEach((val, i) => {
        if (i === 3) {
          doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(9)
            .text(status, rx + 4, rowY + 6, { width: colWidths[i] - 8, lineBreak: false });
        } else {
          doc.fillColor(SLATE_DARK).font('Helvetica').fontSize(9)
            .text(val, rx + 4, rowY + 6, { width: colWidths[i] - 8, lineBreak: false });
        }
        rx += colWidths[i];
      });
      doc.y = rowY + 22;
    });

    doc.y += 8;

    // Stats row
    const statsRow = [
      { label: 'Average', value: `${average}%` },
      { label: 'Highest', value: `${highest}/100` },
      { label: 'Lowest', value: `${lowest}/100` },
      { label: 'Improvement', value: `${improvementPct >= 0 ? '+' : ''}${improvementPct}%` }
    ];
    fillRect(doc, 50, doc.y, pageW, 30, INDIGO_LIGHT, 6);
    const metaY = doc.y + 6;
    const metaW = pageW / 4;
    statsRow.forEach((s, i) => {
      const mx = 50 + i * metaW;
      doc.fillColor(SLATE_LIGHT).font('Helvetica').fontSize(7.5).text(s.label, mx + 6, metaY);
      doc.fillColor(INDIGO_DARK).font('Helvetica-Bold').fontSize(10).text(s.value, mx + 6, metaY + 10);
    });
    doc.y += 38;

    // Trend analysis
    ensurePageSpace(doc, 40);
    doc.y += 6;
    fillRect(doc, 50, doc.y, pageW, 28, trendColor(trend) + '18', 6);
    doc.rect(50, doc.y, pageW, 28).strokeColor(trendColor(trend)).lineWidth(1).stroke();
    doc.fillColor(trendColor(trend)).font('Helvetica-Bold').fontSize(10)
      .text(`Performance Trend: ${trend}  (${improvementPct >= 0 ? '+' : ''}${improvementPct}% change from first to last internal)`, 64, doc.y + 9);
    doc.y += 36;

    // ── WEAK TOPICS ──────────────────────────────────────────────────────────
    sectionHeader(doc, 'WEAK TOPICS — Needs Immediate Attention', '⚠️');
    if (weakTopics.length === 0) {
      doc.fillColor(SUCCESS).font('Helvetica-Bold').fontSize(10).text('✔ No weak topics! All topics are at 60%+', 50, doc.y);
      doc.y += 18;
    } else {
      weakTopics.forEach(t => bulletRow(doc, t.name, DANGER, t.score));
    }

    // ── STRONG TOPICS ────────────────────────────────────────────────────────
    doc.y += 6;
    sectionHeader(doc, 'STRONG TOPICS — Well Mastered', '🏆');
    if (strongTopics.length === 0) {
      doc.fillColor(SLATE_LIGHT).font('Helvetica').fontSize(9).text('No topics at 80%+ yet. Keep practicing!', 50, doc.y);
      doc.y += 14;
    } else {
      strongTopics.forEach(t => bulletRow(doc, t.name, SUCCESS, t.score));
    }

    // ── AVERAGE TOPICS ───────────────────────────────────────────────────────
    if (averageTopics.length > 0) {
      doc.y += 6;
      sectionHeader(doc, 'AVERAGE TOPICS — Some Improvement Needed', '📋');
      averageTopics.forEach(t => bulletRow(doc, t.name, WARNING, t.score));
    }

    // ── PAGE: COURSE OUTCOMES ────────────────────────────────────────────────
    doc.addPage();
    sectionHeader(doc, 'COURSE OUTCOMES (CO) ATTAINMENT', '🎯');

    if (courseOutcomes.length > 0) {
      // CO table header
      const coTableY = doc.y;
      fillRect(doc, 50, coTableY, pageW, 22, INDIGO_LIGHT, 4);
      doc.fillColor(INDIGO_DARK).font('Helvetica-Bold').fontSize(9)
        .text('Course Outcome', 56, coTableY + 6, { width: pageW * 0.5, lineBreak: false });
      doc.fillColor(INDIGO_DARK).font('Helvetica-Bold').fontSize(9)
        .text('Attainment %', 56 + pageW * 0.5, coTableY + 6, { width: pageW * 0.3, lineBreak: false });
      doc.fillColor(INDIGO_DARK).font('Helvetica-Bold').fontSize(9)
        .text('Status', 56 + pageW * 0.8, coTableY + 6, { width: pageW * 0.2, lineBreak: false });
      doc.y = coTableY + 22;

      courseOutcomes.forEach((co, idx) => {
        const rowY = doc.y;
        const bg = idx % 2 === 0 ? WHITE : '#f1f5f9';
        fillRect(doc, 50, rowY, pageW, 22, bg, 0);

        const coStatus = co.attainment >= 75 ? 'High' : co.attainment >= 55 ? 'Medium' : 'Low';
        const coColor = co.attainment >= 75 ? SUCCESS : co.attainment >= 55 ? WARNING : DANGER;

        // Attainment bar
        const barX = 56 + pageW * 0.5;
        const barW = (pageW * 0.25) * (co.attainment / 100);
        fillRect(doc, barX + 30, rowY + 7, barW, 8, coColor + '55', 3);

        doc.fillColor(SLATE_DARK).font('Helvetica').fontSize(9)
          .text(co.outcome, 56, rowY + 6, { width: pageW * 0.5, lineBreak: false });
        doc.fillColor(SLATE_DARK).font('Helvetica-Bold').fontSize(9)
          .text(`${co.attainment}%`, 56 + pageW * 0.5, rowY + 6, { width: 25, lineBreak: false });
        doc.fillColor(coColor).font('Helvetica-Bold').fontSize(9)
          .text(coStatus, 56 + pageW * 0.8, rowY + 6, { width: pageW * 0.2, lineBreak: false });

        doc.y = rowY + 22;
      });

      doc.y += 8;
      fillRect(doc, 50, doc.y, pageW, 24, INDIGO_LIGHT, 6);
      doc.fillColor(INDIGO_DARK).font('Helvetica-Bold').fontSize(9)
        .text(`Highest CO: ${highestCO}   |   Lowest CO: ${lowestCO}`, 60, doc.y + 7);
      doc.y += 32;
    }

    // ── EXAM SCHEDULE ────────────────────────────────────────────────────────
    sectionHeader(doc, 'EXAM SCHEDULE & COUNTDOWN', '📅');

    if (upcomingExam) {
      const examY = doc.y;
      fillRect(doc, 50, examY, pageW, 70, BG_LIGHT, 8);
      doc.rect(50, examY, pageW, 70).strokeColor(readinessColor(examReadiness)).lineWidth(1.5).stroke();

      doc.fillColor(readinessColor(examReadiness)).font('Helvetica-Bold').fontSize(11)
        .text(`${upcomingExam.exam_name}`, 68, examY + 10);
      doc.fillColor(SLATE_MED).font('Helvetica').fontSize(9)
        .text(`📆 Date: ${upcomingExam.exam_date}`, 68, examY + 26);
      doc.fillColor(SLATE_MED).font('Helvetica').fontSize(9)
        .text(`⏰ Time: ${upcomingExam.start_time} – ${upcomingExam.end_time}`, 68, examY + 39);
      doc.fillColor(SLATE_MED).font('Helvetica').fontSize(9)
        .text(`🏫 Venue: ${upcomingExam.room}`, 68, examY + 52);

      // Readiness badge
      fillRect(doc, doc.page.width - 150, examY + 20, 90, 24, readinessColor(examReadiness), 12);
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
        .text(examReadiness, doc.page.width - 145, examY + 27, { width: 80, align: 'center' });

      doc.y = examY + 80;
    } else {
      doc.fillColor(SLATE_LIGHT).font('Helvetica').fontSize(9)
        .text('No upcoming exam scheduled.', 50, doc.y);
      doc.y += 18;
    }

    // ── DAILY STUDY TIMETABLE ─────────────────────────────────────────────────
    doc.addPage();
    sectionHeader(doc, '7-DAY STUDY TIMETABLE', '📅');

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const timetableItems = planSections.dailyTimetable || [];

    // Header row
    const ttY = doc.y;
    fillRect(doc, 50, ttY, pageW, 22, INDIGO, 4);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
      .text('Day', 56, ttY + 6, { width: pageW * 0.2, lineBreak: false });
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
      .text('Morning (2 hrs)', 56 + pageW * 0.2, ttY + 6, { width: pageW * 0.27, lineBreak: false });
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
      .text('Afternoon (2 hrs)', 56 + pageW * 0.47, ttY + 6, { width: pageW * 0.27, lineBreak: false });
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
      .text('Evening (1 hr)', 56 + pageW * 0.74, ttY + 6, { width: pageW * 0.26, lineBreak: false });
    doc.y = ttY + 22;

    days.forEach((day, idx) => {
      const entry = timetableItems[idx] || {};
      const rowY = doc.y;
      ensurePageSpace(doc, 30);
      const bg = idx % 2 === 0 ? WHITE : '#f8fafc';
      fillRect(doc, 50, rowY, pageW, 28, bg, 0);

      doc.fillColor(INDIGO_DARK).font('Helvetica-Bold').fontSize(8.5)
        .text(day, 56, rowY + 9, { width: pageW * 0.2, lineBreak: false });
      doc.fillColor(SLATE_DARK).font('Helvetica').fontSize(8.5)
        .text(entry.morning || '—', 56 + pageW * 0.2, rowY + 9, { width: pageW * 0.27, lineBreak: false });
      doc.fillColor(SLATE_DARK).font('Helvetica').fontSize(8.5)
        .text(entry.afternoon || '—', 56 + pageW * 0.47, rowY + 9, { width: pageW * 0.27, lineBreak: false });
      doc.fillColor(SLATE_DARK).font('Helvetica').fontSize(8.5)
        .text(entry.evening || '—', 56 + pageW * 0.74, rowY + 9, { width: pageW * 0.26, lineBreak: false });
      doc.y = rowY + 28;
    });

    // ── WEEKLY STUDY PLAN ─────────────────────────────────────────────────────
    doc.y += 10;
    sectionHeader(doc, '2-WEEK STUDY PLAN', '📆');

    const weeklyPlan = planSections.weeklyPlan || [];
    weeklyPlan.forEach((week, wi) => {
      ensurePageSpace(doc, 80);
      doc.y += 4;
      fillRect(doc, 50, doc.y, pageW, 22, INDIGO_DARK, 4);
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(10)
        .text(week.week || `Week ${wi + 1}`, 60, doc.y + 6);
      doc.y += 26;

      (week.tasks || []).forEach((task, ti) => {
        ensurePageSpace(doc, 20);
        const bg = ti % 2 === 0 ? WHITE : '#f8fafc';
        const rowY = doc.y;
        fillRect(doc, 50, rowY, pageW, 20, bg, 0);
        doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(8.5)
          .text(`Day ${ti + 1}:`, 58, rowY + 5, { width: 40, lineBreak: false });
        doc.fillColor(SLATE_DARK).font('Helvetica').fontSize(8.5)
          .text(task, 100, rowY + 5, { width: pageW - 55, lineBreak: false });
        doc.y = rowY + 20;
      });
    });

    // ── RESOURCES & REVISION ─────────────────────────────────────────────────
    doc.addPage();
    sectionHeader(doc, 'RECOMMENDED RESOURCES', '📚');
    (planSections.resources || []).forEach(r => bulletRow(doc, r, INDIGO));

    doc.y += 6;
    sectionHeader(doc, 'REVISION STRATEGY', '🔄');
    (planSections.revisionStrategy || []).forEach((step, i) => {
      ensurePageSpace(doc, 22);
      const y = doc.y;
      fillRect(doc, 58, y + 1, 18, 18, INDIGO, 9);
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8.5)
        .text(`${i + 1}`, 58, y + 5, { width: 18, align: 'center', lineBreak: false });
      doc.fillColor(SLATE_DARK).font('Helvetica').fontSize(9.5)
        .text(step, 84, y + 3, { width: pageW - 44 });
      doc.y = Math.max(doc.y, y + 22);
    });

    // ── AI TIPS ───────────────────────────────────────────────────────────────
    doc.y += 6;
    sectionHeader(doc, 'AI-GENERATED STUDY TIPS', '💡');
    fillRect(doc, 50, doc.y, pageW, 6, INDIGO_LIGHT, 0);
    doc.y += 8;
    (planSections.aiTips || []).forEach((tip, i) => {
      ensurePageSpace(doc, 22);
      const tipY = doc.y;
      doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(10).text('→', 56, tipY + 1, { lineBreak: false });
      doc.fillColor(SLATE_DARK).font('Helvetica').fontSize(9.5)
        .text(tip, 72, tipY + 1, { width: pageW - 30 });
      doc.y = Math.max(doc.y, tipY + 16);
    });

    // ── PROGRESS CHECKLIST ───────────────────────────────────────────────────
    doc.y += 6;
    sectionHeader(doc, 'PROGRESS CHECKLIST', '✅');
    (planSections.checklist || []).forEach(item => checkboxRow(doc, item));

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 45;
    drawHRule(doc, { y: footerY, color: INDIGO + '44', lineWidth: 0.7 });
    doc
      .fillColor(SLATE_LIGHT)
      .font('Helvetica')
      .fontSize(7.5)
      .text(
        `Generated by EduAgent AI  •  ${new Date(generatedAt).toLocaleString('en-IN')}  •  Student: ${student.name} (${student.student_id})  •  Course: ${courseName}`,
        50,
        footerY + 8,
        { align: 'center', width: pageW }
      );

    doc.end();

    stream.on('finish', () => resolve({ filePath, fileId }));
    stream.on('error', reject);
  });
}

module.exports = { generateStudyPlanPDF, OUTPUT_DIR };
