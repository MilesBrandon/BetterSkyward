# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Exclusively Alpine School District secondary students tracking their academic coursework, grades, missing assignments, GPA, and graduation credits.

## Product Purpose
Deliver a high-speed, distraction-free, anti-card client and modern UI alternative to Skyward Qmlativ's slow, cluttered web portal. It bypasses nested iframes and sluggish portal overhead to give students immediate, high-density visibility into course section breakdowns, grade categories, term/cumulative GPAs, and real-time status updates.

## Positioning
An API-first direct reverse proxy client that interacts directly with Alpine School District's internal Qmlativ GetBrowse and StudentSTS endpoints, bypassing DOM scraping and official iframe bloat to present grades with the density, precision, and speed of a professional financial terminal or developer tool.

## Operating Context
Secondary students checking course grades, checking active vs. upcoming semester coursework, auditing grade category weights, reviewing missing assignments before deadlines, and tracking cumulative/term GPA and earned graduation credits during the school year. Accessed via desktop and mobile browsers against Alpine School District's authentication system (`skyq.alpinedistrict.org`).

## Capabilities and Constraints
- Direct headless authentication negotiation via `/StudentSTS` (CSRF antiforgery tokens, `SessionIDStudent`, `LoginHistoryIdentifier-Student`).
- Direct querying and parsing of internal Qmlativ browse endpoints (`StudentGrades`, `StudentGPA`).
- Zero-dependency Node.js HTTP server (`server.js`) with native ES modules.
- Ephemeral multi-tenant in-memory session store with 10-minute inactivity timeouts; zero disk writes to guarantee container security.
- Strict 3px maximum border-radius restraint across all containers, inputs, chips, and buttons.
- Tabular figures (`JetBrains Mono`, `tabular-nums`) for all grades, dates, credits, and metrics.
- Multi-term discernment: active Semester 1 vs upcoming Semester 2 coursework without synthetic placeholder categories or phantom grades.
- Course nickname engine stored in browser `localStorage`.
- Dedicated Course & Assignment Inspector drawer with category weights and detailed assignment rosters.

## Brand Commitments
- Name: BetterSkyward.
- Aesthetic Philosophy: Anti-card, high-density layout inspired by Linear, GitHub, and Shadcn.
- Anti-AI Slop Rules: No dark slate backgrounds paired with cyan/purple neon blur spheres, no generic 3-column card grids, no default system fonts (Inter/Roboto/Arial), and no floating card islands.
- Palettes: Saturated, rich color atmospheres with high contrast (4 dark themes: Sapphire Cobalt, Nordic Forest, Royal Velvet, Crimson Ember; 4 light themes: Polar Azure, Solar Amber, Botanical Mint, Sakura Rose).

## Evidence on Hand
- Working zero-dependency backend reverse proxy (`src/proxy/skywardProxy.js`).
- Working HTML parser for Skyward Qmlativ GetBrowse tables (`src/proxy/skywardParser.js`).
- Mock gradebook dataset (`data/mock_grades.json`).
- High-density frontend interface with 8 custom themes (`public/index.html`, `public/css/styles.css`, `public/js/app.js`).

## Product Principles
- **Speed Over Decoration:** Zero client-side framework overhead; pure vanilla HTML/CSS/JS delivers instant rendering and responsive interaction.
- **Ledger Density Over Floating Cards:** Information is organized through structured tabular grids and contiguous 1px subtle borders rather than nested card containers and excessive whitespace.
- **Ground Truth & Data Integrity:** Official registrar metrics (unweighted cumulative GPA, weighted term GPA, official credit counts) are extracted directly from Qmlativ browse payloads, with dynamic fallbacks clearly distinguished.
- **Zero Friction Authentication:** Headless credential negotiation preserves district security tokens without exposing or persisting raw passwords.
- **High-Contrast Legibility:** Curated character-rich typography paired with vivid, tinted surface atmospheres ensures effortless scannability in both bright classrooms and low-light environments.

