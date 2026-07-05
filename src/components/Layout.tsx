"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  CheckCircle,
  Users,
  User,
  LogOut,
  Menu,
  X,
  Megaphone,
  Calendar,
  GraduationCap,
  CalendarCheck,
} from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  role: "student" | "teacher" | "admin";
}

export default function Layout({ children, role }: LayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userData, setUserData] = useState<any>(null);

  // Auth gating is enforced server-side by middleware.ts before this page is
  // served, so we render the shell immediately (no blocking loader / flash) and
  // just populate the header user info once /api/auth/me resolves. If the token
  // expired mid-session the fetch 401s and we fall back to login. On bfcache
  // restore (Back), force a reload so middleware re-runs and kicks out a
  // logged-out user who'd otherwise see a cached dashboard.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(async data => {
        if (cancelled) return;
        if (data?.user) { setUserData(data); return; }
        // Token is signature-valid but /api/auth/me rejected it (expired, or the
        // user no longer exists after a DB reset). Middleware trusts the JWT
        // signature, so a bare replace('/') would bounce "/" -> "/dashboard" ->
        // here -> "/" forever (infinite loading). Clear the stale cookie first
        // so middleware sees no session and actually shows the login page.
        try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
        window.location.replace('/');
      })
      .catch(() => {});
    // Back/Forward can restore this dashboard from the bfcache (persisted) OR
    // from Next's client router / HTTP cache — in BOTH cases middleware does not
    // re-run, so a logged-OUT user could be shown a stale dashboard. Force a hard
    // reload on any back/forward show; the fresh request re-runs middleware which
    // kicks the user to login. (The reload reports navType "reload" -> no loop.)
    const onPageShow = (e: PageTransitionEvent) => {
      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (e.persisted || nav?.type === 'back_forward') {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => { cancelled = true; window.removeEventListener('pageshow', onPageShow); };
  }, []);

  const handleLogout = async () => {
    // Must hit the API to clear the httpOnly auth-token cookie. Clearing only
    // localStorage leaves the cookie valid, so the login guard would bounce the
    // user straight back into the dashboard (= "can't log out").
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network error — still clear client state and redirect
    }
    localStorage.removeItem('user');
    // Hard replace (not router.replace): Next's soft replace does not reliably
    // drop the dashboard entry from browser history, so Back could return to a
    // bfcached dashboard AFTER logout. A full-document replace removes it and
    // re-runs middleware on the fresh "/" request.
    window.location.replace('/');
  };

  const getNavItems = () => {
    // Role-agnostic URLs — the page resolvers pick the right variant from the
    // session. Which items appear is still driven by role (below).
    const baseItems = [
      { icon: LayoutDashboard, label: "แดชบอร์ด", path: `/dashboard` },
      { icon: User, label: "โปรไฟล์", path: `/profile` },
    ];

    if (role === "student") {
      return [
        ...baseItems,
        { icon: BookOpen, label: "วิชาของฉัน", path: `/courses` },
        { icon: ClipboardList, label: "วางแผนวิชา", path: `/course-planner` },
        { icon: ClipboardList, label: "แคตตาล็อกวิชา", path: `/catalog` },
        { icon: CheckCircle, label: "ตรวจสอบการลงทะเบียน", path: `/registration` },
        { icon: CalendarCheck, label: "ตารางเรียน", path: `/schedule-submit` },
        { icon: Calendar, label: "นัดสอนชดเชย", path: `/makeup-class` },
        { icon: GraduationCap, label: "ตรวจสอบจบ", path: `/graduation-check` },
      ];
    } else if (role === "teacher") {
      return [
        ...baseItems,
        { icon: BookOpen, label: "วิชาของฉัน", path: `/courses` },
        { icon: Users, label: "รายชื่อนิสิต", path: `/students` },
        { icon: CalendarCheck, label: "ตารางสอน", path: `/schedule` },
        { icon: Calendar, label: "นัดสอนชดเชย", path: `/makeup-class` },
      ];
    } else if (role === "admin") {
      return [
        { icon: LayoutDashboard, label: "แดชบอร์ด", path: `/dashboard` },
        { icon: Users, label: "ผู้ใช้", path: `/users` },
        { icon: BookOpen, label: "จัดการรายวิชา", path: `/courses` },
        { icon: ClipboardList, label: "จัดการหลักสูตร", path: `/curriculum` },
        { icon: CheckCircle, label: "อนุมัติลงทะเบียน", path: `/registration` },
        { icon: CheckCircle, label: "นำเข้าข้อมูล", path: `/import` },
        { icon: Megaphone, label: "ประกาศข่าวสาร", path: `/announcements` },
      ];
    }

    return baseItems;
  };

  const navItems = getNavItems();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-64" : "w-0"
          } bg-white border-r border-slate-200 transition-all duration-300 ease-in-out overflow-hidden`}
      >
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <Image src="/KU_Logo_PNG.png" alt="KU" width={40} height={40} priority style={{ width: "auto", height: "auto" }} className="object-contain" />
            <span className="text-lg font-bold text-slate-900">มก.กำแพงแสน</span>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${isActive
                      ? "bg-primary text-white"
                      : "text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  <Icon size={20} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-200 p-6 absolute bottom-0 w-64">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="w-full flex items-center gap-2"
          >
            <LogOut size={16} />
            ออกจากระบบ
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">
                {userData?.user ? `${userData.user.firstName} ${userData.user.lastName}` : (role === "student" ? "นิสิต" : role === "teacher" ? "อาจารย์" : "ผู้ดูแลระบบ")}
              </p>
              <p className="text-xs text-slate-500">
                {role === "student" ? `รหัส ${userData?.profile?.studentCode || "..."}` : 
                 role === "teacher" ? `รหัส ${userData?.profile?.teacherCode || "..."}` : 
                 "ระบบ"}
              </p>
            </div>
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold overflow-hidden">
              {userData?.user?.avatarUrl ? (
                <img src={userData.user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userData?.user?.firstName ? userData.user.firstName[0].toUpperCase() : role.charAt(0).toUpperCase()
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
