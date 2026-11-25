import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import type {
  PortalBootstrapData,
  TeacherPermissionKey,
  TeacherRecord,
} from '../../types/portal';
import { ALL_TEACHER_PERMISSIONS } from '../../utils/academicRules';
import {
  addTeacher,
  deleteTeacher,
  updateTeacherCredentials,
  updateTeacherPermissions,
} from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
}

export function TeacherAccessModule({ data, subPart, onRefresh }: Props) {
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);
  const [editId, setEditId] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');

  // Add new teacher state
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newDept, setNewDept] = useState('C.S.E (I.O.T.)');
  const [newDesignation, setNewDesignation] = useState('Assistant Professor');
  const [newEmail, setNewEmail] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  if (data.user.role !== 'admin') {
    return (
      <div className="bg-white border border-[#c5e2CE] rounded-lg p-6 text-sm text-[#356847]">
        Only the Administrator can manage teacher credentials and module authorizations.
      </div>
    );
  }

  function startEdit(t: TeacherRecord) {
    setEditingTeacher(t);
    setEditId(t.id);
    setEditPassword(t.password || '');
    setEditName(t.name);
    setEditDept(t.department);
    setError('');
    setStatusMsg('');
  }

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTeacher) return;
    setError('');
    setStatusMsg('');
    if (editPassword.trim() && editPassword.trim().length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    try {
      await updateTeacherCredentials(editingTeacher.id, {
        newId: editId.trim(),
        newPassword: editPassword.trim() || undefined,
        name: editName.trim(),
        department: editDept.trim(),
      });
      setStatusMsg(`Updated credentials for ${editId.trim()}.`);
      setEditingTeacher(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update teacher credentials');
    }
  }

  async function handleAddTeacher(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    try {
      await addTeacher({
        id: newId.trim(),
        name: newName.trim(),
        password: newPass.trim(),
        department: newDept.trim(),
        designation: newDesignation.trim(),
        email: newEmail.trim(),
      });
      setStatusMsg(`Teacher account "${newId.trim()}" created with default permissions.`);
      setNewId('');
      setNewName('');
      setNewPass('');
      setNewEmail('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add teacher');
    }
  }

  async function handleTogglePermission(
    teacher: TeacherRecord,
    key: TeacherPermissionKey
  ) {
    setError('');
    setStatusMsg('');
    const updated = {
      ...teacher.permissions,
      [key]: !teacher.permissions[key],
    };
    try {
      await updateTeacherPermissions(teacher.id, updated);
      setStatusMsg(
        `${teacher.name}: "${key}" access ${updated[key] ? 'authorized' : 'revoked'}.`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update permissions');
    }
  }

  async function handleDeleteTeacher(id: string) {
    setError('');
    try {
      await deleteTeacher(id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove teacher');
    }
  }

  if (subPart === '3.2') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">
            3.2 Teacher Permission Authorizations
          </h2>
          <p className="text-sm text-[#356847]">
            Teachers receive Attendance, Assignments, and Class Routine by default. Toggle additional module permissions per teacher below.
          </p>
        </div>

        {statusMsg && (
          <div className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3 py-2 rounded">
            {statusMsg}
          </div>
        )}
        {error && (
          <div className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {data.teachers.map((teacher) => (
            <div
              key={teacher.id}
              className="bg-white border border-[#c5e2CE] rounded-lg p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#e6f3ea]">
                <div>
                  <h3 className="text-base font-bold text-[#14532d]">
                    {teacher.name}
                  </h3>
                  <p className="text-xs text-[#356847] font-mono">
                    Login ID: {teacher.id} · {teacher.department}
                  </p>
                </div>
                <div className="text-xs font-semibold text-[#166534] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {Object.values(teacher.permissions).filter(Boolean).length} /{' '}
                    {ALL_TEACHER_PERMISSIONS.length} Modules Authorized
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                {ALL_TEACHER_PERMISSIONS.map((perm) => {
                  const enabled = Boolean(teacher.permissions[perm.key]);
                  return (
                    <button
                      key={perm.key}
                      type="button"
                      onClick={() => handleTogglePermission(teacher, perm.key)}
                      aria-pressed={enabled}
                      aria-label={`Toggle ${perm.label} for ${teacher.id}`}
                      className={`text-left p-3 rounded-md border transition-colors cursor-pointer ${
                        enabled
                          ? 'bg-[#e6f5ea] border-[#166534] text-[#0f291a]'
                          : 'bg-[#f9fcfa] border-[#d8eadc] text-[#4a7459]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{perm.label}</span>
                        <span
                          className={`text-[11px] font-mono font-bold ${
                            enabled ? 'text-[#166534]' : 'text-[#73967f]'
                          }`}
                        >
                          {enabled ? 'ON' : 'OFF'}
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
          ))}
        </div>
      </div>
    );
  }

  // Default 3.1: Teacher Accounts (IDs & Passwords)
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#14532d]">
          3.1 Teacher Accounts (Login IDs &amp; Passwords)
        </h2>
        <p className="text-sm text-[#356847]">
          Default faculty accounts (Subham, Saikat, Shivam) and additional faculty. Only the Administrator can change teacher IDs and passwords.
        </p>
      </div>

      {statusMsg && (
        <div className="text-xs font-medium text-[#166534] bg-[#dff2e4] border border-[#9fd0ad] px-3 py-2 rounded">
          {statusMsg}
        </div>
      )}
      {error && (
        <div className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Edit Credentials Form when selected */}
      {editingTeacher && (
        <form
          onSubmit={handleSaveCredentials}
          className="bg-[#eff9f1] border border-[#166534] rounded-lg p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#14532d]">
              Edit Login Credentials for {editingTeacher.id}
            </h3>
            <button
              type="button"
              onClick={() => setEditingTeacher(null)}
              className="text-xs font-semibold text-[#356847] hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="edit-t-id" className="block text-xs font-semibold text-[#14532d] mb-1">
                Login ID
              </label>
              <input
                id="edit-t-id"
                type="text"
                required
                value={editId}
                onChange={(e) => setEditId(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border border-[#9fd0ad] rounded font-mono"
              />
            </div>
            <div>
              <label htmlFor="edit-t-pass" className="block text-xs font-semibold text-[#14532d] mb-1">
                Password (min 4 chars)
              </label>
              <input
                id="edit-t-pass"
                type="text"
                minLength={4}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full h-9 px-3 text-sm bg-white border border-[#9fd0ad] rounded font-mono"
              />
            </div>
            <div>
              <label htmlFor="edit-t-name" className="block text-xs font-semibold text-[#14532d] mb-1">
                Full Name
              </label>
              <input
                id="edit-t-name"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border border-[#9fd0ad] rounded"
              />
            </div>
            <div>
              <label htmlFor="edit-t-dept" className="block text-xs font-semibold text-[#14532d] mb-1">
                Department
              </label>
              <input
                id="edit-t-dept"
                type="text"
                value={editDept}
                onChange={(e) => setEditDept(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border border-[#9fd0ad] rounded"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded cursor-pointer"
            >
              Save Teacher Credentials
            </button>
          </div>
        </form>
      )}

      {/* Teacher Roster Table */}
      <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm min-w-[680px]">
          <thead>
            <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
              <th className="py-2.5 px-4">Teacher Login ID</th>
              <th className="py-2.5 px-4">Current Password</th>
              <th className="py-2.5 px-4">Faculty Name</th>
              <th className="py-2.5 px-4">Department</th>
              <th className="py-2.5 px-4">Designation</th>
              <th className="py-2.5 px-4 text-right">Manage Credentials</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f3ea]">
            {data.teachers.map((t) => (
              <tr key={t.id} className="hover:bg-[#f6fbf7]">
                <td className="py-2.5 px-4 font-mono font-bold text-xs text-[#14532d]">
                  {t.id}
                </td>
                <td className="py-2.5 px-4">
                  <span className="inline-block font-mono text-xs font-bold bg-[#eef8f0] border border-[#bfe0c8] text-[#14532d] px-2 py-0.5 rounded">
                    {t.password || '—'}
                  </span>
                </td>
                <td className="py-2.5 px-4 font-semibold">{t.name}</td>
                <td className="py-2.5 px-4 text-xs text-[#356847]">{t.department}</td>
                <td className="py-2.5 px-4 text-xs text-[#356847]">{t.designation}</td>
                <td className="py-2.5 px-4 text-right flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    className="px-2.5 py-1 text-xs font-semibold border border-[#9fd0ad] rounded hover:bg-[#dff2e4] text-[#14532d] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Edit ID / Pass</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTeacher(t.id)}
                    aria-label={`Remove teacher ${t.id}`}
                    className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add New Teacher Form */}
      <form
        onSubmit={handleAddTeacher}
        className="bg-white border border-[#c5e2CE] rounded-lg p-5 space-y-3"
      >
        <h3 className="text-sm font-bold text-[#14532d] flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#166534]" />
          <span>Add New Teacher Account</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="new-t-id" className="block text-xs font-semibold text-[#14532d] mb-1">
              Login ID
            </label>
            <input
              id="new-t-id"
              type="text"
              required
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="e.g. Anirban"
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="new-t-name" className="block text-xs font-semibold text-[#14532d] mb-1">
              Full Name
            </label>
            <input
              id="new-t-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Prof. Anirban Paul"
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
            />
          </div>
          <div>
            <label htmlFor="new-t-pass" className="block text-xs font-semibold text-[#14532d] mb-1">
              Initial Password
            </label>
            <input
              id="new-t-pass"
              type="text"
              required
              minLength={4}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="741169"
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="new-t-dept" className="block text-xs font-semibold text-[#14532d] mb-1">
              Department
            </label>
            <input
              id="new-t-dept"
              type="text"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
            />
          </div>
          <div>
            <label htmlFor="new-t-desig" className="block text-xs font-semibold text-[#14532d] mb-1">
              Designation
            </label>
            <input
              id="new-t-desig"
              type="text"
              value={newDesignation}
              onChange={(e) => setNewDesignation(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
            />
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="new-t-email" className="block text-xs font-semibold text-[#14532d] mb-1">
                Email
              </label>
              <input
                id="new-t-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="faculty@institute.edu"
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded cursor-pointer whitespace-nowrap"
            >
              Add Teacher
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
