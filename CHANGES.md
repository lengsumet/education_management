# สรุปการแก้ไข/เพิ่มเติมระบบ (Education Management System)

> ปิดช่องโหว่ประเภท **"สเปคบอกว่าทำได้ แต่โค้ดจริงยัง mock / ขาด / ไม่ตรง"** ครบทั้ง 3 บทบาท (นิสิต / อาจารย์ / แอดมิน)
> ทุกการแก้ผ่าน 3 ชั้น: schema (`prisma db push` + `generate`) → API → UI + sync `database-schema.sql` + type-check สะอาด + verify กับ MySQL จริง — วันที่: 2026-07-05

---

## 1. ภาพรวม — เก็บครบ 8/8 จุด

| # | จุด (อ้างอิงสเปค) | บทบาท | เดิม | ตอนนี้ | รอบ |
|---|---|---|---|---|---|
| 1 | 3.3 จัดการประกาศรายวิชา | อาจารย์ | ไม่มีเลย (admin-only) | สร้าง/ลบ/แก้/ดู ต่อวิชา + แจ้งเตือนนิสิต | 1 |
| 2 | 3.3 ดูประกาศรายวิชา | นิสิต | API คืน `[]` เสมอ | คืนประกาศจริงต่อวิชา | 1 |
| 3 | ของปลอมในหน้าวิชา | อาจารย์ | ประกาศ=`Math.random()`, ชั่วโมงเรียน=hardcode 15 | นับ/คำนวณจริงจาก DB | 1 |
| 4 | 8.2 ที่อยู่ | นิสิต | input มีแต่ไม่บันทึก | เพิ่ม field + persist | 2 |
| 5 | 6.2 ห้องทำงาน | อาจารย์ | ไม่มี field | เพิ่ม field + UI + persist | 2 |
| 6 | 2.3 เกรดเฉลี่ยรายวิชา | อาจารย์ | มีแค่ค่าเฉลี่ยรวม | แยกเกรดเฉลี่ยรายวิชา | 3 |
| 7 | 7.1 ตารางเรียน | นิสิต | list ธรรมดา | grid รายสัปดาห์ (มีแกนเวลา) | 4 |
| 8 | 3.4 ตารางสอน | อาจารย์ | ไม่มีหน้า | หน้าตารางสอน grid ใหม่ | 4 |

---

## 2. รายการไฟล์ที่แตะทั้งหมด

### ไฟล์ใหม่ (5)

| ไฟล์ | หน้าที่ | จุด |
|---|---|---|
| `app/api/announcements/teacher/route.ts` | ประกาศรายวิชา (อาจารย์) CRUD + ตรวจสิทธิ์ section | 1 |
| `app/api/schedule/teacher/route.ts` | คืนคาบสอนของอาจารย์ | 8 |
| `app/schedule/page.tsx` | หน้า "ตารางสอน" อาจารย์ | 8 |
| `src/components/WeeklyTimetable.tsx` | component ตารางสัปดาห์ (ใช้ร่วมนิสิต/อาจารย์) | 7, 8 |
| `CHANGES.md` | ไฟล์นี้ | — |

### ไฟล์ที่แก้ไข (14)

| ไฟล์ | ประเภท | สิ่งที่แก้ | จุด |
|---|---|---|---|
| `prisma/schema.prisma` | schema | + `Announcement.sectionId`, `User.address`, `Teacher.officeRoom` + relations | 1,2,4,5 |
| `database-schema.sql` | schema | sync: `section_id`, `address`, `office_room` | 1,4,5 |
| `middleware.ts` | route | + `"/schedule": ["teacher"]` | 8 |
| `src/components/Layout.tsx` | UI | + เมนู "ตารางสอน" ใน sidebar อาจารย์ | 8 |
| `app/api/courses/teacher/route.ts` | API | แก้ของปลอม (ประกาศ/ชั่วโมงเรียน) + ส่ง `sectionId` | 3,1 |
| `app/api/courses/student/route.ts` | API | คืนประกาศรายวิชาจริง (query เดียว กัน N+1) | 2 |
| `app/api/dashboard/teacher/route.ts` | API | เกรดเฉลี่ยรายวิชา + helper `labelFromAvg` | 6 |
| `app/api/profile/student/route.ts` | API | persist `address` (GET+PATCH) | 4 |
| `app/api/profile/teacher/route.ts` | API | persist `officeRoom` (GET+PATCH) | 5 |
| `app/courses/_variants/teacher.tsx` | UI | ปุ่ม + modal จัดการประกาศ | 1 |
| `app/dashboard/_variants/teacher.tsx` | UI | คอลัมน์ "เกรดเฉลี่ย" รายวิชา | 6 |
| `app/profile/_variants/student.tsx` | UI | ส่ง `address` ใน payload | 4 |
| `app/profile/_variants/teacher.tsx` | UI | ฟิลด์ "ห้องทำงาน" (ดู+แก้) | 5 |
| `app/schedule-submit/page.tsx` | UI | ปุ่มสลับ grid/list + WeeklyTimetable | 7 |

---

## 3. รายละเอียดการเปลี่ยน schema

| Model / Table | ฟิลด์ที่เพิ่ม | ชนิด | เหตุผล |
|---|---|---|---|
| `Announcement` / `announcements` | `sectionId` / `section_id` | `Int?` nullable + FK cascade | null=ประกาศทั่วไป (เดิม), มีค่า=ประกาศของกลุ่มเรียน |
| `CourseSection` | `announcements` | relation `Announcement[]` | ให้ `_count.announcements` นับได้ |
| `User` / `users` | `address` | `VARCHAR(300)` | ที่อยู่ (ใช้ร่วมนิสิต/อาจารย์) |
| `Teacher` / `teachers` | `officeRoom` / `office_room` | `VARCHAR(100)` | ห้องทำงานอาจารย์ |

---

## 4. การตรวจสอบ (verification)

| ด้าน | ผล |
|---|---|
| Type-check (`tsc --noEmit`) | สะอาด (เหลือแค่ error เดิม `vitest` ในไฟล์ `.spec.ts` ไม่เกี่ยวกับงานนี้) |
| ประกาศ (MySQL จริง) | create → teacher เห็น → `_count` อัปเดต → นิสิตเห็นเฉพาะเผยแพร่ → ลบสะอาด |
| โปรไฟล์ (MySQL จริง) | write → read → revert ทั้ง `address` และ `officeRoom` |
| เกรดเฉลี่ย (MySQL จริง) | per-course ต่างจากค่ารวมชัดเจน (A/B+/F/"-" vs ค่ารวม B) |
| ตารางสัปดาห์ (MySQL จริง) | time string `th-TH` parse เข้า grid ได้ครบ 5/5 คาบ |
| ยังไม่ได้ทำ | เปิด browser จริงดู grid render ด้วยตา (verify แค่ระดับ data+logic+type) |

---

## 5. หมายเหตุการรันในเครื่อง (dev)

| ขั้นตอน | คำสั่ง / หมายเหตุ |
|---|---|
| Node version | `export PATH="/c/Users/User/AppData/Roaming/nvm/v20.19.0:$PATH"` (Prisma 7 ไม่รองรับ 22.11) |
| Database | MySQL 8 ผ่าน Docker (container `edu-mysql`), `DATABASE_URL` ใน `.env` |
| Sync schema | `npx prisma db push` (โปรเจกต์นี้ใช้ db push ไม่ใช่ migrations) |
| Generate client | `npx prisma generate` ⚠️ Prisma 7: db push ไม่ auto-generate ต้องรันเอง |
