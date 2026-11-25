import React, { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { PortalBootstrapData } from '../../types/portal';
import {
  calculateSubjectAttendanceBreakdown,
  hasTeacherPermission,
} from '../../utils/academicRules';
import { submitAttendance, updateAttendanceThreshold } from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
}

export function AttendanceModule({ data, subPart, onRefresh }: Props) {
  const isAdmin = data.user.role === 'admin';
  const canMark =
    isAdmin ||
    (data.user.role === 'teacher' &&
      hasTeacherPermission(data.user.permissions, 'attendance'));

  const todayStr = new Date().toISOString().slice(0, 10);
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id || '');
  const [date, setDate] = useState(todayStr);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Report student selector (for Admin/Teacher in 5.2 and 5.3)
  const [reportStudentId, setReportStudentId] = useState(
    data.user.role === 'student' ? data.user.id : data.students[0]?.id || ''
  );
  const [thresholdInput, setThresholdInput] = useState(String(data.attendanceThreshold));

  useEffect(() => {
    setThresholdInput(String(data.attendanceThreshold));
  }, [data.attendanceThreshold]);

  const effectiveSubjectId = data.subjects.some((s) => s.id === subjectId)
    ? subjectId
    : data.subjects[0]?.id || '';

  const effectiveReportStudentId =
    data.user.role === 'student'
      ? data.user.id
      : data.students.some((s) => s.id === reportStudentId)
      ? reportStudentId
      : data.students[0]?.id || '';

  const savedStatusByStudent = useMemo(() => {
    const map: Record<string, 'Present' | 'Absent' | null> = {};
    for (const s of data.students) {
      const existing = data.attendance.find(
        (a) => a.date === date && a.subjectId === effectiveSubjectId && a.studentId === s.id
      );
      map[s.id] = existing ? existing.status : null;
    }
    return map;
  }, [data.students, data.attendance, date, effectiveSubjectId]);

  async function handleTapStudentAttendance(
    studentId: string,
    studentName: string,
    status: 'Present' | 'Absent',
    targetSubjectId = effectiveSubjectId,
    targetDate = date
  ) {
    if (!targetSubjectId || !targetDate) return;
    const key = `${targetDate}:${targetSubjectId}:${studentId}`;
    setBusyKey(key);
    setError('');
    setMsg('');
    try {
      await submitAttendance({
        date: targetDate,
        subjectId: targetSubjectId,
        entries: [{ studentId, status }],
      });
      setMsg(`Updated ${studentName} to ${status} for ${targetDate}.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleMarkAll(status: 'Present' | 'Absent') {
    if (!effectiveSubjectId || !date || data.students.length === 0) return;
    setBusyKey('ALL');
    setError('');
    setMsg('');
    try {
      await submitAttendance({
        date,
        subjectId: effectiveSubjectId,
        entries: data.students.map((s) => ({ studentId: s.id, status })),
      });
      setMsg(`Marked all ${data.students.length} students ${status} for ${date}.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveThreshold(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await updateAttendanceThreshold(Number(thresholdInput));
      setMsg('Attendance threshold updated.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update threshold');
    }
  }

  if (subPart === '5.1' && canMark) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#14532d]">
              5.1 Mark &amp; Update Attendance
            </h2>
            <p className="text-sm text-[#356847]">
              Tap <strong>Present</strong> or <strong>Absent</strong> directly in the table to save or update attendance immediately.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busyKey !== null || data.students.length === 0}
              onClick={() => handleMarkAll('Present')}
              className="h-9 px-3.5 bg-[#166534] hover:bg-[#14532d] disabled:opacity-60 text-white text-xs font-semibold rounded cursor-pointer whitespace-nowrap"
            >
              Mark All Present
            </button>
            <button
              type="button"
              disabled={busyKey !== null || data.students.length === 0}
              onClick={() => handleMarkAll('Absent')}
              className="h-9 px-3.5 bg-white hover:bg-red-50 border border-red-200 disabled:opacity-60 text-red-700 text-xs font-semibold rounded cursor-pointer whitespace-nowrap"
            >
              Mark All Absent
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#c5e2CE] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="att-sub" className="block text-xs font-semibold text-[#14532d] mb-1">
              Subject
            </label>
            <select
              id="att-sub"
              value={effectiveSubjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setMsg('');
                setError('');
              }}
              className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
            >
              {data.subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} — {sub.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="att-date" className="block text-xs font-semibold text-[#14532d] mb-1">
              Class Date
            </label>
            <input
              id="att-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setMsg('');
                setError('');
              }}
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
            />
          </div>
        </div>

        {msg && (
          <div
            role="status"
            className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3 py-2 rounded"
          >
            {msg}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded"
          >
            {error}
          </div>
        )}

        <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
                <th className="py-2.5 px-4">Student ID</th>
                <th className="py-2.5 px-4">Student Name</th>
                <th className="py-2.5 px-4">Roll / Sec</th>
                <th className="py-2.5 px-4">Recorded Status</th>
                <th className="py-2.5 px-4 text-right">Tap to Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6f3ea]">
              {data.students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#4a7459]">
                    No enrolled students found.
                  </td>
                </tr>
              ) : (
              data.students.map((stu) => {
                const status = savedStatusByStudent[stu.id];
                const isBusy = busyKey === `${date}:${effectiveSubjectId}:${stu.id}` || busyKey === 'ALL';
                return (
                  <tr key={stu.id} className="hover:bg-[#f6fbf7]">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs font-bold text-[#14532d]">
                      {stu.id}
                    </td>
                    <td className="py-2.5 px-4 font-semibold">{stu.name}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-[#356847]">
                      Roll {stu.rollNo} · {stu.section}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-bold">
                      {status === 'Present' ? (
                        <span className="text-[#166534]">Present</span>
                      ) : status === 'Absent' ? (
                        <span className="text-red-700">Absent</span>
                      ) : (
                        <span className="text-[#6a8f77] font-normal">Not marked</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex rounded border border-[#a9d5b6] overflow-hidden">
                        <button
                          type="button"
                          disabled={isBusy}
                          aria-label={`Mark ${stu.name} Present`}
                          onClick={() => handleTapStudentAttendance(stu.id, stu.name, 'Present')}
                          className={`px-3 py-1 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                            status === 'Present'
                              ? 'bg-[#166534] text-white'
                              : 'bg-white text-[#356847] hover:bg-[#edf9f0]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Present</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          aria-label={`Mark ${stu.name} Absent`}
                          onClick={() => handleTapStudentAttendance(stu.id, stu.name, 'Absent')}
                          className={`px-3 py-1 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                            status === 'Absent'
                              ? 'bg-red-700 text-white'
                              : 'bg-white text-[#356847] hover:bg-red-50'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 5.3: Daily Attendance Log (Tap status cell directly to toggle Present / Absent)
  if (subPart === '5.3') {
    const targetId = effectiveReportStudentId;
    const studentInfo = data.students.find((s) => s.id === targetId);
    const logs = data.attendance
      .filter((a) => a.studentId === targetId)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#14532d]">5.3 Daily Attendance Log</h2>
            <p className="text-sm text-[#356847]">
              {canMark
                ? 'Tap any status cell in the table to toggle Present or Absent immediately.'
                : 'Date-by-date subject attendance entries recorded by faculty.'}
            </p>
          </div>
          {data.user.role !== 'student' && data.students.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="log-stu" className="text-xs font-semibold text-[#14532d]">
                Student:
              </label>
              <select
                id="log-stu"
                value={targetId}
                onChange={(e) => setReportStudentId(e.target.value)}
                className="h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
              >
                {data.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {msg && (
          <div
            role="status"
            className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3 py-2 rounded"
          >
            {msg}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded"
          >
            {error}
          </div>
        )}

        <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Subject</th>
                <th className="py-2.5 px-4">
                  Status {canMark ? '(Tap to Toggle)' : ''}
                </th>
                <th className="py-2.5 px-4">Marked By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6f3ea]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#4a7459]">
                    No daily attendance entries found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const sub = data.subjects.find((s) => s.id === log.subjectId);
                  const nextStatus = log.status === 'Present' ? 'Absent' : 'Present';
                  return (
                    <tr key={log.id} className="hover:bg-[#f6fbf7]">
                      <td className="py-2.5 px-4 font-mono tabular-nums text-xs">{log.date}</td>
                      <td className="py-2.5 px-4 font-medium">
                        {sub ? `${sub.code} — ${sub.name}` : log.subjectId}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-bold">
                        {canMark ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleTapStudentAttendance(
                                log.studentId,
                                studentInfo?.name || log.studentId,
                                nextStatus,
                                log.subjectId,
                                log.date
                              )
                            }
                            aria-label={`Toggle ${sub?.code || log.subjectId} on ${log.date} from ${log.status} to ${nextStatus}`}
                            className={`px-2.5 py-1 rounded border text-xs font-bold cursor-pointer ${
                              log.status === 'Present'
                                ? 'bg-[#e8f5ec] border-[#166534] text-[#166534] hover:bg-[#dff2e4]'
                                : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                            }`}
                          >
                            {log.status}
                          </button>
                        ) : (
                          <span
                            className={
                              log.status === 'Present' ? 'text-[#166534]' : 'text-red-700'
                            }
                          >
                            {log.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-[#356847]">
                        {log.markedBy}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 5.2: Attendance Summary & Quick Tap Update
  const targetStudentId = effectiveReportStudentId;
  const selectedStudent = data.students.find((s) => s.id === targetStudentId);
  const breakdown = calculateSubjectAttendanceBreakdown(
    data.attendance,
    data.subjects,
    targetStudentId,
    data.attendanceThreshold
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            5.2 Attendance Summary &amp; Threshold Alerts
          </h2>
          <p className="text-sm text-[#356847]">
            {canMark
              ? `Subject-wise attendance summary. Tap Present or Absent in the table to log attendance for ${todayStr}.`
              : 'Subject-wise attendance calculated as (Classes Attended ÷ Total Classes Held) × 100.'}
          </p>
        </div>

        {data.user.role !== 'student' && data.students.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="rep-stu" className="text-xs font-semibold text-[#14532d]">
              Student:
            </label>
            <select
              id="rep-stu"
              value={targetStudentId}
              onChange={(e) => setReportStudentId(e.target.value)}
              className="h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
            >
              {data.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isAdmin && (
        <form
          onSubmit={handleSaveThreshold}
          className="bg-[#f4fbf6] border border-[#c5e2CE] rounded-lg p-3.5 flex flex-wrap items-center gap-3"
        >
          <label htmlFor="att-thresh" className="text-xs font-semibold text-[#14532d]">
            Minimum Required Attendance Threshold (%):
          </label>
          <input
            id="att-thresh"
            type="number"
            min={0}
            max={100}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            className="h-8 w-20 px-2 text-sm bg-white border border-[#a9d5b6] rounded font-mono tabular-nums"
          />
          <button
            type="submit"
            className="h-8 px-3 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded cursor-pointer"
          >
            Update Threshold
          </button>
          {msg && <span className="text-xs font-medium text-[#166534]">{msg}</span>}
        </form>
      )}

      {!isAdmin && msg && (
        <div
          role="status"
          className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3 py-2 rounded"
        >
          {msg}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded"
        >
          {error}
        </div>
      )}

      <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
              <th className="py-2.5 px-4">Code</th>
              <th className="py-2.5 px-4">Subject</th>
              <th className="py-2.5 px-4 text-right">Attended</th>
              <th className="py-2.5 px-4 text-right">Classes Held</th>
              <th className="py-2.5 px-4 text-right">Attendance %</th>
              <th className="py-2.5 px-4">Status</th>
              {canMark && <th className="py-2.5 px-4 text-right">Tap ({todayStr})</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f3ea]">
            {breakdown.map(({ subject, stats }) => {
              const todayEntry = data.attendance.find(
                (a) =>
                  a.date === todayStr &&
                  a.subjectId === subject.id &&
                  a.studentId === targetStudentId
              );
              return (
                <tr key={subject.id} className="hover:bg-[#f6fbf7]">
                  <td className="py-2.5 px-4 font-mono text-xs font-bold text-[#14532d]">
                    {subject.code}
                  </td>
                  <td className="py-2.5 px-4 font-medium">{subject.name}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {stats.attendedClasses}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {stats.totalClasses}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">
                    {stats.totalClasses === 0 ? '—' : `${stats.percentage}%`}
                  </td>
                  <td className="py-2.5 px-4 text-xs font-semibold">
                    {stats.totalClasses === 0 ? (
                      <span className="text-[#4b785b]">No Classes Logged</span>
                    ) : stats.isBelowThreshold ? (
                      <span className="text-red-700">
                        Below {data.attendanceThreshold}% Threshold
                      </span>
                    ) : (
                      <span className="text-[#166534]">Satisfactory</span>
                    )}
                  </td>
                  {canMark && (
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex rounded border border-[#a9d5b6] overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            handleTapStudentAttendance(
                              targetStudentId,
                              selectedStudent?.name || targetStudentId,
                              'Present',
                              subject.id,
                              todayStr
                            )
                          }
                          aria-label={`Mark ${subject.code} Present for ${selectedStudent?.name || targetStudentId}`}
                          className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                            todayEntry?.status === 'Present'
                              ? 'bg-[#166534] text-white'
                              : 'bg-white text-[#356847] hover:bg-[#edf9f0]'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleTapStudentAttendance(
                              targetStudentId,
                              selectedStudent?.name || targetStudentId,
                              'Absent',
                              subject.id,
                              todayStr
                            )
                          }
                          aria-label={`Mark ${subject.code} Absent for ${selectedStudent?.name || targetStudentId}`}
                          className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                            todayEntry?.status === 'Absent'
                              ? 'bg-red-700 text-white'
                              : 'bg-white text-[#356847] hover:bg-red-50'
                          }`}
                        >
                          Absent
                        </button>
                      </div>
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
