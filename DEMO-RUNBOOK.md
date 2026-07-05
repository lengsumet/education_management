# คู่มืออัดวิดีโอ Demo — Education Management System

> ล้าง DB + สร้างโลก demo สะอาด (4 users) แล้วเดิน demo ตามเส้นทางข้อมูล **admin → อาจารย์ → นิสิต** เพื่อโชว์ cause→effect ข้ามบทบาท
> ทุกขั้นตอนระบุ **API + ตาราง DB** ที่โดน

---

## 0. เตรียมก่อนถ่าย

```bash
export PATH="/c/Users/User/AppData/Roaming/nvm/v20.19.0:$PATH"
cd "c:/Users/User/Downloads/Work/Education-Management-System-improved"

npx tsx seed-video-demo.ts   # ล้าง DB + สร้างข้อมูล demo (รันซ้ำเพื่อ reset ได้ทุกเมื่อ)
npm run build && npm run start   # ถ้ายังไม่ได้รัน server (หรือ npm run dev สำหรับ hot-reload)
```

เปิด **3 หน้าต่าง browser (คนละ profile/incognito)** ค้าง login ไว้ทั้ง 3 บทบาท เพื่อสลับโชว์เร็ว ๆ

### บัญชีทดสอบ (รหัสผ่านทุกคน: `demo1234`)
| บทบาท | อีเมล | ข้อมูล |
|---|---|---|
| แอดมิน | `admin@ku.ac.th` | ผู้ดูแล ระบบ |
| อาจารย์ | `teacher@ku.ac.th` | สมชาย ใจดี (T60001, ห้อง อาคาร 15 ห้อง 302) |
| นิสิต รหัส 60 | `student60@ku.ac.th` | กานดา ศรีสุข (6021450001, หลักสูตร 2560) |
| นิสิต รหัส 65 | `student65@ku.ac.th` | ภาสกร แสงทอง (6521450001, หลักสูตร 2565) |

### สถานะเริ่มต้น (มีข้อมูลแล้ว / เว้นไว้โชว์สด)
| มีข้อมูลแล้ว | เว้นว่างไว้ทำสดในวิดีโอ |
|---|---|
| **หลักสูตร CS จริงของ มก. 2560 & 2565** (รายวิชา+แผน 4 ปีจริงจาก PDF, 31 วิชา, 50 mapping) | **ประกาศรายวิชา** (อาจารย์สร้างสด) |
| นิสิตลงเรียน+มีเกรดจริง: student65 ผ่าน 11 วิชา/กำลังเรียน 2, student60 (รหัส 60) | **นัดสอนชดเชย** (อาจารย์สร้างสด) |
| อ.สมชายสอนภาคปัจจุบัน 3 วิชา (01418221/01418231/01418321) ตารางเรียน จ./พ. | **วิชา 01418321** ไม่มีตาราง → โชว์ "เพิ่มวันสอน" |
| เกรดวิชา 01418221 ภาคปัจจุบัน (A / B+) → เกรดเฉลี่ยรายวิชามีค่า | import CSV (ชุดไฟล์ด้านล่าง) |

---

## 1. ไฟล์สำหรับ Demo Import (โฟลเดอร์ `demo-import/`)

Import **ตามลำดับเลข** (บางไฟล์ต้องมาก่อน เช่น courses ต้องก่อน registration)
วิธี import: หน้า **แอดมิน → นำเข้าข้อมูล** → เลือกประเภท → อัปโหลดไฟล์

| ลำดับ | ไฟล์ | เลือกประเภท | โชว์อะไร | ผลที่ทดสอบแล้ว |
|---|---|---|---|---|
| 1 | `1_teachers.csv` | อาจารย์ | เพิ่มอาจารย์ใหม่ 1 คน | created 1 |
| 2 | `2_students.csv` | นิสิต | เพิ่มนิสิตใหม่ 2 คน (รหัส 66) | created 2 |
| 3 | `3_courses.csv` | วิชา | เพิ่ม 2 วิชา + สร้าง section + ตารางให้ อ.สมชาย | created 2 |
| 4 | `4_curriculum_2569.csv` | หลักสูตร | สร้าง **หลักสูตร 2569 ใหม่อัตโนมัติ** + วิชาในหลักสูตร | created 4 |
| 5 | `5_curriculum_BAD_year.csv` | หลักสูตร | **โชว์ validation**: ไม่กรอกปีหลักสูตร → ปฏิเสธ | **error 2, success 0** ✅ |
| 6 | `6_registration.csv` | การลงทะเบียน | ลงทะเบียนนิสิตเข้าวิชาที่เพิ่ง import (ต้องหลังไฟล์ 3) | created 2 |
| 7 | `7_grades.csv` | เกรด | ใส่เกรดให้ enrollment ที่มีอยู่ (student65 วิชา 01418231) | success 1 |

> ⭐ **จุดขายในวิดีโอ:** ไฟล์ 4 กับ 5 คู่กัน — 4 สร้างหลักสูตรตามปีที่ระบุ, 5 โชว์ว่า**ถ้าไม่ระบุปีหลักสูตรระบบปฏิเสธ ไม่ลงมั่วหลักสูตรผิด** (จุดที่เพิ่งแก้)

> ⚠️ **หลัง demo import ต้อง `npx tsx seed-video-demo.ts` อีกครั้งเพื่อ reset** ถ้าจะถ่ายซ้ำ

**API + ตารางของหน้า Import:** `POST /api/import/admin`
→ ตาราง: `import_logs` + (ตามชนิด) `users`,`students`,`teachers`,`courses`,`course_sections`,`schedules`,`curriculums`,`curriculum_courses`,`enrollments`

---

## 2. เดิน Demo ตามบทบาท (พร้อม API + ตาราง)

### 🔐 Login (ทุกบทบาท)
| ทำอะไร | API | ตาราง |
|---|---|---|
| กรอกอีเมล/รหัส เข้าสู่ระบบ | `POST /api/auth/login` | `users`, `students`/`teachers` |
| (โชว์กันสิทธิ์) พิมพ์ URL หน้าที่ไม่มีสิทธิ์ → เด้งกลับ | `middleware.ts` (ตรวจ JWT) | — |

### 🛠️ ตอน A — แอดมิน (`admin@ku.ac.th`)
| ขั้นตอน | API | ตาราง |
|---|---|---|
| ดู Dashboard (จำนวนผู้ใช้/วิชา/นิสิต) | `GET /api/dashboard/admin` | `users`,`courses`,`students` |
| จัดการผู้ใช้ → ค้นหา/เพิ่ม/แก้/ลบ/ส่งออก CSV | `/api/users/admin` (GET/POST/PATCH/DELETE) | `users`,`students`,`teachers`,`notifications` |
| **นำเข้าข้อมูล** → import ไฟล์ 1–7 (ดูตารางข้อ 1) | `POST /api/import/admin` | `import_logs` + ตารางตามชนิด |
| ดาวน์โหลด Template + ดูประวัติ import | `GET /api/import/admin` | `import_logs` |
| จัดการหลักสูตร → ดู/แก้แผน + เพิ่ม/ลบวิชา | `/api/curriculum/admin` | `curriculums`,`curriculum_courses`,`courses` |

### 👨‍🏫 ตอน B — อาจารย์ (`teacher@ku.ac.th`)
| ขั้นตอน | API | ตาราง |
|---|---|---|
| Dashboard → ตาราง "วิชาของฉัน" มีคอลัมน์ **เกรดเฉลี่ยรายวิชา** (01418221 มีค่า, วิชาอื่น "-") | `GET /api/dashboard/teacher` | `teachers`,`course_sections`,`courses`,`semesters`,`enrollments`,`announcements` |
| รายชื่อนิสิต → ค้นหา/กรองตามวิชา/ให้เกรด/ส่งออก CSV | `/api/students/teacher` (GET/PATCH) | `enrollments`,`students`,`users`,`course_sections` |
| วิชาของฉัน → **จัดการประกาศ** (สร้างประกาศสด) | `POST /api/announcements/teacher` | `announcements`,`course_sections`,`enrollments`,`notifications` |
| **ตารางสอน** (grid) → **เพิ่มวันสอน** ให้ 01418331 | `GET/POST /api/schedule/teacher` | `course_sections`,`schedules`,`enrollments` |
| นัดสอนชดเชย (สร้างสด → ส่งหานิสิต) | `/api/makeup-class/teacher` | `makeup_classes`,`enrollments`,`students`,`notifications` |
| โปรไฟล์ → แก้ **ห้องทำงาน** | `/api/profile/teacher` (GET/PATCH) | `teachers`,`users` |

### 👨‍🎓 ตอน C — นิสิต (`student65@ku.ac.th` เป็นหลัก, สลับ `student60`)
| ขั้นตอน | API | ตาราง |
|---|---|---|
| Dashboard → วิชาที่ลง + สถิติ | `GET /api/dashboard/student` | `students`,`enrollments`,`courses`,`announcements`,`notifications` |
| วิชาของฉัน → เปิดวิชา → **tab ประกาศ** (เห็นที่อาจารย์เพิ่งโพสต์) | `GET /api/courses/student` | `students`,`enrollments`,`course_sections`,`courses`,`schedules`,`announcements` |
| **ตารางเรียน (grid)** → เห็นวันสอนที่อาจารย์เพิ่ง add | `GET /api/schedule-submit/student` | `enrollments`,`course_sections`,`schedules`,`makeup_classes` |
| แจ้งเตือน **นัดสอนชดเชย** (ที่อาจารย์สร้าง) | (หน้าเดียวกัน) | `makeup_classes`,`notifications` |
| วางแผนเรียน → เลือกภาค/เพิ่ม-ลบวิชา/ดาวน์โหลด | `/api/course-planner/student` | `course_plans`,`courses`,`course_prerequisites`,`curriculums` |
| ตรวจสอบจบ (เทียบหลักสูตร 2565) | `/api/graduation-check/student` + `/api/prerequisites` | `students`,`curriculums`,`courses`,`course_prerequisites` |
| โปรไฟล์ → แก้ **ที่อยู่** | `/api/profile/student` (GET/PATCH) | `students`,`users` |
| ออกจากระบบ | `POST /api/auth/logout` | `users` (ล้าง cookie) |

---

## 3. ลำดับ "จุดพีค" cause→effect (แนะนำให้ถ่ายต่อเนื่อง)
1. **อาจารย์** สร้างประกาศวิชา 01418221 → สลับไป **นิสิต65** เปิดวิชา 01418221 tab ประกาศ → **เห็นทันที** (`announcements` ผูก sectionId)
2. **อาจารย์** เพิ่มวันสอนให้ 01418331 → สลับไป **นิสิต65** หน้าตารางเรียน → **วิชาโผล่ใน grid** (`schedules`)
3. **อาจารย์** สร้างนัดสอนชดเชย → **นิสิต** เห็นการ์ดแจ้งเตือน (`makeup_classes` + `notifications`)
4. **อาจารย์** ให้เกรดในหน้ารายชื่อนิสิต → **นิสิต** เห็นเกรดใน Dashboard/วิชา + **อาจารย์** เห็นเกรดเฉลี่ยรายวิชาอัปเดต (`enrollments`)

---

## 4. Stack (พูดสั้น ๆ ตอนต้นวิดีโอ)
- **Frontend/Backend:** Next.js 16 (App Router + Route Handlers) — API อยู่ใน `app/api/**`
- **DB:** MySQL 8 ผ่าน Prisma 7 (mariadb adapter)
- **Auth:** JWT (jose) ใน httpOnly cookie — กันสิทธิ์ 2 ชั้น: `middleware.ts` ระดับหน้า + เช็ค `role` ในทุก API
- **หลักการ:** config-driven (สถานะ/หลักสูตร dynamic), หลาย feature ผูกกันข้ามบทบาทผ่านตารางกลาง `announcements`/`schedules`/`enrollments`/`notifications`

---

## 5. Reset ระหว่างถ่าย
```bash
npx tsx seed-video-demo.ts   # กลับสู่สถานะสะอาดทุกเมื่อ (idempotent)
```
