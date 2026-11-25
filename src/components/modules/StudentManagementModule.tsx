import React, { useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Search, Trash2, UserPlus } from 'lucide-react';
import type { PortalBootstrapData } from '../../types/portal';
import { validatePasswordInput } from '../../utils/academicRules';
import { deleteStudent, enrollStudent, updateStudent } from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
}

export function StudentManagementModule({ data, subPart, onRefresh }: Props) {
  const isAdmin = data.user.role === 'admin';

  // Enroll Form State (2.1)
  const [name, setName] = useState('');
  const [course, setCourse] = useState('B.Tech, C.S.E (I.O.T.)');
  const [semester, setSemester] = useState('5');
  const [section, setSection] = useState('C');
  const [rollNo, setRollNo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [initialPassword, setInitialPassword] = useState('123456');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Directory Search State (2.2)
  const [search, setSearch] = useState('');

  // Credential Control State (2.3)
  const [selectedStudentId, setSelectedStudentId] = useState(data.students[0]?.id || '');
  const [newPass, setNewPass] = useState('');
  const [credMsg, setCredMsg] = useState('');
  const [rowEditId, setRowEditId] = useState<string | null>(null);
  const [rowPassDraft, setRowPassDraft] = useState('');

  const effectiveSelectedStudentId = data.students.some((s) => s.id === selectedStudentId)
    ? selectedStudentId
    : data.students[0]?.id || '';

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnrollResult(null);
    setEnrolling(true);
    try {
      const res = await enrollStudent({
        name,
        course,
        semester: Number(semester),
        section,
        rollNo,
        email,
        phone,
        initialPassword,
      });
      setEnrollResult({ id: res.generatedId, name: res.student.name });
      setName('');
      setRollNo('');
      setEmail('');
      setPhone('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  async function handleDeleteStudent(id: string) {
    try {
      await deleteStudent(id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student');
    }
  }

  async function handleCredentialUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveSelectedStudentId) return;
    setCredMsg('');
    const check = validatePasswordInput(newPass);
    if (!check.valid) {
      setCredMsg(check.error || 'Password must be at least 4 characters.');
      return;
    }
    try {
      await updateStudent(effectiveSelectedStudentId, { newPassword: check.cleaned });
      setNewPass('');
      setCredMsg('Student login password updated successfully.');
      await onRefresh();
    } catch (err) {
      setCredMsg(err instanceof Error ? err.message : 'Failed to update password');
    }
  }

  async function handleInlineRowPasswordUpdate(studentId: string, studentName: string) {
    setCredMsg('');
    const check = validatePasswordInput(rowPassDraft);
    if (!check.valid) {
      setCredMsg(check.error || 'Password must be at least 4 characters.');
      return;
    }
    try {
      await updateStudent(studentId, { newPassword: check.cleaned });
      setRowEditId(null);
      setRowPassDraft('');
      setCredMsg(`Updated password for ${studentName} (${studentId}).`);
      await onRefresh();
    } catch (err) {
      setCredMsg(err instanceof Error ? err.message : 'Failed to update password');
    }
  }

  async function handleToggleStatus(id: string, currentStatus: 'active' | 'inactive') {
    setCredMsg('');
    const next = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await updateStudent(id, { status: next });
      setCredMsg(`Updated student ${id} status to ${next}.`);
      await onRefresh();
    } catch (err) {
      setCredMsg(err instanceof Error ? err.message : 'Failed to update student status');
    }
  }

  if (subPart === '2.1') {
    if (!isAdmin) {
      return (
        <div className="bg-white border border-[#c5e2CE] rounded-lg p-6 text-sm text-[#356847]">
          Only the Administrator can enroll students and generate unique Student IDs.
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            2.1 Enroll Student &amp; Generate Unique ID
          </h2>
          <p className="text-sm text-[#356847]">
            Enrolling a student automatically generates a unique 14-digit Student Login ID.
          </p>
        </div>

        {enrollResult && (
          <div
            role="status"
            className="bg-[#dff2e4] border border-[#166534] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#166534] shrink-0" />
              <div>
                <div className="text-sm font-bold text-[#14532d]">
                  Enrolled {enrollResult.name}
                </div>
                <div className="text-xs text-[#274e36] mt-0.5">
                  Generated Unique Student ID:{' '}
                  <span
                    className="font-mono font-bold text-[#14532d]"
                    data-testid="generated-student-id"
                  >
                    {enrollResult.id}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(enrollResult.id);
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 1500);
              }}
              className="px-3 py-1.5 bg-white border border-[#9fd0ad] rounded text-xs font-semibold text-[#14532d] flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-xs font-medium px-3 py-2 rounded">
            {error}
          </div>
        )}

        <form
          onSubmit={handleEnroll}
          className="bg-white border border-[#c5e2CE] rounded-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label htmlFor="stu-name" className="block text-xs font-semibold text-[#14532d] mb-1">
              Student Full Name
            </label>
            <input
              id="stu-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ananya Roy"
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
            />
          </div>
          <div>
            <label htmlFor="stu-course" className="block text-xs font-semibold text-[#14532d] mb-1">
              Course / Department
            </label>
            <input
              id="stu-course"
              type="text"
              required
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="stu-sem" className="block text-xs font-semibold text-[#14532d] mb-1">
                Semester
              </label>
              <input
                id="stu-sem"
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
              <label htmlFor="stu-sec" className="block text-xs font-semibold text-[#14532d] mb-1">
                Section
              </label>
              <input
                id="stu-sec"
                type="text"
                maxLength={2}
                required
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded uppercase"
              />
            </div>
            <div>
              <label htmlFor="stu-roll" className="block text-xs font-semibold text-[#14532d] mb-1">
                Roll No
              </label>
              <input
                id="stu-roll"
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="24"
                className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
              />
            </div>
          </div>
          <div>
            <label htmlFor="stu-pass" className="block text-xs font-semibold text-[#14532d] mb-1">
              Initial Login Password
            </label>
            <input
              id="stu-pass"
              type="text"
              required
              minLength={4}
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="stu-email" className="block text-xs font-semibold text-[#14532d] mb-1">
              Email Address
            </label>
            <input
              id="stu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@institute.edu"
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
            />
          </div>
          <div>
            <label htmlFor="stu-phone" className="block text-xs font-semibold text-[#14532d] mb-1">
              Contact Number
            </label>
            <input
              id="stu-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98..."
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
            />
          </div>
          <div className="md:col-span-2 flex justify-end pt-1">
            <button
              type="submit"
              disabled={enrolling}
              className="px-5 py-2.5 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{enrolling ? 'Generating ID...' : 'Enroll & Generate Unique Student ID'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (subPart === '2.3') {
    const selectedStudent = data.students.find((s) => s.id === effectiveSelectedStudentId);
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            2.3 Student Credentials &amp; ID Control
          </h2>
          <p className="text-sm text-[#356847]">
            {isAdmin
              ? 'View current student login passwords, update passwords, or activate/deactivate portal access.'
              : 'View enrolled student unique IDs and active portal status.'}
          </p>
        </div>

        {isAdmin && (
          <form
            onSubmit={handleCredentialUpdate}
            className="bg-white border border-[#c5e2CE] rounded-lg p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
          >
            <div>
              <label htmlFor="cred-stu" className="block text-xs font-semibold text-[#14532d] mb-1">
                Select Student (Unique ID)
              </label>
              <select
                id="cred-stu"
                value={effectiveSelectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
              >
                {data.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.name}
                  </option>
                ))}
              </select>
              {selectedStudent && (
                <div className="text-[11px] font-mono text-[#356847] mt-1">
                  Current Password: <strong className="text-[#14532d]">{selectedStudent.password || '—'}</strong>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="cred-pass" className="block text-xs font-semibold text-[#14532d] mb-1">
                New Password
              </label>
              <input
                id="cred-pass"
                type="text"
                required
                minLength={4}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Min 4 characters"
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded cursor-pointer"
            >
              Update Student Password
            </button>
          </form>
        )}

        {credMsg && (
          <div
            role="status"
            className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3 py-2 rounded"
          >
            {credMsg}
          </div>
        )}

        <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm min-w-[680px]">
            <thead>
              <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
                <th className="py-2.5 px-4">Unique Student ID</th>
                <th className="py-2.5 px-4">Name</th>
                {isAdmin && <th className="py-2.5 px-4">Current Password</th>}
                <th className="py-2.5 px-4">Enrolled On</th>
                <th className="py-2.5 px-4">Status</th>
                {isAdmin && <th className="py-2.5 px-4 text-right">Access Control</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6f3ea]">
              {data.students.map((s) => {
                const editingRow = rowEditId === s.id;
                return (
                  <tr key={s.id} className="hover:bg-[#f6fbf7]">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs font-bold text-[#14532d]">
                      {s.id}
                    </td>
                    <td className="py-2.5 px-4 font-medium">{s.name}</td>
                    {isAdmin && (
                      <td className="py-2.5 px-4">
                        {editingRow ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              aria-label={`Edit password for ${s.name}`}
                              value={rowPassDraft}
                              onChange={(e) => setRowPassDraft(e.target.value)}
                              minLength={4}
                              className="h-8 w-28 px-2 text-xs bg-white border border-[#166534] rounded font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleInlineRowPasswordUpdate(s.id, s.name)}
                              className="h-8 px-2.5 bg-[#166534] text-white text-xs font-semibold rounded cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRowEditId(null);
                                setRowPassDraft('');
                              }}
                              className="h-8 px-2 bg-white border border-[#cfe6d6] text-xs text-[#356847] rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="inline-block font-mono text-xs font-bold bg-[#eef8f0] border border-[#bfe0c8] text-[#14532d] px-2 py-0.5 rounded">
                            {s.password || '—'}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-[#356847]">
                      {s.enrolledAt}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-semibold">
                      {s.status === 'active' ? 'Active' : 'Inactive'}
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setRowEditId(s.id);
                            setRowPassDraft(s.password || '');
                            setCredMsg('');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold border border-[#9fd0ad] rounded hover:bg-[#dff2e4] text-[#14532d] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Update Pass</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(s.id, s.status)}
                          className="px-2.5 py-1 text-xs font-semibold border border-[#9fd0ad] rounded hover:bg-[#dff2e4] text-[#14532d] cursor-pointer"
                        >
                          {s.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Default 2.2: Student Directory
  const filtered = data.students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.course.toLowerCase().includes(q) ||
      s.rollNo.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">2.2 Enrolled Student Directory</h2>
          <p className="text-sm text-[#356847]">
            Search and review enrolled students and their unique generated IDs.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-[#4b785b] absolute left-3 top-2.5" />
          <input
            type="search"
            aria-label="Search students"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name, roll..."
            className="h-9 pl-9 pr-3 w-64 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
          />
        </div>
      </div>

      <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm min-w-[700px]">
            <thead>
              <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
                <th className="py-2.5 px-4">Unique ID</th>
                <th className="py-2.5 px-4">Student Name</th>
                <th className="py-2.5 px-4">Course</th>
                <th className="py-2.5 px-4">Sem / Sec</th>
                <th className="py-2.5 px-4">Roll No</th>
                {isAdmin && <th className="py-2.5 px-4">Current Password</th>}
                <th className="py-2.5 px-4">Contact</th>
                {isAdmin && <th className="py-2.5 px-4 text-right">Remove</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6f3ea]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 6} className="py-8 text-center text-[#4a7459]">
                    No students match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#f6fbf7]">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs font-bold text-[#14532d]">
                      {s.id}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#0f291a]">{s.name}</td>
                    <td className="py-2.5 px-4 text-xs text-[#356847]">{s.course}</td>
                    <td className="py-2.5 px-4 text-xs font-mono tabular-nums text-[#274e36]">
                      Sem {s.semester} · {s.section}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs">{s.rollNo}</td>
                    {isAdmin && (
                      <td className="py-2.5 px-4">
                        <span className="inline-block font-mono text-xs font-bold bg-[#eef8f0] border border-[#bfe0c8] text-[#14532d] px-2 py-0.5 rounded">
                          {s.password || '—'}
                        </span>
                      </td>
                    )}
                    <td className="py-2.5 px-4 text-xs text-[#356847]">
                      {s.email || s.phone || '—'}
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(s.id)}
                          aria-label={`Remove student ${s.name}`}
                          className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
        </table>
      </div>
    </div>
  );
}
