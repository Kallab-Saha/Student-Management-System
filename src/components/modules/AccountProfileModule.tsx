import React, { useEffect, useState } from 'react';
import { Lock, Upload, User } from 'lucide-react';
import type { PortalBootstrapData } from '../../types/portal';
import { changeOwnPassword, updateStudent } from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
}

export function AccountProfileModule({ data, subPart, onRefresh }: Props) {
  const { user } = data;
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [projectTitle, setProjectTitle] = useState(user.projectTitle || '');
  const [projectDetails, setProjectDetails] = useState(user.projectDetails || '');
  const [photoPreview, setPhotoPreview] = useState(user.photoUrl || '');

  useEffect(() => {
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setProjectTitle(user.projectTitle || '');
    setProjectDetails(user.projectDetails || '');
    setPhotoPreview(user.photoUrl || '');
  }, [user.id, user.email, user.phone, user.projectTitle, user.projectDetails, user.photoUrl]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Please select a .jpg or .png passport photograph.');
      return;
    }
    if (file.size > 120 * 1024) {
      setError('Passport photo file size must be under 120KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveStudentProfile(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await updateStudent(user.id, {
        email,
        phone,
        photoUrl: photoPreview,
        projectTitle,
        projectDetails,
      });
      setMsg('Personal information and photo updated.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMsg('Password updated successfully.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    }
  }

  if (subPart === '9.2') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#14532d]">9.2 Security &amp; Set My Password</h2>
          <p className="text-sm text-[#356847]">
            Manage account login credentials.
          </p>
        </div>

        {user.role === 'teacher' ? (
          <div className="bg-[#f4fbf6] border border-[#9fd0ad] rounded-lg p-5 flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" />
            <div className="text-sm text-[#14532d]">
              <div className="font-bold">Administrator-Managed Faculty Credentials</div>
              <p className="text-xs text-[#274e36] mt-1">
                Per institutional policy, only the Administrator (<span className="font-mono font-bold">Kallab</span>) can modify teacher login IDs and passwords. Please contact the Administrator if you need a credential update.
              </p>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleChangePassword}
            className="bg-white border border-[#c5e2CE] rounded-lg p-5 max-w-md space-y-4"
          >
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

            <div>
              <label htmlFor="pw-curr" className="block text-xs font-semibold text-[#14532d] mb-1">
                Current Password
              </label>
              <input
                id="pw-curr"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
              />
            </div>
            <div>
              <label htmlFor="pw-new" className="block text-xs font-semibold text-[#14532d] mb-1">
                New Password
              </label>
              <input
                id="pw-new"
                type="password"
                required
                minLength={4}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
              />
            </div>
            <div>
              <label htmlFor="pw-conf" className="block text-xs font-semibold text-[#14532d] mb-1">
                Confirm New Password
              </label>
              <input
                id="pw-conf"
                type="password"
                required
                minLength={4}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded cursor-pointer"
            >
              Update Password
            </button>
          </form>
        )}
      </div>
    );
  }

  // 9.1: My Profile & Passport Photo
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#14532d]">
          9.1 My Profile, Passport Photo &amp; Project Details
        </h2>
        <p className="text-sm text-[#356847]">
          View your institutional identity and update personal contact details.
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

      <div className="bg-white border border-[#c5e2CE] rounded-lg p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col items-center text-center gap-3 border-b md:border-b-0 md:border-r border-[#e6f3ea] pb-4 md:pb-0 md:pr-4">
          <div className="w-28 h-32 rounded border-2 border-[#166534] bg-[#f4fbf6] overflow-hidden flex items-center justify-center">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt={`${user.name} passport portrait`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-[#6ba37d]" />
            )}
          </div>
          <div className="text-sm font-bold text-[#14532d]">{user.name}</div>
          <div className="text-xs font-mono text-[#356847]">ID: {user.id}</div>
          {user.role === 'student' && (
            <label className="px-3 py-1.5 bg-[#e6f5ea] hover:bg-[#d6eedc] border border-[#9fd0ad] rounded text-xs font-semibold text-[#14532d] inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Passport Photo</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={handlePhotoFile}
                className="sr-only"
              />
            </label>
          )}
        </div>

        <div className="md:col-span-2">
          {user.role === 'student' ? (
            <form onSubmit={handleSaveStudentProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#f4fbf6] border border-[#d6ecdc] rounded p-3">
                <div>
                  <span className="text-[#4b785b]">Course:</span>{' '}
                  <span className="font-semibold text-[#14532d]">{user.course}</span>
                </div>
                <div>
                  <span className="text-[#4b785b]">Semester / Sec / Roll:</span>{' '}
                  <span className="font-mono font-semibold text-[#14532d]">
                    Sem {user.semester} · Sec {user.section} · Roll {user.rollNo}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="prof-email" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Email Address
                  </label>
                  <input
                    id="prof-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                  />
                </div>
                <div>
                  <label htmlFor="prof-phone" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Phone Number
                  </label>
                  <input
                    id="prof-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prof-proj-title" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Final Year Project Title
                </label>
                <input
                  id="prof-proj-title"
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>

              <div>
                <label htmlFor="prof-proj-det" className="block text-xs font-semibold text-[#14532d] mb-1">
                  Project Details / Abstract
                </label>
                <textarea
                  id="prof-proj-det"
                  rows={2}
                  value={projectDetails}
                  onChange={(e) => setProjectDetails(e.target.value)}
                  className="w-full p-2.5 text-sm bg-white border border-[#a9d5b6] rounded"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded cursor-pointer"
              >
                Save My Information
              </button>
            </form>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 bg-[#f4fbf6] border border-[#d6ecdc] rounded p-4">
                <div>
                  <div className="text-xs text-[#4b785b]">Role</div>
                  <div className="font-bold text-[#14532d] capitalize">{user.role}</div>
                </div>
                <div>
                  <div className="text-xs text-[#4b785b]">Department</div>
                  <div className="font-semibold text-[#14532d]">{user.department || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-[#4b785b]">Designation</div>
                  <div className="font-semibold text-[#14532d]">{user.designation || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-[#4b785b]">Email</div>
                  <div className="font-semibold text-[#14532d]">{user.email || '—'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
