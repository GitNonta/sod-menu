/**
 * SOD! signature — ตัวรับจองโต๊ะ (Supabase Edge Function, Deno/TypeScript)
 * ----------------------------------------------------------------------
 * ทำหน้าที่แทน reserve-webhook.gs ทุกประการ: สัญญาเดียวกับที่หน้าเว็บเรียกอยู่
 *   POST  <fn-url>                                   จองใหม่ (body JSON จาก app.js) — ไม่ต้อง token
 *   GET   ?action=status                             เช็กว่าติดตั้งแล้ว
 *   GET   ?action=busy&date=YYYY-MM-DD               โต๊ะไม่ว่าง (ไม่ต้อง token)
 *   GET   ?action=list&date=YYYY-MM-DD&token=…       รายการจองของวัน (ต้อง token)
 *   GET   ?action=locks&date=YYYY-MM-DD&token=…      โต๊ะที่ร้านล็อค (ต้อง token)
 *   POST  { action:'lock'|'unlock', token, date, tables:[], note }   (ต้อง token)
 *   POST  { action:'set-status', token, code, status }                (ต้อง token)
 *         status='ยกเลิก' → ลบแถวนั้นออกจริง (โต๊ะว่างทันที ไม่ค้างเป็นประวัติ)
 *   GET   ?action=config                             เวลาปิดจอง + อีเว้น (ไม่ต้อง token)
 *   POST  { action:'save-config', token, closeTime, events:[] }        (ต้อง token)
 *   GET   ?action=linetest&token=…                   ส่งข้อความทดสอบเข้า LINE
 *   POST  body ที่มี "events" (LINE webhook)          จด groupId ลงตาราง settings
 *
 * เพราะรูปแบบคำตอบเหมือน Apps Script หน้าเว็บ (app.js / today.html)
 * จึงไม่ต้องแก้โค้ดหน้าเว็บเลย แค่เปลี่ยน shop.reserve.webhook เป็น URL ของฟังก์ชันนี้
 *
 * Secrets ที่ต้องตั้ง (Dashboard → Edge Functions → Secrets หรือ `supabase secrets set`):
 *   SOD_TOKEN            รหัสผ่านร้าน ใช้แทน SHARED_TOKEN
 *   AUTO_CONFIRM         'off' = การจองเข้าเป็น 'รอยืนยัน' ให้คนกดยืนยันเอง (ไม่ตั้ง = ยืนยันอัตโนมัติ)
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
/* การจองที่ส่งมาให้ยืนยันทันที (ร้านไม่ต้องกดยืนยันใน today.html)
   อยากตรวจก่อนค่อยตั้ง secret AUTO_CONFIRM=off → การจองจะเข้าเป็น 'รอยืนยัน' */
const AUTO_CONFIRM = (Deno.env.get('AUTO_CONFIRM') || 'on').trim().toLowerCase() !== 'off';
const BOOKING_STATUS = AUTO_CONFIRM ? STATUSES[1] : STATUSES[0];
/* ตราประทับบิลด์ — `?action=status` ตอบค่านี้กลับไป จะรู้ทันทีว่า deploy ใหม่ขึ้นหรือยัง */
const BUILD = '2026-11-08.5';

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

/* ── ตาราง/อีเว้นของร้าน เก็บใน settings (key/value ที่มีอยู่แล้ว) ──
   CLOSE_TIME = 'HH:MM' เวลาปิดรับจอง *ทุกวัน* (ไม่มีแถว = 20:00, ค่าว่าง = รับจองตลอด)
   EVENTS     = JSON [{ date, name, open, lock }] — lock:true = วันนั้นปิดการจองทั้งวัน
                open = เวลาร้านเปิดหลังงาน (งานสทาปปารตี้ = 00:30) */
type ShopEvent = { date: string; name: string; lock: boolean; open: string };
/* ค่าบริการจอง: เก็บเฉพาะวันศุกร์/เสาร์/วันอีเว้น (ตั้งใน today.html) */
type ShopFee = { enabled: boolean; amount: number; per: string; pay: string; note: string };
type ShopConfig = { closeTime: string; events: ShopEvent[]; fee: ShopFee };

type FeeState = {
  needed: boolean;
  amount: number;
  per: string;
  reason: string;
  label: string;
  pay: string;
  note: string;
};

/** ร้านปิดรับจองทุกวันสองทุ่ม จนกว่าจะแก้ใน today.html */
const DEFAULT_CLOSE_TIME = '20:00';

/** null = ยังไม่เคยตั้งค่า (ใช้ค่ามาตรฐาน), '' = ตั้งใจลบเวลาออก (รับจองตลอด) */
async function settingGet(key: string): Promise<string | null> {
  const res = await sb(`settings?key=eq.${enc(key)}&select=value&limit=1`);
  const rows = Array.isArray(res.data) ? (res.data as Json[]) : [];
  return rows.length ? String(rows[0].value ?? '') : null;
}

async function settingSet(key: string, value: string): Promise<boolean> {
  const res = await sb('settings?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

/** งานสทาปปารตี้ ร้านเปิดหลังงานเวลา 00:30 (แก้เวลาได้ใน today.html) */
const STAFF_PARTY_OPEN = '00:30';
const isStaffParty = (name: string) => /สทาป|สตาฟ|staff/i.test(name);

function cleanEvents(raw: unknown): ShopEvent[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => {
      const row = (item || {}) as Json;
      const name = String(row.name || '').trim().slice(0, 80);
      const openRaw = String(row.open || '').trim();
      /* ไม่ระบุเวลาเปิดร้าน + ชื่องานเป็นสทาปปารตี้ → ใช้ 00:30 ให้อัตโนมัติ */
      const open = /^\d{2}:\d{2}$/.test(openRaw) ? openRaw : (isStaffParty(name) ? STAFF_PARTY_OPEN : '');
      return {
        date: String(row.date || ''),
        name,
        open,
        lock: row.lock !== false,
      };
    })
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.name.length > 0);
}

const DEFAULT_FEE: ShopFee = { enabled: false, amount: 0, per: 'person', pay: '', note: '' };

function cleanFee(raw: unknown): ShopFee {
  const row = (raw || {}) as Json;
  const amount = Math.max(0, Math.min(100000, Math.round(Number(row.amount) || 0)));
  return {
    enabled: row.enabled !== false && amount > 0,
    amount,
    per: row.per === 'booking' ? 'booking' : 'person',
    pay: String(row.pay || '').trim().slice(0, 160),
    note: String(row.note || '').trim().slice(0, 160),
  };
}

async function shopConfig(): Promise<ShopConfig> {
  const [closeRaw, eventsRaw] = await Promise.all([settingGet('CLOSE_TIME'), settingGet('EVENTS')]);
  let events: ShopEvent[] = [];
  try {
    events = cleanEvents(JSON.parse(eventsRaw || '[]'));
  } catch {
    events = [];
  }
  /* ไม่มีแถวในฐานข้อมูล = ปิดทุกวัน 20:00 ตามค่ามาตรฐานของร้าน
     แต่ถ้าร้านลบเวลาออกเอง (ค่าว่าง) = รับจองตลอดวัน */
  const stored = closeRaw === null ? DEFAULT_CLOSE_TIME : closeRaw.trim();
  const feeRaw = await settingGet('FEE');
  let fee = DEFAULT_FEE;
  if (feeRaw) {
    try {
      fee = cleanFee(JSON.parse(feeRaw));
    } catch {
      fee = DEFAULT_FEE;
    }
  }
  return { closeTime: /^\d{2}:\d{2}$/.test(stored) ? stored : '', events, fee };
}

/** 0 = อาทิตย์ … 5 = ศุกร์, 6 = เสาร์ ตามเวลาไทย */
function bkkWeekday(date: string): number {
  const start = Date.parse(`${date}T00:00:00+07:00`);
  if (Number.isNaN(start)) return -1;
  return new Date(start + 7 * 3600000).getUTCDay();
}

/** วันนั้นมีค่าบริการจองหรือไม่ — ศุกร์/เสาร์ และวันอีเว้นทุกวัน */
function feeOf(date: string, cfg: ShopConfig): FeeState {
  const fee = cfg.fee;
  const off: FeeState = { needed: false, amount: 0, per: fee.per, reason: '', label: '', pay: fee.pay, note: fee.note };
  if (!fee.enabled || fee.amount <= 0) return off;
  const day = bkkWeekday(date);
  const event = cfg.events.find((row) => row.date === date) || null;
  let reason = '';
  if (day === 5) reason = 'friday';
  else if (day === 6) reason = 'saturday';
  if (event) reason = 'event';
  if (!reason) return off;
  const label = reason === 'friday'
    ? 'วันศุกร์'
    : reason === 'saturday'
      ? 'วันเสาร์'
      : event && event.name
        ? `อีเว้น ${event.name}`
        : 'วันอีเว้น';
  return { needed: true, amount: fee.amount, per: fee.per, reason, label, pay: fee.pay, note: fee.note };
}

/** วันนั้นปิดรับจองหรือยัง — อีเว้นที่ล็อคชนะเวลาปิดจองเสมอ */
function closureOf(date: string, cfg: ShopConfig): { closed: boolean; reason: string; event: ShopEvent | null } {
  const event = cfg.events.find((row) => row.date === date && row.lock) || null;
  if (event) return { closed: true, reason: 'event', event };
  /* ปิดทุกวันตามเวลาที่ร้านตั้ง — เทียบเวลาจริงของวันนั้น (ค่าเริ่มต้น 20:00) */
  if (cfg.closeTime) {
    const cut = Date.parse(`${date}T${cfg.closeTime}:00+07:00`);
    if (Number.isFinite(cut) && Date.now() >= cut) return { closed: true, reason: 'time', event: null };
  }
  return { closed: false, reason: '', event: null };
}

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
      `&select=code,name,phone,date,time,party,note,status,table_label,created_at,fee,paid&order=time.asc`,
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
    /* ค่าบริการที่ต้องเก็บของแถวนี้ (0 = ไม่มี) และชำระแล้วหรือยัง */
    fee: Number(row.fee) || 0,
    paid: row.paid !== false,
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
  /* ผังต้องรู้ด้วยว่าวันนั้นปิดรับจองแล้วหรือไม่ — และอีเว้นอะไร เริ่มเมื่อไร */
  const cfg = await shopConfig();
  const state = closureOf(date, cfg);
  return json({
    ok: true,
    service: 'sod-reserve',
    date,
    busy,
    closed: state.closed,
    reason: state.reason,
    closeTime: cfg.closeTime,
    event: state.event,
    events: cfg.events.filter((row) => row.date >= date).slice(0, 5),
    fee: feeOf(date, cfg),
    now: new Date().toISOString(),
  });
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
  if (Number(p.fee) > 0) {
    out.push(`💰 ค่าบริการ ${String(p.feeLabel || '')} ฿${Number(p.fee)} — ${p.feePay ? String(p.feePay).slice(0, 60) : 'รอชำระ'}`);
  }
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
  /* LINE webhook ไม่มีฟิลด์ action เลย — ส่วน save-config มี "events" ของร้าน
     จึงต้องกันด้วยการดูว่ามี action มาด้วยหรือไม่ ไม่งั้น config จะถูกกินเงียบ ๆ */
  if (raw.includes('"events"') && !raw.includes('"action"')) return await captureLineTarget(raw);

  let payload: Json | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as Json) : null;
  } catch {
    payload = null;
  }
  if (!payload) return json({ ok: false, error: 'empty body' });

  const action = String(payload.action || '');
  const sent = String(params.get('token') || payload.token || '');

  /* ล็อค/ปลดล็อคโต๊ะ = งานของร้าน ต้องมี token
     ส่วนการจองจากหน้าเว็บเป็นสาธารณะ: ถ้าบังคับ token ด้วย หน้าเว็บต้องฝัง token
     ไว้ใน menu.json ที่ใครก็อ่านได้ ซึ่งเปิดช่องให้ดึงรายชื่อ/เบอร์ลูกค้าออกไป */
  if (action === 'lock' || action === 'unlock') {
    if (!authorized(sent)) return json({ ok: false, error: 'unauthorized' }, 401);
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

  /* เปลี่ยนสถานะการจองจากหน้า today.html (ยืนยันแล้ว / ยกเลิก) */
  if (action === 'set-status') {
    if (!authorized(sent)) return json({ ok: false, error: 'unauthorized' }, 401);
    const code = String(payload.code || '').slice(0, 24);
    if (!code) return json({ ok: false, error: 'missing code' });
    const status = String(payload.status || '');
    if (!STATUSES.includes(status)) return json({ ok: false, error: 'invalid status' });
    /* ยกเลิก = ลบแถวทิ้ง ไม่เก็บไว้เป็นสถานะค้าง (โต๊ะกลับมาว่างทันที) */
    if (status === STATUSES[2]) {
      const gone = await sb(`reservations?code=eq.${enc(code)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
      });
      if (!gone.ok) return json({ ok: false, error: `db ${gone.status}` }, 502);
      const removed = Array.isArray(gone.data) ? (gone.data as Json[]) : [];
      if (!removed.length) return json({ ok: false, error: 'not found' }, 404);
      return json({ ok: true, service: 'sod-reserve', code, status, deleted: true });
    }
    /* ยืนยันแล้ว = ร้านรับเงินแล้วด้วย (ถ้ามีค่าบริการ) */
    const patch: Json = { status };
    if (status === STATUSES[1]) patch.paid = true;
    const res = await sb(`reservations?code=eq.${enc(code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return json({ ok: false, error: `db ${res.status}` }, 502);
    const rows = Array.isArray(res.data) ? (res.data as Json[]) : [];
    if (!rows.length) return json({ ok: false, error: 'not found' }, 404);
    return json({ ok: true, service: 'sod-reserve', code, status });
  }

  /* ลูกค้าโอนค่าบริการแล้ว → ร้านกด “ชำระแล้ว” ใน today.html */
  if (action === 'mark-paid') {
    if (!authorized(sent)) return json({ ok: false, error: 'unauthorized' }, 401);
    const code = String(payload.code || '').slice(0, 24);
    if (!code) return json({ ok: false, error: 'missing code' });
    const res = await sb(`reservations?code=eq.${enc(code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ paid: true, status: STATUSES[1] }),
    });
    if (!res.ok) return json({ ok: false, error: `db ${res.status}` }, 502);
    const rows = Array.isArray(res.data) ? (res.data as Json[]) : [];
    if (!rows.length) return json({ ok: false, error: 'not found' }, 404);
    return json({ ok: true, service: 'sod-reserve', code, status: STATUSES[1], paid: true });
  }

  /* เวลาปิดจอง + วันอีเว้น + ค่าบริการ (ตั้งจาก today.html) */
  if (action === 'save-config') {
    if (!authorized(sent)) return json({ ok: false, error: 'unauthorized' }, 401);
    const closeTime = String(payload.closeTime ?? '').trim();
    if (closeTime && !/^\d{2}:\d{2}$/.test(closeTime)) return json({ ok: false, error: 'invalid closeTime' });
    const events = cleanEvents(payload.events);
    if (events.length > 60) return json({ ok: false, error: 'too many events' });
    const fee = payload.fee === undefined ? (await shopConfig()).fee : cleanFee(payload.fee);
    const savedClose = await settingSet('CLOSE_TIME', closeTime);
    const savedEvents = await settingSet('EVENTS', JSON.stringify(events));
    const savedFee = await settingSet('FEE', JSON.stringify(fee));
    if (!savedClose || !savedEvents || !savedFee) return json({ ok: false, error: 'db' }, 502);
    return json({ ok: true, service: 'sod-reserve', closeTime, events, fee });
  }

  /* จองใหม่ — ถ้าร้านปิดรับจองของวันนั้นแล้ว ต้องปฏิเสธที่หลังบ้านด้วย
     ไม่ใช่พึ่งแค่ผังฝั่งลูกค้า */
  const cfg = await shopConfig();
  const state = closureOf(String(payload.date || ''), cfg);
  if (state.closed) {
    const why = state.reason === 'event'
      ? `closed — วันนี้มีอีเว้น${state.event?.name ? ` ${state.event.name}` : ''} ปิดรับจอง${state.event?.open ? ` ร้านเปิด ${state.event.open} น.` : ''} กรุณา walk-in หรือเลือกวันอื่น`
      : `closed — ปิดรับจองของวันนี้แล้ว${cfg.closeTime ? ` (ปิด ${cfg.closeTime} น.)` : ''} กรุณา walk-in หรือเลือกวันอื่น`;
    return json({ ok: false, error: why });
  }

  const problem = validate(payload);
  if (problem) return json({ ok: false, error: problem });

  const code = String(payload.code).slice(0, 24);
  /* ศุกร์/เสาร์/วันอีเว้น = ต้องชำระค่าบริการก่อน ร้านจึงยืนยัน (ไม่ auto-confirm) */
  const feeState = feeOf(String(payload.date), cfg);
  const partyCount = Number(payload.party) || 1;
  const feeTotal = feeState.needed
    ? (feeState.per === 'person' ? feeState.amount * partyCount : feeState.amount)
    : 0;
  const row = {
    code,
    name: String(payload.name).trim().slice(0, 60),
    phone: String(payload.phone),
    date: String(payload.date),
    time: String(payload.time).slice(0, 5),
    party: partyCount,
    note: String(payload.note || '').slice(0, 200),
    status: feeTotal > 0 ? STATUSES[0] : BOOKING_STATUS,
    table_label: String(payload.table || '').toUpperCase().slice(0, 40),
    fee: feeTotal,
    paid: feeTotal <= 0,
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
  await notifyLine({
    ...payload,
    fee: feeTotal,
    feeLabel: feeState.label,
    feePay: feeState.pay,
  });
  return json({
    ok: true,
    code,
    status: row.status,
    row: 1,
    fee: feeTotal > 0 ? { ...feeState, total: feeTotal } : null,
  });
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

  /* ตารางปิดจอง/อีเว้น — ไม่มีข้อมูลลูกค้า จึงไม่ต้อง token */
  if (action === 'config') {
    const cfg = await shopConfig();
    return json({
      ok: true,
      service: 'sod-reserve',
      closeTime: cfg.closeTime,
      events: cfg.events,
      fee: cfg.fee,
      today: bkkToday(),
    });
  }

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
  return json({ ok: true, service: 'sod-reserve', build: BUILD, bookings: total, tab: 'reservations' });
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
