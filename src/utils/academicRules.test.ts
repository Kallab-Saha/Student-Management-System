import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttendanceStats,
  DEFAULT_TEACHER_PERMISSIONS,
  evaluateMarksheet,
  generateTemporaryPassword,
  generateUniqueStudentId,
  hasTeacherPermission,
  isValidSafeHttpUrl,
  validatePasswordInput,
} from './academicRules';
import type { MarkRecord, SubjectRecord } from '../types/portal';

test('calculateAttendanceStats computes percentage and flags below threshold', () => {
  const records = Array.from({ length: 40 }, (_, i) => ({
    status: (i < 36 ? 'Present' : 'Absent') as 'Present' | 'Absent',
  }));
  const stats = calculateAttendanceStats(records, 75);
  assert.equal(stats.totalClasses, 40);
  assert.equal(stats.attendedClasses, 36);
  assert.equal(stats.percentage, 90);
  assert.equal(stats.isBelowThreshold, false);

  const lowRecords = Array.from({ length: 10 }, (_, i) => ({
    status: (i < 6 ? 'Present' : 'Absent') as 'Present' | 'Absent',
  }));
  const lowStats = calculateAttendanceStats(lowRecords, 75);
  assert.equal(lowStats.percentage, 60);
  assert.equal(lowStats.isBelowThreshold, true);
});

test('evaluateMarksheet applies PDF 50% backlog semester FAIL rule', () => {
  const subjects: SubjectRecord[] = [
    { id: 's1', code: 'CS501', name: 'Algorithms', course: 'B.Tech', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Subham' },
    { id: 's2', code: 'CS502', name: 'DBMS', course: 'B.Tech', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Saikat' },
    { id: 's3', code: 'CS503', name: 'OS', course: 'B.Tech', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Shivam' },
    { id: 's4', code: 'CS504', name: 'IoT', course: 'B.Tech', semester: 5, maxMarks: 100, passingMarks: 40, teacherId: 'Subham' },
  ];

  const passMarks: MarkRecord[] = [
    { id: 'm1', studentId: 'stu1', subjectId: 's1', obtainedMarks: 78, updatedBy: 'Kallab', updatedAt: '2026-11-01' },
    { id: 'm2', studentId: 'stu1', subjectId: 's2', obtainedMarks: 65, updatedBy: 'Kallab', updatedAt: '2026-11-01' },
    { id: 'm3', studentId: 'stu1', subjectId: 's3', obtainedMarks: 35, updatedBy: 'Kallab', updatedAt: '2026-11-01' },
    { id: 'm4', studentId: 'stu1', subjectId: 's4', obtainedMarks: 82, updatedBy: 'Kallab', updatedAt: '2026-11-01' },
  ];
  const passSummary = evaluateMarksheet(passMarks, subjects, 'stu1');
  assert.equal(passSummary.backlogCount, 1);
  assert.equal(passSummary.semesterResult, 'PASS');
  assert.equal(passSummary.totalObtained, 260);
  assert.equal(passSummary.totalMaximum, 400);
  assert.equal(passSummary.percentage, 65);

  const failMarks: MarkRecord[] = [
    ...passMarks.slice(0, 3),
    { id: 'm4', studentId: 'stu1', subjectId: 's4', obtainedMarks: 25, updatedBy: 'Kallab', updatedAt: '2026-11-01' },
  ];
  const failSummary = evaluateMarksheet(failMarks, subjects, 'stu1');
  assert.equal(failSummary.backlogCount, 2);
  assert.equal(failSummary.semesterResult, 'FAIL');
});

test('generateUniqueStudentId avoids collisions and increments sequence', () => {
  const existing = ['12026002034149', '12026002034150'];
  const nextId = generateUniqueStudentId(existing, 2026);
  assert.equal(nextId, '12026002034151');
  assert.equal(existing.includes(nextId), false);
});

test('default teacher permissions grant attendance, assignments, routine, and marks', () => {
  assert.equal(hasTeacherPermission(DEFAULT_TEACHER_PERMISSIONS, 'attendance'), true);
  assert.equal(hasTeacherPermission(DEFAULT_TEACHER_PERMISSIONS, 'assignments'), true);
  assert.equal(hasTeacherPermission(DEFAULT_TEACHER_PERMISSIONS, 'routine'), true);
  assert.equal(hasTeacherPermission(DEFAULT_TEACHER_PERMISSIONS, 'marks'), true);
  assert.equal(hasTeacherPermission(DEFAULT_TEACHER_PERMISSIONS, 'materials'), false);
  assert.equal(hasTeacherPermission(DEFAULT_TEACHER_PERMISSIONS, 'students_view'), false);
});

test('generateTemporaryPassword, password validation, and URL validation behave accurately', () => {
  const pwd = generateTemporaryPassword(8);
  assert.equal(pwd.length, 8);
  assert.match(pwd, /^[A-Za-z0-9]{8}$/);

  assert.equal(validatePasswordInput('  ab  ').valid, false);
  assert.deepEqual(validatePasswordInput('  741166  '), {
    valid: true,
    cleaned: '741166',
  });

  assert.equal(isValidSafeHttpUrl('https://classroom.google.com/c/123'), true);
  assert.equal(isValidSafeHttpUrl('javascript:alert(1)'), false);
});
