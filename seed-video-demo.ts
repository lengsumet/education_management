/**
 * Video-demo seed. CLEARS the whole database, then builds a clean world using
 * the REAL KU Computer-Science curricula (พ.ศ. 2560 & 2565):
 *   1 admin, 1 teacher, 2 students (รหัส 60 → หลักสูตร 2560, รหัส 65 → หลักสูตร 2565),
 *   real courses + real 4-year study plans, past-term graded enrolments (→ ผ่านแล้ว),
 *   current-term enrolments (→ กำลังเรียน), and one graded current course so the
 *   teacher's per-course grade average has data.
 *
 * Left EMPTY for live demo: announcements, makeup classes, and course 01418321
 * (current term) has NO schedule so "เพิ่มวันสอน" can be shown.
 *
 * NOTE: course.code is unique, so a few codes reused across the two curricula
 * with different meanings keep the 2565 definition (student65 is the main demo).
 *
 * Run:  export PATH=".../v20.19.0:$PATH" && npx tsx seed-video-demo.ts
 */
import 'dotenv/config';
import { PrismaClient, CourseType } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';

const dbUrl = process.env.DATABASE_URL ?? '';
const prisma = dbUrl.startsWith('prisma')
  ? new PrismaClient({ accelerateUrl: dbUrl })
  : new PrismaClient({ adapter: new PrismaMariaDb(dbUrl) });

const T = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const PASSWORD = 'demo1234';

// ── Real course catalogue (code → name, credits, type) ────────
type C = { name: string; credits: number; type: CourseType };
const CATALOG: Record<string, C> = {
  '01417111': { name: 'แคลคูลัส I', credits: 3, type: 'required' },
  '01417112': { name: 'แคลคูลัส II', credits: 3, type: 'required' },
  '01417322': { name: 'พีชคณิตเชิงเส้นพื้นฐาน', credits: 3, type: 'required' },
  '01422111': { name: 'หลักสถิติ', credits: 3, type: 'required' },
  '01999111': { name: 'ศาสตร์แห่งแผ่นดิน', credits: 2, type: 'general' },
  '01418111': { name: 'วิทยาการคอมพิวเตอร์เบื้องต้น', credits: 2, type: 'required' },
  '01418112': { name: 'แนวคิดการโปรแกรมเบื้องต้น', credits: 3, type: 'required' },
  '01418113': { name: 'การโปรแกรมคอมพิวเตอร์', credits: 3, type: 'required' },
  '01418114': { name: 'วิทยาการคอมพิวเตอร์เบื้องต้น', credits: 2, type: 'required' },
  '01418131': { name: 'การโปรแกรมทางสถิติ', credits: 3, type: 'required' },
  '01418132': { name: 'หลักมูลการคณนา', credits: 3, type: 'required' },
  '01418141': { name: 'ทรัพย์สินทางปัญญาและจรรยาบรรณวิชาชีพ', credits: 3, type: 'required' },
  '01418211': { name: 'การสร้างซอฟต์แวร์', credits: 3, type: 'required' },
  '01418221': { name: 'ระบบฐานข้อมูลเบื้องต้น', credits: 3, type: 'required' },
  '01418231': { name: 'โครงสร้างข้อมูลและขั้นตอนวิธี', credits: 3, type: 'required' },
  '01418232': { name: 'การออกแบบและวิเคราะห์ขั้นตอนวิธี', credits: 3, type: 'required' },
  '01418233': { name: 'สถาปัตยกรรมคอมพิวเตอร์', credits: 3, type: 'required' },
  '01418236': { name: 'ระบบปฏิบัติการ', credits: 3, type: 'required' },
  '01418261': { name: 'หลักพื้นฐานของปัญญาประดิษฐ์', credits: 3, type: 'required' },
  '01418321': { name: 'การวิเคราะห์และการออกแบบระบบ', credits: 3, type: 'required' },
  '01418331': { name: 'ทฤษฎีการคำนวณ', credits: 3, type: 'required' },
  '01418332': { name: 'ความมั่นคงในระบบสารสนเทศ', credits: 3, type: 'required' },
  '01418333': { name: 'ทฤษฎีออโตมาตา', credits: 2, type: 'required' },
  '01418334': { name: 'เทคนิคตัวแปลโปรแกรม', credits: 2, type: 'required' },
  '01418341': { name: 'ทรัพย์สินทางปัญญาและจรรยาบรรณวิชาชีพ', credits: 3, type: 'required' },
  '01418351': { name: 'หลักการการสื่อสารคอมพิวเตอร์และการประมวลผลบนคลาวด์', credits: 3, type: 'required' },
  '01418371': { name: 'การบริหารโครงการและสตาร์ทอัพดิจิทัล', credits: 3, type: 'required' },
  '01418390': { name: 'การเตรียมความพร้อมสหกิจศึกษา', credits: 1, type: 'required' },
  '01418497': { name: 'สัมมนา', credits: 1, type: 'required' },
  '01418490': { name: 'สหกิจศึกษา', credits: 6, type: 'required' },
  '01418499': { name: 'โครงงานวิทยาการคอมพิวเตอร์', credits: 3, type: 'required' },
};

// ── Real 4-year study plans: [code, yearLevel, semester] ──────
const PLAN_2560: [string, number, number][] = [
  ['01417111', 1, 1], ['01418112', 1, 1], ['01418114', 1, 1], ['01999111', 1, 1],
  ['01417112', 1, 2], ['01418113', 1, 2], ['01418132', 1, 2],
  ['01417322', 2, 1], ['01418211', 2, 1], ['01418231', 2, 1], ['01422111', 2, 1],
  ['01418221', 2, 2], ['01418232', 2, 2], ['01418233', 2, 2],
  ['01418321', 3, 1], ['01418331', 3, 1], ['01418341', 3, 1], ['01418497', 3, 1],
  ['01418332', 3, 2], ['01418333', 3, 2], ['01418334', 3, 2], ['01418351', 3, 2], ['01418390', 3, 2],
  ['01418490', 4, 1],
  ['01418499', 4, 2],
];
const PLAN_2565: [string, number, number][] = [
  ['01417111', 1, 1], ['01418111', 1, 1], ['01418112', 1, 1], ['01418141', 1, 1], ['01999111', 1, 1],
  ['01417322', 1, 2], ['01418113', 1, 2], ['01418131', 1, 2], ['01418132', 1, 2],
  ['01418211', 2, 1], ['01418231', 2, 1], ['01418233', 2, 1],
  ['01418221', 2, 2], ['01418232', 2, 2], ['01418236', 2, 2], ['01418261', 2, 2],
  ['01418321', 3, 1], ['01418331', 3, 1], ['01418351', 3, 1], ['01418390', 3, 1],
  ['01418332', 3, 2], ['01418371', 3, 2], ['01418497', 3, 2],
  ['01418490', 4, 1],
  ['01418499', 4, 2],
];

async function clearAll() {
  await prisma.notification.deleteMany();
  await prisma.importLog.deleteMany();
  await prisma.oTPVerification.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.makeupClass.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.coursePlan.deleteMany();
  await prisma.coursePrerequisite.deleteMany();
  await prisma.curriculumCourse.deleteMany();
  await prisma.courseSection.deleteMany();
  await prisma.course.deleteMany();
  await prisma.curriculum.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.semester.deleteMany();
  await prisma.department.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.user.deleteMany();
  console.log('✓ Database cleared');
}

async function main() {
  await clearAll();
  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── Foundations ────────────────────────────────────────────
  const faculty = await prisma.faculty.create({ data: { code: 'F01', name: 'คณะศิลปศาสตร์และวิทยาศาสตร์' } });
  const dept = await prisma.department.create({ data: { code: 'D01', name: 'วิทยาการคอมพิวเตอร์', facultyId: faculty.id } });

  const pastSem = await prisma.semester.create({
    data: { name: 'ภาคเรียนที่ 2/2567', academicYear: 2567, semesterNumber: 2,
      startDate: new Date('2024-11-01'), endDate: new Date('2025-03-31'), isCurrent: false },
  });
  const currentSem = await prisma.semester.create({
    data: { name: 'ภาคเรียนที่ 1/2568', academicYear: 2568, semesterNumber: 1,
      startDate: new Date('2025-06-01'), endDate: new Date('2025-10-31'), isCurrent: true,
      regOpenDate: new Date('2025-05-01'), regCloseDate: new Date('2025-06-15') },
  });

  // ── Curricula ──────────────────────────────────────────────
  const curr2560 = await prisma.curriculum.create({
    data: { year: 2560, name: 'หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์ พ.ศ. 2560', totalCredits: 128, departmentId: dept.id, status: 'active' },
  });
  const curr2565 = await prisma.curriculum.create({
    data: { year: 2565, name: 'หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์ พ.ศ. 2565', totalCredits: 124, departmentId: dept.id, status: 'active' },
  });

  // ── Courses (union of both plans) ──────────────────────────
  const courses: Record<string, { id: number }> = {};
  for (const [code, c] of Object.entries(CATALOG)) {
    courses[code] = await prisma.course.create({
      data: { code, name: c.name, credits: c.credits, type: c.type, departmentId: dept.id },
    });
  }
  const mapPlan = async (curriculumId: number, plan: [string, number, number][]) => {
    for (const [code, y, s] of plan) {
      await prisma.curriculumCourse.create({
        data: { curriculumId, courseId: courses[code].id, yearLevel: y, semester: s },
      });
    }
  };
  await mapPlan(curr2560.id, PLAN_2560);
  await mapPlan(curr2565.id, PLAN_2565);

  // ── Users ──────────────────────────────────────────────────
  await prisma.user.create({
    data: { email: 'admin@ku.ac.th', passwordHash: hash, role: 'admin', firstName: 'ผู้ดูแล', lastName: 'ระบบ',
      isActive: true, approvalStatus: 'approved', approvedAt: new Date() },
  });
  const teacherUser = await prisma.user.create({
    data: { email: 'teacher@ku.ac.th', passwordHash: hash, role: 'teacher', firstName: 'สมชาย', lastName: 'ใจดี',
      phone: '081-111-1111', isActive: true, approvalStatus: 'approved', approvedAt: new Date() },
  });
  const teacher = await prisma.teacher.create({
    data: { userId: teacherUser.id, teacherCode: 'T60001', departmentId: dept.id,
      position: 'ผู้ช่วยศาสตราจารย์', officeRoom: 'อาคาร 15 ห้อง 302', specialization: 'ระบบฐานข้อมูล' },
  });

  const stu60User = await prisma.user.create({
    data: { email: 'student60@ku.ac.th', passwordHash: hash, role: 'student', firstName: 'กานดา', lastName: 'ศรีสุข',
      phone: '082-222-2222', isActive: true, approvalStatus: 'approved', approvedAt: new Date() },
  });
  const student60 = await prisma.student.create({
    data: { userId: stu60User.id, studentCode: '6021450001', departmentId: dept.id, admissionYear: 2560, status: 'active', advisorId: teacher.id },
  });
  const stu65User = await prisma.user.create({
    data: { email: 'student65@ku.ac.th', passwordHash: hash, role: 'student', firstName: 'ภาสกร', lastName: 'แสงทอง',
      phone: '083-333-3333', isActive: true, approvalStatus: 'approved', approvedAt: new Date() },
  });
  const student65 = await prisma.student.create({
    data: { userId: stu65User.id, studentCode: '6521450001', departmentId: dept.id, admissionYear: 2565, status: 'active', advisorId: teacher.id },
  });

  // ── Section + enrolment helpers ────────────────────────────
  const sectionFor = async (code: string, semesterId: number) => {
    const courseId = courses[code].id;
    let sec = await prisma.courseSection.findFirst({ where: { courseId, semesterId } });
    if (!sec) sec = await prisma.courseSection.create({
      data: { courseId, semesterId, sectionNumber: '1', teacherId: teacher.id, maxStudents: 40 },
    });
    return sec;
  };
  const enrolPast = async (studentId: number, code: string, grade: string) => {
    const sec = await sectionFor(code, pastSem.id);
    await prisma.enrollment.create({ data: { studentId, sectionId: sec.id, status: 'completed', grade } });
  };
  const enrolCurrent = async (studentId: number, code: string, grade?: string) => {
    const sec = await sectionFor(code, currentSem.id);
    await prisma.enrollment.create({ data: { studentId, sectionId: sec.id, status: grade ? 'completed' : 'enrolled', grade: grade ?? null } });
    return sec;
  };

  // ── Completed (past term, graded → "ผ่านแล้ว") ─────────────
  const past65: [string, string][] = [
    ['01417111', 'A'], ['01418111', 'A'], ['01418112', 'B+'], ['01418141', 'B'], ['01999111', 'A'],
    ['01417322', 'B'], ['01418113', 'A'], ['01418131', 'B+'], ['01418132', 'B'], ['01418211', 'A'],
  ];
  const past60: [string, string][] = [
    ['01417111', 'B'], ['01418112', 'B'], ['01418114', 'A'], ['01999111', 'B+'], ['01417112', 'B'],
    ['01418113', 'B+'], ['01418132', 'C+'], ['01417322', 'B'], ['01418211', 'B'], ['01422111', 'B+'],
  ];
  for (const [code, g] of past65) await enrolPast(student65.id, code, g);
  for (const [code, g] of past60) await enrolPast(student60.id, code, g);

  // ── Current term (1/2568) — teacher's active courses ───────
  // 01418221: graded (→ per-course grade average has data)
  // 01418231: in progress (has schedule)
  // 01418321: in progress (NO schedule → demo "เพิ่มวันสอน")
  const secDB = await enrolCurrent(student65.id, '01418221', 'A');
  await enrolCurrent(student60.id, '01418221', 'B+');
  const secDS = await enrolCurrent(student65.id, '01418231');
  await enrolCurrent(student60.id, '01418231');
  await enrolCurrent(student65.id, '01418321');
  await enrolCurrent(student60.id, '01418321');

  await prisma.schedule.create({ data: { sectionId: secDB.id, dayOfWeek: 'MON', startTime: T('09:00'), endTime: T('12:00'), room: 'SC45-101' } });
  await prisma.schedule.create({ data: { sectionId: secDS.id, dayOfWeek: 'WED', startTime: T('13:00'), endTime: T('16:00'), room: 'SC45-102' } });

  // keep currentStudents counts honest for current-term sections
  for (const sec of [secDB, secDS]) {
    const count = await prisma.enrollment.count({ where: { sectionId: sec.id } });
    await prisma.courseSection.update({ where: { id: sec.id }, data: { currentStudents: count } });
  }

  console.log('✓ Seed complete (real KU CS curricula 2560 & 2565)');
  console.log('  Accounts (password: demo1234):');
  console.log('   - admin@ku.ac.th        (admin)');
  console.log('   - teacher@ku.ac.th      (teacher T60001 — สมชาย ใจดี)');
  console.log('   - student60@ku.ac.th    (6021450001 — รหัส 60, หลักสูตร 2560)');
  console.log('   - student65@ku.ac.th    (6521450001 — รหัส 65, หลักสูตร 2565)');
  console.log(`  Courses: ${Object.keys(CATALOG).length} | Plan2560: ${PLAN_2560.length} | Plan2565: ${PLAN_2565.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
