"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "การส่งคำขอขัดข้อง");
      }

      setSent(true);
    } catch (err: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-slate-100">
      <Card className="w-full max-w-md p-8 shadow-lg border border-slate-200">
        <div className="mb-6">
          <div className="flex flex-col items-center justify-center gap-2 mb-2">
            <Image src="/KU_Logo_PNG.png" alt="Kasetsart University" width={64} height={64} priority style={{ width: "auto", height: "auto" }} className="object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">ลืมรหัสผ่าน</h1>
          </div>
          <p className="text-center text-sm text-slate-600 mt-1">
            กรอกอีเมลที่ใช้สมัครสมาชิก ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                อีเมล / รหัสนิสิต
              </label>
              <Input
                id="email"
                type="text"
                placeholder="เช่น student@ku.ac.th"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "กำลังตรวจสอบข้อมูล..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </Button>
          </form>
        ) : (
          <div className="text-center py-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-green-600" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">ส่งอีเมลแล้ว!</h2>
            <p className="text-sm text-slate-600 mb-1">
              ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่
            </p>
            <p className="text-sm font-bold text-primary mb-4">{email}</p>
            <p className="text-xs text-slate-500 mb-4">
              กรุณาตรวจสอบอีเมล (รวมถึงโฟลเดอร์ Spam) แล้วคลิกลิงก์เพี่อตั้งรหัสผ่านใหม่
            </p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-200 text-center space-y-2">
          <p className="text-sm text-slate-600">
            <Link href="/" className="text-primary font-medium hover:underline">
              ← กลับหน้าเข้าสู่ระบบ
            </Link>
          </p>
          <p className="text-sm text-slate-600">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
