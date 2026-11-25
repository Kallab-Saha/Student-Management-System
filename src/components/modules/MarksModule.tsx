import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { PortalBootstrapData, SubjectRecord } from '../../types/portal';
import { evaluateMarksheet, hasTeacherPermission } from '../../utils/academicRules';
import { saveMark } from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
}

export function MarksModule({ data, subPart, onRefresh }: Props) {
  const canEditMarks =
    data.user.role === 'admin' ||
    (data.user.role === 'teacher' &&
      hasTeacherPermission(data.user.permissions, 'marks'));

  const [selectedStudentId, setSelectedStudentId] = useState(
    data.user.role === 'student' ? data.user.id : data.students[0]?.id || ''
  );

  const effectiveStudentId =
    data.user.role === 'student'
      ? data.user.id
      : data.students.some((s) => s.id === selectedStudentId)
      ? selectedStudentId
      : data.students[0]?.id || '';

  // Active inline tapped cell: { studentId, subjectId }
  const [editingCell, setEditingCell] = useState<{
    studentId: string;
    subjectId: string;
  } | null>(null);
  const [cellDraft, setCellDraft] = useState('');
  const [savingCell, setSavingCell] = useState(false);

  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const markLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of data.marks) {
      map.set(`${m.studentId}:${m.subjectId}`, m.obtainedMarks);
    }
    return map;
  }, [data.marks]);

  function openCellEditor(studentId: string, subjectId: string, currentMark: number | null) {
    setError('');
    setMsg('');
    setEditingCell({ studentId, subjectId });
    setCellDraft(currentMark === null ? '' : String(currentMark));
  }

  async function commitCellScore(
    studentId: string,
    studentName: string,
    subject: SubjectRecord
  ) {
    setError('');
    setMsg('');
    const raw = cellDraft.trim();
    if (raw === '') {
      setError(`Enter a score between 0 and ${subject.maxMarks}.`);
      return;
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > subject.maxMarks) {
      setError(`Score for ${subject.code} must be between 0 and ${subject.maxMarks}.`);
      return;
    }

    setSavingCell(true);
    try {
      await saveMark({
        studentId,
        subjectId: subject.id,
        obtainedMarks: numeric,
      });
      setEditingCell(null);
      setCellDraft('');
      setMsg(`Updated ${subject.code} score for ${studentName} to ${numeric}/${subject.maxMarks}.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update marks');
    } finally {
      setSavingCell(false);
    }
  }

  if (subPart === '7.1') {
    if (!canEditMarks) {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#14532d]">
              7.1 Input &amp; Update Student Scores
            </h2>
            <p className="text-sm text-[#356847]">
              Subject-wise marks entry and score updates.
            </p>
          </div>
          <div className="bg-white border border-[#c5e2CE] rounded-lg p-5 text-sm text-[#274e36]">
            Marks Management editing access is currently restricted by the Administrator. Switch to{' '}
            <strong>7.2 Semester Marksheet</strong> to view published marks, or request access from
            Admin.
          </div>
        </div>
      );
    }

    const visibleSubjects =
      subjectFilter === 'ALL'
        ? data.subjects
        : data.subjects.filter((s) => s.id === subjectFilter);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#14532d]">
              7.1 Tap Marks Table (Input &amp; Update Scores)
            </h2>
            <p className="text-sm text-[#356847]">
              Tap any mark cell in the table below to enter or change a student&apos;s score directly, then press Enter or click Save.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="mk-filter" className="text-xs font-semibold text-[#14532d]">
              Filter Subject:
            </label>
            <select
              id="mk-filter"
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setEditingCell(null);
              }}
              className="h-9 px-2.5 text-xs bg-white border border-[#a9d5b6] rounded text-[#14532d]"
            >
              <option value="ALL">All Subjects ({data.subjects.length})</option>
              {data.subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} — {sub.name}
                </option>
              ))}
            </select>
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
                <th className="py-2.5 px-4 whitespace-nowrap">Student</th>
                {visibleSubjects.map((sub) => (
                  <th
                    key={sub.id}
                    className="py-2.5 px-3 text-center whitespace-nowrap"
                    title={`${sub.name} (Pass ${sub.passingMarks}/${sub.maxMarks})`}
                  >
                    <div className="font-mono font-bold">{sub.code}</div>
                    <div className="text-[10px] font-normal text-[#356847]">
                      /{sub.maxMarks}
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Total (%)</th>
                <th className="py-2.5 px-4 text-center whitespace-nowrap">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6f3ea]">
              {data.students.length === 0 ? (
                <tr>
                  <td colSpan={visibleSubjects.length + 3} className="py-8 text-center text-[#4a7459]">
                    No enrolled students found.
                  </td>
                </tr>
              ) : (
              data.students.map((student) => {
                const summary = evaluateMarksheet(data.marks, data.subjects, student.id);
                return (
                  <tr key={student.id} className="hover:bg-[#f6fbf7]">
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-[#0f291a]">{student.name}</div>
                      <div className="font-mono text-[11px] text-[#356847]">
                        {student.id} · Roll {student.rollNo}
                      </div>
                    </td>

                    {visibleSubjects.map((sub) => {
                      const val = markLookup.get(`${student.id}:${sub.id}`) ?? null;
                      const isEditing =
                        editingCell?.studentId === student.id &&
                        editingCell?.subjectId === sub.id;
                      const isPass = val !== null && val >= sub.passingMarks;
                      const isBacklog = val !== null && val < sub.passingMarks;

                      return (
                        <td key={sub.id} className="py-2 px-3 text-center whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                autoFocus
                                min={0}
                                max={sub.maxMarks}
                                aria-label={`Edit ${sub.code} mark for ${student.name}`}
                                value={cellDraft}
                                onChange={(e) => setCellDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitCellScore(student.id, student.name, sub);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                className="w-16 h-8 px-2 text-xs text-center bg-white border border-[#166534] rounded font-mono tabular-nums"
                              />
                              <button
                                type="button"
                                disabled={savingCell}
                                aria-label={`Save ${sub.code} mark for ${student.name}`}
                                onClick={() => commitCellScore(student.id, student.name, sub)}
                                className="h-8 w-7 bg-[#166534] hover:bg-[#14532d] text-white rounded inline-flex items-center justify-center cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Cancel mark edit"
                                onClick={() => setEditingCell(null)}
                                className="h-8 w-7 bg-white border border-[#cfe6d6] text-[#356847] rounded inline-flex items-center justify-center cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCellEditor(student.id, sub.id, val)}
                              aria-label={`Tap to edit ${sub.code} mark for ${student.name} (current ${val === null ? 'empty' : val})`}
                              data-testid={`mark-cell-${student.id}-${sub.code}`}
                              className={`min-w-[54px] h-8 px-2.5 rounded border font-mono text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                                isBacklog
                                  ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                                  : isPass
                                  ? 'bg-[#eef8f0] border-[#bfe0c8] text-[#14532d] hover:bg-[#dff2e4]'
                                  : 'bg-[#f8fcf9] border-dashed border-[#a9d5b6] text-[#4b785b] hover:bg-[#eef8f0]'
                              }`}
                            >
                              {val === null ? '—' : val}
                            </button>
                          )}
                        </td>
                      );
                    })}

                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap text-[#14532d]">
                      {summary.evaluatedCount === 0
                        ? '—'
                        : `${summary.totalObtained}/${summary.totalMaximum} (${summary.percentage}%)`}
                    </td>
                    <td className="py-2.5 px-4 text-center text-xs font-bold whitespace-nowrap">
                      {summary.semesterResult === 'FAIL' ? (
                        <span className="text-red-700">FAIL</span>
                      ) : summary.semesterResult === 'PASS' ? (
                        <span className="text-[#166534]">PASS</span>
                      ) : (
                        <span className="text-[#4b785b]">Pending</span>
                      )}
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

  if (subPart === '7.3') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            7.3 Passing Criteria &amp; Backlog Evaluation Rules
          </h2>
          <p className="text-sm text-[#356847]">
            Official institutional grading policy applied to semester marksheets.
          </p>
        </div>
        <div className="bg-white border border-[#c5e2CE] rounded-lg p-5 space-y-3 text-sm text-[#274e36]">
          <div className="font-bold text-[#14532d]">Subject &amp; Semester Evaluation Policy</div>
          <ul className="space-y-2 text-xs leading-relaxed">
            <li>• Each subject defines its own Maximum Marks and Passing Marks threshold.</li>
            <li>• Obtained marks equal to or above subject passing marks = <strong className="text-[#166534]">PASS</strong>; below passing marks = <strong className="text-red-700">BACKLOG</strong>.</li>
            <li>• Semester Result Rule: If total backlogs are <strong>50% or more</strong> of total subjects, semester result is <strong className="text-red-700">FAIL</strong>; if strictly below 50%, semester result is <strong className="text-[#166534]">PASS</strong>.</li>
          </ul>
        </div>
      </div>
    );
  }

  // 7.2: Semester Marksheet & Direct Tap-to-Update Cell
  const targetId = effectiveStudentId;
  const studentInfo = data.students.find((s) => s.id === targetId);
  const summary = evaluateMarksheet(data.marks, data.subjects, targetId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            7.2 University Marks System &amp; Semester Marksheet
          </h2>
          <p className="text-sm text-[#356847]">
            {canEditMarks
              ? 'Tap any Obtained mark in the table below to update it immediately.'
              : 'Marks below subject passing score are counted as backlogs. Semester fails if backlogs reach 50% of subjects.'}
          </p>
        </div>

        {data.user.role !== 'student' && data.students.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="ms-stu" className="text-xs font-semibold text-[#14532d]">
              Student:
            </label>
            <select
              id="ms-stu"
              value={targetId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                setEditingCell(null);
              }}
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

      {studentInfo && (
        <div className="bg-[#e8f5ec] border border-[#b7dec2] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-[#14532d]">{studentInfo.name}</span>
            <span className="mx-2 text-[#4b785b]">·</span>
            <span className="font-mono text-[#274e36]">ID: {studentInfo.id}</span>
            <span className="mx-2 text-[#4b785b]">·</span>
            <span className="text-[#274e36]">
              {studentInfo.course} (Sem {studentInfo.semester}, Sec {studentInfo.section})
            </span>
          </div>
          <div className="font-mono tabular-nums font-bold text-[#14532d]">
            Total: {summary.totalObtained} / {summary.totalMaximum} ({summary.percentage}%) · Backlogs: {summary.backlogCount} · Result:{' '}
            <span className={summary.semesterResult === 'FAIL' ? 'text-red-700' : 'text-[#166534]'}>
              {summary.semesterResult}
            </span>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
              <th className="py-2.5 px-4">Code</th>
              <th className="py-2.5 px-4">Subject Name</th>
              <th className="py-2.5 px-4 text-right">Max Marks</th>
              <th className="py-2.5 px-4 text-right">Pass Marks</th>
              <th className="py-2.5 px-4 text-right">
                Obtained {canEditMarks ? '(Tap to Edit)' : ''}
              </th>
              <th className="py-2.5 px-4">Subject Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f3ea]">
            {summary.rows.map((row) => {
              const isEditing =
                canEditMarks &&
                editingCell?.studentId === targetId &&
                editingCell?.subjectId === row.subject.id;
              return (
                <tr key={row.subject.id} className="hover:bg-[#f6fbf7]">
                  <td className="py-2.5 px-4 font-mono text-xs font-bold text-[#14532d]">
                    {row.subject.code}
                  </td>
                  <td className="py-2.5 px-4 font-medium">{row.subject.name}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {row.subject.maxMarks}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {row.subject.passingMarks}
                  </td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums font-bold">
                    {isEditing ? (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          autoFocus
                          min={0}
                          max={row.subject.maxMarks}
                          aria-label={`Edit obtained marks for ${row.subject.code}`}
                          value={cellDraft}
                          onChange={(e) => setCellDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitCellScore(
                                targetId,
                                studentInfo?.name || targetId,
                                row.subject
                              );
                            } else if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          className="w-16 h-8 px-2 text-xs text-center bg-white border border-[#166534] rounded font-mono"
                        />
                        <button
                          type="button"
                          disabled={savingCell}
                          aria-label={`Save obtained marks for ${row.subject.code}`}
                          onClick={() =>
                            commitCellScore(
                              targetId,
                              studentInfo?.name || targetId,
                              row.subject
                            )
                          }
                          className="h-8 px-2.5 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : canEditMarks ? (
                      <button
                        type="button"
                        onClick={() =>
                          openCellEditor(targetId, row.subject.id, row.obtainedMarks)
                        }
                        aria-label={`Tap to edit ${row.subject.code} mark`}
                        className="min-w-[52px] h-8 px-2.5 rounded border border-[#bfe0c8] bg-[#eef8f0] hover:bg-[#dff2e4] text-[#14532d] font-mono text-xs font-bold cursor-pointer"
                      >
                        {row.obtainedMarks === null ? '—' : row.obtainedMarks}
                      </button>
                    ) : row.obtainedMarks === null ? (
                      '—'
                    ) : (
                      row.obtainedMarks
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-xs font-bold">
                    {row.status === 'PASS' && <span className="text-[#166534]">PASS</span>}
                    {row.status === 'BACKLOG' && <span className="text-red-700">BACKLOG</span>}
                    {row.status === 'PENDING' && <span className="text-[#4b785b]">Pending</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
