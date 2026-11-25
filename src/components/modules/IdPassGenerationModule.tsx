import React, { useState } from 'react';
import { CheckCircle2, Copy, KeyRound, RefreshCw, UserPlus } from 'lucide-react';
import type { PortalBootstrapData } from '../../types/portal';
import {
  generateTemporaryPassword,
  generateUniqueStudentId,
} from '../../utils/academicRules';
import {
  addTeacher,
  approveStudentApplication,
  enrollStudent,
  rejectStudentApplication,
} from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
}

export function IdPassGenerationModule({ data, subPart, onRefresh }: Props) {
  const applications = data.studentApplications || [];
  const pending = applications.filter((a) => a.status === 'Pending');
  const reviewed = applications.filter((a) => a.status !== 'Pending');

  // Pending request approval state
  const [overridePasswords, setOverridePasswords] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Direct Student ID + Password Generator state (10.2)
  const [stuId, setStuId] = useState(() =>
    generateUniqueStudentId(data.students.map((s) => s.id))
  );
  const [stuPass, setStuPass] = useState(() => generateTemporaryPassword(8));
  const [stuName, setStuName] = useState('');
  const [stuCourse, setStuCourse] = useState('B.Tech, C.S.E (I.O.T.)');
  const [stuSem, setStuSem] = useState('5');
  const [stuSec, setStuSec] = useState('C');
  const [stuRoll, setStuRoll] = useState('');
  const [stuEmail, setStuEmail] = useState('');
  const [stuPhone, setStuPhone] = useState('');
  const [stuSaving, setStuSaving] = useState(false);

  // Direct Teacher ID + Password Generator state (10.2)
  const [teaId, setTeaId] = useState('');
  const [teaPass, setTeaPass] = useState(() => generateTemporaryPassword(8));
  const [teaName, setTeaName] = useState('');
  const [teaDept, setTeaDept] = useState('C.S.E (I.O.T.)');
  const [teaDesig, setTeaDesig] = useState('Assistant Professor');
  const [teaEmail, setTeaEmail] = useState('');
  const [teaSaving, setTeaSaving] = useState(false);

  const [issuedCredential, setIssuedCredential] = useState<{
    role: 'Student' | 'Teacher';
    name: string;
    id: string;
    password?: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  if (data.user.role !== 'admin') {
    return null;
  }

  async function handleApprove(appId: string, applicantName: string) {
    setError('');
    setMsg('');
    setIssuedCredential(null);
    const override = (overridePasswords[appId] || '').trim();
    if (override && override.length < 4) {
      setError('Override password must be at least 4 characters.');
      return;
    }

    setBusyId(appId);
    try {
      const res = await approveStudentApplication(appId, {
        overridePassword: override || undefined,
      });
      setOverridePasswords((prev) => ({ ...prev, [appId]: '' }));
      setIssuedCredential({
        role: 'Student',
        name: applicantName,
        id: res.generatedId,
        password: override || undefined,
      });
      setMsg(
        `Approved ${applicantName} (${appId}). Issued Unique Student ID: ${res.generatedId}`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(appId: string, applicantName: string) {
    setError('');
    setMsg('');
    setBusyId(appId);
    try {
      await rejectStudentApplication(appId);
      setMsg(`Rejected request ${appId} for ${applicantName}.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDirectGenerateStudent(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    setIssuedCredential(null);
    setStuSaving(true);
    try {
      const res = await enrollStudent({
        studentId: stuId.trim(),
        name: stuName.trim(),
        course: stuCourse.trim(),
        semester: Number(stuSem) || 1,
        section: stuSec.trim() || 'A',
        rollNo: stuRoll.trim(),
        email: stuEmail.trim(),
        phone: stuPhone.trim(),
        initialPassword: stuPass.trim(),
      });
      setIssuedCredential({
        role: 'Student',
        name: res.student.name,
        id: res.generatedId,
        password: stuPass.trim(),
      });
      setCopiedKey(false);
      setStuName('');
      setStuRoll('');
      setStuEmail('');
      setStuPhone('');
      setStuId(generateUniqueStudentId([...data.students.map((s) => s.id), res.generatedId]));
      setStuPass(generateTemporaryPassword(8));
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate student credentials');
    } finally {
      setStuSaving(false);
    }
  }

  async function handleDirectGenerateTeacher(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    setIssuedCredential(null);
    setTeaSaving(true);
    try {
      const res = await addTeacher({
        id: teaId.trim(),
        name: teaName.trim(),
        password: teaPass.trim(),
        department: teaDept.trim(),
        designation: teaDesig.trim(),
        email: teaEmail.trim(),
      });
      setIssuedCredential({
        role: 'Teacher',
        name: res.teacher.name,
        id: res.teacher.id,
        password: teaPass.trim(),
      });
      setCopiedKey(false);
      setTeaId('');
      setTeaName('');
      setTeaEmail('');
      setTeaPass(generateTemporaryPassword(8));
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate teacher credentials');
    } finally {
      setTeaSaving(false);
    }
  }

  if (subPart === '10.3') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            10.3 Issued ID &amp; Reviewed Request History
          </h2>
          <p className="text-sm text-[#356847]">
            Official audit register of approved Student ID issuances and rejected requests.
          </p>
        </div>

        <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
                <th className="py-2.5 px-4">Ref ID</th>
                <th className="py-2.5 px-4">Applicant Name</th>
                <th className="py-2.5 px-4">Course / Sem</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Issued Student ID</th>
                <th className="py-2.5 px-4">Reviewed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6f3ea]">
              {reviewed.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-xs text-[#356847]">
                    No reviewed requests recorded yet.
                  </td>
                </tr>
              ) : (
                reviewed.map((app) => (
                  <tr key={app.id} className="hover:bg-[#f6fbf7]">
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#14532d]">
                      {app.id}
                    </td>
                    <td className="py-2.5 px-4 font-medium">{app.name}</td>
                    <td className="py-2.5 px-4 text-xs text-[#274e36]">
                      {app.course} (Sem {app.semester}, Sec {app.section})
                    </td>
                    <td className="py-2.5 px-4 text-xs font-bold">
                      {app.status === 'Approved' ? (
                        <span className="text-[#166534]">Approved</span>
                      ) : (
                        <span className="text-red-700">Rejected</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs font-bold text-[#14532d]">
                      {app.assignedStudentId || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[#356847]">
                      {app.reviewedAt || '—'} {app.reviewedBy ? `by ${app.reviewedBy}` : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (subPart === '10.2') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            10.2 Direct ID &amp; Password Generator (Admin Only)
          </h2>
          <p className="text-sm text-[#356847]">
            Generate unique login IDs and initial passwords for newly admitted students and faculty members.
          </p>
        </div>

        {issuedCredential && (
          <div
            role="status"
            className="bg-[#dff2e4] border border-[#166534] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#166534] shrink-0" />
              <div className="text-xs text-[#14532d]">
                <div className="font-bold text-sm">
                  {issuedCredential.role} Credentials Generated: {issuedCredential.name}
                </div>
                <div className="font-mono mt-0.5">
                  Login ID: <strong>{issuedCredential.id}</strong>
                  {issuedCredential.password && (
                    <>
                      {' '}
                      · Password: <strong>{issuedCredential.password}</strong>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const summary = issuedCredential.password
                  ? `ID: ${issuedCredential.id} | Password: ${issuedCredential.password}`
                  : `ID: ${issuedCredential.id}`;
                navigator.clipboard?.writeText(summary);
                setCopiedKey(true);
              }}
              className="px-3 py-1.5 bg-white border border-[#9fd0ad] rounded text-xs font-semibold text-[#14532d] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedKey ? 'Copied' : 'Copy Credentials'}</span>
            </button>
          </div>
        )}

        {error && (
          <div className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Student ID & Password Generator */}
          <form
            onSubmit={handleDirectGenerateStudent}
            className="bg-white border border-[#c5e2CE] rounded-lg p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-[#14532d] flex items-center gap-2 pb-2 border-b border-[#e6f3ea]">
              <UserPlus className="w-4 h-4 text-[#166534]" />
              <span>Generate Student ID &amp; Password</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="gen-stu-id" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Unique Student ID
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="gen-stu-id"
                    type="text"
                    required
                    value={stuId}
                    onChange={(e) => setStuId(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-[#9fd0ad] rounded font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setStuId(
                        generateUniqueStudentId([
                          ...data.students.map((s) => s.id),
                          stuId,
                        ])
                      )
                    }
                    aria-label="Generate next unique student ID"
                    className="h-9 px-2.5 bg-[#eef8f0] border border-[#9fd0ad] rounded text-[#14532d] hover:bg-[#dff2e4] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="gen-stu-pass" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Initial Password
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="gen-stu-pass"
                    type="text"
                    required
                    minLength={4}
                    value={stuPass}
                    onChange={(e) => setStuPass(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-[#9fd0ad] rounded font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setStuPass(generateTemporaryPassword(8))}
                    aria-label="Generate random student password"
                    className="h-9 px-2.5 bg-[#eef8f0] border border-[#9fd0ad] rounded text-[#14532d] hover:bg-[#dff2e4] cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="gen-stu-name" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Student Full Name *
                </label>
                <input
                  id="gen-stu-name"
                  type="text"
                  required
                  value={stuName}
                  onChange={(e) => setStuName(e.target.value)}
                  placeholder="e.g. Tanmay Roy"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>

              <div>
                <label htmlFor="gen-stu-course" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Course / Program *
                </label>
                <input
                  id="gen-stu-course"
                  type="text"
                  required
                  value={stuCourse}
                  onChange={(e) => setStuCourse(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="gen-stu-sem" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Sem
                  </label>
                  <input
                    id="gen-stu-sem"
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={stuSem}
                    onChange={(e) => setStuSem(e.target.value)}
                    className="w-full h-9 px-2 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="gen-stu-sec" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Sec
                  </label>
                  <input
                    id="gen-stu-sec"
                    type="text"
                    maxLength={2}
                    value={stuSec}
                    onChange={(e) => setStuSec(e.target.value)}
                    className="w-full h-9 px-2 text-sm bg-white border border-[#a9d5b6] rounded uppercase"
                  />
                </div>
                <div>
                  <label htmlFor="gen-stu-roll" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Roll
                  </label>
                  <input
                    id="gen-stu-roll"
                    type="text"
                    value={stuRoll}
                    onChange={(e) => setStuRoll(e.target.value)}
                    placeholder="26"
                    className="w-full h-9 px-2 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="gen-stu-email" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Email Address
                </label>
                <input
                  id="gen-stu-email"
                  type="email"
                  value={stuEmail}
                  onChange={(e) => setStuEmail(e.target.value)}
                  placeholder="student@institute.edu"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="gen-stu-phone" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Contact Phone
                </label>
                <input
                  id="gen-stu-phone"
                  type="tel"
                  value={stuPhone}
                  onChange={(e) => setStuPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={stuSaving}
              className="w-full h-9 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded cursor-pointer"
            >
              {stuSaving ? 'Issuing Student ID...' : 'Issue Student ID & Password'}
            </button>
          </form>

          {/* Teacher ID & Password Generator */}
          <form
            onSubmit={handleDirectGenerateTeacher}
            className="bg-white border border-[#c5e2CE] rounded-lg p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-[#14532d] flex items-center gap-2 pb-2 border-b border-[#e6f3ea]">
              <UserPlus className="w-4 h-4 text-[#166534]" />
              <span>Generate Teacher ID &amp; Password</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="gen-tea-id" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Teacher Login ID *
                </label>
                <input
                  id="gen-tea-id"
                  type="text"
                  required
                  value={teaId}
                  onChange={(e) => setTeaId(e.target.value)}
                  placeholder="e.g. Arnab"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#9fd0ad] rounded font-mono font-bold"
                />
              </div>

              <div>
                <label htmlFor="gen-tea-pass" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Initial Password *
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="gen-tea-pass"
                    type="text"
                    required
                    minLength={4}
                    value={teaPass}
                    onChange={(e) => setTeaPass(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-[#9fd0ad] rounded font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setTeaPass(generateTemporaryPassword(8))}
                    aria-label="Generate random teacher password"
                    className="h-9 px-2.5 bg-[#eef8f0] border border-[#9fd0ad] rounded text-[#14532d] hover:bg-[#dff2e4] cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="gen-tea-name" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Faculty Full Name *
                </label>
                <input
                  id="gen-tea-name"
                  type="text"
                  required
                  value={teaName}
                  onChange={(e) => setTeaName(e.target.value)}
                  placeholder="e.g. Prof. Arnab Ghosh"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>

              <div>
                <label htmlFor="gen-tea-dept" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Department
                </label>
                <input
                  id="gen-tea-dept"
                  type="text"
                  value={teaDept}
                  onChange={(e) => setTeaDept(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>

              <div>
                <label htmlFor="gen-tea-desig" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Designation
                </label>
                <input
                  id="gen-tea-desig"
                  type="text"
                  value={teaDesig}
                  onChange={(e) => setTeaDesig(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>

              <div>
                <label htmlFor="gen-tea-email" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Faculty Email
                </label>
                <input
                  id="gen-tea-email"
                  type="email"
                  value={teaEmail}
                  onChange={(e) => setTeaEmail(e.target.value)}
                  placeholder="faculty@institute.edu"
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={teaSaving}
              className="w-full h-9 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded cursor-pointer"
            >
              {teaSaving ? 'Issuing Teacher ID...' : 'Issue Teacher ID & Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Default 10.1: Pending ID & Password Requests submitted from Login Modal
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            10.1 Pending Student ID &amp; Password Requests
          </h2>
          <p className="text-sm text-[#356847]">
            Admin-only queue of requests submitted via the Login Page request modal. Approving issues a unique 14-digit Student ID and activates login credentials.
          </p>
        </div>
        <div className="bg-[#e8f5ec] border border-[#b7dec2] rounded px-3.5 py-2 text-xs font-mono tabular-nums text-[#14532d]">
          Pending: <strong>{pending.length}</strong> · Reviewed:{' '}
          <strong>{reviewed.length}</strong>
        </div>
      </div>

      {msg && (
        <div
          role="status"
          className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3.5 py-2.5 rounded"
        >
          {msg}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3.5 py-2.5 rounded"
        >
          {error}
        </div>
      )}

      {pending.length === 0 ? (
        <div className="bg-white border border-[#c5e2CE] rounded-lg p-6 text-center text-sm text-[#356847]">
          No pending student ID &amp; password requests at this time.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((app) => {
            const busy = busyId === app.id;
            return (
              <div
                key={app.id}
                className="bg-white border border-[#c5e2CE] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#166534] bg-[#e8f5ec] border border-[#bfe0c8] px-2 py-0.5 rounded">
                      {app.id}
                    </span>
                    <span className="text-sm font-bold text-[#14532d]">{app.name}</span>
                    <span className="text-xs text-[#4b785b]">·</span>
                    <span className="text-xs text-[#274e36]">
                      Submitted {app.submittedAt}
                    </span>
                  </div>
                  <div className="text-xs text-[#274e36]">
                    {app.course} · Sem {app.semester}, Sec {app.section}
                    {app.rollNo ? ` · Roll ${app.rollNo}` : ''}
                  </div>
                  <div className="text-xs text-[#356847] font-mono">
                    {app.email} · {app.phone}
                    {app.requestedPassword && (
                      <>
                        {' · '}
                        Requested Pass:{' '}
                        <strong className="text-[#14532d]">{app.requestedPassword}</strong>
                      </>
                    )}
                  </div>
                  {app.notes && (
                    <div className="text-xs text-[#4b785b] italic">{app.notes}</div>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-2.5 shrink-0">
                  <div>
                    <label
                      htmlFor={`ovr-pass-${app.id}`}
                      className="block text-[11px] font-semibold text-[#14532d] mb-1"
                    >
                      Password Override (optional)
                    </label>
                    <input
                      id={`ovr-pass-${app.id}`}
                      type="text"
                      value={overridePasswords[app.id] || ''}
                      onChange={(e) =>
                        setOverridePasswords((prev) => ({
                          ...prev,
                          [app.id]: e.target.value,
                        }))
                      }
                      placeholder="Keep student's requested"
                      className="h-8 w-44 px-2.5 text-xs bg-white border border-[#a9d5b6] rounded"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleApprove(app.id, app.name)}
                    className="h-8 px-3.5 bg-[#166534] hover:bg-[#14532d] disabled:opacity-60 text-white text-xs font-semibold rounded cursor-pointer whitespace-nowrap"
                  >
                    {busy ? 'Processing...' : 'Approve & Issue ID'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReject(app.id, app.name)}
                    className="h-8 px-3 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded cursor-pointer whitespace-nowrap"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
