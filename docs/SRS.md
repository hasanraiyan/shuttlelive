# Software Requirements Specification (SRS)
## Badminton Live (ShuttleLive) — Multi-Tenant Tournament Management & Live Scoring Platform

**Document Version:** 1.3.0  
**Status:** Draft — Phase 0 baseline (single organizer role)  
**Last Updated:** November 2026  
**Product Vision:** *"Create. Compete. Follow Live."*  
**Platform Architecture:** Multi-Tenant Tournament Operating System with Custom Branded Microsites

---

## Document Changelog (v1.2.0 -> v1.3.0)
- **Umpire role removed from Phase 0:** There is no separate umpire, referee or scorer login, no court PIN and no magic-link/OTP fast-pass. The organizer who owns a tournament is the only person who can change it, including scoring its matches from the organizer console. Delegated scoring may return in a later phase as an explicit, audited feature (see §9).
- **One account type:** Every signed-in user is an organizer of their own tournaments. Organization workspaces and collaborator roles stay in P1.
- **Security requirements added:** New §6.1 lists the mandatory security controls for Phase 0 (row-level security on every table, owner checks inside every database function, immutable match log, storage path ownership, safe redirects, input validation, security headers).
- **Player data minimised:** Players are stored with a name and an optional club only. Phone numbers and ID numbers are not collected in Phase 0.

## Document Changelog (v1.1.0 -> v1.2.0)
- **Multi-Tenant Foundation Added:** Formally decoupled the platform from any single college or entity. Defined ShuttleLive as a multi-tenant platform supporting colleges, academies, corporate leagues, clubs, and independent organizers.
- **Organization / Workspace Entity:** Introduced optional `Organization` entity for multi-tournament hosts with reusable rosters and branding; preserved lightweight zero-setup tournament creation for independent organizers.
- **Tournament Branding & Customization Module (FR-BRD):** Comprehensive branding controls (logos, cover banners, primary/accent colors, sponsors, venue with Google Maps, social links, and custom hashtags).
- **Public Branded Microsite Engine (FR-MIC):** Dynamic, responsive microsite architecture for published tournaments with configurable sections, graceful degradation for unset fields, and subtle *"Powered by ShuttleLive"* attribution.
- **Media & Asset Management Specification (FR-MED):** Supabase Storage integration, strict MIME validation, recommended aspect ratios, image compression, and public CDN caching.
- **Slug Management & Social Sharing (FR-SLG):** Human-readable unique slugs (`/t/[slug]`), reserved word protections, automated 301 redirects on slug changes, and dynamic OpenGraph card generation.
- **Lifecycle & Post-Event Experience:** Defined 3-phase microsite lifecycle: Pre-Event (Rosters/Fixtures), Live (Court Center/Commentary), and Post-Event (Hall of Fame, Champions Showcase, Tournament Duplication).
- **Roadmap Alignment:** Frozen P0 scope to guarantee immediate launch readiness for the first college championship without bloating build requirements.

---

## Table of Contents
1. [Introduction & Multi-Tenant Vision](#1-introduction--multi-tenant-vision)
   - 1.1 Purpose & Scope
   - 1.2 Multi-Tenant Hierarchy ("One Platform, Many Organizers")
   - 1.3 Terminology & Hierarchy
2. [Branding & Customization Architecture](#2-branding--customization-architecture)
   - 2.1 3-Level Branding Inheritance Model
   - 2.2 Branded Public Microsite Concept
   - 2.3 Visual Contrast & Accessibility Compliance
3. [Organization & Tenant Management](#3-organization--tenant-management)
   - 3.1 Organization Workspaces vs Independent Organizers
   - 3.2 Tenant Isolation & Access Boundaries
4. [Functional Requirements (FR)](#4-functional-requirements-fr)
   - 4.1 Module 1: Authentication & User Administration
   - 4.2 Module 2: Team, Department & Player Directory
   - 4.3 Module 3: Tournament Lifecycle & Configuration
   - 4.4 Module 4: Categories & Eligibility Rules
   - 4.5 Module 5: Draw, Bracketing & Fixture Management
   - 4.6 Module 6: Live Scoring State Machine (Organizer Console)
   - 4.7 Module 7: Public Live Experience & Match Center
   - 4.8 Module 8: Deterministic Fact-Based Commentary & Streaming
   - 4.9 Module 9: Statistics, Standings & Performance Tracking
   - 4.10 Module 10: Standalone Quick Matches (Without Tournament)
   - 4.11 Module 11: Tournament Branding & Customization Studio
   - 4.12 Module 12: Public Microsite & Post-Event Experience
   - 4.13 Module 13: Media & Asset Storage Engine
   - 4.14 Module 14: Slug Routing, Sharing & Discovery
5. [Badminton Scoring Engine & India/BWF Standards](#5-badminton-scoring-engine--indiabwf-standards)
6. [Non-Functional Requirements (NFR)](#6-non-functional-requirements-nfr)
7. [Product Scope & Release Prioritization (P0 / P1 / P2)](#7-product-scope--release-prioritization-p0--p1--p2)
8. [Cross-Document References](#8-cross-document-references)

---

## 1. Introduction & Multi-Tenant Vision

### 1.1 Purpose & Scope
**ShuttleLive** is a multi-tenant, cloud-native badminton platform engineered to serve as both an administrative tournament operating system and a real-time match broadcasting service.

The platform is **strictly generic and tenant-agnostic**:
- It is not hardcoded to any particular institution, university, club, or sponsor.
- Its first deployment is a college badminton championship (e.g., MIT Muzaffarpur), which acts as the **initial pilot tenant** to validate real-world conditions.
- It concurrently supports independent weekend organizers, school district sports, corporate inter-branch leagues, and sanctioned badminton academy circuits.

### 1.2 Multi-Tenant Hierarchy ("One Platform, Many Organizers")
```
                                 [ SHUTTLELIVE PLATFORM ]
                      Global Directory · Shared Authoritative Scoring Engine
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                   ▼                                   ▼
 [ ORGANIZATION TENANT ]           [ ACADEMY / CLUB TENANT ]         [ INDEPENDENT ORGANIZER ]
  e.g., MIT Muzaffarpur             e.g., Smash Badminton Club        e.g., Weekend Smashers
  - Reusable branding & logos       - Reusable member rosters         - Direct tournament creation
  - Multi-season history            - Member player rosters           - No formal org required
  - Multi-department teams          - Multi-category tournaments      - Lightweight setup
        │                                   │                                   │
        ▼                                   ▼                                   ▼
 [ TOURNAMENTS ]                     [ TOURNAMENTS ]                     [ TOURNAMENTS ]
  • Annual Championship 2026          • Winter Open 2026                  • Monsoon Cup
  • Inter-Branch League               • Summer Junior Trophy
        │                                   │                                   │
        ▼                                   ▼                                   ▼
 [ BRANDED MICROSITE ]               [ BRANDED MICROSITE ]               [ BRANDED MICROSITE ]
  /t/mit-badminton-2026               /t/smash-winter-open                /t/monsoon-cup
  Custom Banner, Colors,              Custom Academy Theme,               Default Theme with
  Sponsors, Venue & Rules             Club Sponsors & Venue Maps          Custom Event Banner
```

---

## 2. Branding & Customization Architecture

### 2.1 3-Level Branding Inheritance Model
To balance effortless setup for casual organizers with deep customization for major institutions, styling and metadata follow a deterministic 3-tier cascade:

```
+-----------------------------------------------------------------------------------------+
| Level 1: Platform Defaults (ShuttleLive)                                                |
|  - Neutral Dark/Light Theme (Zinc/Emerald accents)                                      |
|  - Standard badminton iconography & system typography (Inter / Geist)                   |
|  - "Powered by ShuttleLive" footer attribution                                          |
+-----------------------------------------------------------------------------------------+
                                           │
                                           ▼ (Overridden by)
+-----------------------------------------------------------------------------------------+
| Level 2: Organization Defaults (Optional)                                               |
|  - Institution Name (e.g., "MIT Muzaffarpur", "Smash Club")                            |
|  - Organization Logo & Primary Identity Color                                           |
|  - Reusable Organizer Contact & Default Venue                                           |
+-----------------------------------------------------------------------------------------+
                                           │
                                           ▼ (Overridden by)
+-----------------------------------------------------------------------------------------+
| Level 3: Tournament Overrides (Event-Specific)                                          |
|  - Tournament Title, Subtitle, Edition/Season                                           |
|  - Custom Cover Banner & Event Logo                                                     |
|  - Event Primary & Secondary Accent Colors                                              |
|  - Event Sponsors & Partner Badges                                                      |
|  - Event-Specific Rules, Prizes & Notice Board                                          |
+-----------------------------------------------------------------------------------------+
```

### 2.2 Branded Public Microsite Concept
Every published tournament automatically receives a dedicated, mobile-optimized microsite accessible at `shuttlelive.com/t/[tournament-slug]`.
- **Customized Header:** Displays tournament logo, title, organizing institution, event dates, venue with Google Maps link, and tournament status (`● LIVE`, `UPCOMING`, `COMPLETED`).
- **Configurable Navigation Tabs:** Overview, Live Scores, Fixtures, Results, Brackets, Teams/Players, Rules, Sponsors, and Hall of Fame.
- **Graceful Degradation:** If an organizer does not provide sponsors, prizes, or banner images, those UI blocks collapse completely without leaving awkward empty boxes or broken layout gaps.
- **Unobtrusive Platform Identity:** A subtle, elegant badge *"Powered by ShuttleLive"* is embedded in the navbar and footer.

### 2.3 Visual Contrast & Accessibility Compliance
Custom primary and accent colors chosen by organizers are programmatically validated against WCAG 2.1 AA contrast requirements ($> 4.5:1$ against background). If an organizer selects an illegible color combination (e.g., neon yellow on white), the UI automatically computes a luminance-corrected text color to guarantee readability on outdoor mobile screens.

---

## 3. Organization & Tenant Management

### 3.1 Organization Workspaces vs Independent Organizers
1. **Organization Workspaces [P1]:**
   - Designed for colleges, sports clubs, and tournament companies.
   - Multiple team members can collaborate under one organization (Roles: `Owner`, `Admin`, `Tournament Director`).
   - Centralizes player rosters, past tournament records, and billing/plans.
2. **Independent Organizers [P0 Core]:**
   - Any individual can sign in and create a tournament directly without creating an organization.
   - Zero configuration hurdles for casual, community, or spontaneous tournaments.

### 3.2 Tenant Isolation & Access Boundaries
- **Logical Multi-Tenancy:** All tenant data resides in a shared PostgreSQL database isolated via `organization_id` and `tournament_id` foreign keys.
- **Row Level Security (RLS):** Strict Supabase RLS policies guarantee that an organizer cannot view unpublished data of, update, or score matches belonging to another organizer's tournament. In Phase 0 the tournament owner is the only account with write access to a tournament.
- **Public Isolation:** Public spectators have read access strictly to published tournament records and sanctioned live channels.

---

## 4. Functional Requirements (FR)

*(Modules 1 through 10 maintain full continuity from v1.1.0; Modules 11 through 14 define the multi-tenant branding, microsite, and asset architecture).*

### 4.11 Module 11: Tournament Branding & Customization Studio
- **FR-BRD-01 (Tournament Profile Configuration):** Organizers can configure:
  - Tournament Title (e.g., *"MIT Badminton Championship 2026"*).
  - Subtitle / Tagline (e.g., *"Annual Inter-Branch Sports Tournament"*).
  - Description / About text with Markdown support.
  - Edition / Season (e.g., *"14th Edition / 2026-27"*).
- **FR-BRD-02 (Visual Asset Customization):**
  - Upload Tournament Logo (Square, 1:1 ratio, min 400x400px).
  - Upload Cover Banner (Landscape, 16:9 or 3:1 ratio, min 1920x640px).
  - Support image cropping and live preview before saving.
- **FR-BRD-03 (Organization & Host Attribution):**
  - Host Entity Name (e.g., *"MIT Muzaffarpur"* or *"Muzaffarpur Badminton Association"*).
  - Host Entity Logo.
  - Public organizer contact email and phone (optional).
  - Official website URL and social media handles (Instagram, X, YouTube, LinkedIn).
- **FR-BRD-04 (Venue & Location Integration):**
  - Venue Name (e.g., *"College Indoor Badminton Arena"*).
  - Physical Address / City / Campus.
  - Optional Google Maps Embed URL or Coordinates with 1-tap "Get Directions" trigger.
- **FR-BRD-05 (Color Theme Customization [P1]):**
  - Selection of Brand Primary Color and Accent Color via color picker or HEX/RGB input.
  - Real-time contrast validation ensuring legible text rendering.
- **FR-BRD-06 (Sponsor & Partner Showcase [P1]):**
  - Organizers can add multiple sponsors with: Sponsor Name, Tier (Title Sponsor, Powered By, Associate Sponsor), Logo, and Website URL.
  - Renders as a clean sponsor strip on the tournament header and footer.
- **FR-BRD-07 (Rules, Guidelines & Prizes):**
  - Dedicated rich-text tab for official event rules, dress code, shuttlecock type (Feather / Nylon), and protest procedures.
  - Awards and prizes section (e.g., *"Winner: ₹15,000 + Trophy, Runner Up: ₹7,500"*).
- **FR-BRD-08 (Hashtag & Social Campaign):**
  - Custom tournament hashtag (e.g., `#MITSmash2026`) with 1-click copy for social sharing.
- **FR-BRD-09 (Non-Destructive Live Branding Edits):**
  - Organizers can update banners, announcements, sponsor logos, or venue descriptions while matches are actively live **without restarting matches, invalidating versions, or disrupting live scoring**.

### 4.12 Module 12: Public Microsite & Post-Event Experience
- **FR-MIC-01 (Dedicated Public Microsite):** Every published tournament serves a self-contained microsite at `/t/[slug]`.
- **FR-MIC-02 (Modular Section Toggles):** Organizers can toggle visibility for optional sections:
  - `Show Sponsors`: ON / OFF
  - `Show Rules & Prizes`: ON / OFF
  - `Show Announcements`: ON / OFF
  - `Show Venue Map`: ON / OFF
  - `Show Bracket`: ON / OFF
- **FR-MIC-03 (Pre-Event Phase Experience):** Prior to start date, the microsite emphasizes countdown timer, confirmed player/team list, draw preview, and rules.
- **FR-MIC-04 (Live Event Phase Experience):** During the tournament, the hero area elevates active court scorecards (`Court 1: Aman vs Rahul [18-16]`), upcoming court queues, and real-time commentary.
- **FR-MIC-05 (Post-Event Phase Experience / Hall of Fame):** Once status moves to `COMPLETED`:
  - Hero area displays the **Tournament Champions & Medalists** across all categories (Gold, Silver, Bronze).
  - Full historical match logs, game scores, and brackets remain permanently archived and browsable.
- **FR-MIC-06 (Tournament Duplication & Templates [P1]):** Organizers can duplicate an existing tournament configuration (categories, courts, scoring presets, branding) for a new season or edition with one click, leaving previous match data untouched.

### 4.13 Module 13: Media & Asset Storage Engine
- **FR-MED-01 (Storage Infrastructure):** Built on Supabase Storage with dedicated buckets:
  - `tournament-assets` (public bucket for logos, banners, sponsor logos).
  - `organization-assets` (public bucket for org logos).
  - `player-avatars` (public bucket for participant photos).
- **FR-MED-02 (Upload Constraints & File Formats):**
  - Supported formats: JPEG, PNG, WebP, SVG.
  - Maximum logo size: 2 MB. Maximum banner size: 5 MB.
- **FR-MED-03 (Client-Side Compression):** Images are compressed to optimized WebP format prior to upload to conserve mobile bandwidth for court-side uploaders.
- **FR-MED-04 (Asset Security & Sanitization):**
  - Strict MIME-type checking on upload endpoints to prevent malicious executable uploads.
  - Private tournaments store assets with time-expiring signed URLs.

### 4.14 Module 14: Slug Routing, Sharing & Discovery
- **FR-SLG-01 (Custom Readable Slugs):** Organizers can define a custom URL slug upon creation (e.g., `/t/mit-badminton-2026`). Defaults to auto-generated kebab-case from tournament title.
- **FR-SLG-02 (Slug Uniqueness & Validation):**
  - Slugs must be 3–60 characters, lowercase alphanumeric and hyphens (`[a-z0-9-]`).
  - Strict enforcement of global uniqueness.
- **FR-SLG-03 (Reserved Slugs):** System blocks reservation of platform routing keywords (e.g., `admin`, `api`, `dashboard`, `auth`, `login`, `tournaments`, `explore`, `settings`, `pricing`, `help`, `live`).
- **FR-SLG-04 (Slug Change Redirects):** If an organizer updates an existing tournament slug post-publication, the previous slug is archived in a redirect table, performing an automatic `301 Moved Permanently` to prevent broken QR codes or printed posters.
- **FR-SLG-05 (Dynamic Social Preview Generation):** Every tournament and match page dynamically synthesizes an OpenGraph / Twitter card featuring the tournament banner, logo, current live score, and venue.

---

## 5. Badminton Scoring Engine & India/BWF Standards
*(Preserved in full from v1.1.0)*
- Supports BWF Standard 3×21 (cap 30) and BAI Domestic Standard 3×15 (cap 21).
- 4-level rule inheritance (`Tournament` -> `Category` -> `Round` -> `Match Snapshot`).
- Single-tap scoring board operated by the tournament organizer, append-only `UNDO`, and `MATCH_WON_PENDING` confirmation state.
- **FR-SCR-01 (Who can score):** Only the signed-in owner of the tournament can start, score, undo, confirm or terminate its matches. Every scoring command is checked against the caller's identity inside the database, not only in the web app.
- **FR-SCR-02 (Idempotency & concurrency):** Each command carries a client event id (duplicates are ignored) and the expected match version (a stale version returns `409 Conflict`), so the same organizer scoring from two tabs cannot double-count a rally.
- **FR-SCR-03 (Court and player clashes):** A match cannot start on a court that already has a match in progress, or while one of its players is in another match in progress.
- Complete walkover, retirement, and disqualification protocols without artificial score fabrication.

---

## 6. Non-Functional Requirements (NFR)
- **NFR-SUPA-01 (Tri-Mode Supabase Realtime):** Sub-100ms point propagation via Supabase Realtime Broadcast channels; Postgres CDC for verified canonical persistence; Presence tracking for live audience headcount (P1).
- **NFR-SUPA-02 (Authoritative PostgreSQL RPCs):** Scoring state changes, deuce checks, intervals, and match completions execute atomically inside PostgreSQL stored procedures (`record_point_event()`) to eliminate race conditions and client-side tampering.
- **NFR-SUPA-03 (Supabase Storage Image Transformation):** Client asset delivery utilizes built-in Supabase Storage Image Transformation (`?width=400&format=webp`) for instant, bandwidth-efficient mobile rendering without server-side image processing overhead.
- **NFR-SUPA-05 (PostgreSQL Trigram Search):** Global platform search leverages PostgreSQL `pg_trgm` extension for fuzzy search across public tournaments, teams, and athletes in $< 50\text{ ms}$.
- **NFR-PERF-01 (Multi-Tenant Isolation):** Database queries MUST strictly include tenant scoping filters. Cross-tenant leakage is guarded by Supabase RLS policies.
- **NFR-PERF-02 (Sub-Second Live Propagation):** Realtime score distribution across WebSockets $< 800\text{ ms}$; Edge HTTP polling fallback $< 2.5\text{ s}$.
- **NFR-USE-01 (Brand Accessibility):** Automated WCAG 2.1 AA luminance checking for all custom brand color selections.
- **NFR-AVAIL-01 (Permanent Event Archiving):** Completed tournaments remain accessible indefinitely under their permanent slug as a permanent digital record for colleges and clubs.

### 6.1 Security Requirements (Phase 0, mandatory)
- **SEC-01 (Row-level security everywhere):** Every table in the `public` schema has RLS enabled with explicit policies. A table without policies is a defect.
- **SEC-02 (Owner-only writes):** Inserts, updates and deletes on tournament data are allowed only when `auth.uid()` owns the parent tournament. Anonymous visitors have read-only access to tournaments that are not in `DRAFT`.
- **SEC-03 (Hardened database functions):** Any `SECURITY DEFINER` function sets an empty `search_path`, checks tournament ownership itself, and is not executable by the `anon` role.
- **SEC-04 (Immutable match log):** `match_events` cannot be updated or deleted by any client. Scores change only through the scoring function; clients cannot write score columns directly.
- **SEC-05 (Storage ownership):** Uploads go to `tournament-media/{tournament_id}/…` and are allowed only for that tournament's owner. Only JPEG, PNG and WebP up to 5 MB are accepted; SVG is rejected.
- **SEC-06 (Input validation):** All server actions validate input lengths, formats (slug, URLs, dates) and enums on the server before touching the database; the database repeats the critical checks as constraints.
- **SEC-07 (Safe redirects):** Post-login redirects accept only same-site relative paths, never absolute or protocol-relative URLs.
- **SEC-08 (Session handling):** Sessions are refreshed by the Next.js proxy and verified on the server with Supabase Auth before any privileged action. Signed-out users are redirected away from `/dashboard`.
- **SEC-09 (HTTP security headers):** Responses include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict `Referrer-Policy`, a restrictive `Permissions-Policy`, and HSTS.
- **SEC-10 (Data minimisation):** Only data needed to run the event is stored. Player records hold a name and an optional club.
- **SEC-11 (Secrets):** Only the publishable key is shipped to the browser. Service-role keys are never used by the web app.

---

## 7. Product Scope & Release Prioritization (P0 / P1 / P2)

```
+-----------------------------------------------------------------------------------------+
|                                    REVISED ROADMAP                                      |
+-----------------------------------------------------------------------------------------+
| [P0] CORE MVP (Must Launch Tomorrow — Pilot College Deployment)                         |
|  - Multi-tenant architecture (Generic platform; no hardcoded college branding)          |
|  - Independent Organizer Tournament Creation Wizard                                     |
|  - Custom Tournament Name, Subtitle, Description, and Organizing Entity Name            |
|  - Custom Tournament Logo and Cover Banner upload                                       |
|  - Venue Name, Address, and Date configuration                                          |
|  - Unique shareable tournament slug (e.g., /t/mit-badminton-2026)                        |
|  - Branded Public Microsite Header with "Powered by ShuttleLive" badge                  |
|  - Core Tournament Management (Categories, Singles/Doubles entries, Courts)             |
|  - Scoring Presets (3x21 BWF and 3x15 BAI domestic)                                     |
|  - Knockout Bracket Generator (Auto-Byes) + Manual Fixture Editor                       |
|  - 1-Tap Organizer Scoring Board (Points, Service side, Undo, Interval, Confirm)        |
|  - Realtime Live Scoreboard & Direct WhatsApp Match Share                               |
+-----------------------------------------------------------------------------------------+
| [P1] FAST FOLLOW-UP (Multi-Tenant Growth)                                               |
|  - Organization Workspaces (Shared teams, reusable logos, multiple tournaments)         |
|  - Appearance Studio (Primary & Accent color picker with contrast validation)           |
|  - Sponsor & Partner Logo Strip (Title, Associate, Powered-by tiers)                    |
|  - Modular Section Visibility Toggles (Show/Hide Sponsors, Venue Map, Rules)            |
|  - Venue Google Maps Embed & Interactive Directions                                     |
|  - Printable Stadium QR Codes with Custom Tournament Branding                           |
|  - Tournament Duplication & Seasonal Templates                                          |
|  - Post-Event Hall of Fame & Champions Podium Showcase                                  |
|  - Automated Fact-Based Text Commentary & Standalone Quick Matches                      |
+-----------------------------------------------------------------------------------------+
| [P2] ENTERPRISE & PRO ECOSYSTEM                                                         |
|  - Custom Domain Mapping (e.g., badminton.mitmuzaffarpur.org)                           |
|  - White-Labeling (Remove "Powered by ShuttleLive" for enterprise tiers)                |
|  - Organization-Wide Public Landing Portals (Listing all club tournaments)              |
|  - Advanced Video Live Stream Overlay Integration                                       |
|  - Player Registration & Payment Gateways                                               |
+-----------------------------------------------------------------------------------------+
```

---

## 8. Cross-Document References
- **Architecture & Multi-Tenant Schema:** [`docs/ARCHITECTURE.md`](file:///D:/ShuttleLive/shuttlelive/docs/ARCHITECTURE.md)
- **UI Inventory, Branding Studio & Wireframes:** [`docs/UI_UX.md`](file:///D:/ShuttleLive/shuttlelive/docs/UI_UX.md)
- **Implementation Tasks & QA Test Cases:** [`docs/IMPLEMENTATION_PLAN.md`](file:///D:/ShuttleLive/shuttlelive/docs/IMPLEMENTATION_PLAN.md)
- **Central Documentation Hub:** [`docs/README.md`](file:///D:/ShuttleLive/shuttlelive/docs/README.md)

---

## 9. Deferred: Delegated Scoring (not in Phase 0)
A separate umpire role (court PINs, magic links or OTP) was removed from Phase 0 because a PIN that unlocks scoring is a shared secret that is easy to leak or guess, and it splits accountability for the match record. If delegated scoring returns, it must: be scoped to a single match, expire, be revocable by the organizer, be rate limited, bind to one device at a time, and record who entered each point.
