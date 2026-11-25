import { signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  AssignmentRecord,
  AttendanceRecord,
  CalendarEventRecord,
  DayOfWeek,
  LibraryBookRecord,
  MarkRecord,
  PortalBootstrapData,
  RoutineSlot,
  SessionUser,
  StudentApplicationRecord,
  StudentRecord,
  StudyMaterialRecord,
  SubjectRecord,
  TeacherPermissions,
  TeacherRecord,
  UserRole,
} from '../types/portal';
import {
  DEFAULT_TEACHER_PERMISSIONS,
  generateUniqueStudentId,
  hasTeacherPermission,
  isValidSafeHttpUrl,
} from '../utils/academicRules';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  clampString,
  INSTITUTE_ID,
  isValidFirestoreId,
  sanitizeEmail,
  sanitizeSlugId,
} from '../utils/portalValidation';

export interface ActiveSessionContext {
  uid: string;
  role: UserRole;
  memberId: string;
  email: string;
  displayName: string;
}

export interface UnlinkedGoogleAccount {
  uid: string;
  email: string;
  displayName: string;
  applications: StudentApplicationRecord[];
}

export type GoogleSignInOutcome =
  | { status: 'authenticated'; data: PortalBootstrapData }
  | { status: 'unlinked'; account: UnlinkedGoogleAccount };

let activeContext: ActiveSessionContext | null = null;

export function getActiveSessionContext(): ActiveSessionContext | null {
  return activeContext;
}

export function setAuthToken(_token: string | null): void {
  // Retained for compatibility; Firebase Auth manages session tokens directly.
}

function getCurrentVerifiedUser(): User {
  const u = auth.currentUser;
  if (!u || !u.email) {
    throw new Error('Please sign in with Google first.');
  }
  return u;
}

function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

async function getAdminDocOrNull(uid: string): Promise<boolean> {
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

async function isCurrentUserAdmin(): Promise<boolean> {
  const u = auth.currentUser;
  if (!u) return false;
  if (normalizeEmail(u.email) === BOOTSTRAP_ADMIN_EMAIL && u.emailVerified) {
    return true;
  }
  return getAdminDocOrNull(u.uid);
}

async function ensurePortalSeeded(adminUser: User): Promise<void> {
  const adminEmail = normalizeEmail(adminUser.email);

  // Ensure /admins/{uid} doc exists for bootstrap admin
  const adminDocRef = doc(db, 'admins', adminUser.uid);
  try {
    const adminSnap = await getDoc(adminDocRef);
    if (!adminSnap.exists() && adminEmail === BOOTSTRAP_ADMIN_EMAIL) {
      await setDoc(adminDocRef, {
        email: adminEmail,
        name: clampString(adminUser.displayName || 'Kallab Saha', 120),
        role: 'admin',
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${adminUser.uid}`);
  }

  // Ensure /users/{uid} link exists for admin
  const userLinkRef = doc(db, 'users', adminUser.uid);
  try {
    const linkSnap = await getDoc(userLinkRef);
    if (!linkSnap.exists()) {
      await setDoc(userLinkRef, {
        uid: adminUser.uid,
        role: 'admin',
        memberId: 'Kallab',
        email: adminEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${adminUser.uid}`);
  }

  // Seed initial institutional records only if settings/portal does not exist
  const settingsRef = doc(db, 'settings', 'portal');
  let alreadySeeded = false;
  try {
    const settingsSnap = await getDoc(settingsRef);
    alreadySeeded = settingsSnap.exists() && Boolean(settingsSnap.data()?.seeded);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/portal');
  }

  if (alreadySeeded) return;

  const teacherSeeds = [
    {
      id: 'Subham',
      name: 'Prof. Subham Das',
      department: 'C.S.E (I.O.T.)',
      designation: 'Assistant Professor',
      email: 'subham.das@institute.edu',
      subjects: ['CS501', 'IOT504'],
      permissions: { ...DEFAULT_TEACHER_PERMISSIONS },
      portalPassword: '741166',
      createdAt: '2026-08-01',
    },
    {
      id: 'Saikat',
      name: 'Prof. Saikat Sen',
      department: 'C.S.E (I.O.T.)',
      designation: 'Associate Professor',
      email: 'saikat.sen@institute.edu',
      subjects: ['CS502', 'CS505'],
      permissions: { ...DEFAULT_TEACHER_PERMISSIONS },
      portalPassword: '741167',
      createdAt: '2026-08-01',
    },
    {
      id: 'Shivam',
      name: 'Prof. Shivam Verma',
      department: 'C.S.E (I.O.T.)',
      designation: 'Assistant Professor',
      email: 'shivam.verma@institute.edu',
      subjects: ['CS503', 'CS506'],
      permissions: { ...DEFAULT_TEACHER_PERMISSIONS },
      portalPassword: '741168',
      createdAt: '2026-08-01',
    },
  ];
  const teacherEmails = teacherSeeds.map((t) => t.email);

  const studentSeeds = [
    {
      id: '12024002034149',
      name: 'Aarav Mukherjee',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      section: 'C',
      rollNo: '19',
      email: 'aarav.mukherjee@student.edu',
      phone: '+91 98300 41219',
      projectTitle: 'Smart Greenhouse Telemetry Node',
      projectDetails: 'ESP32-based soil moisture & humidity monitoring dashboard.',
      enrolledAt: '2024-08-12',
    },
    {
      id: '12024002034150',
      name: 'Riya Chatterjee',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      section: 'C',
      rollNo: '20',
      email: 'riya.chatterjee@student.edu',
      phone: '+91 98300 41220',
      projectTitle: 'Edge Vision Campus Gate Monitor',
      projectDetails: 'Low-power anomaly detection on Raspberry Pi 5.',
      enrolledAt: '2024-08-12',
    },
    {
      id: '12024002034151',
      name: 'Debanjan Sen',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      section: 'C',
      rollNo: '21',
      email: 'debanjan.sen@student.edu',
      phone: '+91 98300 41221',
      projectTitle: 'LoRaWAN Campus Air Quality Mesh',
      projectDetails: 'Distributed particulate sensor network.',
      enrolledAt: '2024-08-12',
    },
  ];
  const studentEmailMap = new Map(studentSeeds.map((s) => [s.id, s.email]));

  const subjectSeeds: SubjectRecord[] = [
    { id: 'sub-cs501', code: 'CS501', name: 'Design & Analysis of Algorithms', course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Subham' },
    { id: 'sub-cs502', code: 'CS502', name: 'Database Management Systems', course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Saikat' },
    { id: 'sub-cs503', code: 'CS503', name: 'Operating Systems', course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Shivam' },
    { id: 'sub-iot504', code: 'IOT504', name: 'IoT Architecture & Protocols', course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Subham' },
    { id: 'sub-cs505', code: 'CS505', name: 'Computer Networks', course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Saikat' },
    { id: 'sub-cs506', code: 'CS506', name: 'Java Practical & Software Lab', course: 'B.Tech, C.S.E (I.O.T.)', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Shivam' },
  ];

  const routineSeeds: RoutineSlot[] = [
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

  const calendarSeeds: CalendarEventRecord[] = [
    { id: 'cal-1', title: 'End-Semester Practical Viva', date: '2026-12-04', category: 'Exam', description: 'Lab viva for CS506 Java Practical & IOT504.' },
    { id: 'cal-2', title: 'Semester V Theory Examination', date: '2026-12-12', category: 'Exam', description: 'University examination schedule commences at 10:00 AM.' },
    { id: 'cal-3', title: 'Winter Academic Break', date: '2026-12-24', category: 'Holiday', description: 'Campus closed for winter recess.' },
  ];

  // Batch 1: Parent collections (settings, teachers, students, subjects, routine, calendar, applications)
  try {
    const batch1 = writeBatch(db);
    batch1.set(settingsRef, {
      attendanceThreshold: 75,
      instituteName: 'INSTITUTE OF ENGINEERING & MANAGEMENT',
      seeded: true,
      updatedAt: serverTimestamp(),
    });

    for (const t of teacherSeeds) {
      batch1.set(doc(db, 'teachers', t.id), {
        id: t.id,
        instituteId: INSTITUTE_ID,
        name: t.name,
        department: t.department,
        designation: t.designation,
        subjects: t.subjects,
        permissions: t.permissions,
        createdAt: t.createdAt,
      });
      batch1.set(doc(db, 'teacherPrivate', t.id), {
        id: t.id,
        email: t.email,
        portalPassword: t.portalPassword,
        isDefaultPassword: true,
        updatedAt: serverTimestamp(),
      });
    }

    for (const s of studentSeeds) {
      batch1.set(doc(db, 'students', s.id), {
        id: s.id,
        name: s.name,
        course: s.course,
        semester: s.semester,
        section: s.section,
        rollNo: s.rollNo,
        photoUrl: '',
        projectTitle: s.projectTitle,
        projectDetails: s.projectDetails,
        status: 'active',
        enrolledAt: s.enrolledAt,
        studentEmail: s.email,
        teacherEmails,
      });
      batch1.set(doc(db, 'studentPrivate', s.id), {
        id: s.id,
        email: s.email,
        phone: s.phone,
        portalPassword: '123456',
        isDefaultPassword: true,
        updatedAt: serverTimestamp(),
      });
    }

    for (const sub of subjectSeeds) {
      batch1.set(doc(db, 'subjects', sub.id), {
        ...sub,
        instituteId: INSTITUTE_ID,
      });
    }

    for (const slot of routineSeeds) {
      batch1.set(doc(db, 'routine', slot.id), {
        ...slot,
        instituteId: INSTITUTE_ID,
      });
    }

    for (const ev of calendarSeeds) {
      batch1.set(doc(db, 'calendarEvents', ev.id), {
        ...ev,
        instituteId: INSTITUTE_ID,
      });
    }

    batch1.set(doc(db, 'studentApplications', 'APP-202601'), {
      id: 'APP-202601',
      applicantUid: 'SEED_APPLICANT',
      name: 'Ananya Sen',
      course: 'B.Tech, C.S.E (I.O.T.)',
      semester: 5,
      section: 'C',
      rollNo: '22',
      email: 'ananya.sen@applicant.edu',
      phone: '+91 98300 41222',
      requestedPassword: '123456',
      status: 'Pending',
      assignedStudentId: null,
      submittedAt: '2026-11-24',
      reviewedAt: null,
      reviewedBy: null,
      notes: 'Newly admitted Semester V transfer student requesting portal ID.',
    });

    await batch1.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seed-batch-1');
  }

  // Batch 2: Relational child collections referencing committed students and subjects
  try {
    const batch2 = writeBatch(db);

    const attendanceSeeds: AttendanceRecord[] = [
      { id: 'att-2026-11-18-sub-cs501-12024002034149', date: '2026-11-18', subjectId: 'sub-cs501', studentId: '12024002034149', status: 'Present', markedBy: 'Subham' },
      { id: 'att-2026-11-20-sub-cs501-12024002034149', date: '2026-11-20', subjectId: 'sub-cs501', studentId: '12024002034149', status: 'Present', markedBy: 'Subham' },
      { id: 'att-2026-11-22-sub-cs501-12024002034149', date: '2026-11-22', subjectId: 'sub-cs501', studentId: '12024002034149', status: 'Present', markedBy: 'Subham' },
      { id: 'att-2026-11-24-sub-cs501-12024002034149', date: '2026-11-24', subjectId: 'sub-cs501', studentId: '12024002034149', status: 'Present', markedBy: 'Subham' },
      { id: 'att-2026-11-18-sub-cs502-12024002034149', date: '2026-11-18', subjectId: 'sub-cs502', studentId: '12024002034149', status: 'Present', markedBy: 'Saikat' },
      { id: 'att-2026-11-21-sub-cs502-12024002034149', date: '2026-11-21', subjectId: 'sub-cs502', studentId: '12024002034149', status: 'Absent', markedBy: 'Saikat' },
      { id: 'att-2026-11-23-sub-cs502-12024002034149', date: '2026-11-23', subjectId: 'sub-cs502', studentId: '12024002034149', status: 'Present', markedBy: 'Saikat' },
      { id: 'att-2026-11-19-sub-cs503-12024002034149', date: '2026-11-19', subjectId: 'sub-cs503', studentId: '12024002034149', status: 'Present', markedBy: 'Shivam' },
      { id: 'att-2026-11-22-sub-cs503-12024002034149', date: '2026-11-22', subjectId: 'sub-cs503', studentId: '12024002034149', status: 'Present', markedBy: 'Shivam' },
      { id: 'att-2026-11-24-sub-cs501-12024002034150', date: '2026-11-24', subjectId: 'sub-cs501', studentId: '12024002034150', status: 'Present', markedBy: 'Subham' },
      { id: 'att-2026-11-24-sub-cs501-12024002034151', date: '2026-11-24', subjectId: 'sub-cs501', studentId: '12024002034151', status: 'Absent', markedBy: 'Subham' },
    ];

    for (const att of attendanceSeeds) {
      batch2.set(doc(db, 'attendance', att.id), {
        ...att,
        studentEmail: studentEmailMap.get(att.studentId) || '',
        teacherEmails,
      });
    }

    const markSeeds: MarkRecord[] = [
      { id: 'mk-12024002034149-sub-cs501', studentId: '12024002034149', subjectId: 'sub-cs501', obtainedMarks: 84, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
      { id: 'mk-12024002034149-sub-cs502', studentId: '12024002034149', subjectId: 'sub-cs502', obtainedMarks: 76, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
      { id: 'mk-12024002034149-sub-cs503', studentId: '12024002034149', subjectId: 'sub-cs503', obtainedMarks: 68, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
      { id: 'mk-12024002034149-sub-iot504', studentId: '12024002034149', subjectId: 'sub-iot504', obtainedMarks: 88, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
      { id: 'mk-12024002034149-sub-cs505', studentId: '12024002034149', subjectId: 'sub-cs505', obtainedMarks: 72, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
      { id: 'mk-12024002034149-sub-cs506', studentId: '12024002034149', subjectId: 'sub-cs506', obtainedMarks: 91, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
      { id: 'mk-12024002034150-sub-cs501', studentId: '12024002034150', subjectId: 'sub-cs501', obtainedMarks: 79, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
      { id: 'mk-12024002034150-sub-cs502', studentId: '12024002034150', subjectId: 'sub-cs502', obtainedMarks: 34, updatedBy: 'Kallab', updatedAt: '2026-11-10' },
    ];

    for (const mk of markSeeds) {
      batch2.set(doc(db, 'marks', mk.id), {
        ...mk,
        studentEmail: studentEmailMap.get(mk.studentId) || '',
        teacherEmails,
      });
    }

    batch2.set(doc(db, 'assignments', 'asg-1'), {
      id: 'asg-1',
      instituteId: INSTITUTE_ID,
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
    });

    batch2.set(doc(db, 'assignments', 'asg-2'), {
      id: 'asg-2',
      instituteId: INSTITUTE_ID,
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
    });

    batch2.set(doc(db, 'materials', 'mat-1'), {
      id: 'mat-1',
      instituteId: INSTITUTE_ID,
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
    });

    batch2.set(doc(db, 'materials', 'mat-2'), {
      id: 'mat-2',
      instituteId: INSTITUTE_ID,
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
    });

    await batch2.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seed-batch-2');
  }
}

async function resolveContextForCurrentUser(
  preferredRole?: UserRole
): Promise<ActiveSessionContext | null> {
  const u = getCurrentVerifiedUser();
  const email = normalizeEmail(u.email);

  // 1. Check Admin first
  if (await isCurrentUserAdmin()) {
    await ensurePortalSeeded(u);
    activeContext = {
      uid: u.uid,
      role: 'admin',
      memberId: 'Kallab',
      email,
      displayName: u.displayName || 'Kallab Saha',
    };
    return activeContext;
  }

  // 2. Check existing /users/{uid} link
  try {
    const linkSnap = await getDoc(doc(db, 'users', u.uid));
    if (linkSnap.exists()) {
      const link = linkSnap.data() as { role: UserRole; memberId: string };
      if (!preferredRole || preferredRole === link.role) {
        activeContext = {
          uid: u.uid,
          role: link.role,
          memberId: link.memberId,
          email,
          displayName: u.displayName || link.memberId,
        };
        return activeContext;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
  }

  // 3. Match Teacher by verified Google email
  if (!preferredRole || preferredRole === 'teacher') {
    try {
      const tPrivSnap = await getDocs(
        query(collection(db, 'teacherPrivate'), where('email', '==', email))
      );
      if (!tPrivSnap.empty) {
        const teacherId = tPrivSnap.docs[0].id;
        await setDoc(doc(db, 'users', u.uid), {
          uid: u.uid,
          role: 'teacher',
          memberId: teacherId,
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        activeContext = {
          uid: u.uid,
          role: 'teacher',
          memberId: teacherId,
          email,
          displayName: u.displayName || teacherId,
        };
        return activeContext;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'teacherPrivate');
    }
  }

  // 4. Match Student by verified Google email
  if (!preferredRole || preferredRole === 'student') {
    try {
      const sPrivSnap = await getDocs(
        query(collection(db, 'studentPrivate'), where('email', '==', email))
      );
      if (!sPrivSnap.empty) {
        const studentId = sPrivSnap.docs[0].id;
        await setDoc(doc(db, 'users', u.uid), {
          uid: u.uid,
          role: 'student',
          memberId: studentId,
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        activeContext = {
          uid: u.uid,
          role: 'student',
          memberId: studentId,
          email,
          displayName: u.displayName || studentId,
        };
        return activeContext;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'studentPrivate');
    }
  }

  return null;
}

export async function fetchMyApplications(): Promise<StudentApplicationRecord[]> {
  const u = auth.currentUser;
  if (!u) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'studentApplications'), where('applicantUid', '==', u.uid))
    );
    return snap.docs.map((d) => {
      const data = d.data() as StudentApplicationRecord;
      return { ...data, id: d.id };
    });
  } catch {
    return [];
  }
}

export async function signInWithGoogle(
  preferredRole?: UserRole
): Promise<GoogleSignInOutcome> {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;
  if (!user.emailVerified) {
    throw new Error('Your Google account email must be verified to access the portal.');
  }

  const resolved = await resolveContextForCurrentUser(preferredRole);
  if (!resolved) {
    const applications = await fetchMyApplications();
    return {
      status: 'unlinked',
      account: {
        uid: user.uid,
        email: normalizeEmail(user.email),
        displayName: user.displayName || 'Google User',
        applications,
      },
    };
  }

  const data = await fetchPortalData();
  return { status: 'authenticated', data };
}

export async function restoreSessionIfAuthenticated(): Promise<GoogleSignInOutcome | null> {
  const u = auth.currentUser;
  if (!u || !u.emailVerified) return null;
  const resolved = await resolveContextForCurrentUser();
  if (!resolved) {
    const applications = await fetchMyApplications();
    return {
      status: 'unlinked',
      account: {
        uid: u.uid,
        email: normalizeEmail(u.email),
        displayName: u.displayName || 'Google User',
        applications,
      },
    };
  }
  const data = await fetchPortalData();
  return { status: 'authenticated', data };
}

export async function signOutPortal(): Promise<void> {
  activeContext = null;
  await signOut(auth);
}

export async function fetchPortalData(): Promise<PortalBootstrapData> {
  const ctx = activeContext || (await resolveContextForCurrentUser());
  if (!ctx) {
    throw new Error('Account is not linked to an institutional Student, Teacher, or Administrator record.');
  }

  // Shared academic catalogs
  let attendanceThreshold = 75;
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'portal'));
    if (settingsSnap.exists()) {
      const val = Number(settingsSnap.data()?.attendanceThreshold);
      if (Number.isFinite(val)) attendanceThreshold = val;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/portal');
  }

  const [subjectsSnap, routineSnap, assignmentsSnap, materialsSnap, calendarSnap, teachersSnap] =
    await Promise.all([
      getDocs(query(collection(db, 'subjects'), where('instituteId', '==', INSTITUTE_ID))).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'subjects')
      ),
      getDocs(query(collection(db, 'routine'), where('instituteId', '==', INSTITUTE_ID))).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'routine')
      ),
      getDocs(query(collection(db, 'assignments'), where('instituteId', '==', INSTITUTE_ID))).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'assignments')
      ),
      getDocs(query(collection(db, 'materials'), where('instituteId', '==', INSTITUTE_ID))).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'materials')
      ),
      getDocs(query(collection(db, 'calendarEvents'), where('instituteId', '==', INSTITUTE_ID))).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'calendarEvents')
      ),
      getDocs(query(collection(db, 'teachers'), where('instituteId', '==', INSTITUTE_ID))).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'teachers')
      ),
    ]);

  const subjects = subjectsSnap.docs.map((d) => d.data() as SubjectRecord);
  const routine = routineSnap.docs.map((d) => d.data() as RoutineSlot);
  const assignments = assignmentsSnap.docs
    .map((d) => d.data() as AssignmentRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const materials = materialsSnap.docs
    .map((d) => d.data() as StudyMaterialRecord)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const calendarEvents = calendarSnap.docs.map((d) => d.data() as CalendarEventRecord);

  const baseTeachers = teachersSnap.docs.map((d) => d.data() as TeacherRecord);

  if (ctx.role === 'admin') {
    const [tPrivSnap, stuSnap, sPrivSnap, attSnap, mkSnap, appSnap] = await Promise.all([
      getDocs(collection(db, 'teacherPrivate')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'teacherPrivate')
      ),
      getDocs(collection(db, 'students')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'students')
      ),
      getDocs(collection(db, 'studentPrivate')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'studentPrivate')
      ),
      getDocs(collection(db, 'attendance')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'attendance')
      ),
      getDocs(collection(db, 'marks')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'marks')
      ),
      getDocs(collection(db, 'studentApplications')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'studentApplications')
      ),
    ]);

    const tPrivMap = new Map(
      tPrivSnap.docs.map((d) => [
        d.id,
        d.data() as { email?: string; portalPassword?: string },
      ])
    );
    const teachers: TeacherRecord[] = baseTeachers.map((t) => {
      const priv = tPrivMap.get(t.id);
      return {
        ...t,
        email: priv?.email || '',
        password: priv?.portalPassword || '',
      };
    });

    const sPrivMap = new Map(
      sPrivSnap.docs.map((d) => [
        d.id,
        d.data() as { email?: string; phone?: string; portalPassword?: string },
      ])
    );
    const students: StudentRecord[] = stuSnap.docs.map((d) => {
      const pub = d.data() as StudentRecord;
      const priv = sPrivMap.get(d.id);
      return {
        ...pub,
        email: priv?.email || '',
        phone: priv?.phone || '',
        password: priv?.portalPassword || '',
      };
    });

    const user: SessionUser = {
      id: 'Kallab',
      role: 'admin',
      name: ctx.displayName || 'Kallab Saha',
      email: ctx.email,
      designation: 'Chief System Administrator',
      department: 'Administration',
      isDefaultPassword: false,
    };

    return {
      user,
      students,
      teachers,
      subjects,
      routine,
      attendance: attSnap.docs.map((d) => d.data() as AttendanceRecord),
      assignments,
      marks: mkSnap.docs.map((d) => d.data() as MarkRecord),
      materials,
      books: [],
      bookIssues: [],
      calendarEvents,
      studentApplications: appSnap.docs.map((d) => d.data() as StudentApplicationRecord),
      attendanceThreshold,
    };
  }

  if (ctx.role === 'teacher') {
    const teacher = baseTeachers.find((t) => t.id === ctx.memberId);
    if (!teacher) {
      throw new Error('Teacher profile not found.');
    }
    const perms = teacher.permissions;
    const canSeeRoster =
      hasTeacherPermission(perms, 'students_view') ||
      hasTeacherPermission(perms, 'attendance') ||
      hasTeacherPermission(perms, 'marks');

    const [studentsSnap, attSnap, mkSnap] = await Promise.all([
      canSeeRoster
        ? getDocs(
            query(collection(db, 'students'), where('teacherEmails', 'array-contains', ctx.email))
          ).catch((e) => handleFirestoreError(e, OperationType.LIST, 'students'))
        : Promise.resolve(null),
      hasTeacherPermission(perms, 'attendance')
        ? getDocs(
            query(collection(db, 'attendance'), where('teacherEmails', 'array-contains', ctx.email))
          ).catch((e) => handleFirestoreError(e, OperationType.LIST, 'attendance'))
        : Promise.resolve(null),
      hasTeacherPermission(perms, 'marks')
        ? getDocs(
            query(collection(db, 'marks'), where('teacherEmails', 'array-contains', ctx.email))
          ).catch((e) => handleFirestoreError(e, OperationType.LIST, 'marks'))
        : Promise.resolve(null),
    ]);

    const user: SessionUser = {
      id: teacher.id,
      role: 'teacher',
      name: teacher.name,
      email: ctx.email,
      department: teacher.department,
      designation: teacher.designation,
      permissions: teacher.permissions,
      isDefaultPassword: false,
    };

    return {
      user,
      students: studentsSnap
        ? studentsSnap.docs.map((d) => ({
            ...(d.data() as StudentRecord),
            email: '',
            phone: '',
          }))
        : [],
      teachers: baseTeachers.map((t) => ({ ...t, email: '' })),
      subjects,
      routine,
      attendance: attSnap ? attSnap.docs.map((d) => d.data() as AttendanceRecord) : [],
      assignments,
      marks: mkSnap ? mkSnap.docs.map((d) => d.data() as MarkRecord) : [],
      materials,
      books: [],
      bookIssues: [],
      calendarEvents,
      attendanceThreshold,
    };
  }

  // Student Role
  const [stuSnap, sPrivSnap, attSnap, mkSnap] = await Promise.all([
    getDoc(doc(db, 'students', ctx.memberId)).catch((e) =>
      handleFirestoreError(e, OperationType.GET, `students/${ctx.memberId}`)
    ),
    getDoc(doc(db, 'studentPrivate', ctx.memberId)).catch((e) =>
      handleFirestoreError(e, OperationType.GET, `studentPrivate/${ctx.memberId}`)
    ),
    getDocs(
      query(collection(db, 'attendance'), where('studentEmail', '==', ctx.email))
    ).catch((e) => handleFirestoreError(e, OperationType.LIST, 'attendance')),
    getDocs(
      query(collection(db, 'marks'), where('studentEmail', '==', ctx.email))
    ).catch((e) => handleFirestoreError(e, OperationType.LIST, 'marks')),
  ]);

  if (!stuSnap.exists()) {
    throw new Error('Student enrollment record not found.');
  }

  const stuPub = stuSnap.data() as StudentRecord;
  if (stuPub.status === 'inactive') {
    throw new Error('Student account is inactive. Contact Administrator.');
  }
  const sPriv = sPrivSnap.exists()
    ? (sPrivSnap.data() as { email?: string; phone?: string; isDefaultPassword?: boolean })
    : {};

  const studentFull: StudentRecord = {
    ...stuPub,
    email: sPriv.email || ctx.email,
    phone: sPriv.phone || '',
  };

  const user: SessionUser = {
    id: studentFull.id,
    role: 'student',
    name: studentFull.name,
    course: studentFull.course,
    semester: studentFull.semester,
    section: studentFull.section,
    rollNo: studentFull.rollNo,
    email: studentFull.email,
    phone: studentFull.phone,
    photoUrl: studentFull.photoUrl,
    projectTitle: studentFull.projectTitle,
    projectDetails: studentFull.projectDetails,
    isDefaultPassword: Boolean(sPriv.isDefaultPassword),
  };

  return {
    user,
    students: [studentFull],
    teachers: baseTeachers.map((t) => ({ ...t, email: '' })),
    subjects,
    routine,
    attendance: attSnap.docs.map((d) => d.data() as AttendanceRecord),
    assignments,
    marks: mkSnap.docs.map((d) => d.data() as MarkRecord),
    materials,
    books: [],
    bookIssues: [],
    calendarEvents,
    attendanceThreshold,
  };
}

async function getAdminTeacherEmailList(): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, 'teacherPrivate'));
    const emails = snap.docs
      .map((d) => normalizeEmail((d.data() as { email?: string }).email))
      .filter(Boolean);
    return Array.from(new Set(emails)).slice(0, 50);
  } catch {
    return [];
  }
}

async function syncTeacherEmailsAcrossRecords(): Promise<void> {
  const teacherEmails = await getAdminTeacherEmailList();
  const [stuSnap, attSnap, mkSnap] = await Promise.all([
    getDocs(collection(db, 'students')),
    getDocs(collection(db, 'attendance')),
    getDocs(collection(db, 'marks')),
  ]);

  const batch = writeBatch(db);
  for (const d of stuSnap.docs) {
    batch.update(d.ref, { teacherEmails });
  }
  for (const d of attSnap.docs) {
    batch.update(d.ref, { teacherEmails });
  }
  for (const d of mkSnap.docs) {
    batch.update(d.ref, { teacherEmails });
  }
  await batch.commit();
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const ctx = getActiveSessionContext();
  if (!ctx) throw new Error('Not signed in.');
  if (ctx.role === 'teacher') {
    throw new Error('Only the Administrator can change teacher login IDs and passwords.');
  }
  if (ctx.role === 'admin') {
    throw new Error('Administrator sign-in is secured directly by your verified Google Account.');
  }

  const cleaned = newPassword.trim();
  if (cleaned.length < 4 || cleaned.length > 64) {
    throw new Error('New password must be between 4 and 64 characters.');
  }

  const privRef = doc(db, 'studentPrivate', ctx.memberId);
  try {
    const snap = await getDoc(privRef);
    if (!snap.exists()) throw new Error('Student credential record not found.');
    const existingPass = String(snap.data()?.portalPassword || '');
    if (existingPass && currentPassword.trim() !== existingPass) {
      throw new Error('Current password is incorrect.');
    }
    await updateDoc(privRef, {
      portalPassword: cleaned,
      isDefaultPassword: false,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Current password')) throw err;
    handleFirestoreError(err, OperationType.UPDATE, `studentPrivate/${ctx.memberId}`);
  }
}

export async function enrollStudent(input: {
  studentId?: string;
  name: string;
  course: string;
  semester: number;
  section: string;
  rollNo: string;
  email: string;
  phone: string;
  initialPassword: string;
}): Promise<{ student: StudentRecord; generatedId: string }> {
  const cleanName = clampString(input.name, 120);
  const cleanCourse = clampString(input.course, 120);
  if (cleanName.length < 2 || cleanCourse.length < 2) {
    throw new Error('Student full name and course are required.');
  }
  const semNum = Number(input.semester);
  if (!Number.isInteger(semNum) || semNum < 1 || semNum > 10) {
    throw new Error('Semester must be between 1 and 10.');
  }

  const existingStuSnap = await getDocs(collection(db, 'students')).catch((e) =>
    handleFirestoreError(e, OperationType.LIST, 'students')
  );
  const existingIds = existingStuSnap.docs.map((d) => d.id);

  let generatedId = '';
  if (input.studentId && input.studentId.trim()) {
    const candidate = input.studentId.trim();
    if (!isValidFirestoreId(candidate) || candidate.length < 4) {
      throw new Error('Student ID must be 4-64 alphanumeric, dash, or underscore characters.');
    }
    if (existingIds.some((id) => id.toLowerCase() === candidate.toLowerCase())) {
      throw new Error('This Student ID already exists. Please generate a new unique ID.');
    }
    generatedId = candidate;
  } else {
    generatedId = generateUniqueStudentId(existingIds);
  }

  const cleanPass = clampString(input.initialPassword || '123456', 64);
  if (cleanPass.length < 4) {
    throw new Error('Initial password must be at least 4 characters.');
  }

  const cleanEmail = sanitizeEmail(input.email || '');
  const cleanPhone = clampString(input.phone || '', 32);
  const cleanSec = clampString((input.section || 'A').toUpperCase(), 16) || 'A';
  const cleanRoll = clampString(input.rollNo || String(existingIds.length + 1), 32);
  const enrolledAt = new Date().toISOString().slice(0, 10);
  const teacherEmails = await getAdminTeacherEmailList();

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'students', generatedId), {
      id: generatedId,
      name: cleanName,
      course: cleanCourse,
      semester: semNum,
      section: cleanSec,
      rollNo: cleanRoll,
      photoUrl: '',
      projectTitle: '',
      projectDetails: '',
      status: 'active',
      enrolledAt,
      studentEmail: cleanEmail,
      teacherEmails,
    });
    batch.set(doc(db, 'studentPrivate', generatedId), {
      id: generatedId,
      email: cleanEmail,
      phone: cleanPhone,
      portalPassword: cleanPass,
      isDefaultPassword: true,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students/${generatedId}`);
  }

  return {
    generatedId,
    student: {
      id: generatedId,
      name: cleanName,
      course: cleanCourse,
      semester: semNum,
      section: cleanSec,
      rollNo: cleanRoll,
      email: cleanEmail,
      phone: cleanPhone,
      photoUrl: '',
      projectTitle: '',
      projectDetails: '',
      status: 'active',
      enrolledAt,
      password: cleanPass,
    },
  };
}

export async function updateStudent(
  id: string,
  updates: Partial<StudentRecord> & { newPassword?: string }
): Promise<{ student: StudentRecord }> {
  const ctx = getActiveSessionContext();
  if (!ctx) throw new Error('Not signed in.');

  const stuRef = doc(db, 'students', id);
  const privRef = doc(db, 'studentPrivate', id);
  const [stuSnap, privSnap] = await Promise.all([
    getDoc(stuRef).catch((e) => handleFirestoreError(e, OperationType.GET, `students/${id}`)),
    getDoc(privRef).catch((e) => handleFirestoreError(e, OperationType.GET, `studentPrivate/${id}`)),
  ]);

  if (!stuSnap.exists()) {
    throw new Error('Student record not found.');
  }

  const currentPub = stuSnap.data() as StudentRecord & { studentEmail?: string };
  const currentPriv = (privSnap.exists() ? privSnap.data() : {}) as {
    email?: string;
    phone?: string;
    portalPassword?: string;
    isDefaultPassword?: boolean;
  };

  if (ctx.role === 'student') {
    if (ctx.memberId !== id) {
      throw new Error('You can only update your own profile.');
    }
    const pubPatch: Record<string, string> = {};
    if (typeof updates.photoUrl === 'string') {
      if (updates.photoUrl.length > 250000) {
        throw new Error('Photo size exceeds limit (~150KB).');
      }
      pubPatch.photoUrl = updates.photoUrl;
    }
    if (typeof updates.projectTitle === 'string') {
      pubPatch.projectTitle = clampString(updates.projectTitle, 200);
    }
    if (typeof updates.projectDetails === 'string') {
      pubPatch.projectDetails = clampString(updates.projectDetails, 1000);
    }

    if (Object.keys(pubPatch).length > 0) {
      await updateDoc(stuRef, pubPatch).catch((e) =>
        handleFirestoreError(e, OperationType.UPDATE, `students/${id}`)
      );
    }
    if (typeof updates.phone === 'string') {
      await updateDoc(privRef, {
        phone: clampString(updates.phone, 32),
        updatedAt: serverTimestamp(),
      }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, `studentPrivate/${id}`));
    }

    return {
      student: {
        ...currentPub,
        ...pubPatch,
        email: currentPriv.email || '',
        phone: typeof updates.phone === 'string' ? clampString(updates.phone, 32) : currentPriv.phone || '',
      },
    };
  }

  // Admin update
  const pubUpdates: Record<string, unknown> = {};
  if (typeof updates.name === 'string' && updates.name.trim()) {
    pubUpdates.name = clampString(updates.name, 120);
  }
  if (typeof updates.course === 'string' && updates.course.trim()) {
    pubUpdates.course = clampString(updates.course, 120);
  }
  if (updates.semester !== undefined && Number.isInteger(Number(updates.semester))) {
    pubUpdates.semester = Number(updates.semester);
  }
  if (typeof updates.section === 'string' && updates.section.trim()) {
    pubUpdates.section = clampString(updates.section.toUpperCase(), 16);
  }
  if (typeof updates.rollNo === 'string' && updates.rollNo.trim()) {
    pubUpdates.rollNo = clampString(updates.rollNo, 32);
  }
  if (updates.status === 'active' || updates.status === 'inactive') {
    pubUpdates.status = updates.status;
  }

  const nextEmail =
    typeof updates.email === 'string' ? sanitizeEmail(updates.email) : currentPriv.email || '';
  if (typeof updates.email === 'string') {
    pubUpdates.studentEmail = nextEmail;
  }

  const privUpdates: Record<string, unknown> = {
    email: nextEmail,
    phone:
      typeof updates.phone === 'string'
        ? clampString(updates.phone, 32)
        : currentPriv.phone || '',
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.newPassword === 'string' && updates.newPassword.trim()) {
    const cleanPass = clampString(updates.newPassword, 64);
    if (cleanPass.length < 4) {
      throw new Error('Student password must be at least 4 characters.');
    }
    privUpdates.portalPassword = cleanPass;
    privUpdates.isDefaultPassword = false;
  }

  const batch = writeBatch(db);
  if (Object.keys(pubUpdates).length > 0) {
    batch.update(stuRef, pubUpdates);
  }
  batch.update(privRef, privUpdates);
  await batch.commit().catch((e) =>
    handleFirestoreError(e, OperationType.UPDATE, `students/${id}`)
  );

  return {
    student: {
      ...currentPub,
      ...(pubUpdates as Partial<StudentRecord>),
      email: nextEmail,
      phone: String(privUpdates.phone || ''),
      password: String(privUpdates.portalPassword ?? currentPriv.portalPassword ?? ''),
    },
  };
}

export async function deleteStudent(id: string): Promise<void> {
  const [attSnap, mkSnap] = await Promise.all([
    getDocs(query(collection(db, 'attendance'), where('studentId', '==', id))),
    getDocs(query(collection(db, 'marks'), where('studentId', '==', id))),
  ]);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'students', id));
  batch.delete(doc(db, 'studentPrivate', id));
  for (const d of attSnap.docs) batch.delete(d.ref);
  for (const d of mkSnap.docs) batch.delete(d.ref);
  await batch.commit().catch((e) =>
    handleFirestoreError(e, OperationType.DELETE, `students/${id}`)
  );
}

export async function addTeacher(input: {
  id: string;
  name: string;
  password: string;
  department: string;
  designation: string;
  email: string;
}): Promise<{ teacher: TeacherRecord }> {
  const cleanId = input.id.trim();
  if (!isValidFirestoreId(cleanId) || cleanId.length < 2) {
    throw new Error('Teacher Login ID must be 2-64 alphanumeric, dash, or underscore characters.');
  }
  const cleanName = clampString(input.name, 120);
  if (cleanName.length < 2) {
    throw new Error('Teacher full name is required.');
  }
  const cleanPass = clampString(input.password, 64);
  if (cleanPass.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }
  if (cleanId.toLowerCase() === 'kallab') {
    throw new Error('Cannot use Administrator ID.');
  }

  const existingSnap = await getDoc(doc(db, 'teachers', cleanId));
  if (existingSnap.exists()) {
    throw new Error('A staff account with this ID already exists.');
  }

  const cleanEmail = sanitizeEmail(input.email || '');
  const cleanDept = clampString(input.department || 'C.S.E (I.O.T.)', 120) || 'C.S.E (I.O.T.)';
  const cleanDesig = clampString(input.designation || 'Assistant Professor', 120) || 'Assistant Professor';
  const createdAt = new Date().toISOString().slice(0, 10);

  const batch = writeBatch(db);
  batch.set(doc(db, 'teachers', cleanId), {
    id: cleanId,
    instituteId: INSTITUTE_ID,
    name: cleanName,
    department: cleanDept,
    designation: cleanDesig,
    subjects: [],
    permissions: { ...DEFAULT_TEACHER_PERMISSIONS },
    createdAt,
  });
  batch.set(doc(db, 'teacherPrivate', cleanId), {
    id: cleanId,
    email: cleanEmail,
    portalPassword: cleanPass,
    isDefaultPassword: true,
    updatedAt: serverTimestamp(),
  });
  await batch.commit().catch((e) =>
    handleFirestoreError(e, OperationType.CREATE, `teachers/${cleanId}`)
  );

  if (cleanEmail) {
    await syncTeacherEmailsAcrossRecords();
  }

  return {
    teacher: {
      id: cleanId,
      name: cleanName,
      department: cleanDept,
      designation: cleanDesig,
      email: cleanEmail,
      subjects: [],
      permissions: { ...DEFAULT_TEACHER_PERMISSIONS },
      createdAt,
      password: cleanPass,
    },
  };
}

export async function updateTeacherCredentials(
  id: string,
  input: {
    newId?: string;
    newPassword?: string;
    name?: string;
    department?: string;
    designation?: string;
    email?: string;
  }
): Promise<{ teacher: TeacherRecord }> {
  const tRef = doc(db, 'teachers', id);
  const privRef = doc(db, 'teacherPrivate', id);
  const [tSnap, privSnap] = await Promise.all([
    getDoc(tRef).catch((e) => handleFirestoreError(e, OperationType.GET, `teachers/${id}`)),
    getDoc(privRef).catch((e) => handleFirestoreError(e, OperationType.GET, `teacherPrivate/${id}`)),
  ]);

  if (!tSnap.exists()) throw new Error('Teacher not found.');

  const currentPub = tSnap.data() as TeacherRecord;
  const currentPriv = (privSnap.exists() ? privSnap.data() : {}) as {
    email?: string;
    portalPassword?: string;
    isDefaultPassword?: boolean;
  };

  const targetId = input.newId?.trim() ? input.newId.trim() : id;
  if (!isValidFirestoreId(targetId) || targetId.length < 2) {
    throw new Error('Teacher ID must be 2-64 alphanumeric characters.');
  }

  const nextName = input.name?.trim() ? clampString(input.name, 120) : currentPub.name;
  const nextDept = input.department?.trim()
    ? clampString(input.department, 120)
    : currentPub.department;
  const nextDesig = input.designation?.trim()
    ? clampString(input.designation, 120)
    : currentPub.designation;
  const nextEmail =
    typeof input.email === 'string' ? sanitizeEmail(input.email) : currentPriv.email || '';

  let nextPass = currentPriv.portalPassword || '741166';
  let nextIsDefault = Boolean(currentPriv.isDefaultPassword);
  if (input.newPassword && input.newPassword.trim()) {
    const cleaned = clampString(input.newPassword, 64);
    if (cleaned.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }
    nextPass = cleaned;
    nextIsDefault = false;
  }

  if (targetId !== id) {
    if (targetId.toLowerCase() === 'kallab') {
      throw new Error('Cannot rename Teacher ID to Administrator ID.');
    }
    const checkSnap = await getDoc(doc(db, 'teachers', targetId));
    if (checkSnap.exists()) {
      throw new Error('Target Teacher ID is already in use.');
    }
    const subjectsSnap = await getDocs(
      query(collection(db, 'subjects'), where('teacherId', '==', id))
    );
    const batch = writeBatch(db);
    batch.set(doc(db, 'teachers', targetId), {
      id: targetId,
      instituteId: INSTITUTE_ID,
      name: nextName,
      department: nextDept,
      designation: nextDesig,
      subjects: currentPub.subjects || [],
      permissions: currentPub.permissions,
      createdAt: currentPub.createdAt,
    });
    batch.set(doc(db, 'teacherPrivate', targetId), {
      id: targetId,
      email: nextEmail,
      portalPassword: nextPass,
      isDefaultPassword: nextIsDefault,
      updatedAt: serverTimestamp(),
    });
    for (const sDoc of subjectsSnap.docs) {
      batch.update(sDoc.ref, { teacherId: targetId });
    }
    batch.delete(tRef);
    batch.delete(privRef);
    await batch.commit().catch((e) =>
      handleFirestoreError(e, OperationType.WRITE, `teachers/${targetId}`)
    );
  } else {
    const batch = writeBatch(db);
    batch.update(tRef, {
      name: nextName,
      department: nextDept,
      designation: nextDesig,
    });
    batch.update(privRef, {
      email: nextEmail,
      portalPassword: nextPass,
      isDefaultPassword: nextIsDefault,
      updatedAt: serverTimestamp(),
    });
    await batch.commit().catch((e) =>
      handleFirestoreError(e, OperationType.UPDATE, `teachers/${id}`)
    );
  }

  if (typeof input.email === 'string') {
    await syncTeacherEmailsAcrossRecords();
  }

  return {
    teacher: {
      ...currentPub,
      id: targetId,
      name: nextName,
      department: nextDept,
      designation: nextDesig,
      email: nextEmail,
      password: nextPass,
    },
  };
}

export async function updateTeacherPermissions(
  id: string,
  permissions: TeacherPermissions
): Promise<{ teacher: TeacherRecord }> {
  const tRef = doc(db, 'teachers', id);
  const tSnap = await getDoc(tRef).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `teachers/${id}`)
  );
  if (!tSnap.exists()) throw new Error('Teacher not found.');

  await updateDoc(tRef, { permissions }).catch((e) =>
    handleFirestoreError(e, OperationType.UPDATE, `teachers/${id}`)
  );

  const current = tSnap.data() as TeacherRecord;
  return { teacher: { ...current, permissions } };
}

export async function deleteTeacher(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'teachers', id));
  batch.delete(doc(db, 'teacherPrivate', id));
  await batch.commit().catch((e) =>
    handleFirestoreError(e, OperationType.DELETE, `teachers/${id}`)
  );
  await syncTeacherEmailsAcrossRecords();
}

export async function createSubject(input: {
  code: string;
  name: string;
  course: string;
  semester: number;
  maxMarks: number;
  passingMarks: number;
  teacherId: string;
}): Promise<{ subject: SubjectRecord }> {
  const code = clampString(input.code.toUpperCase(), 24);
  const name = clampString(input.name, 160);
  if (code.length < 2 || name.length < 2) {
    throw new Error('Subject code and name are required.');
  }
  const id = sanitizeSlugId(`sub-${code.toLowerCase()}-${Date.now().toString(36).slice(-4)}`);
  const maxMarks = Math.max(1, Math.min(1000, Math.round(Number(input.maxMarks) || 100)));
  const passingMarks = Math.max(
    0,
    Math.min(maxMarks, Math.round(Number(input.passingMarks) || 40))
  );
  const subject: SubjectRecord = {
    id,
    code,
    name,
    course: clampString(input.course || 'B.Tech, C.S.E (I.O.T.)', 120),
    semester: Math.max(1, Math.min(10, Math.round(Number(input.semester) || 5))),
    maxMarks,
    passingMarks,
    teacherId: clampString(input.teacherId || 'Subham', 64),
  };

  await setDoc(doc(db, 'subjects', id), {
    ...subject,
    instituteId: INSTITUTE_ID,
  }).catch((e) => handleFirestoreError(e, OperationType.CREATE, `subjects/${id}`));

  return { subject };
}

export async function deleteSubject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'subjects', id)).catch((e) =>
    handleFirestoreError(e, OperationType.DELETE, `subjects/${id}`)
  );
}

export async function updateRoutineSlot(input: {
  day: string;
  period: number;
  course: string;
  semester: number;
  section: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  room: string;
}): Promise<{ routine: RoutineSlot[] }> {
  const cleanCourse = clampString(input.course || 'B.Tech, C.S.E (I.O.T.)', 120);
  const cleanSem = Math.max(1, Math.min(10, Math.round(Number(input.semester) || 5)));
  const cleanSec = clampString((input.section || 'C').toUpperCase(), 16) || 'C';
  const pNum = Math.max(1, Math.min(8, Math.round(Number(input.period) || 1))) as
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8;
  const day = input.day as DayOfWeek;

  // Match any existing slot for same day/period/section/semester
  const existingSnap = await getDocs(
    query(collection(db, 'routine'), where('instituteId', '==', INSTITUTE_ID))
  ).catch((e) => handleFirestoreError(e, OperationType.LIST, 'routine'));

  const matching = existingSnap.docs.find((d) => {
    const r = d.data() as RoutineSlot;
    return (
      r.day === day && r.period === pNum && r.section === cleanSec && r.semester === cleanSem
    );
  });

  if (!input.subjectCode.trim()) {
    if (matching) {
      await deleteDoc(matching.ref).catch((e) =>
        handleFirestoreError(e, OperationType.DELETE, `routine/${matching.id}`)
      );
    }
  } else {
    const slotId =
      matching?.id || sanitizeSlugId(`r-${day.toLowerCase()}-${pNum}-${cleanSec.toLowerCase()}-s${cleanSem}`);
    const slot: RoutineSlot = {
      id: slotId,
      day,
      period: pNum,
      course: cleanCourse,
      semester: cleanSem,
      section: cleanSec,
      subjectCode: clampString(input.subjectCode.toUpperCase(), 24),
      subjectName: clampString(input.subjectName || input.subjectCode, 160),
      teacherName: clampString(input.teacherName || '', 120),
      room: clampString(input.room || '', 40),
    };
    await setDoc(doc(db, 'routine', slotId), {
      ...slot,
      instituteId: INSTITUTE_ID,
    }).catch((e) => handleFirestoreError(e, OperationType.WRITE, `routine/${slotId}`));
  }

  const freshSnap = await getDocs(
    query(collection(db, 'routine'), where('instituteId', '==', INSTITUTE_ID))
  ).catch((e) => handleFirestoreError(e, OperationType.LIST, 'routine'));
  return { routine: freshSnap.docs.map((d) => d.data() as RoutineSlot) };
}

export async function submitAttendance(input: {
  date: string;
  subjectId: string;
  entries: { studentId: string; status: 'Present' | 'Absent' }[];
}): Promise<void> {
  const ctx = getActiveSessionContext();
  if (!ctx) throw new Error('Not signed in.');
  const markedBy = clampString(ctx.memberId || 'Admin', 64);

  for (const entry of input.entries) {
    if (!entry.studentId || (entry.status !== 'Present' && entry.status !== 'Absent')) {
      continue;
    }
    const stuSnap = await getDoc(doc(db, 'students', entry.studentId)).catch((e) =>
      handleFirestoreError(e, OperationType.GET, `students/${entry.studentId}`)
    );
    if (!stuSnap.exists()) continue;
    const stuData = stuSnap.data() as { studentEmail?: string; teacherEmails?: string[] };

    const attId = sanitizeSlugId(`att-${input.date}-${input.subjectId}-${entry.studentId}`);
    const attRef = doc(db, 'attendance', attId);
    const existingAtt = await getDoc(attRef).catch((e) =>
      handleFirestoreError(e, OperationType.GET, `attendance/${attId}`)
    );

    if (existingAtt.exists()) {
      await updateDoc(attRef, {
        status: entry.status,
        markedBy,
        studentEmail: stuData.studentEmail || '',
        teacherEmails: Array.isArray(stuData.teacherEmails) ? stuData.teacherEmails : [],
      }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, `attendance/${attId}`));
    } else {
      await setDoc(attRef, {
        id: attId,
        date: clampString(input.date, 20),
        subjectId: input.subjectId,
        studentId: entry.studentId,
        studentEmail: stuData.studentEmail || '',
        teacherEmails: Array.isArray(stuData.teacherEmails) ? stuData.teacherEmails : [],
        status: entry.status,
        markedBy,
      }).catch((e) => handleFirestoreError(e, OperationType.CREATE, `attendance/${attId}`));
    }
  }
}

export async function createAssignment(input: {
  title: string;
  subjectId: string;
  instructions: string;
  onlineDeadline: string;
  googleClassroomUrl: string;
  offlineDeadline: string;
  offlineInstructions: string;
}): Promise<{ assignment: AssignmentRecord }> {
  const ctx = getActiveSessionContext();
  if (!ctx) throw new Error('Not signed in.');

  const rawUrl = (input.googleClassroomUrl || '').trim();
  if (!isValidSafeHttpUrl(rawUrl)) {
    throw new Error('Google Classroom link must be a valid http(s) URL.');
  }

  const subSnap = await getDoc(doc(db, 'subjects', input.subjectId)).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `subjects/${input.subjectId}`)
  );
  if (!subSnap.exists()) throw new Error('Subject not found.');
  const sub = subSnap.data() as SubjectRecord;

  const id = sanitizeSlugId(`asg-${Date.now().toString(36)}`);
  const assignment: AssignmentRecord = {
    id,
    title: clampString(input.title, 200),
    subjectId: sub.id,
    subjectName: sub.name,
    course: sub.course,
    semester: sub.semester,
    instructions: clampString(input.instructions || '', 2000),
    onlineDeadline: clampString(input.onlineDeadline || '', 32),
    googleClassroomUrl: clampString(rawUrl, 500),
    offlineDeadline: clampString(input.offlineDeadline || '', 32),
    offlineInstructions: clampString(input.offlineInstructions || '', 1000),
    createdBy: clampString(ctx.memberId, 64),
    createdAt: new Date().toISOString().slice(0, 10),
  };

  await setDoc(doc(db, 'assignments', id), {
    ...assignment,
    instituteId: INSTITUTE_ID,
  }).catch((e) => handleFirestoreError(e, OperationType.CREATE, `assignments/${id}`));

  return { assignment };
}

export async function deleteAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'assignments', id)).catch((e) =>
    handleFirestoreError(e, OperationType.DELETE, `assignments/${id}`)
  );
}

export async function saveMark(input: {
  studentId: string;
  subjectId: string;
  obtainedMarks: number;
}): Promise<void> {
  const ctx = getActiveSessionContext();
  if (!ctx) throw new Error('Not signed in.');

  const [stuSnap, subSnap] = await Promise.all([
    getDoc(doc(db, 'students', input.studentId)).catch((e) =>
      handleFirestoreError(e, OperationType.GET, `students/${input.studentId}`)
    ),
    getDoc(doc(db, 'subjects', input.subjectId)).catch((e) =>
      handleFirestoreError(e, OperationType.GET, `subjects/${input.subjectId}`)
    ),
  ]);

  if (!stuSnap.exists()) throw new Error('Student not found.');
  if (!subSnap.exists()) throw new Error('Subject not found.');

  const stuData = stuSnap.data() as { studentEmail?: string; teacherEmails?: string[] };
  const subData = subSnap.data() as SubjectRecord;
  const score = Number(input.obtainedMarks);
  if (!Number.isFinite(score) || score < 0 || score > subData.maxMarks) {
    throw new Error(`Marks must be between 0 and ${subData.maxMarks}.`);
  }

  const markId = sanitizeSlugId(`mk-${input.studentId}-${input.subjectId}`);
  const markRef = doc(db, 'marks', markId);
  const existingSnap = await getDoc(markRef).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `marks/${markId}`)
  );

  const today = new Date().toISOString().slice(0, 10);
  if (existingSnap.exists()) {
    await updateDoc(markRef, {
      obtainedMarks: score,
      updatedBy: clampString(ctx.memberId, 64),
      updatedAt: today,
      studentEmail: stuData.studentEmail || '',
      teacherEmails: Array.isArray(stuData.teacherEmails) ? stuData.teacherEmails : [],
    }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, `marks/${markId}`));
  } else {
    await setDoc(markRef, {
      id: markId,
      studentId: input.studentId,
      studentEmail: stuData.studentEmail || '',
      teacherEmails: Array.isArray(stuData.teacherEmails) ? stuData.teacherEmails : [],
      subjectId: input.subjectId,
      obtainedMarks: score,
      updatedBy: clampString(ctx.memberId, 64),
      updatedAt: today,
    }).catch((e) => handleFirestoreError(e, OperationType.CREATE, `marks/${markId}`));
  }
}

export async function saveMarksBatch(input: {
  subjectId: string;
  entries: { studentId: string; obtainedMarks: number }[];
}): Promise<{ updatedCount: number }> {
  for (const entry of input.entries) {
    await saveMark({
      studentId: entry.studentId,
      subjectId: input.subjectId,
      obtainedMarks: entry.obtainedMarks,
    });
  }
  return { updatedCount: input.entries.length };
}

export async function createMaterial(input: {
  title: string;
  subjectId: string;
  type: 'PDF' | 'Notes' | 'Slides';
  resourceUrl: string;
  description: string;
}): Promise<{ material: StudyMaterialRecord }> {
  const ctx = getActiveSessionContext();
  if (!ctx) throw new Error('Not signed in.');

  const rawUrl = (input.resourceUrl || '').trim();
  if (!isValidSafeHttpUrl(rawUrl)) {
    throw new Error('Resource URL must be a valid http(s) URL.');
  }

  const subSnap = await getDoc(doc(db, 'subjects', input.subjectId)).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `subjects/${input.subjectId}`)
  );
  if (!subSnap.exists()) throw new Error('Subject not found.');
  const sub = subSnap.data() as SubjectRecord;

  const id = sanitizeSlugId(`mat-${Date.now().toString(36)}`);
  const material: StudyMaterialRecord = {
    id,
    title: clampString(input.title, 200),
    course: sub.course,
    semester: sub.semester,
    subjectId: sub.id,
    subjectName: sub.name,
    type: input.type === 'Notes' || input.type === 'Slides' ? input.type : 'PDF',
    resourceUrl: clampString(rawUrl, 500),
    description: clampString(input.description || '', 1000),
    uploadedBy: clampString(ctx.memberId, 64),
    uploadedAt: new Date().toISOString().slice(0, 10),
  };

  await setDoc(doc(db, 'materials', id), {
    ...material,
    instituteId: INSTITUTE_ID,
  }).catch((e) => handleFirestoreError(e, OperationType.CREATE, `materials/${id}`));

  return { material };
}

export async function deleteMaterial(id: string): Promise<void> {
  await deleteDoc(doc(db, 'materials', id)).catch((e) =>
    handleFirestoreError(e, OperationType.DELETE, `materials/${id}`)
  );
}

export async function createBook(_input: {
  isbn: string;
  title: string;
  author: string;
  category: string;
  totalCopies: number;
}): Promise<{ book: LibraryBookRecord }> {
  throw new Error('Library module is disabled.');
}

export async function issueBook(_input: {
  bookId: string;
  studentId: string;
  dueDate: string;
}): Promise<void> {
  throw new Error('Library module is disabled.');
}

export async function returnBook(_issueId: string): Promise<void> {
  throw new Error('Library module is disabled.');
}

export async function createCalendarEvent(input: {
  title: string;
  date: string;
  category: 'Exam' | 'Holiday' | 'Academic' | 'Event';
  description: string;
}): Promise<{ event: CalendarEventRecord }> {
  const id = sanitizeSlugId(`cal-${Date.now().toString(36)}`);
  const event: CalendarEventRecord = {
    id,
    title: clampString(input.title, 160),
    date: clampString(input.date, 20),
    category: ['Exam', 'Holiday', 'Academic', 'Event'].includes(input.category)
      ? input.category
      : 'Academic',
    description: clampString(input.description || '', 1000),
  };
  await setDoc(doc(db, 'calendarEvents', id), {
    ...event,
    instituteId: INSTITUTE_ID,
  }).catch((e) => handleFirestoreError(e, OperationType.CREATE, `calendarEvents/${id}`));
  return { event };
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'calendarEvents', id)).catch((e) =>
    handleFirestoreError(e, OperationType.DELETE, `calendarEvents/${id}`)
  );
}

export async function updateAttendanceThreshold(threshold: number): Promise<void> {
  const val = Math.round(Number(threshold));
  if (!Number.isInteger(val) || val < 0 || val > 100) {
    throw new Error('Attendance threshold must be between 0 and 100.');
  }
  await updateDoc(doc(db, 'settings', 'portal'), {
    attendanceThreshold: val,
    instituteName: 'INSTITUTE OF ENGINEERING & MANAGEMENT',
    seeded: true,
    updatedAt: serverTimestamp(),
  }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, 'settings/portal'));
}

export async function submitStudentApplication(input: {
  name: string;
  course: string;
  semester: number;
  section: string;
  rollNo: string;
  email: string;
  phone: string;
  requestedPassword: string;
  notes?: string;
}): Promise<{ applicationId: string; message: string }> {
  let u = auth.currentUser;
  if (!u || !u.emailVerified) {
    const cred = await signInWithPopup(auth, googleProvider);
    u = cred.user;
    if (!u.emailVerified || !u.email) {
      throw new Error('Verified Google sign-in is required to submit a Student ID request.');
    }
  }

  const verifiedEmail = normalizeEmail(u.email);
  const cleanName = clampString(input.name || u.displayName || '', 120);
  const cleanCourse = clampString(input.course, 120);
  const cleanPhone = clampString(input.phone, 32);
  const cleanPass = clampString(input.requestedPassword, 64);

  if (cleanName.length < 2 || cleanCourse.length < 2 || cleanPhone.length < 4) {
    throw new Error('Full name, course, and valid phone number are required.');
  }
  if (cleanPass.length < 4) {
    throw new Error('Requested password must be at least 4 characters.');
  }

  const semNum = Math.max(1, Math.min(10, Math.round(Number(input.semester) || 1)));
  const applicationId = sanitizeSlugId(`APP-${Date.now().toString().slice(-6)}`);

  const record = {
    id: applicationId,
    applicantUid: u.uid,
    name: cleanName,
    course: cleanCourse,
    semester: semNum,
    section: clampString((input.section || 'A').toUpperCase(), 16) || 'A',
    rollNo: clampString(input.rollNo || '', 32),
    email: verifiedEmail,
    phone: cleanPhone,
    requestedPassword: cleanPass,
    status: 'Pending',
    assignedStudentId: null,
    submittedAt: new Date().toISOString().slice(0, 10),
    reviewedAt: null,
    reviewedBy: null,
    notes: clampString(input.notes || '', 500),
  };

  await setDoc(doc(db, 'studentApplications', applicationId), record).catch((e) =>
    handleFirestoreError(e, OperationType.CREATE, `studentApplications/${applicationId}`)
  );

  return {
    applicationId,
    message: `Submitted request ${applicationId} with verified email ${verifiedEmail}.`,
  };
}

export async function approveStudentApplication(
  id: string,
  input: { customStudentId?: string; overridePassword?: string } = {}
): Promise<{
  application: StudentApplicationRecord;
  student: StudentRecord;
  generatedId: string;
}> {
  const appRef = doc(db, 'studentApplications', id);
  const appSnap = await getDoc(appRef).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `studentApplications/${id}`)
  );
  if (!appSnap.exists()) throw new Error('Application not found.');
  const app = appSnap.data() as StudentApplicationRecord & { applicantUid: string };
  if (app.status !== 'Pending') {
    throw new Error(`Application is already ${app.status}.`);
  }

  const chosenPass = input.overridePassword?.trim()
    ? clampString(input.overridePassword, 64)
    : app.requestedPassword || '123456';

  const enrolled = await enrollStudent({
    studentId: input.customStudentId,
    name: app.name,
    course: app.course,
    semester: app.semester,
    section: app.section,
    rollNo: app.rollNo,
    email: app.email,
    phone: app.phone,
    initialPassword: chosenPass,
  });

  const reviewedAt = new Date().toISOString().slice(0, 10);
  await updateDoc(appRef, {
    status: 'Approved',
    assignedStudentId: enrolled.generatedId,
    reviewedAt,
    reviewedBy: 'Kallab',
  }).catch((e) =>
    handleFirestoreError(e, OperationType.UPDATE, `studentApplications/${id}`)
  );

  return {
    generatedId: enrolled.generatedId,
    student: enrolled.student,
    application: {
      ...app,
      status: 'Approved',
      assignedStudentId: enrolled.generatedId,
      reviewedAt,
      reviewedBy: 'Kallab',
    },
  };
}

export async function rejectStudentApplication(
  id: string
): Promise<{ application: StudentApplicationRecord }> {
  const appRef = doc(db, 'studentApplications', id);
  const appSnap = await getDoc(appRef).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `studentApplications/${id}`)
  );
  if (!appSnap.exists()) throw new Error('Application not found.');
  const app = appSnap.data() as StudentApplicationRecord;

  const reviewedAt = new Date().toISOString().slice(0, 10);
  await updateDoc(appRef, {
    status: 'Rejected',
    assignedStudentId: null,
    reviewedAt,
    reviewedBy: 'Kallab',
  }).catch((e) =>
    handleFirestoreError(e, OperationType.UPDATE, `studentApplications/${id}`)
  );

  return {
    application: {
      ...app,
      status: 'Rejected',
      assignedStudentId: null,
      reviewedAt,
      reviewedBy: 'Kallab',
    },
  };
}
