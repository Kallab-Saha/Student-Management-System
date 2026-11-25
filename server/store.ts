import fs from 'node:fs';
import path from 'node:path';
import type {
  AssignmentRecord,
  AttendanceRecord,
  BookIssueRecord,
  CalendarEventRecord,
  LibraryBookRecord,
  MarkRecord,
  RoutineSlot,
  StudentApplicationRecord,
  StudentRecord,
  StudyMaterialRecord,
  SubjectRecord,
  TeacherRecord,
} from '../src/types/portal.ts';
import { DEFAULT_TEACHER_PERMISSIONS } from '../src/utils/academicRules.ts';
import { hashPassword, verifyPassword } from './auth.ts';

export interface StoredAdmin {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isDefaultPassword: boolean;
}

export interface StoredTeacher extends TeacherRecord {
  passwordHash: string;
  currentPassword?: string;
  isDefaultPassword: boolean;
}

export interface StoredStudent extends StudentRecord {
  passwordHash: string;
  currentPassword?: string;
  isDefaultPassword: boolean;
}

export interface StoredStudentApplication extends StudentApplicationRecord {
  requestedPasswordHash: string;
  requestedPassword?: string;
}

export interface PortalDatabase {
  admin: StoredAdmin;
  teachers: StoredTeacher[];
  students: StoredStudent[];
  subjects: SubjectRecord[];
  routine: RoutineSlot[];
  attendance: AttendanceRecord[];
  assignments: AssignmentRecord[];
  marks: MarkRecord[];
  materials: StudyMaterialRecord[];
  books: LibraryBookRecord[];
  bookIssues: BookIssueRecord[];
  calendarEvents: CalendarEventRecord[];
  studentApplications: StoredStudentApplication[];
  attendanceThreshold: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'portal-db.json');

function createSeedDatabase(): PortalDatabase {
  const adminInitPass = process.env.ADMIN_DEFAULT_PASSWORD || '741165';

  const teachers: StoredTeacher[] = [
    {
      id: 'Subham',
      name: 'Prof. Subham Das',
      department: 'C.S.E (I.O.T.)',
      designation: 'Assistant Professor',
      email: 'subham.das@greenfield.edu',
      subjects: ['CS501', 'IOT504'],
      permissions: { ...DEFAULT_TEACHER_PERMISSIONS },
      passwordHash: hashPassword('741166'),
      currentPassword: '741166',
      isDefaultPassword: true,
      createdAt: '2026-08-01',
    },
    {
      id: 'Saikat',
      name: 'Prof. Saikat Sen',
      department: 'C.S.E (I.O.T.)',
      designation: 'Associate Professor',
      email: 'saikat.sen@greenfield.edu',
      subjects: ['CS502', 'CS505'],
      permissions: { ...DEFAULT_TEACHER_PERMISSIONS },
      passwordHash: hashPassword('741167'),
      currentPassword: '741167',
      isDefaultPassword: true,
      createdAt: '2026-08-01',
    },
    {
      id: 'Shivam',
      name: 'Prof. Shivam Verma',
      department: 'C.S.E (I.O.T.)',
      designation: 'Assistant Professor',
      email: 'shivam.verma@greenfield.edu',
      subjects: ['CS503', 'CS506'],
      permissions: { ...DEFAULT_TEACHER_PERMISSIONS },
      passwordHash: hashPassword('741168'),
      currentPassword: '741168',
      isDefaultPassword: true,
      createdAt: '2026-08-01',
    },
  ];

  const students: StoredStudent[] = [
    {
      id: '12024002034149',
      name: 'Aarav Mukherjee',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      section: 'C',
      rollNo: '19',
      email: 'aarav.mukherjee@student.greenfield.edu',
      phone: '+91 98300 41219',
      photoUrl: '',
      projectTitle: 'Smart Greenhouse Telemetry Node',
      projectDetails: 'ESP32-based soil moisture & humidity monitoring dashboard.',
      status: 'active',
      enrolledAt: '2024-08-12',
      passwordHash: hashPassword('123456'),
      currentPassword: '123456',
      isDefaultPassword: true,
    },
    {
      id: '12024002034150',
      name: 'Riya Chatterjee',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      section: 'C',
      rollNo: '20',
      email: 'riya.chatterjee@student.greenfield.edu',
      phone: '+91 98300 41220',
      photoUrl: '',
      projectTitle: 'Edge Vision Campus Gate Monitor',
      projectDetails: 'Low-power anomaly detection on Raspberry Pi 5.',
      status: 'active',
      enrolledAt: '2024-08-12',
      passwordHash: hashPassword('123456'),
      currentPassword: '123456',
      isDefaultPassword: true,
    },
    {
      id: '12024002034151',
      name: 'Debanjan Sen',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      section: 'C',
      rollNo: '21',
      email: 'debanjan.sen@student.greenfield.edu',
      phone: '+91 98300 41221',
      photoUrl: '',
      projectTitle: 'LoRaWAN Campus Air Quality Mesh',
      projectDetails: 'Distributed particulate sensor network.',
      status: 'active',
      enrolledAt: '2024-08-12',
      passwordHash: hashPassword('123456'),
      currentPassword: '123456',
      isDefaultPassword: true,
    },
  ];

  const subjects: SubjectRecord[] = [
    {
      id: 'sub-cs501',
      code: 'CS501',
      name: 'Design & Analysis of Algorithms',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      maxMarks: 100,
      passingMarks: 40,
      teacherId: 'Subham',
    },
    {
      id: 'sub-cs502',
      code: 'CS502',
      name: 'Database Management Systems',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      maxMarks: 100,
      passingMarks: 40,
      teacherId: 'Saikat',
    },
    {
      id: 'sub-cs503',
      code: 'CS503',
      name: 'Operating Systems',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      maxMarks: 100,
      passingMarks: 40,
      teacherId: 'Shivam',
    },
    {
      id: 'sub-iot504',
      code: 'IOT504',
      name: 'IoT Architecture & Protocols',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      maxMarks: 100,
      passingMarks: 40,
      teacherId: 'Subham',
    },
    {
      id: 'sub-cs505',
      code: 'CS505',
      name: 'Computer Networks',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      maxMarks: 100,
      passingMarks: 40,
      teacherId: 'Saikat',
    },
    {
      id: 'sub-cs506',
      code: 'CS506',
      name: 'Java Practical & Software Lab',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      maxMarks: 100,
      passingMarks: 40,
      teacherId: 'Shivam',
    },
  ];

  const routine: RoutineSlot[] = [
    { id: 'r-mon-1', day: 'Mon', period: 1, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS501', subjectName: 'Algorithms', teacherName: 'Prof. Subham Das', room: 'LH-301' },
    { id: 'r-mon-2', day: 'Mon', period: 2, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS502', subjectName: 'DBMS', teacherName: 'Prof. Saikat Sen', room: 'LH-301' },
    { id: 'r-mon-3', day: 'Mon', period: 3, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS503', subjectName: 'Operating Systems', teacherName: 'Prof. Shivam Verma', room: 'LH-304' },
    { id: 'r-mon-5', day: 'Mon', period: 5, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS506', subjectName: 'Java Lab', teacherName: 'Prof. Shivam Verma', room: 'Lab-2' },
    { id: 'r-tue-1', day: 'Tue', period: 1, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'IOT504', subjectName: 'IoT Architecture', teacherName: 'Prof. Subham Das', room: 'LH-302' },
    { id: 'r-tue-2', day: 'Tue', period: 2, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS505', subjectName: 'Computer Networks', teacherName: 'Prof. Saikat Sen', room: 'LH-302' },
    { id: 'r-tue-4', day: 'Tue', period: 4, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS501', subjectName: 'Algorithms', teacherName: 'Prof. Subham Das', room: 'LH-301' },
    { id: 'r-wed-2', day: 'Wed', period: 2, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS503', subjectName: 'Operating Systems', teacherName: 'Prof. Shivam Verma', room: 'LH-304' },
    { id: 'r-wed-3', day: 'Wed', period: 3, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS502', subjectName: 'DBMS', teacherName: 'Prof. Saikat Sen', room: 'LH-301' },
    { id: 'r-wed-6', day: 'Wed', period: 6, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'IOT504', subjectName: 'IoT Lab', teacherName: 'Prof. Subham Das', room: 'IoT-Lab' },
    { id: 'r-thu-1', day: 'Thu', period: 1, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS505', subjectName: 'Computer Networks', teacherName: 'Prof. Saikat Sen', room: 'LH-302' },
    { id: 'r-thu-3', day: 'Thu', period: 3, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS501', subjectName: 'Algorithms', teacherName: 'Prof. Subham Das', room: 'LH-301' },
    { id: 'r-fri-1', day: 'Fri', period: 1, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS502', subjectName: 'DBMS', teacherName: 'Prof. Saikat Sen', room: 'LH-301' },
    { id: 'r-fri-2', day: 'Fri', period: 2, course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, section: 'C', subjectCode: 'CS506', subjectName: 'Java Practical', teacherName: 'Prof. Shivam Verma', room: 'Lab-2' },
  ];

  const attendance: AttendanceRecord[] = [
    { id: 'att-1', date: '2026-11-18', subjectId: 'sub-cs501', studentId: '12024002034149', status: 'Present', markedBy: 'Subham' },
    { id: 'att-2', date: '2026-11-20', subjectId: 'sub-cs501', studentId: '12024002034149', status: 'Present', markedBy: 'Subham' },
    { id: 'att-3', date: '2026-11-22', subjectId: 'sub-cs501', studentId: '12024002034149', status: 'Present', markedBy: 'Subham' },
    { id: 'att-4', date: '2026-11-24', subjectId: 'sub-cs501', studentId: '12024002034149', status: 'Present', markedBy: 'Subham' },
    { id: 'att-5', date: '2026-11-18', subjectId: 'sub-cs502', studentId: '12024002034149', status: 'Present', markedBy: 'Saikat' },
    { id: 'att-6', date: '2026-11-21', subjectId: 'sub-cs502', studentId: '12024002034149', status: 'Absent', markedBy: 'Saikat' },
    { id: 'att-7', date: '2026-11-23', subjectId: 'sub-cs502', studentId: '12024002034149', status: 'Present', markedBy: 'Saikat' },
    { id: 'att-8', date: '2026-11-19', subjectId: 'sub-cs503', studentId: '12024002034149', status: 'Present', markedBy: 'Shivam' },
    { id: 'att-9', date: '2026-11-22', subjectId: 'sub-cs503', studentId: '12024002034149', status: 'Present', markedBy: 'Shivam' },
    { id: 'att-10', date: '2026-11-24', subjectId: 'sub-cs501', studentId: '12024002034150', status: 'Present', markedBy: 'Subham' },
    { id: 'att-11', date: '2026-11-24', subjectId: 'sub-cs501', studentId: '12024002034151', status: 'Absent', markedBy: 'Subham' },
  ];

  const assignments: AssignmentRecord[] = [
    {
      id: 'asg-1',
      title: 'Java Practical File & OOP Lab Record',
      subjectId: 'sub-cs506',
      subjectName: 'Java Practical & Software Lab',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      instructions: 'Complete experiments 1 to 6 with UML diagrams and source outputs.',
      onlineDeadline: '2026-11-29',
      googleClassroomUrl: 'https://classroom.google.com',
      offlineDeadline: '2026-12-02',
      offlineInstructions: 'Submit spiral-bound printed copy to Prof. Shivam Verma (CSE Faculty Room 204).',
      createdBy: 'Shivam',
      createdAt: '2026-11-15',
    },
    {
      id: 'asg-2',
      title: 'Dynamic Programming & Graph Complexity Sheet',
      subjectId: 'sub-cs501',
      subjectName: 'Design & Analysis of Algorithms',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      instructions: 'Solve all 8 recurrence & Dijkstra optimization problems.',
      onlineDeadline: '2026-11-30',
      googleClassroomUrl: 'https://classroom.google.com',
      offlineDeadline: '2026-12-03',
      offlineInstructions: 'Handwritten A4 assignment sheets in CSE Department Box B.',
      createdBy: 'Subham',
      createdAt: '2026-11-18',
    },
  ];

  const marks: MarkRecord[] = [
    { id: 'mk-1', studentId: '12024002034149', subjectId: 'sub-cs501', obtainedMarks: 84, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
    { id: 'mk-2', studentId: '12024002034149', subjectId: 'sub-cs502', obtainedMarks: 76, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
    { id: 'mk-3', studentId: '12024002034149', subjectId: 'sub-cs503', obtainedMarks: 68, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
    { id: 'mk-4', studentId: '12024002034149', subjectId: 'sub-iot504', obtainedMarks: 88, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
    { id: 'mk-5', studentId: '12024002034149', subjectId: 'sub-cs505', obtainedMarks: 72, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
    { id: 'mk-6', studentId: '12024002034149', subjectId: 'sub-cs506', obtainedMarks: 91, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
    { id: 'mk-7', studentId: '12024002034150', subjectId: 'sub-cs501', obtainedMarks: 79, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
    { id: 'mk-8', studentId: '12024002034150', subjectId: 'sub-cs502', obtainedMarks: 34, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
  ];

  const materials: StudyMaterialRecord[] = [
    {
      id: 'mat-1',
      title: 'Unit 3: Greedy & Dynamic Programming Notes (PDF)',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      subjectId: 'sub-cs501',
      subjectName: 'Design & Analysis of Algorithms',
      type: 'PDF',
      resourceUrl: 'https://ocw.mit.edu',
      description: 'Annotated lecture notes covering Bellman-Ford, Floyd-Warshall, and 0/1 Knapsack.',
      uploadedBy: 'Kallab',
      uploadedAt: '2026-11-05',
    },
    {
      id: 'mat-2',
      title: 'MQTT & CoAP IoT Protocol Architecture Slides',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      subjectId: 'sub-iot504',
      subjectName: 'IoT Architecture & Protocols',
      type: 'Slides',
      resourceUrl: 'https://mqtt.org',
      description: 'Slide deck on lightweight broker communication and QoS levels.',
      uploadedBy: 'Kallab',
      uploadedAt: '2026-11-12',
    },
  ];

  const books: LibraryBookRecord[] = [
    { id: 'bk-1', isbn: '978-0262046305', title: 'Introduction to Algorithms (CLRS)', author: 'Cormen, Leiserson, Rivest, Stein', category: 'Algorithms', totalCopies: 6, availableCopies: 5 },
    { id: 'bk-2', isbn: '978-0078022159', title: 'Database System Concepts', author: 'Silberschatz, Korth, Sudarshan', category: 'Databases', totalCopies: 5, availableCopies: 4 },
    { id: 'bk-3', isbn: '978-1119800361', title: 'Operating System Concepts', author: 'Abraham Silberschatz', category: 'Systems', totalCopies: 4, availableCopies: 4 },
    { id: 'bk-4', isbn: '978-0132126953', title: 'Computer Networks', author: 'Andrew S. Tanenbaum', category: 'Networking', totalCopies: 5, availableCopies: 5 },
  ];

  const bookIssues: BookIssueRecord[] = [
    {
      id: 'iss-1',
      bookId: 'bk-1',
      bookTitle: 'Introduction to Algorithms (CLRS)',
      studentId: '12024002034149',
      studentName: 'Aarav Mukherjee',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      returnDate: null,
      status: 'Overdue',
    },
    {
      id: 'iss-2',
      bookId: 'bk-2',
      bookTitle: 'Database System Concepts',
      studentId: '12024002034150',
      studentName: 'Riya Chatterjee',
      issueDate: '2026-11-18',
      dueDate: '2026-12-02',
      returnDate: null,
      status: 'Issued',
    },
  ];

  const calendarEvents: CalendarEventRecord[] = [
    { id: 'cal-1', title: 'End-Semester Practical Viva', date: '2026-12-04', category: 'Exam', description: 'Lab viva for CS506 Java Practical & IOT504.' },
    { id: 'cal-2', title: 'Semester V Theory Examination', date: '2026-12-12', category: 'Exam', description: 'University examination schedule commences at 10:00 AM.' },
    { id: 'cal-3', title: 'Winter Academic Break', date: '2026-12-24', category: 'Holiday', description: 'Campus closed for winter recess.' },
  ];

  return {
    admin: {
      id: 'Kallab',
      name: 'Kallab Saha',
      email: 'kallab.admin@greenfield.edu',
      passwordHash: hashPassword(adminInitPass),
      isDefaultPassword: true,
    },
    teachers,
    students,
    subjects,
    routine,
    attendance,
    assignments,
    marks,
    materials,
    books,
    bookIssues,
    calendarEvents,
    studentApplications: [
      {
        id: 'APP-202601',
        name: 'Ananya Sen',
        course: 'B.Tech, C.S.E (I.O.T.)',
        semester: 5,
        section: 'C',
        rollNo: '22',
        email: 'ananya.sen@applicant.edu',
        phone: '+91 98300 41222',
        status: 'Pending',
        assignedStudentId: null,
        submittedAt: '2026-11-24',
        reviewedAt: null,
        reviewedBy: null,
        notes: 'Newly admitted Semester V transfer student requesting portal ID.',
        requestedPasswordHash: hashPassword('123456'),
        requestedPassword: '123456',
      },
    ],
    attendanceThreshold: 75,
  };
}

let cachedDb: PortalDatabase | null = null;

export function getDatabase(): PortalDatabase {
  if (cachedDb) return cachedDb;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seeded = createSeedDatabase();
    saveDatabase(seeded);
    cachedDb = seeded;
    return cachedDb;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as PortalDatabase;
    if (!Array.isArray(parsed.studentApplications)) {
      parsed.studentApplications = [];
    }
    const defaultTeacherPasses: Record<string, string> = {
      Subham: '741166',
      Saikat: '741167',
      Shivam: '741168',
    };
    for (const t of parsed.teachers || []) {
      if (t.currentPassword === undefined) {
        const candidate = defaultTeacherPasses[t.id];
        if (candidate && verifyPassword(candidate, t.passwordHash)) {
          t.currentPassword = candidate;
        }
      }
    }
    for (const s of parsed.students || []) {
      if (s.currentPassword === undefined && verifyPassword('123456', s.passwordHash)) {
        s.currentPassword = '123456';
      }
    }
    for (const app of parsed.studentApplications || []) {
      if (app.requestedPassword === undefined && verifyPassword('123456', app.requestedPasswordHash)) {
        app.requestedPassword = '123456';
      }
    }
    cachedDb = parsed;
    return cachedDb;
  } catch {
    const seeded = createSeedDatabase();
    saveDatabase(seeded);
    cachedDb = seeded;
    return cachedDb;
  }
}

export function saveDatabase(db: PortalDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
  cachedDb = db;
}
