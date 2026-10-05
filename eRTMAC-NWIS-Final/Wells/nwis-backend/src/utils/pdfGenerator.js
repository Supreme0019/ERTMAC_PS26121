// =============================================================================
// NWIS Backend — Standalone PDF Report Generator
// =============================================================================
// Generates valid, self-contained PDF 1.4 documents for demo/drilling records
// without requiring external heavy binary dependencies.
// =============================================================================

/**
 * Escape text for PDF literal strings (...).
 */
function escapePdfText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generate a complete, valid PDF 1.4 Buffer for a drilling report or well document.
 * @param {Object} options
 * @param {string} options.title - Document title / original filename
 * @param {string} options.wellName - Well identifier (e.g. SYN-015, OIL-LAKWA-04)
 * @param {string} options.documentType - Document category
 * @param {string} [options.date] - Document date
 * @param {string} [options.checksum] - Security checksum
 * @returns {Buffer}
 */
function generateDrillingReportPdf(options = {}) {
  const title = options.title || 'Official Drilling Log & Report';
  const wellName = options.wellName || 'OIL-ASSAM-HORIZON-01';
  const docType = (options.documentType || 'Daily Drilling Report').replace(/_/g, ' ').toUpperCase();
  const dateStr = options.date ? new Date(options.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '04 Oct 2026';
  const checksum = options.checksum || 'sha256-verified-archive';

  // Construct PDF stream content with professional layout
  const streamLines = [
    'q',
    // Top banner header box (Dark brown #5C4033)
    '0.36 0.25 0.20 rg',
    '40 760 515 50 re f',
    'Q',

    // Header text
    'BT',
    '/F1 15 Tf',
    '1 1 1 rg', // White
    '55 788 Td',
    '(' + escapePdfText('OIL INDIA LIMITED  ·  eRTMAC-NWIS ARCHIVE') + ') Tj',
    'ET',

    'BT',
    '/F1 9 Tf',
    '1 1 1 rg',
    '55 770 Td',
    '(' + escapePdfText('ASSAM-ARAKAN BASIN DRILLING OPERATIONS & TECHNICAL LOGS') + ') Tj',
    'ET',

    // Document Title & Well Tag
    'BT',
    '/F1 14 Tf',
    '0.1 0.1 0.1 rg',
    '40 725 Td',
    '(' + escapePdfText(title) + ') Tj',
    'ET',

    // Divider line
    'q',
    '0.77 0.72 0.65 RG',
    '1 w',
    '40 710 m 555 710 l S',
    'Q',

    // Metadata block
    'BT',
    '/F1 10 Tf',
    '0.2 0.2 0.2 rg',
    '45 688 Td',
    '(' + escapePdfText('Well Reference: ' + wellName) + ') Tj',
    '180 0 Td',
    '(' + escapePdfText('Category: ' + docType) + ') Tj',
    '170 0 Td',
    '(' + escapePdfText('Date Logged: ' + dateStr) + ') Tj',
    'ET',

    'BT',
    '/F1 9 Tf',
    '0.4 0.4 0.4 rg',
    '45 668 Td',
    '(' + escapePdfText('Asset Field: Lakwa-Digboi Super-Block  |  Licence Block: AA-ONHP-2022/1') + ') Tj',
    'ET',

    // Section 1: Operational Summary
    'q',
    '0.96 0.95 0.93 rg',
    '40 600 515 50 re f',
    '0.85 0.80 0.75 RG',
    '1 w',
    '40 600 515 50 re S',
    'Q',

    'BT',
    '/F1 11 Tf',
    '0.36 0.25 0.20 rg',
    '55 632 Td',
    '(' + escapePdfText('1. OPERATIONAL & DRILLING SUMMARY') + ') Tj',
    'ET',

    'BT',
    '/F1 9 Tf',
    '0.2 0.2 0.2 rg',
    '55 612 Td',
    '(' + escapePdfText('Status: 24-hr drilling continuous. Bit 8-1/2" PDC run @ 2,840 m MD. Formation Barail Sand.') + ') Tj',
    'ET',

    // Section 2: Real-time Telemetry & Mud Logging Data
    'BT',
    '/F1 11 Tf',
    '0.36 0.25 0.20 rg',
    '40 575 Td',
    '(' + escapePdfText('2. TELEMETRY OBSERVATIONS & MUD PROPERTIES') + ') Tj',
    'ET',

    // Table Header
    'q',
    '0.92 0.89 0.85 rg',
    '40 535 515 22 re f',
    'Q',

    'BT',
    '/F1 9 Tf',
    '0.1 0.1 0.1 rg',
    '50 542 Td',
    '(' + escapePdfText('Parameter') + ') Tj',
    '120 0 Td',
    '(' + escapePdfText('Target / Range') + ') Tj',
    '140 0 Td',
    '(' + escapePdfText('Observed Value') + ') Tj',
    '130 0 Td',
    '(' + escapePdfText('Operational Status') + ') Tj',
    'ET',

    // Table Rows
    'BT',
    '/F1 9 Tf',
    '0.2 0.2 0.2 rg',
    '50 518 Td',
    '(' + escapePdfText('Measured Depth (MD)') + ') Tj',
    '120 0 Td',
    '(' + escapePdfText('0 - 3,500 m') + ') Tj',
    '140 0 Td',
    '(' + escapePdfText('2,842.5 m') + ') Tj',
    '130 0 Td',
    '(' + escapePdfText('On Trajectory') + ') Tj',

    '0 -18 Td',
    '(' + escapePdfText('Rate of Penetration (ROP)') + ') Tj',
    '120 0 Td',
    '(' + escapePdfText('8 - 18 m/hr') + ') Tj',
    '140 0 Td',
    '(' + escapePdfText('14.8 m/hr') + ') Tj',
    '130 0 Td',
    '(' + escapePdfText('Normal') + ') Tj',

    '0 -18 Td',
    '(' + escapePdfText('Weight on Bit (WOB)') + ') Tj',
    '120 0 Td',
    '(' + escapePdfText('15 - 25 klbs') + ') Tj',
    '140 0 Td',
    '(' + escapePdfText('21.4 klbs') + ') Tj',
    '130 0 Td',
    '(' + escapePdfText('Optimal') + ') Tj',

    '0 -18 Td',
    '(' + escapePdfText('Rotary Speed (RPM)') + ') Tj',
    '120 0 Td',
    '(' + escapePdfText('90 - 140 RPM') + ') Tj',
    '140 0 Td',
    '(' + escapePdfText('118 RPM') + ') Tj',
    '130 0 Td',
    '(' + escapePdfText('Controlled') + ') Tj',

    '0 -18 Td',
    '(' + escapePdfText('Standpipe Pressure (SPP)') + ') Tj',
    '120 0 Td',
    '(' + escapePdfText('2,200 - 2,800 psi') + ') Tj',
    '140 0 Td',
    '(' + escapePdfText('2,485 psi') + ') Tj',
    '130 0 Td',
    '(' + escapePdfText('Stable') + ') Tj',

    '0 -18 Td',
    '(' + escapePdfText('Mud Weight (In / Out)') + ') Tj',
    '120 0 Td',
    '(' + escapePdfText('10.2 - 10.6 ppg') + ') Tj',
    '140 0 Td',
    '(' + escapePdfText('10.45 / 10.42 ppg') + ') Tj',
    '130 0 Td',
    '(' + escapePdfText('No Gas Cut') + ') Tj',

    '0 -18 Td',
    '(' + escapePdfText('Flow Rate') + ') Tj',
    '120 0 Td',
    '(' + escapePdfText('500 - 650 gpm') + ') Tj',
    '140 0 Td',
    '(' + escapePdfText('585 gpm') + ') Tj',
    '130 0 Td',
    '(' + escapePdfText('Steady Returns') + ') Tj',
    'ET',

    // Section 3: Geological Formations & Subsurface Correlation
    'BT',
    '/F1 11 Tf',
    '0.36 0.25 0.20 rg',
    '40 370 Td',
    '(' + escapePdfText('3. GEOLOGICAL FORMATIONS & SUBSURFACE LITHOLOGY') + ') Tj',
    'ET',

    'BT',
    '/F1 9 Tf',
    '0.2 0.2 0.2 rg',
    '45 350 Td',
    '(' + escapePdfText('• Upper Tipam Sandstone (1,420 m - 2,110 m): Medium grained sandstone, good porosity (22%).') + ') Tj',
    '0 -16 Td',
    '(' + escapePdfText('• Girujan Clay Formation (2,110 m - 2,650 m): Mottled plastic claystone, high integrity seal.') + ') Tj',
    '0 -16 Td',
    '(' + escapePdfText('• Barail Main Sand (2,650 m - 3,180 m): Oligocene primary hydrocarbon reservoir horizon.') + ') Tj',
    '0 -16 Td',
    '(' + escapePdfText('• Kopili Shale Transition (3,180 m+): Hard calcareous splintery shale with minor interbeds.') + ') Tj',
    'ET',

    // Section 4: Engineering Remarks & Mitigations
    'q',
    '0.99 0.97 0.94 rg',
    '40 210 515 55 re f',
    '0.88 0.82 0.74 RG',
    '1 w',
    '40 210 515 55 re S',
    'Q',

    'BT',
    '/F1 10 Tf',
    '0.36 0.25 0.20 rg',
    '50 248 Td',
    '(' + escapePdfText('4. SUPERINTENDENT REMARKS & OFFSET CORRELATION') + ') Tj',
    'ET',

    'BT',
    '/F1 8.5 Tf',
    '0.2 0.2 0.2 rg',
    '50 230 Td',
    '(' + escapePdfText('Offset well correlation with SYN-009 & SYN-013 confirms continuous sand pack. ECD maintained at') + ') Tj',
    '0 -13 Td',
    '(' + escapePdfText('10.8 ppg to suppress micro-fracture loss. No stuck pipe tendency observed. Gas chromatography < 0.8%.') + ') Tj',
    'ET',

    // Footer Stamp & DGH Compliance
    'q',
    '0.77 0.72 0.65 RG',
    '1 w',
    '40 120 m 555 120 l S',
    'Q',

    'BT',
    '/F1 8 Tf',
    '0.4 0.4 0.4 rg',
    '40 102 Td',
    '(' + escapePdfText('DIRECTORATE GENERAL OF HYDROCARBONS (DGH) STANDARD DRILLING ARCHIVE') + ') Tj',
    '0 -14 Td',
    '(' + escapePdfText('Certified Record: OIL-eRTMAC System  ·  Field Operations Center, Duliajan, Assam') + ') Tj',
    '0 -14 Td',
    '(' + escapePdfText('Checksum: ' + checksum.slice(0, 32)) + ') Tj',
    'ET',

    // Page Number
    'BT',
    '/F1 8 Tf',
    '0.4 0.4 0.4 rg',
    '500 74 Td',
    '(' + escapePdfText('Page 1 of 1') + ') Tj',
    'ET'
  ];

  const streamContent = streamLines.join('\n');
  const streamBytes = Buffer.from(streamContent, 'utf-8');
  const streamLen = streamBytes.length;

  let body = '%PDF-1.4\n';
  const offsets = [];

  function addObj(str) {
    offsets.push(Buffer.byteLength(body, 'utf-8'));
    body += str + '\n';
  }

  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  addObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj');
  addObj('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  addObj('5 0 obj\n<< /Length ' + streamLen + ' >>\nstream\n' + streamContent + '\nendstream\nendobj');

  const xrefOffset = Buffer.byteLength(body, 'utf-8');
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 0; i < offsets.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(body + xref + trailer, 'utf-8');
}

module.exports = {
  generateDrillingReportPdf,
};
