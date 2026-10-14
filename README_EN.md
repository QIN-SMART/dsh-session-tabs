# Lightweight Session Tabs

A single-client DSH tab strip that reuses the native conversation and task services. Both sidebars and the bottom workbench remain native. No iframe or runtime dependencies.

[中文](README.md) · Version 0.1.4 · MIT

[![verify](https://github.com/QIN-SMART/dsh-session-tabs/actions/workflows/verify.yml/badge.svg)](https://github.com/QIN-SMART/dsh-session-tabs/actions/workflows/verify.yml)
[![npm](https://img.shields.io/npm/v/dsh-session-tabs.svg)](https://www.npmjs.com/package/dsh-session-tabs)

![Tab strip and panel controls using synthetic sessions](https://raw.githubusercontent.com/QIN-SMART/dsh-session-tabs/main/docs/assets/session-tabs.png)

## Status and compatibility

Validated against **DSH 0.2.0-rc.2** and licensed under MIT. The host API is evolving; repeat acceptance checks after upgrades.

## Behavior

Opening a session through the native sidebar adds a tab. Click to switch, use `＋` to create through native navigation, and `×` to close a tab. Closing does not stop, archive, or delete a session. Busy sessions keep an extra reference until idle. The compact window-shaped line icon in the footer toggles the strip; its tooltip names the target view. Cmd/Ctrl + Shift + T reopens a recently closed tab while the strip has focus; this is not a global composer shortcut.

The active tab uses the native content surface and curved lower joins. Inactive tabs sit on a darker strip and receive one hover highlight spanning both title and close button. Colors follow the host theme. `＋` follows the tab list, aligned with the close icons; the options button has been removed. Bottom-workbench and right-sidebar controls sit at the right end of the same row. They reuse native icons/state and forward clicks to native controls without reparenting React nodes. When the right sidebar opens, its top-row proxy disappears and only the native collapse button at the window's right edge remains. The opener matches its 28px button and 15px icon. Other header controls remain in place. Missing native controls hide their corresponding top-row entry; native view and disposal restore the originals.

Drag to reorder. With a tab focused, Left/Right switches tabs; Alt + Shift + Left/Right moves one. There are no new global input shortcuts, and IME composition is guarded. Status symbols indicate running, attention required, completed unread, or connecting; idle indicators are hidden.

The right opener keeps a reserved slot throughout animations, so the bottom button cannot slide into its click target. A temporarily disabled placeholder covers native remount gaps. Both buttons use 28px targets on one center line; the bottom icon retains its native 16px size. Native panel attributes and foreground session visibility are tracked without reacting to streaming chat text.

Concurrent sessions still share host resources. File editing conflicts and external provider concurrency/rate limits remain the responsibility of the host and provider.

## Install and remove

Try an isolated profile first. Add the npm package `dsh-session-tabs` in the DSH plugin manager, or install into a Web profile with:

```sh
dsh plugin --profile web add dsh-session-tabs@0.1.4
```

GitHub installation:

```sh
dsh plugin --profile web add github:QIN-SMART/dsh-session-tabs
```

For Desktop, add `dsh-session-tabs` in the application's plugin manager. The CLI reserves the `desktop` profile name, so do not substitute it into the Web command. Existing local installations can update to `dsh-session-tabs@0.1.4` using their target profile's package manager, then quit and reopen the application. The npm package excludes the development model and test profiles.

To temporarily revert, choose Native view. For full removal, remove the package through the target profile's plugin manager and reload; DOM, styles, subscriptions, and references are cleaned up. The local tab preference key remains until cleared.

## State and limits

`localStorage['dsh-session-tabs.v1']` stores tab IDs, ordering, enabled preference, and active identity. Restored inactive tabs do not eagerly load history. Visited tabs retain a lightweight native session binding to preserve native drafts and attachments; memory still grows with visited sessions. This plugin does not guarantee draft persistence across restarts.

Cross-window updates do not steal native focus. Invalid and archived IDs are pruned. The center mount uses stable `data-slot="main"`; there is no dedicated official tab strip slot, so host layout changes remain a compatibility risk. No sidebar/rightbar slot is replaced and no rightbar method is proxied.

Tab DOM is reused by identity, direct tab actions refresh immediately, and background notifications/storage writes are coalesced. Native conversation loading still controls overall latency. See [validation and limits](docs/validation.md); consistent end-to-end speed improvement is not established.

## Development

```sh
node --test test/verify.mjs
node tools/start-test-profile.mjs --runtime /absolute/path/to/installed/@deepseek-ai/dsh --port 3096
```

All test data and profile files stay under `.tmp/`. Optionally reuse an installed right sidebar package with `--better-sidebar /absolute/path/to/dsh-better-sidebar`. Select the local **Local delayed echo** model explicitly before synthetic concurrency tests; it streams for about 60 seconds without calling an external model.

`tools/real-ui-check.mjs --url-file <test-only-url-file>` checks a real browser and captures a screenshot. `--connect-port` attaches to a separately launched test Electron process. `--edge-ui-check` exercises the right-sidebar controls; adding `--handoff-ui-check` uses the synthetic sessions above to compare native bottom-button sizing and sample repeated clicks during animations. See [validation and limits](docs/validation.md).

No build step: `lib/client.js` is the actual delivered bundle. `npm pack` excludes fixtures, profile files, logs, screenshots, and test desktop copies.

## License

[MIT](LICENSE).
