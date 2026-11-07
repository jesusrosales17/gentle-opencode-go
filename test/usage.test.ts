import assert from "node:assert/strict";
import { test } from "node:test";

import {
	fetchOpenCodeGoUsage,
	parseOpenCodeGoUsage,
	reportsLimitReached,
} from "../src/usage.ts";

const REAL_PAYLOAD = {
	usage: {
		rolling: { status: "ok", percent: 0, resetsAt: "2026-11-07T19:45:51.000Z" },
		weekly: { status: "ok", percent: 44, resetsAt: "2026-11-09T00:00:00.000Z" },
		monthly: { status: "ok", percent: 55, resetsAt: "2026-11-24T21:47:15.000Z" },
	},
};

test("reads the three windows of a real payload in order", () => {
	const windows = parseOpenCodeGoUsage(REAL_PAYLOAD);
	assert.deepEqual(
		windows.map((window) => [window.label, window.usedPercent, window.windowSeconds]),
		[
			["5h", 0, 18_000],
			["week", 44, 604_800],
			["30d", 55, 2_592_000],
		],
	);
	assert.equal(windows[1]?.resetAt, Date.parse("2026-11-09T00:00:00.000Z"));
});

test("drops a malformed window and keeps the rest", () => {
	const windows = parseOpenCodeGoUsage({
		usage: {
			rolling: { status: "ok", percent: "half", resetsAt: null },
			weekly: { status: "ok", percent: 44, resetsAt: "nonsense" },
			monthly: { status: "ok", percent: 55, resetsAt: "2026-11-24T21:47:15.000Z" },
		},
	});
	assert.deepEqual(
		windows.map((window) => window.label),
		["week", "30d"],
	);
	assert.equal(windows[0]?.resetAt, null, "an unparsable reset time becomes null, never NaN");
});

test("returns no windows for payloads it does not understand", () => {
	for (const payload of [undefined, null, {}, { usage: null }, { usage: [] }, { usage: "x" }]) {
		assert.deepEqual(parseOpenCodeGoUsage(payload), [], `payload ${JSON.stringify(payload)}`);
	}
});

test("an absent or null status is not a reached limit", () => {
	const payload = { usage: { ...REAL_PAYLOAD.usage, weekly: { status: null, percent: 44, resetsAt: null } } };
	assert.equal(reportsLimitReached(payload), false);
	assert.deepEqual(reportsLimitReached({ usage: { weekly: { percent: 44 } } }), false);
});

test("a status other than ok raises the limit flag without hiding the percentage", () => {
	const payload = { usage: { ...REAL_PAYLOAD.usage, weekly: { status: "blocked", percent: 44, resetsAt: null } } };
	assert.equal(reportsLimitReached(payload), true);
	assert.equal(parseOpenCodeGoUsage(payload)[1]?.usedPercent, 44);
});

test("an all-ok payload reports no reached limit", () => {
	assert.equal(reportsLimitReached(REAL_PAYLOAD), false);
	assert.equal(reportsLimitReached({}), false);
});

test("no API key means no request and no snapshot", async () => {
	let calls = 0;
	const fetchFn = (async () => {
		calls += 1;
		return Response.json(REAL_PAYLOAD);
	}) as unknown as typeof fetch;
	assert.equal(await fetchOpenCodeGoUsage(undefined, fetchFn, 1), undefined);
	assert.equal(calls, 0);
});

test("sends the key as a bearer and refuses redirects", async () => {
	let seen: { url: string; init: RequestInit | undefined } | undefined;
	const fetchFn = (async (url: string, init?: RequestInit) => {
		seen = { url, init };
		return Response.json(REAL_PAYLOAD);
	}) as unknown as typeof fetch;
	await fetchOpenCodeGoUsage("secret", fetchFn, 1);
	assert.equal(seen?.url, "https://opencode.ai/zen/go/v1/usage");
	assert.equal(seen?.init?.redirect, "error");
	assert.equal((seen?.init?.headers as Record<string, string>).Authorization, "Bearer secret");
});

test("a failed response yields no snapshot", async () => {
	const fetchFn = (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
	assert.equal(await fetchOpenCodeGoUsage("secret", fetchFn, 1), undefined);
});

test("a payload without usable windows yields no snapshot", async () => {
	const fetchFn = (async () => Response.json({})) as unknown as typeof fetch;
	assert.equal(await fetchOpenCodeGoUsage("secret", fetchFn, 1), undefined);
});

test("the snapshot never carries the API key", async () => {
	const fetchFn = (async () => Response.json(REAL_PAYLOAD)) as unknown as typeof fetch;
	const usage = await fetchOpenCodeGoUsage("sk-very-secret-value", fetchFn, 1);
	assert.ok(usage);
	assert.equal(
		JSON.stringify(usage).includes("sk-very-secret-value"),
		false,
		"the credential must not be part of anything the panel can render",
	);
	assert.equal(
		Object.keys(usage).sort().join(","),
		"fetchedAt,limits,plan,provider",
		"only these four fields may leave the fetch",
	);
});

test("a good response becomes a provider snapshot gentle-shell can validate", async () => {
	const fetchFn = (async () => Response.json(REAL_PAYLOAD)) as unknown as typeof fetch;
	const usage = await fetchOpenCodeGoUsage("secret", fetchFn, 123);
	assert.equal(usage?.provider, "opencode-go");
	assert.equal(usage?.plan, "OpenCode Go");
	assert.equal(usage?.fetchedAt, 123);
	assert.equal(usage?.limits.length, 1);
	assert.equal(usage?.limits[0]?.limitReached, false);
	assert.equal(usage?.limits[0]?.scope, "provider");
	assert.equal(usage?.limits[0]?.windows.length, 3);
});
