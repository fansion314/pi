import { Type } from "typebox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stream as streamOpenAIResponses } from "../src/api/openai-responses.ts";
import { getModel } from "../src/compat.ts";
import type { AssistantMessage, Model, ToolResultMessage } from "../src/types.ts";

type CapturedHeaders = Headers | string[][] | Record<string, string | readonly string[]> | undefined;

interface CapturedResponsesPayload {
	include?: string[];
	input?: Array<Record<string, unknown>>;
	max_output_tokens?: number;
	prompt_cache_key?: string;
	prompt_cache_retention?: string;
	reasoning?: { effort?: string; summary?: string };
	session_id?: string;
	store?: boolean;
	tools?: Array<{ name?: string; strict?: boolean }>;
}

function getHeader(headers: CapturedHeaders, name: string): string | null {
	if (!headers) return null;
	if (headers instanceof Headers) return headers.get(name);

	const lowerName = name.toLowerCase();
	if (Array.isArray(headers)) {
		const match = headers.find(([key]) => key?.toLowerCase() === lowerName);
		return match?.[1] ?? null;
	}

	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === lowerName) return typeof value === "string" ? value : value.join(", ");
	}
	return null;
}

async function captureOpenAIResponseHeaders(
	options: Parameters<typeof streamOpenAIResponses>[2],
	model: Model<"openai-responses"> = getModel("openai", "gpt-5.4"),
): Promise<{
	sessionId: string | null;
	clientRequestId: string | null;
	xSessionId: string | null;
}> {
	const captured = {
		sessionId: null as string | null,
		clientRequestId: null as string | null,
		xSessionId: null as string | null,
	};
	vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
		captured.sessionId = getHeader(init?.headers, "session_id");
		captured.clientRequestId = getHeader(init?.headers, "x-client-request-id");
		captured.xSessionId = getHeader(init?.headers, "x-session-id");
		return new Response("data: [DONE]\n\n", {
			status: 200,
			headers: { "content-type": "text/event-stream" },
		});
	});

	const stream = streamOpenAIResponses(
		model,
		{
			systemPrompt: "sys",
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		},
		{ apiKey: "test-key", ...options },
	);

	for await (const event of stream) {
		if (event.type === "done" || event.type === "error") break;
	}

	return captured;
}

describe("openai-responses provider defaults", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("omits reasoning when no reasoning is requested", async () => {
		const model = getModel("github-copilot", "gpt-5-mini");
		let capturedPayload: unknown;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		const stream = streamOpenAIResponses(
			model,
			{
				systemPrompt: "sys",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test-key",
				onPayload: (payload) => {
					capturedPayload = payload;
				},
			},
		);

		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(capturedPayload).not.toBeNull();
		expect(capturedPayload).not.toMatchObject({
			reasoning: expect.anything(),
		});
	});

	it("uses DeepSeek Responses request compatibility metadata", async () => {
		const model = getModel("deepseek", "deepseek-v4-flash");
		let capturedPayload: CapturedResponsesPayload | undefined;
		let requestUrl: string | undefined;
		let capturedHeaders: CapturedHeaders;

		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			requestUrl = input instanceof Request ? input.url : String(input);
			capturedHeaders = init?.headers;
			return new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			});
		});

		const stream = streamOpenAIResponses(
			model,
			{
				systemPrompt: "Follow system instructions.",
				messages: [{ role: "user", content: "Use the tool.", timestamp: Date.now() }],
				tools: [
					{
						name: "ping",
						description: "Ping",
						parameters: Type.Object({ value: Type.String() }),
					},
				],
			},
			{
				apiKey: "test-key",
				maxTokens: 123,
				reasoningEffort: "medium",
				sessionId: "deepseek-session",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
		);

		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(model.api).toBe("openai-responses");
		expect(model.compat).toMatchObject({
			supportsDeveloperRole: false,
			sessionAffinityFormat: "openai-nosession",
			supportsLongCacheRetention: false,
		});
		expect(requestUrl).toBe("https://api.deepseek.com/responses");
		expect(getHeader(capturedHeaders, "session_id")).toBeNull();
		expect(getHeader(capturedHeaders, "x-client-request-id")).toBe("deepseek-session");
		expect(capturedPayload?.input?.[0]).toMatchObject({ role: "system" });
		expect(capturedPayload?.max_output_tokens).toBe(123);
		expect(capturedPayload?.reasoning).toEqual({ effort: "high", summary: "auto" });
		expect(capturedPayload?.prompt_cache_key).toBe("deepseek-session");
		expect(capturedPayload?.prompt_cache_retention).toBeUndefined();
		expect(capturedPayload?.store).toBe(false);
		expect(capturedPayload?.tools).toEqual([expect.objectContaining({ name: "ping" })]);
		expect(capturedPayload?.tools?.[0]).not.toHaveProperty("strict");
	});

	it("parses DeepSeek reasoning, text, function calls, and usage", async () => {
		const events = [
			{ type: "response.created", response: { id: "resp_deepseek" } },
			{
				type: "response.output_item.added",
				output_index: 0,
				item: { id: "rs_1", type: "reasoning", status: "in_progress", summary: [], content: [] },
			},
			{
				type: "response.reasoning_text.delta",
				item_id: "rs_1",
				output_index: 0,
				content_index: 0,
				delta: "thinking",
			},
			{
				type: "response.output_item.done",
				output_index: 0,
				item: {
					id: "rs_1",
					type: "reasoning",
					status: "completed",
					summary: [],
					content: [{ type: "reasoning_text", text: "thinking" }],
				},
			},
			{
				type: "response.output_item.added",
				output_index: 1,
				item: { id: "msg_1", type: "message", status: "in_progress", role: "assistant", content: [] },
			},
			{
				type: "response.output_text.delta",
				item_id: "msg_1",
				output_index: 1,
				content_index: 0,
				delta: "answer",
			},
			{
				type: "response.output_item.done",
				output_index: 1,
				item: {
					id: "msg_1",
					type: "message",
					status: "completed",
					role: "assistant",
					content: [{ type: "output_text", text: "answer", annotations: [] }],
				},
			},
			{
				type: "response.output_item.added",
				output_index: 2,
				item: {
					id: "fc_1",
					type: "function_call",
					status: "in_progress",
					call_id: "call_1",
					name: "lookup",
					arguments: "",
				},
			},
			{
				type: "response.function_call_arguments.delta",
				item_id: "fc_1",
				output_index: 2,
				delta: '{"query":"deepseek"}',
			},
			{
				type: "response.function_call_arguments.done",
				item_id: "fc_1",
				output_index: 2,
				arguments: '{"query":"deepseek"}',
			},
			{
				type: "response.output_item.done",
				output_index: 2,
				item: {
					id: "fc_1",
					type: "function_call",
					status: "completed",
					call_id: "call_1",
					name: "lookup",
					arguments: '{"query":"deepseek"}',
				},
			},
			{
				type: "response.completed",
				response: {
					id: "resp_deepseek",
					status: "completed",
					output: [],
					usage: {
						input_tokens: 12,
						output_tokens: 7,
						total_tokens: 19,
						input_tokens_details: { cached_tokens: 5 },
						output_tokens_details: { reasoning_tokens: 3 },
					},
				},
			},
		];
		const sse = `${events.map((event) => `data: ${JSON.stringify(event)}`).join("\n\n")}\n\n`;
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } }),
		);

		const result = await streamOpenAIResponses(
			getModel("deepseek", "deepseek-v4-flash"),
			{ messages: [{ role: "user", content: "Use lookup.", timestamp: Date.now() }] },
			{ apiKey: "test-key" },
		).result();

		expect(result.stopReason).toBe("toolUse");
		expect(result.responseId).toBe("resp_deepseek");
		expect(result.content).toEqual([
			{
				type: "thinking",
				thinking: "thinking",
				thinkingSignature: expect.any(String),
			},
			{ type: "text", text: "answer", textSignature: expect.any(String) },
			{ type: "toolCall", id: "call_1|fc_1", name: "lookup", arguments: { query: "deepseek" } },
		]);
		expect(result.usage).toMatchObject({
			input: 7,
			output: 7,
			cacheRead: 5,
			cacheWrite: 0,
			reasoning: 3,
			totalTokens: 19,
		});
	});

	it("preserves native DeepSeek function-call ids during replay", async () => {
		const model = getModel("deepseek", "deepseek-v4-flash");
		const assistant: AssistantMessage = {
			role: "assistant",
			api: "openai-responses",
			provider: "deepseek",
			model: model.id,
			content: [
				{
					type: "toolCall",
					id: "call_deepseek_1|fc_deepseek_1",
					name: "lookup",
					arguments: { query: "deepseek" },
				},
			],
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now() - 1000,
		};
		const toolResult: ToolResultMessage = {
			role: "toolResult",
			toolCallId: "call_deepseek_1|fc_deepseek_1",
			toolName: "lookup",
			content: [{ type: "text", text: "ok" }],
			isError: false,
			timestamp: Date.now(),
		};
		let capturedPayload: CapturedResponsesPayload | undefined;
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		const stream = streamOpenAIResponses(
			model,
			{
				messages: [{ role: "user", content: "Use lookup.", timestamp: Date.now() - 2000 }, assistant, toolResult],
			},
			{
				apiKey: "test-key",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
		);

		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		const functionCall = capturedPayload?.input?.find((item) => item.type === "function_call");
		const functionResult = capturedPayload?.input?.find((item) => item.type === "function_call_output");
		expect(functionCall).toMatchObject({
			id: "fc_deepseek_1",
			call_id: "call_deepseek_1",
			name: "lookup",
			arguments: '{"query":"deepseek"}',
		});
		expect(functionResult).toMatchObject({ call_id: "call_deepseek_1", output: "ok" });
	});

	it("forwards required tool choice", async () => {
		let capturedPayload: unknown;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		const stream = streamOpenAIResponses(
			getModel("openai", "gpt-5.4"),
			{
				messages: [
					{
						role: "user",
						content: "Do not call ping. Respond with text instead.",
						timestamp: Date.now(),
					},
				],
				tools: [
					{
						name: "ping",
						description: "Ping",
						parameters: Type.Object({ value: Type.String() }),
					},
				],
			},
			{
				apiKey: "test-key",
				toolChoice: "required",
				onPayload: (payload) => {
					capturedPayload = payload;
				},
			},
		);

		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(capturedPayload).toMatchObject({
			tool_choice: "required",
			tools: [expect.objectContaining({ name: "ping" })],
		});
	});

	it("sets strict mode explicitly for Cloudflare OpenAI Responses tools", async () => {
		const model = getModel("cloudflare-ai-gateway", "gpt-5.6-sol");
		let capturedPayload: CapturedResponsesPayload | undefined;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		const stream = streamOpenAIResponses(
			model,
			{
				messages: [{ role: "user", content: "Use a tool.", timestamp: Date.now() }],
				tools: [
					{
						name: "ordinary",
						description: "An ordinary tool",
						parameters: Type.Object({
							path: Type.String(),
							offset: Type.Optional(Type.Number()),
						}),
					},
					{
						name: "constrained",
						description: "A constrained tool",
						parameters: Type.Object({ value: Type.String() }),
						constrainedSampling: { type: "json_schema", strict: "prefer" },
					},
				],
			},
			{
				apiKey: "test-key",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
		);

		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(model.compat?.supportsStrictMode).toBe(true);
		expect(capturedPayload?.tools).toEqual([
			expect.objectContaining({ name: "ordinary", strict: false }),
			expect.objectContaining({ name: "constrained", strict: true }),
		]);
	});

	it.each([
		"gpt-5.1",
		"gpt-5.2",
		"gpt-5.3-codex",
		"gpt-5.4",
		"gpt-5.4-mini",
		"gpt-5.4-nano",
		"gpt-5.5",
		"gpt-5.6-sol",
		"gpt-5.6-terra",
		"gpt-5.6-luna",
	] as const)("sends none reasoning effort for OpenAI %s when no reasoning is requested", async (modelId) => {
		const model = getModel("openai", modelId);
		let capturedPayload: unknown;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		const stream = streamOpenAIResponses(
			model,
			{
				systemPrompt: "sys",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test-key",
				onPayload: (payload) => {
					capturedPayload = payload;
				},
			},
		);

		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(capturedPayload).toMatchObject({
			reasoning: { effort: "none" },
		});
	});

	it.each(["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-pro", "gpt-5.2-pro", "gpt-5.4-pro", "gpt-5.5-pro"] as const)(
		"omits reasoning effort for OpenAI %s when off is unsupported",
		async (modelId) => {
			const model = getModel("openai", modelId);
			let capturedPayload: unknown;

			vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response("data: [DONE]\n\n", {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				}),
			);

			const stream = streamOpenAIResponses(
				model,
				{
					systemPrompt: "sys",
					messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
				},
				{
					apiKey: "test-key",
					onPayload: (payload) => {
						capturedPayload = payload;
					},
				},
			);

			for await (const event of stream) {
				if (event.type === "done" || event.type === "error") break;
			}

			expect(capturedPayload).not.toMatchObject({
				reasoning: expect.anything(),
			});
		},
	);

	it("sets cache-affinity headers for official OpenAI Responses requests with a sessionId", async () => {
		const captured = await captureOpenAIResponseHeaders({ sessionId: "session-123" });

		expect(captured.sessionId).toBe("session-123");
		expect(captured.clientRequestId).toBe("session-123");
	});

	it("clamps prompt_cache_key to OpenAI's 64-character limit", async () => {
		const sessionId = "x".repeat(67);
		let capturedPayload: Pick<CapturedResponsesPayload, "prompt_cache_key"> | undefined;
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		const stream = streamOpenAIResponses(
			getModel("openai", "gpt-5.4"),
			{
				systemPrompt: "sys",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test-key",
				sessionId,
				onPayload: (payload) => {
					capturedPayload = payload as Pick<CapturedResponsesPayload, "prompt_cache_key">;
				},
			},
		);

		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(capturedPayload?.prompt_cache_key).toBe("x".repeat(64));
	});

	it("sets cache-affinity headers for proxy OpenAI Responses requests with a sessionId", async () => {
		const proxyModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "opencode",
			baseUrl: "https://proxy.example.com/v1",
		};
		const captured = await captureOpenAIResponseHeaders({ sessionId: "session-123" }, proxyModel);

		expect(captured.sessionId).toBe("session-123");
		expect(captured.clientRequestId).toBe("session-123");
	});

	it("uses OpenRouter session-affinity header when configured", async () => {
		const proxyModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "proxy",
			baseUrl: "https://proxy.example.com/v1",
			compat: { sessionAffinityFormat: "openrouter" },
		};
		let capturedPayload: CapturedResponsesPayload | undefined;
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-proxy",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			proxyModel,
		);

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBeNull();
		expect(captured.xSessionId).toBe("session-proxy");
		expect(capturedPayload?.session_id).toBeUndefined();
		expect(capturedPayload?.prompt_cache_key).toBe("session-proxy");
	});

	it("auto-detects OpenRouter session-affinity header for OpenRouter Responses endpoints", async () => {
		const openRouterModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
		};
		let capturedPayload: CapturedResponsesPayload | undefined;
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-openrouter",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			openRouterModel,
		);

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBeNull();
		expect(captured.xSessionId).toBe("session-openrouter");
		expect(capturedPayload?.session_id).toBeUndefined();
		expect(capturedPayload?.prompt_cache_key).toBe("session-openrouter");
	});

	it("uses OpenAI no-session format when configured", async () => {
		const proxyModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "proxy",
			baseUrl: "https://proxy.example.com/v1",
			compat: { sessionAffinityFormat: "openai-nosession" },
		};
		let capturedPayload: CapturedResponsesPayload | undefined;
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-proxy",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			proxyModel,
		);

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBe("session-proxy");
		expect(captured.xSessionId).toBeNull();
		expect(capturedPayload?.session_id).toBeUndefined();
		expect(capturedPayload?.prompt_cache_key).toBe("session-proxy");
	});

	it("uses OpenAI no-session format for OpenCode Responses models", async () => {
		const model = getModel("opencode", "gpt-5.4");
		let capturedPayload: CapturedResponsesPayload | undefined;
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-opencode",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			model,
		);

		expect(model.compat?.sessionAffinityFormat).toBe("openai-nosession");
		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBe("session-opencode");
		expect(captured.xSessionId).toBeNull();
		expect(capturedPayload?.prompt_cache_key).toBe("session-opencode");
	});

	it("can omit OpenAI session_id header while preserving other affinity data", async () => {
		const proxyModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "opencode",
			baseUrl: "https://proxy.example.com/v1",
			compat: { sessionAffinityFormat: "openai-nosession" },
		};
		let capturedPayload: CapturedResponsesPayload | undefined;
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-123",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			proxyModel,
		);

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBe("session-123");
		expect(capturedPayload?.prompt_cache_key).toBe("session-123");
	});

	it("lets explicit headers override the default OpenAI cache-affinity headers", async () => {
		const captured = await captureOpenAIResponseHeaders({
			sessionId: "session-123",
			headers: {
				session_id: "override-session",
				"x-client-request-id": "override-request",
			},
		});

		expect(captured.sessionId).toBe("override-session");
		expect(captured.clientRequestId).toBe("override-request");
	});

	it("omits OpenAI cache-affinity headers when cacheRetention is none", async () => {
		const captured = await captureOpenAIResponseHeaders({ cacheRetention: "none", sessionId: "session-123" });

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBeNull();
	});

	it.each([
		["gpt-5.4", "priority", 2],
		["gpt-5.5", "priority", 2.5],
		["gpt-5.5", "flex", 0.5],
	] as const)("applies %s %s service-tier cost multiplier", async (modelId, serviceTier, multiplier) => {
		const model = getModel("openai", modelId);
		const tokenCount = 100_000;
		const tokenScale = tokenCount / 1_000_000;
		const sse = `${[
			`data: ${JSON.stringify({
				type: "response.completed",
				response: {
					status: "completed",
					service_tier: serviceTier,
					usage: {
						input_tokens: tokenCount,
						output_tokens: tokenCount,
						total_tokens: tokenCount * 2,
						input_tokens_details: { cached_tokens: 0 },
					},
				},
			})}`,
		].join("\n\n")}\n\n`;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(sse, {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		const stream = streamOpenAIResponses(
			model,
			{
				systemPrompt: "sys",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{ apiKey: "test-key", serviceTier },
		);

		const result = await stream.result();

		expect(result.usage.cost.input).toBe(model.cost.input * multiplier * tokenScale);
		expect(result.usage.cost.output).toBe(model.cost.output * multiplier * tokenScale);
		expect(result.usage.cost.total).toBe((model.cost.input + model.cost.output) * multiplier * tokenScale);
	});
});
