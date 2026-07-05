"use client";
export const dynamic = "force-dynamic";

import { useState, useRef } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileUp, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AppSelect } from "@/components/ui/app-select";

interface ImportLog {
  id: string;
  date: string;
  type: string;
  file: string;
  status: "success" | "pending" | "error";
  records: number;
  message: string;
}

export default function AdminImportData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("students");
  const [isDragging, setIsDragging] = useState(false);

  const { data: logsResponse, isLoading } = useQuery({
    queryKey: ['adminImportLogs'],
    queryFn: async () => {
      const res = await fetch('/api/import/admin');
      if (!res.ok) throw new Error('Failed to fetch import logs');
      return res.json();
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File, type: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("importType", type);

      const res = await fetch('/api/import/admin', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to upload file');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminImportLogs'] });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({
        title: "สำเร็จ",
        description: "อัปโหลดและนำเข้าไฟล์สำเร็จแล้ว!",
      });
    },
    onError: (error: any) => {
      console.error(error);
      toast({
        title: "ข้อผิดพลาด",
        description: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์: " + (error.message || "กรุณาลองใหม่อีกครั้ง"),
        variant: "destructive",
      });
    }
  });

  const importLogs: ImportLog[] = logsResponse?.data || [];

  const templates: Record<string, { headers: string; example: string; filename: string }> = {
    students: {
      headers: "รหัสนิสิต,คำนำหน้า,ชื่อ,นามสกุล,อีเมล,เบอร์โทร,คณะ,สาขา,ปีที่เข้า",
      example: "6310000001,นาย,สมชาย,ใจดี,somchai@ku.ac.th,081-234-5678,ศิลปศาสตร์และวิทยาศาสตร์,วิทยาการคอมพิวเตอร์,2563",
      filename: "template_students.csv",
    },
    teachers: {
      headers: "รหัสอาจารย์,คำนำหน้า,ชื่อ,นามสกุล,ตำแหน่ง,อีเมล,เบอร์โทร,คณะ,สาขา",
      example: "T001,ผศ.ดร.,สมศักดิ์,ใจดี,ผู้ช่วยศาสตราจารย์,somsak@ku.ac.th,089-123-4567,ศิลปศาสตร์และวิทยาศาสตร์,วิทยาการคอมพิวเตอร์",
      filename: "template_teachers.csv",
    },
    courses: {
      headers: "รหัสวิชา,ชื่อวิชา(ไทย),ชื่อวิชา(อังกฤษ),หน่วยกิต,ประเภท,คณะ,วันที่เรียน,เวลาเริ่ม,เวลาสิ้นสุด,ห้องเรียน,รหัสอาจารย์",
      example: "01418221,โครงสร้างข้อมูล,Data Structures,3,บังคับ,ศิลปศาสตร์และวิทยาศาสตร์,จันทร์,09:00,12:00,TBA,T001",
      filename: "template_courses.csv",
    },
    curriculum: {
      headers: "รหัสวิชา,ชื่อวิชา,หน่วยกิต,ปีหลักสูตร,ปีที่,ภาคเรียน,ประเภท,วันที่เรียน,เวลาเริ่ม,เวลาสิ้นสุด,ห้องเรียน,รหัสอาจารย์",
      example: "01418221,โครงสร้างข้อมูล,3,2565,2,1,บังคับ,จันทร์,09:00,12:00,TBA,T001",
      filename: "template_curriculum.csv",
    },
    registration: {
      headers: "รหัสนิสิต,รหัสวิชา,ภาคเรียน,ปีการศึกษา,กลุ่ม",
      example: "6310000001,01418221,1,2567,1",
      filename: "template_registration.csv",
    },
    "registration-plan": {
      headers: "ปีหลักสูตร,ปีที่,ภาคเรียน,รหัสวิชา,ชื่อวิชา,หน่วยกิต,ประเภท",
      example: "2565,1,1,01418112,คอมพิวเตอร์เบื้องต้น,3,บังคับ",
      filename: "template_registration_plan.csv",
    },
    grades: {
      headers: "รหัสนิสิต,รหัสวิชา,ภาคเรียน,ปีการศึกษา,เกรด",
      example: "6310000001,01418221,1,2567,A",
      filename: "template_grades.csv",
    },
  };

  const downloadTemplate = () => {
    const tmpl = templates[importType];
    if (!tmpl) return;
    const csvContent = "\uFEFF" + tmpl.headers + "\n" + tmpl.example + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tmpl.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "ไม่ได้เลือกไฟล์",
        description: "กรุณาเลือกไฟล์ก่อนทำการอัปโหลด",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate({ file: selectedFile, type: importType });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "success":
        return {
          icon: CheckCircle,
          label: "สำเร็จ",
          color: "bg-green-100 text-green-700",
        };
      case "pending":
        return {
          icon: Clock,
          label: "อยู่ระหว่างประมวลผล",
          color: "bg-yellow-100 text-yellow-700",
        };
      case "error":
        return {
          icon: AlertCircle,
          label: "ข้อผิดพลาด",
          color: "bg-red-100 text-red-700",
        };
      default:
        return {
          icon: AlertCircle,
          label: "ไม่ทราบ",
          color: "bg-gray-100 text-gray-700",
        };
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">นำเข้าข้อมูล</h1>
          <p className="text-slate-600 mt-1">
            นำเข้าข้อมูลจากไฟล์ CSV เข้าสู่ระบบ
          </p>
        </div>

        {/* Upload Section */}
        <Card className="p-6 border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            อัปโหลดไฟล์ข้อมูล
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                เลือกประเภทข้อมูล
              </label>
              <AppSelect
                value={importType}
                onValueChange={(v) => setImportType(v)}
                className="w-full"
                options={[
                  { value: "students", label: "นิสิต" },
                  { value: "teachers", label: "อาจารย์" },
                  { value: "courses", label: "วิชา" },
                  { value: "curriculum", label: "หลักสูตร" },
                  { value: "registration", label: "การลงทะเบียน" },
                  { value: "registration-plan", label: "แผนการลงทะเบียน" },
                  { value: "grades", label: "เกรด" },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                เลือกไฟล์ CSV
              </label>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv" 
                onChange={handleFileChange} 
              />
              <div 
                className={`border-2 border-dashed ${isDragging ? 'border-primary bg-primary/5' : 'border-slate-300'} rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className={`mx-auto mb-2 ${isDragging ? 'text-primary' : 'text-slate-400'}`} size={32} />
                <p className="text-slate-700 font-medium mb-1">
                  {selectedFile ? `ไฟล์ที่เลือก: ${selectedFile.name}` : "ลากไฟล์มาที่นี่ หรือคลิกเพื่อเลือก"}
                </p>
                <p className="text-xs text-slate-500">
                  รองรับไฟล์ CSV เท่านั้น สูงสุด 10 MB
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                ตัวเลือกเพิ่มเติม
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 border border-slate-300 rounded"
                  />
                  <span className="text-sm text-slate-700">
                    หัวข้อแถวแรก (Header)
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 border border-slate-300 rounded"
                  />
                  <span className="text-sm text-slate-700">
                    อัปเดตข้อมูลที่มีอยู่
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleUpload} 
                disabled={!selectedFile || uploadMutation.isPending}
                className="flex items-center gap-2"
              >
                {uploadMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                {uploadMutation.isPending ? "กำลังอัปโหลด..." : "อัปโหลดและนำเข้า"}
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>ดาวน์โหลดเทมเพลต</Button>
            </div>
          </div>
        </Card>

        {/* Information */}
        <Card className="p-6 border border-blue-200 bg-blue-50">
          <h3 className="font-bold text-blue-900 mb-2">ข้อมูลเพิ่มเติม</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• ไฟล์ต้องเป็นไฟล์ CSV ด้วยการเข้ารหัส UTF-8</li>
            <li>• ตรวจสอบให้แน่ใจว่าชื่อคอลัมน์ตรงกับเทมเพลต</li>
            <li>• ไฟล์ขนาดใหญ่อาจใช้เวลาในการประมวลผล</li>
            <li>• สำรองข้อมูลเดิมก่อนการนำเข้า</li>
          </ul>
        </Card>

        {/* Import History */}
        <Card className="p-6 border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            ประวัติการนำเข้า
          </h2>

          <div className="space-y-3">
            {importLogs.map((log) => {
              const statusInfo = getStatusInfo(log.status);
              const StatusIcon = statusInfo.icon;
              return (
                <div
                  key={log.id}
                  className="p-4 border border-slate-200 rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon size={20} className={statusInfo.color} />
                        <span className="font-medium text-slate-900">
                          {log.type}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-1">
                        ไฟล์: <code className="font-mono">{log.file}</code>
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{log.date}</span>
                        <span>
                          {log.status === "error"
                            ? "ข้อมูล: -"
                            : `${log.records} เรคคอร์ด`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {log.message}
                      </p>
                      {log.status !== "error" && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => toast({
                          title: "รายละเอียดการนำเข้า",
                          description: `รหัสอ้างอิง: ${log.id}\nไฟล์: ${log.file}\nประเภท: ${log.type}\nข้อมูลสำเร็จ: ${log.records} เรคคอร์ด\nเวลา: ${log.date}`
                        })}>
                          ดูรายละเอียด
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
