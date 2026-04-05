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
