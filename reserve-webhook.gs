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
const LOCK_TAB = 'TableLocks';
const LOCK_HEADERS = ['วันที่', 'โต๊ะ', 'หมายเหตุ', 'บันทึกเมื่อ'];
const TZ = 'Asia/Bangkok';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

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

  /* โต๊ะที่ร้านปิดเอง (ไม่รับจอง) แยกแท็บไว้ ไม่ปนกับรายการจอง */
  let locks = ss.getSheetByName(LOCK_TAB);
  if (!locks) locks = ss.insertSheet(LOCK_TAB);
  locks.getRange(1, 1, 1, LOCK_HEADERS.length).setValues([LOCK_HEADERS]).setFontWeight('bold');
  locks.setFrozenRows(1);
  locks.getRange('A:A').setNumberFormat('@');
  locks.getRange('B:B').setNumberFormat('@');
  locks.setColumnWidth(1, 95);
  locks.setColumnWidth(2, 110);
  locks.setColumnWidth(3, 200);
  locks.setColumnWidth(4, 140);

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

/* แท็บล็อคโต๊ะ — create = false ใช้ตอนฝั่งลูกค้าถามสถานะ (ไม่สร้างแท็บใหม่) */
function lockSheet_(create) {
  const ss = spreadsheet_();
  const existing = ss.getSheetByName(LOCK_TAB);
  if (existing || !create) return existing || null;
  setup();
  return ss.getSheetByName(LOCK_TAB);
}

function dayStr_(rawDate) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate || '')) ? String(rawDate) : today_();
}

/** โต๊ะที่ถูกล็อคของวันนั้น */
function locks_(rawDate, create) {
  const date = dayStr_(rawDate);
  const sheet = lockSheet_(create !== false);
  const list = [];
  if (!sheet) return list;
  const last = sheet.getLastRow();
  if (last > 1) {
    const values = sheet.getRange(2, 1, last - 1, LOCK_HEADERS.length).getValues();
    values.forEach(function (row) {
      if (dateOf_(row[0]) !== date) return;
      const table = String(row[1] || '').trim().toUpperCase();
      if (!table) return;
      list.push({
        table: table,
        note: String(row[2] || ''),
        at:
          row[3] instanceof Date
            ? Utilities.formatDate(row[3], TZ, 'yyyy-MM-dd HH:mm')
            : String(row[3] || ''),
      });
    });
  }
  return list;
}

/** เพิ่มแถวล็อค — คืน false ถ้ามีอยู่แล้ว (ล็อคซ้ำไม่สร้างแถวใหม่) */
function setLock_(date, table, note) {
  const existing = locks_(date, true);
  for (let i = 0; i < existing.length; i += 1) {
    if (existing[i].table === table) return false;
  }
  const sheet = lockSheet_(true);
  sheet.appendRow([date, table, String(note || '').slice(0, 120), new Date()]);
  return true;
}

/** ลบแถวล็อคของโต๊ะนั้น — คืน false ถ้าไม่พบ */
function removeLock_(date, table) {
  const sheet = lockSheet_(true);
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const values = sheet.getRange(2, 1, last - 1, LOCK_HEADERS.length).getValues();
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (dateOf_(values[i][0]) !== date) continue;
    if (String(values[i][1] || '').trim().toUpperCase() !== table) continue;
    sheet.deleteRow(i + 2);
    return true;
  }
  return false;
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    const expected = PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN');

    /* LINE webhook (ใช้ครั้งเดียวตอนตั้งค่า) — ส่ง event มาก็จริง แต่ไม่มี token ในตัว
       จึงใช้ ?token=SHARED_TOKEN ที่ต่อท้าย Webhook URL แทน */
    if (raw.indexOf('"events"') !== -1) {
      const hookToken = String((e && e.parameter && e.parameter.token) || '');
      if (expected && hookToken !== String(expected)) return json_({ ok: false, error: 'unauthorized' });
      return captureLineTarget_(raw);
    }

    const payload = parsePayload_(e);
    if (!payload) return json_({ ok: false, error: 'empty body' });

    if (expected) {
      const sent = (e && e.parameter && e.parameter.token) || payload.token || '';
      if (String(sent) !== String(expected)) return json_({ ok: false, error: 'unauthorized' });
    }

    /* ล็อค/ปลดล็อคโต๊ะจากหน้า today.html — ต้องผ่าน token ด้านบนแล้วเท่านั้น */
    const act = String(payload.action || '');
    if (act === 'lock' || act === 'unlock') {
      const date = dayStr_(payload.date);
      const raw = Array.isArray(payload.tables)
        ? payload.tables
        : String(payload.table || '').split(',');
      const tables = raw
        .map(function (t) {
          return String(t == null ? '' : t).trim().toUpperCase();
        })
        .filter(Boolean);
      if (!tables.length) return json_({ ok: false, error: 'missing table' });

      const changed = [];
      for (let i = 0; i < tables.length; i += 1) {
        const table = tables[i];
        if (table.length > 40) return json_({ ok: false, error: 'invalid table' });
        if (!/^[A-Z]{0,3}\d{1,2}(?:\s*[+,/]\s*[A-Z]{0,3}\d{1,2})*$/i.test(table)) {
          return json_({ ok: false, error: 'invalid table' });
        }
        const done = act === 'lock' ? setLock_(date, table, payload.note) : removeLock_(date, table);
        if (done) changed.push(table);
      }
      return json_({ ok: true, service: 'sod-reserve', action: act, date: date, changed: changed, locks: locks_(date) });
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
      String(payload.table || '').toUpperCase().slice(0, 40),
    ]);

    /* แจ้งเข้ากลุ่ม LINE ของร้าน — ถ้าล้มเหลวก็ไม่ทำให้การจองหาย */
    notifyLine_(payload);

    return json_({ ok: true, code: code, row: sheet.getLastRow() });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * GET มีสามแบบ
 *  - ไม่ส่ง action (หรือ action=status) → ตรวจว่าติดตั้งสำเร็จ ไม่คืนข้อมูลลูกค้า
 *  - action=list&date=YYYY-MM-DD → รายการจองของวันนั้น สำหรับหน้า today.html ของพนักงาน
 *    บังคับต้องมี SHARED_TOKEN เสมอ เพราะคืนชื่อ/เบอร์ลูกค้า
 *  - action=locks&date=YYYY-MM-DD → โต๊ะที่ร้านล็อคไว้ (ต้องมี SHARED_TOKEN)
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

    if (action === 'locks') {
      if (!expected) return json_({ ok: false, error: 'ยังไม่ได้ตั้ง SHARED_TOKEN — ต้องตั้งก่อนใช้ระบบล็อคโต๊ะ' });
      if (sent !== String(expected)) return json_({ ok: false, error: 'unauthorized' });
      return json_({ ok: true, service: 'sod-reserve', date: dayStr_(params.date), locks: locks_(params.date) });
    }

    /* ฝั่งลูกค้าใช้ตารางว่าง/ไม่ว่างบนผัง — คืนแค่เลขโต๊ะกับเวลา (และโต๊ะที่ถูกล็อค) ไม่มีข้อมูลส่วนตัว จึงไม่ต้องใช้ token */
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

  /* โต๊ะที่ร้านปิดเองก็ไม่ว่างสำหรับลูกค้า — ส่งไปพร้อมกันโดยไม่มีข้อมูลส่วนตัว */
  locks_(date, false).forEach(function (row) {
    busy.push({ table: row.table, time: '', locked: true });
  });

  return json_({ ok: true, service: 'sod-reserve', date: date, busy: busy });
}

function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

/* ── แจ้งเตือนจองใหม่เข้า LINE กลุ่มร้าน (Messaging API) ─────────
   ต้องตั้ง Script Properties: LINE_CHANNEL_TOKEN (channel access token)
   และ LINE_TO (groupId / roomId / userId) — ไม่ตั้งก็ข้ามไปเงียบ ๆ
   วิธีเอา groupId: ตั้ง Webhook URL เป็น <URL เว็บแอป>?token=<SHARED_TOKEN>
   แล้วพิมพ์อะไรสักอย่างในกลุ่ม → สคริปต์จะจด LINE_TO ให้เอง */
function lineConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    token: String(props.getProperty('LINE_CHANNEL_TOKEN') || '').trim(),
    to: String(props.getProperty('LINE_TO') || '').trim(),
  };
}

function lineMessage_(p) {
  const parts = String(p.date || '').split('-');
  const when =
    parts.length === 3 ? Number(parts[2]) + ' ' + (THAI_MONTHS[Number(parts[1]) - 1] || '') : String(p.date || '');
  const out = [
    '🔔 จองใหม่ · SOD! signature',
    String(p.time || '') + ' น. · ' + when,
    String(p.name || '—') + ' · ' + (Number(p.party) || 1) + ' คน' +
      (p.table ? ' · โต๊ะ ' + String(p.table).toUpperCase() : ''),
    String(p.phone || ''),
  ];
  if (p.note) out.push('หมายเหตุ: ' + String(p.note).slice(0, 80));
  out.push('รหัส ' + String(p.code || ''));
  return out.filter(Boolean).join('\n');
}

/** คืน 'sent' | 'failed' | 'skipped' */
function notifyLine_(p) {
  const conf = lineConfig_();
  if (!conf.token || !conf.to) return 'skipped';
  try {
    const res = UrlFetchApp.fetch(LINE_PUSH_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + conf.token },
      payload: JSON.stringify({ to: conf.to, messages: [{ type: 'text', text: lineMessage_(p) }] }),
      muteHttpExceptions: true,
    });
    const status = res.getResponseCode();
    if (status >= 300) {
      console.error('LINE push failed: ' + status + ' ' + res.getContentText());
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('LINE push error: ' + err);
    return 'failed';
  }
}

/** รันจาก editor เพื่อทดสอบว่าตั้งค่า LINE ถูก (ดูผลใน Execution log) */
function testLine() {
  Logger.log(
    'ผลการส่ง: %s',
    notifyLine_({
      code: 'SOD-TEST',
      name: 'ทดสอบระบบ',
      phone: '0800000000',
      date: today_(),
      time: Utilities.formatDate(new Date(), TZ, 'HH:mm'),
      party: 2,
      table: '24',
      note: 'ข้อความทดสอบจาก Apps Script',
    })
  );
}

/** จด groupId/roomId/userId จาก event ของ LINE ลง Script Property LINE_TO */
function captureLineTarget_(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch (_) {
    return json_({ ok: true, service: 'sod-reserve' });
  }
  const events = Array.isArray(body.events) ? body.events : [];
  for (let i = 0; i < events.length; i += 1) {
    const source = (events[i] && events[i].source) || {};
    const id = source.groupId || source.roomId || source.userId || '';
    if (!id) continue;
    PropertiesService.getScriptProperties().setProperty('LINE_TO', id);
    console.log('บันทึก LINE_TO แล้ว: ' + id);
    break;
  }
  return json_({ ok: true, service: 'sod-reserve', line: 'captured' });
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
  /* one table (24, A10, VIP2), a pushed-together pair (A1 + A2) or several (9, 24) */
  const table = String(p.table || '').trim();
  if (table.length > 40) return 'invalid table';
  if (table && !/^[A-Z]{0,3}\d{1,2}(?:\s*[+,/]\s*[A-Z]{0,3}\d{1,2})*$/i.test(table)) return 'invalid table';
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
