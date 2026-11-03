# SOD! signature — เว็บเมนูร้าน (GitHub Pages)

> เว็บจริง: **https://gitnonta.github.io/sod-menu/** · repo: https://github.com/GitNonta/sod-menu

เว็บเมนูแบบ static (HTML + CSS + vanilla JS, ไม่มี build step) สำหรับร้าน **SOD! signature (โสด ซิกเนเจอร์)**
ออกแบบ mobile/tablet-first มีอนิเมชันเปิดหน้า, สไลเดอร์โปรโมชัน ก่อนเที่ยงคืน / หลังเที่ยงคืน และรายการเมนูแยกหมวด

## โครงสร้างไฟล์

```
index.html          หน้าหลัก (intro, hero + promo slider, เมนู, footer)
style.css           ธีม neon dark, mobile-first (360 / 600 / 900px breakpoints)
app.js              โหลด data/menu.json แล้ว render ทั้งหน้า (ไม่มีข้อมูล hard-code ใน HTML)
                    + ปุ่มสลับธีม สว่าง/มืด (จำค่าใน localStorage คีย์ `sod-theme`)
data/menu.json      แหล่งข้อมูลเดียว: หมวด, เมนู, ราคา, โปรโมชัน, version
images/             รูปสินค้า (พื้นหลังโปร่งใส) + logo.jpg + favicon.png
.nojekyll           จำเป็นสำหรับ GitHub Pages (ปิด Jekyll)
```

## ธีม

มี 2 ธีมมินมอลที่ใช้ layout เดียวกัน: **สว่าง (ค่าเริ่มต้น)** และ **มืด** — สลับได้ที่ปุ่มพระจันทร์/พระอาทิตย์บน header
ค่าที่เลือกถูกจำใน `localStorage` และถูกอ่านก่อน CSS โหลด จึงไม่กระพริบเวลาโหลดหน้า

- โทเคนสีทั้งหมดอยู่ใน `:root` (สว่าง) และ `:root[data-theme="dark"]` ใน `style.css`
- ถ้าต้องการเปลี่ยนสีแบรนด์ แก้ที่สองบล็อกนี้ที่เดียว

## รันดูในเครื่อง

```bash
cd menu
python3 -m http.server 8123
# เปิด http://127.0.0.1:8123/
```

> ต้องเสิร์ฟผ่าน http (ไม่ใช่เปิดไฟล์ `index.html` ตรง ๆ) เพราะเบราว์เซอร์บล็อก `fetch()` บน `file://`

## แก้เมนู / ราคา

แก้ที่ `data/menu.json` ที่เดียว แล้ว **บวกเลข `version`** (เช่น `1.0.0` → `1.0.1`) และบวก `ASSET_VERSION` ใน `app.js`
บรรทัดบนสุดให้ตรงกัน — เบราว์เซอร์จะดึง JSON ใหม่และไม่ติดแคช

- `price: null` → แสดง “สอบถามราคา”
- `image: null` → แสดงไอคอนอิโมจิของหมวดนั้น
- รูปสินค้าใช้ไฟล์ `.webp` (พื้นหลังโปร่งใส) ขนาดด้านยาวสุดไม่เกิน 640px
- ฟิลด์ `note` เป็นบันทึกภายในสำหรับเจ้าของร้าน **ไม่ถูกแสดงบนเว็บ**

## เปิดเว็บจริงบน GitHub Pages

1. สร้าง repo ใหม่ (เช่นชื่อ `menu`) แล้ว push ไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น `main`
   (ทุกไฟล์ต้องอยู่ที่ root ของ repo ไม่ใช่ในโฟลเดอร์ย่อย)
   ```bash
   git remote add origin https://github.com/<username>/menu.git
   git push -u origin main
   ```
2. ไปที่ repo → **Settings → Pages → Build and deployment**
   - **Source:** Deploy from a branch
   - **Branch:** `main` / **folder:** `/ (root)` → **Save**
3. รอ 1–2 นาที เว็บจะอยู่ที่ `https://<username>.github.io/menu/`
4. อัปเดตเมนูครั้งต่อไป: แก้ `data/menu.json` + เพิ่ม `version` → commit → push (ไม่ต้องแก้โค้ด)

## สิ่งที่ยังต้องยืนยันกับเจ้าของร้าน (จากข้อมูลถอดเสียง)

- ชื่อจริงของ “เบียร์ มาย” (ในไฟล์ยังขึ้นว่า `เบียร์ 'มาย' (ยืนยันชื่อ)`) และยังไม่มีรูปสินค้า
- ราคา Regency VSOP, Jack Daniel's, Johnnie Walker Red/Black (ยังเป็น `null` → “สอบถามราคา”)
- แสงโสม 1000ml และหงส์ทอง 1000ml ราคา 540 เท่ากันตามที่ให้มา
- “กะติ่งแดง 60” ตีความเป็น **กระทิงแดง** และ “ข้าวเย็น” ตีความเป็น **ผ้าเย็น**
- บุหรี่ L&M: กฎหมายไทยจำกัดการโฆษณา/แสดงสินค้ายาสูบ — ถ้าไม่ต้องการโชว์รูป ให้ตั้ง `"image": null`

## การเคลื่อนไหว (motion)

- รูปสินค้าในสไลด์โปรเป็น **CSS 3D**: มี `perspective` + เงาสัมผัสพื้น (contact shadow) + sway `rotateY/rotateX` เบา ๆ 7.5s
- การ์ดเมนูเอียงแบบ 3D เมื่อ hover (เฉพาะจอ ≥ 900px)
- สไลด์ที่ไม่ใช่ตัวที่แสดงอยู่จะหยุดอนิเมชัน (`animation-play-state: paused`)
- `prefers-reduced-motion: reduce` ปิดอนิเมชันและ `transform` ทั้งหมด

## Performance / Accessibility

- รูปทุกใบ `loading="lazy"` + กำหนด `width/height` กัน layout shift, ฟอนต์โหลดแบบไม่บล็อกการ render
- เคารพ `prefers-reduced-motion` (ปิดอนิเมชัน/autoplay ทั้งหมด)
- ปุ่มและช่องแตะทุกจุด ≥ 44px, มี `:focus-visible`, มี `alt` ของรูปเป็นชื่อเมนู
- รูปสินค้าถูกย่อให้ด้านยาวสุด 640px (พอสำหรับจอ retina 2x) และบีบอัดเป็น **WebP** — รวมทั้งเว็บ ~810 KB (เดิม ~4.9 MB) คงพื้นหลังโปร่งใสเหมือนเดิม
- ต้นฉบับ PNG/JPEG ความละเอียดเต็มเก็บไว้นอก repo ที่ `/root/menu-site/images-original/` ถ้าต้องการรูปใหญ่กว่าเดิม
- `logo.jpg` และ `favicon.png` คงนามสกุลเดิม ส่วนรูปสินค้าเป็น `.webp` — ถ้าเพิ่มรูปใหม่ในอนาคตให้ใช้ `.webp` แล้วใส่ path ใน `menu.json`
