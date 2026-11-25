import React, { useState } from 'react';
import { ExternalLink, FileCheck2, Send, Trash2 } from 'lucide-react';
import type { PortalBootstrapData } from '../../types/portal';
import { hasTeacherPermission } from '../../utils/academicRules';
import { createAssignment, deleteAssignment } from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
}

export function AssignmentsModule({ data, subPart, onRefresh }: Props) {
  const canManage =
    data.user.role === 'admin' ||
    (data.user.role === 'teacher' &&
      hasTeacherPermission(data.user.permissions, 'assignments'));

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id || '');
  const [instructions, setInstructions] = useState('');
  const [onlineDeadline, setOnlineDeadline] = useState('2026-12-05');
  const [googleClassroomUrl, setGoogleClassroomUrl] = useState('https://classroom.google.com');
  const [offlineDeadline, setOfflineDeadline] = useState('2026-12-08');
  const [offlineInstructions, setOfflineInstructions] = useState(
    'Submit printed/handwritten copy to respective subject faculty.'
  );
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const effectiveSubjectId = data.subjects.some((s) => s.id === subjectId)
    ? subjectId
    : data.subjects[0]?.id || '';

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveSubjectId) {
      setError('Please register at least one subject before publishing an assignment.');
      return;
    }
    setError('');
    setMsg('');
    setSubmitting(true);
    try {
      await createAssignment({
        title,
        subjectId: effectiveSubjectId,
        instructions,
        onlineDeadline,
        googleClassroomUrl,
        offlineDeadline,
        offlineInstructions,
      });
      setTitle('');
      setInstructions('');
      setMsg('Assignment published with online & offline submission details.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish assignment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError('');
    setMsg('');
    try {
      await deleteAssignment(id);
      setMsg('Assignment removed.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assignment');
    }
  }

  if (subPart === '6.1' && canManage) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            6.1 Publish Dual-Mode Assignment
          </h2>
          <p className="text-sm text-[#356847]">
            Provide both an Online Submission deadline (with Google Classroom link) and an Offline physical submission deadline.
          </p>
        </div>

        {msg && (
          <div className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3 py-2 rounded">
            {msg}
          </div>
        )}
        {error && (
          <div className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <form
          onSubmit={handlePublish}
          className="bg-white border border-[#c5e2CE] rounded-lg p-5 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="asg-title" className="block text-xs font-semibold text-[#14532d] mb-1">
                Assignment Title
              </label>
              <input
                id="asg-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Java Practical File"
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
              />
            </div>
            <div>
              <label htmlFor="asg-sub" className="block text-xs font-semibold text-[#14532d] mb-1">
                Subject
              </label>
              <select
                id="asg-sub"
                value={effectiveSubjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
              >
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="asg-inst" className="block text-xs font-semibold text-[#14532d] mb-1">
              General Instructions
            </label>
            <textarea
              id="asg-inst"
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Describe topics, formatting, or experiment numbers..."
              className="w-full p-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#e6f3ea]">
            <div className="space-y-3 bg-[#f4fbf6] border border-[#cde6d4] rounded p-3.5">
              <div className="text-xs font-bold text-[#14532d]">
                A. Online Submission (Google Classroom)
              </div>
              <div>
                <label htmlFor="asg-on-date" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Online Submission Deadline
                </label>
                <input
                  id="asg-on-date"
                  type="date"
                  value={onlineDeadline}
                  onChange={(e) => setOnlineDeadline(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="asg-gc-url" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Google Classroom Link
                </label>
                <input
                  id="asg-gc-url"
                  type="url"
                  value={googleClassroomUrl}
                  onChange={(e) => setGoogleClassroomUrl(e.target.value)}
                  placeholder="https://classroom.google.com/..."
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                />
              </div>
            </div>

            <div className="space-y-3 bg-[#f4fbf6] border border-[#cde6d4] rounded p-3.5">
              <div className="text-xs font-bold text-[#14532d]">
                B. Offline Submission (Physical Copy)
              </div>
              <div>
                <label htmlFor="asg-off-date" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Offline Submission Deadline
                </label>
                <input
                  id="asg-off-date"
                  type="date"
                  value={offlineDeadline}
                  onChange={(e) => setOfflineDeadline(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="asg-off-inst" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Department / Room Instructions
                </label>
                <input
                  id="asg-off-inst"
                  type="text"
                  value={offlineInstructions}
                  onChange={(e) => setOfflineInstructions(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded inline-flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Publishing...' : 'Send Assignment to Portal'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (subPart === '6.3') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            6.3 Offline Submission Schedule &amp; Instructions
          </h2>
          <p className="text-sm text-[#356847]">
            Printed or handwritten submission deadlines and physical department drop-off locations.
          </p>
        </div>
        <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
                <th className="py-2.5 px-4">Assignment</th>
                <th className="py-2.5 px-4">Subject</th>
                <th className="py-2.5 px-4">Offline Deadline</th>
                <th className="py-2.5 px-4">Submission Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6f3ea]">
              {data.assignments.map((asg) => (
                <tr key={asg.id} className="hover:bg-[#f6fbf7]">
                  <td className="py-2.5 px-4 font-semibold">{asg.title}</td>
                  <td className="py-2.5 px-4 text-xs text-[#356847]">{asg.subjectName}</td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-xs font-bold text-[#14532d]">
                    {asg.offlineDeadline || '—'}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-[#274e36]">
                    {asg.offlineInstructions || 'Submit physical copy to department.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 6.2: Active Assignments & Deadlines
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#14532d]">
          6.2 Active Assignments (Online &amp; Offline Deadlines)
        </h2>
        <p className="text-sm text-[#356847]">
          Review assignment instructions, Google Classroom submission links, and physical copy deadlines.
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

      {data.assignments.length === 0 ? (
        <div className="bg-white border border-[#c5e2CE] rounded-lg p-8 text-center text-sm text-[#4a7459]">
          No active assignments published yet.
        </div>
      ) : (
        <div className="space-y-4">
          {data.assignments.map((asg) => (
            <div
              key={asg.id}
              className="bg-white border border-[#c5e2CE] rounded-lg p-5 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-[#356847] font-mono">
                    {asg.subjectName} · Published {asg.createdAt} by {asg.createdBy}
                  </div>
                  <h3 className="text-base font-bold text-[#14532d] mt-0.5 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-[#166534] shrink-0" />
                    <span>{asg.title}</span>
                  </h3>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDelete(asg.id)}
                    aria-label={`Delete assignment ${asg.title}`}
                    className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {asg.instructions && (
                <p className="text-sm text-[#274e36]">{asg.instructions}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#e6f3ea] text-xs">
                <div className="bg-[#f4fbf6] border border-[#d6ecdc] rounded p-3 space-y-1.5">
                  <div className="font-bold text-[#14532d]">
                    Online Submission · Due{' '}
                    <span className="font-mono tabular-nums">
                      {asg.onlineDeadline || 'N/A'}
                    </span>
                  </div>
                  {asg.googleClassroomUrl ? (
                    <a
                      href={asg.googleClassroomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[#166534] hover:underline"
                    >
                      <span>Open Google Classroom</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-[#4b785b]">No external link provided</span>
                  )}
                </div>

                <div className="bg-[#f4fbf6] border border-[#d6ecdc] rounded p-3 space-y-1.5">
                  <div className="font-bold text-[#14532d]">
                    Offline Submission · Due{' '}
                    <span className="font-mono tabular-nums">
                      {asg.offlineDeadline || 'N/A'}
                    </span>
                  </div>
                  <p className="text-[#274e36]">
                    {asg.offlineInstructions || 'Submit physical copy to faculty.'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
