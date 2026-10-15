# Validation and compatibility / 验证范围

Version 0.1.5 targets DSH 0.2.0-rc.2. Windows results below were supplied by the PR contributor on 2026-10-14 (win32 x64, real Electron desktop plus an isolated Web profile). The maintainer checked the corrected bundle on an isolated Intel macOS Electron copy on 2026-10-15. Daily profiles and the installed application were not modified.

## Contributor-reported Windows acceptance (0.1.5)

- The isolated Web profile ran the full `--tabs-ui-check` pass, and frame/long-task sampling around tab switches: six alternating switches produced 0 frame gaps above 32 ms and 0 long tasks (0.1.4 on the same machine: 5 gaps and one 55 ms long task).
- During session creation and tab switches, the flexed conversation body stayed marked in 73 of 73 samples (0.1.4 lost the override for one frame per remount, which let the strip push the composer below the fold).
- The real Electron desktop (win32, 40 px custom titlebar, `data-windows-titlebar`) rendered one strip at the expected position with a fully visible composer and zero plugin console errors.
- Install/uninstall was exercised on a byte-for-byte copy of a real desktop profile: after removal the profile directory hashes matched the baseline, `package.json` was byte-identical, `cordis*.yml` were untouched and no `node_modules` residue remained.

## Automated checks

The tests load the actual `lib/client.js` factory with a minimal DOM fixture. They cover loader metadata, lifecycle cleanup, native navigation, draft ownership, closed busy-session retention, storage parsing, cross-window focus, native-view fallback, DOM reuse, panel delegation, hidden retained session headers and delayed native-opener handoffs. Run:

```sh
node --test test/verify.mjs
```

CI runs this suite on Ubuntu, Windows and macOS with Node 22 and 24. This matrix checks plugin logic; it does not imply GUI acceptance on every operating system.

## Scroll-restoration correction and macOS check (0.1.5)

- All 42 tests pass locally, including a clamped first attempt followed by temporarily unchanged history height and later content growth. Virtual time advances through individual retries rather than flushing all timers before the content changes.
- Wheel, touch, pointer and scrolling-key input cancel restoration before its first attempt or between retries. Composer/IME input is excluded; width-control wheel forwarding is included. Unobserved scroll-position changes also stop retries.
- Restoration uses only a foreground scrollport belonging to the selected session. Remounted chat regions acquire fresh listeners, and navigation, native mode and disposal remove pending work and listeners. Retry work ends after at most six attempts (about 1.9 seconds).
- The isolated Mac Desktop loaded the corrected runtime and passed tab/native-view switching, right-sidebar open/collapse, equal native/proxy control dimensions, one strip, one native main view, no iframe, and visible-composer checks.
- With synthetic long content in that Desktop copy, a native wheel event after returning to a tab moved the transcript to a new position. The position remained unchanged after the full retry window. No model request was needed for this check.
- The contributor's Windows performance figures were not independently remeasured on macOS. These checks establish the scroll correction and native layout compatibility, not a uniform tab-switch latency guarantee.

## Real UI

- An isolated Web profile used synthetic sessions and a local delayed-streaming model to check tab switching, independent background work, close/reopen behavior and native sidebar preservation.
- For the 0.1.4 fix, the Web profile also loaded `dsh-better-sidebar` to compare its original bottom-workbench control with the top-row proxy. Both use a 28px target and a 16px bottom icon, aligned with the native 28px right-sidebar control and its 15px icon.
- Repeated open/collapse clicks during three animation cycles produced 253 sampled frames with no bottom/right target overlap or bottom-workbench misclick. The temporarily disabled remount placeholder is covered separately by the delayed-handoff regression test.
- An isolated Electron copy checked native/tab view switching, opening and collapsing the right sidebar, and identical open/collapse control coordinates and dimensions. It loaded the native right sidebar and this plugin; bottom-workbench verification used the Web combination above.
- Both environments retained one native main view, one tab strip and no iframe. The public image is a crop of the real Web UI with synthetic session names. Private profiles, recordings, authentication URLs and raw evidence stay outside the public source and npm package.

## Limits

The center strip uses the stable `data-slot="main"` hook because DSH has no dedicated public tab-strip slot. Host layout/API changes can require a plugin update. All panels continue using native controls; missing optional native controls remain unavailable.

The existing `dsh-better-sidebar` desktop combination has a separately observed `ws://app/sidebar/ws/agent-opens` compatibility issue under `dsh-app://app/`. It also occurred without this tab plugin and was not repaired here. Do not infer full compatibility with every third-party desktop combination from the isolated checks.

Dark-theme CSS is implemented but was not separately GUI-accepted in this release. Tab switching still depends on native session loading, and visited session bindings retain memory. No unlimited-tab, fixed-memory, persistent-draft-across-restart or uniform-latency guarantee is made.

---

中文：本版本已通过真实产物测试、独立 Web 与 Electron 界面验收；右栏动画期间固定保留打开入口位置，避免底部按钮挤入点击目标。公开截图只含合成数据。CI 的跨平台测试不等于所有系统均经过 GUI 验收。宿主升级、第三方插件组合、暗色界面与大规模标签使用仍需按上述边界判断。
