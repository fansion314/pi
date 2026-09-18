import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { getModel } from "@earendil-works/pi-ai/compat";
import { createReadTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getNativeClipboard } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
	const faux = fauxProvider({ provider: "dnp-smoke", models: [{ id: "local" }] });
	faux.setResponses([
		fauxAssistantMessage(fauxToolCall("bash", { command: "printf dnp-tool-ok" }), { stopReason: "toolUse" }),
		fauxAssistantMessage("DNP_SMOKE_OK"),
	]);
	pi.registerProvider(faux.provider);
	pi.on("session_start", async (_event, ctx) => {
		try {
			assert.equal(getModel("deepseek", "deepseek-flash").api, "openai-responses");
			assert.equal(getModel("deepseek-completions", "deepseek-flash").api, "openai-completions");
			assert.equal(ctx.cwd, process.env.DNP_TEST_CWD);
			if (process.platform === "darwin") {
				const clipboard = getNativeClipboard();
				assert.ok(clipboard, "native helper must load from the sidecar");
				assert.equal(typeof clipboard.getText, "function");
				assert.equal(typeof clipboard.getImage, "function");
			}
			const result = await createReadTool(ctx.cwd).execute("image", { path: "large.png" });
			assert.ok(
				result.content.some((item) => item.type === "image"),
				"Photon must decode the image",
			);
			assert.ok(
				result.content.some((item) => item.type === "text" && item.text.includes("original 2400x2400")),
				"Photon must resize the image",
			);
			assert.ok(readFileSync(join(process.env.DNP_TEST_PACKAGE_DIR!, "README.md"), "utf8").includes("pi"));
			writeFileSync(join(ctx.cwd, "extension-ok"), "ok");
		} catch (error) {
			console.error(error);
			process.exitCode = 1;
			throw error;
		}
	});
}
