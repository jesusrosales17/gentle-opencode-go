# Changelog

## [0.1.2] - 2026-11-07

- Ships the built-with badge as a 640px WebP instead of a 900px PNG: the same picture at 55 kB instead of 474 kB, so the tarball stays small without a visible quality loss.

## [0.1.1] - 2026-11-07

- Ships the official "Built with Gentle-AI" badge and its credit, so the mark renders on the npm page too.
- Documents that the endpoint can trail the OpenCode workspace dashboard by a point while a window is moving.
- Documents the `gentle-shell install` command, which is the one that targets the standalone home.

## [0.1.0] - 2026-11-07

Initial release.

- Registers OpenCode Go as a Gentle Shell usage source (`gentle-pi:usage-source/v1`), feeding the status bar segment and the `/gentle:usage` panel behind `alt+u`.
- Reads the official read-only endpoint `GET https://opencode.ai/zen/go/v1/usage` with the API key Pi already holds for the `opencode-go` provider.
- Shows the rolling 5h, weekly and calendar-month windows with their percentages and reset times.
- Refuses redirects so the bearer token cannot be replayed, and parses the payload defensively: malformed windows are dropped, never guessed.
