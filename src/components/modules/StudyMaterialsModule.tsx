import React, { useState } from 'react';
import { ExternalLink, FileText, Trash2 } from 'lucide-react';
import type { PortalBootstrapData } from '../../types/portal';
import { hasTeacherPermission } from '../../utils/academicRules';
import { createMaterial, deleteMaterial } from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
}

export function StudyMaterialsModule({ data, subPart, onRefresh }: Props) {
  const isAdmin = data.user.role === 'admin';
  const canManageMaterials =
    isAdmin ||
    (data.user.role === 'teacher' &&
      hasTeacherPermission(data.user.permissions, 'materials'));

  const [matTitle, setMatTitle] = useState('');
  const [matSubjectId, setMatSubjectId] = useState(data.subjects[0]?.id || '');
  const [matType, setMatType] = useState<'PDF' | 'Notes' | 'Slides'>('PDF');
  const [matUrl, setMatUrl] = useState('https://ocw.mit.edu');
  const [matDesc, setMatDesc] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const effectiveSubjectId = data.subjects.some((s) => s.id === matSubjectId)
    ? matSubjectId
    : data.subjects[0]?.id || '';

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveSubjectId) {
      setError('Register at least one subject before publishing study materials.');
      return;
    }
    setError('');
    setMsg('');
    try {
      await createMaterial({
        title: matTitle,
        subjectId: effectiveSubjectId,
        type: matType,
        resourceUrl: matUrl,
        description: matDesc,
      });
      setMatTitle('');
      setMatDesc('');
      setMsg('Study material published successfully.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish study material');
    }
  }

  async function handleDeleteMaterial(id: string) {
    setError('');
    setMsg('');
    try {
      await deleteMaterial(id);
      setMsg('Study material deleted.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete study material');
    }
  }

  const visibleMaterials =
    filterSubject === 'all'
      ? data.materials
      : data.materials.filter((m) => m.subjectId === filterSubject);

  if (subPart === '8.2' && canManageMaterials) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            8.2 Publish Study Material
          </h2>
          <p className="text-sm text-[#356847]">
            Upload lecture notes, course PDFs, and presentation links for students.
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
          onSubmit={handleAddMaterial}
          className="bg-white border border-[#c5e2CE] rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
        >
          <div className="lg:col-span-2">
            <label htmlFor="mat-title" className="block text-xs font-semibold text-[#14532d] mb-1">
              Material Title
            </label>
            <input
              id="mat-title"
              type="text"
              required
              value={matTitle}
              onChange={(e) => setMatTitle(e.target.value)}
              placeholder="e.g. Unit 4 Graph Algorithms Notes"
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
            />
          </div>
          <div>
            <label htmlFor="mat-sub" className="block text-xs font-semibold text-[#14532d] mb-1">
              Subject
            </label>
            <select
              id="mat-sub"
              value={effectiveSubjectId}
              onChange={(e) => setMatSubjectId(e.target.value)}
              className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
            >
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mat-type" className="block text-xs font-semibold text-[#14532d] mb-1">
              Format
            </label>
            <select
              id="mat-type"
              value={matType}
              onChange={(e) => setMatType(e.target.value as 'PDF' | 'Notes' | 'Slides')}
              className="w-full h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
            >
              <option value="PDF">PDF</option>
              <option value="Notes">Notes</option>
              <option value="Slides">Slides</option>
            </select>
          </div>
          <button
            type="submit"
            className="h-9 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded cursor-pointer"
          >
            Publish Resource
          </button>
          <div className="lg:col-span-2">
            <label htmlFor="mat-url" className="block text-xs font-semibold text-[#14532d] mb-1">
              Resource Link (http/https)
            </label>
            <input
              id="mat-url"
              type="url"
              value={matUrl}
              onChange={(e) => setMatUrl(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
            />
          </div>
          <div className="lg:col-span-3">
            <label htmlFor="mat-desc" className="block text-xs font-semibold text-[#14532d] mb-1">
              Description
            </label>
            <input
              id="mat-desc"
              type="text"
              value={matDesc}
              onChange={(e) => setMatDesc(e.target.value)}
              placeholder="Short summary for students..."
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
            />
          </div>
        </form>
      </div>
    );
  }

  // 8.1 Study Materials Directory
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            8.1 Course Study Materials (PDF &amp; Lecture Notes)
          </h2>
          <p className="text-sm text-[#356847]">
            Subject-wise lecture notes, slides, and reference documents provided by faculty.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="mat-filter" className="text-xs font-semibold text-[#14532d]">
            Filter Subject:
          </label>
          <select
            id="mat-filter"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="h-9 px-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
          >
            <option value="all">All Subjects</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleMaterials.length === 0 ? (
          <div className="md:col-span-2 bg-white border border-[#c5e2CE] rounded-lg p-6 text-center text-sm text-[#356847]">
            No study materials available for this selection.
          </div>
        ) : (
          visibleMaterials.map((mat) => (
            <div
              key={mat.id}
              className="bg-white border border-[#c5e2CE] rounded-lg p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-mono text-[#356847]">
                    {mat.subjectName} · {mat.type} · {mat.uploadedAt}
                  </span>
                  {canManageMaterials && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMaterial(mat.id)}
                      aria-label={`Delete material ${mat.title}`}
                      className="p-1 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <h3 className="text-sm font-bold text-[#14532d] mt-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#166534] shrink-0" />
                  <span>{mat.title}</span>
                </h3>
                {mat.description && (
                  <p className="text-xs text-[#274e36] mt-1.5">{mat.description}</p>
                )}
              </div>
              {mat.resourceUrl && (
                <a
                  href={mat.resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#166534] hover:underline"
                >
                  <span>Open Resource</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
