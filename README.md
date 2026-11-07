<p align="center">
  <a href="https://gentlemanprogramming.com/">
    <img src="assets/built-with-gentle-ai.webp" alt="Built with Gentle-AI" width="320">
  </a>
</p>

<h1 align="center">gentle-opencode-go</h1>

OpenCode Go subscription usage in Gentle Shell — the status bar segment and the `/gentle:usage` panel behind `alt+u`.

Gentle Shell ships built-in usage readers for Codex, Claude and NaN Cloud. OpenCode Go subscriptions have none, so `alt+u` never moves while you use an `opencode-go` model. This package registers OpenCode Go as a usage source, and Gentle Shell treats it exactly like a built-in one.

```
main ±3 │ SUPER-YOLO        deepseek-v4.1-flash · high │ ctx ▰▰▰▰▱▱▱▱ 8% │ $0.390 │ usage 5h ▰▰▱ 0% · week ▰▰▰▰▱ 44% · 30d ▰▰▰▰▰ 55% · alt+u
```

## Requirements

- Gentle Shell with a `usage-source` capable version (the event contract `gentle-pi:usage-source/v1`, documented in `docs/gentle-shell.md`)
- Pi `>= 0.85`, Node `>= 22.19`
- An `opencode-go` provider configured in Pi, with its API key stored as usual (`auth.json` or `OPENCODE_API_KEY`)

## Install

Gentle Shell has its own package command, and it matters which one you use. The standalone `gentle-shell` runs in its own home (`~/.gentle-shell/agent`), while a plain `pi install` writes to `~/.pi/agent` — the home you only see if you launch `pi` yourself.

```sh
# Standalone Gentle Shell (the usual case)
gentle-shell install npm:gentle-opencode-go

# Gentle Shell linked to an existing pi home (--link)
gentle-shell --link install npm:gentle-opencode-go

# Plain Pi
pi install npm:gentle-opencode-go
```

Or from a checkout, for development:

```sh
gentle-shell install ./gentle-opencode-go
```

Then reload (`/reload`) or restart, send one message with an `opencode-go/*` model, and open `alt+u`. Use `r` in the panel to fetch immediately.

Plain Pi has no listener for this event, so the extension is a no-op there. Its only effect is inside Gentle Shell.

## What it looks like

In the status bar, after the session cost:

```text
deepseek-v4.1-flash · high │ ctx ▰▰▱▱▱▱▱▱ 20% │ $0.661 │ usage 5h ▰▱ 4% · week ▰▰▰▰▱ 46% · 30d ▰▰▰▰▰ 56% · alt+u
```

`alt+u` opens the panel, one row per window:

```text
✿ Subscriptions
  opencode-go · OpenCode Go · updated just now
    OpenCode Go 5h    ▰▱▱▱▱▱▱▱  4% · resets in 3h 16m
    OpenCode Go week  ▰▰▰▰▱▱▱▱ 46% · resets in 1d 7h
    OpenCode Go 30d   ▰▰▰▰▰▱▱▱ 56% · resets in 17d 5h
```

The percentages are what the endpoint answered at the last refresh, never an average or an estimate.

## How it works

One authenticated, read-only `GET` to a fixed route:

```
https://opencode.ai/zen/go/v1/usage
```

That is the same route the OpenCode console uses for the workspace dashboard. It answers with three windows, each a used percentage and a reset time:

```json
{ "usage": {
  "rolling": { "status": "ok", "percent": 0,  "resetsAt": "2026-11-07T19:45:51.000Z" },
  "weekly":  { "status": "ok", "percent": 44, "resetsAt": "2026-11-09T00:00:00.000Z" },
  "monthly": { "status": "ok", "percent": 55, "resetsAt": "2026-11-24T21:47:15.000Z" }
} }
```

The API key is the one Pi already holds for the provider. It is passed in by Gentle Shell at fetch time, used only in the `Authorization` header, and never stored, logged or returned.

## Security

This package handles a credential, so its behaviour is deliberately narrow and auditable:

- **One destination, hardcoded.** The only URL literal in the source is `https://opencode.ai/zen/go/v1/usage`. There is no configuration, argument or environment variable that can point the bearer anywhere else.
- **No redirects.** The request uses `redirect: "error"`, so a `3xx` cannot replay the token to another origin.
- **Read-only.** Only `GET`. No writes to disk, no changes to `settings.json`, `auth.json` or any other file, no shell, no `eval`.
- **No logging, no telemetry.** The source contains no `console.*`, no stream writes and no analytics. Failures resolve to `undefined` and are reported to you only as Gentle Shell's generic, non-secret "fetch failed" note.
- **The key never leaves the header.** It is not part of the returned snapshot, so it cannot reach the panel, the sidebar or a session file.
- **No runtime dependencies and no install scripts.** There is no `dependencies` block and no `preinstall`/`postinstall`, so installing the package executes nothing.
- **Defensive parsing.** The payload is foreign JSON: every field is checked and rebuilt, never merged into an existing object, so a hostile payload cannot pollute a prototype or crash the shell.

Review the source before installing any third-party package: it is two files under `src/`.

## Known limits

- **Window lengths are not published by the endpoint.** The labels `5h`, `week` and `30d` are fixed in the source. The month is approximated at 30 days. These only drive the label, the meter width and the ordering; the percentage and the reset time always come from the server.
- **`status` has no published meaning** beyond the `"ok"` value the endpoint returns today. It is never interpreted: the percentage is always shown as reported, and any other status only raises the limit flag.
- **The endpoint can trail the OpenCode console by a point.** While usage is advancing, `GET /zen/go/v1/usage` has been observed reporting one point less than the workspace dashboard on all three windows at once (dashboard 2/46/56 against endpoint 1/45/55). The gap is on OpenCode's side: this package reports exactly what the endpoint answers, never a smoothed or adjusted value. The two surfaces are usually identical, so treat the dashboard as the leading indicator while a window is moving.
- **The endpoint is outside OpenCode's published OpenAPI**, so its shape may change. A malformed or empty payload is dropped rather than guessed, which means the segment can disappear instead of showing wrong numbers.
- **It reflects the subscription, not this session.** Usage you spend in the OpenCode CLI counts too.

## Development

```sh
npm install
npm run verify   # tsc --noEmit, then node --test
```

## License

MIT — see [LICENSE](LICENSE).

The Gentle-AI rose is the mark of [Gentleman Programming](https://gentlemanprogramming.com/), used here only to say what this package targets. This is a community package: it is not an official Gentleman Programming release.
