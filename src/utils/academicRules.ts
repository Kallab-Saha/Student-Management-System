import type {
  AttendanceRecord,
  MarkRecord,
  SubjectRecord,
  TeacherPermissionKey,
  TeacherPermissions,
} from '../types/portal.ts';

export const DEFAULT_TEACHER_PERMISSIONS: TeacherPermissions = {
  attendance: true,
  assignments: true,
  routine: true,
  marks: true,
  materials: false,
  library: false,
  students_view: false,
  calendar: false,
};

export const ALL_TEACHER_PERMISSIONS: {
  key: TeacherPermissionKey;
  label: string;
  description: string;
  isDefault: boolean;
}[] = [
  {
    key: 'attendance',
    label: 'Update Attendance',
    description: 'Mark daily subject-wise student presence and absence.',
    isDefault: true,
  },
  {
    key: 'assignments',
    label: 'Send Assignments',
    description: 'Publish online (Google Classroom) and offline assignment deadlines.',
    isDefault: true,
  },
  {
    key: 'routine',
    label: 'Update Class Routine',
    description: 'Modify weekly timetable period slots for courses and sections.',
    isDefault: true,
  },
  {
    key: 'marks',
    label: 'Marks Management',
    description: 'Input and update student scores across subjects.',
    isDefault: true,
  },
  {
    key: 'materials',
    label: 'Study Materials',
    description: 'Upload and manage PDFs, lecture notes, and slide resources.',
    isDefault: false,
  },
  {
    key: 'students_view',
    label: 'Student Directory Access',
    description: 'View enrolled student profiles and academic records.',
    isDefault: false,
  },
  {
    key: 'calendar',
    label: 'Academic Calendar',
    description: 'Publish academic events, exam dates, and notices.',
    isDefault: false,
  },
];

export interface AttendanceStats {
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
  isBelowThreshold: boolean;
}

export function calculateAttendanceStats(
  records: Pick<AttendanceRecord, 'status'>[],
  threshold = 75
): AttendanceStats {
  const totalClasses = records.length;
  if (totalClasses === 0) {
    return {
      totalClasses: 0,
      attendedClasses: 0,
      percentage: 100,
      isBelowThreshold: false,
    };
  }
  const attendedClasses = records.filter((r) => r.status === 'Present').length;
  const percentage = Math.round((attendedClasses / totalClasses) * 1000) / 10;
  return {
    totalClasses,
    attendedClasses,
    percentage,
    isBelowThreshold: percentage < threshold,
  };
}

export interface SubjectAttendanceSummary {
  subject: SubjectRecord;
  stats: AttendanceStats;
}

export function calculateSubjectAttendanceBreakdown(
  records: AttendanceRecord[],
  subjects: SubjectRecord[],
  studentId: string,
  threshold = 75
): SubjectAttendanceSummary[] {
  return subjects.map((subject) => {
    const subjectRecords = records.filter(
      (r) => r.studentId === studentId && r.subjectId === subject.id
    );
    return {
      subject,
      stats: calculateAttendanceStats(subjectRecords, threshold),
    };
  });
}

export interface EvaluatedSubjectMark {
  subject: SubjectRecord;
  obtainedMarks: number | null;
  status: 'PASS' | 'BACKLOG' | 'PENDING';
}

export interface MarksheetSummary {
  rows: EvaluatedSubjectMark[];
  totalObtained: number;
  totalMaximum: number;
  percentage: number;
  backlogCount: number;
  evaluatedCount: number;
  semesterResult: 'PASS' | 'FAIL' | 'PENDING';
}

export function evaluateMarksheet(
  marks: MarkRecord[],
  subjects: SubjectRecord[],
  studentId: string
): MarksheetSummary {
  const studentMarks = marks.filter((m) => m.studentId === studentId);
  const markBySubject = new Map(studentMarks.map((m) => [m.subjectId, m.obtainedMarks]));

  const rows: EvaluatedSubjectMark[] = subjects.map((subject) => {
    const obtained = markBySubject.get(subject.id);
    if (obtained === undefined) {
      return {
        subject,
        obtainedMarks: null,
        status: 'PENDING',
      };
    }
    return {
      subject,
      obtainedMarks: obtained,
      status: obtained >= subject.passingMarks ? 'PASS' : 'BACKLOG',
    };
  });

  const evaluatedRows = rows.filter((r) => r.obtainedMarks !== null);
  const totalObtained = evaluatedRows.reduce((acc, r) => acc + (r.obtainedMarks ?? 0), 0);
  const totalMaximum = evaluatedRows.reduce((acc, r) => acc + r.subject.maxMarks, 0);
  const percentage =
    totalMaximum > 0 ? Math.round((totalObtained / totalMaximum) * 1000) / 10 : 0;
  const backlogCount = evaluatedRows.filter((r) => r.status === 'BACKLOG').length;
  const totalSubjects = subjects.length;

  let semesterResult: 'PASS' | 'FAIL' | 'PENDING' = 'PENDING';
  if (evaluatedRows.length > 0 && totalSubjects > 0) {
    semesterResult = backlogCount >= totalSubjects * 0.5 ? 'FAIL' : 'PASS';
  }

  return {
    rows,
    totalObtained,
    totalMaximum,
    percentage,
    backlogCount,
    evaluatedCount: evaluatedRows.length,
    semesterResult,
  };
}

export function generateUniqueStudentId(
  existingIds: Iterable<string>,
  year = new Date().getFullYear()
): string {
  const existing = new Set(existingIds);
  const prefix = `1${year}002034`;
  let maxSeq = 149;

  for (const id of existing) {
    if (id.startsWith(prefix) && /^\d+$/.test(id)) {
      const tail = Number.parseInt(id.slice(prefix.length), 10);
      if (Number.isFinite(tail) && tail > maxSeq) {
        maxSeq = tail;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  while (existing.has(candidate)) {
    nextSeq += 1;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }
  return candidate;
}

export function hasTeacherPermission(
  permissions: TeacherPermissions | undefined,
  key: TeacherPermissionKey
): boolean {
  if (!permissions) return false;
  return Boolean(permissions[key]);
}

export function calculateBookFine(
  dueDateStr: string,
  returnDateStr: string | null,
  referenceDateStr = new Date().toISOString().slice(0, 10),
  finePerDay = 10
): { overdueDays: number; fineAmount: number; isOverdue: boolean } {
  const due = new Date(`${dueDateStr}T00:00:00Z`).getTime();
  const compareStr = returnDateStr || referenceDateStr;
  const compare = new Date(`${compareStr}T00:00:00Z`).getTime();
  if (Number.isNaN(due) || Number.isNaN(compare) || compare <= due) {
    return { overdueDays: 0, fineAmount: 0, isOverdue: false };
  }
  const overdueDays = Math.floor((compare - due) / (1000 * 60 * 60 * 24));
  return {
    overdueDays,
    fineAmount: overdueDays * finePerDay,
    isOverdue: overdueDays > 0 && !returnDateStr,
  };
}

export function isValidSafeHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || !rawUrl.trim()) return true;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function generateTemporaryPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function validatePasswordInput(rawPassword: string): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  const cleaned = rawPassword.trim();
  if (cleaned.length < 4) {
    return {
      valid: false,
      cleaned,
      error: 'Password must be at least 4 characters.',
    };
  }
  return { valid: true, cleaned };
}
