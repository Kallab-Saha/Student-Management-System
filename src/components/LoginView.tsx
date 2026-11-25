import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { PortalBootstrapData, UserRole } from '../types/portal';
import { loginRequest, submitStudentApplication } from '../api/client';

interface LoginViewProps {
  onLoginSuccess: (data: PortalBootstrapData) => void;
}

function generateCaptchaCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function formatPortalClock(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `Date: ${dd}-${mm}-${yy} · Time: ${hh}:${min}:${ss}`;
}

function PortalClock() {
  const [clock, setClock] = useState(() => formatPortalClock(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(formatPortalClock(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-xs font-mono tabular-nums text-[#1e4d30] whitespace-nowrap">
      {clock}
    </div>
  );
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptchaCode());
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openSection, setOpenSection] = useState<string>('hierarchy');

  // ID & Password Request Modal state (cleanly separated from main Login View)
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [appCourse, setAppCourse] = useState('B.Tech, C.S.E (I.O.T.)');
  const [appSemester, setAppSemester] = useState('5');
  const [appSection, setAppSection] = useState('C');
  const [appRollNo, setAppRollNo] = useState('');
  const [appEmail, setAppEmail] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [appNotes, setAppNotes] = useState('');
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appSuccess, setAppSuccess] = useState('');
  const [appError, setAppError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!userId.trim() || !password.trim()) {
      setError('Please enter your User ID and Password.');
      return;
    }

    if (captchaInput.trim().toUpperCase() !== captchaCode) {
      setError('Verification code does not match. Please try again.');
      setCaptchaCode(generateCaptchaCode());
      setCaptchaInput('');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginRequest(userId.trim(), password, role);
      onLoginSuccess(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setCaptchaCode(generateCaptchaCode());
      setCaptchaInput('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplicationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAppError('');
    setAppSuccess('');
    setAppSubmitting(true);
    try {
      const res = await submitStudentApplication({
        name: appName.trim(),
        course: appCourse.trim(),
        semester: Number(appSemester) || 1,
        section: appSection.trim() || 'A',
        rollNo: appRollNo.trim(),
        email: appEmail.trim(),
        phone: appPhone.trim(),
        requestedPassword: appPassword,
        notes: appNotes.trim(),
      });
      setAppSuccess(
        `Request submitted (Reference: ${res.applicationId}). Your request is routed strictly to the Administrator for ID & password issuance.`
      );
      setAppName('');
      setAppRollNo('');
      setAppEmail('');
      setAppPhone('');
      setAppPassword('');
      setAppNotes('');
    } catch (err) {
      setAppError(
        err instanceof Error ? err.message : 'Failed to submit ID & password request'
      );
    } finally {
      setAppSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef8f0] text-[#0f291a] flex flex-col">
      {/* Institutional Banner */}
      <header className="bg-white border-b border-[#bfe0c8]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-lg bg-[#e6f5ea] border border-[#b5dcc0] flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 48 48"
              className="w-9 h-9 text-[#166534]"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M24 5L6 13v4l18 8 18-8v-4L24 5z"
                fill="currentColor"
                opacity="0.18"
              />
              <path
                d="M24 5L6 13l18 8 18-8-18-8zM10 19.5V31c0 4.5 6.3 8 14 8s14-3.5 14-8V19.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M24 27v12M40 16v11"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#14532d]">
              INSTITUTE OF ENGINEERING &amp; MANAGEMENT
            </h1>
            <p className="text-xs sm:text-sm text-[#356847] mt-0.5">
              Academic &amp; Student Management ERP Portal · Action Area III, New Campus Road, Sector V
            </p>
          </div>
        </div>
      </header>

      {/* Horizontal Login Strip */}
      <section
        aria-label="Portal Sign In"
        className="bg-[#dff2e4] border-b border-[#b7dec2]"
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3">
          <form
            onSubmit={handleSubmit}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="login-user-id"
                  className="text-xs font-semibold text-[#14532d] whitespace-nowrap"
                >
                  User ID
                </label>
                <input
                  id="login-user-id"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter ID"
                  autoComplete="username"
                  className="h-9 w-40 sm:w-44 px-2.5 text-sm bg-white border border-[#9fd0ad] rounded focus:outline-none focus:ring-2 focus:ring-[#166534] font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="login-password"
                  className="text-xs font-semibold text-[#14532d] whitespace-nowrap"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                  className="h-9 w-32 sm:w-36 px-2.5 text-sm bg-white border border-[#9fd0ad] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              {/* Verification Code */}
              <div className="flex items-center gap-1.5">
                <div
                  className="h-9 px-3 rounded bg-gradient-to-r from-[#14532d] to-[#16a34a] text-white font-mono text-sm font-bold tracking-[0.22em] select-none flex items-center justify-center shadow-inner"
                  aria-label={`Security code ${captchaCode}`}
                  data-testid="captcha-display"
                >
                  {captchaCode}
                </div>
                <button
                  type="button"
                  onClick={() => setCaptchaCode(generateCaptchaCode())}
                  aria-label="Refresh verification code"
                  className="h-9 w-9 flex items-center justify-center rounded bg-white border border-[#9fd0ad] text-[#14532d] hover:bg-[#edf9f0] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <input
                  id="login-captcha"
                  type="text"
                  aria-label="Enter verification code"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  placeholder="Code"
                  maxLength={6}
                  className="h-9 w-20 px-2 text-sm bg-white border border-[#9fd0ad] rounded uppercase font-mono focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="login-role"
                  className="text-xs font-semibold text-[#14532d] whitespace-nowrap"
                >
                  Login As
                </label>
                <select
                  id="login-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="h-9 px-2.5 text-sm bg-white border border-[#9fd0ad] rounded font-medium text-[#0f291a] focus:outline-none focus:ring-2 focus:ring-[#166534]"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="h-9 px-5 bg-[#166534] hover:bg-[#14532d] disabled:opacity-60 text-white text-sm font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {submitting ? 'Signing in...' : 'Go'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAppError('');
                  setAppSuccess('');
                  setRequestModalOpen(true);
                }}
                className="h-9 px-3.5 bg-white hover:bg-[#eef8f0] border border-[#166534] text-[#14532d] text-xs font-semibold rounded inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Apply for ID &amp; Password</span>
              </button>
            </div>

            <PortalClock />
          </form>

          {error && (
            <div
              role="alert"
              className="mt-2.5 px-3 py-2 rounded bg-red-50 border border-red-200 text-xs font-medium text-red-800"
            >
              {error}
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area: Formal Academic ERP Overview & Hierarchy */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Expandable Portal Modules Overview */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-white border border-[#c5e2CE] rounded-lg p-5 flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-[#14532d]">
                Portal Modules &amp; Role Governance
              </h2>
              <p className="text-sm text-[#356847] mt-1 leading-relaxed">
                Every module in this Academic ERP opens into dedicated sub-parts governed by institutional role authorization.
              </p>

              <div className="mt-4 divide-y divide-[#e3f1e7] border border-[#d6ecdc] rounded-md overflow-hidden">
                {[
                  {
                    id: 'hierarchy',
                    title: '1. Administration & Governance',
                    subparts: [
                      'Sole Administrator controls all system settings, student IDs, and faculty credentials.',
                      'Teachers receive default access to Attendance, Assignments, Routine, and Marks.',
                      'Additional modules (Study Materials, Directory, Calendar) are authorized by Admin.',
                    ],
                  },
                  {
                    id: 'students',
                    title: '2. Student Enrollment & ID Issuance',
                    subparts: [
                      'Administrator enrolls students and issues unique 14-digit institutional Student IDs.',
                      'New students can request an ID & Password via the portal modal for Admin review.',
                      'Students sign in with their issued ID to access routines, marks, and attendance.',
                    ],
                  },
                  {
                    id: 'academics',
                    title: '3. Attendance, Assignments & Marksheets',
                    subparts: [
                      'Subject-wise attendance register with configurable threshold alerts.',
                      'Dual-mode assignments supporting online submission links and offline dates.',
                      'Automated semester pass and backlog evaluation across registered subjects.',
                    ],
                  },
                ].map((item) => {
                  const isOpen = openSection === item.id;
                  return (
                    <div key={item.id} className="bg-white">
                      <button
                        type="button"
                        onClick={() => setOpenSection(isOpen ? '' : item.id)}
                        aria-expanded={isOpen}
                        className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-semibold text-[#14532d] hover:bg-[#f2faf4] transition-colors cursor-pointer"
                      >
                        <span>{item.title}</span>
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-[#166534] shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[#166534] shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <ul className="px-4 pb-3 pt-1 space-y-1.5 bg-[#f7fcf8] text-xs text-[#274e36]">
                          {item.subparts.map((line, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="font-mono text-[#166534] font-semibold">
                                •
                              </span>
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#e3f1e7] flex flex-wrap items-center justify-between gap-2 text-xs text-[#356847]">
              <span>
                Select your role (<span className="font-semibold text-[#14532d]">Student</span>, <span className="font-semibold text-[#14532d]">Teacher</span>, or <span className="font-semibold text-[#14532d]">Administrator</span>) in the sign-in bar above.
              </span>
              <button
                type="button"
                onClick={() => {
                  setAppError('');
                  setAppSuccess('');
                  setRequestModalOpen(true);
                }}
                className="font-semibold text-[#166534] underline cursor-pointer whitespace-nowrap"
              >
                Request Student ID &amp; Password
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Academic ERP Architecture Diagram */}
        <div className="lg:col-span-7 bg-white border border-[#c5e2CE] rounded-lg p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#166534]">
              <ShieldCheck className="w-4 h-4" />
              <span>Role-Verified Institutional Resource Planning</span>
            </div>
            <h2 className="text-lg font-bold text-[#14532d] mt-1">
              Academic ERP Architecture
            </h2>
            <p className="text-sm text-[#274e36] mt-2 leading-relaxed">
              The Academic ERP portal unifies student enrollment records, subject-wise attendance registers, dual-mode assignments, weekly class timetables, semester marksheets, and course study materials within a formal role-controlled environment. Administrators oversee faculty credentials, module authorizations, and institutional ID issuance.
            </p>
          </div>

          <div className="bg-[#f4fbf6] border border-[#cde6d4] rounded-lg p-5">
            <svg
              viewBox="0 0 640 240"
              className="w-full h-auto max-h-60 mx-auto"
              role="img"
              aria-label="Institutional Hierarchy: Administrator at top, Authorized Faculty and Academic Resources in middle, Enrolled Students and Semester Results below"
            >
              <path
                d="M320 56 V88 M160 88 H480 M160 88 V112 M480 88 V112 M160 160 V184 M480 160 V184"
                stroke="#166534"
                strokeWidth="2"
                fill="none"
              />
              <rect x="210" y="12" width="220" height="44" rx="6" fill="#166534" />
              <text
                x="320"
                y="38"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="13"
                fontWeight="600"
              >
                University &amp; Sole Administrator
              </text>

              <rect
                x="55"
                y="112"
                width="210"
                height="48"
                rx="6"
                fill="#dff2e4"
                stroke="#166534"
                strokeWidth="1.5"
              />
              <text
                x="160"
                y="134"
                textAnchor="middle"
                fill="#14532d"
                fontSize="12.5"
                fontWeight="700"
              >
                Authorized Faculty
              </text>
              <text
                x="160"
                y="150"
                textAnchor="middle"
                fill="#274e36"
                fontSize="10.5"
              >
                Attendance · Assignments · Routine
              </text>

              <rect
                x="375"
                y="112"
                width="210"
                height="48"
                rx="6"
                fill="#dff2e4"
                stroke="#166534"
                strokeWidth="1.5"
              />
              <text
                x="480"
                y="134"
                textAnchor="middle"
                fill="#14532d"
                fontSize="12.5"
                fontWeight="700"
              >
                Academic Resources Hub
              </text>
              <text
                x="480"
                y="150"
                textAnchor="middle"
                fill="#274e36"
                fontSize="10.5"
              >
                Marks · Study PDFs · Schedules
              </text>

              <rect
                x="55"
                y="184"
                width="210"
                height="42"
                rx="6"
                fill="#ffffff"
                stroke="#86c59a"
                strokeWidth="1.5"
              />
              <text
                x="160"
                y="209"
                textAnchor="middle"
                fill="#14532d"
                fontSize="12"
                fontWeight="600"
              >
                Enrolled Students (Unique ID)
              </text>

              <rect
                x="375"
                y="184"
                width="210"
                height="42"
                rx="6"
                fill="#ffffff"
                stroke="#86c59a"
                strokeWidth="1.5"
              />
              <text
                x="480"
                y="209"
                textAnchor="middle"
                fill="#14532d"
                fontSize="12"
                fontWeight="600"
              >
                Timetables &amp; Semester Results
              </text>
            </svg>
          </div>

          <p className="text-xs text-[#356847] leading-relaxed">
            Students sign in with the unique institutional ID issued by the Administrator. Faculty members authenticate using Administrator-assigned credentials and manage academic workflows according to granted permissions.
          </p>
        </div>
      </main>

      {/* Modal Dialog for Student ID & Password Request */}
      {requestModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0f291a]/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="id-request-modal-title"
        >
          <div className="bg-white border border-[#9fd0ad] rounded-lg w-full max-w-2xl overflow-hidden shadow-lg">
            <div className="bg-[#dff2e4] border-b border-[#b7dec2] px-5 py-3.5 flex items-center justify-between">
              <div>
                <h2
                  id="id-request-modal-title"
                  className="text-base font-bold text-[#14532d]"
                >
                  Student ID &amp; Password Request
                </h2>
                <p className="text-xs text-[#356847]">
                  Submitted requests are reviewed exclusively in the Administrator&apos;s ID Generation section.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                aria-label="Close ID request modal"
                className="p-1.5 rounded bg-white border border-[#9fd0ad] text-[#14532d] hover:bg-[#eef8f0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              {appSuccess && (
                <div
                  role="status"
                  className="mb-4 px-3.5 py-2.5 rounded bg-[#dff2e4] border border-[#9fd0ad] text-xs font-medium text-[#14532d]"
                >
                  {appSuccess}
                </div>
              )}
              {appError && (
                <div
                  role="alert"
                  className="mb-4 px-3.5 py-2.5 rounded bg-red-50 border border-red-200 text-xs font-medium text-red-800"
                >
                  {appError}
                </div>
              )}

              <form
                onSubmit={handleApplicationSubmit}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
              >
                <div>
                  <label htmlFor="app-name" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Full Name *
                  </label>
                  <input
                    id="app-name"
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="e.g. Ananya Sen"
                    className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label htmlFor="app-email" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Email Address *
                  </label>
                  <input
                    id="app-email"
                    type="email"
                    required
                    value={appEmail}
                    onChange={(e) => setAppEmail(e.target.value)}
                    placeholder="student@institute.edu"
                    className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label htmlFor="app-phone" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Phone Number *
                  </label>
                  <input
                    id="app-phone"
                    type="tel"
                    required
                    value={appPhone}
                    onChange={(e) => setAppPhone(e.target.value)}
                    placeholder="+91 98300 00000"
                    className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label htmlFor="app-password" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Requested Password *
                  </label>
                  <input
                    id="app-password"
                    type="password"
                    required
                    minLength={4}
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label htmlFor="app-course" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Course / Program *
                  </label>
                  <input
                    id="app-course"
                    type="text"
                    required
                    value={appCourse}
                    onChange={(e) => setAppCourse(e.target.value)}
                    className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="app-sem" className="block text-xs font-semibold text-[#14532d] mb-1">
                      Sem *
                    </label>
                    <input
                      id="app-sem"
                      type="number"
                      min={1}
                      max={10}
                      required
                      value={appSemester}
                      onChange={(e) => setAppSemester(e.target.value)}
                      className="w-full h-9 px-2 text-sm bg-white border border-[#a9d5b6] rounded font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="app-sec" className="block text-xs font-semibold text-[#14532d] mb-1">
                      Sec
                    </label>
                    <input
                      id="app-sec"
                      type="text"
                      maxLength={4}
                      value={appSection}
                      onChange={(e) => setAppSection(e.target.value)}
                      className="w-full h-9 px-2 text-sm bg-white border border-[#a9d5b6] rounded uppercase"
                    />
                  </div>
                  <div>
                    <label htmlFor="app-roll" className="block text-xs font-semibold text-[#14532d] mb-1">
                      Roll No
                    </label>
                    <input
                      id="app-roll"
                      type="text"
                      value={appRollNo}
                      onChange={(e) => setAppRollNo(e.target.value)}
                      placeholder="22"
                      className="w-full h-9 px-2 text-sm bg-white border border-[#a9d5b6] rounded font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="app-notes" className="block text-xs font-semibold text-[#14532d] mb-1">
                    Admission Notes (Optional)
                  </label>
                  <input
                    id="app-notes"
                    type="text"
                    value={appNotes}
                    onChange={(e) => setAppNotes(e.target.value)}
                    placeholder="Batch year or admission reference"
                    className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-end gap-2.5 pt-2 border-t border-[#e3f1e7]">
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(false)}
                    className="h-9 px-4 bg-white border border-[#a9d5b6] hover:bg-[#f4fbf6] text-[#14532d] text-xs font-semibold rounded cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={appSubmitting}
                    className="h-9 px-5 bg-[#166534] hover:bg-[#14532d] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded cursor-pointer whitespace-nowrap"
                  >
                    {appSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
