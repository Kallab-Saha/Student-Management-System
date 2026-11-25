import React, { useState } from 'react';
import { Calendar, Plus, Trash2, User } from 'lucide-react';
import type { DayOfWeek, PortalBootstrapData } from '../../types/portal';
import {
  calculateAttendanceStats,
  evaluateMarksheet,
  hasTeacherPermission,
} from '../../utils/academicRules';
import { createCalendarEvent, deleteCalendarEvent } from '../../api/client';

interface Props {
  data: PortalBootstrapData;
  subPart: string;
  onRefresh: () => Promise<void>;
  onNavigateSubPart: (moduleKey: string, subPartKey: string) => void;
}

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function DashboardRoutineModule({
  data,
  subPart,
  onRefresh,
  onNavigateSubPart,
}: Props) {
  const { user } = data;
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-12-10');
  const [category, setCategory] = useState<'Exam' | 'Holiday' | 'Academic' | 'Event'>('Academic');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const canManageCalendar =
    user.role === 'admin' ||
    (user.role === 'teacher' && hasTeacherPermission(user.permissions, 'calendar'));

  const studentSummary =
    user.role === 'student'
      ? {
          attendance: calculateAttendanceStats(data.attendance, data.attendanceThreshold),
          marksheet: evaluateMarksheet(data.marks, data.subjects, user.id),
        }
      : null;

  const routineSectionFilter = user.section || 'C';
  const routineSemFilter = user.semester || 5;

  const visibleRoutine = data.routine.filter(
    (slot) => slot.section === routineSectionFilter && slot.semester === routineSemFilter
  );

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    setMsg('');
    try {
      await createCalendarEvent({ title, date, category, description });
      setTitle('');
      setDescription('');
      setMsg('Calendar event added.');
      await onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to add event');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(id: string) {
    setMsg('');
    try {
      await deleteCalendarEvent(id);
      await onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to delete event');
    }
  }

  if (subPart === '1.3') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#14532d]">
              1.3 Organisation&apos;s Academic Calendar
            </h2>
            <p className="text-sm text-[#356847]">
              Upcoming examinations, holidays, and institutional academic dates.
            </p>
          </div>
        </div>

        {canManageCalendar && (
          <form
            onSubmit={handleAddEvent}
            className="bg-[#f4fbf6] border border-[#c5e2CE] rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label htmlFor="cal-title" className="block text-xs font-semibold text-[#14532d] mb-1">
                Event Title
              </label>
              <input
                id="cal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Internal Assessment II"
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>
            <div>
              <label htmlFor="cal-date" className="block text-xs font-semibold text-[#14532d] mb-1">
                Date
              </label>
              <input
                id="cal-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded font-mono focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>
            <div>
              <label htmlFor="cal-cat" className="block text-xs font-semibold text-[#14532d] mb-1">
                Category
              </label>
              <select
                id="cal-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as 'Exam' | 'Holiday' | 'Academic' | 'Event')}
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                <option value="Academic">Academic</option>
                <option value="Exam">Exam</option>
                <option value="Holiday">Holiday</option>
                <option value="Event">Event</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{saving ? 'Adding...' : 'Add Event'}</span>
            </button>
            <div className="md:col-span-4">
              <label htmlFor="cal-desc" className="block text-xs font-semibold text-[#14532d] mb-1">
                Notes / Description
              </label>
              <input
                id="cal-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional room, timing, or department notice"
                className="w-full h-9 px-3 text-sm bg-white border border-[#a9d5b6] rounded focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>
          </form>
        )}

        {msg && (
          <p className="text-xs font-medium text-[#166534] bg-[#e6f5ea] border border-[#b5dcc0] px-3 py-2 rounded">
            {msg}
          </p>
        )}

        <div className="bg-white border border-[#c5e2CE] rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#dff2e4] border-b border-[#bfe0c8] text-xs font-bold text-[#14532d]">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Event</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Details</th>
                {canManageCalendar && <th className="py-2.5 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6f3ea] text-sm">
              {data.calendarEvents.length === 0 ? (
                <tr>
                  <td colSpan={canManageCalendar ? 5 : 4} className="py-8 text-center text-[#4a7459]">
                    No calendar events scheduled yet.
                  </td>
                </tr>
              ) : (
                data.calendarEvents
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((ev) => (
                    <tr key={ev.id} className="hover:bg-[#f6fbf7]">
                      <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-[#14532d] whitespace-nowrap">
                        {ev.date}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#0f291a]">{ev.title}</td>
                      <td className="py-2.5 px-4 text-xs text-[#356847]">{ev.category}</td>
                      <td className="py-2.5 px-4 text-xs text-[#356847]">
                        {ev.description || '—'}
                      </td>
                      {canManageCalendar && (
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(ev.id)}
                            aria-label={`Delete event ${ev.title}`}
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

  const renderTimetableCard = () => (
    <div className="bg-white border border-[#9fd0ad] rounded-lg overflow-hidden">
      {/* Centered Photo & Identity Banner matching Screenshot 1 */}
      <div className="bg-[#cfead7] border-b border-[#9fd0ad] py-4 px-4 flex flex-col items-center text-center">
        <div className="w-20 h-24 rounded border-2 border-[#166534] bg-white overflow-hidden flex items-center justify-center">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={`${user.name} passport portrait`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-10 h-10 text-[#6ba37d]" />
          )}
        </div>
      </div>

      <div className="bg-[#e3f4e8] border-b border-[#9fd0ad] px-4 py-2 text-center">
        <p className="text-xs sm:text-sm font-bold text-[#14532d]">
          {user.role === 'student'
            ? `Student of ${user.course || 'B.Tech, C.S.E (I.O.T.)'} · Weekly Time Table of Semester: ${user.semester || 5}, Sec: ${user.section || 'C'} & Class Roll No.: ${user.rollNo || '—'}`
            : `${user.name} (${user.role === 'admin' ? 'Administrator' : user.designation || 'Faculty'}) · Weekly Time Table Overview (Sem 5, Sec C)`}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[780px]">
          <thead>
            <tr className="bg-[#166534] text-white text-xs font-semibold">
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
          <tbody className="divide-y divide-[#cbe4d2] text-xs">
            {DAYS.map((day) => (
              <tr key={day} className="bg-[#f8fcf9] hover:bg-[#eef8f0]">
                <td className="py-3 px-3 font-bold text-[#14532d] bg-[#e3f4e8] border-r border-[#cbe4d2]">
                  {day}
                </td>
                {PERIODS.map((period) => {
                  const slot = visibleRoutine.find(
                    (r) => r.day === day && r.period === period
                  );
                  return (
                    <td
                      key={period}
                      className="py-2 px-2 border-r border-[#e0efe5] last:border-r-0 align-top text-center"
                    >
                      {slot ? (
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-[#14532d]">
                            {slot.subjectCode}
                          </div>
                          <div className="text-[#1f3d2b] font-medium leading-tight">
                            {slot.subjectName}
                          </div>
                          {slot.room && (
                            <div className="text-[11px] text-[#4b785b] font-mono">
                              {slot.room}
                            </div>
                          )}
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

  if (subPart === '1.2') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#14532d]">
              1.2 Weekly Class Routine (Mon – Fri)
            </h2>
            <p className="text-sm text-[#356847]">
              Current active timetable across Periods 1 to 8.
            </p>
          </div>
          {(user.role === 'admin' ||
            (user.role === 'teacher' && hasTeacherPermission(user.permissions, 'routine'))) && (
            <button
              type="button"
              onClick={() => onNavigateSubPart('subjects', '4.2')}
              className="px-3.5 py-2 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded whitespace-nowrap cursor-pointer"
            >
              Edit Class Routine
            </button>
          )}
        </div>
        {renderTimetableCard()}
      </div>
    );
  }

  // Default 1.1: Academic Overview
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#14532d]">
          1.1 Academic Overview &amp; Active Schedule
        </h2>
        <p className="text-sm text-[#356847]">
          Summary of your academic profile, weekly timetable, and upcoming deadlines.
        </p>
      </div>

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {user.role === 'student' && studentSummary ? (
          <>
            <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
              <div className="text-xs font-medium text-[#356847]">Student ID</div>
              <div className="text-xs sm:text-sm xl:text-base font-bold font-mono tabular-nums text-[#14532d] mt-1 break-all">
                {user.id}
              </div>
            </div>
            <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
              <div className="text-xs font-medium text-[#356847]">Attendance Rate</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[#14532d] mt-1">
                {studentSummary.attendance.totalClasses === 0
                  ? '—'
                  : `${studentSummary.attendance.percentage}%`}
              </div>
              <div className="text-xs text-[#4b785b] mt-0.5">
                {studentSummary.attendance.attendedClasses} / {studentSummary.attendance.totalClasses} classes
              </div>
            </div>
            <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
              <div className="text-xs font-medium text-[#356847]">Semester Result</div>
              <div className="text-xl font-bold text-[#14532d] mt-1">
                {studentSummary.marksheet.semesterResult}
              </div>
              <div className="text-xs text-[#4b785b] mt-0.5 tabular-nums">
                {studentSummary.marksheet.percentage}% · {studentSummary.marksheet.backlogCount} backlogs
              </div>
            </div>
            <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
              <div className="text-xs font-medium text-[#356847]">Active Assignments</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[#14532d] mt-1">
                {data.assignments.length}
              </div>
              <div className="text-xs text-[#4b785b] mt-0.5">Online &amp; Offline</div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
              <div className="text-xs font-medium text-[#356847]">Enrolled Students</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[#14532d] mt-1">
                {data.students.length}
              </div>
            </div>
            <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
              <div className="text-xs font-medium text-[#356847]">Active Faculty</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[#14532d] mt-1">
                {data.teachers.length}
              </div>
            </div>
            <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
              <div className="text-xs font-medium text-[#356847]">Registered Subjects</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[#14532d] mt-1">
                {data.subjects.length}
              </div>
            </div>
            <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
              <div className="text-xs font-medium text-[#356847]">Active Assignments</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[#14532d] mt-1">
                {data.assignments.length}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Reference Timetable Centerpiece */}
      {renderTimetableCard()}

      {/* Upcoming Calendar & Assignments Quick Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#14532d] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#166534]" />
              <span>Upcoming Academic Dates</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateSubPart('dashboard', '1.3')}
              className="text-xs font-semibold text-[#166534] hover:underline cursor-pointer"
            >
              View Calendar
            </button>
          </div>
          <ul className="divide-y divide-[#e6f3ea] text-xs">
            {data.calendarEvents.slice(0, 3).map((ev) => (
              <li key={ev.id} className="py-2 flex items-center justify-between gap-2">
                <span className="font-medium text-[#0f291a]">{ev.title}</span>
                <span className="font-mono tabular-nums text-[#356847] shrink-0">
                  {ev.date} · {ev.category}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-[#c5e2CE] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#14532d]">Recent Assignments</h3>
            <button
              type="button"
              onClick={() => onNavigateSubPart('assignments', '6.2')}
              className="text-xs font-semibold text-[#166534] hover:underline cursor-pointer"
            >
              Open All
            </button>
          </div>
          <ul className="divide-y divide-[#e6f3ea] text-xs">
            {data.assignments.slice(0, 3).map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                <span className="font-medium text-[#0f291a] truncate">{a.title}</span>
                <span className="font-mono tabular-nums text-[#356847] shrink-0">
                  Online: {a.onlineDeadline || '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
