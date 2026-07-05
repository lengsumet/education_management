"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function Login() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Auth gating is enforced server-side by middleware.ts BEFORE this page is
  // ever served: a logged-in user is redirected to their dashboard and never
  // sees this form, so no client-side guard/loader is needed here. The only gap
  // is the bfcache — Back can restore this page from memory without hitting the
  // server. Force a reload on bfcache restore so middleware re-runs and does the
  // right redirect. (No effect on a normal first load, where persisted=false.)
  useEffect(() => {
    // A Back/Forward navigation can restore this page from the bfcache (persisted)
    // OR from Next's client router / HTTP cache — in BOTH cases middleware does
    // not re-run, so a logged-in user could be shown this stale login form. Force
    // a hard reload on any back/forward show; the fresh request re-runs middleware
    // which redirects an authenticated user to the dashboard. (A reload triggered
    // here reports navType "reload", so it never loops.)
    const onPageShow = (e: PageTransitionEvent) => {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (e.persisted || nav?.type === "back_forward") {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      toast({
        title: "✅ เข้าสู่ระบบสำเร็จ!",
        description: `ยินดีต้อนรับกลับเข้าสู่ระบบ, ${data.user.email}`,
      });
      // Hard replace (not router.replace): Next's App Router soft replace does
      // not reliably drop the "/" entry from browser history, so Back from the
      // dashboard could return to this login page. A full-document replace both
      // removes "/" from history AND sends the freshly-set auth cookie with the
      // request, so middleware admits the dashboard on the first hit.
      setRedirecting(true);
      window.location.replace(`/dashboard`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false); // only reset on failure; on success we're navigating away
    }
  };

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-slate-100">
        <p className="text-sm text-slate-500">กำลังเข้าสู่ระบบ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-slate-100">
      <Card className="w-full max-w-md p-8 shadow-lg border border-slate-200">
        <div className="mb-8">
          <div className="flex flex-col items-center justify-center gap-2 mb-2">
            <Image src="/KU_Logo_PNG.png" alt="Kasetsart University" width={80} height={80} priority style={{ width: "auto", height: "auto" }} className="object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">ยินดีต้อนรับ</h1>
          </div>
          <p className="text-center text-sm text-slate-600 mt-2">
            ระบบแจ้งรายการเงื่อนไขรายวิชา — มก. วิทยาเขตกำแพงแสน
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              ⚠️ {error}
            </div>
          )}
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
              className="w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              รหัสผ่าน
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border border-slate-300 rounded cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">
                จำข้อมูลของฉัน
              </label>
            </div>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              ลืมรหัสผ่าน?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>

          <p className="text-sm text-center text-slate-600">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              สมัครสมาชิก
            </Link>
          </p>
        </form>


      </Card>
    </div>
  );
}
