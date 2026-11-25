import type {
  AssignmentRecord,
  CalendarEventRecord,
  LibraryBookRecord,
  PortalBootstrapData,
  RoutineSlot,
  StudentApplicationRecord,
  StudentRecord,
  SubjectRecord,
  StudyMaterialRecord,
  TeacherPermissions,
  TeacherRecord,
  UserRole,
} from '../types/portal';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  return payload;
}

export async function loginRequest(
  userId: string,
  password: string,
  role: UserRole
): Promise<{ token: string; data: PortalBootstrapData }> {
  const res = await apiRequest<{ token: string; data: PortalBootstrapData }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ userId, password, role }),
    }
  );
  setAuthToken(res.token);
  return res;
}

export async function fetchPortalData(): Promise<PortalBootstrapData> {
  const res = await apiRequest<{ data: PortalBootstrapData }>('/api/portal');
  return res.data;
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiRequest('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
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
  return apiRequest('/api/students', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateStudent(
  id: string,
  updates: Partial<StudentRecord> & { newPassword?: string }
): Promise<{ student: StudentRecord }> {
  return apiRequest(`/api/students/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteStudent(id: string): Promise<void> {
  await apiRequest(`/api/students/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function addTeacher(input: {
  id: string;
  name: string;
  password: string;
  department: string;
  designation: string;
  email: string;
}): Promise<{ teacher: TeacherRecord }> {
  return apiRequest('/api/teachers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTeacherCredentials(
  id: string,
  input: {
    newId?: string;
    newPassword?: string;
    name?: string;
    department?: string;
    designation?: string;
  }
): Promise<{ teacher: TeacherRecord }> {
  return apiRequest(`/api/teachers/${encodeURIComponent(id)}/credentials`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function updateTeacherPermissions(
  id: string,
  permissions: TeacherPermissions
): Promise<{ teacher: TeacherRecord }> {
  return apiRequest(`/api/teachers/${encodeURIComponent(id)}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  });
}

export async function deleteTeacher(id: string): Promise<void> {
  await apiRequest(`/api/teachers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
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
  return apiRequest('/api/subjects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteSubject(id: string): Promise<void> {
  await apiRequest(`/api/subjects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
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
  return apiRequest('/api/routine', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function submitAttendance(input: {
  date: string;
  subjectId: string;
  entries: { studentId: string; status: 'Present' | 'Absent' }[];
}): Promise<void> {
  await apiRequest('/api/attendance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
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
  return apiRequest('/api/assignments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteAssignment(id: string): Promise<void> {
  await apiRequest(`/api/assignments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function saveMark(input: {
  studentId: string;
  subjectId: string;
  obtainedMarks: number;
}): Promise<void> {
  await apiRequest('/api/marks', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function saveMarksBatch(input: {
  subjectId: string;
  entries: { studentId: string; obtainedMarks: number }[];
}): Promise<{ updatedCount: number }> {
  return apiRequest('/api/marks/batch', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function createMaterial(input: {
  title: string;
  subjectId: string;
  type: 'PDF' | 'Notes' | 'Slides';
  resourceUrl: string;
  description: string;
}): Promise<{ material: StudyMaterialRecord }> {
  return apiRequest('/api/materials', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteMaterial(id: string): Promise<void> {
  await apiRequest(`/api/materials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function createBook(input: {
  isbn: string;
  title: string;
  author: string;
  category: string;
  totalCopies: number;
}): Promise<{ book: LibraryBookRecord }> {
  return apiRequest('/api/library/books', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function issueBook(input: {
  bookId: string;
  studentId: string;
  dueDate: string;
}): Promise<void> {
  await apiRequest('/api/library/issue', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function returnBook(issueId: string): Promise<void> {
  await apiRequest(`/api/library/return/${encodeURIComponent(issueId)}`, {
    method: 'POST',
  });
}

export async function createCalendarEvent(input: {
  title: string;
  date: string;
  category: 'Exam' | 'Holiday' | 'Academic' | 'Event';
  description: string;
}): Promise<{ event: CalendarEventRecord }> {
  return apiRequest('/api/calendar', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiRequest(`/api/calendar/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function updateAttendanceThreshold(threshold: number): Promise<void> {
  await apiRequest('/api/settings/threshold', {
    method: 'PATCH',
    body: JSON.stringify({ attendanceThreshold: threshold }),
  });
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
  return apiRequest('/api/student-applications', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function approveStudentApplication(
  id: string,
  input: { customStudentId?: string; overridePassword?: string } = {}
): Promise<{
  application: StudentApplicationRecord;
  student: StudentRecord;
  generatedId: string;
}> {
  return apiRequest(`/api/student-applications/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function rejectStudentApplication(
  id: string,
  reason = ''
): Promise<{ application: StudentApplicationRecord }> {
  return apiRequest(`/api/student-applications/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
