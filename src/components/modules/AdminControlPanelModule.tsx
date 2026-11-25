import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type {
  PortalBootstrapData,
  TeacherPermissionKey,
  TeacherRecord,
} from '../../types/portal';
import {
  ALL_TEACHER_PERMISSIONS,
  DEFAULT_TEACHER_PERMISSIONS,
  generateUniqueStudentId,
  validatePasswordInput,
} from '../../utils/academicRules';
import {
  addTeacher,
  deleteStudent,
  enrollStudent,
  updateStudent,
  updateTeacherCredentials,
  updateTeacherPermissions,
} from '../../api/client';
import { AttendanceModule } from './AttendanceModule';
import { MarksModule } from './MarksModule';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
  onSwitchSubPart: (subPartKey: string) => void;
}

export function AdminControlPanelModule({
  data,
  subPart,
  onRefresh,
  onSwitchSubPart,
}: Props) {
  // 0.1 Unique Student ID & Database Record Form
  const [generatedStudentId, setGeneratedStudentId] = useState(() =>
    generateUniqueStudentId(data.students.map((s) => s.id))
  );
  const [name, setName] = useState('');
  const [course, setCourse] = useState('B.Tech, C.S.E (I.O.T.)');
  const [semester, setSemester] = useState('5');
  const [section, setSection] = useState('C');
  const [rollNo, setRollNo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [initialPassword, setInitialPassword] = useState('123456');
  const [savingStudent, setSavingStudent] = useState(false);
  const [savedStudent, setSavedStudent] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // 0.2 Add New Teacher + Teacher Control Access State
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherPass, setNewTeacherPass] = useState('');
  const [newTeacherDept, setNewTeacherDept] = useState('C.S.E (I.O.T.)');
  const [newTeacherDesig, setNewTeacherDesig] = useState('Assistant Professor');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [savingTeacher, setSavingTeacher] = useState(false);

  const [editingStudentPassId, setEditingStudentPassId] = useState<string | null>(null);
  const [studentPassDraft, setStudentPassDraft] = useState('');
  const [updatingStudentPass, setUpdatingStudentPass] = useState(false);

  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editLoginId, setEditLoginId] = useState('');
  const [editPass, setEditPass] = useState('');

  // 0.3 Admin Attendance & Marks Switcher
  const [academicTab, setAcademicTab] = useState<'attendance' | 'marks'>('attendance');

  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  if (data.user.role !== 'admin') {
    return (
      <div className="bg-white border border-[#c5e2CE] rounded-lg p-6 text-sm text-[#356847]">
        Administrator authorization is required to access the Control Panel.
      </div>
    );
  }

  function handleGenerateNewId() {
    const existingIds = new Set(data.students.map((s) => s.id));
    if (generatedStudentId) existingIds.add(generatedStudentId);
    const nextId = generateUniqueStudentId(existingIds);
    setGeneratedStudentId(nextId);
    setCopied(false);
  }

  async function handleAddStudentRecord(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSavedStudent(null);
    setSavingStudent(true);
    try {
      const res = await enrollStudent({
        studentId: generatedStudentId.trim() || undefined,
        name,
        course,
        semester: Number(semester),
        section,
        rollNo,
        email,
        phone,
        initialPassword,
      });
      setSavedStudent({ id: res.generatedId, name: res.student.name });
      setName('');
      setRollNo('');
      setEmail('');
      setPhone('');
      const nextIds = [...data.students.map((s) => s.id), res.generatedId];
      setGeneratedStudentId(generateUniqueStudentId(nextIds));
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add student record');
    } finally {
      setSavingStudent(false);
    }
  }

  async function handleAddTeacherRecord(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    setSavingTeacher(true);
    try {
      const res = await addTeacher({
        id: newTeacherId.trim(),
        name: newTeacherName.trim(),
        password: newTeacherPass.trim(),
        department: newTeacherDept.trim(),
        designation: newTeacherDesig.trim(),
        email: newTeacherEmail.trim(),
      });
      setStatusMsg(
        `Added new faculty member ${res.teacher.name} (Login ID: ${res.teacher.id}).`
      );
      setNewTeacherId('');
      setNewTeacherName('');
      setNewTeacherPass('');
      setNewTeacherEmail('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add teacher record');
    } finally {
      setSavingTeacher(false);
    }
  }

  async function handleRemoveStudent(id: string) {
    setError('');
    try {
      await deleteStudent(id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student');
    }
  }

  async function handleSaveStudentPassword(studentId: string, studentName: string) {
    setError('');
    setStatusMsg('');
    const check = validatePasswordInput(studentPassDraft);
    if (!check.valid) {
      setError(check.error || 'Password must be at least 4 characters.');
      return;
    }
    setUpdatingStudentPass(true);
    try {
      await updateStudent(studentId, { newPassword: check.cleaned });
      setStatusMsg(`Updated login password for ${studentName} (${studentId}).`);
      setEditingStudentPassId(null);
      setStudentPassDraft('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update student password');
    } finally {
      setUpdatingStudentPass(false);
    }
  }

  async function handleTogglePermission(
    teacher: TeacherRecord,
    key: TeacherPermissionKey
  ) {
    setError('');
    setStatusMsg('');
    const nextPerms = {
      ...teacher.permissions,
      [key]: !teacher.permissions[key],
    };
    try {
      await updateTeacherPermissions(teacher.id, nextPerms);
      setStatusMsg(
        `Updated ${teacher.name} (${teacher.id}): "${key}" is now ${
          nextPerms[key] ? 'ON' : 'OFF'
        }.`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update teacher access');
    }
  }

  async function handleResetDefaultAccess(teacher: TeacherRecord) {
    setError('');
    setStatusMsg('');
    try {
      await updateTeacherPermissions(teacher.id, { ...DEFAULT_TEACHER_PERMISSIONS });
      setStatusMsg(
        `Reset ${teacher.name} (${teacher.id}) to default access (Attendance, Assignments, Routine, Marks).`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset access');
    }
  }

  async function handleSaveTeacherCreds(e: React.FormEvent, originalId: string) {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    if (editPass.trim()) {
      const check = validatePasswordInput(editPass);
      if (!check.valid) {
        setError(check.error || 'Password must be at least 4 characters.');
        return;
      }
    }
    try {
      await updateTeacherCredentials(originalId, {
        newId: editLoginId.trim(),
        newPassword: editPass.trim() || undefined,
      });
      setStatusMsg(`Credentials updated for teacher ID "${editLoginId.trim()}".`);
      setEditingTeacherId(null);
      setEditPass('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update credentials');
    }
  }

  return (
    <div className="space-y-5">
      {/* Header + Sub-part Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            Administrator Control Panel
          </h2>
          <p className="text-sm text-[#356847]">
            Enroll students &amp; teachers, manage faculty access permissions, and update student attendance or marks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#dff2e4] border border-[#b7dec2] rounded-lg">
          <button
            type="button"
            onClick={() => onSwitchSubPart('0.1')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              subPart === '0.1'
                ? 'bg-[#166534] text-white'
                : 'text-[#14532d] hover:bg-[#cfead7]'
            }`}
          >
            0.1 Student ID &amp; Records
          </button>
          <button
            type="button"
            onClick={() => onSwitchSubPart('0.2')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              subPart === '0.2'
                ? 'bg-[#166534] text-white'
                : 'text-[#14532d] hover:bg-[#cfead7]'
            }`}
          >
            0.2 Teachers &amp; Access
          </button>
          <button
            type="button"
            onClick={() => onSwitchSubPart('0.3')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              subPart === '0.3'
                ? 'bg-[#166534] text-white'
                : 'text-[#14532d] hover:bg-[#cfead7]'
            }`}
          >
            0.3 Attendance &amp; Marks
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded"
        >
          {error}
        </div>
      )}

      {subPart === '0.3' ? (
        /* 0.3 Direct Admin Attendance & Marks Update Panel */
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[#cfe6d6] pb-3">
            <button
              type="button"
              onClick={() => setAcademicTab('attendance')}
              className={`px-4 py-2 text-xs font-semibold rounded border cursor-pointer ${
                academicTab === 'attendance'
                  ? 'bg-[#166534] text-white border-[#14532d]'
                  : 'bg-white text-[#14532d] border-[#a9d5b6] hover:bg-[#e8f5ec]'
              }`}
            >
              Update Student Attendance
            </button>
            <button
              type="button"
              onClick={() => setAcademicTab('marks')}
              className={`px-4 py-2 text-xs font-semibold rounded border cursor-pointer ${
                academicTab === 'marks'
                  ? 'bg-[#166534] text-white border-[#14532d]'
                  : 'bg-white text-[#14532d] border-[#a9d5b6] hover:bg-[#e8f5ec]'
              }`}
            >
              Update Student Marks
            </button>
          </div>

          {academicTab === 'attendance' ? (
            <AttendanceModule data={data} subPart="5.1" onRefresh={onRefresh} />
          ) : (
            <MarksModule data={data} subPart="7.1" onRefresh={onRefresh} />
          )}
        </div>
      ) : subPart === '0.2' ? (
        /* 0.2 Add New Teacher + Teacher Control Access Panel */
        <div className="space-y-4">
          {statusMsg && (
            <div
              role="status"
              className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3 py-2 rounded"
            >
              {statusMsg}
            </div>
          )}

          {/* Add New Teacher Form (Same ease as Student Enrollment) */}
          <form
            onSubmit={handleAddTeacherRecord}
            className="bg-white border border-[#c5e2CE] rounded-lg p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#e6f3ea]">
              <h3 className="text-sm font-bold text-[#14532d] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#166534]" />
                <span>Add New Teacher Account to Database</span>
              </h3>
              <span className="text-xs font-mono text-[#356847]">
                {data.teachers.length} Registered Teachers
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label htmlFor="acp-t-id" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Teacher Login ID *
                </label>
                <input
                  id="acp-t-id"
                  type="text"
                  required
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                  placeholder="e.g. Anirban"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="acp-t-name" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Faculty Full Name *
                </label>
                <input
                  id="acp-t-name"
                  type="text"
                  required
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="e.g. Prof. Anirban Paul"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>
              <div>
                <label htmlFor="acp-t-pass" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Initial Password *
                </label>
                <input
                  id="acp-t-pass"
                  type="text"
                  required
                  minLength={4}
                  value={newTeacherPass}
                  onChange={(e) => setNewTeacherPass(e.target.value)}
                  placeholder="e.g. 741169"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="acp-t-dept" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Department
                </label>
                <input
                  id="acp-t-dept"
                  type="text"
                  value={newTeacherDept}
                  onChange={(e) => setNewTeacherDept(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>
              <div>
                <label htmlFor="acp-t-desig" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Designation
                </label>
                <input
                  id="acp-t-desig"
                  type="text"
                  value={newTeacherDesig}
                  onChange={(e) => setNewTeacherDesig(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>
              <div>
                <label htmlFor="acp-t-email" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Faculty Email
                </label>
                <input
                  id="acp-t-email"
                  type="email"
                  value={newTeacherEmail}
                  onChange={(e) => setNewTeacherEmail(e.target.value)}
                  placeholder="faculty@institute.edu"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingTeacher}
                className="px-5 py-2 bg-[#166534] hover:bg-[#14532d] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded inline-flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{savingTeacher ? 'Adding Teacher...' : 'Add Teacher to Database'}</span>
              </button>
            </div>
          </form>

          <div className="bg-[#eff9f1] border border-[#b7dec2] rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-xs text-[#274e36]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#166534] shrink-0" />
              <span>
                Only Administrator (<span className="font-mono font-bold text-[#14532d]">Kallab</span>) controls teacher login IDs, passwords, and authorized portal modules.
              </span>
            </div>
            <span className="font-mono font-bold text-[#14532d] whitespace-nowrap">
              {data.teachers.length} Active Teachers
            </span>
          </div>

          <div className="space-y-4">
            {data.teachers.map((teacher) => {
              const isEditing = editingTeacherId === teacher.id;
              const enabledCount = Object.values(teacher.permissions).filter(Boolean).length;
              return (
                <div
                  key={teacher.id}
                  className="bg-white border border-[#c5e2CE] rounded-lg p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e6f3ea]">
                    <div>
                      <h3 className="text-base font-bold text-[#14532d]">
                        {teacher.name}
                      </h3>
                      <div className="text-xs text-[#356847] font-mono mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          ID: <strong className="text-[#14532d]">{teacher.id}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Password:{' '}
                          <strong
                            data-testid={`teacher-password-${teacher.id}`}
                            className="bg-[#eef8f0] border border-[#bfe0c8] px-1.5 py-0.5 rounded text-[#14532d]"
                          >
                            {teacher.password || '—'}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          {teacher.department} · {enabledCount} / {ALL_TEACHER_PERMISSIONS.length} permissions active
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingTeacherId(null);
                          } else {
                            setEditingTeacherId(teacher.id);
                            setEditLoginId(teacher.id);
                            setEditPass(teacher.password || '');
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#f4fbf6] border border-[#9fd0ad] hover:bg-[#dff2e4] text-[#14532d] rounded inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{isEditing ? 'Close Editor' : 'Update ID / Password'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResetDefaultAccess(teacher)}
                        className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#cfe6d6] hover:bg-[#f4fbf6] text-[#356847] rounded inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Default Access</span>
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <form
                      onSubmit={(e) => handleSaveTeacherCreds(e, teacher.id)}
                      className="bg-[#f4fbf6] border border-[#9fd0ad] rounded-md p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
                    >
                      <div>
                        <label
                          htmlFor={`acp-tid-${teacher.id}`}
                          className="block text-xs font-semibold text-[#14532d] mb-1"
                        >
                          Teacher Login ID
                        </label>
                        <input
                          id={`acp-tid-${teacher.id}`}
                          type="text"
                          required
                          value={editLoginId}
                          onChange={(e) => setEditLoginId(e.target.value)}
                          className="w-full h-9 px-3 text-sm bg-white border border-[#9fd0ad] rounded font-mono"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`acp-tpw-${teacher.id}`}
                          className="block text-xs font-semibold text-[#14532d] mb-1"
                        >
                          Password (min 4 chars)
                        </label>
                        <input
                          id={`acp-tpw-${teacher.id}`}
                          type="text"
                          minLength={4}
                          value={editPass}
                          onChange={(e) => setEditPass(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full h-9 px-3 text-sm bg-white border border-[#9fd0ad] rounded font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        className="h-9 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded cursor-pointer"
                      >
                        Save Credentials
                      </button>
                    </form>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {ALL_TEACHER_PERMISSIONS.map((perm) => {
                      const active = Boolean(teacher.permissions[perm.key]);
                      return (
                        <button
                          key={perm.key}
                          type="button"
                          onClick={() => handleTogglePermission(teacher, perm.key)}
                          aria-pressed={active}
                          aria-label={`Admin control ${perm.label} for ${teacher.id}`}
                          className={`text-left p-3 rounded-md border cursor-pointer ${
                            active
                              ? 'bg-[#e6f5ea] border-[#166534] text-[#0f291a]'
                              : 'bg-[#f9fcfa] border-[#d8eadc] text-[#4a7459]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold">{perm.label}</span>
                            <span
                              className={`text-[11px] font-mono font-bold ${
                                active ? 'text-[#166534]' : 'text-[#73967f]'
                              }`}
                            >
                              {active ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <p className="text-[11px] mt-1 leading-snug opacity-90">
                            {perm.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 0.1 Generate Unique Student ID & Add New Student Record to Database */
        <div className="space-y-5">
          {savedStudent && (
            <div
              role="status"
              className="bg-[#dff2e4] border border-[#166534] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#166534] shrink-0" />
                <div>
                  <div className="text-sm font-bold text-[#14532d]">
                    Student Record Added to Database: {savedStudent.name}
                  </div>
                  <div className="text-xs text-[#274e36] mt-0.5">
                    Assigned Unique Student ID:{' '}
                    <span
                      className="font-mono font-bold text-[#14532d]"
                      data-testid="admin-panel-saved-student-id"
                    >
                      {savedStudent.id}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(savedStudent.id);
                  setCopied(true);
                }}
                className="px-3 py-1.5 bg-white border border-[#9fd0ad] rounded text-xs font-semibold text-[#14532d] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied' : 'Copy ID'}</span>
              </button>
            </div>
          )}

          <form
            onSubmit={handleAddStudentRecord}
            className="bg-white border border-[#c5e2CE] rounded-lg p-5 space-y-4"
          >
            {/* Unique ID Generator Bar */}
            <div className="bg-[#eef8f0] border border-[#b7dec2] rounded-md p-4 flex flex-wrap items-end justify-between gap-3">
              <div className="flex-1 min-w-[220px]">
                <label
                  htmlFor="acp-gen-id"
                  className="block text-xs font-bold text-[#14532d] mb-1"
                >
                  Generated Unique Student ID
                </label>
                <input
                  id="acp-gen-id"
                  type="text"
                  required
                  value={generatedStudentId}
                  onChange={(e) => setGeneratedStudentId(e.target.value)}
                  data-testid="admin-panel-id-input"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#9fd0ad] rounded font-mono font-bold text-[#14532d] tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateNewId}
                className="h-9 px-3.5 bg-white hover:bg-[#dff2e4] border border-[#166534] text-[#14532d] text-xs font-bold rounded inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Generate Unique ID</span>
              </button>
            </div>

            {/* Student Record Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="acp-name" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Student Full Name
                </label>
                <input
                  id="acp-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Soham Banerjee"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
              <div>
                <label htmlFor="acp-course" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Course / Department
                </label>
                <input
                  id="acp-course"
                  type="text"
                  required
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="acp-sem" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Semester
                  </label>
                  <input
                    id="acp-sem"
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="acp-sec" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Section
                  </label>
                  <input
                    id="acp-sec"
                    type="text"
                    maxLength={2}
                    required
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded uppercase"
                  />
                </div>
                <div>
                  <label htmlFor="acp-roll" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Roll No
                  </label>
                  <input
                    id="acp-roll"
                    type="text"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="25"
                    className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="acp-pass" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Initial Login Password
                </label>
                <input
                  id="acp-pass"
                  type="text"
                  required
                  minLength={4}
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="acp-email" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Email Address
                </label>
                <input
                  id="acp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@institute.edu"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>
              <div>
                <label htmlFor="acp-phone" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Phone Number
                </label>
                <input
                  id="acp-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingStudent}
                className="px-5 py-2.5 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded inline-flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {savingStudent ? 'Saving Record...' : 'Add Student Record to Database'}
                </span>
              </button>
            </div>
          </form>

          {/* Live Database Student Records Table */}
          {statusMsg && (
            <div
              role="status"
              className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3 py-2 rounded"
            >
              {statusMsg}
            </div>
          )}

          <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
            <div className="px-4 py-3 bg-[#f4fbf6] border-b border-[#d6ecdc] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#14532d]">
                Enrolled Student Database &amp; Passwords ({data.students.length} Records)
              </h3>
            </div>
            <table className="w-full text-left border-collapse text-sm min-w-[760px]">
              <thead>
                <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
                  <th className="py-2.5 px-4">Unique Student ID</th>
                  <th className="py-2.5 px-4">Student Name</th>
                  <th className="py-2.5 px-4">Course</th>
                  <th className="py-2.5 px-4">Sem / Sec</th>
                  <th className="py-2.5 px-4">Current Password</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6f3ea]">
                {data.students.map((s) => {
                  const isEditingPass = editingStudentPassId === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-[#f6fbf7]">
                      <td className="py-2.5 px-4 font-mono tabular-nums text-xs font-bold text-[#14532d]">
                        {s.id}
                      </td>
                      <td className="py-2.5 px-4 font-semibold">{s.name}</td>
                      <td className="py-2.5 px-4 text-xs text-[#356847]">{s.course}</td>
                      <td className="py-2.5 px-4 text-xs font-mono tabular-nums">
                        Sem {s.semester} · {s.section}
                      </td>
                      <td className="py-2.5 px-4">
                        {isEditingPass ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              aria-label={`New password for ${s.name}`}
                              value={studentPassDraft}
                              onChange={(e) => setStudentPassDraft(e.target.value)}
                              minLength={4}
                              placeholder="Min 4 chars"
                              className="h-8 w-28 px-2 text-xs bg-white border border-[#166534] rounded font-mono"
                            />
                            <button
                              type="button"
                              disabled={updatingStudentPass}
                              onClick={() => handleSaveStudentPassword(s.id, s.name)}
                              className="h-8 px-2.5 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStudentPassId(null);
                                setStudentPassDraft('');
                              }}
                              className="h-8 px-2 bg-white border border-[#cfe6d6] text-xs text-[#356847] rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span
                            data-testid={`student-password-${s.id}`}
                            className="inline-block font-mono text-xs font-bold bg-[#eef8f0] border border-[#bfe0c8] text-[#14532d] px-2 py-0.5 rounded"
                          >
                            {s.password || '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStudentPassId(s.id);
                              setStudentPassDraft(s.password || '');
                              setError('');
                              setStatusMsg('');
                            }}
                            aria-label={`Update password for ${s.name}`}
                            className="px-2.5 py-1 text-xs font-semibold border border-[#9fd0ad] rounded hover:bg-[#dff2e4] text-[#14532d] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Update Pass</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(s.id)}
                            aria-label={`Remove student ${s.name}`}
                            className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
