# Changelog

## [0.1.0] - 2026-11-07

Initial release.

- Registers OpenCode Go as a Gentle Shell usage source (`gentle-pi:usage-source/v1`), feeding the status bar segment and the `/gentle:usage` panel behind `alt+u`.
- Reads the official read-only endpoint `GET https://opencode.ai/zen/go/v1/usage` with the API key Pi already holds for the `opencode-go` provider.
- Shows the rolling 5h, weekly and calendar-month windows with their percentages and reset times.
- Refuses redirects so the bearer token cannot be replayed, and parses the payload defensively: malformed windows are dropped, never guessed.
