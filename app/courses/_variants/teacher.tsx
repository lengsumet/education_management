"use client";
export const dynamic = "force-dynamic";

import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Users, BookOpen, Clock, MessageSquare, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppSelect } from "@/components/ui/app-select";

interface TeacherCourse {
  id: string;
  sectionId: number | null;
  code: string;
  name: string;
  semester: string;
  students: number;
  classes: number;
  announcements: number;
  schedule: string;
  status: "active" | "completed";
}

interface CourseAnnouncement {
  id: string;
  title: string;
  content: string;
  date: string;
  status: string;
}

export default function TeacherCourses() {
  const [selectedCurriculumYear, setSelectedCurriculumYear] = useState<number | null>(null);
  const { data: coursesResponse, isLoading, isError, error } = useQuery({
    queryKey: ['teacherCourses', selectedCurriculumYear],
    queryFn: async () => {
      const url = selectedCurriculumYear
        ? `/api/courses/teacher?curriculumYear=${selectedCurriculumYear}`
        : '/api/courses/teacher';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch courses data');
      return res.json();
    }
  });

  const queryClient = useQueryClient();
  const [manageCourse, setManageCourse] = useState<TeacherCourse | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const manageSectionId = manageCourse?.sectionId ?? null;

  const { data: annResponse, isLoading: annLoading } = useQuery({
    queryKey: ['teacherCourseAnnouncements', manageSectionId],
    queryFn: async () => {
      const res = await fetch(`/api/announcements/teacher?sectionId=${manageSectionId}`);
      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json();
    },
    enabled: manageSectionId !== null,
  });
  const announcements: CourseAnnouncement[] = annResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (payload: { sectionId: number; title: string; content: string }) => {
      const res = await fetch('/api/announcements/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'สร้างประกาศไม่สำเร็จ');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherCourseAnnouncements', manageSectionId] });
      queryClient.invalidateQueries({ queryKey: ['teacherCourses'] });
      setForm({ title: "", content: "" });
      setFormError(null);
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'สร้างประกาศไม่สำเร็จ'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/announcements/teacher?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('ลบประกาศไม่สำเร็จ');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherCourseAnnouncements', manageSectionId] });
      queryClient.invalidateQueries({ queryKey: ['teacherCourses'] });
    },
  });

  const openManage = (course: TeacherCourse) => {
    setForm({ title: "", content: "" });
    setFormError(null);
    setManageCourse(course);
  };

  const handleCreate = () => {
    if (manageSectionId === null) return;
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('กรุณากรอกหัวข้อและเนื้อหาให้ครบถ้วน');
      return;
    }
    createMutation.mutate({ sectionId: manageSectionId, title: form.title, content: form.content });
  };

  if (isLoading) {
    return (
      <Layout role="teacher">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout role="teacher">
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-red-500 font-medium mb-2">ไม่สามารถโหลดข้อมูลรายวิชาได้</p>
          <p className="text-slate-500 text-sm">{error instanceof Error ? error.message : "ระบบขัดข้อง"}</p>
        </div>
      </Layout>
    );
  }

  const courses: TeacherCourse[] = coursesResponse?.data || [];
  const availableCurriculumYears: number[] = coursesResponse?.meta?.availableCurriculumYears || [];

  const activeCourses = courses.filter((c) => c.status === "active");
  const completedCourses = courses.filter((c) => c.status === "completed");
  const totalStudents = activeCourses.reduce((sum, c) => sum + c.students, 0);

  return (
    <Layout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">วิชาของฉัน</h1>
            <p className="text-slate-600 mt-1">จัดการวิชาและชั้นเรียนทั้งหมด</p>
          </div>
          {availableCurriculumYears.length > 0 && (
            <AppSelect
              value={selectedCurriculumYear ? String(selectedCurriculumYear) : "all"}
              onValueChange={(v) => setSelectedCurriculumYear(v === "all" ? null : Number(v))}
              className="w-full sm:w-48 shrink-0"
              options={[
                { value: "all", label: "หลักสูตรทั้งหมด" },
                ...availableCurriculumYears.map((year) => ({
                  value: String(year),
                  label: `หลักสูตร ${year % 100}`,
                })),
              ]}
            />
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: BookOpen,
              label: "วิชาที่สอน",
              value: activeCourses.length,
              color: "bg-blue-100 text-blue-600",
            },
            {
              icon: Users,
              label: "นิสิตทั้งหมด",
              value: totalStudents,
              color: "bg-green-100 text-green-600",
            },
            {
              icon: Clock,
              label: "เรียนจบแล้ว",
              value: completedCourses.length,
              color: "bg-purple-100 text-purple-600",
            },
            {
              icon: MessageSquare,
              label: "ประกาศ",
              value: activeCourses.reduce((sum, c) => sum + c.announcements, 0),
              color: "bg-orange-100 text-orange-600",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Active Courses */}
        <Card className="p-6 border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            วิชาที่กำลังสอน ({activeCourses.length})
          </h2>
          <div className="space-y-4">
            {activeCourses.map((course) => (
              <div
                key={course.id}
                className="p-4 border border-slate-200 rounded-lg hover:border-primary transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-bold text-primary">
                        {course.code}
                      </code>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                        ใช้งาน
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900">
                      {course.name}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {course.schedule}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {course.students}
                    </p>
                    <p className="text-xs text-slate-500">นิสิต</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3 text-center text-sm border-t border-slate-200 pt-3">
                  <div>
                    <p className="text-slate-600">ชั่วโมงเรียน</p>
                    <p className="font-bold text-slate-900">{course.classes}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">ประกาศ</p>
                    <p className="font-bold text-slate-900">
                      {course.announcements}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">ภาค</p>
                    <p className="font-bold text-slate-900">{course.semester}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="flex-1" asChild>
                    <a href="/students">ดูรายชื่อนิสิต / ให้เกรด</a>
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <a href="/makeup-class">นัดสอนชดเชย</a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={course.sectionId === null}
                    onClick={() => openManage(course)}
                  >
                    <Megaphone size={16} className="mr-1" />
                    จัดการประกาศ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Completed Courses */}
        {completedCourses.length > 0 && (
          <Card className="p-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              วิชาที่เรียนจบแล้ว ({completedCourses.length})
            </h2>
            <div className="space-y-3">
              {completedCourses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-bold text-primary">
                        {course.code}
                      </code>
                      <span className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded font-medium">
                        เสร็จสิ้น
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-900">
                      {course.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      {course.students} นิสิต
                    </p>
                    <p className="text-xs text-slate-500">ภาค {course.semester}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Manage Course Announcements Modal */}
        <Dialog
          open={!!manageCourse}
          onOpenChange={(open) => {
            if (!open) setManageCourse(null);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone size={20} className="text-primary" />
                ประกาศรายวิชา — {manageCourse?.code} {manageCourse?.name}
              </DialogTitle>
            </DialogHeader>

            {/* Create form */}
            <div className="space-y-3 border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-900">สร้างประกาศใหม่</p>
              <Input
                placeholder="หัวข้อประกาศ"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <Textarea
                placeholder="เนื้อหาประกาศ"
                rows={3}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="flex justify-end">
                <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 size={16} className="mr-1 animate-spin" />
                  ) : (
                    <Plus size={16} className="mr-1" />
                  )}
                  เผยแพร่ประกาศ
                </Button>
              </div>
            </div>

            {/* Existing announcements */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">
                ประกาศทั้งหมด ({announcements.length})
              </p>
              {annLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : announcements.length === 0 ? (
                <p className="text-center text-slate-500 py-6 text-sm">ยังไม่มีประกาศในวิชานี้</p>
              ) : (
                announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 border border-slate-200 rounded-lg flex items-start justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900">{a.title}</h3>
                        <span className="text-xs text-slate-500 whitespace-nowrap">{a.date}</span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.content}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-600 shrink-0"
                      onClick={() => setPendingDelete(a.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!pendingDelete}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title="ลบประกาศ"
          description="ต้องการลบประกาศนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้"
          variant="danger"
          onConfirm={() => {
            if (pendingDelete) deleteMutation.mutate(pendingDelete);
            setPendingDelete(null);
          }}
        />
      </div>
    </Layout>
  );
}
