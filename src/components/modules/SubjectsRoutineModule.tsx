import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DayOfWeek, PortalBootstrapData } from '../../types/portal';
import { hasTeacherPermission } from '../../utils/academicRules';
import { createSubject, deleteSubject, updateRoutineSlot } from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
}

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function SubjectsRoutineModule({ data, subPart, onRefresh }: Props) {
  const isAdmin = data.user.role === 'admin';
  const canEditRoutine =
    isAdmin ||
    (data.user.role === 'teacher' &&
      hasTeacherPermission(data.user.permissions, 'routine'));

  // Add Subject state (4.1)
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [course, setCourse] = useState('B.Tech, C.S.E (I.O.T.)');
  const [semester, setSemester] = useState('5');
  const [maxMarks, setMaxMarks] = useState('100');
  const [passingMarks, setPassingMarks] = useState('40');
  const [teacherId, setTeacherId] = useState(data.teachers[0]?.id || 'Subham');

  // Routine Editor state (4.2)
  const [day, setDay] = useState<DayOfWeek>('Mon');
  const [period, setPeriod] = useState('4');
  const [section, setSection] = useState('C');
  const [subjectCode, setSubjectCode] = useState(data.subjects[0]?.code || 'CS501');
  const [subjectName, setSubjectName] = useState(data.subjects[0]?.name || 'Algorithms');
  const [teacherName, setTeacherName] = useState(data.teachers[0]?.name || 'Prof. Subham Das');
  const [room, setRoom] = useState('LH-301');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const effectiveTeacherId = data.teachers.some((t) => t.id === teacherId)
    ? teacherId
    : data.teachers[0]?.id || 'Subham';

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await createSubject({
        code,
        name,
        course,
        semester: Number(semester),
        maxMarks: Number(maxMarks),
        passingMarks: Number(passingMarks),
        teacherId: effectiveTeacherId,
      });
      setCode('');
      setName('');
      setMsg('Subject added to registry.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subject');
    }
  }

  async function handleDeleteSubject(id: string) {
    setMsg('');
    setError('');
    try {
      await deleteSubject(id);
      setMsg('Subject removed from registry.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subject');
    }
  }

  async function handleSaveSlot(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await updateRoutineSlot({
        day,
        period: Number(period),
        course,
        semester: Number(semester) || 5,
        section,
        subjectCode,
        subjectName,
        teacherName,
        room,
      });
      setMsg(`Updated ${day} Period ${period} routine slot.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update routine slot');
    }
  }

  async function handleClearSlot() {
    setMsg('');
    setError('');
    try {
      await updateRoutineSlot({
        day,
        period: Number(period),
        course,
        semester: Number(semester) || 5,
        section,
        subjectCode: '',
        subjectName: '',
        teacherName: '',
        room: '',
      });
      setMsg(`Cleared ${day} Period ${period} slot.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear slot');
    }
  }

  if (subPart === '4.2') {
    const activeSem = Number(semester) || 5;
    const activeSec = (section || 'C').trim().toUpperCase();
    const routineFiltered = data.routine.filter(
      (r) => r.section === activeSec && r.semester === activeSem
    );
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            4.2 Update Weekly Class Routine
          </h2>
          <p className="text-sm text-[#356847]">
            Assign or clear subjects across Monday–Friday Periods 1 to 8.
          </p>
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

        {canEditRoutine && (
          <form
            onSubmit={handleSaveSlot}
            className="bg-white border border-[#c5e2CE] rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label htmlFor="rt-day" className="block text-xs font-semibold text-[#14532d] mb-1">
                Day
              </label>
              <select
                id="rt-day"
                value={day}
                onChange={(e) => setDay(e.target.value as DayOfWeek)}
                className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rt-period" className="block text-xs font-semibold text-[#14532d] mb-1">
                Period
              </label>
              <select
                id="rt-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
              >
                {PERIODS.map((p) => (
                  <option key={p} value={String(p)}>
                    Period - {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rt-subject" className="block text-xs font-semibold text-[#14532d] mb-1">
                Subject
              </label>
              <select
                id="rt-subject"
                value={subjectCode}
                onChange={(e) => {
                  const sel = data.subjects.find((s) => s.code === e.target.value);
                  setSubjectCode(e.target.value);
                  if (sel) {
                    setSubjectName(sel.name);
                    const t = data.teachers.find((tc) => tc.id === sel.teacherId);
                    if (t) setTeacherName(t.name);
                  }
                }}
                className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
              >
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rt-room" className="block text-xs font-semibold text-[#14532d] mb-1">
                Room / Lab
              </label>
              <input
                id="rt-room"
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="LH-301"
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
              />
            </div>

            <div>
              <label htmlFor="rt-teacher" className="block text-xs font-semibold text-[#14532d] mb-1">
                Faculty Name
              </label>
              <input
                id="rt-teacher"
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="rt-sem" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Semester
                </label>
                <input
                  id="rt-sem"
                  type="number"
                  min={1}
                  max={10}
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="rt-sec" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Section
                </label>
                <input
                  id="rt-sec"
                  type="text"
                  maxLength={2}
                  value={section}
                  onChange={(e) => setSection(e.target.value.toUpperCase())}
                  className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded uppercase"
                />
              </div>
            </div>

            <button
              type="submit"
              className="h-9 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded cursor-pointer"
            >
              Update Slot
            </button>
            <button
              type="button"
              onClick={handleClearSlot}
              className="h-9 px-4 bg-white border border-[#9fd0ad] hover:bg-[#edf9f0] text-[#14532d] text-sm font-semibold rounded cursor-pointer"
            >
              Clear Slot
            </button>
          </form>
        )}

        <div className="bg-white border border-[#9fd0ad] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px] text-xs">
            <thead>
              <tr className="bg-[#166534] text-white font-semibold">
                <th className="py-2 px-3 border-r border-[#237a45] w-16">Day</th>
                {PERIODS.map((p) => (
                  <th
                    key={p}
                    className="py-2 px-2.5 border-r border-[#237a45] last:border-r-0 text-center tabular-nums"
                  >
                    Period - {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#cbe4d2]">
              {DAYS.map((d) => (
                <tr key={d} className="bg-[#f8fcf9]">
                  <td className="py-3 px-3 font-bold text-[#14532d] bg-[#e3f4e8] border-r border-[#cbe4d2]">
                    {d}
                  </td>
                  {PERIODS.map((p) => {
                    const slot = routineFiltered.find((r) => r.day === d && r.period === p);
                    return (
                      <td
                        key={p}
                        onClick={() => {
                          if (!canEditRoutine) return;
                          setDay(d);
                          setPeriod(String(p));
                          if (slot) {
                            setSubjectCode(slot.subjectCode);
                            setSubjectName(slot.subjectName);
                            setTeacherName(slot.teacherName);
                            setRoom(slot.room);
                          }
                        }}
                        className={`py-2 px-2 border-r border-[#e0efe5] last:border-r-0 text-center ${
                          canEditRoutine ? 'cursor-pointer hover:bg-[#dff2e4]' : ''
                        }`}
                      >
                        {slot ? (
                          <div>
                            <div className="font-mono font-bold text-[#14532d]">
                              {slot.subjectCode}
                            </div>
                            <div className="text-[#1f3d2b] leading-tight">
                              {slot.subjectName}
                            </div>
                            <div className="text-[11px] text-[#4b785b] font-mono">
                              {slot.room}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#9cc2a8]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Default 4.1: Dynamic Subject Registry
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#14532d]">4.1 Dynamic Subject Registry</h2>
        <p className="text-sm text-[#356847]">
          Configure course subjects with maximum marks, passing thresholds, and assigned faculty.
        </p>
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

      {isAdmin && (
        <form
          onSubmit={handleAddSubject}
          className="bg-white border border-[#c5e2CE] rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
        >
          <div>
            <label htmlFor="sub-code" className="block text-xs font-semibold text-[#14532d] mb-1">
              Code
            </label>
            <input
              id="sub-code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CS507"
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono uppercase"
            />
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="sub-name" className="block text-xs font-semibold text-[#14532d] mb-1">
              Subject Name
            </label>
            <input
              id="sub-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cloud Computing"
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
            />
          </div>
          <div>
            <label htmlFor="sub-max" className="block text-xs font-semibold text-[#14532d] mb-1">
              Max / Pass
            </label>
            <div className="flex gap-1.5">
              <input
                id="sub-max"
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                aria-label="Maximum marks"
                className="w-1/2 h-9 px-2 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
              />
              <input
                type="number"
                value={passingMarks}
                onChange={(e) => setPassingMarks(e.target.value)}
                aria-label="Passing marks"
                className="w-1/2 h-9 px-2 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
              />
            </div>
          </div>
          <div>
            <label htmlFor="sub-teacher" className="block text-xs font-semibold text-[#14532d] mb-1">
              Faculty
            </label>
            <select
              id="sub-teacher"
              value={effectiveTeacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full h-9 px-2 text-sm bg-white border border-[#a9d5b6] rounded"
            >
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-9 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>
      )}

      <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
              <th className="py-2.5 px-4">Code</th>
              <th className="py-2.5 px-4">Subject Name</th>
              <th className="py-2.5 px-4">Course / Sem</th>
              <th className="py-2.5 px-4 text-right">Max Marks</th>
              <th className="py-2.5 px-4 text-right">Passing Marks</th>
              <th className="py-2.5 px-4">Faculty ID</th>
              {isAdmin && <th className="py-2.5 px-4 text-right">Remove</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f3ea]">
            {data.subjects.map((sub) => (
              <tr key={sub.id} className="hover:bg-[#f6fbf7]">
                <td className="py-2.5 px-4 font-mono font-bold text-xs text-[#14532d]">
                  {sub.code}
                </td>
                <td className="py-2.5 px-4 font-semibold">{sub.name}</td>
                <td className="py-2.5 px-4 text-xs text-[#356847]">
                  {sub.course} · Sem {sub.semester}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                  {sub.maxMarks}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                  {sub.passingMarks}
                </td>
                <td className="py-2.5 px-4 font-mono text-xs text-[#356847]">
                  {sub.teacherId}
                </td>
                {isAdmin && (
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteSubject(sub.id)}
                      aria-label={`Delete subject ${sub.code}`}
                      className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
