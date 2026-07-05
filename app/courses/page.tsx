import { redirect } from "next/navigation";
import { getRole } from "@/lib/server-auth";
import StudentCourses from "./_variants/student";
import TeacherCourses from "./_variants/teacher";
import AdminCourses from "./_variants/admin";

export default async function CoursesPage() {
  const role = await getRole();
  if (role === "student") return <StudentCourses />;
  if (role === "teacher") return <TeacherCourses />;
  if (role === "admin") return <AdminCourses />;
  redirect("/");
}
