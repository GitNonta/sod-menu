# ค่าที่ต้องใส่ทั้งหมด (Setup values) — ระบบจอง SOD! signature

ไฟล์นี้รวม **ทุกค่าที่ต้องกรอก / คัดลอก / ตัดสินใจ** ไว้ที่เดียว ใช้คู่กับ
[`reserve-backend.md`](reserve-backend.md) (คู่มือติดตั้งแบบเล่าเรื่อง) และโค้ด [`reserve-webhook.gs`](../reserve-webhook.gs)

> อ่านไฟล์นี้แล้วทำตามช่อง **“ค่าที่ใส่”** ได้เลย ไม่ต้องเดา
>
> **ใช้ Supabase แทน Apps Script?** ค่าที่ต้องใส่ต่างกัน — ดู [`supabase-backend.md`](supabase-backend.md)
> (secrets มี 3 ตัว: `SOD_TOKEN`, `LINE_CHANNEL_TOKEN`, `LINE_TO`; ไม่มี `SHEET_ID`)

---

## 0. ภาพรวม: มี 4 ที่ที่ต้องใส่ค่า

| # | ใส่ที่ไหน | ใส่อะไร | จำนวน | ใครทำ |
| --- | --- | --- | --- | --- |
| 1 | Apps Script → **Script Properties** | `SHARED_TOKEN`, `SHEET_ID`, `LINE_CHANNEL_TOKEN`, `LINE_TO` | 2 ตัวบังคับ + 2 ตัวถ้าใช้ LINE | คนสร้างสคริปต์ |
| 2 | **LINE Developers / LINE OA** | Channel access token (เอาไปลงข้อ 1), groupId (จดอัตโนมัติ) | 2 | คนดูแล LINE OA ของร้าน |
| 3 | **`data/menu.json` → `shop.reserve`** | `webhook` (บังคับ), `line_url`, `phone`, `enabled`, เวลาเปิด–ปิด ฯลฯ | 1 ตัวบังคับ + อื่น ๆ | คนแก้เว็บ (commit/push) |
| 4 | **เบราว์เซอร์พนักงาน** (`today.html`) | รหัสผ่านร้าน = `SHARED_TOKEN` | 1 ครั้งต่อเครื่อง | พนักงานแต่ละคน |

---

## 1. Apps Script Script Properties (4 ตัว)

เปิดที่ **Apps Script → ⚙️ Project Settings → Script properties → Add script property**
(ช่อง **Property** = ชื่อคีย์, ช่อง **Value** = ค่า) แล้วกด **Save script properties**
ค่า property มีผลทันที ไม่ต้อง deploy ใหม่ (deploy ใหม่เฉพาะตอนแก้ *โค้ด*)

| Key (พิมพ์ให้ตรงเป๊ะ) | ต้องใส่? | ค่าที่ใส่ | ตัวอย่าง |
| --- | --- | --- | --- |
| `SHARED_TOKEN` | **บังคับ** | สุ่มเอง ยาว 16–48 ตัว ใช้ `a-z 0-9 - _` เท่านั้น | `sod-6453150c9f31d2f93f49bfa4` |
| `SHEET_ID` | เฉพาะสคริปต์ standalone | ไอดีชีตจาก URL | `1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890` |
| `LINE_CHANNEL_TOKEN` | ถ้าอยากได้แจ้งเตือน LINE | Channel access token (long-lived) | `AbC1deF2...long...=` |
| `LINE_TO` | ถ้าอยากได้แจ้งเตือน LINE | `C…` (กลุ่ม) / `R…` (room) / `U…` (คนเดียว) | `C1a2b3c4d5e6f7890abcdef1234567890` |

### 1.1 `SHARED_TOKEN` — รหัสผ่านร้าน (ตัวสำคัญที่สุด)

**ค่าที่ใส่:** สตริงสุ่มที่ตั้งเอง สร้างด้วยคำสั่งนี้แล้วคัดลอกผลลัพธ์ทั้งบรรทัด

```bash
echo "sod-$(openssl rand -hex 12)"      # → sod-6453150c9f31d2f93f49bfa4
```

**กฎการตั้งค่า**

- ยาว **≥ 16 ตัวอักษร** (แนะนำ 28) — ใช้ `a-z`, `0-9`, `-`, `_` เท่านั้น
- **ห้าม** มีช่องว่าง, ตัวอักษรไทย, และอักขระ `? & # % +` เพราะค่านี้ถูกต่อท้าย URL/query string
- ตั้งค่าเดียวใช้ทั้งระบบ (ไม่ต้องมีหลายตัว) แต่ **ใช้ซ้ำกับบริการอื่นไม่ได้** — ถ้า token หลุดให้ออกใหม่แล้วแก้ทุกที่ตามตารางนี้

**ค่านี้ถูกใช้ที่ 4 จุด — เปลี่ยนแล้วต้องแก้ให้ตรงกันหมด**

| จุด | ตำแหน่ง |
| --- | --- |
| 1 | Script Properties → `SHARED_TOKEN` |
| 2 | `data/menu.json` → `shop.reserve.webhook` → `?token=…` |
| 3 | `today.html` → ช่อง “รหัสผ่านร้าน” (หรือ `today.html?token=…`) |
| 4 | (ถ้าใช้ LINE) Webhook URL ใน LINE Developers → `?token=…` |

**ถ้าไม่ใส่:** `doPost` จะไม่ตรวจสิทธิ์ (ใครรู้ URL ก็ยิงจองปลอมได้) และ `action=list` / `action=locks`
จะตอบ error → หน้า `today.html` ใช้ไม่ได้ **จึงควรใส่เสมอ**

### 1.2 `SHEET_ID` — ไอดีสเปรดชีต

**ค่าที่ใส่:** ก๊อปจาก URL ของชีต ช่วงระหว่าง `/d/` กับ `/edit`

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0
                                      └──────────── SHEET_ID ────────────┘
```

- **ไม่ต้องใส่** ถ้าสคริปต์ผูกกับชีต (สร้างจากชีต → Extensions → Apps Script)
- **ต้องใส่** ถ้าสร้างสคริปต์แยกจาก <https://script.new> หรือคัดลอกโปรเจกต์ไปใช้กับชีตอื่น
- บัญชีที่รันสคริปต์ต้องมีสิทธิ์ **แก้ไข** ชีตนั้น ไม่งั้น `setup()` ขึ้น “You do not have permission”
- ถ้าไม่ใส่และสคริปต์ไม่ได้ผูกกับชีต → ทุกคำขอขึ้น `ยังไม่ได้ตั้ง SHEET_ID ใน Script Properties…`

### 1.3 `LINE_CHANNEL_TOKEN` — กุญแจส่งข้อความ LINE

**ค่าที่ใส่:** LINE Developers Console → เลือก provider → channel ชนิด **Messaging API** →
แท็บ **Messaging API** → หัวข้อ **Channel access token (long-lived)** → กด **Issue** → คัดลอกค่าที่ขึ้น

- ยาวประมาณ 170 ตัวอักษร มักลงท้ายด้วย `=` — คัดลอกให้ครบ อย่าให้มีช่องว่างหัว/ท้าย
- **ไม่ใช้** `Channel secret` และ **ไม่ใช้** `Channel ID` ในโค้ดนี้ (ดูไว้แค่ยืนยันว่าเปิด channel ถูกตัว)
- token หลุด/กด Revoke → ค่าเก่าใช้ไม่ได้ทันที ให้ Issue ใหม่แล้วแก้ property
- **อย่าใส่ค่านี้ในไฟล์ที่ commit** (`data/menu.json`, โค้ด) — เก็บใน Script Properties เท่านั้น
- ถ้าไม่ใส่: ไม่มีข้อความ LINE แต่การจองยังบันทึกปกติ (`notifyLine_` คืน `skipped`)

### 1.4 `LINE_TO` — ปลายทางของข้อความ

**ค่าที่ใส่:** ตัวระบุปลายทางของ LINE (ขึ้นต้นด้วยตัวอักษรบ่งชนิด)

| ขึ้นต้น | ชนิด | ใช้เมื่อ |
| --- | --- | --- |
| `C` | groupId | ส่งเข้ากลุ่มพนักงาน (แนะนำ) |
| `R` | roomId | ห้องแชตแบบ multi-user (ไม่ค่อยใช้) |
| `U` | userId | ส่งหาคนเดียว (ต้องรู้ userId ของคนนั้น) |

**วิธีที่ง่ายที่สุด (ให้สคริปต์จดให้เอง)**

1. เพิ่มบอทของร้านเข้ากลุ่ม (สแกน QR ในแท็บ Messaging API) — **ต้องทำก่อน** ไม่งั้นส่งไม่ถึง
2. LINE Developers → แท็บ Messaging API → **Webhook URL** = `<URL /exec>?token=<SHARED_TOKEN>` → **Update** → เปิด **Use webhook**
3. พิมพ์ข้อความอะไรก็ได้ในกลุ่ม 1 ครั้ง → สคริปต์จะบันทึก `LINE_TO` ให้อัตโนมัติ
   (ดูได้ใน Apps Script → **Executions** → log `บันทึก LINE_TO แล้ว: C…`)
4. ตรวจว่าค่าขึ้นแล้วที่ Project Settings → `LINE_TO` → ถ้าไม่ต้องการรับ webhook ต่อ ปิด **Use webhook** ได้
   (ปิดแล้วไม่กระทบการส่งข้อความ — `LINE_TO` ถูกเก็บไว้แล้ว)

- ถ้าไม่ใส่: `notifyLine_` คืน `skipped` ไม่มีข้อความออก
- ถ้าใส่ผิด/บอทไม่ได้อยู่ในกลุ่ม: LINE ตอบ `403` → `notifyLine_` คืน `failed` และ log มี `LINE push failed: 403 …`

---

## 2. ใส่ Script Properties ทีละขั้น (หน้าจอจริง)

1. เปิดสเปรดชีต → เมนู **Extensions → Apps Script**
2. ลบโค้ดใน `Code.gs` ทั้งหมด → วางเนื้อหาไฟล์ [`reserve-webhook.gs`](../reserve-webhook.gs) → **Save** (Ctrl+S)
3. ไอคอน **⚙️ (Project Settings)** → เลื่อนลง **Script properties** → **Add script property**

   | Property | Value |
   | --- | --- |
   | `SHARED_TOKEN` | `sod-6453150c9f31d2f93f49bfa4` ← ค่าที่สร้างเอง |
   | `SHEET_ID` | (ใส่เฉพาะสคริปต์ standalone) |

   → **Save script properties**
4. แท็บ **Editor** → เลือกฟังก์ชัน **`setup`** → **Run**
   ครั้งแรกจะมีหน้าขอสิทธิ์ → เลือกบัญชี → **Advanced** → **Go to … (unsafe)** → **Allow**
5. กลับไปดูชีต → ต้องมีแท็บ **`Reservations`** (หัวตาราง 10 คอลัมน์) และ **`TableLocks`**
6. **Deploy → New deployment → ⚙ Select type → Web app**
   - Description: `reserve v1`
   - **Execute as: `Me (อีเมลของคุณ)`**
   - **Who has access: `Anyone`** ← ถ้าเลือกอย่างอื่น ลูกค้าที่ไม่ล็อกอินจะส่งไม่ได้
   → **Deploy** → **Authorize access** → คัดลอก **Web app URL** (ลงท้าย `/exec`)
7. เก็บ URL นี้ไว้ใช้ในข้อ 3 (รูป `https://script.google.com/macros/s/AKfy…long…/exec`)
8. (ถ้าใช้ LINE) เพิ่ม `LINE_CHANNEL_TOKEN` + `LINE_TO` ตามข้อ 1.3–1.4 แล้ว Run **`testLine`**
   → Execution log ต้องขึ้น `ผลการส่ง: sent`

> **แก้โค้ดภายหลัง** ต้อง **Deploy → Manage deployments → ✏️ → Version: `New version` → Deploy**
> URL เดิมใช้ได้ ไม่ต้องแก้ `data/menu.json` — แต่ถ้าแก้แค่ *property* ไม่ต้อง deploy ใหม่

---

## 3. `data/menu.json` → `shop.reserve` — ค่าที่ต้องใส่ในเว็บ

| Key | ค่าที่ใส่ | ตัวอย่าง / หมายเหตุ |
| --- | --- | --- |
| `enabled` | `true` | เปิดฟอร์มจองบนหน้าเมนู |
| `hint` | ข้อความใต้ฟอร์ม | `"กรอกข้อมูลให้ครบ แล้วรอร้านยืนยันอีกครั้ง"` |
| `open_time` | `"HH:MM"` | `"17:00"` — เวลาเริ่มให้เลือก |
| `close_time` | `"HH:MM"` | `"02:00"` — ข้ามเที่ยงคืนได้ |
| `max_party` | จำนวนเต็ม | `20` — เกินกว่านี้ให้โทรหาร้าน |
| `max_days` | จำนวนวัน | `30` — จองล่วงหน้าได้กี่วัน |
| `webhook` | **URL `/exec` + `?token=`** | ดูตัวอย่างด้านล่าง — **ค่านี้คือตัวที่ทำให้ “ติดตั้ง” สำเร็จ** |
| `line_url` | ลิงก์ LINE OA | `"https://line.me/R/oaMessage/@yourlineid/?"` (เว้นว่างได้) |
| `phone` | เบอร์ร้าน | `"0812345678"` (เว้นว่างได้) |
| `plan.enabled` | `true` / `false` | แสดงผังโต๊ะให้ลูกค้าแตะ |
| `plan.image` | พาธรูป | `"images/floorplan.jpg"` |
| `plan.note` | ข้อความสั้น | `"แตะโต๊ะบนผังเพื่อเลือก"` |
| `plan.tables` | รายการพิกัด % | มีอยู่แล้ว 106 โต๊ะ — เพิ่ม/แก้ตาม [`reserve-backend.md`](reserve-backend.md) |

**ค่าของ `webhook` (ใส่แบบนี้เป๊ะ — มี `?token=` ต่อท้ายเสมอ)**

```json
"webhook": "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec?token=sod-6453150c9f31d2f93f49bfa4"
```

**บล็อกที่ควรได้หลังติดตั้ง**

```json
"reserve": {
  "enabled": true,
  "hint": "กรอกข้อมูลให้ครบ แล้วรอร้านยืนยันอีกครั้ง",
  "open_time": "17:00",
  "close_time": "02:00",
  "max_party": 20,
  "max_days": 30,
  "webhook": "https://script.google.com/macros/s/AKfycb…/exec?token=sod-6453150c9f31d2f93f49bfa4",
  "line_url": "https://line.me/R/oaMessage/@sodsignature/?",
  "phone": "0812345678",
  "plan": { "enabled": true, "image": "images/floorplan.jpg" }
}
```

**ทุกครั้งที่แก้ `data/menu.json` ต้อง bump เวอร์ชันให้ตรงกัน 3 ที่**

1. `data/menu.json` → `"version": "1.0.13"` → `1.0.14`
2. `app.js` → `const ASSET_VERSION = '1.0.14'`
3. `index.html` และ `today.html` → `style.css?v=1.1.14` / `app.js?v=1.1.14`

แล้ว commit + push → GitHub Pages อัปเดตใน 1–2 นาที

---

## 4. ค่าฝั่ง LINE — สรุปว่าคัดลอกอะไรจากไหน

| ค่าที่ต้องได้ | อยู่ที่ไหนใน LINE | เอาไปใส่ |
| --- | --- | --- |
| **Channel access token (long-lived)** | Developers Console → channel (Messaging API) → แท็บ *Messaging API* → *Channel access token* → **Issue** | Script Property `LINE_CHANNEL_TOKEN` |
| **groupId** | ไม่มีให้ก๊อปในคอนโซล → ให้ webhook จดอัตโนมัติ (ข้อ 1.4) | Script Property `LINE_TO` |
| **Webhook URL** | Developers Console → แท็บ *Messaging API* → *Webhook settings* | `<URL /exec>?token=<SHARED_TOKEN>` |
| Channel ID / Channel secret | แท็บ *Basic settings* | **ไม่ต้องใช้** ในระบบนี้ (เก็บไว้อ้างอิง) |

**เช็กลิสต์ LINE**

- [ ] มี LINE Official Account + เปิด Messaging API แล้ว
- [ ] กด Issue **Channel access token (long-lived)** และวางใน `LINE_CHANNEL_TOKEN`
- [ ] เพิ่มบอทเข้ากลุ่มพนักงาน (สแกน QR)
- [ ] ตั้ง Webhook URL พร้อม `?token=` → **Verify** ขึ้น Success
- [ ] พิมพ์ในกลุ่ม 1 ครั้ง → `LINE_TO` ถูกจด (ดู Executions)
- [ ] Run `testLine` → log ขึ้น `sent` และมีข้อความในกลุ่ม
- [ ] ทราบโควต้าข้อความของ OA (ดูที่ LINE Official Account Manager → Settings) — แพ็กเกจฟรีมีจำนวนจำกัด

---

## 5. ค่าที่อยู่ในเบราว์เซอร์ (ไม่ต้องใส่ในไฟล์)

| เก็บที่ | คีย์ | เก็บอะไร | ล้างเมื่อ |
| --- | --- | --- | --- |
| `today.html` (เครื่องพนักงาน) | `sod-admin-token` | รหัสผ่านร้าน (`SHARED_TOKEN`) | เปลี่ยน token / เครื่องหลุดมือ |
| `today.html` (เครื่องพนักงาน) | `sod-seen-bookings` | รหัสจองที่แจ้งเตือนไปแล้ว (5 วันล่าสุด) | อยากให้แจ้งเตือนซ้ำ |

ล้างได้ที่ เบราว์เซอร์ → ตั้งค่าเว็บไซต์ → ล้างข้อมูล (หรือ Console: `localStorage.removeItem('sod-admin-token')`)

---

## 6. ทดสอบค่าที่ใส่ ด้วย curl (แทนค่าให้ครบก่อนรัน)

```bash
URL="https://script.google.com/macros/s/AKfycb…/exec"
TOK="sod-6453150c9f31d2f93f49bfa4"
```

| ทดสอบ | คำสั่ง | ผลที่ต้องได้ |
| --- | --- | --- |
| สคริปต์ติดตั้งแล้ว | `curl -s "$URL"` | `{"ok":true,"service":"sod-reserve","bookings":N,"tab":"Reservations"}` |
| token ถูก | `curl -s "$URL?action=list&date=2026-11-08&token=$TOK"` | `{"ok":true,…,"count":…,"rows":[…]}` |
| token ผิด | `curl -s "$URL?action=list&date=2026-11-08&token=xxx"` | `{"ok":false,"error":"unauthorized"}` |
| ผังฝั่งลูกค้า (ไม่ต้อง token) | `curl -s "$URL?action=busy&date=2026-11-08"` | `{"ok":true,"busy":[{"table":"24","time":"19:30"}]}` |
| ล็อคโต๊ะ | `curl -s "$URL?action=locks&date=2026-11-08&token=$TOK"` | `{"ok":true,"locks":[]}` |
| จองทดสอบ | ดูคำสั่งเต็มใน [`reserve-backend.md`](reserve-backend.md) ข้อ 3 | `{"ok":true,"code":"SOD-TEST1","row":2}` |
| LINE | Run `testLine` ใน editor | log `sent` + ข้อความเข้ากลุ่ม |

> ลบแถวทดสอบ (`SOD-TEST1`) ออกจากชีตหลังทดสอบเสร็จ

---

## 7. เช็กลิสต์ก่อนเปิดใช้จริง

- [ ] ใส่ `SHARED_TOKEN` แล้ว (≥ 16 ตัว ไม่มีอักขระต้องห้าม)
- [ ] ใส่ `SHEET_ID` แล้ว (ถ้าสคริปต์ไม่ผูกกับชีต)
- [ ] รัน `setup()` แล้ว เห็นแท็บ `Reservations` + `TableLocks`
- [ ] Deploy Web app แบบ **Execute as: Me / Who has access: Anyone** และคัดลอก URL แล้ว
- [ ] เปิด `$URL` ด้วย GET เห็น `{"ok":true,…}`
- [ ] ใส่ `webhook` ใน `data/menu.json` พร้อม `?token=` แล้ว
- [ ] bump `version` / `ASSET_VERSION` / `?v=` ตรงกันทั้ง 3 ที่
- [ ] เปิดหน้าเมนู → จองจริง 1 ครั้ง → มีแถวใหม่ในชีต และหน้าเว็บขึ้น “ได้รับคำขอจองแล้ว”
- [ ] เปิด `today.html` ด้วยรหัสผ่านร้าน → เห็นรายการของวันนั้น
- [ ] (ถ้าใช้ LINE) `testLine` = `sent` และมีข้อความในกลุ่ม
- [ ] ลบแถว/ข้อมูลทดสอบออกจากชีต

---

## 8. ค่าผิดแบบไหน → อาการอะไร

| อาการที่เห็น | ค่าที่น่าจะผิด | วิธีแก้ |
| --- | --- | --- |
| `ยังไม่ได้ตั้ง SHEET_ID …` | ไม่ได้ใส่ `SHEET_ID` ทั้งที่สคริปต์ standalone | ใส่ `SHEET_ID` หรือย้ายสคริปต์ไปผูกกับชีต |
| `{"ok":false,"error":"unauthorized"}` | `?token=` ใน `webhook` ไม่ตรงกับ `SHARED_TOKEN` | แก้ให้ตรงกันทั้ง 2 ที่ (ระวังช่องว่าง/ตัวพิมพ์) |
| เว็บขึ้น “ส่งอัตโนมัติไม่สำเร็จ” | `webhook` ว่าง/URL ผิด/Access ไม่ใช่ Anyone | เปิด URL ด้วย GET ต้องเห็น `{"ok":true,…}` |
| `today.html` ขึ้น “รหัสผ่านร้านไม่ถูกต้อง” | รหัสในเครื่องเก่าหรือพิมพ์ผิด | ล้าง `sod-admin-token` แล้วกรอกใหม่ |
| ข้อความ LINE ไม่ออก (`skipped`) | ไม่ได้ใส่ `LINE_CHANNEL_TOKEN` หรือ `LINE_TO` | ใส่ให้ครบทั้ง 2 ตัว |
| ข้อความ LINE ไม่ออก (`failed` + log 403) | บอทไม่ได้อยู่ในกลุ่ม / `LINE_TO` ผิด | เชิญบอทเข้ากลุ่ม แล้วจด `LINE_TO` ใหม่ |
| ข้อความ LINE ไม่ออก (`failed` + log 401) | `LINE_CHANNEL_TOKEN` ผิด/ถูก revoke | Issue token ใหม่แล้ววางทับ |
| แก้โค้ดแล้วพฤติกรรมไม่เปลี่ยน | ไม่ได้ deploy **New version** | Manage deployments → ✏️ → New version |
| จองซ้ำแล้วไม่มีข้อความ LINE | ระบบไม่แจ้งการจองซ้ำ (ตามรหัส `code`) | เป็นพฤติกรรมปกติ |

---

## 9. ความปลอดภัยของค่าเหล่านี้

- **`LINE_CHANNEL_TOKEN` เป็นความลับระดับสูง** — ใครได้ไปสามารถส่งข้อความในนามร้านได้ เก็บใน Script Properties เท่านั้น ห้าม commit ลง git
- **`SHARED_TOKEN` ที่อยู่ใน `data/menu.json` ถือเป็นค่าสาธารณะ** เพราะไฟล์นี้เสิร์ฟผ่าน GitHub Pages ให้ทุกคนอ่านได้
  → ในทางปฏิบัติมันกันคนยิง `doPost` ได้แค่ระดับ “ต้องเปิดเว็บอ่านก่อน” และเพราะ `action=list` ใช้ค่าเดียวกัน
  ข้อมูลชื่อ/เบอร์ลูกค้าจึงไม่ได้ถูกป้องกันจริงจากคนที่ตั้งใจ
  - ถ้าต้องการป้องกันจริง: แยก **token เขียน** (อยู่ใน `menu.json`) ออกจาก **token อ่าน** (เก็บเฉพาะเครื่องพนักงาน)
    แล้วให้ `action=list` / `action=locks` ใช้ token อ่านเท่านั้น — ยังไม่ได้ทำในเวอร์ชันนี้
- ตั้งสิทธิ์ไฟล์ชีตเป็น **Restricted** และแชร์เฉพาะทีมร้าน
- ถ้าสงสัยว่า token หลุด: เปลี่ยน `SHARED_TOKEN` (แล้วแก้ `menu.json` + เครื่องพนักงานทุกเครื่อง) และ Issue LINE token ใหม่
