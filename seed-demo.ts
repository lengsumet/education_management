import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';

const dbUrl = process.env.DATABASE_URL ?? '';
const isAccelerate = dbUrl.startsWith('prisma');
const prisma = isAccelerate
  ? new PrismaClient({ accelerateUrl: dbUrl })
  : new PrismaClient({ adapter: new PrismaMariaDb(dbUrl) });

/**
 * Demo seed for pre-demo / presentation.
 *
 * Produces a self-consistent dataset that exercises every headline feature:
 *
 *  - 1 faculty, 1 department (Computer Science)
 *  - 2 curricula: หลักสูตร พ.ศ. 2560 and หลักสูตร พ.ศ. 2565
 *      (same course catalog, but each cohort maps to its own curriculum year)
 *  - 1 teacher (อ.สมชาย) who teaches the SAME course (Data Structures) in TWO
 *    sections — one section for each cohort — so during the makeup-class demo
 *    the teacher can see BOTH demo students, each on a different curriculum.
 *  - 2 demo students:
 *      * Student A (รหัส 60xxxxxxx) -> curriculum 2560, section 1
 *      * Student B (รหัส 65xxxxxxx) -> curriculum 2565, section 2
 *    Both are enrolled in อ.สมชาย's Data Structures course (different sections),
 *    plus other courses so their weekly schedule and graduation-check are rich.
 *  - Extra mock classmates in each section (data only, for realism).
 *  - Partial grades so graduation-check shows ผ่าน / กำลังเรียน / ต้องเรียนซ้ำ /
 *    ยังไม่ลงทะเบียน all at once.
 *
 * All accounts here are pre-approved (approvalStatus = approved) so they can log
 * in immediately for the demo. Self-registration remains pending-by-default.
 *
 * Login accounts (password for ALL demo users = "demo1234"):
 *   admin@ku.ac.th        -> from create-admin.ts (separate)
 *   somchai@ku.ac.th      -> teacher
 *   student.a@ku.ac.th    -> student, curriculum 2560
 *   student.b@ku.ac.th    -> student, curriculum 2565
 */

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

// Course catalog (mirrors demo-csv/courses_curriculum65.csv)
const COURSES = [
  { code: '01418111', name: 'คอมพิวเตอร์เบื้องต้น', credits: 3, type: 'required' as const },
  { code: '01418112', name: 'การเขียนโปรแกรมภาษาซี', credits: 3, type: 'required' as const },
  { code: '01418221', name: 'โครงสร้างข้อมูล', credits: 3, type: 'required' as const },
  { code: '01418231', name: 'ระบบปฏิบัติการ', credits: 3, type: 'required' as const },
  { code: '01418321', name: 'วิศวกรรมซอฟต์แวร์', credits: 3, type: 'required' as const },
  { code: '01418331', name: 'ฐานข้อมูล', credits: 3, type: 'required' as const },
  { code: '01418332', name: 'เครือข่ายคอมพิวเตอร์', credits: 3, type: 'required' as const },
  { code: '01418442', name: 'การเรียนรู้ของเครื่อง', credits: 3, type: 'elective' as const },
  { code: '01999111', name: 'ภาษาอังกฤษ 1', credits: 3, type: 'general' as const },
  { code: '01999112', name: 'ภาษาอังกฤษ 2', credits: 3, type: 'general' as const },
];

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  console.log('🌱 Seeding demo data...');
  const pwHash = await hash(DEMO_PASSWORD);

  // ---- Faculty + Department ----
  const faculty = await prisma.faculty.upsert({
    where: { code: 'ENG' },
    update: {},
    create: { code: 'ENG', name: 'คณะวิศวกรรมศาสตร์' },
  });

  const dept = await prisma.department.upsert({
    where: { code: 'CPE' },
    update: {},
    create: { code: 'CPE', name: 'วิศวกรรมคอมพิวเตอร์', facultyId: faculty.id },
  });

  // ---- Courses ----
  const courseByCode: Record<string, number> = {};
  for (const c of COURSES) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: c.credits, type: c.type, departmentId: dept.id },
      create: { code: c.code, name: c.name, credits: c.credits, type: c.type, departmentId: dept.id },
    });
    courseByCode[c.code] = course.id;
  }

  // ---- Two curricula (2560 and 2565) ----
  // Each references the same courses, but they are distinct curriculum rows so
  // each cohort resolves to its own year in graduation-check.
  async function upsertCurriculum(year: number, name: string) {
    // Curriculum has no natural unique key besides id, so find-or-create by (year, dept).
    let cur = await prisma.curriculum.findFirst({
      where: { year, departmentId: dept.id },
    });
    if (!cur) {
      cur = await prisma.curriculum.create({
        data: {
          name,
          year,
          departmentId: dept.id,
          totalCredits: COURSES.reduce((s, c) => s + c.credits, 0),
          status: 'active',
        },
      });
    }
    // Wire curriculum courses (idempotent via unique [curriculumId, courseId]).
    let yearLevel = 1;
    let semester = 1;
    for (let i = 0; i < COURSES.length; i++) {
      const c = COURSES[i];
      await prisma.curriculumCourse.upsert({
        where: { curriculumId_courseId: { curriculumId: cur.id, courseId: courseByCode[c.code] } },
        update: { yearLevel, semester },
        create: {
          curriculumId: cur.id,
          courseId: courseByCode[c.code],
          yearLevel,
          semester,
        },
      });
      // spread across years/semesters for a realistic plan
      semester++;
      if (semester > 2) { semester = 1; yearLevel++; }
    }
    return cur;
  }

  const cur60 = await upsertCurriculum(2560, 'หลักสูตรวิศวกรรมคอมพิวเตอร์ พ.ศ. 2560');
  const cur65 = await upsertCurriculum(2565, 'หลักสูตรวิศวกรรมคอมพิวเตอร์ พ.ศ. 2565');
  console.log(`  ✓ curricula: 2560 (#${cur60.id}), 2565 (#${cur65.id})`);

  // ---- Semester (current) ----
  let semester = await prisma.semester.findFirst({ where: { academicYear: 2568, semesterNumber: 1 } });
  if (!semester) {
    semester = await prisma.semester.create({
      data: {
        name: 'ภาคเรียนที่ 1/2568',
        academicYear: 2568,
        semesterNumber: 1,
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-10-31'),
        isCurrent: true,
      },
    });
  }

  // ---- Teacher ----
  const teacherUser = await prisma.user.upsert({
    where: { email: 'somchai@ku.ac.th' },
    update: { isActive: true, approvalStatus: 'approved' },
    create: {
      email: 'somchai@ku.ac.th',
      passwordHash: pwHash,
      role: 'teacher',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      isActive: true,
      approvalStatus: 'approved',
      approvedAt: new Date(),
    },
  });
  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      teacherCode: 'T60001',
      departmentId: dept.id,
      position: 'ผู้ช่วยศาสตราจารย์',
      specialization: 'Data Structures, Algorithms',
    },
  });

  // ---- Two sections of the SAME course (Data Structures), one per cohort ----
  async function upsertSection(courseCode: string, sectionNumber: string) {
    const courseId = courseByCode[courseCode];
    let sec = await prisma.courseSection.findFirst({
      where: { courseId, semesterId: semester!.id, sectionNumber },
    });
    if (!sec) {
      sec = await prisma.courseSection.create({
        data: {
          courseId,
          semesterId: semester!.id,
          sectionNumber,
          teacherId: teacher.id,
          maxStudents: 50,
          currentStudents: 0,
        },
      });
    }
    return sec;
  }

  const dsSection1 = await upsertSection('01418221', '1'); // cohort 2560
  const dsSection2 = await upsertSection('01418221', '2'); // cohort 2565

  // A few more sections so students have a real weekly schedule.
  const osSection = await upsertSection('01418231', '1');
  const dbSection = await upsertSection('01418331', '1');
  const engSection = await upsertSection('01999111', '1');

  // ---- Schedules (so makeup-class can show a real weekly table) ----
  async function ensureSchedule(sectionId: number, day: string, start: string, end: string, room: string) {
    const existing = await prisma.schedule.findFirst({ where: { sectionId, dayOfWeek: day as any } });
    if (existing) return existing;
    return prisma.schedule.create({
      data: {
        sectionId,
        dayOfWeek: day as any,
        startTime: new Date(`1970-01-01T${start}:00Z`),
        endTime: new Date(`1970-01-01T${end}:00Z`),
        room,
        building: 'อาคารวิศวกรรม',
      },
    });
  }
  await ensureSchedule(dsSection1.id, 'MON', '09:00', '11:50', 'CPE-301');
  await ensureSchedule(dsSection2.id, 'TUE', '13:00', '15:50', 'CPE-302');
  await ensureSchedule(osSection.id, 'WED', '09:00', '11:50', 'CPE-303');
  await ensureSchedule(dbSection.id, 'THU', '13:00', '15:50', 'CPE-304');
  await ensureSchedule(engSection.id, 'FRI', '09:00', '11:50', 'LA-101');

  // ---- Helper to create a student user + profile ----
  async function upsertStudent(params: {
    email: string; code: string; first: string; last: string;
    admissionYear: number; departmentId: number;
  }) {
    const user = await prisma.user.upsert({
      where: { email: params.email },
      update: { isActive: true, approvalStatus: 'approved' },
      create: {
        email: params.email,
        passwordHash: pwHash,
        role: 'student',
        firstName: params.first,
        lastName: params.last,
        isActive: true,
        approvalStatus: 'approved',
        approvedAt: new Date(),
      },
    });
    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: { admissionYear: params.admissionYear },
      create: {
        userId: user.id,
        studentCode: params.code,
        departmentId: params.departmentId,
        admissionYear: params.admissionYear,
        status: 'active',
        advisorId: teacher.id,
      },
    });
    return student;
  }

  // ---- Demo student A: curriculum 2560 ----
  const studentA = await upsertStudent({
    email: 'student.a@ku.ac.th',
    code: '6021450001',
    first: 'อรุณ',
    last: 'รุ่งเรือง',
    admissionYear: 2560,
    departmentId: dept.id,
  });

  // ---- Demo student B: curriculum 2565 ----
  const studentB = await upsertStudent({
    email: 'student.b@ku.ac.th',
    code: '6521450001',
    first: 'ภาสกร',
    last: 'แสงทอง',
    admissionYear: 2565,
    departmentId: dept.id,
  });

  console.log(`  ✓ demo students: A=${studentA.studentCode} (2560), B=${studentB.studentCode} (2565)`);

  // ---- Mock classmates (data only) ----
  const mockClassmates2560 = [
    { email: 'mock.a1@ku.ac.th', code: '6021450002', first: 'กานดา', last: 'ศรีสุข' },
    { email: 'mock.a2@ku.ac.th', code: '6021450003', first: 'ชัยวัฒน์', last: 'พงษ์ไพร' },
  ];
  const mockClassmates2565 = [
    { email: 'mock.b1@ku.ac.th', code: '6521450002', first: 'นภัส', last: 'วารีรัตน์' },
    { email: 'mock.b2@ku.ac.th', code: '6521450003', first: 'ธีรภัทร', last: 'คงมั่น' },
  ];

  const mockA: any[] = [];
  for (const m of mockClassmates2560) {
    mockA.push(await upsertStudent({ ...m, admissionYear: 2560, departmentId: dept.id }));
  }
  const mockB: any[] = [];
  for (const m of mockClassmates2565) {
    mockB.push(await upsertStudent({ ...m, admissionYear: 2565, departmentId: dept.id }));
  }

  // ---- Enrollments ----
  async function enroll(studentId: number, sectionId: number, opts?: { grade?: string; status?: string }) {
    return prisma.enrollment.upsert({
      where: { studentId_sectionId: { studentId, sectionId } },
      update: {
        grade: opts?.grade ?? null,
        status: (opts?.status as any) ?? (opts?.grade ? 'completed' : 'enrolled'),
      },
      create: {
        studentId,
        sectionId,
        grade: opts?.grade ?? null,
        status: (opts?.status as any) ?? (opts?.grade ? 'completed' : 'enrolled'),
      },
    });
  }

  // Student A (2560): a mix so graduation-check shows all statuses.
  await enroll(studentA.id, dsSection1.id, { status: 'enrolled' });      // กำลังเรียน (Data Structures, อ.สมชาย)
  await enroll(studentA.id, osSection.id, { grade: 'A' });               // ผ่าน
  await enroll(studentA.id, dbSection.id, { grade: 'F' });               // ต้องเรียนซ้ำ
  await enroll(studentA.id, engSection.id, { grade: 'B+' });             // ผ่าน

  // Student B (2565): also enrolled in อ.สมชาย's Data Structures (section 2).
  await enroll(studentB.id, dsSection2.id, { status: 'enrolled' });      // กำลังเรียน
  await enroll(studentB.id, osSection.id, { grade: 'C+' });              // ผ่าน
  await enroll(studentB.id, engSection.id, { status: 'enrolled' });      // กำลังเรียน

  // Mock classmates enrolled in the respective Data Structures sections.
  for (const m of mockA) await enroll(m.id, dsSection1.id, { status: 'enrolled' });
  for (const m of mockB) await enroll(m.id, dsSection2.id, { status: 'enrolled' });

  // Keep section counters roughly in sync.
  for (const sec of [dsSection1, dsSection2, osSection, dbSection, engSection]) {
    const count = await prisma.enrollment.count({ where: { sectionId: sec.id } });
    await prisma.courseSection.update({ where: { id: sec.id }, data: { currentStudents: count } });
  }

  // ---- A welcome announcement ----
  const existingAnn = await prisma.announcement.findFirst({ where: { title: 'ยินดีต้อนรับสู่ระบบ (ข้อมูล Demo)' } });
  if (!existingAnn) {
    await prisma.announcement.create({
      data: {
        title: 'ยินดีต้อนรับสู่ระบบ (ข้อมูล Demo)',
        content: 'นี่คือข้อมูลตัวอย่างสำหรับการนำเสนอ ประกอบด้วยนิสิต 2 หลักสูตร (2560 / 2565) และอาจารย์ 1 ท่าน',
        targetRole: 'all',
        isPinned: true,
        createdBy: teacherUser.id,
      },
    });
  }

  console.log('✅ Demo seed complete.');
  console.log('   Teacher : somchai@ku.ac.th');
  console.log('   Student A (2560): student.a@ku.ac.th');
  console.log('   Student B (2565): student.b@ku.ac.th');
  console.log(`   Password for all demo users: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
