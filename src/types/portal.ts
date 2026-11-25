export type UserRole = 'admin' | 'teacher' | 'student';

export type TeacherPermissionKey =
  | 'attendance'
  | 'assignments'
  | 'routine'
  | 'marks'
  | 'materials'
  | 'library'
  | 'students_view'
  | 'calendar';

export type TeacherPermissions = Record<TeacherPermissionKey, boolean>;

export interface SessionUser {
  id: string;
  role: UserRole;
  name: string;
  course?: string;
  semester?: number;
  section?: string;
  rollNo?: string;
  department?: string;
  designation?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  projectTitle?: string;
  projectDetails?: string;
  permissions?: TeacherPermissions;
  isDefaultPassword?: boolean;
}

export interface StudentRecord {
  id: string;
  name: string;
  course: string;
  semester: number;
  section: string;
  rollNo: string;
  email: string;
  phone: string;
  photoUrl: string;
  projectTitle: string;
  projectDetails: string;
  status: 'active' | 'inactive';
  enrolledAt: string;
  password?: string;
}

export interface TeacherRecord {
  id: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  subjects: string[];
  permissions: TeacherPermissions;
  createdAt: string;
  password?: string;
}

export interface SubjectRecord {
  id: string;
  code: string;
  name: string;
  course: string;
  semester: number;
  maxMarks: number;
  passingMarks: number;
  teacherId: string;
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

export interface RoutineSlot {
  id: string;
  day: DayOfWeek;
  period: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  course: string;
  semester: number;
  section: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  room: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  subjectId: string;
  studentId: string;
  status: 'Present' | 'Absent';
  markedBy: string;
}

export interface AssignmentRecord {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  course: string;
  semester: number;
  instructions: string;
  onlineDeadline: string;
  googleClassroomUrl: string;
  offlineDeadline: string;
  offlineInstructions: string;
  createdBy: string;
  createdAt: string;
}

export interface MarkRecord {
  id: string;
  studentId: string;
  subjectId: string;
  obtainedMarks: number;
  updatedBy: string;
  updatedAt: string;
}

export interface StudyMaterialRecord {
  id: string;
  title: string;
  course: string;
  semester: number;
  subjectId: string;
  subjectName: string;
  type: 'PDF' | 'Notes' | 'Slides';
  resourceUrl: string;
  description: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface LibraryBookRecord {
  id: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  totalCopies: number;
  availableCopies: number;
}

export interface BookIssueRecord {
  id: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  status: 'Issued' | 'Returned' | 'Overdue';
}

export interface CalendarEventRecord {
  id: string;
  title: string;
  date: string;
  category: 'Exam' | 'Holiday' | 'Academic' | 'Event';
  description: string;
}

export interface StudentApplicationRecord {
  id: string;
  name: string;
  course: string;
  semester: number;
  section: string;
  rollNo: string;
  email: string;
  phone: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  assignedStudentId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string;
  requestedPassword?: string;
}

export interface PortalBootstrapData {
  user: SessionUser;
  students: StudentRecord[];
  teachers: TeacherRecord[];
  subjects: SubjectRecord[];
  routine: RoutineSlot[];
  attendance: AttendanceRecord[];
  assignments: AssignmentRecord[];
  marks: MarkRecord[];
  materials: StudyMaterialRecord[];
  books: LibraryBookRecord[];
  bookIssues: BookIssueRecord[];
  calendarEvents: CalendarEventRecord[];
  studentApplications?: StudentApplicationRecord[];
  attendanceThreshold: number;
}
