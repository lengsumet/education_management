const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY || process.env.nodemailer || "";
const SENDER_DOMAIN = process.env.SENDER_DOMAIN || "test-51ndgwv8q0xlzqx8.mlsender.net";

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-w-md mx-auto p-4 border rounded shadow">
      <h2 style="color: #16a34a;">รีเซ็ตรหัสผ่านระบบการศึกษา</h2>
      <p>คุณได้รับอีเมลนี้เพราะมีการแจ้งลืมรหัสผ่านสำหรับบัญชี <strong>${email}</strong> ในระบบของเรา</p>
      <p>กรุณาคลิกที่ปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>
      <div style="margin: 20px 0;">
        <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background-color:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">คลิกเพื่อตั้งรหัสผ่านใหม่</a>
      </div>
      <p style="color:red; font-size:12px;">ลิงก์นี้จะหมดอายุภายใน 15 นาที</p>
      <p style="color:#666; font-size:12px;">หากคุณไม่ได้เป็นผู้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยต่ออีเมลฉบับนี้</p>
    </div>
  `;

  // ถ้าไม่มี API key → ใช้ dev fallback mode (log ลิงก์ใน console)
  if (!MAILERSEND_API_KEY) {
    console.warn("⚠️  ไม่พบ MAILERSEND_API_KEY — ใช้ Dev Fallback Mode");
    console.log("═══════════════════════════════════════════");
    console.log(`📧 [DEV] Password Reset Email for: ${email}`);
    console.log(`🔗 Reset Link: ${resetLink}`);
    console.log("═══════════════════════════════════════════");
    return null;
  }

  const payload = {
    from: {
      email: `noreply@${SENDER_DOMAIN}`,
      name: "ระบบจัดการการศึกษา มก."
    },
    to: [{ email }],
    subject: "รีเซ็ตรหัสผ่านของคุณ",
    html: htmlContent
  };

  try {
    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Authorization": `Bearer ${MAILERSEND_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MailerSend Error:", errorText);
      // Fallback: ส่ง email ไม่ได้ → log ลิงก์ใน console แทน (ไม่ crash)
      console.warn("⚠️  ส่งอีเมลไม่สำเร็จ — Fallback: แสดง Reset Link ใน console");
      console.log("═══════════════════════════════════════════");
      console.log(`📧 [FALLBACK] Password Reset Email for: ${email}`);
      console.log(`🔗 Reset Link: ${resetLink}`);
      console.log("═══════════════════════════════════════════");
      return null;
    }

    console.log("📧 ส่งอีเมลจริงสำเร็จ!");
  } catch (err) {
    console.error("Email send error:", err);
    // Fallback: network error → log ลิงก์ใน console แทน
    console.warn("⚠️  Network error — Fallback: แสดง Reset Link ใน console");
    console.log("═══════════════════════════════════════════");
    console.log(`📧 [FALLBACK] Password Reset Email for: ${email}`);
    console.log(`🔗 Reset Link: ${resetLink}`);
    console.log("═══════════════════════════════════════════");
  }

  return null;
}
