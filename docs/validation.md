# Validation and compatibility / 验证范围

Version 0.1.5, checked on 2026-10-14 against DSH 0.2.0-rc.2 on Windows (win32 x64, real Electron desktop plus the isolated Web profile). Version 0.1.4 was checked on macOS against the same host version; the accepted runtime bundle is unchanged for the public release; publication adds documentation, metadata and source-distribution safeguards.

## Windows acceptance (0.1.5)

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
