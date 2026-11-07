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
const HEADERS = ['รับเมื่อ', 'รหัส', 'ชื่อ', 'เบอร์โทร', 'วันที่จอง', 'เวลา', 'จำนวนคน', 'หมายเหตุ', 'สถานะ', 'โต๊ะ'];
const STATUSES = ['รอยืนยัน', 'ยืนยันแล้ว', 'ยกเลิก'];
const TZ = 'Asia/Bangkok';

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
  sheet.getRange('J:J').setNumberFormat('@');
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
  sheet.setColumnWidth(10, 70);

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
      String(payload.table || '').toUpperCase().slice(0, 8),
    ]);

    return json_({ ok: true, code: code, row: sheet.getLastRow() });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * GET มีสองแบบ
 *  - ไม่ส่ง action (หรือ action=status) → ตรวจว่าติดตั้งสำเร็จ ไม่คืนข้อมูลลูกค้า
 *  - action=list&date=YYYY-MM-DD → รายการจองของวันนั้น สำหรับหน้า today.html ของพนักงาน
 *    บังคับต้องมี SHARED_TOKEN เสมอ เพราะคืนชื่อ/เบอร์ลูกค้า
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const expected = PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN');
    const sent = String(params.token || '');
    const action = String(params.action || 'status');

    if (action === 'list') {
      if (!expected) return json_({ ok: false, error: 'ยังไม่ได้ตั้ง SHARED_TOKEN — ต้องตั้งก่อนใช้หน้ารายการจอง' });
      if (sent !== String(expected)) return json_({ ok: false, error: 'unauthorized' });
      return list_(params.date);
    }

    /* ฝั่งลูกค้าใช้ตารางว่าง/ไม่ว่างบนผัง — คืนแค่เลขโต๊ะกับเวลา ไม่มีข้อมูลส่วนตัว จึงไม่ต้องใช้ token */
    if (action === 'busy') return busy_(params.date);

    if (expected && sent !== String(expected)) return json_({ ok: false, error: 'unauthorized' });
    const sheet = sheet_();
    const rows = Math.max(0, sheet.getLastRow() - 1);
    return json_({ ok: true, service: 'sod-reserve', bookings: rows, tab: TAB_NAME });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** อ่านแถวของวันที่กำหนด (ไม่ส่ง date = วันนี้ตามเวลาไทย) แล้วคืนเป็น JSON เรียงตามเวลา */
function list_(rawDate) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate || '')) ? String(rawDate) : today_();
  const sheet = sheet_();
  const last = sheet.getLastRow();
  const rows = [];

  if (last > 1) {
    const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
    values.forEach(function (row) {
      if (dateOf_(row[4]) !== date) return;
      rows.push({
        code: String(row[1]),
        name: String(row[2]),
        phone: String(row[3]),
        date: date,
        time: String(row[5]).slice(0, 5),
        party: Number(row[6]) || 0,
        note: String(row[7] || ''),
        status: String(row[8] || STATUSES[0]),
        table: String(row[9] || '').toUpperCase(),
        created_at:
          row[0] instanceof Date
            ? Utilities.formatDate(row[0], TZ, 'yyyy-MM-dd HH:mm')
            : String(row[0] || ''),
      });
    });
  }

  rows.sort(function (a, b) {
    return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
  });
  const people = rows.reduce(function (sum, r) {
    return sum + (r.party || 0);
  }, 0);

  return json_({ ok: true, service: 'sod-reserve', date: date, count: rows.length, people: people, rows: rows });
}

/** โต๊ะที่ถูกจองแล้วของวันนั้น — ใช้ระบายสีผังฝั่งลูกค้า (ไม่คืนชื่อ/เบอร์) */
function busy_(rawDate) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate || '')) ? String(rawDate) : today_();
  const sheet = sheet_();
  const last = sheet.getLastRow();
  const busy = [];

  if (last > 1) {
    const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
    values.forEach(function (row) {
      const table = String(row[9] || '').trim().toUpperCase();
      if (!table) return;
      if (String(row[8] || '') === 'ยกเลิก') return;
      if (dateOf_(row[4]) !== date) return;
      busy.push({ table: table, time: String(row[5]).slice(0, 5) });
    });
  }

  return json_({ ok: true, service: 'sod-reserve', date: date, busy: busy });
}

function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

/** วันที่จองอาจมาเป็น Date (ถ้าคอลัมน์ถูกตั้งรูปแบบอื่น) หรือข้อความ dd/MM/yyyy */
function dateOf_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
  }
  const text = String(value == null ? '' : value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  }
  return '';
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
  if (p.table && !/^[A-Z]{0,3}\d{1,2}$/i.test(String(p.table).trim())) return 'invalid table';
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
