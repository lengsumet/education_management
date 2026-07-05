# เปรียบเทียบ TOR / Proposal กับโค้ดจริง

อ้างอิงจากเอกสาร `TOR`, `Proposal` และรายงาน 5 บท ที่แนบมา เทียบกับสิ่งที่โค้ดทำได้จริง
สรุปว่าตรงไหน **ทำได้ตามเอกสาร / ทำได้เกิน / ทำได้ขาด / เอกสารไม่ตรงกับโค้ด**

---

## 1. โค้ดทำได้ตาม TOR/Proposal (ครบ)

**นิสิต:** login, dashboard (รายวิชา+สถิติ), ดูรายวิชาที่ลงทะเบียน+เกรด, วางแผนการเรียน (Course Planner), ตรวจสอบสถานะลงทะเบียน, ตรวจสอบจบ, ตารางเรียน+แจ้งเตือน, จัดการโปรไฟล์, logout

**อาจารย์:** login, dashboard, จัดการรายวิชา, ดูรายชื่อนิสิต (ค้นหา+กรอง+export CSV), จัดการเรียนชดเชย, กรอกคะแนน/ตัดเกรด (US-TCH-4.x), โปรไฟล์, logout

**แอดมิน:** login, dashboard, จัดการผู้ใช้ (ค้นหา+เพิ่ม/แก้/ลบ+export), นำเข้าข้อมูล CSV (+template+log), จัดการหลักสูตร, ประกาศ (เลือกกลุ่มเป้าหมาย+ปักหมุด)

---

## 2. โค้ดทำได้ "เกิน" TOR/Proposal

| ฟีเจอร์ | หมายเหตุ |
|---|---|
| Course Catalog + Prerequisites API | มีระบบวิชาก่อน-หลัง (`course_prerequisites`) และ API `/api/prerequisites` ที่ TOR ไม่ได้ระบุ |
| Registration approval (การลงทะเบียนวิชา) | มีสถานะ อนุมัติ/รออนุมัติ/ปฏิเสธ สำหรับการลงทะเบียน แยกจาก approval บัญชี |
| Schedule submit (นิสิตส่งตาราง) | `/api/schedule-submit/student` ไม่มีใน TOR |
| Avatar upload | อัปโหลดรูปโปรไฟล์ + serve ผ่าน `/api/uploads/[filename]` |
| Import log ละเอียด | แยก created/updated/error rows ต่อการนำเข้า (ละเอียดกว่าที่ Proposal ระบุ) |
| **ระบบสมัครแบบรออนุมัติบัญชี (เพิ่มในฉบับปรับปรุง)** | ตรงกับที่ตกลงกันเพิ่มเติม (ไม่ได้อยู่ใน TOR เดิม) |

---

## 3. โค้ดทำได้ "ขาด" หรือไม่สมบูรณ์เทียบกับ TOR/Proposal

| หัวข้อในเอกสาร | สถานะในโค้ด |
|---|---|
| TOR ข้อ 8 นิสิต — "ดาวน์โหลดแผนการเรียน" (Course Planner download) | มีปุ่มดาวน์โหลดใน UI แต่ควรตรวจว่า export ครบจริง (html2pdf.js ถูก include ไว้) |
| TOR 5.3 อาจารย์ — "ตรวจสอบตารางว่างของนิสิต" | เดิมแสดงผิด (วันขึ้น "ไม่ระบุ") — **แก้แล้วในฉบับปรับปรุง** ให้แสดงตารางเด็กในวิชาถูกต้อง |
| Proposal US-STU-3.x — Course Plan status (planned/completed/skipped) | schema `course_plans` มีครบ แต่ควรตรวจว่า UI อัปเดตสถานะได้ครบทุกค่า |
| หน้า "ตรวจสอบจบ — ดาวน์โหลดรายงาน" | ปุ่มมีอยู่แต่ยังไม่ผูก handler (เป็น placeholder) — ยังไม่ได้ทำในรอบนี้ |

> ข้อที่ยังเป็น placeholder (ปุ่มดาวน์โหลดรายงานตรวจจบ) ไม่อยู่ใน scope ที่ตกลงรอบนี้ — บันทึกไว้เป็นงานถัดไป

---

## 4. เอกสารไม่ตรงกับโค้ดจริง (ต้องแก้ "เล่มรายงาน" ไม่ใช่แก้โค้ด)

นี่คือจุดเสี่ยงที่สุดถ้ากรรมการเปิดโค้ดดูตอนพรีเซนต์ เพราะ TOR/Proposal/รายงาน เขียน stack ไม่ตรงกับของจริง:

| เอกสารเขียนว่า | โค้ดจริงใช้ |
|---|---|
| T3.gg (Framework) | ไม่ได้ใช้ T3 stack — เป็น Next.js App Router ธรรมดา |
| tRPC (type-safe API) | ใช้ REST API routes (`app/api/**/route.ts`) ไม่มี tRPC |
| NextAuth.js (authentication) | ใช้ custom JWT ด้วย `jose` + bcrypt เอง ไม่มี NextAuth |
| MySQL + XAMPP + phpMyAdmin | ใช้ **PostgreSQL** ผ่าน Prisma Accelerate (cloud) ไม่มี XAMPP/MySQL |
| Server-Side Rendering (เน้นใน TOR) | ส่วนใหญ่เป็น client component + REST fetch (CSR) |

**คำแนะนำ:** แก้บท "อุปกรณ์และเทคโนโลยี" + "ทบทวนวรรณกรรม" ในเล่มให้ตรงกับโค้ดจริง (Next.js / Prisma / PostgreSQL / JWT) ก่อนพรีเซนต์ มิฉะนั้นจะตอบคำถามกรรมการลำบาก งานแก้เล่มนี้อยู่นอก scope การแก้โค้ด

---

## 5. สรุปตาราง Requirement Coverage

| กลุ่ม | ครบ | เกิน | ขาด/placeholder |
|---|---|---|---|
| นิสิต | ~95% | Schedule submit, Avatar | ปุ่มดาวน์โหลดรายงานตรวจจบ |
| อาจารย์ | 100% (หลังแก้ makeup) | — | — |
| แอดมิน | 100% | Import log ละเอียด, Prerequisites | — |
| Auth | 100% (หลังเพิ่ม approval) | ระบบรออนุมัติบัญชี | — |
