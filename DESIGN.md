# Design System • BetterSkyward

<!-- impeccable:design-schema 1 -->

## Design Philosophy

BetterSkyward rejects generic AI landing-page clichés (no slate-900 backgrounds paired with cyan/purple radial blur orbs, no floating card islands, and no repetitive rounded-2xl containers). Instead, it delivers a razor-sharp, human-crafted academic workspace inspired by the precision of **Linear**, **GitHub**, and professional financial terminal utilities.

## Core Visual Modes & Presets

BetterSkyward offers 3 distinct aesthetic & density presets switchable live:

1. **Calm Minimalist (`[data-style="minimalist"]`)**
   - Ample whitespace and breathing room (`padding: 20px 24px`, `gap: 16px`).
   - Gentle hierarchy with soft card dividers and calm, distraction-free surfaces.
   - Ideal for relaxed review of coursework and reading instructor feedback.

2. **Command Density (`[data-style="command"]`)**
   - Bloomberg/Linear command view: ultra-sharp tabular alignment, zero wasted pixels.
   - Contiguous 1px hairline dividers with `0px - 2px` border radius restraint.
   - Strict monospace alignment (`JetBrains Mono`) for power students who want high-bandwidth scannability.

3. **Studio Craft (`[data-style="studio"]`)** *(Default)*
   - Modern software utility aesthetic: layered matte charcoals, crisp subtle borders, and vivid micro-chips.
   - Fluid sub-150ms transitions, tactile micro-elevations on hover, and balanced information density.

---

## Dual Operational Views

The workspace anchors user focus through two distinct operational lenses:

1. **Courses & Grades View**
   - Course health ledger highlighting Period, Course Name, Instructor, Room, Letter Grade, and Percentage.
   - Section category progress indicators (Summative, Formative, Homework) with micro progress bars.
   - Missing assignment count pills and quick drill-down chevron to open the Course Inspector.

2. **Action & Missing Work View**
   - Triage-first command center for urgent academic tasks.
   - Grouped list of overdue/missing assignments across all courses with due dates, point values, and direct teacher contact options.
   - Upcoming deadlines list for tasks due in the next 7 days.

---

## Typography

- **Primary UI & Text:** `Plus Jakarta Sans` (400, 500, 600, 700, 800)
- **Display & Section Marks:** `Space Grotesk` (500, 600, 700)
- **Tabular Numerals & Metrics:** `JetBrains Mono` (`font-variant-numeric: tabular-nums`) across all grades, percentages, credit totals, GPAs, and dates.

---

## Surface Palette & Color Tokens

### Dark Mode (Default)
- **App Canvas:** `#0f1013` (Matte Obsidian)
- **Surface Layer 1:** `#15171c` (Deep Ash)
- **Surface Layer 2 (Raised):** `#1c1f26`
- **Surface Layer 3 (Hover/Active):** `#232730` / `#2b303b`
- **Hairline Dividers:** `#242833` / `#303645`
- **Primary Text:** `#f2f4f8`
- **Secondary Text:** `#9ea7ba`
- **Muted Text:** `#656e82`

### Light Mode
- **App Canvas:** `#f5f6f9` (Chalk / Soft Gray)
- **Surface Layer 1:** `#ffffff` (Pure White)
- **Surface Layer 2 (Raised):** `#fbfcfd`
- **Surface Layer 3 (Hover/Active):** `#f0f2f6` / `#e6e9f0`
- **Hairline Dividers:** `#e1e4ed` / `#cfd4e2`
- **Primary Text:** `#12151d`
- **Secondary Text:** `#4d5568`
- **Muted Text:** `#828ca1`

### Semantic Grade Colors
- **Grade A / P:** `#10b981` (Emerald Green)
- **Grade B:** `#06b6d4` (Electric Cyan)
- **Grade C:** `#f59e0b` (Warm Amber)
- **Grade D:** `#f97316` (Deep Coral)
- **Grade F / Alert:** `#ef4444` (Crimson Rose)

