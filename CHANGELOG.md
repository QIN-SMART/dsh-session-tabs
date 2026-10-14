# Changelog

## 0.1.4 — 2026-10-14

- Prepare the first public GitHub/npm release with MIT licensing, bilingual install instructions, native-UI validation notes and a synthetic screenshot. Keep local evidence out of public distributions.
- Reserve the right opener's toolbar slot throughout sidebar animations, so the bottom-workbench button cannot move into its click target.
- During a native opener remount gap, show a disabled placeholder in the reserved slot; restore forwarding when the foreground native control is ready.
- Track native panel attributes immediately, prioritize active-session panel state, and ignore hidden retained headers.
- Match both buttons to 28px native targets and one center line; preserve the bottom icon's native 16px size and the right icon's 15px size.
- Add delayed-handoff and hidden-source regression cases, plus frame sampling and repeated-click real UI checks.

## 0.1.3 — 2026-10-14

- Replace the text-glyph view switch with the selected window-shaped line icon and expose its pressed state.
- Hide the center right-sidebar proxy while the sidebar is expanded; keep only the original collapse control at the window's right edge.
- Match the right opener to native sizing: 28px button and 15px icon. Preserve native control ownership and restore the opener after collapse.
- Add a regression case for open/collapse/reopen transitions and focused real-UI verification.

## 0.1.2 — 2026-10-13

- Apply the approved Obsidian-style connected tabs: bright active surface, darker strip, shared inactive hover background, and curved lower joins outside the scrolling list.
- Remove the tab options button; align vector new/close icons, hide idle indicators, and retain native sidebar/panel navigation.
- Keep the native-view footer entry; preserve reopening via Cmd/Ctrl + Shift + T scoped to the tab strip, with IME guarding.
- Retain existing DOM reuse and coalesced updates. No new end-to-end performance guarantee or daily-profile installation.

## 0.1.1 — 2026-10-13

- Place new/options controls immediately after the tabs, with workbench/right-sidebar controls at the row's right edge.
- Relay native panel clicks and copy native icons/state without moving React-managed controls; restore originals in native view and on disposal.
- Reuse tab DOM by identity, remove the fixed delay from direct actions, coalesce background notifications and storage writes.
- Add regression checks for DOM/focus preservation and panel-control delegation, plus real GUI latency observations.
- Keep delivery in the isolated test profile; overall latency remains variable and the previously recorded desktop better-sidebar limitation remains.

## 0.1.0 — 2026-10-13

- Add a single-client native center tab strip, without iframe or sidebar replacement.
- Native navigation, new/close/reopen, reorder, localized status and native-view toggle.
- Preserve visited native session bindings for drafts; closed busy tabs continue until idle.
- Restore lightweight tab IDs; guard bad storage, IME, cross-window focus and cleanup.
- Add real-bundle controller/DOM tests and isolated profile with a local delayed streaming model.
- Local delivery only; no daily profile installation or public publication.
