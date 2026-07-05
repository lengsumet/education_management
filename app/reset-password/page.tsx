"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CheckCircle, AlertCircle } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Read from query string
    const t = searchParams.get("token");
    const e = searchParams.get("email");
    if (t && e) {
      setToken(t);
      setEmail(e);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "รหัสผ่านไม่ตรงกัน",
        description: "กรุณายืนยันรหัสผ่านใหม่ให้ถูกต้อง",
        variant: "destructive"
      });
      return;
    }
    
    if (!token || !email) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "รีเซ็ตไม่สำเร็จ");

      setIsSuccess(true);
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

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-slate-100 p-4">
        <Card className="w-full max-w-md p-8 shadow-lg border border-slate-200 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">ลิงก์ไม่ถูกต้อง</h2>
          <p className="text-slate-600 mb-6">กรุณาคลิกลิงก์จากอีเมลที่คุณได้รับให้ถูกต้อง</p>
          <Button onClick={() => router.push("/")} className="w-full">
            กลับหน้าเข้าสู่ระบบ
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-slate-100 p-4">
      <Card className="w-full max-w-md p-8 shadow-lg border border-slate-200">
        <div className="mb-6">
          <div className="flex flex-col items-center justify-center gap-2 mb-2">
            <Image src="/KU_Logo_PNG.png" alt="Kasetsart University" width={64} height={64} priority style={{ width: "auto", height: "auto" }} className="object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">ตั้งรหัสผ่านใหม่</h1>
          </div>
        </div>

        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 text-center bg-green-50 p-2 rounded">
              บัญชี: <strong>{email}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่านใหม่</label>
              <Input
                type="password"
                placeholder="กรอกรหัสผ่านใหม่"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ยืนยันรหัสผ่านใหม่อีกครั้ง</label>
              <Input
                type="password"
                placeholder="กรอกให้ตรงกัน"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "กำลังเปลี่ยน..." : "ยืนยันการตั้งรหัสผ่านใหม่"}
            </Button>
          </form>
        ) : (
          <div className="text-center py-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-green-600" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">เรียบร้อย!</h2>
            <p className="text-sm text-slate-600 mb-6">
              รหัสผ่านของคุณถูกเปลี่ยนสำเร็จ คุณสามารถใช้รหัสผ่านใหม่เข้าสู่ระบบได้ทันที
            </p>
            <Button onClick={() => router.push("/")} className="w-full">
              เข้าสู่ระบบ
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-slate-100 p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-200 rounded-full mb-4"></div>
          <div className="h-4 bg-slate-200 rounded w-32"></div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
