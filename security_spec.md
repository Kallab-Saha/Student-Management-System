# Security Specification & Payload TDD — Academic ERP Portal

## 1. Data Invariants
1. **Verified Authentication**: Every read and write on institutional collections requires an authenticated Google user with `request.auth.token.email_verified == true`.
2. **Sole Administrator Bootstrap & Authority**: Only the verified bootstrap administrator (`sahakamolendu@gmail.com`) or documents under `/admins/{uid}` possess administrative authority to create/delete students, create/edit/delete teachers, modify teacher permissions, manage subjects/settings, and approve/reject student applications.
3. **No Self-Assigned Privileges**: A user writing to `/users/{uid}` cannot assign themselves `'admin'` or `'teacher'` or link an arbitrary `memberId`; self-linking is permitted only when `request.auth.token.email` strictly matches the verified email stored by the Administrator in `/teacherPrivate/{memberId}` or `/studentPrivate/{memberId}`.
4. **PII & Password Isolation**: Student phone numbers/emails/portal passwords (`/studentPrivate/{studentId}`) and Teacher emails/portal passwords (`/teacherPrivate/{teacherId}`) are strictly isolated from `/students` and `/teachers` and readable only by the Administrator or the matching verified email owner.
5. **Teacher Action-Level Authorization**: Teachers can mutate `/routine`, `/attendance`, `/assignments`, `/marks`, `/materials`, or `/calendarEvents` only when their Administrator-controlled `/teachers/{memberId}.permissions[key]` flag is explicitly `true`.
6. **Student Self-Service Scope**: Students may read only their own `/students/{studentId}`, `/studentPrivate/{studentId}`, `/attendance`, `/marks`, and `/studentApplications`, and may update only their own contact/project/photo fields (`students/{id}`) and password (`studentPrivate/{id}`) without altering `id`, `status`, `semester`, `rollNo`, or `course`.
7. **Strict Validation & Temporal Integrity**: Every `create` and `update` invokes `isValid[Entity](incoming())`, validates `isValidId()` on document IDs, bounds every string/list length, prevents shadow keys via `hasAll` + `hasOnly` and `affectedKeys().hasOnly(...)`, and enforces `request.time` on `createdAt`/`updatedAt` timestamps.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Write**: Creating `/studentApplications/APP-999` with `request.auth == null`.
2. **Unverified Email Spoof**: Writing to `/admins/{uid}` with `email: "sahakamolendu@gmail.com"` and `email_verified: false`.
3. **Self-Assigned Admin Role**: Student creating `/users/{uid}` with `{ role: "admin", memberId: "Kallab" }`.
4. **Cross-Student ID Hijack**: Student A linking `/users/{uidA}` to Student B's `memberId` whose `/studentPrivate` email does not match Student A's token email.
5. **Blanket Student Roster Scraping**: Student querying `collection('students')` without authorization.
6. **PII / Password Leak**: Student reading `/teacherPrivate/Subham` or `/studentPrivate/12024002034150`.
7. **Shadow Field Injection**: Teacher updating `/marks/mk-1` with an extra ghost key `{ ..., adminOverride: true }`.
8. **Revoked Permission Escalation**: Teacher with `permissions.marks == false` attempting to create/update `/marks/mk-1`.
9. **Immutable Field Tampering**: Student updating `/students/{id}` while changing `status` to `"active"` or changing `semester`.
10. **Denial-of-Wallet Document ID Poisoning**: Creating `/subjects/{2KB-junk-id}` exceeding `isValidId()` 128-char regex guard.
11. **Backdated Timestamp Spoofing**: Submitting `/users/{uid}` with client-forged `createdAt` instead of `request.time`.
12. **Terminal Application Re-Approval**: Non-admin attempting to update `/studentApplications/{appId}` from `Pending` to `Approved`.
