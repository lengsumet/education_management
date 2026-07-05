-- ============================================================
-- ระบบจัดการการศึกษา (Education Management System)
-- MySQL Schema — generated to match prisma/schema.prisma (source of truth)
-- ============================================================
-- หมายเหตุ:
--   * DB จริงของโปรเจกต์ตั้งขึ้นด้วย `npm run db:push` (Prisma) ไม่ใช่ไฟล์นี้
--   * ไฟล์นี้เป็น reference ที่ "ตรงกับ" schema.prisma — ไว้แนบรายงาน/อ้างอิง
--   * ชนิด/ดีฟอลต์ตรงกับที่ Prisma push จริงบน MySQL 8:
--       DateTime            -> DATETIME(3)
--       @db.Date / @db.Time -> DATE / TIME
--       Json                -> JSON  (ใส่ DEFAULT บน JSON ไม่ได้ใน MySQL)
--       enum                -> ENUM(...) inline
--   * updated_at: Prisma set ค่าเองที่ชั้นแอป (@updatedAt) — ไม่มี ON UPDATE
--   * ทุกตาราง InnoDB + utf8mb4 (รองรับภาษาไทย)
--   * ลำดับตารางเรียงตาม dependency ของ FK แล้ว รันไล่จากบนลงล่างได้เลย
-- ============================================================

SET NAMES utf8mb4;

-- ===================== 1. USERS =====================
CREATE TABLE users (
    user_id         INT AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('student','teacher','admin') NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    address         VARCHAR(300),
    avatar_url      VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    approved_at     DATETIME(3),
    approved_by     INT,                                  -- ไม่มี FK (ตรงตาม schema.prisma)
    created_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 2. OTP VERIFICATION =====================
CREATE TABLE otp_verifications (
    otp_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    otp_code    VARCHAR(6) NOT NULL,
    purpose     ENUM('reset_password','register') NOT NULL,
    expires_at  DATETIME(3) NOT NULL,
    is_used     BOOLEAN DEFAULT FALSE,
    created_at  DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 3. FACULTIES & DEPARTMENTS =====================
CREATE TABLE faculties (
    faculty_id   INT AUTO_INCREMENT PRIMARY KEY,
    faculty_name VARCHAR(200) NOT NULL,
    faculty_code VARCHAR(10) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE departments (
    department_id   INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id      INT NOT NULL,
    department_name VARCHAR(200) NOT NULL,
    department_code VARCHAR(10) NOT NULL UNIQUE,
    FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 4. TEACHERS =====================
-- สร้างก่อน students เพราะ students.advisor_id และ courses.coordinator_id อ้าง teachers
CREATE TABLE teachers (
    teacher_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL UNIQUE,
    teacher_code   VARCHAR(20) NOT NULL UNIQUE,
    department_id  INT NOT NULL,
    position       VARCHAR(100),
    office_room    VARCHAR(100),
    specialization VARCHAR(300),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 5. STUDENTS =====================
CREATE TABLE students (
    student_id       INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT NOT NULL UNIQUE,
    student_code     VARCHAR(20) NOT NULL UNIQUE,
    department_id    INT NOT NULL,
    admission_year   INT NOT NULL,                        -- พ.ศ. (Buddhist year) — ดู HANDOFF 3.3
    status           ENUM('active','graduated','suspended','retired') DEFAULT 'active',
    advisor_id       INT,
    custom_semesters JSON,                                -- MySQL ใส่ default บน JSON ไม่ได้; แอปมองค่า null เป็น []
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (advisor_id) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 6. CURRICULUM =====================
CREATE TABLE curriculums (
    curriculum_id   INT AUTO_INCREMENT PRIMARY KEY,
    curriculum_name VARCHAR(300) NOT NULL,
    department_id   INT NOT NULL,
    year            INT NOT NULL,                         -- พ.ศ.
    total_credits   INT NOT NULL,
    status          ENUM('active','inactive') DEFAULT 'active',
    created_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 7. COURSES =====================
CREATE TABLE courses (
    course_id      INT AUTO_INCREMENT PRIMARY KEY,
    course_code    VARCHAR(20) NOT NULL UNIQUE,
    course_name    VARCHAR(300) NOT NULL,
    credits        INT NOT NULL,
    course_type    ENUM('required','elective','general') NOT NULL,
    department_id  INT,
    coordinator_id INT,
    description    TEXT,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (coordinator_id) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- วิชาบังคับก่อน (prerequisites)
CREATE TABLE course_prerequisites (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT NOT NULL,
    prerequisite_id INT NOT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (prerequisite_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    UNIQUE (course_id, prerequisite_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- หมวดวิชาในหลักสูตร
CREATE TABLE curriculum_courses (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    curriculum_id INT NOT NULL,
    course_id     INT NOT NULL,
    semester      INT,
    year_level    INT,
    FOREIGN KEY (curriculum_id) REFERENCES curriculums(curriculum_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id),
    UNIQUE (curriculum_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 8. SEMESTERS =====================
CREATE TABLE semesters (
    semester_id     INT AUTO_INCREMENT PRIMARY KEY,
    semester_name   VARCHAR(50) NOT NULL,
    academic_year   INT NOT NULL,
    semester_number INT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_current      BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 9. COURSE SECTIONS =====================
CREATE TABLE course_sections (
    section_id       INT AUTO_INCREMENT PRIMARY KEY,
    course_id        INT NOT NULL,
    semester_id      INT NOT NULL,
    section_number   VARCHAR(10) NOT NULL,
    teacher_id       INT NOT NULL,
    max_students     INT DEFAULT 50,
    current_students INT DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(course_id),
    FOREIGN KEY (semester_id) REFERENCES semesters(semester_id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 10. SCHEDULES =====================
CREATE TABLE schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    section_id  INT NOT NULL,
    day_of_week ENUM('MON','TUE','WED','THU','FRI','SAT','SUN') NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    room        VARCHAR(50),
    building    VARCHAR(100),
    FOREIGN KEY (section_id) REFERENCES course_sections(section_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 11. ENROLLMENTS =====================
CREATE TABLE enrollments (
    enrollment_id    INT AUTO_INCREMENT PRIMARY KEY,
    student_id       INT NOT NULL,
    section_id       INT NOT NULL,
    status           ENUM('enrolled','completed','dropped','withdrawn','pending') DEFAULT 'enrolled',
    grade            VARCHAR(5),                           -- pass/fail logic อยู่ที่ src/lib/grade.ts
    attendance_score INT,
    assignment_score INT,
    midterm_score    INT,
    final_score      INT,
    enrolled_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (section_id) REFERENCES course_sections(section_id),
    UNIQUE (student_id, section_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 12. COURSE PLANNER =====================
CREATE TABLE course_plans (
    plan_id          INT AUTO_INCREMENT PRIMARY KEY,
    student_id       INT NOT NULL,
    course_id        INT NOT NULL,
    planned_semester INT NOT NULL,
    planned_year     INT NOT NULL,
    status           ENUM('planned','completed','skipped') DEFAULT 'planned',
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 13. MAKEUP CLASSES =====================
CREATE TABLE makeup_classes (
    makeup_id     INT AUTO_INCREMENT PRIMARY KEY,
    section_id    INT NOT NULL,
    original_date DATE NOT NULL,
    makeup_date   DATE NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    room          VARCHAR(50),
    reason        TEXT,
    status        ENUM('scheduled','completed','cancelled') DEFAULT 'scheduled',
    created_by    INT NOT NULL,
    created_at    DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (section_id) REFERENCES course_sections(section_id),
    FOREIGN KEY (created_by) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 14. ANNOUNCEMENTS =====================
CREATE TABLE announcements (
    announcement_id INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    content         TEXT NOT NULL,
    target_role     ENUM('all','student','teacher') DEFAULT 'all',
    section_id      INT NULL,
    is_pinned       BOOLEAN DEFAULT FALSE,
    status          VARCHAR(50) DEFAULT 'เผยแพร่',
    created_by      INT NOT NULL,
    created_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX (section_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    FOREIGN KEY (section_id) REFERENCES course_sections(section_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 15. NOTIFICATIONS =====================
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    title           VARCHAR(300) NOT NULL,
    message         TEXT,
    type            ENUM('schedule','enrollment','announcement','makeup','system') NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== 16. IMPORT LOGS =====================
CREATE TABLE import_logs (
    import_id    INT AUTO_INCREMENT PRIMARY KEY,
    imported_by  INT NOT NULL,
    file_name    VARCHAR(300) NOT NULL,
    import_type  ENUM('students','courses','enrollments','teachers') NOT NULL,
    total_rows   INT DEFAULT 0,
    success_rows INT DEFAULT 0,
    created_rows INT DEFAULT 0,
    updated_rows INT DEFAULT 0,
    error_rows   INT DEFAULT 0,
    status       ENUM('processing','completed','failed') DEFAULT 'processing',
    created_at   DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (imported_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
