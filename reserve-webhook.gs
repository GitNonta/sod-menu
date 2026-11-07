/**
 * SOD! signature — table reservation receiver (Google Apps Script)
 * ---------------------------------------------------------------
 * รับ POST จากเว็บเมนู (data/menu.json → shop.reserve.webhook)
 * แล้วต่อท้ายหนึ่งแถวต่อการจองลง Google Sheet
 *
 * วิธีติดตั้งทีละขั้น: docs/reserve-backend.md
 * สรุป: วางไฟล์นี้ใน Extensions → Apps Script ของสเปรดชีต
 *       ตั้ง Script Properties: SHEET_ID (ถ้าสคริปต์ไม่ผูกกับชีต) และ SHARED_TOKEN
 *       รัน setup() หนึ่งครั้ง → Deploy → New deployment → Web app
 *       (Execute as: Me / Who has access: Anyone)
 *       แล้วเอา URL ที่ได้ไปใส่ shop.reserve.webhook พร้อม ?token=...
 */

const TAB_NAME = 'Reservations';
const HEADERS = ['รับเมื่อ', 'รหัส', 'ชื่อ', 'เบอร์โทร', 'วันที่จอง', 'เวลา', 'จำนวนคน', 'หมายเหตุ', 'สถานะ'];
const STATUSES = ['รอยืนยัน', 'ยืนยันแล้ว', 'ยกเลิก'];

/** รันครั้งเดียวหลังวางโค้ด: สร้างแท็บ + หัวตาราง + รูปแบบคอลัมน์ที่จำเป็น */
function setup() {
  const ss = spreadsheet_();
  let sheet = ss.getSheetByName(TAB_NAME);
  if (!sheet) sheet = ss.insertSheet(TAB_NAME);

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // เวลาที่รับเข้า / เบอร์โทร / หมายเหตุ ต้องเป็นข้อความ ไม่งั้นเลข 0 ข้างหน้าหาย
  sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.getRange('D:D').setNumberFormat('@');
  sheet.getRange('H:H').setNumberFormat('@');
  sheet.getRange('I:I').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUSES, true)
      .setAllowInvalid(true)
      .build()
  );

  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(5, 95);
  sheet.setColumnWidth(6, 65);
  sheet.setColumnWidth(7, 80);
  sheet.setColumnWidth(8, 220);
  sheet.setColumnWidth(9, 100);

  Logger.log('พร้อมใช้งานแล้ว: %s', ss.getUrl());
  return ss.getUrl();
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;
  throw new Error('ยังไม่ได้ตั้ง SHEET_ID ใน Script Properties และสคริปต์ไม่ได้ผูกกับสเปรดชีต');
}

function sheet_() {
  const ss = spreadsheet_();
  const existing = ss.getSheetByName(TAB_NAME);
  if (existing) return existing;
  setup();
  return ss.getSheetByName(TAB_NAME);
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    if (!payload) return json_({ ok: false, error: 'empty body' });

    const expected = PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN');
    if (expected) {
      const sent = (e && e.parameter && e.parameter.token) || payload.token || '';
      if (String(sent) !== String(expected)) return json_({ ok: false, error: 'unauthorized' });
    }

    const problem = validate_(payload);
    if (problem) return json_({ ok: false, error: problem });

    const sheet = sheet_();
    const code = String(payload.code).slice(0, 24);
    if (exists_(sheet, code)) return json_({ ok: true, code: code, duplicate: true });

    sheet.appendRow([
      new Date(),
      code,
      String(payload.name).slice(0, 60),
      String(payload.phone),
      String(payload.date),
      String(payload.time),
      Number(payload.party) || 1,
      String(payload.note || '').slice(0, 200),
      STATUSES[0],
    ]);

    return json_({ ok: true, code: code, row: sheet.getLastRow() });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  }
}

/** ใช้ตรวจว่าติดตั้งสำเร็จ (ไม่คืนข้อมูลลูกค้า) */
function doGet(e) {
  try {
    const expected = PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN');
    if (expected && String((e && e.parameter && e.parameter.token) || '') !== String(expected)) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    const sheet = sheet_();
    const rows = Math.max(0, sheet.getLastRow() - 1);
    return json_({ ok: true, service: 'sod-reserve', bookings: rows, tab: TAB_NAME });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function parsePayload_(e) {
  if (!e) return null;
  const raw = e.postData && e.postData.contents;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      // เผื่อมีคนยิงมาแบบฟอร์มปกติ (?name=...&phone=...)
      if (e.parameter && e.parameter.name) return e.parameter;
      return null;
    }
  }
  if (e.parameter && e.parameter.name) return e.parameter;
  return null;
}

function validate_(p) {
  const phone = String(p.phone || '').replace(/\D/g, '');
  if (!p.code) return 'missing code';
  if (!p.name || String(p.name).trim().length < 2) return 'invalid name';
  if (phone.length < 9 || phone.length > 10) return 'invalid phone';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date || ''))) return 'invalid date';
  if (!/^\d{2}:\d{2}$/.test(String(p.time || ''))) return 'invalid time';
  const party = Number(p.party);
  if (!party || party < 1 || party > 50) return 'invalid party size';
  return '';
}

function exists_(sheet, code) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const column = sheet.getRange(2, 2, last - 1, 1);
  return Boolean(column.createTextFinder(code).matchEntireCell(true).findNext());
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
