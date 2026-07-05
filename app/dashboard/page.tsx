import { redirect } from "next/navigation";
import { getRole } from "@/lib/server-auth";
import StudentDashboard from "./_variants/student";
import TeacherDashboard from "./_variants/teacher";
import AdminDashboard from "./_variants/admin";

// Role-agnostic URL. The correct role variant is chosen from the session token
// (middleware has already guaranteed the user is authenticated).
export default async function DashboardPage() {
  const role = await getRole();
  if (role === "student") return <StudentDashboard />;
  if (role === "teacher") return <TeacherDashboard />;
  if (role === "admin") return <AdminDashboard />;
  redirect("/");
}
