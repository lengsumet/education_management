/**
 * Grade utilities — single source of truth for what counts as a "passed" course.
 *
 * Thai university grading:
 *   Passing (earns credits): A, B+, B, C+, C, D+, D
 *   Not passing (no credits): F, W (withdrawn), I (incomplete), U, "-", null
 *
 * The original code treated ANY grade other than "-" as passed, so an F or W
 * was silently counted toward earned credits and graduation progress. This
 * helper fixes that and is used by both graduation-check and the student
 * dashboard so the numbers can never drift apart again.
 */

const PASSING_GRADES = new Set([
  "A",
  "B+",
  "B",
  "C+",
  "C",
  "D+",
  "D",
]);

/** Grades that mean the course was attempted but not passed. */
const FAILING_GRADES = new Set(["F", "W", "U", "I"]);

export function normalizeGrade(grade?: string | null): string | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === "" || g === "-") return null;
  return g;
}

/** True only when the grade is a real passing grade that earns credits. */
export function isPassingGrade(grade?: string | null): boolean {
  const g = normalizeGrade(grade);
  if (!g) return false;
  return PASSING_GRADES.has(g);
}

/** True when a grade has been recorded but it is a failing/withdrawn grade. */
export function isFailingGrade(grade?: string | null): boolean {
  const g = normalizeGrade(grade);
  if (!g) return false;
  return FAILING_GRADES.has(g);
}

/**
 * Classify an enrollment for graduation/dashboard purposes.
 *   "passed"      -> earned the credits
 *   "failed"      -> attempted, must retake (F/W/etc.)
 *   "in_progress" -> currently enrolled, no final grade yet
 */
export function classifyEnrollment(params: {
  grade?: string | null;
  status?: string | null;
}): "passed" | "failed" | "in_progress" {
  const g = normalizeGrade(params.grade);
  if (g) {
    return isPassingGrade(g) ? "passed" : "failed";
  }
  return "in_progress";
}
