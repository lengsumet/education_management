import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, hashPassword, generateResetToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const roleParam = searchParams.get("role");
    const approvalParam = searchParams.get("approval"); // pending | approved | rejected

    // Build the query
    const whereClause: any = {};
    if (roleParam && roleParam !== "ทั้งหมด") {
      whereClause.role = roleParam as Role;
    }
    if (approvalParam && ["pending", "approved", "rejected"].includes(approvalParam)) {
      whereClause.approvalStatus = approvalParam;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        student: true,
        teacher: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedUsers = users.map((user: any) => {
      // Determine username: student code, teacher code, or default to ID
      let username = `user_${user.id}`;
      if (user.role === "student" && user.student) {
        username = user.student.studentCode;
      } else if (user.role === "teacher" && user.teacher) {
        username = user.teacher.teacherCode;
      }

      return {
        id: user.id.toString(),
        username,
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        status: user.isActive ? "active" : "inactive",
        approvalStatus: user.approvalStatus,
        joinDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : "N/A"
      };
    });

    return NextResponse.json({ success: true, data: formattedUsers }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Users GET API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { email, firstName, lastName, role, passwordHash } = body;

    // --- Validation ---
    if (!email || !firstName || !lastName || !role) {
      return NextResponse.json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
    }
    if (role !== "student" && role !== "teacher" && role !== "admin") {
      return NextResponse.json({ message: "บทบาทไม่ถูกต้อง" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: "อีเมลนี้มีการใช้งานแล้ว" }, { status: 409 });
    }

    // Password: use the one provided, otherwise generate a temporary one and
    // return it so the admin can hand it over. NEVER store a non-hash string —
    // that produced a valid-looking user who could never log in.
    let plain: string = passwordHash;
    let tempPassword: string | null = null;
    if (!plain) {
      plain = generateResetToken(); // 6-char crypto-random
      tempPassword = plain;
    }
    const finalPasswordHash = await hashPassword(plain);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          role: role as Role,
          passwordHash: finalPasswordHash,
          // Admin-created accounts are trusted -> auto-approved & active.
          isActive: true,
          approvalStatus: "approved",
          approvedAt: new Date(),
          approvedBy: payload.userId,
        },
      });

      if (role === "student" || role === "teacher") {
        let department = await tx.department.findFirst();
        if (!department) {
          const faculty = await tx.faculty.create({ data: { name: "รอกำหนด", code: "TBD" } });
          department = await tx.department.create({ data: { name: "รอกำหนด", code: "TBD", facultyId: faculty.id } });
        }
        const code = (email.split("@")[0] || String(user.id)).slice(0, 20);
        if (role === "student") {
          await tx.student.create({
            data: {
              userId: user.id,
              studentCode: code,
              departmentId: department.id,
              admissionYear: new Date().getFullYear() + 543, // พ.ศ.
            },
          });
        } else {
          await tx.teacher.create({
            data: { userId: user.id, teacherCode: code, departmentId: department.id },
          });
        }
      }
      return user;
    });

    return NextResponse.json({ success: true, data: newUser, tempPassword }, { status: 201 });

  } catch (error: any) {
    console.error("Admin Users POST API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { id, email, firstName, lastName, role, isActive, action } = body;

    if (!id) return NextResponse.json({ message: "User ID is required" }, { status: 400 });

    // Approval actions from the "รออนุมัติ" tab.
    if (action === "approve" || action === "reject") {
      const updatedUser = await prisma.user.update({
        where: { id: Number(id) },
        data:
          action === "approve"
            ? {
                approvalStatus: "approved",
                isActive: true,
                approvedAt: new Date(),
                approvedBy: payload.userId,
              }
            : {
                approvalStatus: "rejected",
                isActive: false,
                approvedAt: new Date(),
                approvedBy: payload.userId,
              },
      });

      // Notify the user of the decision.
      await prisma.notification.create({
        data: {
          userId: Number(id),
          title: action === "approve" ? "บัญชีได้รับการอนุมัติ" : "บัญชีไม่ได้รับการอนุมัติ",
          message:
            action === "approve"
              ? "ผู้ดูแลระบบอนุมัติบัญชีของคุณแล้ว คุณสามารถเข้าสู่ระบบได้"
              : "ผู้ดูแลระบบไม่อนุมัติบัญชีของคุณ กรุณาติดต่อผู้ดูแลระบบ",
          type: "system",
          isRead: false,
        },
      });

      return NextResponse.json({ success: true, data: updatedUser }, { status: 200 });
    }

    // Regular profile edit.
    const current = await prisma.user.findUnique({
      where: { id: Number(id) },
      include: { student: true, teacher: true },
    });
    if (!current) {
      return NextResponse.json({ message: "ไม่พบผู้ใช้งาน" }, { status: 404 });
    }
    const newRole: Role = (role as Role) ?? current.role;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: Number(id) },
        data: { email, firstName, lastName, role: newRole, isActive },
      });

      // Keep the student/teacher profile tables in sync with the role. Without
      // this a role change left the user with a mismatched/orphan profile row.
      if (newRole !== current.role) {
        if (newRole !== "student" && current.student) {
          await tx.student.delete({ where: { id: current.student.id } });
        }
        if (newRole !== "teacher" && current.teacher) {
          await tx.teacher.delete({ where: { id: current.teacher.id } });
        }
        const code = (u.email.split("@")[0] || String(u.id)).slice(0, 20);
        if (newRole === "student" && !current.student) {
          const dept = await tx.department.findFirst();
          if (dept) {
            await tx.student.create({
              data: { userId: u.id, studentCode: code, departmentId: dept.id, admissionYear: new Date().getFullYear() + 543 },
            });
          }
        }
        if (newRole === "teacher" && !current.teacher) {
          const dept = await tx.department.findFirst();
          if (dept) {
            await tx.teacher.create({ data: { userId: u.id, teacherCode: code, departmentId: dept.id } });
          }
        }
      }
      return u;
    });

    return NextResponse.json({ success: true, data: updatedUser }, { status: 200 });
  } catch (error: any) {
    console.error("Admin Users PATCH API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ message: "User ID is required" }, { status: 400 });
    const userId = Number(id);

    if (userId === payload.userId) {
      return NextResponse.json({ message: "ไม่สามารถลบบัญชีของตนเองได้" }, { status: 400 });
    }

    const u = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true, teacher: true },
    });
    if (!u) return NextResponse.json({ message: "ไม่พบผู้ใช้งาน" }, { status: 404 });

    // Several FKs to the user are RESTRICT (announcements.createdBy,
    // import_logs.importedBy) and the student/teacher rows have their own
    // RESTRICT children (enrollments, sections). Clear them first, in a
    // transaction, so the final user delete (which cascades student/teacher/
    // notifications/otp) succeeds.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.announcement.deleteMany({ where: { createdBy: userId } });
        await tx.importLog.deleteMany({ where: { importedBy: userId } });
        if (u.student) {
          await tx.enrollment.deleteMany({ where: { studentId: u.student.id } });
          await tx.coursePlan.deleteMany({ where: { studentId: u.student.id } });
        }
        if (u.teacher) {
          const sections = await tx.courseSection.count({ where: { teacherId: u.teacher.id } });
          if (sections > 0) throw new Error("TEACHER_HAS_SECTIONS");
        }
        await tx.user.delete({ where: { id: userId } });
      });
    } catch (e: any) {
      if (e?.message === "TEACHER_HAS_SECTIONS") {
        return NextResponse.json(
          { message: "ไม่สามารถลบอาจารย์ที่มีวิชาสอนอยู่ กรุณาย้ายผู้สอนของวิชาก่อน" },
          { status: 409 }
        );
      }
      throw e;
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Users DELETE API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
