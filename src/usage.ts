/**
 * OpenCode Go subscription usage, read from the official read-only endpoint the
 * OpenCode console itself uses: `GET /zen/go/v1/usage`, authenticated with the
 * same API key Pi already holds for the `opencode-go` provider.
 *
 * The endpoint reports three windows — a short rolling one, a weekly one and a
 * calendar-month one — each as a used percentage plus its reset time.
 */

const ENDPOINT = "https://opencode.ai/zen/go/v1/usage";
const HOUR = 3600;

/**
 * The endpoint does not report how long its windows are, so the spans are fixed
 * here. They only drive the label, the meter width and the ordering gentle-shell
 * draws; the percentage and the reset time always come from the server. The
 * month is approximated at 30 days because no length is published for it.
 */
const WINDOWS = [
	{ key: "rolling", label: "5h", seconds: 5 * HOUR },
	{ key: "weekly", label: "week", seconds: 7 * 24 * HOUR },
	{ key: "monthly", label: "30d", seconds: 30 * 24 * HOUR },
] as const;

/**
 * Mirrors the `UsageWindow` gentle-shell validates a registered source against.
 * It is declared here because that type lives in a private module of gentle-pi,
 * so any drift in the contract is caught by gentle-shell discarding the source
 * rather than by a failed import.
 */
export interface UsageWindow {
	label: string;
	usedPercent: number;
	windowSeconds: number;
	resetAt: number | null;
}

/** Mirrors the `ProviderUsage` shape the same contract validates. */
export interface ProviderUsage {
	provider: string;
	plan: string | undefined;
	limits: {
		name: string;
		windows: UsageWindow[];
		limitReached: boolean;
		scope?: "provider";
	}[];
	fetchedAt: number;
}

interface RawWindow {
	status?: unknown;
	percent?: unknown;
	resetsAt?: unknown;
}

export const PROVIDER = "opencode-go";

/**
 * Converts one `/zen/go/v1/usage` payload into the windows gentle-shell draws.
 *
 * Pure and defensive: the payload is foreign JSON, so every field is checked and
 * anything unexpected is dropped instead of thrown. A missing or malformed window
 * is skipped, which keeps a partial payload from erasing a complete one.
 *
 * `status` is not documented beyond the `"ok"` value the endpoint returns today,
 * so its meaning is never guessed: the percentage is always trusted as the
 * number to show, and any non-`"ok"` status only marks the limit as reached.
 */
export function parseOpenCodeGoUsage(payload: unknown): UsageWindow[] {
	const usage = (payload as { usage?: Record<string, unknown> } | null | undefined)?.usage;
	if (!usage || typeof usage !== "object") return [];
	const windows: UsageWindow[] = [];
	for (const { key, label, seconds } of WINDOWS) {
		const raw = usage[key] as RawWindow | undefined;
		if (!raw || typeof raw !== "object") continue;
		if (typeof raw.percent !== "number" || !Number.isFinite(raw.percent)) continue;
		const reset = typeof raw.resetsAt === "string" ? Date.parse(raw.resetsAt) : Number.NaN;
		windows.push({
			label,
			usedPercent: raw.percent,
			windowSeconds: seconds,
			resetAt: Number.isFinite(reset) ? reset : null,
		});
	}
	return windows;
}

/** True when the payload signals a limit the percentages alone would hide. */
export function reportsLimitReached(payload: unknown): boolean {
	const usage = (payload as { usage?: Record<string, unknown> } | null | undefined)?.usage;
	if (!usage || typeof usage !== "object") return false;
	return WINDOWS.some(({ key }) => {
		const raw = usage[key] as RawWindow | undefined;
		// Only a non-empty status string is a signal; an absent or null status
		// means the endpoint said nothing, which is not a reached limit.
		return typeof raw?.status === "string" && raw.status !== "ok";
	});
}

/**
 * Fetches one usage snapshot, or `undefined` when there is nothing trustworthy
 * to show: no API key, a failed request, or a payload with no usable window.
 *
 * Redirects are refused so the bearer token cannot be replayed to another
 * origin, and the caller-owned `fetchFn` carries gentle-shell's own timeout.
 */
export async function fetchOpenCodeGoUsage(
	apiKey: string | undefined,
	fetchFn: typeof fetch,
	now: number,
): Promise<ProviderUsage | undefined> {
	if (!apiKey) return undefined;
	const response = await fetchFn(ENDPOINT, {
		headers: { Authorization: `Bearer ${apiKey}` },
		redirect: "error",
	});
	if (!response.ok) return undefined;
	const payload: unknown = await response.json();
	const windows = parseOpenCodeGoUsage(payload);
	if (windows.length === 0) return undefined;
	return {
		provider: PROVIDER,
		plan: "OpenCode Go",
		limits: [
			{
				name: "OpenCode Go",
				windows,
				limitReached: reportsLimitReached(payload) || windows.some((window) => window.usedPercent >= 100),
				scope: "provider",
			},
		],
		fetchedAt: now,
	};
}
