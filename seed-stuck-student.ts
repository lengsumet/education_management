import "dotenv/config";
import prisma from "./src/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Test fixture: a YEAR-1 student, entering SEMESTER 2, stuck on a prerequisite.
 *
 * Story (the original request): นาย เอ เรียนปี 1 เทอม 1 แต่ติด F วิชาแคลคูลัส 1
 * → พอจะลงเทอม 2 ลงแคลคูลัส 2 ไม่ได้ (ต้องผ่านแคล 1 ก่อน).
 *
 * Login: student-stuck@ku.ac.th / demo1234
 *
 * Term 1 (1/2568) — completed:
 *   01417111 แคล 1 = F   ← ต้นเหตุ
 *   01418111 = A, 01418112 = B, 01999111 = A
 *
 * Term 2 (2/2568) — plan to register (renders on registration page):
 *   LOCKED  01417112 แคล 2            (needs 01417111 = F)   🔒
 *   OPEN    01418113 การโปรแกรมคอมพิวเตอร์ (ไม่มี prereq)     ✅
 *   OPEN    01418132 หลักมูลการคณนา     (ไม่มี prereq)        ✅
 *
 * Idempotent: re-running wipes and rebuilds this one test student.
 */

const EMAIL = "student-stuck@ku.ac.th";
const CODE = "6821450099";
const PASSWORD = "demo1234";
const ADMISSION_YEAR = 2568;

// All FIVE curriculum courses of ปี1 เทอม1, so term 1 reads as fully complete
// (only แคล 1 failed). Missing any of these makes the planner show it with no
// status, which looks wrong for a year-1-term-2 student.
const TERM1_COMPLETED: Array<[string, string]> = [
  ["01417111", "F"],  // แคลคูลัส I  <-- ติด F
  ["01418111", "A"],  // วิทยาการคอมพิวเตอร์เบื้องต้น
  ["01418112", "B"],  // แนวคิดการโปรแกรมเบื้องต้น
  ["01418141", "B"],  // ทรัพย์สินทางปัญญาและจรรยาบรรณวิชาชีพ
  ["01999111", "A"],  // ศาสตร์แห่งแผ่นดิน
];

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const dept = await prisma.department.findFirst({ where: { code: "D01" } });
  if (!dept) throw new Error("Department D01 not found — run `npm run seed:default` first.");
  const teacher = await prisma.teacher.findFirst({ where: { teacherCode: "T60001" } });
  if (!teacher) throw new Error("Teacher T60001 not found — run `npm run seed:default` first.");

  // Ensure แคล 1/2 are part of the CS-2565 curriculum backbone (year 1) so they
  // show up consistently in BOTH the planner and registration for every 2565
  // student — instead of being loose courses pinned via a CoursePlan (which the
  // planner and registration interpret differently).
  const curriculum2565 = await prisma.curriculum.findFirst({ where: { departmentId: dept.id, year: 2565 } });
  if (curriculum2565) {
    const calcPlacement: [string, number, number][] = [
      ["01417111", 1, 1], // แคลคูลัส I  → ปี 1 เทอม 1
      ["01417112", 1, 2], // แคลคูลัส II → ปี 1 เทอม 2
    ];
    for (const [code, y, s] of calcPlacement) {
      const c = await prisma.course.findUnique({ where: { code } });
      if (!c) continue;
      await prisma.curriculumCourse.upsert({
        where: { curriculumId_courseId: { curriculumId: curriculum2565.id, courseId: c.id } },
        update: { yearLevel: y, semester: s },
        create: { curriculumId: curriculum2565.id, courseId: c.id, yearLevel: y, semester: s },
      });
    }
  }

  // Term 1 = the current semester (1/2568). Term 2 = 2/2568 (create if missing).
  const term1 =
    (await prisma.semester.findFirst({ where: { academicYear: 2568, semesterNumber: 1 } })) ??
    (await prisma.semester.findFirst({ where: { isCurrent: true } }));
  if (!term1) throw new Error("Semester 1/2568 not found — run `npm run seed:default` first.");
  const term2 =
    (await prisma.semester.findFirst({ where: { academicYear: 2568, semesterNumber: 2 } })) ??
    (await prisma.semester.create({
      data: {
        name: "ภาคเรียนที่ 2/2568", academicYear: 2568, semesterNumber: 2,
        startDate: new Date("2025-11-01"), endDate: new Date("2026-03-31"), isCurrent: false,
      },
    }));

  // Make TERM 2 the active registration semester with an OPEN window (spanning
  // "now" so the dashboard/registration read as open). This drives the whole
  // flow: dashboard year/term, recommended courses, planner gating, and the
  // registration page all key off the current semester.
  const now = new Date();
  const regOpen = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const regClose = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  await prisma.semester.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
  await prisma.semester.update({
    where: { id: term2.id },
    data: { isCurrent: true, regOpenDate: regOpen, regCloseDate: regClose },
  });

  // ── User + clean-slate Student (idempotent) ────────────────
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash: hash, isActive: true, approvalStatus: "approved" },
    create: {
      email: EMAIL, passwordHash: hash, isActive: true, approvalStatus: "approved",
      approvedAt: new Date(), role: "student", firstName: "เอ (ปี1 ติด F แคล1)", lastName: "ทดสอบ",
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

  // ── Helpers ────────────────────────────────────────────────
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

  for (const [code, grade] of TERM1_COMPLETED) {
    const sec = await sectionFor(code, term1.id);
    await prisma.enrollment.create({
      data: { studentId: student.id, sectionId: sec.id, status: "completed", grade },
    });
  }

  // No CoursePlan rows needed: term-2 courses (incl. แคล 2) come from the
  // curriculum backbone, and แคล 1 comes from the retake path — all consistent
  // between the planner and the registration page.

  console.log(`\n✅ Test student ready (ปี 1 เทอม 2):`);
  console.log(`   login: ${EMAIL} / ${PASSWORD}   (studentCode ${CODE}, admission ${ADMISSION_YEAR})`);
  console.log(`   เทอม 1 (1/2568): ติด F 01417111 แคล 1`);
  console.log(`   เทอม 2 (2/2568) เลือก "ชั้นปีที่ 1 เทอม 2": LOCKED 01417112(แคล2) · OPEN 01418113, 01418132`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => process.exit());
