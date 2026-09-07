# ⚡ BetterSkyward

A high-density, anti-card academic gradebook client and modern UI alternative for **Skyward Qmlativ**.

Inspired by **Linear**, **GitHub**, and modern **Shadcn** design systems, BetterSkyward strips out the slow, bloated legacy frames and generic "AI slop" clichés of student portals—delivering a razor-sharp, human-designed developer/finance utility for tracking academic coursework, GPA, and missing assignments.

---

## 🎯 The Vision

The default Skyward Qmlativ portal is buried under nested `<iframe>` containers, slow JavaScript bundles, and clunky navigation. **BetterSkyward** bypasses the DOM scraping approach with a direct, API-first reverse proxy that interacts directly with Qmlativ's internal GetBrowse endpoints, pairing high-speed data extraction with a grounded, high-density interface.

---

## 🚀 Core Features

### 1. Direct StudentSTS Authentication
- **Headless Credential Login**: Direct login support for Alpine School District's `/StudentSTS` portal (`https://skyq.alpinedistrict.org/StudentSTS`).
- **Ephemeral Multi-Tenant In-Memory Sessions**: Purely in-memory session management with 10-minute inactivity timeouts; zero disk writes to guarantee container and cloud security.

### 2. Three Distinct Design Presets
- **Minimalist (`data-style="minimalist"`)**: Calm surfaces, generous breathing room, elegant typographic hierarchy, and zero clutter.
- **Command Density (`data-style="command"`)**: Razor-sharp tabular ledger, monospace numbers (`JetBrains Mono`), contiguous 1px hairline dividers, and maximum information density.
- **Studio Craft (`data-style="studio"`)**: Modern software tool aesthetic (Linear / Raycast feel), matte layered obsidian and ash surfaces, crisp borders, and fluid sub-150ms micro-interactions.

### 3. Dual Operational View Modes
- **Courses & Grades View**: Immediate visibility into enrolled coursework, color-coded letter grades, category progress breakdown chips, and missing assignment badges.
- **Action & Missing Work View**: Urgent triage command center prioritizing overdue assignments, missing coursework, upcoming deadlines, and recovery points across all classes.

### 4. Dedicated Course & Assignment Inspector
- Click any course row to slide open a full inspection drawer.
- View evaluation category weights, teacher contact info, standards mastery, and complete assignment rosters with due dates, earned points, and status flags.
- Inline course nickname engine persisted in `localStorage`.

### 8. Course Nickname Engine
- Clean up messy all-caps titles (e.g. `SEC MATH 3 EXTENDED TOPICS` → `Honors Math III`).
- Edit titles inline via course rows or inside the Settings drawer; saved persistently in `localStorage`.

### 9. Dedicated Course & Assignment Inspector
- Click any course row to open a full-page inspection workspace.
- View evaluation category weights, teacher contact info, standards mastery status, and complete assignment rosters with due dates, earned points, and status flags.

---

## 🏗️ Architecture & Project Structure

```
BetterSkyward/
├── server.js                   # Zero-dependency Node.js HTTP server
├── package.json                # Project configuration & scripts
├── GEMINI.md                   # Agent steering & design constraint guidelines
│
├── src/
│   ├── proxy/
│   │   ├── skywardProxy.js     # Headless proxy, auth negotiation, parallel sync
│   │   └── skywardParser.js    # Qmlativ GetBrowse HTML, assignment & GPA parser
│   └── api/
│       └── skywardApi.js       # Client API abstraction
│
├── public/
│   ├── index.html              # Monolithic dashboard & inspector markup
│   ├── css/
│   │   └── styles.css          # High-density utility CSS, 8 themes, 3px radii
│   └── js/
│       ├── app.js              # State management, ledger rendering, theme switcher
│       └── skywardApi.js       # Client-side data fetcher
│
└── data/
    └── mock_grades.json        # Offline fallback gradebook dataset (demo mode)
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or newer.

### Installation & Launch
1. Clone or navigate to the project directory:
   ```bash
   cd "Newest Skyward"
   ```

2. Start the local server:
   ```bash
   npm start
   # or
   node server.js
   ```

3. Open your browser:
   ```
   http://localhost:3000
   ```

4. **Sign In**:
   - Click **Sign In** in the top navigation bar.
   - Enter your Skyward username and password (authenticated securely against `/StudentSTS`).
   - BetterSkyward connects, retrieves your official GPA, graduation credits, course roster, and detailed coursework.
   - *(Optional)* To test without live credentials, navigate to `http://localhost:3000/?source=mock`.

---

## 🛡️ Security & Privacy
- **Direct-to-District**: All authentication and sync requests travel strictly between your local machine and your school district's official Skyward Qmlativ servers (`https://skyq.alpinedistrict.org`).
- **No Third-Party Analytics**: Zero third-party telemetry, tracking scripts, or external databases.
- **Local Credentials**: Active session tokens and course nicknames are stored solely on your local device.

---

## 📜 License
MIT License. Created by Miles Anderson.
