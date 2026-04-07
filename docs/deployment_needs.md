# SkillWise — Future Scope & Deployment Needs

**Document Version:** 1.0  
**Date:** April 5, 2026  
**Status:** Tracking — Not Yet Implemented

---

## 1. Authentication & Authorization (RBAC)

Currently the platform uses a simple username-based routing (`/:username/dashboard`) with no formal authentication. The following are required for production:

- [ ] **User Registration & Login** — Email/password or OAuth (Google, GitHub)
- [ ] **JWT-based session tokens** — Secure API endpoints
- [ ] **Role-Based Access Control (RBAC)** — Candidate, Admin, Recruiter roles
- [ ] **Auth-gated routes** — Protect Dashboard, Interview, Report, Admin pages
- [ ] **Login/Signup page** — Route: `/auth`

---

## 2. Admin Panel Features

The Admin panel currently shows all sessions with basic stats. Future enhancements:

- [ ] **Live Monitoring** — Watch ongoing interviews in real-time (`/admin/live/:sessionId`)
- [ ] **Reports Management** — Bulk export, filter by date/skill/score (`/admin/reports`)
- [ ] **Candidate Management** — View candidate profiles, history
- [ ] **Proctoring Config** — Platform-wide proctoring settings (thresholds, alert limits)
- [ ] **Audit Log** — Track admin actions

---

## 3. Sidebar Navigation Items (Removed from UI)

These were present in the Stitch design but removed as they have no backend implementation:

| Item | Description | Required Backend |
|------|-------------|------------------|
| **Talent Pool** | Aggregate candidate database | Candidate profiles API, search/filter |
| **Insights** | Platform analytics, hiring trends | Analytics aggregation service |
| **Settings** | User preferences, notification config | User settings API |
| **Company** | Organization management | Multi-tenant org API |
| **Enterprise** | Enterprise tier features | License/billing service |

---

## 4. Interview Enhancements

- [ ] **Interactive Code Editor (IDE)** — Embedded Monaco/CodeMirror for coding questions
- [ ] **Docker-native sandboxed execution** — Run candidate code in containers
- [ ] **Auto unit test triggers** — Validate code answers automatically
- [ ] **Hint system** — AI-generated hints for stuck candidates
- [ ] **Multi-language support** — Python, JavaScript, Java, C++

---

## 5. Report Enhancements

- [ ] **PDF Export** — Generate downloadable PDF reports
- [ ] **Share Link** — Generate public/private shareable report URLs
- [ ] **Proctoring Video Playback** — Embedded MP4 session recording
- [ ] **Proctoring Snapshots Gallery** — Thumbnail grid of violation snapshots
- [ ] **CSV Log Download** — Download raw proctoring event log

---

## 6. Deployment Infrastructure

- [ ] **Docker Compose** — Single `docker-compose.yml` for all 4 services
- [ ] **Environment Configuration** — `.env.production` for all services
- [ ] **HTTPS/SSL** — TLS certificates for production
- [ ] **MongoDB Atlas** — Cloud database migration
- [ ] **CI/CD Pipeline** — GitHub Actions for build/test/deploy
- [ ] **Cloud Hosting** — AWS/GCP/Vercel deployment configs
- [ ] **CDN** — Static asset delivery for React bundle

---

## 7. Platform Polish

- [ ] **Responsive Design** — Mobile/tablet breakpoints for all pages
- [ ] **Accessibility (a11y)** — ARIA labels, keyboard navigation, screen reader support
- [ ] **Internationalization (i18n)** — Multi-language UI support
- [ ] **Dark/Light Mode Toggle** — User preference for theme
- [ ] **Toast Notifications** — Replace `alert()` calls with proper toast system
- [ ] **Error Boundaries** — React error boundaries for graceful failure
- [ ] **Loading Skeletons** — Shimmer loading states for all data-fetching pages

---

## 8. Proctoring Improvements

- [ ] **Multiple Camera Support** — Select from available cameras
- [ ] **Screen Recording** — Capture candidate's screen during interview
- [ ] **Audio Analysis** — Detect background voices, unusual audio
- [ ] **Browser Tab Detection** — Alert when candidate switches tabs
- [ ] **Proctoring Report Integration** — Merge proctoring logs into unified report PDF


CLAUDE:

FUTURE ROADMAP — AI Smart Interviewer & Proctoring System
Priority: High | Nature: Architectural + Feature Expansion

Read this entire document before planning anything. These are interconnected
changes. Treat this as a product specification, not just a task list.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[FEATURE-1] ADAPTIVE INTERVIEW ENGINE — KEYWORD-DRIVEN QUESTIONING

Overview:
The interview should not begin with a fixed question bank. It should open with
"Tell me about yourself" and use the candidate's response to dynamically shape
the rest of the session.

Phase 1 — Warm-up & Keyword Extraction:
- The bot opens with: "Tell me about yourself."
- While the candidate responds, the system runs real-time NLP keyword extraction
  in the background (skills mentioned, domains, tools, experience level signals).
- These extracted keywords are merged with the resume analysis already in progress.
- Together they form the candidate's dynamic profile for this session.

Phase 2 — Adaptive Question Generation:
- Questions are no longer purely pre-defined. They are generated or selected based
  on the dynamic profile built in Phase 1.
- If a candidate mentions "I have worked with Docker and Kubernetes," the system
  should prioritize DevOps-related questions even if the selected domain was general
  backend development.
- Difficulty should scale progressively based on answer quality. Strong answers
  should push the difficulty up. Weak answers should probe fundamentals before
  moving on.
- Track topic coverage so no major domain area is skipped.

Phase 3 — Follow-up Intelligence:
- After each answer, the model should decide: follow up on this answer, or move to
  the next topic. Implement a follow-up trigger threshold based on answer confidence
  score. If the candidate's answer is vague or incomplete, ask one follow-up before
  moving on.
- Log which topics were followed up and why. This feeds into the final report.

Additional points to implement:
- Store the keyword profile per session for report generation.
- The adaptive engine should work independently of the resume — in case resume
  parsing fails, Phase 1 keywords alone should be enough to run a coherent session.
- Do not let Phase 1 run longer than a defined time cap. If the candidate speaks for
  too long, gently redirect.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[FEATURE-2] FULL DATABASE REDESIGN — SCHEMA, ROLES, AND PERMISSIONS

Overview:
The current database structure is unmanageable. This is a full architectural
reset. Do not patch the existing schema. Redesign it from scratch with
multi-tenancy, role-based access control (RBAC), and clean separation of concerns
in mind.

--- 2A. MULTI-TENANT ARCHITECTURE ---

The platform serves three distinct client types:
- Admin (platform owner — Anthropic/your company)
- Institution (college, university, or corporate training partner)
- Individual (self-registered candidate)

Every data entity in the schema must carry a tenant identifier where applicable.
Institution data must be fully isolated from other institution data.

--- 2B. SCHEMA REDESIGN GUIDELINES ---

Core entities to define cleanly:
- Users (with role field: admin / institution_admin / student / individual)
- Institutions (colleges, universities, companies)
- Institution Members (students tied to an institution, with branch/dept metadata)
- Sessions (interview sessions — tied to user, not to institution directly)
- Reports (generated after each session — linked to session ID)
- Subscriptions / Plans (which institution or individual has opted for which tier)
- System Logs (API health, DB connection status, errors — admin-only)
- Audit Logs (who did what, when — for compliance and debugging)

Schema rules:
- Define NOT NULL, UNIQUE, and FOREIGN KEY constraints properly everywhere.
- Add soft deletes (deleted_at) instead of hard deletes for user and session data.
- Add created_at and updated_at timestamps to every table.
- No redundant fields. No storing calculated values that can be derived.
- Think about indexing from day one — sessions and reports tables will be large.
- Plan for data retention policies. Old sessions beyond X months should be
  archivable, not permanently stored in the main tables.

--- 2C. ROLE DEFINITIONS AND PERMISSIONS ---

ADMIN (Platform Owner):
- Full read access across all tenants (no write access to tenant-specific data
  unless it is a support action — log that action).
- Can view: model performance metrics (accuracy, avg scores, question quality
  ratings, flagged sessions), application health (API status, DB connection,
  service uptime), global user counts (total institutions, total students,
  total individuals, total active sessions right now), error and exception logs,
  subscription and billing overview per institution, any other platform-level KPIs.
- Cannot see: individual interview content or answers (privacy boundary).
- Admin dashboard should have: live system status panel, global usage graphs,
  model performance over time, alert/notification center for critical failures.

INSTITUTION ADMIN (College / University / Corporate):
- Can see only their own institution's data.
- Student management: view all registered students, organized by branch and
  department. Each student entry navigates to their full performance profile.
- Per-student profile should show: total sessions given, subject/domain-wise
  scores, date-wise progress graph (is the student improving?), assessment
  breakdown per session, proctoring flags (if any), AI-generated feedback
  summary (where is this student struggling and why — phrased for faculty).
- Batch/cohort views: top performing students, average performers, students
  who need attention (with specific weak areas highlighted).
- Live monitoring: number of students currently in an active interview session.
- Cannot modify student data or interview content. Read-only role with
  export capability (CSV/PDF of student reports).
- Institution admin cannot see other institutions' data under any circumstance.

STUDENT (Institution-provisioned):
- Logs in via credentials provided by their institution.
- Dashboard shows: their own performance only, upcoming sessions (if scheduled),
  their college name and branch displayed on their profile.
- Cannot see other students' data.

INDIVIDUAL (Self-registered):
- Signs up independently. No institution association.
- Dashboard shows: their own sessions, reports, and progress only.
- Subscription-based access. Define what free vs paid tier can access.

--- 2D. ADDITIONAL CONSIDERATIONS ---
- Implement row-level security or equivalent middleware checks so that no role
  can access data outside their scope, even with direct API calls.
- All sensitive routes must validate role and ownership before returning data.
- Define what happens when an institution's subscription expires — student
  accounts go read-only, not deleted.
- Plan for GDPR-style data deletion requests. A user should be able to request
  full account deletion and the system should handle it cleanly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[FEATURE-3] AUTHENTICATION SYSTEM AND ROLE-BASED UI

Overview:
Build a clean, unified auth flow that handles all three user types from a single
entry point. The UI must adapt completely based on the logged-in role.

--- 3A. ENTRY FLOW ---

Landing Page (already built):
- "Get Started" button navigates to the auth page.
- Auth page handles: Login and Sign Up in a single clean interface.
- Do not build separate login pages per role. One page, role is determined
  after identity is verified.

Sign Up flows:
- Institution Admin: registers their institution (institution name, type, contact,
  subscription plan selection). Credentials are set during this step.
- Individual: standard self-registration (name, email, password, optional profile
  details). Email verification required before first session.
- Student: cannot self-register. They receive credentials from their institution
  admin. First login should prompt a mandatory password change.

Login flow:
- Single login form. After authentication, backend returns the user's role.
- Frontend routes to the correct dashboard based on role.
- JWT or session-based auth with proper expiry and refresh token logic.
- Add "Forgot Password" with email-based reset for all self-registered users.
- Institution-provisioned student credentials — reset flow goes through the
  institution admin, not direct email (since the institution controls those accounts).

--- 3B. ROLE-BASED DASHBOARD RENDERING ---

Critical rule: The frontend must never show UI elements that a role is not
authorized to see. This is not just hiding buttons — the routes themselves must
be protected. Accessing /admin as a student must return a 403, not just redirect.

Admin Dashboard: system health, global metrics, model performance, logs.
Institution Dashboard: student lists, performance monitoring, cohort analytics,
  live session count, AI-generated faculty feedback per student.
Student Dashboard: personal performance, session history, upcoming sessions,
  college name shown on profile.
Individual Dashboard: personal performance, session history, subscription status,
  upgrade prompts if on free tier.

--- 3C. SESSION AND SECURITY STANDARDS ---
- Enforce HTTPS across all routes.
- Rate-limit login attempts. Lock account after N failed attempts with unlock
  via email.
- Log all login events (successful and failed) with timestamp and IP.
- Session timeout after defined inactivity period, with a warning before expiry.
- If an institution admin deactivates a student account, that student's active
  session (if any) should be gracefully terminated, not hard-cut.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPLEMENTATION INSTRUCTIONS:

- Do not start with Feature 3 (auth) until Feature 2 (schema) is finalized.
  Auth depends on the user model. Build in this order: Schema → Auth → Dashboards
  → Adaptive Engine.
- Every feature has dependencies on the schema. Get the schema right first.
  A mistake there cascades into everything.
- Before writing any code, produce: an ER diagram for the new schema, a role
  permission matrix (rows = roles, columns = actions), and a route protection plan.
- Write migration scripts carefully. Existing session and report data must be
  preserved and mapped to the new schema.
- Treat the college dashboard as a product — a faculty member should be able to
  understand a student's performance without any technical knowledge.