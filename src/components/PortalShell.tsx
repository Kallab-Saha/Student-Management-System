import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import type { PortalBootstrapData } from '../types/portal';
import { hasTeacherPermission } from '../utils/academicRules';
import { DashboardRoutineModule } from './modules/DashboardRoutineModule';
import { StudentManagementModule } from './modules/StudentManagementModule';
import { TeacherAccessModule } from './modules/TeacherAccessModule';
import { SubjectsRoutineModule } from './modules/SubjectsRoutineModule';
import { AttendanceModule } from './modules/AttendanceModule';
import { AssignmentsModule } from './modules/AssignmentsModule';
import { MarksModule } from './modules/MarksModule';
import { StudyMaterialsModule } from './modules/StudyMaterialsModule';
import { AccountProfileModule } from './modules/AccountProfileModule';
import { AdminControlPanelModule } from './modules/AdminControlPanelModule';
import { IdPassGenerationModule } from './modules/IdPassGenerationModule';

interface PortalShellProps {
  data: PortalBootstrapData;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

interface SubPartItem {
  key: string;
  label: string;
}

interface ModuleItem {
  key: string;
  label: string;
  subParts: SubPartItem[];
}

export function PortalShell({ data, onRefresh, onLogout }: PortalShellProps) {
  const { user } = data;
  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';
  const isStudent = user.role === 'student';

  const modules = useMemo<ModuleItem[]>(() => {
    const list: ModuleItem[] = [];

    if (isAdmin) {
      list.push({
        key: 'admin-panel',
        label: '0. Admin Control Panel',
        subParts: [
          { key: '0.1', label: '0.1 Student ID & Records' },
          { key: '0.2', label: '0.2 Teachers & Access Control' },
          { key: '0.3', label: '0.3 Attendance & Marks' },
        ],
      });
    }

    list.push({
      key: 'dashboard',
      label: '1. Dashboard & Routine',
      subParts: [
        { key: '1.1', label: '1.1 Academic Overview' },
        { key: '1.2', label: '1.2 Weekly Class Routine' },
        { key: '1.3', label: '1.3 Academic Calendar' },
      ],
    });

    if (isAdmin) {
      list.push({
        key: 'students',
        label: '2. Student Management',
        subParts: [
          { key: '2.1', label: '2.1 Enroll & Generate ID' },
          { key: '2.2', label: '2.2 Student Directory' },
          { key: '2.3', label: '2.3 ID & Password Control' },
        ],
      });
      list.push({
        key: 'teachers',
        label: '3. Teacher Management',
        subParts: [
          { key: '3.1', label: '3.1 Add & Manage Teachers' },
          { key: '3.2', label: '3.2 Permission Authorizations' },
        ],
      });
    } else if (
      isTeacher &&
      hasTeacherPermission(user.permissions, 'students_view')
    ) {
      list.push({
        key: 'students',
        label: '2. Student Directory',
        subParts: [
          { key: '2.2', label: '2.2 Enrolled Students' },
          { key: '2.3', label: '2.3 Student Status' },
        ],
      });
    }

    if (isAdmin || isStudent || (isTeacher && hasTeacherPermission(user.permissions, 'routine'))) {
      list.push({
        key: 'subjects',
        label: '4. Subjects & Class Routine',
        subParts: [
          { key: '4.1', label: '4.1 Subject Registry' },
          {
            key: '4.2',
            label:
              isAdmin || (isTeacher && hasTeacherPermission(user.permissions, 'routine'))
                ? '4.2 Update Class Routine'
                : '4.2 Routine & Rooms',
          },
        ],
      });
    }

    if (
      isAdmin ||
      isStudent ||
      (isTeacher && hasTeacherPermission(user.permissions, 'attendance'))
    ) {
      const attSubParts: SubPartItem[] = [];
      if (isAdmin || (isTeacher && hasTeacherPermission(user.permissions, 'attendance'))) {
        attSubParts.push({ key: '5.1', label: '5.1 Mark & Update Attendance' });
      }
      attSubParts.push({ key: '5.2', label: '5.2 Attendance % & Alerts' });
      attSubParts.push({ key: '5.3', label: '5.3 Daily Attendance Log' });
      list.push({
        key: 'attendance',
        label: '5. Attendance Management',
        subParts: attSubParts,
      });
    }

    if (
      isAdmin ||
      isStudent ||
      (isTeacher && hasTeacherPermission(user.permissions, 'assignments'))
    ) {
      const asgSubParts: SubPartItem[] = [];
      if (isAdmin || (isTeacher && hasTeacherPermission(user.permissions, 'assignments'))) {
        asgSubParts.push({ key: '6.1', label: '6.1 Publish Assignment' });
      }
      asgSubParts.push({ key: '6.2', label: '6.2 Online Classroom & Details' });
      asgSubParts.push({ key: '6.3', label: '6.3 Offline Deadlines' });
      list.push({
        key: 'assignments',
        label: '6. Assignment Portal',
        subParts: asgSubParts,
      });
    }

    if (isAdmin || isStudent || isTeacher) {
      const mkSubParts: SubPartItem[] = [];
      if (isAdmin || (isTeacher && hasTeacherPermission(user.permissions, 'marks'))) {
        mkSubParts.push({ key: '7.1', label: '7.1 Input & Update Scores' });
      }
      mkSubParts.push({ key: '7.2', label: '7.2 Semester Marksheet' });
      mkSubParts.push({ key: '7.3', label: '7.3 Passing & Backlog Rules' });
      list.push({
        key: 'marks',
        label: '7. Marks Management',
        subParts: mkSubParts,
      });
    }

    const matSubParts: SubPartItem[] = [
      { key: '8.1', label: '8.1 Course Materials (PDF/Notes)' },
    ];
    if (isAdmin || (isTeacher && hasTeacherPermission(user.permissions, 'materials'))) {
      matSubParts.push({ key: '8.2', label: '8.2 Publish Study Material' });
    }
    list.push({
      key: 'materials',
      label: '8. Study Materials',
      subParts: matSubParts,
    });

    list.push({
      key: 'account',
      label: '9. Account & Profile',
      subParts: [
        { key: '9.1', label: '9.1 My Profile & Photo' },
        { key: '9.2', label: '9.2 Security & Password' },
      ],
    });

    if (isAdmin) {
      const pendingCount = (data.studentApplications || []).filter(
        (a) => a.status === 'Pending'
      ).length;
      list.push({
        key: 'id-generation',
        label:
          pendingCount > 0
            ? `10. ID & Password Generation (${pendingCount})`
            : '10. ID & Password Generation',
        subParts: [
          { key: '10.1', label: '10.1 Pending ID & Pass Requests' },
          { key: '10.2', label: '10.2 Generate Student & Teacher ID' },
          { key: '10.3', label: '10.3 Issued History' },
        ],
      });
    }

    return list;
  }, [data.studentApplications, isAdmin, isStudent, isTeacher, user.permissions]);

  const [activeModule, setActiveModule] = useState(
    isAdmin ? 'admin-panel' : 'dashboard'
  );
  const [activeSubPart, setActiveSubPart] = useState(isAdmin ? '0.1' : '1.1');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    'admin-panel': true,
    dashboard: true,
    students: true,
    teachers: true,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const mod = modules.find((m) => m.key === activeModule);
    if (!mod) {
      const first = modules[0];
      if (first) {
        setActiveModule(first.key);
        setActiveSubPart(first.subParts[0]?.key || '');
      }
      return;
    }
    if (!mod.subParts.some((sp) => sp.key === activeSubPart) && mod.subParts[0]) {
      setActiveSubPart(mod.subParts[0].key);
    }
  }, [modules, activeModule, activeSubPart]);

  function toggleModule(mod: ModuleItem) {
    setExpandedModules((prev) => {
      const nextOpen = !prev[mod.key];
      return { ...prev, [mod.key]: nextOpen };
    });
    if (activeModule !== mod.key && mod.subParts.length > 0) {
      setActiveModule(mod.key);
      setActiveSubPart(mod.subParts[0].key);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function navigateSubPart(moduleKey: string, subPartKey: string) {
    setActiveModule(moduleKey);
    setActiveSubPart(subPartKey);
    setExpandedModules((prev) => ({ ...prev, [moduleKey]: true }));
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  const roleLabel =
    user.role === 'admin'
      ? 'Administrator'
      : user.role === 'teacher'
      ? 'Faculty / Teacher'
      : 'Student';

  return (
    <div className="min-h-screen bg-[#f4fbf6] text-[#0f291a] flex flex-col">
      {/* Top Institutional Welcome Bar */}
      <header className="bg-[#dff2e4] border-b border-[#b7dec2] sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle module navigation"
              className="lg:hidden p-2 rounded bg-white border border-[#9fd0ad] text-[#14532d] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-[#14532d] truncate">
                Welcome {user.name.toUpperCase()} · Academic Resource Portal
              </div>
              <div className="text-xs text-[#356847] font-mono truncate">
                {roleLabel} · ID: {user.id}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-1.5 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {(user.isDefaultPassword || (isStudent && !user.photoUrl)) && (
          <div className="bg-[#eff9f1] border-t border-[#cde6d4] px-4 sm:px-6 py-1.5 text-center text-xs text-[#274e36]">
            {user.isDefaultPassword && !isTeacher && (
              <span className="mr-4">
                Please update your default password in{' '}
                <button
                  type="button"
                  onClick={() => navigateSubPart('account', '9.2')}
                  className="font-semibold text-[#166534] underline cursor-pointer whitespace-nowrap"
                >
                  Security &amp; Password
                </button>.
              </span>
            )}
            {isStudent && !user.photoUrl && (
              <span>
                Upload your passport photograph (.jpg / .png) in{' '}
                <button
                  type="button"
                  onClick={() => navigateSubPart('account', '9.1')}
                  className="font-semibold text-[#166534] underline cursor-pointer whitespace-nowrap"
                >
                  My Profile &amp; Photo
                </button>.
              </span>
            )}
          </div>
        )}
      </header>

      {/* Main Workspace */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 flex flex-col lg:flex-row gap-6">
        {/* Left Module Listing Accordion Sidebar */}
        <aside
          className={`${
            mobileMenuOpen ? 'block' : 'hidden'
          } lg:block w-full lg:w-[280px] shrink-0`}
          aria-label="Module Listing"
        >
          <div className="bg-white border border-[#bfe0c8] rounded-lg overflow-hidden">
            <div className="bg-[#166534] text-white px-4 py-2.5 text-sm font-bold">
              Module Listing
            </div>

            <nav className="p-2 space-y-1.5">
              {modules.map((mod) => {
                const isExpanded = Boolean(expandedModules[mod.key]);
                const isModuleActive = activeModule === mod.key;
                return (
                  <div
                    key={mod.key}
                    className="border border-[#cfe6d6] rounded overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleModule(mod)}
                      aria-expanded={isExpanded}
                      className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isModuleActive
                          ? 'bg-[#cfead7] text-[#14532d]'
                          : 'bg-[#e8f5ec] text-[#14532d] hover:bg-[#daf0e0]'
                      }`}
                    >
                      <span className="truncate">{mod.label}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 shrink-0 text-[#166534]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0 text-[#166534]" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="bg-[#f8fcf9] divide-y divide-[#e6f3ea] border-t border-[#cfe6d6]">
                        {mod.subParts.map((sub) => {
                          const active = activeSubPart === sub.key;
                          return (
                            <button
                              key={sub.key}
                              type="button"
                              onClick={() => navigateSubPart(mod.key, sub.key)}
                              className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between cursor-pointer ${
                                active
                                  ? 'bg-[#166534] text-white font-semibold'
                                  : 'text-[#274e36] hover:bg-[#e8f5ec]'
                              }`}
                            >
                              <span className="truncate">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Active Module Sub-Part Content */}
        <main className="flex-1 min-w-0">
          {activeModule === 'admin-panel' && (
            <AdminControlPanelModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
              onSwitchSubPart={(subKey) => navigateSubPart('admin-panel', subKey)}
            />
          )}
          {activeModule === 'dashboard' && (
            <DashboardRoutineModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
              onNavigateSubPart={navigateSubPart}
            />
          )}
          {activeModule === 'students' && (
            <StudentManagementModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
            />
          )}
          {activeModule === 'teachers' && (
            <TeacherAccessModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
            />
          )}
          {activeModule === 'subjects' && (
            <SubjectsRoutineModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
            />
          )}
          {activeModule === 'attendance' && (
            <AttendanceModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
            />
          )}
          {activeModule === 'assignments' && (
            <AssignmentsModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
            />
          )}
          {activeModule === 'marks' && (
            <MarksModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
            />
          )}
          {activeModule === 'materials' && (
            <StudyMaterialsModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
            />
          )}
          {activeModule === 'account' && (
            <AccountProfileModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
            />
          )}
          {isAdmin && activeModule === 'id-generation' && (
            <IdPassGenerationModule
              data={data}
              subPart={activeSubPart}
              onRefresh={onRefresh}
            />
          )}
        </main>
      </div>
    </div>
  );
}
