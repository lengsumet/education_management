"use client";
export const dynamic = "force-dynamic";

import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, Loader2, BookOpen, Filter, Search, ChevronLeft, ChevronRight, Eye, X, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppSelect } from "@/components/ui/app-select";
import { DatePicker } from "@/components/ui/date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface RegistrationRequest {
  id: string;
  studentCode: string;
  studentName: string;
  departmentName: string;
  courseCode: string;
  courseName: string;
  credits: number;
  semester: string;
  status: string;
  enrolledAt: string;
}

interface StudentGroup {
  studentCode: string;
  studentName: string;
  departmentName: string;
  courses: RegistrationRequest[];
  totalCredits: number;
}

export default function AdminRegistration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [pendingAction, setPendingAction] = useState<{ action: "approve" | "reject"; ids: string[] } | null>(null);
  const pageSize = 100;
  const [modalStudent, setModalStudent] = useState<StudentGroup | null>(null);

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const { data: regData, isLoading } = useQuery({
    queryKey: ['adminRegistration', statusFilter, search, page, selectedSemester],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        search,
        page: String(page),
        pageSize: String(pageSize),
        ...(selectedSemester ? { semester: selectedSemester } : {})
      });
      const res = await fetch(`/api/registration/admin?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  // Registration window (open/close dates) for the current semester
  const [regOpen, setRegOpen] = useState("");   // yyyy-mm-dd
  const [regClose, setRegClose] = useState(""); // yyyy-mm-dd
  const { data: semData } = useQuery({
    queryKey: ['currentSemester'],
    queryFn: async () => {
      const res = await fetch('/api/semester/current');
      if (!res.ok) throw new Error("Failed");
      return res.json();
    }
  });
  useEffect(() => {
    const s = semData?.data;
    if (s) {
      setRegOpen(s.regOpenDate ? String(s.regOpenDate).slice(0, 10) : "");
      setRegClose(s.regCloseDate ? String(s.regCloseDate).slice(0, 10) : "");
    }
  }, [semData]);
  const saveRegConfig = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/semester/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Send as UTC (calendar-date semantics) so the stored value reads back
        // as the exact date the admin picked, regardless of server timezone.
        body: JSON.stringify({
          regOpenDate: regOpen ? `${regOpen}T00:00:00.000Z` : null,
          regCloseDate: regClose ? `${regClose}T23:59:59.999Z` : null,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || 'บันทึกไม่สำเร็จ');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'บันทึกช่วงเวลาลงทะเบียนแล้ว', className: 'bg-green-50 text-green-900 border-green-200' });
      queryClient.invalidateQueries({ queryKey: ['currentSemester'] });
    },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ enrollmentIds, action }: { enrollmentIds: string[]; action: "approve" | "reject" }) => {
      const res = await fetch("/api/registration/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentIds, action })
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "สำเร็จ",
        description: data.message || "ดำเนินการเรียบร้อย",
        className: "bg-green-50 text-green-900 border-green-200"
      });
      setSelectedIds([]);
      setModalStudent(null);
      queryClient.invalidateQueries({ queryKey: ['adminRegistration'] });
    },
    onError: () => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "เกิดข้อผิดพลาด โปรดลองอีกครั้ง",
        variant: "destructive"
      });
    }
  });

  const registrations: RegistrationRequest[] = regData?.data?.registrations || [];
  const stats = regData?.data?.stats || { pending: 0, enrolled: 0, dropped: 0, withdrawn: 0 };
  const totalCount = regData?.data?.totalCount || 0;
  const availableSemesters: string[] = regData?.data?.availableSemesters || [];

  // Group registrations by student
  const studentGroups: StudentGroup[] = [];
  const studentMap = new Map<string, StudentGroup>();
  registrations.forEach(r => {
    if (!studentMap.has(r.studentCode)) {
      const group: StudentGroup = {
        studentCode: r.studentCode,
        studentName: r.studentName,
        departmentName: r.departmentName,
        courses: [],
        totalCredits: 0,
      };
      studentMap.set(r.studentCode, group);
      studentGroups.push(group);
    }
    const g = studentMap.get(r.studentCode)!;
    g.courses.push(r);
    g.totalCredits += r.credits;
  });

  const toggleSelectStudent = (studentCode: string) => {
    const group = studentMap.get(studentCode);
    if (!group) return;
    const courseIds = group.courses.map(c => c.id);
    const allSelected = courseIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !courseIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...courseIds])]);
    }
  };

  const toggleAll = () => {
    const allIds = registrations.map(r => r.id);
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const handleAction = (action: "approve" | "reject", ids?: string[]) => {
    const targetIds = ids || selectedIds;
    if (targetIds.length === 0) {
      toast({
        title: "คำเตือน",
        description: "กรุณาเลือกรายการก่อน",
        variant: "destructive"
      });
      return;
    }
    setPendingAction({ action, ids: targetIds });
  };

  return (
    <Layout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">อนุมัติการลงทะเบียน</h1>
          <p className="text-slate-600 mt-1">ตรวจสอบและอนุมัติคำขอลงทะเบียนวิชาของนิสิต</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <Clock className="text-yellow-600 shrink-0" size={28} />
              <div>
                <p className="text-xs text-slate-600">รอดำเนินการ</p>
                <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-600 shrink-0" size={28} />
              <div>
                <p className="text-xs text-slate-600">อนุมัติแล้ว</p>
                <p className="text-2xl font-bold text-slate-900">{stats.enrolled}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <XCircle className="text-red-600 shrink-0" size={28} />
              <div>
                <p className="text-xs text-slate-600">ปฏิเสธ</p>
                <p className="text-2xl font-bold text-slate-900">{stats.dropped}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <BookOpen className="text-blue-600 shrink-0" size={28} />
              <div>
                <p className="text-xs text-slate-600">ถอน</p>
                <p className="text-2xl font-bold text-slate-900">{stats.withdrawn}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Registration window config */}
        <Card className="p-4 border border-blue-200 bg-blue-50/30">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex-1">
              <h2 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                ช่วงเวลาลงทะเบียน{semData?.data?.name ? ` — ${semData.data.name}` : ""}
              </h2>
              <p className="text-xs text-slate-500">กำหนดวันเปิด-ปิดรับลงทะเบียน นิสิตจะเห็นกำหนดนี้บนแดชบอร์ด</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">เปิดลงทะเบียน</label>
              <DatePicker value={regOpen} onChange={setRegOpen} placeholder="เลือกวันเปิด" className="w-44" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ปิดลงทะเบียน</label>
              <DatePicker value={regClose} onChange={setRegClose} placeholder="เลือกวันปิด" className="w-44" />
            </div>
            <Button onClick={() => saveRegConfig.mutate()} disabled={saveRegConfig.isPending} className="shrink-0">
              {saveRegConfig.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </Card>

        {/* Search + Filters */}
        <Card className="p-4 border border-slate-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="ค้นหารหัสนิสิต, ชื่อ, รหัสวิชา..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} variant="outline" size="sm">ค้นหา</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Semester Selector */}
              <AppSelect
                value={selectedSemester || "all"}
                onValueChange={(v) => { setSelectedSemester(v === "all" ? "" : v); setSelectedIds([]); setPage(1); }}
                className="text-sm font-medium w-44 shrink-0"
                options={[
                  { value: "all", label: "ทุกภาคเรียน" },
                  ...availableSemesters.map(sem => ({ value: sem, label: `ภาค ${sem}` })),
                ]}
              />
              {/* Status Filter */}
              <div className="flex items-center gap-2 shrink-0">
                <Filter size={14} className="text-slate-500" />
                {[
                  { value: "pending", label: "รอดำเนินการ", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
                  { value: "enrolled", label: "อนุมัติแล้ว", color: "bg-green-100 text-green-700 border-green-300" },
                  { value: "dropped", label: "ปฏิเสธ", color: "bg-red-100 text-red-700 border-red-300" },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setStatusFilter(f.value); setSelectedIds([]); setPage(1); }}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium whitespace-nowrap transition-all ${
                      statusFilter === f.value ? f.color : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Batch Actions */}
        {statusFilter === "pending" && studentGroups.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              เลือก {selectedIds.length} รายวิชา จาก {totalCount} รายการ ({studentGroups.length} นิสิต)
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={toggleAll} className="text-xs">
                {selectedIds.length === registrations.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
              </Button>
              <Button
                size="sm"
                onClick={() => handleAction("approve")}
                disabled={selectedIds.length === 0 || actionMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white text-xs"
              >
                <CheckCircle size={14} className="mr-1" />
                อนุมัติ ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                onClick={() => handleAction("reject")}
                disabled={selectedIds.length === 0 || actionMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white text-xs"
              >
                <XCircle size={14} className="mr-1" />
                ปฏิเสธ ({selectedIds.length})
              </Button>
            </div>
          </div>
        )}

        {/* Student List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : studentGroups.length === 0 ? (
          <Card className="p-12 border border-slate-200 text-center">
            <Clock className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 text-lg">ไม่มีรายการในสถานะนี้</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {studentGroups.map((group) => {
              const allCourseIds = group.courses.map(c => c.id);
              const allSelected = allCourseIds.every(id => selectedIds.includes(id));

              return (
                <Card 
                  key={group.studentCode}
                  className={`border transition-all ${allSelected ? "border-primary/40 bg-primary/5" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="flex items-center justify-between px-5 py-4">
                    {/* Left: Checkbox + Student Info */}
                    <div className="flex items-center gap-4">
                      {statusFilter === "pending" && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleSelectStudent(group.studentCode)}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary shrink-0"
                        />
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                          <User size={20} className="text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono font-bold text-primary">{group.studentCode}</code>
                            <span className="font-medium text-slate-900">{group.studentName}</span>
                          </div>
                          <p className="text-xs text-slate-500">{group.departmentName}</p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Summary + Action */}
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-slate-900">{group.courses.length} วิชา</p>
                        <p className="text-xs text-slate-500">{group.totalCredits} หน่วยกิต</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setModalStudent(group)}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <Eye size={14} />
                        ดูรายละเอียด
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Modal ===== */}
      {modalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setModalStudent(null)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User size={20} className="text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold text-primary">{modalStudent.studentCode}</code>
                    <span className="font-semibold text-slate-900">{modalStudent.studentName}</span>
                  </div>
                  <p className="text-xs text-slate-500">{modalStudent.departmentName}</p>
                </div>
              </div>
              <button 
                onClick={() => setModalStudent(null)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">
                  รายวิชาที่ขอลงทะเบียน (รวมทั้งหมด {modalStudent.courses.length} วิชา, {modalStudent.totalCredits} หน่วยกิต)
                </h3>
              </div>

              <div className="space-y-6">
                {Object.entries(
                  modalStudent.courses.reduce((acc, course) => {
                    if (!acc[course.semester]) acc[course.semester] = [];
                    acc[course.semester].push(course);
                    return acc;
                  }, {} as Record<string, RegistrationRequest[]>)
                )
                .sort(([semA], [semB]) => semB.localeCompare(semA))
                .map(([semester, courses]) => (
                  <div key={semester} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border-b border-slate-200 gap-3">
                      <div className="font-semibold text-slate-800">
                        ภาคเรียน {semester} <span className="text-sm font-normal text-slate-600">({courses.length} วิชา, {courses.reduce((sum, c) => sum + c.credits, 0)} หน่วยกิต)</span>
                      </div>
                      {statusFilter === "pending" && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleAction("reject", courses.map(c => c.id))}
                            disabled={actionMutation.isPending}
                          >
                            <XCircle size={14} className="mr-1" />
                            ปฏิเสธภาคนี้
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                            onClick={() => handleAction("approve", courses.map(c => c.id))}
                            disabled={actionMutation.isPending}
                          >
                            <CheckCircle size={14} className="mr-1" />
                            อนุมัติภาคนี้
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      {courses.map((course) => (
                        <div
                          key={course.id}
                          className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <code className="text-sm font-mono font-bold text-primary">{course.courseCode}</code>
                              </div>
                              <p className="text-sm text-slate-800">{course.courseName}</p>
                              <p className="text-xs text-slate-400 mt-1">ยื่นเมื่อ {course.enrolledAt}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-primary">{course.credits} หน่วยกิต</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            {statusFilter === "pending" && (
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
                <Button
                  variant="outline"
                  onClick={() => setModalStudent(null)}
                  className="text-sm"
                >
                  ปิด
                </Button>
                <Button
                  onClick={() => handleAction("reject", modalStudent.courses.map(c => c.id))}
                  disabled={actionMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm"
                >
                  <XCircle size={16} className="mr-1.5" />
                  ปฏิเสธทั้งหมด
                </Button>
                <Button
                  onClick={() => handleAction("approve", modalStudent.courses.map(c => c.id))}
                  disabled={actionMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm"
                >
                  <CheckCircle size={16} className="mr-1.5" />
                  อนุมัติทั้งหมด
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={(o) => !o && setPendingAction(null)}
        title={pendingAction?.action === "reject" ? "ยืนยันการปฏิเสธ" : "ยืนยันการอนุมัติ"}
        description={
          pendingAction
            ? `${pendingAction.action === "reject" ? "ปฏิเสธ" : "อนุมัติ"}คำขอลงทะเบียน ${pendingAction.ids.length} รายการ?`
            : ""
        }
        confirmLabel={pendingAction?.action === "reject" ? "ปฏิเสธ" : "อนุมัติ"}
        variant={pendingAction?.action === "reject" ? "danger" : "default"}
        loading={actionMutation.isPending}
        onConfirm={() => {
          if (pendingAction) actionMutation.mutate({ enrollmentIds: pendingAction.ids, action: pendingAction.action });
          setPendingAction(null);
        }}
      />
    </Layout>
  );
}
