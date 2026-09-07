# GEMINI.md - Agent Steering & Project Rules

## 1. Operating Protocol & Workflow (FLOW)
- Frame Before Coding: Never jump straight into code generation for non-trivial features. Outline the implementation plan, schema changes, and component hierarchy first.
- Strict Anti-Hallucination: Ground every response in the actual files in this repository. Never invent imports, utility classes, api routes, or npm packages that do not exist in the project. If a dependency is missing, explicitly state that it must be installed.
- Compiler & Error Grounding: When debugging or reviewing terminal/console outputs, address the exact error log provided. Do not guess root causes without checking the relevant source files.
- Incremental Changes: Make targeted edits. Do not rewrite entire multi-hundred-line files when modifying a single function or component.

## 2. Persistent Memory & The Feedback Loop
- Session Context Reading: At the start of a task, inspect existing workspace files and previous documentation before suggesting architectural changes.
- Self-Documenting Flywheel: After finishing a significant component, feature, or schema refactor, update the relevant local documentation or markdown notes summarizing key decisions, modified data models, and next steps so future sessions maintain full context.
- Ground Truth: Code in the workspace is authoritative over assumptions.

## 3. Frontend Aesthetics & Anti-AI Slop Rules
- Banned Defaults: Strictly avoid generic AI landing page clichés:
  - No dark slate backgrounds (#0f172a / bg-slate-900) paired with purple/cyan blur spheres (blur-3xl).
  - No uniform three-column card grids.
  - No default system fonts (Inter, Roboto, Arial, system-ui).
  - No identical rounded-2xl border border-white/10 shadow-xl wrappers on every single element.
- Typography & Scale: Use intentional, character-rich font pairings (e.g., Space Grotesk, Syne, Cabinet Grotesk, JetBrains Mono, or editorial serifs like Fraunces or Newsreader). Employ aggressive typographic scale contrast (punchy large headings against tight, legible body text).
- Layout & Composition: Prioritize asymmetry, split screens, tight sidebars, editorial grids, or intentional density over centered boilerplate hero sections.
- Color & Surfaces: Establish a distinct primary palette with high-contrast accents. When designing dark interfaces, utilize matte layered grays, warm charcoal tones, or subtle texture rather than neon radial gradients.
- Micro-Interactions: Keep interactive states fast and crisp (sub-150ms transitions). Avoid sluggish, uniform fade-in animations across every container.

## 4. Code Standards & Output Formatting
- Produce clean, semantic, accessible HTML5, modern CSS, and modular JavaScript/TypeScript.
- Keep responses focused on actionable implementation. Omit unnecessary conversational filler and preamble.