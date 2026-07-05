"use client";
export const dynamic = "force-dynamic";

import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, MapPin, User, BookOpen, Loader2, CalendarClock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Makeup {
  id: number;
  courseCode: string;
  courseName: string;
  sectionNumber: string;
  originalDate: string;
  makeupDate: string;
  makeupDateRaw: string;
  startTime: string;
  endTime: string;
  room: string;
  reason: string;
  status: string;
  teacherName: string;
}

export default function StudentMakeupClass() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["studentMakeup"],
    queryFn: async () => {
      const res = await fetch("/api/makeup-class/student");
      if (!res.ok) throw new Error("Failed to fetch makeup classes");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Layout role="student">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังโหลดตารางนัดสอนชดเชย...</p>
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout role="student">
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          <p className="font-bold mb-1">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <p className="text-sm">โปรดลองรีเฟรชหน้าใหม่อีกครั้ง</p>
        </div>
      </Layout>
    );
  }

  const makeups: Makeup[] = data?.data || [];
  const now = new Date();
  const upcoming = makeups.filter((m) => new Date(m.makeupDateRaw) >= new Date(now.toDateString()));
  const past = makeups.filter((m) => new Date(m.makeupDateRaw) < new Date(now.toDateString()));

  const renderCard = (m: Makeup, isPast: boolean) => (
    <div
      key={m.id}
      className={`p-5 rounded-lg border ${isPast ? "border-slate-200 bg-slate-50 opacity-80" : "border-primary/30 bg-primary/5"}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono font-bold text-primary">{m.courseCode}</code>
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">หมู่ {m.sectionNumber}</span>
        </div>
        {!isPast && (
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-primary/10 text-primary whitespace-nowrap">นัดชดเชย</span>
        )}
      </div>
      <h3 className="font-bold text-slate-900 mb-3">{m.courseName}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-slate-700">
          <Calendar size={15} className="text-primary shrink-0" />
          <span className="font-medium">{m.makeupDate}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Clock size={15} className="text-primary shrink-0" />
          <span>{m.startTime} - {m.endTime} น.</span>
        </div>
        {m.room && (
          <div className="flex items-center gap-2 text-slate-700">
            <MapPin size={15} className="text-primary shrink-0" />
            <span>ห้อง {m.room}</span>
          </div>
        )}
        {m.teacherName && (
          <div className="flex items-center gap-2 text-slate-700">
            <User size={15} className="text-primary shrink-0" />
            <span>{m.teacherName}</span>
          </div>
        )}
      </div>
      {m.originalDate && (
        <p className="text-xs text-slate-500 mt-3">ชดเชยคาบวันที่งดสอน: {m.originalDate}</p>
      )}
      {m.reason && <p className="text-xs text-slate-500 mt-1">เหตุผล: {m.reason}</p>}
    </div>
  );

  return (
    <Layout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">ตารางนัดสอนชดเชย</h1>
          <p className="text-slate-600 mt-1">คาบเรียนชดเชยของวิชาที่คุณลงทะเบียน</p>
        </div>

        {makeups.length === 0 ? (
          <Card className="p-12 border border-slate-200 text-center text-slate-500">
            <CalendarClock className="mx-auto mb-3 text-slate-400" size={40} />
            <p>ยังไม่มีคาบนัดสอนชดเชยในขณะนี้</p>
          </Card>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <BookOpen size={18} className="text-primary" />
                กำลังจะถึง ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <Card className="p-6 border border-slate-200 text-center text-sm text-slate-500">ไม่มีคาบชดเชยที่กำลังจะถึง</Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{upcoming.map((m) => renderCard(m, false))}</div>
              )}
            </div>

            {past.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-3">ผ่านไปแล้ว ({past.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{past.map((m) => renderCard(m, true))}</div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
