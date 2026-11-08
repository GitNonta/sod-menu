# หลังบ้านจองบน Supabase (ทางเลือกแทน Apps Script)

คู่มือนี้อธิบายการย้ายตัวรับจองจาก Google Apps Script + Google Sheet มาเป็น
**Supabase (Postgres + Edge Function)** โดย**ไม่ต้องแก้โค้ดหน้าเว็บเลย**
เพราะหน้าเว็บคุยกับหลังบ้านผ่าน URL เดียว (`shop.reserve.webhook`) และฟังก์ชันที่ให้มา
ตอบ JSON รูปแบบเดียวกับ `reserve-webhook.gs` ทุกฟิลด์

| | Apps Script + Sheet | Supabase |
| --- | --- | --- |
| ค่าใช้จ่าย | ฟรี | Free: 500 MB DB, หยุดโปรเจกต์ถ้าไม่มี activity 7 วัน · Pro $25/เดือน ไม่หยุด |
| URL ที่ใช้ | `…/macros/s/<ID>/exec` | `https://<ref>.supabase.co/functions/v1/sod-reserve` |
| แก้หน้าเว็บ | – | **ไม่ต้องแก้** (เปลี่ยนแค่ค่า `webhook`) |
| ป้องกันข้อมูลลูกค้า | token เดียว ใช้ทั้งอ่าน/เขียน → ต้องฝังใน `menu.json` ที่ใครก็อ่านได้ | `SOD_TOKEN` ใช้เฉพาะงานของร้าน (list/locks/lock/unlock/linetest); **การจองจากหน้าเว็บไม่ต้องใช้ token** จึงไม่ต้องฝัง token ที่ไหน, `service_role` ไม่เคยไปถึงเบราว์เซอร์, เปิด RLS ไว้ |
| กันจองซ้ำโต๊ะ | ไม่มี | unique index `(date, table_label)` |
| ดูข้อมูล | เปิด Sheet | Table Editor / SQL / รายงาน |
| ตอนแก้โค้ด | Deploy → New version ทุกครั้ง | deploy ฟังก์ชันใหม่ (ไม่มีปัญหาเวอร์ชันค้าง) |

ไฟล์ที่ใช้: [`../supabase/schema.sql`](../supabase/schema.sql) · [`../supabase/functions/sod-reserve/index.ts`](../supabase/functions/sod-reserve/index.ts)

---

## 1. สร้างโปรเจกต์

1. ไปที่ https://database.new แล้วล็อกอิน (ใช้บัญชีร้าน)
2. ตั้งชื่อ เช่น `sod-signature`, ตั้ง **Database Password** แล้วจดไว้
3. เลือก region ใกล้ร้าน (Singapore)
4. รอสร้างเสร็จ (~2 นาที) แล้วจด **Project URL** จากหน้า Settings → API
   รูปแบบ `https://abcdefghijklmnop.supabase.co`

## 2. สร้างตาราง

1. เมนูซ้าย → **SQL Editor** → **New query**
2. วางเนื้อหาทั้งไฟล์ [`supabase/schema.sql`](../supabase/schema.sql) → **Run**
3. ควรเห็นผลลัพธ์ 3 แถว (`reservations`, `settings`, `table_locks`) และ `rls = true` ทุกแถว

ตารางที่ได้

| ตาราง | เก็บอะไร |
| --- | --- |
| `reservations` | หนึ่งแถวต่อการจอง (code เป็น primary key → กันส่งซ้ำ) |
| `table_locks` | โต๊ะที่ร้านปิดเอง (คีย์ `date + table_label`) |
| `settings` | ค่าที่จดอัตโนมัติ (ตอนนี้คือ `LINE_TO` = groupId) |

## 3. ตั้ง secrets

**Dashboard → Edge Functions → Secrets** (หรือ CLI ด้านล่าง) ใส่ 3 ตัว

| ชื่อ | ค่า | จำเป็น |
| --- | --- | --- |
| `SOD_TOKEN` | รหัสผ่านร้าน เช่น `sod-6453150c9f31d2f93f49bfa4` (สร้างด้วย `echo "sod-$(openssl rand -hex 12)"`) | ✅ |
| `LINE_CHANNEL_TOKEN` | channel access token (long-lived) จาก LINE Developers | ถ้าอยากได้แจ้งเตือน |
| `LINE_TO` | `C…`/`R…`/`U…` — ไม่ใส่ก็ได้ ระบบจะอ่านจาก `settings` ที่จดให้อัตโนมัติ | ไม่บังคับ |

> `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` ไม่ต้องใส่เอง Supabase ใส่ให้ฟังก์ชันอัตโนมัติ
> **ห้าม**เอา service_role key ไปวางใน `data/menu.json` หรือไฟล์ในรีโปเด็ดขาด

## 4. deploy ฟังก์ชัน

**ทางที่ง่าย (ไม่ต้องติดตั้งอะไร):**

1. Dashboard → **Edge Functions** → **Deploy a new function** → ตั้งชื่อ **`sod-reserve`**
2. ลบโค้ดตัวอย่าง แล้ววางเนื้อหาไฟล์ [`supabase/functions/sod-reserve/index.ts`](../supabase/functions/sod-reserve/index.ts)
3. **ปิด “Verify JWT”** (เพราะหน้าเว็บไม่ได้ล็อกอินด้วย Supabase Auth — เราตรวจด้วย `SOD_TOKEN` เอง)
4. **Deploy**

**ทาง CLI:**

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy sod-reserve --no-verify-jwt
supabase secrets set SOD_TOKEN=sod-xxxxxxxxxxxxxxxxxxxxxxxx
```

URL ที่ได้: `https://<ref>.supabase.co/functions/v1/sod-reserve`

## 5. ต่อเข้าเว็บ

แก้ `data/menu.json`

```json
"webhook": "https://<ref>.supabase.co/functions/v1/sod-reserve"
```

> **ไม่ต้องมี `?token=` ต่อท้าย** — ฟังก์ชันนี้อนุญาตให้ POST จองจากหน้าเว็บโดยไม่ต้องมี token
> (เหมือนฟอร์มจองของร้านทั่วไป) ส่วนการอ่านรายชื่อ/ล็อคโต๊ะยังต้องมี token
> ถ้าใส่ token ต่อท้าย URL นี้ token จะกลายเป็นข้อมูลสาธารณะ (ใครเปิดเว็บก็อ่าน `menu.json` ได้
> แล้วเอาไปเรียก `?action=list` ดูชื่อ/เบอร์ลูกค้าได้)

แล้ว bump เวอร์ชัน 3 ที่ตามกฎของรีโป (`version` ใน `menu.json`, `ASSET_VERSION` ใน `app.js`,
`?v=` ของ `style.css`/`app.js` ใน `index.html` และ `today.html`)

หน้า `today.html` ใช้รหัสผ่านร้านตัวเดียวกัน (`SOD_TOKEN`) — พนักงานกรอกในช่อง “รหัสผ่านร้าน”
หนึ่งครั้ง (จำใน `localStorage`) หรือเปิดด้วยลิงก์ `today.html?token=<SOD_TOKEN>`

## 6. ทดสอบ (แทนที่ `$URL` และ `$TOK`)

```bash
URL="https://<ref>.supabase.co/functions/v1/sod-reserve"
TOK="sod-xxxxxxxxxxxxxxxxxxxxxxxx"
D=$(TZ=Asia/Bangkok date +%F)

curl -s "$URL?action=status&token=$TOK"          # {"ok":true,"bookings":0,"tab":"reservations"}
curl -s "$URL?action=busy&date=$D"               # {"ok":true,"busy":[]}
curl -s "$URL?action=list&date=$D&token=$TOK"    # {"ok":true,"count":0,"people":0,"rows":[]}
curl -s "$URL?action=list&date=$D&token=xxx"     # {"ok":false,"error":"unauthorized"}
curl -s "$URL?action=linetest&token=$TOK"        # {"ok":true,"line":"sent"} ← ถ้าตั้ง LINE แล้ว
```

ยิงจองทดสอบ (ต้องได้ `ok:true` และเห็นแถวใหม่ใน Table Editor)

```bash
curl -s -X POST "$URL" -H 'Content-Type: application/json' -d '{
  "source":"sod-menu","code":"SOD-TEST01","name":"ทดสอบระบบ","phone":"0800000000",
  "date":"'"$D"'","time":"19:30","party":2,"note":"ยิงทดสอบ","table":"24"
}'
# ไม่ใส่ token ก็ต้องได้ ok:true — ถ้าได้ 401 แปลว่าโค้ดที่ deploy ยังเป็นเวอร์ชันเก่า
```

ล็อค/ปลดล็อคโต๊ะ

```bash
curl -s -X POST "$URL" -H 'Content-Type: application/json' \
  -d '{"action":"lock","token":"'"$TOK"'","date":"'"$D"'","tables":["12"],"note":"ปิดซ่อม"}'
curl -s -X POST "$URL" -H 'Content-Type: application/json' \
  -d '{"action":"unlock","token":"'"$TOK"'","date":"'"$D"'","tables":["12"]}'
```

ลบข้อมูลทดสอบ: Table Editor → `reservations` → ลบแถว `SOD-TEST01`

## 7. จด groupId ของ LINE (ถ้าต้องการแจ้งเตือน)

1. LINE Developers → Messaging API → **Webhook URL** = `<fn-url>?token=<SOD_TOKEN>`
2. กด **Verify** (LINE จะยิง event เปล่า ๆ มา — ฟังก์ชันตอบ 200)
3. เชิญบอทเข้ากลุ่มร้าน แล้วพิมพ์อะไรสักคำในกลุ่ม
4. ฟังก์ชันจะจด `LINE_TO` ลงตาราง `settings` ให้เอง (ดูใน Table Editor)
   หรือกำหนดเองด้วย secret `LINE_TO`
5. ทดสอบด้วย `?action=linetest&token=…` → ต้องได้ `"line":"sent"`
   (`failed` = token ผิด/บอทไม่อยู่ในกลุ่ม, `skipped` = ยังไม่ได้ตั้ง token หรือยังไม่มี LINE_TO)

## 8. ค่าที่ฟังก์ชันตอบ (สัญญาเดียวกับ Apps Script)

```
GET  ?action=status                      → { ok, service, bookings, tab }
GET  ?action=busy&date=YYYY-MM-DD        → { ok, date, busy:[{table,time}] }
                                            โต๊ะที่ร้านล็อค: { table, time:"", note, locked:true }
GET  ?action=list&date=…&token=…         → { ok, date, count, people, rows:[{code,name,phone,date,time,party,note,status,table,created_at}] }
GET  ?action=locks&date=…&token=…        → { ok, date, locks:[{table,note,at}] }
POST {…จอง…}                             → { ok, code, row } | { ok:true, duplicate:true }   (ไม่ต้อง token)
POST { action:"lock"|"unlock", … }       → { ok, action, date, changed:[…], locks:[…] }     (ต้อง token)
POST { events:[…] } (LINE webhook)        → { ok, line:"captured", to }                     (ไม่ต้อง token)
```

## 9. อาการผิด → แก้

| อาการ | สาเหตุ | แก้ |
| --- | --- | --- |
| `404` ตอนยิง URL | ยังไม่ deploy หรือชื่อฟังก์ชันไม่ใช่ `sod-reserve` | Deploy ใหม่, ตรวจ path `/functions/v1/sod-reserve` |
| `401` เฉพาะหน้า `today.html` / `?action=list` | พนักงานกรอกรหัสไม่ตรงกับ `SOD_TOKEN` | กรอกใหม่ให้ตรง secret (การจองจากหน้าเว็บไม่ใช้ token จึงไม่โดน 401) |
| `{ "ok": false, "error": "db 401" }` | ฟังก์ชันอ่าน service role key ไม่ได้ | ตรวจว่า deploy ผ่าน Dashboard ของโปรเจกต์นั้น (ไม่ใช่ self-host) |
| `db 404` / `relation does not exist` | ยังไม่รัน `schema.sql` | รันข้อ 2 |
| หน้าจองขึ้น “ส่งอัตโนมัติไม่สำเร็จ” | โดน unique index (โต๊ะถูกจองแล้ว) หรือ `webhook` ผิด/ฟังก์ชันยังไม่ deploy | เลือกโต๊ะอื่น / ยิง `?action=busy` เช็ก URL |
| ไม่มีแจ้งเตือน LINE | ไม่มี secret หรือบอทไม่อยู่กลุ่ม | ทำข้อ 7 |
| หลัง 7 วันไม่ได้ใช้แล้ว endpoint ตาย | Free plan pause | Dashboard → กด **Restore/Unpause** (ข้อมูลไม่หาย) หรืออัปเกรด Pro |
| หน้า today.html ขึ้น “โหลดรายการไม่สำเร็จ (unauthorized)” | รหัสพนักงานไม่ตรง | กรอก `SOD_TOKEN` ใหม่ |

## 10. ย้ายข้อมูลเก่าจาก Sheet (ถ้ามี)

1. ใน Google Sheet → ไฟล์ → ดาวน์โหลด → CSV (แท็บ `Reservations`)
2. Table Editor → `reservations` → **Import data from CSV**
3. จับคู่คอลัมน์: `รหัส`→`code`, `ชื่อ`→`name`, `เบอร์โทร`→`phone`, `วันที่จอง`→`date`,
   `เวลา`→`time`, `จำนวนคน`→`party`, `หมายเหตุ`→`note`, `สถานะ`→`status`, `โต๊ะ`→`table_label`
4. ตรวจว่า `date` เป็น `YYYY-MM-DD` และ `time` เป็น `HH:MM`

## 11. ย้อนกลับไป Apps Script

แก้ `webhook` กลับเป็น URL `/exec` แล้ว bump เวอร์ชัน — ทั้งสองระบบอยู่ด้วยกันได้
(ข้อมูลที่จองระหว่างใช้ Supabase จะไม่อยู่ใน Sheet เว้นแต่ export ไปเพิ่ม)
