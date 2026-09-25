import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export const nativeTargets = {
	"linux-x64": {
		id: "linux_x64_glibc",
		target: { os: "linux", arch: "x64", libc: "glibc" },
		path: "native/linux/prebuilds/linux-x64/linux-platform-x11.node",
	},
	"darwin-arm64": {
		id: "darwin_arm64",
		target: { os: "darwin", arch: "arm64" },
		path: "native/darwin/prebuilds/darwin-arm64/darwin-platform.node",
	},
};

export function archiveEntries(file, entry, dnc = process.env.DNC_BIN ?? "dnc") {
	const args = entry ? ["cat", resolve(file), entry] : ["inspect", resolve(file), "--json"];
	const result = spawnSync(dnc, args, { maxBuffer: 64 * 1024 * 1024 });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`Cannot read DNP: ${result.stderr}`);
	return entry ? result.stdout : Buffer.from(`${JSON.parse(result.stdout).archiveEntries.join("\n")}\n`);
}

export function digest(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

export function readDnp(file, dnc = process.env.DNC_BIN ?? "dnc") {
	const result = spawnSync(dnc, ["inspect", resolve(file), "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	if (result.error) throw result.error;
	assert.equal(result.status, 0, `dnc inspect failed: ${result.stderr}`);
	const inspected = JSON.parse(result.stdout);
	assert.equal(inspected.manifest.formatVersion, 3, "dnc >= 0.3.0 with format v3 is required");
	assert.equal(inspected.manifest.appId, "org.pi.coding-agent");
	assert.match(inspected.contentHash, /^[a-f0-9]{64}$/);
	return { ...inspected, packageId: inspected.contentHash };
}

// dnc owns the format and installation layout; build hosts do not need a GUI runtime.
export function prepareDnpInstall(file, destination, targetName = `${process.platform}-${process.arch}`, dnc = process.env.DNC_BIN ?? "dnc") {
	const selected = nativeTargets[targetName];
	assert.ok(selected, `Unsupported install target: ${targetName}`);
	const { manifest, records } = readDnp(file, dnc);
	assert.deepEqual(manifest.targets[selected.id], selected.target);
	const members = records.filter((r) => r.group && (!r.target || r.target === selected.id));
	assert.ok(members.some((r) => r.path === selected.path && r.native === "addon" && r.napi === 8));
	for (const record of members) {
		assert.ok(record.path === selected.path || (record.group === "example_doom" && record.path.startsWith("examples/extensions/doom-overlay/doom/")), "Review installer when Pi adds native companion files");
		assert.ok(record.kind === "file" || record.kind === "directory", "Pi native groups must not contain links");
	}
	const output = resolve(destination);
	mkdirSync(dirname(output), { recursive: true });
	const stage = mkdtempSync(join(dirname(output), ".pi-dnp-install-"));
	try {
		const result = spawnSync(dnc, ["install", resolve(file), stage, "--mode", "native", "--target", selected.id], { encoding: "utf8" });
		if (result.error) throw result.error;
		assert.equal(result.status, 0, `dnc install failed: ${result.stderr}`);
		chmodSync(stage, 0o755);
		mkdirSync(output);
		renameSync(stage, output);
	} finally {
		rmSync(stage, { recursive: true, force: true });
	}
	return join(output, basename(file));
}
