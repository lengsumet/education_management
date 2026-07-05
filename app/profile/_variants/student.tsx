"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Save, X, Loader2, Camera, Upload } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function StudentProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editData, setEditData] = useState<any>({});
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Camera & Image handling states
  const [isPhotoOptionOpen, setIsPhotoOptionOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: profileResponse, isLoading, isError } = useQuery({
    queryKey: ['studentProfile'],
    queryFn: async () => {
      const res = await fetch("/api/profile/student");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    }
  });

  const profile = profileResponse?.data || {};

  const profileBody = profileResponse?.data;
  // Sync editData when profile is successfully fetched or editing is toggled
  useEffect(() => {
    if (!isEditing && profileBody) {
      setEditData(profileBody);
    }
  }, [profileBody, isEditing]);

  const updateMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      const res = await fetch("/api/profile/student", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to edit profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentProfile'] });
      toast({
        title: "สำเร็จ",
        description: "บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว",
        className: "bg-green-50 text-green-900 border-green-200"
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "สำเร็จ",
        description: data.message || "เปลี่ยนรหัสผ่านสำเร็จ",
        className: "bg-green-50 text-green-900 border-green-200"
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: any) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/profile/student/avatar", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to upload avatar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentProfile'] });
      toast({
        title: "สำเร็จ",
        description: "อัปโหลดรูปโปรไฟล์เสร็จสิ้น",
        className: "bg-green-50 text-green-900 border-green-200"
      });
    },
    onError: (error: any) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "ไฟล์ขนาดใหญ่เกินไป",
          description: "โปรดอัปโหลดรูปภาพขนาดไม่เกิน 5MB",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      setIsEditing(true);
    }
  };

  const handleCameraStart = async () => {
    setIsPhotoOptionOpen(false);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      toast({ 
        title: "เกิดข้อผิดพลาด", 
        description: "ไม่สามารถเข้าถึงกล้องได้ โปรดตรวจสอบการอนุญาตใช้งาน", 
        variant: "destructive" 
      });
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
            setSelectedFile(file);
            setIsEditing(true);
            stopCamera();
          }
        }, "image/jpeg", 0.95);
      }
    }
  };

  const handleSave = async () => {
    if (selectedFile) {
      try {
        await uploadMutation.mutateAsync(selectedFile);
      } catch (err) {
        return; // Stop saving if upload fails
      }
    }

    updateMutation.mutate({
      firstName: editData.firstName,
      lastName: editData.lastName,
      phone: editData.phone,
      address: editData.address
    });
    setSelectedFile(null);
  };

  const handleCancel = () => {
    setEditData(profile);
    setSelectedFile(null);
    setIsEditing(false);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน",
        variant: "destructive"
      });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร",
        variant: "destructive"
      });
      return;
    }
    passwordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    });
  };

  if (isLoading) {
    return (
      <Layout role="student">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังโหลดโปรไฟล์...</p>
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

  return (
    <Layout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">โปรไฟล์ของฉัน</h1>
            <p className="text-slate-600 mt-1">จัดการข้อมูลส่วนตัวและการศึกษา</p>
          </div>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2"
            >
              <Edit2 size={16} />
              แก้ไข
            </Button>
          )}
        </div>

        {/* Profile Card */}
        <Card className="p-6 border border-slate-200">
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <div className="relative group">
              <div className="w-24 h-24 bg-primary rounded-lg flex items-center justify-center text-white text-4xl font-bold uppercase overflow-hidden">
                {selectedFile ? (
                  <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full h-full object-cover" />
                ) : profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  profile.firstName ? profile.firstName[0] : "ส"
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
              <button 
                onClick={() => setIsPhotoOptionOpen(true)}
                disabled={uploadMutation.isPending}
                className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg disabled:opacity-50"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-xs">เปลี่ยนรูป</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {profile.firstName} {profile.lastName}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">รหัสนิสิต</p>
                  <p className="font-semibold text-slate-900">
                    {profile.studentId}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">ชั้นปี</p>
                  <p className="font-semibold text-slate-900">
                    ชั้นปีที่ {profile.yearLevel || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">GPA</p>
                  <p className="font-semibold text-slate-900">{profile.gpa}</p>
                </div>
                <div>
                  <p className="text-slate-600">หน่วยกิตที่ได้</p>
                  <p className="font-semibold text-slate-900">
                    {profile.totalCredits}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Personal Information */}
        <Card className="p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            ข้อมูลส่วนตัว
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ชื่อ
                </label>
                {isEditing ? (
                  <Input
                    value={editData.firstName}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        firstName: e.target.value,
                      })
                    }
                    className="border border-slate-300"
                  />
                ) : (
                  <p className="text-slate-900">{profile.firstName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  นามสกุล
                </label>
                {isEditing ? (
                  <Input
                    value={editData.lastName}
                    onChange={(e) =>
                      setEditData({ ...editData, lastName: e.target.value })
                    }
                    className="border border-slate-300"
                  />
                ) : (
                  <p className="text-slate-900">{profile.lastName}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  อีเมล (แก้ไขไม่ได้)
                </label>
                <div className="flex items-center">
                  <Input
                    type="email"
                    value={profile.email}
                    disabled
                    className="border border-slate-200 bg-slate-50 text-slate-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  เบอร์โทรศัพท์
                </label>
                {isEditing ? (
                  <Input
                    value={editData.phone}
                    onChange={(e) =>
                      setEditData({ ...editData, phone: e.target.value })
                    }
                    className="border border-slate-300"
                  />
                ) : (
                  <p className="text-slate-900">{profile.phone}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ที่อยู่
              </label>
              {isEditing ? (
                <Input
                  value={editData.address}
                  onChange={(e) =>
                    setEditData({ ...editData, address: e.target.value })
                  }
                  className="border border-slate-300"
                />
              ) : (
                <p className="text-slate-900">{profile.address}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Academic Information */}
        <Card className="p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            ข้อมูลการศึกษา
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                คณะ
              </label>
              <p className="text-slate-900">{profile.faculty}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ภาควิชา/สาขาวิชา
              </label>
              <p className="text-slate-900">{profile.department}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ปีที่เข้าศึกษา (รหัส 2 ตัวแรก)
              </label>
              <p className="text-slate-900">{profile.admissionYear}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ชั้นปีปัจจุบัน
              </label>
              <p className="text-slate-900">ชั้นปีที่ {profile.yearLevel || "-"}</p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex justify-end gap-3 mt-8">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex items-center gap-2"
              disabled={updateMutation.isPending}
            >
              <X size={16} />
              ยกเลิก
            </Button>
            <Button onClick={handleSave} className="flex items-center gap-2" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />}
              บันทึกการเปลี่ยนแปลง
            </Button>
          </div>
        )}

        {/* Change Password */}
        <Card className="p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            เปลี่ยนรหัสผ่าน
          </h3>
          <form className="space-y-4" onSubmit={handleChangePassword}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                รหัสผ่านเดิม
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                รหัสผ่านใหม่
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ยืนยันรหัสผ่าน
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="border border-slate-300"
              />
            </div>
            <Button 
                type="submit" 
                disabled={passwordMutation.isPending || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                className="flex items-center gap-2"
            >
              {passwordMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : null}
              อัปเดตรหัสผ่าน
            </Button>
          </form>
        </Card>
      </div>

      {/* Photo Selection Modal */}
      {isPhotoOptionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold mb-4">เลือกวิธีเปลี่ยนรูปโปรไฟล์</h3>
            <div className="space-y-3">
              <Button 
                className="w-full flex items-center justify-center gap-2" 
                onClick={() => {
                  setIsPhotoOptionOpen(false);
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="w-5 h-5" /> อัปโหลดจากไฟล์
              </Button>
              <Button 
                className="w-full flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary/5" 
                variant="outline"
                onClick={handleCameraStart}
              >
                <Camera className="w-5 h-5" /> ถ่ายรูปจากกล้อง
              </Button>
            </div>
            <Button 
              variant="ghost" 
              className="w-full mt-4"
              onClick={() => setIsPhotoOptionOpen(false)}
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl px-4 flex flex-col items-center">
            <button 
              onClick={stopCamera}
              className="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full hover:bg-black/70 z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-white text-xl font-bold mb-4">ถ่ายรูปโปรไฟล์</h3>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center border border-white/20">
              {/* Force mirrors for camera view */}
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover scale-x-[-1]" 
                autoPlay 
                playsInline 
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <p className="text-white/70 text-sm mt-4 text-center">หันหน้าให้ตรงกรอบและกดปุ่มถ่ายรูป</p>
            <Button 
              className="mt-6 rounded-full w-16 h-16 flex items-center justify-center border-4 border-white/80 shadow-lg bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              onClick={takePhoto}
            >
              <Camera className="w-7 h-7 text-white" />
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
