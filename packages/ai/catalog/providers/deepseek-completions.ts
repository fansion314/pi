import type { Model } from "../../src/types.ts";
import { defineProvider, mergeCompat } from "../define.ts";
import { DEEPSEEK_V4_FLASH_THINKING_LEVEL_MAP, DEEPSEEK_V4_THINKING_LEVEL_MAP } from "../families/deepseek.ts";
import { DEEPSEEK_MODELS } from "./deepseek.ts";

export default defineProvider({
	id: "deepseek-completions",
	models: () =>
		structuredClone(DEEPSEEK_MODELS).map((model) => ({
			...model,
			api: "openai-completions",
			provider: "deepseek-completions",
			thinkingLevelMap:
				model.id === "deepseek-flash" ? DEEPSEEK_V4_FLASH_THINKING_LEVEL_MAP : DEEPSEEK_V4_THINKING_LEVEL_MAP,
		})),
	compat: {
		"openai-completions": {
			supportsStore: false,
			supportsDeveloperRole: false,
			maxTokensField: "max_tokens",
			requiresReasoningContentOnAssistantMessages: true,
			thinkingFormat: "deepseek",
			supportsStrictMode: true,
		},
	},
	finalize: (model) => {
		if (model.id === "deepseek-v4-pro") {
			mergeCompat(model as Model<"openai-completions">, { supportsMidConvoSystemMessages: true });
		}
	},
});
