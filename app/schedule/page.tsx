"use client";
export const dynamic = "force-dynamic";

import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, BookOpen, Loader2, Filter, LayoutGrid, List, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppSelect } from "@/components/ui/app-select";
import { WeeklyTimetable } from "@/components/WeeklyTimetable";

interface ScheduleItem {
  code: string;
  name: string;
  semester: string;
  day: string;
  time: string;
  room: string;
  instructor: string;
}

interface SectionOption {
  sectionId: number;
  code: string;
  name: string;
  semester: string;
  scheduleCount: number;
}

const DAY_OPTIONS = [
  { value: "MON", label: "จันทร์" },
  { value: "TUE", label: "อังคาร" },
  { value: "WED", label: "พุธ" },
  { value: "THU", label: "พฤหัสบดี" },
  { value: "FRI", label: "ศุกร์" },
  { value: "SAT", label: "เสาร์" },
  { value: "SUN", label: "อาทิตย์" },
];

export default function TeacherSchedule() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["teacherSchedule"],
    queryFn: async () => {
      const res = await fetch("/api/schedule/teacher");
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
  });

  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const emptyForm = { sectionId: "", dayOfWeek: "", startTime: "", endTime: "", room: "" };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const items: ScheduleItem[] = data?.data?.items || [];
  const sections: SectionOption[] = data?.data?.sections || [];

  const addMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm) => {
      const res = await fetch("/api/schedule/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sectionId: Number(payload.sectionId) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "เพิ่มวันสอนไม่สำเร็จ");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacherSchedule"] });
      setForm(emptyForm);
      setFormError(null);
      setAddOpen(false);
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "เพิ่มวันสอนไม่สำเร็จ"),
  });

  const handleAdd = () => {
    if (!form.sectionId || !form.dayOfWeek || !form.startTime || !form.endTime) {
      setFormError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    addMutation.mutate(form);
  };

  const uniqueSemesters = useMemo(() => {
    const sems = new Set<string>();
    items.forEach((c) => c.semester && sems.add(c.semester));
    return Array.from(sems).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (selectedSemester === "all") return items;
    return items.filter((c) => c.semester === selectedSemester);
  }, [items, selectedSemester]);

  if (isLoading) {
    return (
      <Layout role="teacher">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังโหลดตารางสอน...</p>
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout role="teacher">
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          <p className="font-bold mb-1">เกิดข้อผิดพลาด</p>
          <p className="text-sm">โปรดลองรีเฟรชหน้าใหม่</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="teacher">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">ตารางสอน</h1>
            <p className="text-slate-600 mt-1">ตารางสอนประจำสัปดาห์ของกลุ่มเรียนที่คุณรับผิดชอบ</p>
          </div>
          <Button
            onClick={() => {
              setForm(emptyForm);
              setFormError(null);
              setAddOpen(true);
            }}
            disabled={sections.length === 0}
            className="flex items-center gap-2 shrink-0"
          >
            <Plus size={18} />
            เพิ่มวันสอน
          </Button>
        </div>

        <Card className="p-4 border border-slate-200 inline-flex">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
              <BookOpen size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-600">กลุ่มเรียนที่สอน</p>
              <p className="text-2xl font-bold text-slate-900">{data?.data?.stats?.totalSections ?? 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar size={20} className="text-primary" />
              ตารางสอนของฉัน
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setView("grid")}
                  className={`px-2.5 py-1.5 text-sm ${view === "grid" ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  title="ตารางสัปดาห์"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`px-2.5 py-1.5 text-sm ${view === "list" ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  title="รายการ"
                >
                  <List size={16} />
                </button>
              </div>
              <Filter size={16} className="text-slate-500" />
              <AppSelect
                value={selectedSemester}
                onValueChange={(v) => setSelectedSemester(v)}
                className="text-sm w-48 shrink-0"
                options={[
                  { value: "all", label: "ทุกภาคเรียน" },
                  ...uniqueSemesters.map((sem) => ({ value: sem, label: `ภาคเรียน ${sem}` })),
                ]}
              />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4">คาบสอนที่แสดง ({filtered.length})</p>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>ยังไม่มีตารางสอน</p>
            </div>
          ) : view === "grid" ? (
            <WeeklyTimetable items={filtered} />
          ) : (
            <div className="space-y-3">
              {filtered.map((c, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="min-w-[80px] text-center">
                    <p className="text-sm font-bold text-primary">{c.day}</p>
                    <p className="text-xs text-slate-500">{c.time}</p>
                  </div>
                  <div className="h-10 w-px bg-slate-300" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-bold text-primary">{c.code}</code>
                      <span className="text-sm font-bold text-slate-900">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>🏫 ห้อง {c.room}</span>
                      <span>👥 {c.instructor}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Add teaching-day modal */}
        <Dialog open={addOpen} onOpenChange={(open) => { if (!open) setAddOpen(false); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar size={20} className="text-primary" />
                เพิ่มวันสอน
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">กลุ่มเรียน</label>
                <AppSelect
                  value={form.sectionId}
                  onValueChange={(v) => setForm((f) => ({ ...f, sectionId: v }))}
                  placeholder="เลือกกลุ่มเรียน"
                  options={sections.map((s) => ({
                    value: String(s.sectionId),
                    label: `${s.code} ${s.name} (ภาค ${s.semester})${s.scheduleCount === 0 ? " — ยังไม่มีวันสอน" : ""}`,
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">วัน</label>
                <AppSelect
                  value={form.dayOfWeek}
                  onValueChange={(v) => setForm((f) => ({ ...f, dayOfWeek: v }))}
                  placeholder="เลือกวัน"
                  options={DAY_OPTIONS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">เวลาเริ่ม</label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">เวลาสิ้นสุด</label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ห้อง <span className="text-slate-400 font-normal">(เว้นว่าง = TBA)</span>
                </label>
                <Input
                  placeholder="เช่น อาคาร 15 ห้อง 302"
                  value={form.room}
                  onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleAdd} disabled={addMutation.isPending} className="flex items-center gap-1">
                  {addMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  บันทึกวันสอน
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
