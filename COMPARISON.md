# เอกสารเปรียบเทียบ: ต้นฉบับ vs ฉบับปรับปรุง

ระบบแจ้งรายการเงื่อนไขรายวิชา (Education Management System)
เปรียบเทียบจาก repository ต้นฉบับ `Jakprim-2004/Education-Management-System` กับฉบับที่แก้ไขในโฟลเดอร์นี้

---

## ส่วนที่ 1 — สรุปสิ่งที่แก้ไข (Bug Fixes)

| # | จุดที่แก้ | อาการเดิม (Bug) | สิ่งที่แก้ | ไฟล์ |
|---|---|---|---|---|
| 1 | ตารางเรียนใน "นัดสอนชดเชย" | map วันด้วย key `"monday"` แต่ DB เก็บ enum `MON` → `.toLowerCase()` = `"mon"` ไม่ match → วันขึ้น "ไม่ระบุ" ทุกแถว | สร้าง helper กลาง `thaiDayFromEnum()` แปลง `MON→จันทร์` ถูกต้อง | `src/lib/schedule.ts`, `app/api/makeup-class/teacher/route.ts` |
| 2 | รายชื่อนิสิตในนัดสอนชดเชย | ดึงเด็ก**ทุก section**ที่ครูสอนมารวมกัน ไม่กรองตามวิชาที่กำลังนัด (ผิด requirement "ต้องเป็นเด็กในชั้นเรียนที่ลงวิชานี้แล้ว") | จัดกลุ่มนิสิตราย section, ส่ง `students` ผูกกับแต่ละ section | `app/api/makeup-class/teacher/route.ts`, `app/makeup-class/teacher/page.tsx` |
| 3 | ตรวจสอบจบ (Graduation Check) | นับ "มีเกรด (ไม่ใช่ -)" = ผ่าน → **เกรด F / W ถูกนับเป็นผ่าน**และรวมหน่วยกิต | สร้าง `isPassingGrade()` แยกเกรดผ่าน (A–D) ออกจาก F/W/I → เพิ่มสถานะ "ต้องเรียนซ้ำ" | `src/lib/grade.ts`, `app/api/graduation-check/student/route.ts` |
| 4 | Dashboard นิสิต (หน่วยกิตที่ได้) | นับหน่วยกิตจาก `status==="completed"` โดยไม่ดูเกรด → completed ที่ติด F ก็ยังนับ | ใช้ `classifyEnrollment()` นับเฉพาะเกรดผ่านจริง | `app/api/dashboard/student/route.ts` |
| 5 | Login | ไม่เช็ค `isActive` → บัญชีที่ถูกระงับยังล็อกอินได้ | เพิ่มการเช็ค `isActive` + สถานะอนุมัติก่อนออก token | `app/api/auth/login/route.ts` |
| 6 | Forgot Password | ตอบ 404 เมื่อไม่พบอีเมล (email enumeration), token ใช้ `Math.random()` (เดาได้), URL hardcode `localhost:3000` | ตอบข้อความกลางเสมอ (กันการเดาว่ามีบัญชีไหม), token ใช้ `crypto.randomBytes`, URL อ่านจาก `APP_BASE_URL`/origin | `app/api/auth/forgot-password/route.ts`, `src/lib/auth.ts` |
| 7 | JWT Secret | มี fallback hardcode `'super-secret-key-1234567890'` ในโค้ด | production จะ throw ถ้าไม่มี `JWT_SECRET`; dev มี fallback ที่ label ชัดว่า insecure | `src/lib/auth.ts` |
| 8 | Register | สร้าง department ขยะ "Faculty of Defaults" อัตโนมัติ, เซ็ต `admissionYear` เป็น ค.ศ. (2026) ผิดจากข้อมูลหลักสูตรที่เป็น พ.ศ. | ใช้สาขาจริง/สาขาแรกในระบบ, เก็บ `admissionYear` เป็น พ.ศ. (+543) | `app/api/auth/register/route.ts` |
| 9 | Grade GET (ครู) | คืนค่า `"Waiting"` เป็นสตริงเกรด (ไม่ใช่เกรดจริง ปนใน data model) | คืน `"-"` แทน; UI รองรับทั้งสองแบบ | `app/api/students/teacher/route.ts`, `app/students/teacher/page.tsx` |
| 10 | Grade PATCH (ครู) | บันทึกเกรดแล้วไม่ set `status: completed` → status ไม่ตรงกับเกรด | เมื่อมีเกรดสุดท้าย set `status="completed"` sync กับเกรด | `app/api/students/teacher/route.ts` |
| 11 | create-admin | รหัส admin เริ่มต้น hardcode = `admin`, ไม่ตั้งสถานะอนุมัติ | อ่านรหัสจาก `ADMIN_PASSWORD` env, set `approvalStatus: approved` | `create-admin.ts` |
| 12 | Makeup POST authz | ไม่เช็คว่า section เป็นของครูคนนั้นจริง → ครูส่ง sectionId ของคนอื่นได้ (IDOR) | เพิ่มเช็ค `section.teacherId === teacher.id` | `app/api/makeup-class/teacher/route.ts` |
| 13 | Makeup `originalDate` | เซ็ตเป็น `new Date()` (วันนี้เสมอ) → "วันเดิมที่งดสอน" แสดงมั่ว | เพิ่มช่องกรอกวันเดิม (ไม่บังคับ), ส่งค่าจริงเข้า DB | `app/makeup-class/teacher/page.tsx`, `app/api/makeup-class/teacher/route.ts` |
| 14 | Type error (พบระหว่างแก้) | `sort((a,b)=>b-a)` บน Set ที่ TS อนุมานชนิดไม่ได้ | ระบุชนิด `number` ชัดเจน | `app/api/courses/teacher/route.ts`, `app/api/dashboard/teacher/route.ts` |

---

## ส่วนที่ 2 — ฟีเจอร์ใหม่ที่เพิ่ม (New Features)

### 2.1 ระบบสมัครสมาชิกแบบรออนุมัติ (Approval Registration Flow)
- เพิ่ม enum `ApprovalStatus (pending / approved / rejected)` และ field `approvalStatus`, `approvedAt`, `approvedBy` ใน `User` (schema)
- สมัครใหม่ → `approvalStatus = pending`, `isActive = false` → **ล็อกอินไม่ได้จนกว่าแอดมินอนุมัติ**
- Login ตอบข้อความต่างกันตามสถานะ (รออนุมัติ / ถูกปฏิเสธ / ถูกระงับ)
- หน้า Admin "จัดการผู้ใช้" มีกล่อง **"บัญชีรอการอนุมัติ"** พร้อมปุ่มอนุมัติ/ปฏิเสธ + ส่ง notification แจ้งผู้ใช้
- บัญชีที่ admin สร้างเองถือว่า approved อัตโนมัติ

ไฟล์: `prisma/schema.prisma`, `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts`, `app/api/users/admin/route.ts`, `app/users/admin/page.tsx`, `app/register/page.tsx`

### 2.2 ข้อมูลตัวอย่างสำหรับ Demo (`seed-demo.ts`)
- 2 หลักสูตร: พ.ศ. 2560 และ พ.ศ. 2565 (course catalog เดียวกัน แต่แยก curriculum ตามรุ่น)
- อาจารย์ 1 คน (อ.สมชาย) สอนวิชา**โครงสร้างข้อมูลเดียวกัน 2 กลุ่ม** — กลุ่ม 1 = รุ่น 2560, กลุ่ม 2 = รุ่น 2565
- นิสิต demo 2 คน: A (2560) และ B (2565) ทั้งคู่ลงวิชาของ อ.สมชาย (คนละกลุ่ม) → ครูเห็นทั้งคู่ในนัดสอนชดเชย
- เพื่อนร่วมชั้น mock อีกหลายคน (เป็นข้อมูลประกอบ)
- เกรดบางส่วนถูก seed ให้ครบทุกสถานะ (ผ่าน / กำลังเรียน / ต้องเรียนซ้ำ / ยังไม่ลง) เพื่อโชว์หน้าตรวจสอบจบ
- ตารางเรียนครบพอให้ demo การหาวันว่างนัดชดเชย

### 2.3 Helper กลาง (ลด logic ซ้ำ / กันตัวเลขเพี้ยน)
- `src/lib/grade.ts` — แหล่งความจริงเดียวว่าเกรดไหนผ่าน/ไม่ผ่าน ใช้ทั้ง graduation-check และ dashboard
- `src/lib/schedule.ts` — แปลงวัน (enum→ไทย) และ format เวลา ใช้ร่วมกัน

### 2.4 ความปลอดภัยและการตั้งค่า
- ลบ `.env` ที่มี secret จริงออก, เพิ่ม `.env.example`, ใส่ `.env` ใน `.gitignore`
- เพิ่ม npm scripts: `seed:admin`, `seed:demo`, `db:push`
- README ใหม่พร้อมขั้นตอนติดตั้ง + บัญชี demo + คำเตือน rotate keys

---

## ส่วนที่ 3 — หมายเหตุการตรวจสอบ US-TCH-4.x (กรอกคะแนน/ตัดเกรด)

ตรวจของเดิมแล้วพบว่า **มีอยู่ครบและใช้งานได้จริง** ทั้ง API (`GET`/`PATCH` ใน `app/api/students/teacher/route.ts` — มี ownership check, validate เกรด, clamp คะแนน 0–100) และ UI (`app/students/teacher/page.tsx` — ช่องกรอกคะแนน 4 ช่อง, auto-คำนวณเกรด, ปุ่มบันทึก bulk, แสดงผลรวม)

จึง **ไม่สร้างซ้ำ** แต่แก้ bug 2 จุดที่พบ (ข้อ 9, 10 ในตารางด้านบน)

---

## ไฟล์ใหม่ที่เพิ่มเข้ามา

```
src/lib/grade.ts          — grade pass/fail helper
src/lib/schedule.ts       — day-of-week + time helper
seed-demo.ts              — demo data seeder
.env.example              — env template (แทน .env ที่มี secret)
COMPARISON.md             — เอกสารนี้
TOR_GAP_ANALYSIS.md       — เปรียบเทียบ TOR/Proposal กับโค้ดจริง
```

## ไฟล์ที่ลบออก (debug scripts ส่วนตัว ไม่เกี่ยวกับระบบ)

```
check-db.ts, check-grades-match.ts, complete-student.ts, find-kitti.ts, reset-data.ts, .env
```
