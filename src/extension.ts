import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { PROVIDER, fetchOpenCodeGoUsage } from "./usage.ts";

/**
 * Registers OpenCode Go as a usage source with gentle-shell, which is what feeds
 * the status bar segment and the `/gentle:usage` panel behind `alt+u`.
 *
 * Gentle Shell ships built-in usage readers for Codex, Claude and NaN Cloud only.
 * For any other provider it accepts a source registered on Pi's event bus, and
 * treats it exactly like a built-in one. Plain Pi has no listener for this event,
 * so the extension is a no-op there and needs no guard.
 */
export default function (pi: ExtensionAPI) {
	const register = () => {
		pi.events.emit("gentle-pi:usage-source/v1", {
			schema: "gentle-pi.usage-source/v1",
			provider: PROVIDER,
			// Shown in the panel until the first snapshot lands.
			pendingNote: "opencode-go · press r to fetch",
			fetch: fetchOpenCodeGoUsage,
		});
	};

	// Re-registering the same provider replaces the source, so emitting on every
	// session start is safe and keeps load order irrelevant.
	pi.on("session_start", () => register());
}
