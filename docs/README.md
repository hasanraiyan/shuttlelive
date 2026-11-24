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
| **[SRS.md](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md)** | **Software Requirements Specification** | Multi-tenant vision, 3-level branding inheritance, Organization entities, Functional Modules (FR-01 to FR-14), BWF 3×21 & BAI 3×15 rules, NFRs, and P0/P1/P2 release roadmap. | `v1.2.0` (Draft) |
| **[ARCHITECTURE.md](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md)** | **Technical & Data Architecture** | Multi-tenant PostgreSQL schema (14 normalized tables), Supabase Storage architecture, RLS tenant isolation, append-only `UNDO` engine, optimistic concurrency (`expectedVersion`), and 10-state match lifecycle. | `v1.2.0` (Draft) |
| **[UI_UX.md](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md)** | **UI / UX & Branded Microsite Design** | Public branded microsite wireframe (`/t/[slug]`), Appearance & Branding Studio, Post-Event Hall of Fame, 5 universal UI states, and mobile touch ergonomics ($>48\text{px}$). | `v1.2.0` (Draft) |
| **[IMPLEMENTATION_PLAN.md](file:///D:/ShuttleLive/shuttlelive/docs/IMPLEMENTATION_PLAN.md)** | **Implementation Plan & QA Suite** | Phased development roadmap, P0/P1/P2 task checklists, and the formal **28-point launch acceptance QA test suite** (TC-01 to TC-28). | `v1.2.0` (Draft) |

---

## Quick Reference Links

### 1. Multi-Tenancy & Custom Branding
- [Multi-Tenant Hierarchy ("One Platform, Many Organizers")](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#12-multi-tenant-hierarchy-one-platform-many-organizers)
- [3-Level Branding Inheritance (Platform -> Org -> Tournament)](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#21-3-level-branding-inheritance-model)
- [Appearance & Branding Studio Requirements](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#411-module-11-tournament-branding--customization-studio)
- [Public Branded Microsite Engine](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#412-module-12-public-microsite--post-event-experience)
- [Slug Uniqueness, Reserved Slugs & 301 Redirects](file:///D:/ShuttleLive/shuttlelive/docs/SRS.md#414-module-14-slug-routing-sharing--discovery)

### 2. Database Schema & Storage
- [Multi-Tenant Database Tables](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#3-database-schema--tables)
- [Supabase Storage Buckets & Policies](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#5-media--asset-storage-architecture)
- [Tenant Isolation & Row Level Security (RLS)](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#6-multi-tenant-row-level-security-rls)
- [Unified Scoring Command API](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md#6-unified-scoring-api-specification)

### 3. Screen Layouts & Ergonomics
- [Branded Public Microsite Wireframe](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#2-branded-public-microsite-wireframe-tslug)
- [Appearance & Branding Studio Wireframe](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#3-appearance--branding-studio-wireframe-s-org-10)
- [Post-Event Hall of Fame & Winners Podium](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#4-post-event-hall-of-fame-showcase-wireframe-s-pub-10)
- [Live Scorer Wireframe](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md#31-live-scorer-board-s-scr-03)

### 4. QA & Launch Readiness
- [28-Point Launch Acceptance QA Checklist](file:///D:/ShuttleLive/shuttlelive/docs/IMPLEMENTATION_PLAN.md#2-launch-acceptance-qa-checklist-28-test-cases)
- [Pilot Tournament Organizer Checklist](file:///D:/ShuttleLive/shuttlelive/docs/IMPLEMENTATION_PLAN.md#3-organizer-confirmation-checklist-for-pilot-tournament)
