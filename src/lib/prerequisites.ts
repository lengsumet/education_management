/**
 * Prerequisite enforcement — single source of truth for "has the student passed
 * the courses required before enrolling in X?".
 *
 * Design decisions (locked with product):
 *   - AND only: ALL prerequisites of a course must be passed. No OR groups.
 *   - "Passed" means a real passing grade (A–D) via isPassingGrade(). A withdraw
 *     (W), incomplete (I), unsatisfactory (U), fail (F) or no grade does NOT count.
 *     This is the bug fix: the old inline checks used `grade !== "F"`, which let a
 *     W/I/U slip through and unlock the next course.
 *   - Enforcement is SOFT: an unmet prerequisite does not hard-block the student.
 *     The enrollment is still created as `pending` but tagged with a warning so the
 *     approver (advisor/admin) can override by approving, or reject.
 */

import { isPassingGrade } from "./grade";

type EnrollmentLike = {
  grade?: string | null;
  section: { courseId: number };
};

/**
 * Course ids the student has PASSED (earns credit, A–D).
 * W / I / U / F / null are excluded on purpose.
 */
export function getPassedCourseIds(enrollments: EnrollmentLike[]): Set<number> {
  const passed = new Set<number>();
  for (const enrollment of enrollments) {
    if (isPassingGrade(enrollment.grade)) {
      passed.add(enrollment.section.courseId);
    }
  }
  return passed;
}

type PrereqLike = {
  prerequisiteId: number;
  prerequisite: { id: number; code: string; name: string };
};

/** The prerequisites the student has NOT yet passed (empty => clear to enrol). */
export function computeUnmetPrereqs(
  prerequisites: PrereqLike[],
  passedCourseIds: Set<number>,
): { id: number; code: string; name: string }[] {
  return prerequisites
    .filter((p) => !passedCourseIds.has(p.prerequisiteId))
    .map((p) => p.prerequisite);
}

/**
 * Detect prerequisite links that would form a cycle (A requires B while B already
 * requires A, directly or transitively) or point a course at itself. Used when an
 * admin edits a course's prerequisites so we never build an un-satisfiable graph.
 *
 * Returns the subset of `proposedPrereqIds` that are unsafe. Empty => safe.
 */
export async function findCyclicPrereqs(
  // The app's Prisma client is wrapped by the Accelerate extension, whose method
  // types don't structurally match a hand-written interface — accept it loosely.
  prisma: {
    coursePrerequisite: {
      findMany: (args: {
        where: { courseId: number };
        select: { prerequisiteId: true };
      }) => Promise<Array<{ prerequisiteId: number }>>;
    };
  } | any,
  courseId: number,
  proposedPrereqIds: number[],
): Promise<number[]> {
  const unsafe: number[] = [];

  for (const prereqId of proposedPrereqIds) {
    if (prereqId === courseId) {
      unsafe.push(prereqId); // a course cannot be its own prerequisite
      continue;
    }

    // Walk prereqId's own prerequisite chain. If it can reach courseId, adding
    // prereqId -> courseId closes a loop.
    const visited = new Set<number>();
    const stack = [prereqId];
    let cyclic = false;

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      if (current === courseId) {
        cyclic = true;
        break;
      }

      const deps = await prisma.coursePrerequisite.findMany({
        where: { courseId: current },
        select: { prerequisiteId: true },
      });
      for (const dep of deps) stack.push(dep.prerequisiteId);
    }

    if (cyclic) unsafe.push(prereqId);
  }

  return unsafe;
}
