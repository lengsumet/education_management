import { redirect } from "next/navigation";
import { getRole } from "@/lib/server-auth";
import StudentRegistration from "./_variants/student";
import AdminRegistration from "./_variants/admin";

export default async function RegistrationPage() {
  const role = await getRole();
  if (role === "student") return <StudentRegistration />;
  if (role === "admin") return <AdminRegistration />;
  // teacher has no registration page -> send to dashboard
  redirect("/dashboard");
}
