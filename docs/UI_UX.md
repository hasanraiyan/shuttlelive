# UI / UX Specification & Screen Inventory
## Badminton Live (ShuttleLive) — Multi-Tenant Branded Microsite Design

**Document Version:** 1.2.0  
**Status:** Draft — Pending Review  
**Design System:** Tailwind CSS v4, shadcn/ui, Lucide React, Mobile-First Responsive

---

## 1. Complete Screen Inventory

```
ShuttleLive Web Application
 │
 ├── 1. PUBLIC BRANDED MICROSITE (Zero-Login Public Experience)
 │    ├── S-PUB-01: Global ShuttleLive Directory & Active Tournament Feed
 │    ├── S-PUB-02: Global Search & Filter
 │    ├── S-PUB-03: Branded Tournament Hub (/t/[slug])
 │    │    ├── Hero Header (Banner, Logo, Host, Venue, Dates, Share)
 │    │    ├── Active Court Overview ("Court 1: Aman vs Rahul")
 │    │    ├── Modular Tabs: Overview, Live, Fixtures, Results, Brackets, Rules, Sponsors
 │    │    └── "Powered by ShuttleLive" Unobtrusive Platform Badge
 │    ├── S-PUB-04: Live Match Center (Cricbuzz-Style Scoreboard & Commentary)
 │    ├── S-PUB-05: Interactive Tournament Brackets (Pan/Zoom)
 │    ├── S-PUB-06: Order of Play / Court Schedule
 │    ├── S-PUB-07: Completed Match Results & Game Analytics
 │    ├── S-PUB-08: Player Profile & Tournament History
 │    ├── S-PUB-09: Stadium Fullscreen / Projector Mode (Dark & High Contrast)
 │    └── S-PUB-10: Post-Event Hall of Fame & Champions Podium Showcase
 │
 ├── 2. ORGANIZER ADMINISTRATION CONSOLE
 │    ├── S-ORG-01: Organizer Dashboard ("My Tournaments")
 │    ├── S-ORG-02: 4-Step Tournament Creation Wizard
 │    ├── S-ORG-03: Team, Department & Player Management (CSV Import)
 │    ├── S-ORG-04: Category & Scoring Rule Configuration
 │    ├── S-ORG-05: Draw / Bracket Generator & Manual Fixture Editor
 │    ├── S-ORG-06: Court Scheduling & Conflict Matrix
 │    ├── S-ORG-07: (removed in v1.3 — no scorer delegation in Phase 0)
 │    ├── S-ORG-08: Tournament Announcements Broadcast
 │    ├── S-ORG-09: Post-Finalization Result Correction & Audit Log
 │    ├── S-ORG-10: Appearance & Branding Studio (Logo, Banner, Colors, Toggles)
 │    ├── S-ORG-11: Organization Workspace & Reusable Assets [P1]
 │    └── S-ORG-12: Tournament Duplication & Seasonal Template Modal [P1]
 │
 └── 3. ORGANIZER SCORING CONSOLE (signed-in tournament owner only)
      ├── S-SCR-01: Match picker inside the organizer dashboard
      ├── S-SCR-02: Pre-Match Toss, Serving Choice & Court End Confirmation
      ├── S-SCR-03: Live 1-Tap Scoring Board (Points, Service, Undo, Let, Fault)
      ├── S-SCR-04: Interval & End Change Modal (60s / 120s Timers)
      ├── S-SCR-05: Provisional Match Won & Official Result Confirmation
      └── S-SCR-06: Match Termination Modal (Walkover, Retirement, Disqualification)
```

---

## 2. Branded Public Microsite Wireframe (`/t/[slug]`)

```
+--------------------------------------------------------------------------------+
|  [ ShuttleLive Logo ]                                          [ Share ↗ ]     |
+--------------------------------------------------------------------------------+
|  ========================= COVER BANNER (16:9 or 3:1) ======================== |
|                                                                                |
|    [ EVENT LOGO ]   MIT BADMINTON CHAMPIONSHIP 2026                            |
|    (1:1 Square)     Organized by MIT Muzaffarpur                               |
|                     ● LIVE NOW  ·  25-27 Nov 2026  ·  College Badminton Court  |
|                                                                                |
+--------------------------------------------------------------------------------+
|  [ Overview ]  [ Live (2) ]  [ Fixtures ]  [ Results ]  [ Brackets ]  [ Rules ]|
+--------------------------------------------------------------------------------+
|                                                                                |
|  ● ON COURT NOW                                                                |
|  +-------------------------------------+  +---------------------------------+  |
|  | COURT 1 · MEN'S SINGLES (FINAL)     |  | COURT 2 · MEN'S DOUBLES (SEMI)  |  |
|  | Aman Kumar (IT)      1  [ 18 ] 🏸   |  | Ravi / Vivek       0  [ 12 ]    |  |
|  | Rahul Sharma (CSE)   0  [ 16 ]      |  | Rohit / Ankit      0  [ 14 ] 🏸 |  |
|  | Game 2 · Best of 3                  |  | Game 1 · Best of 3              |  |
|  +-------------------------------------+  +---------------------------------+  |
|                                                                                |
|  VENUE & SCHEDULE                                                              |
|  📍 College Indoor Badminton Arena, Muzaffarpur, Bihar   [ Get Directions ↗ ]  |
|                                                                                |
|  SPONSORS & PARTNERS (Gracefully collapses if none configured)                 |
|  [ Title: State Sports Council ]  [ Associate: Yonex India ]  [ Red Bull ]     |
|                                                                                |
+--------------------------------------------------------------------------------+
|  Powered by ShuttleLive · Badminton Tournament Management System               |
+--------------------------------------------------------------------------------+
```

---

## 3. Appearance & Branding Studio Wireframe (S-ORG-10)

```
+--------------------------------------------------------------------------------+
|  < Tournament Settings / Appearance & Branding                   [ Save Draft ]|
+--------------------------------------------------------------------------------+
|                                                                                |
|  1. VISUAL ASSETS                                                              |
|  Tournament Logo (Square 1:1, max 2MB):                                        |
|  [ Upload Logo ]  -> Preview: [ 100x100 Logo Card ]  [ Crop / Replace ]        |
|                                                                                |
|  Cover Banner (1920x640, max 5MB):                                             |
|  [ Upload Banner Image ] -> Preview: [ Cropped Banner Header Preview ]         |
|                                                                                |
|  2. ORGANIZING ENTITY BRANDING                                                 |
|  Organization / Club Name: [ MIT Muzaffarpur                       ]           |
|  Tagline / Subtitle:       [ Annual Inter-Department Championship  ]           |
|  Contact Email:            [ sports@mitmuzaffarpur.org             ]           |
|  Hashtag:                  [ #MITSmash2026                         ]           |
|                                                                                |
|  3. THEME & COLORS [P1]                                                        |
|  Primary Color:  [ #0F172A ] [ Color Picker ]  (Luminance Pass: WCAG AA ✓)     |
|  Accent Color:   [ #10B981 ] [ Color Picker ]  (Luminance Pass: WCAG AA ✓)     |
|                                                                                |
|  4. MODULAR SECTION VISIBILITY (Graceful Degradation)                          |
|  [x] Show Active Court Scoreboards       [x] Show Interactive Brackets         |
|  [x] Show Venue Google Map Link          [ ] Show Sponsors & Partners          |
|  [x] Show Rules & Regulations            [x] Show Awards & Prizes              |
|                                                                                |
|  ----------------------------------------------------------------------------  |
|  [ Desktop Preview ]   [ Mobile Preview ]                 [ PUBLISH CHANGES ]  |
+--------------------------------------------------------------------------------+
```

---

## 4. Post-Event Hall of Fame Showcase Wireframe (S-PUB-10)

When a tournament concludes and transitions to `COMPLETED`:

```
+--------------------------------------------------------------------------------+
|  MIT BADMINTON CHAMPIONSHIP 2026                                  COMPLETED 🏆 |
+--------------------------------------------------------------------------------+
|                                                                                |
|                           TOURNAMENT PODIUM & WINNERS                          |
|                                                                                |
|               🥇 GOLD                       🥈 SILVER              🥉 BRONZE   |
|            [Aman Kumar]                  [Rahul Sharma]          [Aditya Roy]  |
|             (IT Dept)                       (CSE Dept)             (ECE Dept)  |
|                                                                                |
|  CATEGORIES:                                                                   |
|  • Men's Singles Champion: Aman Kumar (IT)                                     |
|  • Women's Singles Champion: Sneha Patel (Civil)                               |
|  • Men's Doubles Champions: Ravi Verma & Vivek Raj (Mechanical)                |
|                                                                                |
|  [ View Complete Match Archives ]        [ Download Official Results PDF 📥 ]  |
+--------------------------------------------------------------------------------+
```

---

## 5. Color Contrast & Accessibility Rules

To guarantee readability under direct sunlight in indoor/outdoor gymnasiums:
1. **Luminance Calculation:** When an organizer specifies a `primary_color`, the system calculates relative luminance:
   $$L = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$$
2. **Text Contrast Auto-Inversion:**
   - If $L < 0.4$, header typography defaults to `#FFFFFF` (High-contrast pure white).
   - If $L \ge 0.4$, header typography defaults to `#0F172A` (Deep slate).
3. **Touch Ergonomics Preservation:**
   - Custom branding is strictly applied to banners, badges, and headers.
   - **The Live Scorer Court Interface (S-SCR-03) preserves standard high-visibility system colors** (Emerald Green for Score +1, Amber for Undo, Rose for Fault) to eliminate cognitive confusion for the person scoring (umpires.
