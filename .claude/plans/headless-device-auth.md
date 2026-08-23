# Plan: Headless (device) authentication mode

**Status:** Parked. Pick up once current bug-fix PRs (#94 token refresh, #95 private-events) are merged and `main` is stable.

## Motivation

Most users run this module on a headless Raspberry Pi over SSH (no monitor / no
local browser). The current auth flow is **browser-based**: the mirror shows a
"click here to authorize" link that opens Google's consent page in the *same*
browser and relies on a `localhost` redirect. That only works when there's a
display + browser on the Pi itself.

The project *originally* used Google's **OOB (out-of-band)** flow — print a URL
to the terminal, user opens it on any device, Google shows a code, user pastes
it back. Google **deprecated OOB in Oct 2022**, which forced the switch to the
browser redirect (commit `6d02236`). That fixed the deprecation but broke
headless setups.

Many users are **non-technical**, so credential-type confusion is a real
problem and must be addressed in docs.

## Proposed solution

Add a config option `authMode` with two values. **Both modes use the same
"Desktop application" (`installed`) credentials** — no new Google Cloud setup.

### `authMode: "browser"` (default — current behaviour, unchanged)
- Existing flow. Mirror shows "click here" link, approve in same browser.

### `authMode: "headless"` (new)
Use Google's **Device Authorization Grant** (RFC 8628) — the same flow as Apple
TV / smart TVs. Replacement for the dead OOB flow.

Flow:
1. node_helper POSTs to the device code endpoint to get `device_code`,
   `user_code`, `verification_url`, `interval`.
2. Send a new `AUTH_DEVICE_CODE` socket notification to the frontend with
   `{ userCode, verificationUrl }`.
3. Mirror displays prominently:
   _"Visit accounts.google.com/device and enter: **ABCD-1234**"_
4. **Also `Log.log` / console-print the same** so SSH-only users see it in
   `pm2 logs` / `journalctl` without looking at the screen.
5. node_helper polls the token endpoint every `interval` seconds until the user
   approves (or it times out), then saves `token.json` and starts calendars.

No redirect URI, no localhost port, no inbound network access to the Pi needed —
user can approve from a phone.

## Files to change
- `node_helper.js` — add device-code path in `authenticate()` (request code,
  poll for token). Branch on `this.config.authMode` (passed via `MODULE_READY`
  payload, or read from credentials/config).
- `MMM-GoogleCalendar.js` — handle `AUTH_DEVICE_CODE` notification; render the
  code + verification URL on screen. Pass `authMode` to the helper.
- `translations/en.json` — add `AUTH_DEVICE_CODE` string with `{userCode}` /
  `{verificationUrl}` placeholders.
- `README.md` — document both modes; clearly explain **which credential type to
  create** ("Desktop application" → `installed` key) and the difference, aimed
  at non-technical users (consider screenshots).

## Open questions / notes
- Confirm the device flow is enabled for "Desktop app" OAuth clients in current
  Google Cloud (it is for TV/limited-input + desktop clients; verify scopes).
- The "Testing" vs "Production" OAuth consent screen issue (7-day refresh token
  expiry) is the *other* root cause of repeated re-auth (see issue #86 / PR #94)
  and should get a README callout too — separate from this feature.
- Keep `browser` as default so existing users are unaffected.
