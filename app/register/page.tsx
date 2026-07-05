"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";

export default function Register() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({
    studentId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "student",
    departmentId: "",
  });
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<{ id: number; name: string; faculty: string }[]>([]);

  useEffect(() => {
    fetch("/api/departments")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = data?.data || [];
        setDepartments(list);
        // default to the first department so the picked value is always valid
        if (list.length > 0) setForm((f) => ({ ...f, departmentId: String(list[0].id) }));
      })
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน กรุณากรอกใหม่");
      return;
    }
    if (form.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);
    try {
      // Don't ship confirmPassword to the server (it's a client-only concern),
      // and trim text fields so stray spaces don't break uniqueness checks or
      // get stored in the DB.
      const { confirmPassword, ...rest } = form;
      const payload = {
        ...rest,
        studentId: form.studentId.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      };
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "การสมัครสมาชิกล้มเหลว");
      }

      toast({
        title: "✅ สมัครสมาชิกสำเร็จ!",
        description: data.pendingApproval
          ? "บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ จะเข้าสู่ระบบได้เมื่อได้รับการอนุมัติ"
          : "ระบบเปิดให้คุณเข้าสู่ระบบได้แล้ว",
      });
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-slate-100 py-8">
      <Card className="w-full max-w-lg p-8 shadow-lg border border-slate-200">
        <div className="mb-6">
          <div className="flex flex-col items-center justify-center gap-2 mb-2">
            <Image src="/KU_Logo_PNG.png" alt="Kasetsart University" width={64} height={64} priority style={{ width: "auto", height: "auto" }} className="object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">สมัครสมาชิก</h1>
          </div>
          <p className="text-center text-sm text-slate-600 mt-1">
            ระบบแจ้งรายการเงื่อนไขรายวิชา — มก. วิทยาเขตกำแพงแสน
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทผู้ใช้</label>
            <AppSelect
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v })}
              className="w-full"
              options={[
                { value: "student", label: "นิสิต" },
                { value: "teacher", label: "อาจารย์" },
              ]}
            />
          </div>

          {departments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">คณะ / สาขา</label>
              <AppSelect
                value={form.departmentId}
                onValueChange={(v) => setForm({ ...form, departmentId: v })}
                className="w-full"
                options={departments.map((d) => ({
                  value: String(d.id),
                  label: d.faculty ? `${d.faculty} — ${d.name}` : d.name,
                }))}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {form.role === "student" ? "รหัสนิสิต" : "รหัสอาจารย์"}
            </label>
            <Input
              name="studentId"
              placeholder={form.role === "student" ? "เช่น 6310000001" : "เช่น T001"}
              value={form.studentId}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ</label>
              <Input name="firstName" placeholder="ชื่อจริง" value={form.firstName} onChange={handleChange} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">นามสกุล</label>
              <Input name="lastName" placeholder="นามสกุล" value={form.lastName} onChange={handleChange} required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
            <Input name="email" type="email" placeholder="เช่น student@ku.ac.th" value={form.email} onChange={handleChange} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทร</label>
            <Input name="phone" type="tel" placeholder="เช่น 081-234-5678" value={form.phone} onChange={handleChange} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
              <Input name="password" type="password" placeholder="อย่างน้อย 6 ตัว" value={form.password} onChange={handleChange} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ยืนยันรหัสผ่าน</label>
              <Input name="confirmPassword" type="password" placeholder="กรอกอีกครั้ง" value={form.confirmPassword} onChange={handleChange} required />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600">
            มีบัญชีอยู่แล้ว?{" "}
            <Link href="/" className="text-primary font-medium hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
