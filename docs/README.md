# ShuttleLive Documentation Hub

Welcome to the official specification and architecture repository for **ShuttleLive — Multi-Tenant Badminton Tournament Operating System & Live Scoring Platform**.

---

## Architectural Principle
> *"One Central Platform. Multiple Organizers. Multiple Tournaments. Independent Custom Branding. Shared Authoritative Scoring Engine."*

ShuttleLive is a **generic, multi-tenant badminton platform**. While its initial pilot deployment powers a college tournament, the core architecture is tenant-agnostic—equally capable of running university championships, club leagues, corporate tournaments, and community weekend cups.

---

## Specification Suite Index

| Document | Title | Focus & Key Contents | Version |
| :--- | :--- | :--- | :---: |
| **[SRS.md](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md)** | **Software Requirements Specification** | Multi-tenant vision, 3-level branding inheritance, Organization entities, Functional Modules (FR-01 to FR-14), BWF 3×21 & BAI 3×15 rules, NFRs, Quick Matches, Commentary Engine, and release roadmap. | `v1.4.0` (Implemented Baseline) |
| **[ARCHITECTURE.md](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md)** | **Technical & Data Architecture** | Multi-tenant PostgreSQL schema (18 tables), Supabase Storage architecture, RLS tenant isolation, stored procedures (`record_point_event`, `undo_point_event`, etc.), Match Stats & Commentary engines, SVG Lead Chart geometry, and Tri-Mode Realtime. | `v1.4.0` (Implemented Baseline) |
| **[UI_UX.md](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md)** | **UI / UX & Branded Microsite Design** | Public branded microsite wireframe (`/t/[slug]`), Cricbuzz-Style Match Center (`/t/[slug]/m/[matchId]`), SVG Lead "Worm" Chart, Appearance & Branding Studio, Printable QR Poster, and mobile touch ergonomics ($>48\text{px}$). | `v1.4.0` (Implemented Baseline) |
| **[IMPLEMENTATION_PLAN.md](file:///D:/ShuttleLive/shuttlelive/docs/IMPLEMENTATION_PLAN.md)** | **Implementation Plan & QA Suite** | Phased development roadmap (Phases 1–5 completed), task completion tracking, 28-point launch acceptance QA test suite (TC-01 to TC-28), and upcoming UI improvement roadmap. | `v1.4.0` (Implemented Baseline) |

---

## Quick Reference Links

### 1. Multi-Tenancy, Organizations & Custom Branding
- [Multi-Tenant Hierarchy ("One Platform, Many Organizers")](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#12-multi-tenant-hierarchy-one-platform-many-organizers)
- [3-Level Branding Inheritance (Platform -> Org -> Tournament)](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#21-3-level-branding-inheritance-model)
- [Organization Workspaces & Member Invites](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#31-organization-workspaces-vs-independent-organizers)
- [Appearance & Branding Studio Requirements](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#411-module-11-tournament-branding--customization-studio)
- [Public Branded Microsite Engine](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#412-module-12-public-microsite--post-event-experience)
- [Slug Uniqueness, Reserved Slugs & 301 Redirects](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#414-module-14-slug-routing-sharing--discovery)

### 2. Match Center, Statistics & Commentary
- [Cricbuzz-Style Match Center Overview](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#4-live-match-center-wireframe-s-pub-04)
- [SVG Lead "Worm" Chart Progression](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#41-svg-lead-worm-chart-wireframe--spec)
- [Deterministic Fact-Based Commentary Engine](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#8-commentary--match-statistics-engine)
- [Match Analytics & Momentum Calculation](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#82-match-statistics-engine-libmatch-statsts)

### 3. Database Schema, RPCs & Storage
- [Multi-Tenant Database Tables (18 Tables)](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#3-database-schema--tables)
- [PostgreSQL Stored RPCs (`record_point_event`, `undo_point_event`, etc.)](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#22-supabase-postgresql-functions-stored-rpcs)
- [Supabase Storage Buckets & Policies](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#5-media--asset-storage-architecture)
- [Tenant Isolation & Row Level Security (RLS)](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#6-multi-tenant-row-level-security-rls)
- [Unified Scoring Command API](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#7-unified-scoring-api-specification)

### 4. Screen Layouts & Ergonomics
- [Branded Public Microsite Wireframe](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#2-branded-public-microsite-wireframe-tslug)
- [Appearance & Branding Studio Wireframe](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#3-appearance--branding-studio-wireframe-s-org-10)
- [Printable Tournament QR Poster](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#5-printable-stadium-qr-poster-s-org-13)
- [Organizer Scoring Console](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#6-organizer-scoring-console-s-scr-03)

### 5. QA & Launch Readiness
- [28-Point Launch Acceptance QA Checklist](file:///D:/ShuttleLive/shuttlelive/docs/IMPLEMENTATION_PLAN.md#2-launch-acceptance-qa-checklist-28-test-cases)
- [Pilot Tournament Organizer Checklist](file:///D:/ShuttleLive/shuttlelive/docs/IMPLEMENTATION_PLAN.md#3-organizer-confirmation-checklist-for-pilot-tournament)
- [Next UI/UX Enhancement Plan](file:///D:/ShuttleLive/shuttlelive/docs/IMPLEMENTATION_PLAN.md#4-next-uiux-enhancement-plan)
