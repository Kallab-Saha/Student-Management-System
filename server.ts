import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  DayOfWeek,
  PortalBootstrapData,
  SessionUser,
  StudentApplicationRecord,
  StudentRecord,
  TeacherPermissionKey,
  TeacherRecord,
  UserRole,
} from './src/types/portal.ts';
import {
  DEFAULT_TEACHER_PERMISSIONS,
  generateUniqueStudentId,
  hasTeacherPermission,
  isValidSafeHttpUrl,
} from './src/utils/academicRules.ts';
import { hashPassword, signSessionToken, verifyPassword, verifySessionToken } from './server/auth.ts';
import { getDatabase, saveDatabase, type PortalDatabase } from './server/store.ts';

interface AuthedRequest extends Request {
  auth?: {
    id: string;
    role: UserRole;
  };
}

function sanitizeStudent(
  s: PortalDatabase['students'][number],
  includePassword = false
): StudentRecord {
  const { passwordHash: _ph, isDefaultPassword: _dp, currentPassword, ...rest } = s;
  return includePassword ? { ...rest, password: currentPassword || '' } : rest;
}

function sanitizeTeacher(
  t: PortalDatabase['teachers'][number],
  includePassword = false
): TeacherRecord {
  const { passwordHash: _ph, isDefaultPassword: _dp, currentPassword, ...rest } = t;
  return includePassword ? { ...rest, password: currentPassword || '' } : rest;
}

function sanitizeStudentApplication(
  a: PortalDatabase['studentApplications'][number],
  includePassword = false
): StudentApplicationRecord {
  const { requestedPasswordHash: _rph, requestedPassword, ...rest } = a;
  return includePassword ? { ...rest, requestedPassword: requestedPassword || '' } : rest;
}

function buildSessionUser(db: PortalDatabase, id: string, role: UserRole): SessionUser | null {
  if (role === 'admin') {
    if (db.admin.id !== id) return null;
    return {
      id: db.admin.id,
      role: 'admin',
      name: db.admin.name,
      email: db.admin.email,
      designation: 'Chief System Administrator',
      department: 'Administration',
      isDefaultPassword: db.admin.isDefaultPassword,
    };
  }
  if (role === 'teacher') {
    const teacher = db.teachers.find((t) => t.id === id);
    if (!teacher) return null;
    return {
      id: teacher.id,
      role: 'teacher',
      name: teacher.name,
      email: teacher.email,
      department: teacher.department,
      designation: teacher.designation,
      permissions: teacher.permissions,
      isDefaultPassword: teacher.isDefaultPassword,
    };
  }
  const student = db.students.find((s) => s.id === id);
  if (!student) return null;
  return {
    id: student.id,
    role: 'student',
    name: student.name,
    course: student.course,
    semester: student.semester,
    section: student.section,
    rollNo: student.rollNo,
    email: student.email,
    phone: student.phone,
    photoUrl: student.photoUrl,
    projectTitle: student.projectTitle,
    projectDetails: student.projectDetails,
    isDefaultPassword: student.isDefaultPassword,
  };
}

function buildPortalData(db: PortalDatabase, user: SessionUser): PortalBootstrapData {
  if (user.role === 'admin') {
    return {
      user,
      students: db.students.map((s) => sanitizeStudent(s, true)),
      teachers: db.teachers.map((t) => sanitizeTeacher(t, true)),
      subjects: db.subjects,
      routine: db.routine,
      attendance: db.attendance,
      assignments: db.assignments,
      marks: db.marks,
      materials: db.materials,
      books: db.books,
      bookIssues: db.bookIssues,
      calendarEvents: db.calendarEvents,
      studentApplications: (db.studentApplications || []).map((a) =>
        sanitizeStudentApplication(a, true)
      ),
      attendanceThreshold: db.attendanceThreshold,
    };
  }

  if (user.role === 'teacher') {
    const perms = user.permissions;
    const canSeeRoster =
      hasTeacherPermission(perms, 'students_view') ||
      hasTeacherPermission(perms, 'attendance') ||
      hasTeacherPermission(perms, 'marks');

    return {
      user,
      students: canSeeRoster ? db.students.map((s) => sanitizeStudent(s, false)) : [],
      teachers: db.teachers.map((t) => sanitizeTeacher(t, false)),
      subjects: db.subjects,
      routine: db.routine,
      attendance: hasTeacherPermission(perms, 'attendance') ? db.attendance : [],
      assignments: db.assignments,
      marks: hasTeacherPermission(perms, 'marks') ? db.marks : [],
      materials: db.materials,
      books: [],
      bookIssues: [],
      calendarEvents: db.calendarEvents,
      attendanceThreshold: db.attendanceThreshold,
    };
  }

  // Student sees only their own personal/attendance/marks/issue records + shared academic info
  return {
    user,
    students: db.students.filter((s) => s.id === user.id).map((s) => sanitizeStudent(s, false)),
    teachers: db.teachers.map((t) => sanitizeTeacher(t, false)),
    subjects: db.subjects,
    routine: db.routine,
    attendance: db.attendance.filter((a) => a.studentId === user.id),
    assignments: db.assignments,
    marks: db.marks.filter((m) => m.studentId === user.id),
    materials: db.materials,
    books: db.books,
    bookIssues: db.bookIssues.filter((i) => i.studentId === user.id),
    calendarEvents: db.calendarEvents,
    attendanceThreshold: db.attendanceThreshold,
  };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }
  req.auth = { id: payload.id, role: payload.role };
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required' });
    return;
  }
  next();
}

function requireTeacherPermission(permission: TeacherPermissionKey) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.auth.role === 'admin') {
      next();
      return;
    }
    if (req.auth.role === 'teacher') {
      const db = getDatabase();
      const teacher = db.teachers.find((t) => t.id === req.auth?.id);
      if (teacher && hasTeacherPermission(teacher.permissions, permission)) {
        next();
        return;
      }
    }
    res.status(403).json({
      error: `Access denied. Administrator must authorize "${permission}" permission for your account.`,
    });
  };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Ensure DB is initialized on boot
  getDatabase();

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, mode: process.env.NODE_ENV || 'development' });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { userId, password, role } = req.body as {
      userId?: unknown;
      password?: unknown;
      role?: unknown;
    };

    if (
      typeof userId !== 'string' ||
      typeof password !== 'string' ||
      (role !== 'admin' && role !== 'teacher' && role !== 'student')
    ) {
      res.status(400).json({ error: 'User ID, password, and role are required' });
      return;
    }

    const cleanId = userId.trim();
    const db = getDatabase();

    if (role === 'admin') {
      if (
        cleanId !== db.admin.id ||
        !verifyPassword(password, db.admin.passwordHash)
      ) {
        res.status(401).json({ error: 'Invalid Administrator ID or password' });
        return;
      }
      const sessionUser = buildSessionUser(db, db.admin.id, 'admin');
      if (!sessionUser) {
        res.status(500).json({ error: 'Failed to load admin session' });
        return;
      }
      const token = signSessionToken(db.admin.id, 'admin');
      res.json({ token, data: buildPortalData(db, sessionUser) });
      return;
    }

    if (role === 'teacher') {
      const teacher = db.teachers.find(
        (t) => t.id.toLowerCase() === cleanId.toLowerCase()
      );
      if (!teacher || !verifyPassword(password, teacher.passwordHash)) {
        res.status(401).json({ error: 'Invalid Teacher ID or password' });
        return;
      }
      const sessionUser = buildSessionUser(db, teacher.id, 'teacher');
      if (!sessionUser) {
        res.status(500).json({ error: 'Failed to load teacher session' });
        return;
      }
      const token = signSessionToken(teacher.id, 'teacher');
      res.json({ token, data: buildPortalData(db, sessionUser) });
      return;
    }

    // Student login
    const student = db.students.find((s) => s.id === cleanId);
    if (!student || !verifyPassword(password, student.passwordHash)) {
      res.status(401).json({ error: 'Invalid Student ID or password' });
      return;
    }
    if (student.status === 'inactive') {
      res.status(403).json({ error: 'Student account is inactive. Contact Administrator.' });
      return;
    }
    const sessionUser = buildSessionUser(db, student.id, 'student');
    if (!sessionUser) {
      res.status(500).json({ error: 'Failed to load student session' });
      return;
    }
    const token = signSessionToken(student.id, 'student');
    res.json({ token, data: buildPortalData(db, sessionUser) });
  });

  app.get('/api/portal', requireAuth, (req: AuthedRequest, res: Response) => {
    const db = getDatabase();
    const user = buildSessionUser(db, req.auth!.id, req.auth!.role);
    if (!user) {
      res.status(401).json({ error: 'Account no longer exists' });
      return;
    }
    res.json({ data: buildPortalData(db, user) });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Current and new passwords are required' });
      return;
    }
    if (newPassword.trim().length < 4) {
      res.status(400).json({ error: 'New password must be at least 4 characters' });
      return;
    }

    if (req.auth!.role === 'teacher') {
      res.status(403).json({
        error: 'Only the Administrator can change teacher login IDs and passwords.',
      });
      return;
    }

    const db = getDatabase();
    if (req.auth!.role === 'admin') {
      if (!verifyPassword(currentPassword, db.admin.passwordHash)) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
      db.admin.passwordHash = hashPassword(newPassword.trim());
      db.admin.isDefaultPassword = false;
      saveDatabase(db);
      res.json({ ok: true });
      return;
    }

    const student = db.students.find((s) => s.id === req.auth!.id);
    if (!student || !verifyPassword(currentPassword, student.passwordHash)) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }
    student.passwordHash = hashPassword(newPassword.trim());
    student.currentPassword = newPassword.trim();
    student.isDefaultPassword = false;
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- ADMIN: STUDENT ENROLLMENT & MANAGEMENT ---
  app.post('/api/students', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const { studentId, name, course, semester, section, rollNo, email, phone, initialPassword } =
      req.body as {
        studentId?: unknown;
        name?: unknown;
        course?: unknown;
        semester?: unknown;
        section?: unknown;
        rollNo?: unknown;
        email?: unknown;
        phone?: unknown;
        initialPassword?: unknown;
      };

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Student full name is required' });
      return;
    }
    if (typeof course !== 'string' || !course.trim()) {
      res.status(400).json({ error: 'Course is required' });
      return;
    }
    const semNum = Number(semester);
    if (!Number.isInteger(semNum) || semNum < 1 || semNum > 10) {
      res.status(400).json({ error: 'Semester must be between 1 and 10' });
      return;
    }
    const rawPass = typeof initialPassword === 'string' && initialPassword.trim().length >= 4
      ? initialPassword.trim()
      : '123456';

    const db = getDatabase();
    let generatedId = '';
    if (typeof studentId === 'string' && studentId.trim()) {
      const candidate = studentId.trim();
      if (!/^[A-Za-z0-9_-]{4,32}$/.test(candidate)) {
        res.status(400).json({ error: 'Student ID must be 4-32 alphanumeric characters' });
        return;
      }
      if (db.students.some((s) => s.id.toLowerCase() === candidate.toLowerCase())) {
        res.status(409).json({ error: 'This Student ID already exists. Please generate a new unique ID.' });
        return;
      }
      generatedId = candidate;
    } else {
      generatedId = generateUniqueStudentId(db.students.map((s) => s.id));
    }

    const newStudent: PortalDatabase['students'][number] = {
      id: generatedId,
      name: name.trim(),
      course: course.trim(),
      semester: semNum,
      section: typeof section === 'string' && section.trim() ? section.trim().toUpperCase() : 'A',
      rollNo: typeof rollNo === 'string' && rollNo.trim() ? rollNo.trim() : String(db.students.length + 1),
      email: typeof email === 'string' ? email.trim() : '',
      phone: typeof phone === 'string' ? phone.trim() : '',
      photoUrl: '',
      projectTitle: '',
      projectDetails: '',
      status: 'active',
      enrolledAt: new Date().toISOString().slice(0, 10),
      passwordHash: hashPassword(rawPass),
      currentPassword: rawPass,
      isDefaultPassword: true,
    };

    db.students.push(newStudent);
    saveDatabase(db);
    res.status(201).json({ student: sanitizeStudent(newStudent, true), generatedId });
  });

  app.patch('/api/students/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const targetId = req.params.id;
    const db = getDatabase();
    const student = db.students.find((s) => s.id === targetId);
    if (!student) {
      res.status(404).json({ error: 'Student record not found' });
      return;
    }

    if (req.auth!.role === 'student') {
      if (req.auth!.id !== targetId) {
        res.status(403).json({ error: 'You can only update your own profile' });
        return;
      }
      const { email, phone, photoUrl, projectTitle, projectDetails } = req.body as {
        email?: unknown;
        phone?: unknown;
        photoUrl?: unknown;
        projectTitle?: unknown;
        projectDetails?: unknown;
      };
      if (typeof email === 'string') student.email = email.trim();
      if (typeof phone === 'string') student.phone = phone.trim();
      if (typeof projectTitle === 'string') student.projectTitle = projectTitle.trim();
      if (typeof projectDetails === 'string') student.projectDetails = projectDetails.trim();
      if (typeof photoUrl === 'string') {
        if (
          photoUrl === '' ||
          photoUrl.startsWith('data:image/jpeg;base64,') ||
          photoUrl.startsWith('data:image/png;base64,') ||
          photoUrl.startsWith('data:image/jpg;base64,')
        ) {
          if (photoUrl.length > 250_000) {
            res.status(400).json({ error: 'Photo size exceeds limit (max ~150KB)' });
            return;
          }
          student.photoUrl = photoUrl;
        } else {
          res.status(400).json({ error: 'Invalid photo format. Use JPG or PNG.' });
          return;
        }
      }
      saveDatabase(db);
      res.json({ student: sanitizeStudent(student) });
      return;
    }

    if (req.auth!.role !== 'admin') {
      res.status(403).json({ error: 'Only Administrator can modify student records' });
      return;
    }

    const { name, course, semester, section, rollNo, email, phone, status, newPassword } =
      req.body as {
        name?: unknown;
        course?: unknown;
        semester?: unknown;
        section?: unknown;
        rollNo?: unknown;
        email?: unknown;
        phone?: unknown;
        status?: unknown;
        newPassword?: unknown;
      };

    if (typeof name === 'string' && name.trim()) student.name = name.trim();
    if (typeof course === 'string' && course.trim()) student.course = course.trim();
    if (semester !== undefined && Number.isInteger(Number(semester))) {
      student.semester = Number(semester);
    }
    if (typeof section === 'string' && section.trim()) student.section = section.trim().toUpperCase();
    if (typeof rollNo === 'string' && rollNo.trim()) student.rollNo = rollNo.trim();
    if (typeof email === 'string') student.email = email.trim();
    if (typeof phone === 'string') student.phone = phone.trim();
    if (status === 'active' || status === 'inactive') student.status = status;
    if (typeof newPassword === 'string' && newPassword.trim()) {
      const cleanPass = newPassword.trim();
      if (cleanPass.length < 4) {
        res.status(400).json({ error: 'Student password must be at least 4 characters' });
        return;
      }
      student.passwordHash = hashPassword(cleanPass);
      student.currentPassword = cleanPass;
      student.isDefaultPassword = false;
    }

    saveDatabase(db);
    res.json({ student: sanitizeStudent(student, true) });
  });

  app.delete('/api/students/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const db = getDatabase();
    const idx = db.students.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    db.students.splice(idx, 1);
    db.attendance = db.attendance.filter((a) => a.studentId !== req.params.id);
    db.marks = db.marks.filter((m) => m.studentId !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- ADMIN ONLY: TEACHER MANAGEMENT & PERMISSIONS ---
  app.post('/api/teachers', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const { id, name, password, department, designation, email } = req.body as {
      id?: unknown;
      name?: unknown;
      password?: unknown;
      department?: unknown;
      designation?: unknown;
      email?: unknown;
    };

    if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Teacher ID and full name are required' });
      return;
    }
    if (typeof password !== 'string' || password.trim().length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters' });
      return;
    }

    const db = getDatabase();
    const cleanId = id.trim();
    if (
      cleanId.toLowerCase() === db.admin.id.toLowerCase() ||
      db.teachers.some((t) => t.id.toLowerCase() === cleanId.toLowerCase())
    ) {
      res.status(409).json({ error: 'A staff account with this ID already exists' });
      return;
    }

    const newTeacher: PortalDatabase['teachers'][number] = {
      id: cleanId,
      name: name.trim(),
      department: typeof department === 'string' && department.trim() ? department.trim() : 'C.S.E (I.O.T.)',
      designation: typeof designation === 'string' && designation.trim() ? designation.trim() : 'Assistant Professor',
      email: typeof email === 'string' ? email.trim() : '',
      subjects: [],
      permissions: { ...DEFAULT_TEACHER_PERMISSIONS },
      passwordHash: hashPassword(password.trim()),
      currentPassword: password.trim(),
      isDefaultPassword: true,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    db.teachers.push(newTeacher);
    saveDatabase(db);
    res.status(201).json({ teacher: sanitizeTeacher(newTeacher, true) });
  });

  app.patch(
    '/api/teachers/:id/credentials',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const { newId, newPassword, name, department, designation } = req.body as {
        newId?: unknown;
        newPassword?: unknown;
        name?: unknown;
        department?: unknown;
        designation?: unknown;
      };

      const db = getDatabase();
      const teacher = db.teachers.find((t) => t.id === req.params.id);
      if (!teacher) {
        res.status(404).json({ error: 'Teacher not found' });
        return;
      }

      if (typeof newId === 'string' && newId.trim() && newId.trim() !== teacher.id) {
        const candidateId = newId.trim();
        if (
          candidateId.toLowerCase() === db.admin.id.toLowerCase() ||
          db.teachers.some((t) => t.id.toLowerCase() === candidateId.toLowerCase())
        ) {
          res.status(409).json({ error: 'Target Teacher ID is already in use' });
          return;
        }
        const oldId = teacher.id;
        teacher.id = candidateId;
        for (const sub of db.subjects) {
          if (sub.teacherId === oldId) sub.teacherId = candidateId;
        }
      }

      if (typeof newPassword === 'string' && newPassword.trim()) {
        const cleanPass = newPassword.trim();
        if (cleanPass.length < 4) {
          res.status(400).json({ error: 'Password must be at least 4 characters' });
          return;
        }
        teacher.passwordHash = hashPassword(cleanPass);
        teacher.currentPassword = cleanPass;
        teacher.isDefaultPassword = false;
      }

      if (typeof name === 'string' && name.trim()) teacher.name = name.trim();
      if (typeof department === 'string' && department.trim()) teacher.department = department.trim();
      if (typeof designation === 'string' && designation.trim()) teacher.designation = designation.trim();

      saveDatabase(db);
      res.json({ teacher: sanitizeTeacher(teacher, true) });
    }
  );

  app.patch(
    '/api/teachers/:id/permissions',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const { permissions } = req.body as { permissions?: Record<string, unknown> };
      if (!permissions || typeof permissions !== 'object') {
        res.status(400).json({ error: 'Permissions object is required' });
        return;
      }

      const db = getDatabase();
      const teacher = db.teachers.find((t) => t.id === req.params.id);
      if (!teacher) {
        res.status(404).json({ error: 'Teacher not found' });
        return;
      }

      const keys: TeacherPermissionKey[] = [
        'attendance',
        'assignments',
        'routine',
        'marks',
        'materials',
        'students_view',
        'calendar',
      ];
      for (const k of keys) {
        if (typeof permissions[k] === 'boolean') {
          teacher.permissions[k] = permissions[k] as boolean;
        }
      }

      saveDatabase(db);
      res.json({ teacher: sanitizeTeacher(teacher, true) });
    }
  );

  app.delete('/api/teachers/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const db = getDatabase();
    const idx = db.teachers.findIndex((t) => t.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }
    db.teachers.splice(idx, 1);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- SUBJECTS (ADMIN ONLY) ---
  app.post('/api/subjects', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const { code, name, course, semester, maxMarks, passingMarks, teacherId } = req.body as {
      code?: unknown;
      name?: unknown;
      course?: unknown;
      semester?: unknown;
      maxMarks?: unknown;
      passingMarks?: unknown;
      teacherId?: unknown;
    };

    if (typeof code !== 'string' || !code.trim() || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Subject code and name are required' });
      return;
    }

    const db = getDatabase();
    const newSubject = {
      id: `sub-${crypto.randomUUID().slice(0, 8)}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      course: typeof course === 'string' && course.trim() ? course.trim() : 'B.Tech, C.S.E (I.O.T.)',
      semester: Number.isInteger(Number(semester)) ? Number(semester) : 5,
      maxMarks: Number(maxMarks) > 0 ? Number(maxMarks) : 100,
      passingMarks: Number(passingMarks) >= 0 ? Number(passingMarks) : 40,
      teacherId: typeof teacherId === 'string' ? teacherId.trim() : 'Subham',
    };

    db.subjects.push(newSubject);
    saveDatabase(db);
    res.status(201).json({ subject: newSubject });
  });

  app.delete('/api/subjects/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const db = getDatabase();
    db.subjects = db.subjects.filter((s) => s.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- CLASS ROUTINE (ADMIN OR AUTHORIZED TEACHER) ---
  app.put(
    '/api/routine',
    requireAuth,
    requireTeacherPermission('routine'),
    (req: AuthedRequest, res: Response) => {
      const { day, period, course, semester, section, subjectCode, subjectName, teacherName, room } =
        req.body as {
          day?: unknown;
          period?: unknown;
          course?: unknown;
          semester?: unknown;
          section?: unknown;
          subjectCode?: unknown;
          subjectName?: unknown;
          teacherName?: unknown;
          room?: unknown;
        };

      const validDays: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const pNum = Number(period);
      if (
        !validDays.includes(day as DayOfWeek) ||
        !Number.isInteger(pNum) ||
        pNum < 1 ||
        pNum > 8
      ) {
        res.status(400).json({ error: 'Valid day (Mon-Fri) and period (1-8) are required' });
        return;
      }

      const db = getDatabase();
      const cleanCourse = typeof course === 'string' && course.trim() ? course.trim() : 'B.Tech, C.S.E (I.O.T.)';
      const cleanSem = Number.isInteger(Number(semester)) ? Number(semester) : 5;
      const cleanSec = typeof section === 'string' && section.trim() ? section.trim().toUpperCase() : 'C';

      const existingIdx = db.routine.findIndex(
        (r) => r.day === day && r.period === pNum && r.section === cleanSec && r.semester === cleanSem
      );

      if (typeof subjectCode !== 'string' || !subjectCode.trim()) {
        if (existingIdx !== -1) {
          db.routine.splice(existingIdx, 1);
          saveDatabase(db);
        }
        res.json({ routine: db.routine });
        return;
      }

      const updatedSlot = {
        id: existingIdx !== -1 ? db.routine[existingIdx].id : `r-${day}-${pNum}-${crypto.randomUUID().slice(0, 4)}`,
        day: day as DayOfWeek,
        period: pNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
        course: cleanCourse,
        semester: cleanSem,
        section: cleanSec,
        subjectCode: subjectCode.trim().toUpperCase(),
        subjectName: typeof subjectName === 'string' && subjectName.trim() ? subjectName.trim() : subjectCode.trim(),
        teacherName: typeof teacherName === 'string' ? teacherName.trim() : '',
        room: typeof room === 'string' ? room.trim() : '',
      };

      if (existingIdx !== -1) {
        db.routine[existingIdx] = updatedSlot;
      } else {
        db.routine.push(updatedSlot);
      }

      saveDatabase(db);
      res.json({ routine: db.routine });
    }
  );

  // --- ATTENDANCE (ADMIN OR AUTHORIZED TEACHER) ---
  app.post(
    '/api/attendance',
    requireAuth,
    requireTeacherPermission('attendance'),
    (req: AuthedRequest, res: Response) => {
      const { date, subjectId, entries } = req.body as {
        date?: unknown;
        subjectId?: unknown;
        entries?: { studentId: string; status: 'Present' | 'Absent' }[];
      };

      if (typeof date !== 'string' || !date.trim() || typeof subjectId !== 'string' || !Array.isArray(entries)) {
        res.status(400).json({ error: 'Date, subjectId, and entries are required' });
        return;
      }

      const db = getDatabase();
      for (const entry of entries) {
        if (!entry || typeof entry.studentId !== 'string') continue;
        if (entry.status !== 'Present' && entry.status !== 'Absent') continue;

        const existing = db.attendance.find(
          (a) => a.date === date && a.subjectId === subjectId && a.studentId === entry.studentId
        );
        if (existing) {
          existing.status = entry.status;
          existing.markedBy = req.auth!.id;
        } else {
          db.attendance.push({
            id: `att-${crypto.randomUUID().slice(0, 8)}`,
            date,
            subjectId,
            studentId: entry.studentId,
            status: entry.status,
            markedBy: req.auth!.id,
          });
        }
      }

      saveDatabase(db);
      res.json({ attendance: db.attendance });
    }
  );

  // --- ASSIGNMENTS (ADMIN OR AUTHORIZED TEACHER) ---
  app.post(
    '/api/assignments',
    requireAuth,
    requireTeacherPermission('assignments'),
    (req: AuthedRequest, res: Response) => {
      const {
        title,
        subjectId,
        instructions,
        onlineDeadline,
        googleClassroomUrl,
        offlineDeadline,
        offlineInstructions,
      } = req.body as {
        title?: unknown;
        subjectId?: unknown;
        instructions?: unknown;
        onlineDeadline?: unknown;
        googleClassroomUrl?: unknown;
        offlineDeadline?: unknown;
        offlineInstructions?: unknown;
      };

      if (typeof title !== 'string' || !title.trim() || typeof subjectId !== 'string') {
        res.status(400).json({ error: 'Assignment title and subject are required' });
        return;
      }

      const rawUrl = typeof googleClassroomUrl === 'string' ? googleClassroomUrl.trim() : '';
      if (!isValidSafeHttpUrl(rawUrl)) {
        res.status(400).json({ error: 'Google Classroom link must be a valid http(s) URL' });
        return;
      }

      const db = getDatabase();
      const subject = db.subjects.find((s) => s.id === subjectId);
      if (!subject) {
        res.status(404).json({ error: 'Subject not found' });
        return;
      }

      const assignment = {
        id: `asg-${crypto.randomUUID().slice(0, 8)}`,
        title: title.trim(),
        subjectId: subject.id,
        subjectName: subject.name,
        course: subject.course,
        semester: subject.semester,
        instructions: typeof instructions === 'string' ? instructions.trim() : '',
        onlineDeadline: typeof onlineDeadline === 'string' ? onlineDeadline.trim() : '',
        googleClassroomUrl: rawUrl,
        offlineDeadline: typeof offlineDeadline === 'string' ? offlineDeadline.trim() : '',
        offlineInstructions: typeof offlineInstructions === 'string' ? offlineInstructions.trim() : '',
        createdBy: req.auth!.id,
        createdAt: new Date().toISOString().slice(0, 10),
      };

      db.assignments.unshift(assignment);
      saveDatabase(db);
      res.status(201).json({ assignment });
    }
  );

  app.delete(
    '/api/assignments/:id',
    requireAuth,
    requireTeacherPermission('assignments'),
    (req: AuthedRequest, res: Response) => {
      const db = getDatabase();
      db.assignments = db.assignments.filter((a) => a.id !== req.params.id);
      saveDatabase(db);
      res.json({ ok: true });
    }
  );

  // --- MARKS (ADMIN OR AUTHORIZED TEACHER) ---
  app.put(
    '/api/marks',
    requireAuth,
    requireTeacherPermission('marks'),
    (req: AuthedRequest, res: Response) => {
      const { studentId, subjectId, obtainedMarks } = req.body as {
        studentId?: unknown;
        subjectId?: unknown;
        obtainedMarks?: unknown;
      };

      if (typeof studentId !== 'string' || typeof subjectId !== 'string') {
        res.status(400).json({ error: 'Student ID and Subject ID are required' });
        return;
      }

      const db = getDatabase();
      const student = db.students.find((s) => s.id === studentId);
      if (!student) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }
      const subject = db.subjects.find((s) => s.id === subjectId);
      if (!subject) {
        res.status(404).json({ error: 'Subject not found' });
        return;
      }

      const score = Number(obtainedMarks);
      if (!Number.isFinite(score) || score < 0 || score > subject.maxMarks) {
        res.status(400).json({ error: `Marks must be between 0 and ${subject.maxMarks}` });
        return;
      }

      const existing = db.marks.find(
        (m) => m.studentId === studentId && m.subjectId === subjectId
      );
      if (existing) {
        existing.obtainedMarks = score;
        existing.updatedBy = req.auth!.id;
        existing.updatedAt = new Date().toISOString().slice(0, 10);
      } else {
        db.marks.push({
          id: `mk-${crypto.randomUUID().slice(0, 8)}`,
          studentId,
          subjectId,
          obtainedMarks: score,
          updatedBy: req.auth!.id,
          updatedAt: new Date().toISOString().slice(0, 10),
        });
      }

      saveDatabase(db);
      res.json({ marks: db.marks });
    }
  );

  app.put(
    '/api/marks/batch',
    requireAuth,
    requireTeacherPermission('marks'),
    (req: AuthedRequest, res: Response) => {
      const { subjectId, entries } = req.body as {
        subjectId?: unknown;
        entries?: unknown;
      };

      if (typeof subjectId !== 'string' || !Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: 'Subject ID and at least one score entry are required' });
        return;
      }

      const db = getDatabase();
      const subject = db.subjects.find((s) => s.id === subjectId);
      if (!subject) {
        res.status(404).json({ error: 'Subject not found' });
        return;
      }

      const validated: Array<{ studentId: string; obtainedMarks: number }> = [];
      for (const item of entries) {
        if (!item || typeof item !== 'object') {
          res.status(400).json({ error: 'Invalid mark entry format' });
          return;
        }
        const { studentId, obtainedMarks } = item as {
          studentId?: unknown;
          obtainedMarks?: unknown;
        };
        if (typeof studentId !== 'string') {
          res.status(400).json({ error: 'Each entry must include a valid studentId' });
          return;
        }
        const student = db.students.find((s) => s.id === studentId);
        if (!student) {
          res.status(404).json({ error: `Student ${studentId} not found` });
          return;
        }
        const score = Number(obtainedMarks);
        if (!Number.isFinite(score) || score < 0 || score > subject.maxMarks) {
          res.status(400).json({
            error: `Marks for ${student.name} (${student.id}) must be between 0 and ${subject.maxMarks}`,
          });
          return;
        }
        validated.push({ studentId, obtainedMarks: score });
      }

      const today = new Date().toISOString().slice(0, 10);
      for (const entry of validated) {
        const existing = db.marks.find(
          (m) => m.studentId === entry.studentId && m.subjectId === subjectId
        );
        if (existing) {
          existing.obtainedMarks = entry.obtainedMarks;
          existing.updatedBy = req.auth!.id;
          existing.updatedAt = today;
        } else {
          db.marks.push({
            id: `mk-${crypto.randomUUID().slice(0, 8)}`,
            studentId: entry.studentId,
            subjectId,
            obtainedMarks: entry.obtainedMarks,
            updatedBy: req.auth!.id,
            updatedAt: today,
          });
        }
      }

      saveDatabase(db);
      res.json({ marks: db.marks, updatedCount: validated.length });
    }
  );

  // --- STUDY MATERIALS (ADMIN OR AUTHORIZED TEACHER) ---
  app.post(
    '/api/materials',
    requireAuth,
    requireTeacherPermission('materials'),
    (req: AuthedRequest, res: Response) => {
      const { title, subjectId, type, resourceUrl, description } = req.body as {
        title?: unknown;
        subjectId?: unknown;
        type?: unknown;
        resourceUrl?: unknown;
        description?: unknown;
      };

      if (typeof title !== 'string' || !title.trim() || typeof subjectId !== 'string') {
        res.status(400).json({ error: 'Title and subject are required' });
        return;
      }
      const rawUrl = typeof resourceUrl === 'string' ? resourceUrl.trim() : '';
      if (!isValidSafeHttpUrl(rawUrl)) {
        res.status(400).json({ error: 'Resource URL must be a valid http(s) URL' });
        return;
      }

      const db = getDatabase();
      const subject = db.subjects.find((s) => s.id === subjectId);
      if (!subject) {
        res.status(404).json({ error: 'Subject not found' });
        return;
      }

      const matType = type === 'Notes' || type === 'Slides' ? type : 'PDF';
      const material = {
        id: `mat-${crypto.randomUUID().slice(0, 8)}`,
        title: title.trim(),
        course: subject.course,
        semester: subject.semester,
        subjectId: subject.id,
        subjectName: subject.name,
        type: matType as 'PDF' | 'Notes' | 'Slides',
        resourceUrl: rawUrl,
        description: typeof description === 'string' ? description.trim() : '',
        uploadedBy: req.auth!.id,
        uploadedAt: new Date().toISOString().slice(0, 10),
      };

      db.materials.unshift(material);
      saveDatabase(db);
      res.status(201).json({ material });
    }
  );

  app.delete(
    '/api/materials/:id',
    requireAuth,
    requireTeacherPermission('materials'),
    (req: AuthedRequest, res: Response) => {
      const db = getDatabase();
      db.materials = db.materials.filter((m) => m.id !== req.params.id);
      saveDatabase(db);
      res.json({ ok: true });
    }
  );

  // --- LIBRARY MANAGEMENT (ADMIN OR AUTHORIZED TEACHER) ---
  app.post(
    '/api/library/books',
    requireAuth,
    requireTeacherPermission('library'),
    (req: AuthedRequest, res: Response) => {
      const { isbn, title, author, category, totalCopies } = req.body as {
        isbn?: unknown;
        title?: unknown;
        author?: unknown;
        category?: unknown;
        totalCopies?: unknown;
      };

      if (typeof title !== 'string' || !title.trim() || typeof author !== 'string' || !author.trim()) {
        res.status(400).json({ error: 'Book title and author are required' });
        return;
      }
      const copies = Math.max(1, Number.parseInt(String(totalCopies ?? '1'), 10) || 1);
      const db = getDatabase();
      const book = {
        id: `bk-${crypto.randomUUID().slice(0, 8)}`,
        isbn: typeof isbn === 'string' ? isbn.trim() : '',
        title: title.trim(),
        author: author.trim(),
        category: typeof category === 'string' && category.trim() ? category.trim() : 'General',
        totalCopies: copies,
        availableCopies: copies,
      };
      db.books.unshift(book);
      saveDatabase(db);
      res.status(201).json({ book });
    }
  );

  app.post(
    '/api/library/issue',
    requireAuth,
    requireTeacherPermission('library'),
    (req: AuthedRequest, res: Response) => {
      const { bookId, studentId, dueDate } = req.body as {
        bookId?: unknown;
        studentId?: unknown;
        dueDate?: unknown;
      };

      if (typeof bookId !== 'string' || typeof studentId !== 'string' || typeof dueDate !== 'string') {
        res.status(400).json({ error: 'Book, student, and due date are required' });
        return;
      }

      const db = getDatabase();
      const book = db.books.find((b) => b.id === bookId);
      const student = db.students.find((s) => s.id === studentId);
      if (!book || !student) {
        res.status(404).json({ error: 'Book or student not found' });
        return;
      }
      if (book.availableCopies < 1) {
        res.status(400).json({ error: 'No available copies left for this book' });
        return;
      }

      book.availableCopies -= 1;
      const issue = {
        id: `iss-${crypto.randomUUID().slice(0, 8)}`,
        bookId: book.id,
        bookTitle: book.title,
        studentId: student.id,
        studentName: student.name,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate,
        returnDate: null,
        status: 'Issued' as const,
      };
      db.bookIssues.unshift(issue);
      saveDatabase(db);
      res.status(201).json({ issue });
    }
  );

  app.post(
    '/api/library/return/:id',
    requireAuth,
    requireTeacherPermission('library'),
    (req: AuthedRequest, res: Response) => {
      const db = getDatabase();
      const issue = db.bookIssues.find((i) => i.id === req.params.id);
      if (!issue) {
        res.status(404).json({ error: 'Issue record not found' });
        return;
      }
      if (issue.status !== 'Returned') {
        issue.status = 'Returned';
        issue.returnDate = new Date().toISOString().slice(0, 10);
        const book = db.books.find((b) => b.id === issue.bookId);
        if (book && book.availableCopies < book.totalCopies) {
          book.availableCopies += 1;
        }
        saveDatabase(db);
      }
      res.json({ issue });
    }
  );

  // --- ACADEMIC CALENDAR (ADMIN OR AUTHORIZED TEACHER) ---
  app.post(
    '/api/calendar',
    requireAuth,
    requireTeacherPermission('calendar'),
    (req: AuthedRequest, res: Response) => {
      const { title, date, category, description } = req.body as {
        title?: unknown;
        date?: unknown;
        category?: unknown;
        description?: unknown;
      };
      if (typeof title !== 'string' || !title.trim() || typeof date !== 'string' || !date.trim()) {
        res.status(400).json({ error: 'Event title and date are required' });
        return;
      }
      const validCategories = ['Exam', 'Holiday', 'Academic', 'Event'];
      const cat = validCategories.includes(String(category)) ? String(category) : 'Academic';
      const db = getDatabase();
      const ev = {
        id: `cal-${crypto.randomUUID().slice(0, 8)}`,
        title: title.trim(),
        date: date.trim(),
        category: cat as 'Exam' | 'Holiday' | 'Academic' | 'Event',
        description: typeof description === 'string' ? description.trim() : '',
      };
      db.calendarEvents.push(ev);
      saveDatabase(db);
      res.status(201).json({ event: ev });
    }
  );

  app.delete(
    '/api/calendar/:id',
    requireAuth,
    requireTeacherPermission('calendar'),
    (req: AuthedRequest, res: Response) => {
      const db = getDatabase();
      db.calendarEvents = db.calendarEvents.filter((e) => e.id !== req.params.id);
      saveDatabase(db);
      res.json({ ok: true });
    }
  );

  // --- PORTAL SETTINGS (ADMIN ONLY) ---
  app.patch('/api/settings/threshold', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const threshold = Number((req.body as { attendanceThreshold?: unknown }).attendanceThreshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      res.status(400).json({ error: 'Threshold must be between 0 and 100' });
      return;
    }
    const db = getDatabase();
    db.attendanceThreshold = threshold;
    saveDatabase(db);
    res.json({ attendanceThreshold: threshold });
  });

  // --- STUDENT ID & PASSWORD APPLICATIONS (PUBLIC SUBMIT, ADMIN-ONLY REVIEW) ---
  app.post('/api/student-applications', (req: Request, res: Response) => {
    const {
      name,
      course,
      semester,
      section,
      rollNo,
      email,
      phone,
      requestedPassword,
      notes,
    } = req.body as {
      name?: unknown;
      course?: unknown;
      semester?: unknown;
      section?: unknown;
      rollNo?: unknown;
      email?: unknown;
      phone?: unknown;
      requestedPassword?: unknown;
      notes?: unknown;
    };

    if (typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Student full name is required' });
      return;
    }
    if (typeof course !== 'string' || !course.trim()) {
      res.status(400).json({ error: 'Course / Department is required' });
      return;
    }
    const semNum = Number(semester);
    if (!Number.isInteger(semNum) || semNum < 1 || semNum > 10) {
      res.status(400).json({ error: 'Semester must be between 1 and 10' });
      return;
    }
    if (typeof email !== 'string' || !email.trim().includes('@')) {
      res.status(400).json({ error: 'Valid email address is required' });
      return;
    }
    if (typeof phone !== 'string' || phone.trim().length < 6) {
      res.status(400).json({ error: 'Contact phone number is required' });
      return;
    }
    if (typeof requestedPassword !== 'string' || requestedPassword.trim().length < 4) {
      res.status(400).json({ error: 'Requested password must be at least 4 characters' });
      return;
    }

    const db = getDatabase();
    if (!Array.isArray(db.studentApplications)) {
      db.studentApplications = [];
    }

    const application: PortalDatabase['studentApplications'][number] = {
      id: `APP-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      name: name.trim(),
      course: course.trim(),
      semester: semNum,
      section:
        typeof section === 'string' && section.trim()
          ? section.trim().toUpperCase()
          : 'A',
      rollNo: typeof rollNo === 'string' ? rollNo.trim() : '',
      email: email.trim(),
      phone: phone.trim(),
      status: 'Pending',
      assignedStudentId: null,
      submittedAt: new Date().toISOString().slice(0, 10),
      reviewedAt: null,
      reviewedBy: null,
      notes: typeof notes === 'string' ? notes.trim() : '',
      requestedPasswordHash: hashPassword(requestedPassword.trim()),
      requestedPassword: requestedPassword.trim(),
    };

    db.studentApplications.unshift(application);
    saveDatabase(db);
    res.status(201).json({
      applicationId: application.id,
      message: 'Application submitted. The Administrator will issue your Student ID shortly.',
    });
  });

  app.post(
    '/api/student-applications/:id/approve',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const { customStudentId, overridePassword } = (req.body || {}) as {
        customStudentId?: unknown;
        overridePassword?: unknown;
      };

      const db = getDatabase();
      const appRecord = (db.studentApplications || []).find(
        (a) => a.id === req.params.id
      );
      if (!appRecord) {
        res.status(404).json({ error: 'Student application not found' });
        return;
      }
      if (appRecord.status !== 'Pending') {
        res.status(409).json({ error: `Application has already been ${appRecord.status.toLowerCase()}` });
        return;
      }

      let generatedId = '';
      if (typeof customStudentId === 'string' && customStudentId.trim()) {
        const candidate = customStudentId.trim();
        if (!/^[A-Za-z0-9_-]{4,32}$/.test(candidate)) {
          res.status(400).json({ error: 'Student ID must be 4-32 alphanumeric characters' });
          return;
        }
        if (db.students.some((s) => s.id.toLowerCase() === candidate.toLowerCase())) {
          res.status(409).json({ error: 'This Student ID already exists' });
          return;
        }
        generatedId = candidate;
      } else {
        generatedId = generateUniqueStudentId(db.students.map((s) => s.id));
      }

      const hasOverride =
        typeof overridePassword === 'string' && overridePassword.trim().length > 0;
      if (hasOverride && (overridePassword as string).trim().length < 4) {
        res.status(400).json({ error: 'Override password must be at least 4 characters' });
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const newStudent: PortalDatabase['students'][number] = {
        id: generatedId,
        name: appRecord.name,
        course: appRecord.course,
        semester: appRecord.semester,
        section: appRecord.section || 'A',
        rollNo: appRecord.rollNo || String(db.students.length + 1),
        email: appRecord.email,
        phone: appRecord.phone,
        photoUrl: '',
        projectTitle: '',
        projectDetails: '',
        status: 'active',
        enrolledAt: today,
        passwordHash: hasOverride
          ? hashPassword((overridePassword as string).trim())
          : appRecord.requestedPasswordHash,
        currentPassword: hasOverride
          ? (overridePassword as string).trim()
          : appRecord.requestedPassword || '',
        isDefaultPassword: hasOverride,
      };

      db.students.push(newStudent);
      appRecord.status = 'Approved';
      appRecord.assignedStudentId = generatedId;
      appRecord.reviewedAt = today;
      appRecord.reviewedBy = req.auth!.id;
      saveDatabase(db);

      res.json({
        application: sanitizeStudentApplication(appRecord, true),
        student: sanitizeStudent(newStudent, true),
        generatedId,
      });
    }
  );

  app.post(
    '/api/student-applications/:id/reject',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const { reason } = (req.body || {}) as { reason?: unknown };
      const db = getDatabase();
      const appRecord = (db.studentApplications || []).find(
        (a) => a.id === req.params.id
      );
      if (!appRecord) {
        res.status(404).json({ error: 'Student application not found' });
        return;
      }
      if (appRecord.status !== 'Pending') {
        res.status(409).json({ error: `Application has already been ${appRecord.status.toLowerCase()}` });
        return;
      }

      appRecord.status = 'Rejected';
      appRecord.reviewedAt = new Date().toISOString().slice(0, 10);
      appRecord.reviewedBy = req.auth!.id;
      if (typeof reason === 'string' && reason.trim()) {
        appRecord.notes = reason.trim();
      }
      saveDatabase(db);

      res.json({ application: sanitizeStudentApplication(appRecord, true) });
    }
  );

  // Unmatched API routes return JSON 404 instead of SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global Express JSON error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON request body' });
      return;
    }
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Mount Vite in dev (lazy-loaded so production never loads Vite), or serve static dist in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      if (!fs.existsSync(indexHtmlPath)) {
        res.status(503).send('Application build missing. Run npm run build first.');
        return;
      }
      res.sendFile(indexHtmlPath);
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Portal server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
