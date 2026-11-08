-- SOD! signature — ตารางสำหรับหลังบ้านจองบน Supabase (Postgres)
-- วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- ใช้คู่กับ supabase/functions/sod-reserve/index.ts (คำอธิบายที่ docs/supabase-backend.md)
--
-- หลักการ: anon key ไม่มีสิทธิ์แตะตารางพวกนี้เลย (เปิด RLS แล้วไม่สร้าง policy)
--         ทุกอย่างวิ่งผ่าน Edge Function ที่ถือ service_role key เท่านั้น

create table if not exists public.reservations (
  code        text primary key,                    -- SOD-XXXX จากหน้าเว็บ
  created_at  timestamptz not null default now(),  -- เวลาที่รับจอง
  name        text not null,
  phone       text not null,
  date        date not null,                       -- วันที่จอง (YYYY-MM-DD)
  time        text not null,                       -- 'HH:MM' เก็บเป็นข้อความเพื่อเรียงแบบเดิม
  party       int  not null check (party between 1 and 50),
  note        text not null default '',
  status      text not null default 'รอยืนยัน'
              check (status in ('รอยืนยัน', 'ยืนยันแล้ว', 'ยกเลิก')),
  table_label text not null default '',            -- '24', 'A1 + A2', '9, 24'
  constraint reservations_table_label_len check (char_length(table_label) <= 40)
);

create index if not exists reservations_date_idx on public.reservations (date, time);

-- กันจองซ้ำ: 1 โต๊ะต่อ 1 วัน (ยกเลิกแล้วจองใหม่ได้)
-- หมายเหตุ: เทียบแบบข้อความตรงตัว 'A1 + A2' จึงกันได้เฉพาะคีย์ที่พิมพ์เหมือนกัน
create unique index if not exists reservations_slot_uniq
  on public.reservations (date, table_label)
  where table_label <> '' and status <> 'ยกเลิก';

create table if not exists public.table_locks (
  date        date not null,
  table_label text not null,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  primary key (date, table_label)
);

-- ค่าที่จดอัตโนมัติ (ตอนนี้ใช้เก็บ LINE_TO = groupId ของกลุ่มร้าน)
create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.reservations enable row level security;
alter table public.table_locks enable row level security;
alter table public.settings     enable row level security;

-- ไม่สร้าง policy ใด ๆ โดยตั้งใจ:
--   anon / authenticated อ่าน-เขียนไม่ได้
--   Edge Function ใช้ service_role ซึ่งข้าม RLS อยู่แล้ว

-- ตรวจว่าเสร็จ: ควรได้ 3 แถว และ rls = true ทุกแถว
select tablename, rowsecurity as rls
from pg_tables
where schemaname = 'public' and tablename in ('reservations', 'table_locks', 'settings')
order by tablename;
