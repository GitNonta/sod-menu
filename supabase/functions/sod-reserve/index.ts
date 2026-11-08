/**
 * SOD! signature — ตัวรับจองโต๊ะ (Supabase Edge Function, Deno/TypeScript)
 * ----------------------------------------------------------------------
 * ทำหน้าที่แทน reserve-webhook.gs ทุกประการ: สัญญาเดียวกับที่หน้าเว็บเรียกอยู่
 *   POST  <fn-url>                                   จองใหม่ (body JSON จาก app.js)
 *   GET   ?action=status                             เช็กว่าติดตั้งแล้ว
 *   GET   ?action=busy&date=YYYY-MM-DD               โต๊ะไม่ว่าง (ไม่ต้อง token)
 *   GET   ?action=list&date=YYYY-MM-DD&token=…       รายการจองของวัน (ต้อง token)
 *   GET   ?action=locks&date=YYYY-MM-DD&token=…      โต๊ะที่ร้านล็อค (ต้อง token)
 *   POST  { action:'lock'|'unlock', token, date, tables:[], note }
 *   GET   ?action=linetest&token=…                   ส่งข้อความทดสอบเข้า LINE
 *   POST  body ที่มี "events" (LINE webhook)          จด groupId ลงตาราง settings
 *
 * เพราะรูปแบบคำตอบเหมือน Apps Script หน้าเว็บ (app.js / today.html)
 * จึงไม่ต้องแก้โค้ดหน้าเว็บเลย แค่เปลี่ยน shop.reserve.webhook เป็น URL ของฟังก์ชันนี้
 *
 * Secrets ที่ต้องตั้ง (Dashboard → Edge Functions → Secrets หรือ `supabase secrets set`):
 *   SOD_TOKEN            รหัสผ่านร้าน ใช้แทน SHARED_TOKEN
 *   LINE_CHANNEL_TOKEN   channel access token (ไม่ใส่ = ข้ามการแจ้งเตือน)
 *   LINE_TO              groupId/roomId/userId (ถ้าไม่ใส่ จะอ่านจากตาราง settings)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  มีให้อัตโนมัติเมื่อรันบน Supabase
 *
 * วิธีติดตั้ง: docs/supabase-backend.md
 */

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok ไม่มี DST
const STATUSES = ['รอยืนยัน', 'ยืนยันแล้ว', 'ยกเลิก'];
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const SB_URL = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SOD_TOKEN = (Deno.env.get('SOD_TOKEN') || '').trim();

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, prefer',
  'Access-Control-Max-Age': '86400',
};

type Json = Record<string, unknown>;

function json(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* ── PostgREST ──────────────────────────────────────────────── */
type SbResult = { ok: boolean; status: number; data: unknown; headers: Headers };

async function sb(path: string, init: RequestInit = {}): Promise<SbResult> {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data, headers: res.headers };
}

const enc = (value: string) => encodeURIComponent(value);

/* ── วันที่/เวลาแบบไทย ─────────────────────────────────────── */
function bkkToday(): string {
  return new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function dayStr(rawDate: unknown): string {
  const text = String(rawDate || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : bkkToday();
}

/** '2026-11-08T12:34:56Z' → '2026-11-08 19:34' */
function bkkStamp(iso: unknown): string {
  const d = new Date(String(iso || ''));
  if (Number.isNaN(d.getTime())) return String(iso || '');
  const local = new Date(d.getTime() + TZ_OFFSET_MS);
  return local.toISOString().slice(0, 16).replace('T', ' ');
}

/* ── ตรวจข้อมูล ─────────────────────────────────────────────── */
const TABLE_RE = /^[A-Z]{0,3}\d{1,2}(?:\s*[+,/]\s*[A-Z]{0,3}\d{1,2})*$/i;

function cleanTables(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw == null ? '' : raw).split(',');
  return list
    .map((t) => String(t == null ? '' : t).trim().toUpperCase())
    // A1 + A2 / 9, 24 → คีย์เดียวกับที่หน้าเว็บใช้เทียบผัง
    .filter(Boolean);
}

function validate(p: Json): string {
  const phone = String(p.phone || '').replace(/\D/g, '');
  if (!p.code) return 'missing code';
  if (!p.name || String(p.name).trim().length < 2) return 'invalid name';
  if (phone.length < 9 || phone.length > 10) return 'invalid phone';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date || ''))) return 'invalid date';
  if (!/^\d{2}:\d{2}$/.test(String(p.time || ''))) return 'invalid time';
  const party = Number(p.party);
  if (!party || party < 1 || party > 50) return 'invalid party size';
  const table = String(p.table || '').trim();
  if (table.length > 40) return 'invalid table';
  if (table && !TABLE_RE.test(table)) return 'invalid table';
  return '';
}

function authorized(sent: string): boolean {
  if (!SOD_TOKEN) return true; // ยังไม่ตั้งรหัส = เปิดโล่ง (เหมือน Apps Script)
  return sent === SOD_TOKEN;
}

/* ── อ่าน/เขียนข้อมูล ──────────────────────────────────────── */
type LockRow = { table: string; note: string; at: string };

async function locksOf(date: string): Promise<LockRow[]> {
  const res = await sb(`table_locks?date=eq.${enc(date)}&select=table_label,note,created_at&order=table_label.asc`);
  const rows = Array.isArray(res.data) ? (res.data as Json[]) : [];
  return rows.map((row) => ({
    table: String(row.table_label || '').toUpperCase(),
    note: String(row.note || ''),
    at: bkkStamp(row.created_at),
  }));
}

async function listOf(rawDate: unknown): Promise<Response> {
  const date = dayStr(rawDate);
  const res = await sb(
    `reservations?date=eq.${enc(date)}` +
      `&select=code,name,phone,date,time,party,note,status,table_label,created_at&order=time.asc`,
  );
  if (!res.ok) return json({ ok: false, error: `db ${res.status}` }, 502);
  const rows = (Array.isArray(res.data) ? (res.data as Json[]) : []).map((row) => ({
    code: String(row.code || ''),
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    date,
    time: String(row.time || '').slice(0, 5),
    party: Number(row.party) || 0,
    note: String(row.note || ''),
    status: String(row.status || STATUSES[0]),
    table: String(row.table_label || '').toUpperCase(),
    created_at: bkkStamp(row.created_at),
  }));
  const people = rows.reduce((sum, r) => sum + (r.party || 0), 0);
  return json({ ok: true, service: 'sod-reserve', date, count: rows.length, people, rows });
}

async function busyOf(rawDate: unknown): Promise<Response> {
  const date = dayStr(rawDate);
  const res = await sb(
    `reservations?date=eq.${enc(date)}&status=neq.${enc(STATUSES[2])}` +
      `&table_label=neq.&select=table_label,time&order=time.asc`,
  );
  if (!res.ok) return json({ ok: false, error: `db ${res.status}` }, 502);
  const busy: Json[] = (Array.isArray(res.data) ? (res.data as Json[]) : [])
    .map((row) => ({ table: String(row.table_label || '').toUpperCase(), time: String(row.time || '').slice(0, 5) }))
    .filter((row) => row.table);
  const locks = await locksOf(date);
  locks.forEach((row) => busy.push({ table: row.table, time: '', note: row.note, locked: true }));
  return json({ ok: true, service: 'sod-reserve', date, busy });
}

/* ── LINE: แจ้งเตือนจองใหม่ + จด groupId ───────────────────── */
async function lineTarget(): Promise<string> {
  const fromEnv = (Deno.env.get('LINE_TO') || '').trim();
  if (fromEnv) return fromEnv;
  const res = await sb(`settings?key=eq.LINE_TO&select=value&limit=1`);
  const rows = Array.isArray(res.data) ? (res.data as Json[]) : [];
  return rows.length ? String(rows[0].value || '').trim() : '';
}

function lineMessage(p: Json): string {
  const parts = String(p.date || '').split('-');
  const when = parts.length === 3 ? `${Number(parts[2])} ${THAI_MONTHS[Number(parts[1]) - 1] || ''}` : String(p.date || '');
  const out = [
    '🔔 จองใหม่ · SOD! signature',
    `${p.time || ''} น. · ${when}`,
    `${p.name || '—'} · ${Number(p.party) || 1} คน${p.table ? ` · โต๊ะ ${String(p.table).toUpperCase()}` : ''}`,
    String(p.phone || ''),
  ];
  if (p.note) out.push(`หมายเหตุ: ${String(p.note).slice(0, 80)}`);
  out.push(`รหัส ${String(p.code || '')}`);
  return out.filter(Boolean).join('\n');
}

/** คืน 'sent' | 'failed' | 'skipped' */
async function notifyLine(p: Json): Promise<string> {
  const token = (Deno.env.get('LINE_CHANNEL_TOKEN') || '').trim();
  if (!token) return 'skipped';
  const to = await lineTarget();
  if (!to) return 'skipped';
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: lineMessage(p) }] }),
    });
    if (!res.ok) {
      console.error('LINE push failed', res.status, await res.text());
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('LINE push error', err);
    return 'failed';
  }
}

async function captureLineTarget(raw: string): Promise<Response> {
  let body: Json = {};
  try {
    body = JSON.parse(raw) as Json;
  } catch {
    return json({ ok: true, service: 'sod-reserve' });
  }
  const events = Array.isArray(body.events) ? (body.events as Json[]) : [];
  for (const event of events) {
    const source = (event && (event.source as Json)) || {};
    const id = String(source.groupId || source.roomId || source.userId || '');
    if (!id) continue;
    const res = await sb('settings?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ key: 'LINE_TO', value: id, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) {
      console.error('save LINE_TO failed', res.status, res.data);
      return json({ ok: false, error: 'save failed' }, 502);
    }
    console.log('บันทึก LINE_TO แล้ว:', id);
    return json({ ok: true, service: 'sod-reserve', line: 'captured', to: id.slice(-6) });
  }
  return json({ ok: true, service: 'sod-reserve' });
}

/* ── POST: จองใหม่ / ล็อค-ปลดล็อคโต๊ะ ─────────────────────── */
async function handlePost(req: Request, params: URLSearchParams): Promise<Response> {
  const raw = await req.text();
  if (raw.includes('"events"')) return await captureLineTarget(raw);

  let payload: Json | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as Json) : null;
  } catch {
    payload = null;
  }
  if (!payload) return json({ ok: false, error: 'empty body' });

  const sent = String(params.get('token') || payload.token || '');
  if (!authorized(sent)) return json({ ok: false, error: 'unauthorized' }, 401);

  const action = String(payload.action || '');

  if (action === 'lock' || action === 'unlock') {
    const date = dayStr(payload.date);
    const tables = cleanTables(payload.tables ?? payload.table);
    if (!tables.length) return json({ ok: false, error: 'missing table' });

    const changed: string[] = [];
    for (const table of tables) {
      if (table.length > 40 || !TABLE_RE.test(table)) return json({ ok: false, error: 'invalid table' });
      if (action === 'lock') {
        const res = await sb('table_locks?on_conflict=date,table_label', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify({
            date,
            table_label: table,
            note: String(payload.note || '').slice(0, 120),
          }),
        });
        if (!res.ok) return json({ ok: false, error: `db ${res.status}` }, 502);
        if (Array.isArray(res.data) && res.data.length) changed.push(table);
      } else {
        const res = await sb(`table_locks?date=eq.${enc(date)}&table_label=eq.${enc(table)}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=representation' },
        });
        if (!res.ok) return json({ ok: false, error: `db ${res.status}` }, 502);
        if (Array.isArray(res.data) && res.data.length) changed.push(table);
      }
    }
    return json({
      ok: true,
      service: 'sod-reserve',
      action,
      date,
      changed,
      locks: await locksOf(date),
    });
  }

  /* จองใหม่ */
  const problem = validate(payload);
  if (problem) return json({ ok: false, error: problem });

  const code = String(payload.code).slice(0, 24);
  const row = {
    code,
    name: String(payload.name).trim().slice(0, 60),
    phone: String(payload.phone),
    date: String(payload.date),
    time: String(payload.time).slice(0, 5),
    party: Number(payload.party) || 1,
    note: String(payload.note || '').slice(0, 200),
    status: STATUSES[0],
    table_label: String(payload.table || '').toUpperCase().slice(0, 40),
  };

  const res = await sb('reservations?on_conflict=code', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const data = (res.data || {}) as Json;
    const text = JSON.stringify(data);
    /* unique index (date, table_label) — โต๊ะนี้ถูกจองไปแล้วในวันนั้น */
    if (res.status === 409 && text.includes('reservations_slot_uniq')) {
      return json({ ok: false, error: 'table taken — โต๊ะนี้ถูกจองแล้ว กรุณาเลือกโต๊ะอื่นหรือติดต่อร้าน' });
    }
    return json({ ok: false, error: `db ${res.status}` }, 502);
  }

  const saved = Array.isArray(res.data) ? (res.data as Json[]) : [];
  if (!saved.length) return json({ ok: true, code, duplicate: true });

  /* แจ้งเข้ากลุ่ม LINE — ล้มเหลวก็ไม่ทำให้การจองหาย */
  await notifyLine(payload);
  return json({ ok: true, code, row: 1 });
}

/* ── GET ───────────────────────────────────────────────────── */
async function handleGet(params: URLSearchParams): Promise<Response> {
  const sent = String(params.get('token') || '');
  const action = String(params.get('action') || 'status');

  if (action === 'list' || action === 'locks') {
    if (!SOD_TOKEN) {
      return json({ ok: false, error: 'ยังไม่ได้ตั้ง SOD_TOKEN — ต้องตั้งก่อนใช้หน้ารายการจอง' });
    }
    if (!authorized(sent)) return json({ ok: false, error: 'unauthorized' }, 401);
    if (action === 'list') return await listOf(params.get('date'));
    const date = dayStr(params.get('date'));
    return json({ ok: true, service: 'sod-reserve', date, locks: await locksOf(date) });
  }

  /* ผังฝั่งลูกค้า: คืนแค่เลขโต๊ะ/เวลา/โน้ตของโต๊ะที่ร้านล็อค ไม่มีข้อมูลส่วนตัว */
  if (action === 'busy') return await busyOf(params.get('date'));

  if (action === 'linetest') {
    if (!authorized(sent)) return json({ ok: false, error: 'unauthorized' }, 401);
    const result = await notifyLine({
      code: 'SOD-TEST',
      name: 'ทดสอบระบบ',
      phone: '0800000000',
      date: bkkToday(),
      time: new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(11, 16),
      party: 2,
      table: '24',
      note: 'ข้อความทดสอบจาก Supabase Edge Function',
    });
    return json({ ok: true, service: 'sod-reserve', line: result });
  }

  if (!authorized(sent)) return json({ ok: false, error: 'unauthorized' }, 401);
  const res = await sb('reservations?select=code&limit=1', { headers: { Prefer: 'count=exact' } });
  if (!res.ok) return json({ ok: false, error: `db ${res.status}` }, 502);
  const total = Number(String(res.headers.get('content-range') || '').split('/')[1] || 0);
  return json({ ok: true, service: 'sod-reserve', bookings: total, tab: 'reservations' });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const params = new URL(req.url).searchParams;
    if (req.method === 'POST') return await handlePost(req, params);
    if (req.method === 'GET') return await handleGet(params);
    return json({ ok: false, error: 'method not allowed' }, 405);
  } catch (err) {
    console.error('sod-reserve failed', err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
