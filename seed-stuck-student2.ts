import "dotenv/config";
import prisma from "./src/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Test fixture #2: a student who FINISHED year 1 and is entering YEAR 2 TERM 1,
 * still carrying an F in a course that gates the whole next term.
 *
 * Chosen block: F in 01418113 การโปรแกรมคอมพิวเตอร์ (ปี1 เทอม2). It is the
 * prerequisite of ALL THREE ปี2 เทอม1 courses — 01418211, 01418231, 01418233 —
 * so one F locks the entire term until it's retaken and passed.
 *
 * Login: student-stuck2@ku.ac.th / demo1234
 *
 * NOTE: the "current semester" is a single global value. Running THIS seed makes
 * 1/2569 (ปี2 เทอม1) the active registration term for the whole system.
 *
 * Idempotent: re-running wipes and rebuilds this one test student.
 */

const EMAIL = "student-stuck2@ku.ac.th";
const CODE = "6821450098";
const PASSWORD = "demo1234";
const ADMISSION_YEAR = 2568;

// ปี1 เทอม1 (1/2568) — completed, all passed.
const Y1T1: Array<[string, string]> = [
  ["01418111", "A"],
  ["01418112", "B"],
  ["01418141", "B"],
  ["01999111", "A"],
  ["01417111", "A"], // แคลคูลัส I — passed (so แคล 2 was allowed)
];
// ปี1 เทอม2 (2/2568) — completed, all passed EXCEPT 01418113 = F.
const Y1T2: Array<[string, string]> = [
  ["01417322", "B"],
  ["01418113", "F"], // การโปรแกรมคอมพิวเตอร์ <-- ติด F (บล็อกปี2เทอม1 ทั้งหมด)
  ["01418131", "A"],
  ["01418132", "B"],
  ["01417112", "C"], // แคลคูลัส II
];

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const dept = await prisma.department.findFirst({ where: { code: "D01" } });
  if (!dept) throw new Error("Department D01 not found — run `npm run seed:default` first.");
  const teacher = await prisma.teacher.findFirst({ where: { teacherCode: "T60001" } });
  if (!teacher) throw new Error("Teacher T60001 not found — run `npm run seed:default` first.");

  // Ensure แคล 1/2 are in the curriculum backbone (same as the other fixture).
  const curriculum2565 = await prisma.curriculum.findFirst({ where: { departmentId: dept.id, year: 2565 } });
  if (curriculum2565) {
    for (const [code, y, s] of [["01417111", 1, 1], ["01417112", 1, 2]] as [string, number, number][]) {
      const c = await prisma.course.findUnique({ where: { code } });
      if (!c) continue;
      await prisma.curriculumCourse.upsert({
        where: { curriculumId_courseId: { curriculumId: curriculum2565.id, courseId: c.id } },
        update: { yearLevel: y, semester: s },
        create: { curriculumId: curriculum2565.id, courseId: c.id, yearLevel: y, semester: s },
      });
    }
  }

  const findOrMakeSem = async (ay: number, sn: number, name: string) =>
    (await prisma.semester.findFirst({ where: { academicYear: ay, semesterNumber: sn } })) ??
    (await prisma.semester.create({
      data: {
        name, academicYear: ay, semesterNumber: sn,
        startDate: new Date(`${ay - 543}-06-01`), endDate: new Date(`${ay - 543}-10-31`), isCurrent: false,
      },
    }));

  const t1 = await findOrMakeSem(2568, 1, "ภาคเรียนที่ 1/2568"); // ปี1 เทอม1
  const t2 = await findOrMakeSem(2568, 2, "ภาคเรียนที่ 2/2568"); // ปี1 เทอม2
  const t3 = await findOrMakeSem(2569, 1, "ภาคเรียนที่ 1/2569"); // ปี2 เทอม1 (active)

  // Make ปี2 เทอม1 (1/2569) the active registration semester with an open window.
  const now = new Date();
  await prisma.semester.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
  await prisma.semester.update({
    where: { id: t3.id },
    data: {
      isCurrent: true,
      regOpenDate: new Date(now.getTime() - 30 * 24 * 3600 * 1000),
      regCloseDate: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
    },
  });

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash: hash, isActive: true, approvalStatus: "approved" },
    create: {
      email: EMAIL, passwordHash: hash, isActive: true, approvalStatus: "approved",
      approvedAt: new Date(), role: "student", firstName: "บี (ปี2 ติด F โปรแกรมคอม)", lastName: "ทดสอบ",
    },
  });

  const existing = await prisma.student.findFirst({ where: { userId: user.id } });
  if (existing) {
    await prisma.enrollment.deleteMany({ where: { studentId: existing.id } });
    await prisma.coursePlan.deleteMany({ where: { studentId: existing.id } });
    await prisma.student.delete({ where: { id: existing.id } });
  }
  const student = await prisma.student.create({
    data: {
      userId: user.id, studentCode: CODE, departmentId: dept.id,
      admissionYear: ADMISSION_YEAR, status: "active", advisorId: teacher.id,
    },
  });

  const sectionFor = async (code: string, semesterId: number) => {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) throw new Error(`Course ${code} not found`);
    const found = await prisma.courseSection.findFirst({ where: { courseId: course.id, semesterId } });
    return (
      found ??
      (await prisma.courseSection.create({
        data: { courseId: course.id, semesterId, sectionNumber: "1", teacherId: teacher.id, maxStudents: 40 },
      }))
    );
  };
  const enrolAll = async (rows: Array<[string, string]>, semId: number) => {
    for (const [code, grade] of rows) {
      const sec = await sectionFor(code, semId);
      await prisma.enrollment.create({ data: { studentId: student.id, sectionId: sec.id, status: "completed", grade } });
    }
  };
  await enrolAll(Y1T1, t1.id);
  await enrolAll(Y1T2, t2.id);

  console.log(`\n✅ Test student #2 ready (ปี 2 เทอม 1):`);
  console.log(`   login: ${EMAIL} / ${PASSWORD}   (studentCode ${CODE}, admission ${ADMISSION_YEAR})`);
  console.log(`   ติด F: 01418113 การโปรแกรมคอมพิวเตอร์ (ปี1 เทอม2)`);
  console.log(`   ปี2 เทอม1 (1/2569): LOCKED 01418211, 01418231, 01418233 (ทั้งหมดต้องผ่าน 01418113) · 01418113 = เรียนซ้ำ`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => process.exit());
