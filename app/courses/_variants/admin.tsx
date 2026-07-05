"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, Trash2, Search, Loader2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AppSelect } from "@/components/ui/app-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: string;
  description?: string;
  department?: string;
  coordinatorId?: string;
  coordinatorName?: string;
  prerequisites?: { id: string; code: string; name: string }[];
}

export default function AdminCourses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("ทั้งหมด");
  const [selectedCurriculumYear, setSelectedCurriculumYear] = useState<string>("ทั้งหมด");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [prereqSearch, setPrereqSearch] = useState("");
  const [showPrereqDropdown, setShowPrereqDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    credits: 3,
    type: "วิชาบังคับ",
    description: "",
    coordinatorId: "",
    dayOfWeek: "MON",
    startTime: "09:00",
    endTime: "12:00",
    room: "",
    prerequisites: [] as { id: string; code: string; name: string }[]
  });

  // Fetch Courses
  const { data: coursesResponse, isLoading } = useQuery({
    queryKey: ['adminCourses', selectedCurriculumYear],
    queryFn: async () => {
      const params = selectedCurriculumYear !== "ทั้งหมด" ? `?curriculumYear=${selectedCurriculumYear}` : "";
      const res = await fetch(`/api/courses/admin${params}`);
      if (!res.ok) throw new Error('Failed to fetch courses');
      return res.json();
    }
  });

  // Fetch Teachers
  const { data: teachersResponse } = useQuery({
    queryKey: ['adminTeachers'],
    queryFn: async () => {
      const res = await fetch('/api/teachers/admin');
      if (!res.ok) throw new Error('Failed to fetch teachers');
      return res.json();
    }
  });
  const teachers = teachersResponse?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (newCourse: any) => {
      const res = await fetch('/api/courses/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Failed to create course");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCourses'] });
      closeForm();
      toast({ title: "สำเร็จ", description: "บันทึกข้อมูลรายวิชาเรียบร้อยแล้ว" });
    },
    onError: (err: any) => {
      toast({ title: "ข้อผิดพลาด", description: err.message || "เกิดข้อผิดพลาดในการบันทึก", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (course: any) => {
      const res = await fetch('/api/courses/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(course),
      });
      if (!res.ok) throw new Error('Failed to update course');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCourses'] });
      closeForm();
      toast({ title: "สำเร็จ", description: "อัปเดตข้อมูลรายวิชาเรียบร้อยแล้ว" });
    },
    onError: (err: any) => {
      toast({ title: "ข้อผิดพลาด", description: err.message || "เกิดข้อผิดพลาดในการอัปเดต", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/courses/admin?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete course');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCourses'] });
      toast({ title: "สำเร็จ", description: "ลบรายวิชาเรียบร้อยแล้ว" });
    },
    onError: (err: any) => {
      toast({ title: "ข้อผิดพลาด", description: err.message || "เกิดข้อผิดพลาดในการลบ", variant: "destructive" });
    }
  });

  const courses: Course[] = coursesResponse?.data || [];

  const filteredCourses = courses.filter((c) => {
    const matchesSearch = c.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "ทั้งหมด" || c.type === selectedType;
    return matchesSearch && matchesType;
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTeacherSearch("");
    setShowTeacherDropdown(false);
    setPrereqSearch("");
    setShowPrereqDropdown(false);
    setFormData({ 
      code: "", name: "", credits: 3, type: "วิชาบังคับ", description: "", coordinatorId: "",
      dayOfWeek: "MON", startTime: "09:00", endTime: "12:00", room: "", prerequisites: []
    });
  };

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    setFormData({ 
      code: c.code, 
      name: c.name, 
      credits: c.credits, 
      type: c.type, 
      description: c.description || "",
      coordinatorId: c.coordinatorId || "",
      dayOfWeek: c.dayOfWeek || "MON",
      startTime: c.startTime || "09:00",
      endTime: c.endTime || "12:00",
      room: c.room || "",
      prerequisites: c.prerequisites || []
    });
    setTeacherSearch(c.coordinatorName && c.coordinatorName !== "ไม่ระบุ" ? c.coordinatorName : "");
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.code || !formData.name) return;

    const submitData = {
      ...formData,
      prerequisites: formData.prerequisites.map(p => p.id)
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => {
    setPendingDelete(id);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "วิชาบังคับ": return "bg-blue-100 text-blue-700";
      case "วิชาเลือก": return "bg-purple-100 text-purple-700";
      case "วิชาศึกษาทั่วไป": return "bg-green-100 text-green-700";
      case "วิชาเสรี": return "bg-orange-100 text-orange-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  if (isLoading) {
    return (
      <Layout role="admin">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">จัดการรายวิชาทั้งหมด</h1>
            <p className="text-slate-600 mt-1">คลังรายวิชาในระบบ สามารถเพิ่ม แก้ไข และลบได้เปิดอิสระ</p>
          </div>
          <Button
            onClick={() => {
              closeForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            เพิ่มรายวิชา
          </Button>
        </div>

        {/* Dashboard Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 border border-slate-200">
            <p className="text-xs text-slate-600">วิชาทั้งหมด</p>
            <p className="text-2xl font-bold text-slate-900">{courses.length}</p>
          </Card>
          <Card className="p-4 border border-slate-200">
            <p className="text-xs text-slate-600">วิชาบังคับ</p>
            <p className="text-2xl font-bold text-blue-600">{courses.filter(c => c.type === "วิชาบังคับ").length}</p>
          </Card>
          <Card className="p-4 border border-slate-200">
            <p className="text-xs text-slate-600">วิชาเลือก</p>
            <p className="text-2xl font-bold text-purple-600">{courses.filter(c => c.type === "วิชาเลือก").length}</p>
          </Card>
          <Card className="p-4 border border-slate-200">
            <p className="text-xs text-slate-600">วิชาศึกษาทั่วไป</p>
            <p className="text-2xl font-bold text-green-600">{courses.filter(c => c.type === "วิชาศึกษาทั่วไป").length}</p>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <Input
              placeholder="ค้นหารหัสวิชา หรือ ชื่อวิชา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border border-slate-300"
            />
          </div>
          <AppSelect
            value={selectedType}
            onValueChange={(v) => setSelectedType(v)}
            className="w-full sm:w-48 shrink-0"
            options={[
              { value: "ทั้งหมด", label: "ทุกประเภทวิชา" },
              { value: "วิชาบังคับ", label: "วิชาบังคับ" },
              { value: "วิชาเลือก", label: "วิชาเลือก" },
              { value: "วิชาศึกษาทั่วไป", label: "วิชาศึกษาทั่วไป" },
            ]}
          />
          {coursesResponse?.curricula && coursesResponse.curricula.length > 0 && (
            <AppSelect
              value={selectedCurriculumYear}
              onValueChange={(v) => setSelectedCurriculumYear(v)}
              className="w-full sm:w-64 shrink-0"
              options={[
                { value: "ทั้งหมด", label: "ทุกปีหลักสูตร" },
                ...coursesResponse.curricula.map((c: any) => ({
                  value: String(c.year),
                  label: `หลักสูตร ${c.year} (${c.name})`,
                })),
              ]}
            />
          )}
        </div>

        {showForm && (
          <Card className="p-6 border border-primary relative">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {editingId ? "แก้ไขรายละเอียดวิชา" : "เพิ่มวิชาใหม่เข้าระบบ"}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">รหัสวิชา</label>
                  <Input 
                    placeholder="เช่น 01418xxx" 
                    value={formData.code} 
                    maxLength={8}
                    onChange={(e) => setFormData({...formData, code: e.target.value})} 
                    disabled={!!editingId}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อวิชา</label>
                  <Input 
                    placeholder="ใส่ชื่อวิชา..." 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">หน่วยกิต</label>
                  <Input 
                    type="number" min="1" max="10" 
                    value={formData.credits} 
                    onChange={(e) => setFormData({...formData, credits: Number(e.target.value)})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทวิชา</label>
                  <AppSelect
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v })}
                    className="w-full"
                    options={[
                      { value: "วิชาบังคับ", label: "วิชาบังคับ" },
                      { value: "วิชาเลือก", label: "วิชาเลือก" },
                      { value: "วิชาศึกษาทั่วไป", label: "วิชาศึกษาทั่วไป" },
                      { value: "วิชาเสรี", label: "วิชาเสรี" },
                    ]}
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1">อาจารย์ผู้รับผิดชอบ</label>
                  <Input
                    placeholder="พิมพ์ค้นหาชื่ออาจารย์..."
                    value={teacherSearch}
                    onChange={(e) => {
                      setTeacherSearch(e.target.value);
                      setShowTeacherDropdown(true);
                      if (e.target.value === "") {
                        setFormData({ ...formData, coordinatorId: "" });
                      }
                    }}
                    onFocus={() => setShowTeacherDropdown(true)}
                  />
                  {showTeacherDropdown && teacherSearch && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {teachers
                        .filter((t: any) =>
                          t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
                          t.code.toLowerCase().includes(teacherSearch.toLowerCase())
                        )
                        .slice(0, 8)
                        .map((t: any) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, coordinatorId: t.id });
                              setTeacherSearch(`${t.name} (${t.code})`);
                              setShowTeacherDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-900">{t.name}</span>
                            <code className="text-xs text-slate-500">{t.code}</code>
                          </button>
                        ))}
                      {teachers.filter((t: any) =>
                        t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
                        t.code.toLowerCase().includes(teacherSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-400">ไม่พบอาจารย์</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1">วิชาบังคับก่อน (Prerequisites)</label>
                  <Input
                    placeholder="พิมพ์ค้นหารหัส หรือ ชื่อวิชา..."
                    value={prereqSearch}
                    onChange={(e) => {
                      setPrereqSearch(e.target.value);
                      setShowPrereqDropdown(true);
                    }}
                    onFocus={() => setShowPrereqDropdown(true)}
                  />
                  {showPrereqDropdown && prereqSearch && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {courses
                        .filter((c: any) =>
                          c.id !== editingId && // Prevent self-referencing
                          !formData.prerequisites.some(p => p.id === c.id) && // Prevent duplicates
                          (c.name.toLowerCase().includes(prereqSearch.toLowerCase()) ||
                           c.code.toLowerCase().includes(prereqSearch.toLowerCase()))
                        )
                        .slice(0, 8)
                        .map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFormData({ 
                                ...formData, 
                                prerequisites: [...formData.prerequisites, { id: c.id, code: c.code, name: c.name }] 
                              });
                              setPrereqSearch("");
                              setShowPrereqDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-900">{c.name}</span>
                            <code className="text-xs text-orange-600 font-bold">{c.code}</code>
                          </button>
                        ))}
                    </div>
                  )}
                  {formData.prerequisites.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {formData.prerequisites.map(p => (
                        <div key={p.id} className="flex items-center gap-1 bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-md border border-orange-200">
                          <span className="font-bold font-mono">{p.code}</span>
                          <button 
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              prerequisites: formData.prerequisites.filter(pr => pr.id !== p.id)
                            })}
                            className="text-orange-500 hover:text-orange-700 ml-1"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">วันในสัปดาห์</label>
                  <AppSelect
                    value={formData.dayOfWeek}
                    onValueChange={(v) => setFormData({ ...formData, dayOfWeek: v })}
                    className="w-full"
                    options={[
                      { value: "MON", label: "วันจันทร์" },
                      { value: "TUE", label: "วันอังคาร" },
                      { value: "WED", label: "วันพุธ" },
                      { value: "THU", label: "วันพฤหัสบดี" },
                      { value: "FRI", label: "วันศุกร์" },
                      { value: "SAT", label: "วันเสาร์" },
                      { value: "SUN", label: "วันอาทิตย์" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">เวลาเริ่ม</label>
                  <Input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} className="bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">เวลาสิ้นสุด</label>
                  <Input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} className="bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ห้องเรียน</label>
                  <Input placeholder="เช่น LH101" value={formData.room} onChange={(e) => setFormData({...formData, room: e.target.value})} className="bg-white" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="animate-spin" size={16} /> : "บันทึกข้อมูล"}
                </Button>
                <Button variant="outline" onClick={closeForm}>ยกเลิก</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Display Course Table */}
        <Card className="border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-sm font-medium text-slate-700">
                  <th className="p-4">วิชา</th>
                  <th className="p-4">ประเภท/หน่วยกิต</th>
                  <th className="p-4">อจ.ผู้รับผิดชอบ</th>
                  <th className="p-4">เวลาเรียน (อาคาร/ห้อง)</th>
                  <th className="p-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      ไม่พบหลักสูตรหรือรายวิชาในระบบ
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-primary">{c.code}</span>
                          <span className="font-medium text-slate-900 text-sm mt-1">{c.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${getTypeColor(c.type)}`}>
                            {c.type}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">{c.credits} หน่วยกิต</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        {c.coordinatorName || "ไม่ระบุ"}
                      </td>
                      <td className="p-4">
                        {(c as any).dayOfWeek && (
                          <div className="flex flex-col text-sm text-slate-700">
                            <span className="font-medium">
                              {
                                (c as any).dayOfWeek === "MON" ? "จันทร์" :
                                (c as any).dayOfWeek === "TUE" ? "อังคาร" :
                                (c as any).dayOfWeek === "WED" ? "พุธ" :
                                (c as any).dayOfWeek === "THU" ? "พฤหัส" :
                                (c as any).dayOfWeek === "FRI" ? "ศุกร์" :
                                (c as any).dayOfWeek === "SAT" ? "เสาร์" : "อาทิตย์"
                              } {(c as any).startTime} - {(c as any).endTime} น.
                            </span>
                            <span className="text-xs text-slate-500 mt-1">ห้อง {(c as any).room || "รอประกาศ"}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEdit(c)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <ConfirmDialog
          open={!!pendingDelete}
          onOpenChange={(o) => !o && setPendingDelete(null)}
          title="ลบรายวิชา"
          description="ต้องการลบรายวิชานี้ใช่ไหม? การใช้งานในหลักสูตรจะถูกกระทบ"
          confirmLabel="ลบรายวิชา"
          variant="danger"
          loading={deleteMutation.isPending}
          onConfirm={() => {
            if (pendingDelete) deleteMutation.mutate(pendingDelete);
            setPendingDelete(null);
          }}
        />
      </div>
    </Layout>
  );
}
