# ระบบแจ้งรายการเงื่อนไขรายวิชา (Education Management System) — ฉบับปรับปรุง

เว็บแอปพลิเคชันจัดการการศึกษาสำหรับนิสิต / อาจารย์ / ผู้ดูแลระบบ
**Stack จริง:** Next.js 16 (App Router) · React 19 · Prisma 7 + PostgreSQL (Prisma Accelerate) · JWT (jose) · Tailwind CSS

> หมายเหตุ: เอกสาร TOR/Proposal เดิมระบุ T3.gg + tRPC + NextAuth + MySQL แต่โค้ดจริงใช้ REST API routes + custom JWT + PostgreSQL ดูรายละเอียดใน `COMPARISON.md`

---

## การติดตั้ง (Setup)

1. ติดตั้ง dependencies
   ```bash
   npm install
   ```

2. ตั้งค่า environment
   ```bash
   cp .env.example .env
   # แก้ค่าใน .env ให้ครบ โดยเฉพาะ:
   #   DATABASE_URL  (Prisma Accelerate หรือ PostgreSQL URL)
   #   JWT_SECRET    (สร้างด้วย: openssl rand -base64 48)
   ```

3. สร้าง Prisma client + push schema ขึ้น database
   ```bash
   npx prisma generate
   npm run db:push
   ```

4. สร้างบัญชี admin เริ่มต้น
   ```bash
   npm run seed:admin
   # อ่านค่า ADMIN_EMAIL / ADMIN_PASSWORD จาก .env
   ```

5. (ตัวเลือก) โหลดข้อมูลตัวอย่างสำหรับ demo
   ```bash
   npm run seed:demo
   ```

6. รันโปรเจกต์
   ```bash
   npm run dev
   ```

---

## บัญชีสำหรับ Demo (หลังรัน `npm run seed:demo`)

รหัสผ่านของทุกบัญชี demo = `demo1234` (ตั้งค่าได้ผ่าน `DEMO_PASSWORD` ใน `.env`)

| บทบาท | อีเมล | หมายเหตุ |
|---|---|---|
| ผู้ดูแลระบบ | `admin@ku.ac.th` | จาก `seed:admin` (รหัสตาม `.env`) |
| อาจารย์ | `somchai@ku.ac.th` | สอนวิชาโครงสร้างข้อมูล 2 กลุ่ม (คนละหลักสูตร) |
| นิสิต A | `student.a@ku.ac.th` | หลักสูตร พ.ศ. 2560 |
| นิสิต B | `student.b@ku.ac.th` | หลักสูตร พ.ศ. 2565 |

**Flow สาธิตที่แนะนำ**
- ล็อกอินเป็นอาจารย์ → หน้า "นัดสอนชดเชย" → เลือกวิชาโครงสร้างข้อมูล → เห็นตารางเรียนของนิสิตทั้งสองหลักสูตร (แสดงวันเป็นภาษาไทยถูกต้อง)
- ล็อกอินเป็นนิสิต A → หน้า "ตรวจสอบจบ" → เห็นสถานะ ผ่าน / กำลังเรียน / ต้องเรียนซ้ำ / ยังไม่ลง แยกตามหลักสูตร 2560
- สมัครสมาชิกใหม่ → บัญชีขึ้นสถานะ "รออนุมัติ" → ล็อกอินเป็น admin → หน้า "จัดการผู้ใช้" → กดอนุมัติ → บัญชีใหม่ล็อกอินได้

---

## ⚠️ ความปลอดภัย (สำคัญมาก)

ไฟล์ `.env` เดิมที่มี **credentials จริง** (Prisma Accelerate key, MailerSend key/secret) เคยถูก commit ขึ้น public repository ต้องดำเนินการ:

1. **Rotate keys ทั้งหมดทันที** ที่ Prisma Console และ MailerSend — key เก่าหลุดไปแล้วใน git history
2. `.env` ถูกเพิ่มใน `.gitignore` แล้ว ใช้ `.env.example` เป็น template แทน
3. ตั้ง `JWT_SECRET` ที่แข็งแรงเสมอ (production จะไม่ start ถ้าไม่มี)
