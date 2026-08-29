import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { DEEPSEEK_COMPLETIONS_MODELS } from "./deepseek-completions.models.ts";

export function deepseekCompletionsProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "deepseek-completions",
		name: "DeepSeek (Chat Completions)",
		baseUrl: "https://api.deepseek.com",
		auth: { apiKey: envApiKeyAuth("DeepSeek API key", ["DEEPSEEK_API_KEY"]) },
		models: Object.values(DEEPSEEK_COMPLETIONS_MODELS),
		api: openAICompletionsApi(),
	});
}
