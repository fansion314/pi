import type { Model } from "../../src/types.ts";
import { defineProvider } from "../define.ts";
import { DEEPSEEK_RESPONSES_THINKING_LEVEL_MAP } from "../families/deepseek.ts";

// models.dev's DeepSeek entries lag the API; pricing from
// https://api-docs.deepseek.com/quick_start/pricing. DeepSeek also offers
// time-based off-peak rates, which the cost schema cannot represent yet.
export const DEEPSEEK_MODELS: Model<"openai-responses">[] = [
	{
		id: "deepseek-flash",
		name: "DeepSeek V4.1 Flash",
		api: "openai-responses",
		baseUrl: "https://api.deepseek.com",
		provider: "deepseek",
		reasoning: true,
		thinkingLevelMap: DEEPSEEK_RESPONSES_THINKING_LEVEL_MAP,
		input: ["text", "image"],
		cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 },
		contextWindow: 1000000,
		maxTokens: 384000,
	},
	{
		id: "deepseek-v4-pro",
		name: "DeepSeek V4 Pro",
		api: "openai-responses",
		baseUrl: "https://api.deepseek.com",
		provider: "deepseek",
		reasoning: true,
		thinkingLevelMap: DEEPSEEK_RESPONSES_THINKING_LEVEL_MAP,
		input: ["text"],
		cost: { input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 0 },
		contextWindow: 1000000,
		maxTokens: 384000,
	},
];

export default defineProvider({
	id: "deepseek",
	models: () => structuredClone(DEEPSEEK_MODELS),
	compat: {
		"openai-responses": {
			supportsDeveloperRole: false,
			sessionAffinityFormat: "openai-nosession",
			supportsLongCacheRetention: false,
		},
	},
});
