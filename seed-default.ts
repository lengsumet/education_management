/**
 * DEFAULT / DEPLOY seed — idempotent and NON-destructive (never clears the DB).
 * Safe to run on a fresh deploy or re-run any time; every write is an upsert /
 * find-or-create so running twice changes nothing.
 *
 * Seeds:
 *   - Foundations: faculty, department, past + current semester
 *   - REAL KU Computer-Science curricula (พ.ศ. 2560 & 2565) with real 4-year plans
 *   - 4 accounts, ALL passwords = "demo1234":
 *       admin@ku.ac.th, teacher@ku.ac.th (T60001),
 *       student60@ku.ac.th (หลักสูตร 2560), student65@ku.ac.th (หลักสูตร 2565)
 *   - Usable enrolments/grades so graduation-check / planner / grade-average work
 *
 * Run:  export PATH=".../v20.19.0:$PATH" && npx tsx seed-default.ts
 *       (or: npm run seed:default)
 *
 * NOTE: course.code is unique, so a few codes reused across the two curricula
 * with different meanings keep the 2565 definition.
 */
import 'dotenv/config';
import { PrismaClient, CourseType, DayOfWeek } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';

const dbUrl = process.env.DATABASE_URL ?? '';
const prisma = dbUrl.startsWith('prisma')
  ? new PrismaClient({ accelerateUrl: dbUrl })
  : new PrismaClient({ adapter: new PrismaMariaDb(dbUrl) });

const T = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const PASSWORD = 'demo1234';

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

async function findOrCreateSemester(name: string, data: any) {
  const existing = await prisma.semester.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.semester.create({ data });
}

async function findOrCreateCurriculum(departmentId: number, year: number, name: string, totalCredits: number) {
  const existing = await prisma.curriculum.findFirst({ where: { departmentId, year } });
  if (existing) return existing;
  return prisma.curriculum.create({ data: { departmentId, year, name, totalCredits, status: 'active' } });
}

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── Foundations (idempotent) ───────────────────────────────
  const faculty = await prisma.faculty.upsert({
    where: { code: 'F01' }, update: {}, create: { code: 'F01', name: 'คณะศิลปศาสตร์และวิทยาศาสตร์' },
  });
  const dept = await prisma.department.upsert({
    where: { code: 'D01' }, update: {}, create: { code: 'D01', name: 'วิทยาการคอมพิวเตอร์', facultyId: faculty.id },
  });
  const pastSem = await findOrCreateSemester('ภาคเรียนที่ 2/2567', {
    name: 'ภาคเรียนที่ 2/2567', academicYear: 2567, semesterNumber: 2,
    startDate: new Date('2024-11-01'), endDate: new Date('2025-03-31'), isCurrent: false,
  });
  const currentSem = await findOrCreateSemester('ภาคเรียนที่ 1/2568', {
    name: 'ภาคเรียนที่ 1/2568', academicYear: 2568, semesterNumber: 1,
    startDate: new Date('2025-06-01'), endDate: new Date('2025-10-31'), isCurrent: true,
    regOpenDate: new Date('2025-05-01'), regCloseDate: new Date('2025-06-15'),
  });

  // ── Curricula + real courses (idempotent) ──────────────────
  const curr2560 = await findOrCreateCurriculum(dept.id, 2560, 'หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์ พ.ศ. 2560', 128);
  const curr2565 = await findOrCreateCurriculum(dept.id, 2565, 'หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์ พ.ศ. 2565', 124);

  const courses: Record<string, { id: number }> = {};
  for (const [code, c] of Object.entries(CATALOG)) {
    courses[code] = await prisma.course.upsert({
      where: { code },
      update: { name: c.name, credits: c.credits, type: c.type, departmentId: dept.id },
      create: { code, name: c.name, credits: c.credits, type: c.type, departmentId: dept.id },
    });
  }
  const mapPlan = async (curriculumId: number, plan: [string, number, number][]) => {
    for (const [code, y, s] of plan) {
      await prisma.curriculumCourse.upsert({
        where: { curriculumId_courseId: { curriculumId, courseId: courses[code].id } },
        update: { yearLevel: y, semester: s },
        create: { curriculumId, courseId: courses[code].id, yearLevel: y, semester: s },
      });
    }
  };
  await mapPlan(curr2560.id, PLAN_2560);
  await mapPlan(curr2565.id, PLAN_2565);

  // ── Accounts (all password demo1234) ───────────────────────
  const upsertUser = (email: string, extra: any) =>
    prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash, isActive: true, approvalStatus: 'approved', ...extra },
      create: { email, passwordHash: hash, isActive: true, approvalStatus: 'approved', approvedAt: new Date(), ...extra },
    });

  await upsertUser('admin@ku.ac.th', { role: 'admin', firstName: 'ผู้ดูแล', lastName: 'ระบบ' });

  const teacherUser = await upsertUser('teacher@ku.ac.th', { role: 'teacher', firstName: 'สมชาย', lastName: 'ใจดี', phone: '081-111-1111' });
  const teacher = await prisma.teacher.upsert({
    where: { teacherCode: 'T60001' },
    update: { departmentId: dept.id, position: 'ผู้ช่วยศาสตราจารย์', officeRoom: 'อาคาร 15 ห้อง 302', specialization: 'ระบบฐานข้อมูล' },
    create: { userId: teacherUser.id, teacherCode: 'T60001', departmentId: dept.id, position: 'ผู้ช่วยศาสตราจารย์', officeRoom: 'อาคาร 15 ห้อง 302', specialization: 'ระบบฐานข้อมูล' },
  });

  const stu60User = await upsertUser('student60@ku.ac.th', { role: 'student', firstName: 'กานดา', lastName: 'ศรีสุข', phone: '082-222-2222' });
  const student60 = await prisma.student.upsert({
    where: { studentCode: '6021450001' },
    update: { departmentId: dept.id, admissionYear: 2560, status: 'active', advisorId: teacher.id },
    create: { userId: stu60User.id, studentCode: '6021450001', departmentId: dept.id, admissionYear: 2560, status: 'active', advisorId: teacher.id },
  });
  const stu65User = await upsertUser('student65@ku.ac.th', { role: 'student', firstName: 'ภาสกร', lastName: 'แสงทอง', phone: '083-333-3333' });
  const student65 = await prisma.student.upsert({
    where: { studentCode: '6521450001' },
    update: { departmentId: dept.id, admissionYear: 2565, status: 'active', advisorId: teacher.id },
    create: { userId: stu65User.id, studentCode: '6521450001', departmentId: dept.id, admissionYear: 2565, status: 'active', advisorId: teacher.id },
  });

  // ── Sections / enrolments / schedules (idempotent) ─────────
  const sectionFor = async (code: string, semesterId: number) => {
    const courseId = courses[code].id;
    let sec = await prisma.courseSection.findFirst({ where: { courseId, semesterId } });
    if (!sec) sec = await prisma.courseSection.create({
      data: { courseId, semesterId, sectionNumber: '1', teacherId: teacher.id, maxStudents: 40 },
    });
    return sec;
  };
  const enrol = async (studentId: number, sectionId: number, grade: string | null) => {
    await prisma.enrollment.upsert({
      where: { studentId_sectionId: { studentId, sectionId } },
      update: { status: grade ? 'completed' : 'enrolled', grade },
      create: { studentId, sectionId, status: grade ? 'completed' : 'enrolled', grade },
    });
  };
  const addSchedule = async (sectionId: number, day: DayOfWeek, start: string, end: string, room: string) => {
    const existing = await prisma.schedule.findFirst({ where: { sectionId, dayOfWeek: day, startTime: T(start) } });
    if (!existing) await prisma.schedule.create({ data: { sectionId, dayOfWeek: day, startTime: T(start), endTime: T(end), room } });
  };

  const past65: [string, string][] = [
    ['01417111', 'A'], ['01418111', 'A'], ['01418112', 'B+'], ['01418141', 'B'], ['01999111', 'A'],
    ['01417322', 'B'], ['01418113', 'A'], ['01418131', 'B+'], ['01418132', 'B'], ['01418211', 'A'],
  ];
  const past60: [string, string][] = [
    ['01417111', 'B'], ['01418112', 'B'], ['01418114', 'A'], ['01999111', 'B+'], ['01417112', 'B'],
    ['01418113', 'B+'], ['01418132', 'C+'], ['01417322', 'B'], ['01418211', 'B'], ['01422111', 'B+'],
  ];
  for (const [code, g] of past65) await enrol(student65.id, (await sectionFor(code, pastSem.id)).id, g);
  for (const [code, g] of past60) await enrol(student60.id, (await sectionFor(code, pastSem.id)).id, g);

  const secDB = await sectionFor('01418221', currentSem.id);
  const secDS = await sectionFor('01418231', currentSem.id);
  const secSA = await sectionFor('01418321', currentSem.id); // no schedule (demo "เพิ่มวันสอน")
  await enrol(student65.id, secDB.id, 'A');
  await enrol(student60.id, secDB.id, 'B+');
  await enrol(student65.id, secDS.id, null);
  await enrol(student60.id, secDS.id, null);
  await enrol(student65.id, secSA.id, null);
  await enrol(student60.id, secSA.id, null);
  await addSchedule(secDB.id, 'MON', '09:00', '12:00', 'SC45-101');
  await addSchedule(secDS.id, 'WED', '13:00', '16:00', 'SC45-102');

  // ── Extra mock students: currently in year 4 and year 2 ────
  // yearLevel = 2568 − admissionYear + 1 ; curriculum = latest year ≤ admissionYear
  const GRADES = ['A', 'B+', 'B', 'A', 'C+', 'B+', 'B', 'A', 'C+', 'B', 'A', 'B+'];
  const coursesInYear = (plan: [string, number, number][], yl: number) =>
    plan.filter(([, y]) => y === yl).map(([c]) => c);

  const mkStudent = async (email: string, code: string, admissionYear: number, first: string, last: string) => {
    const u = await upsertUser(email, { role: 'student', firstName: first, lastName: last });
    return prisma.student.upsert({
      where: { studentCode: code },
      update: { departmentId: dept.id, admissionYear, status: 'active', advisorId: teacher.id },
      create: { userId: u.id, studentCode: code, departmentId: dept.id, admissionYear, status: 'active', advisorId: teacher.id },
    });
  };

  // mock ปี 4 (admission 2565 → curriculum 2565): ผ่านปี 1-3, กำลังทำสหกิจ
  const mockY4 = await mkStudent('student4@ku.ac.th', '6521450002', 2565, 'นภัส', 'วารีรัตน์');
  const y4Passed = [...coursesInYear(PLAN_2565, 1), ...coursesInYear(PLAN_2565, 2), ...coursesInYear(PLAN_2565, 3)];
  let gi = 0;
  for (const code of y4Passed) await enrol(mockY4.id, (await sectionFor(code, pastSem.id)).id, GRADES[gi++ % GRADES.length]);
  await enrol(mockY4.id, (await sectionFor('01418490', currentSem.id)).id, null); // สหกิจศึกษา (กำลังเรียน)

  // mock ปี 2 (admission 2567 → curriculum 2565): ผ่านปี 1, กำลังเรียนปี 2
  const mockY2 = await mkStudent('student2@ku.ac.th', '6721450001', 2567, 'ธีรภัทร', 'คงมั่น');
  gi = 0;
  for (const code of coursesInYear(PLAN_2565, 1)) await enrol(mockY2.id, (await sectionFor(code, pastSem.id)).id, GRADES[gi++ % GRADES.length]);
  for (const code of ['01418211', '01418231', '01418233']) await enrol(mockY2.id, (await sectionFor(code, currentSem.id)).id, null);

  // keep currentStudents counts honest for ALL current-term sections
  const currentSecs = await prisma.courseSection.findMany({ where: { semesterId: currentSem.id }, select: { id: true } });
  for (const sec of currentSecs) {
    const count = await prisma.enrollment.count({ where: { sectionId: sec.id } });
    await prisma.courseSection.update({ where: { id: sec.id }, data: { currentStudents: count } });
  }

  console.log('✓ Default seed complete (idempotent, non-destructive)');
  console.log('  All passwords = demo1234');
  console.log('   admin@ku.ac.th | teacher@ku.ac.th (T60001) | student60@ku.ac.th (2560) | student65@ku.ac.th (2565)');
  console.log('   student4@ku.ac.th (ปี 4, สหกิจ) | student2@ku.ac.th (ปี 2)');
  console.log(`  Real KU CS curricula 2560 & 2565 · ${Object.keys(CATALOG).length} courses`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
