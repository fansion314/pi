import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

export function archiveEntries(file, entry) {
	// macOS ships libarchive as tar; Arch supplies bsdtar through libarchive.
	const result = spawnSync(
		process.platform === "darwin" ? "tar" : "bsdtar",
		entry ? ["-xOf", resolve(file), "--", entry] : ["-tf", resolve(file)],
		{ maxBuffer: 64 * 1024 * 1024 },
	);
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`Cannot read DNP: ${result.stderr}`);
	return result.stdout;
}

export function digest(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

export function readDnp(file) {
	const bytes = archiveEntries(file, ".dnr/manifest.json");
	const manifest = JSON.parse(bytes);
	assert.equal(manifest.formatVersion, 2, "dnc >= 0.2.0 with format v2 is required");
	assert.equal(manifest.appId, "org.pi.coding-agent");
	assert.equal(manifest.integrity.path, ".dnr/index.json");
	const index = archiveEntries(file, manifest.integrity.path);
	assert.equal(digest(index), manifest.integrity.sha256, "DNP index checksum mismatch");
	return { manifest, records: JSON.parse(index), packageId: digest(bytes) };
}

// Prepare only Pi's reviewed native and example-tool groups; this is deliberately not a
// general dnr installer. dnc 0.2 has no install command, and build hosts should
// not need the runtime's GUI libraries merely to prepare these immutable files.
// The runtime independently verifies every group before loading it.
export function prepareDnpInstall(file, destination, targetName = `${process.platform}-${process.arch}`) {
	const selected = nativeTargets[targetName];
	assert.ok(selected, `Unsupported install target: ${targetName}`);
	const { manifest, records, packageId } = readDnp(file);
	assert.deepEqual(manifest.targets[selected.id], selected.target);
	const members = records.filter((r) => r.group && (!r.target || r.target === selected.id));
	assert.ok(members.some((r) => r.path === selected.path && r.native === "addon" && r.napi === 8));
	const groups = new Map();
	for (const record of members) {
		assert.match(record.group, /^[a-zA-Z0-9_-]+$/);
		assert.ok(manifest.groups.includes(record.group));
		assert.ok(
			record.path === selected.path ||
				(record.group === "example_doom" && record.path.startsWith("examples/extensions/doom-overlay/doom/")),
			"Review installer when Pi adds native companion files",
		);
		assert.ok(record.path.split("/").every((part) => part && part !== "." && part !== ".."));
		assert.ok(!/[\\\0\r\n]/.test(record.path));
		assert.ok(record.kind === "file" || record.kind === "directory", "Pi native groups must not contain links");
		assert.equal(
			record.source,
			record.target ? `.dnr/payloads/${record.group}_${selected.id}/${record.path}` : record.path,
		);
		assert.ok(Number.isSafeInteger(record.size) && record.size >= 0);
		assert.ok(Number.isInteger(record.mode) && record.mode >= 0 && record.mode <= 0o777);
		const entries = groups.get(record.group) ?? [];
		assert.ok(!entries.some((r) => r.path === record.path), "Duplicate native group path");
		entries.push(record);
		groups.set(record.group, entries);
	}
	const output = resolve(destination);
	mkdirSync(dirname(output), { recursive: true });
	const stage = mkdtempSync(join(dirname(output), ".pi-dnp-install-"));
	try {
		const packageName = basename(file);
		copyFileSync(file, join(stage, packageName));
		chmodSync(join(stage, packageName), 0o755);
		const generation = join(stage, `${packageName}.unpacked`, "v2", packageId.slice(0, 2), packageId, selected.id);
		mkdirSync(join(generation, ".locks"), { recursive: true, mode: 0o755 });
		for (const [id, entries] of groups) {
			const group = join(generation, id);
			for (const record of entries) {
				const native = join(group, "root", record.path);
				if (record.kind === "directory") {
					mkdirSync(native, { recursive: true, mode: 0o755 });
					continue;
				}
				const payload = archiveEntries(file, record.source);
				assert.equal(payload.length, record.size);
				assert.equal(digest(payload), record.sha256, "Native group checksum mismatch");
				mkdirSync(dirname(native), { recursive: true, mode: 0o755 });
				writeFileSync(native, payload, { mode: record.mode & ~0o222 });
			}
			writeFileSync(
				join(group, "receipt.json"),
				`${JSON.stringify({
					format: 2,
					packageId,
					appId: manifest.appId,
					target: selected.id,
					group: id,
					bytes: entries.reduce((sum, record) => sum + record.size, 0),
				})}\n`,
				{ mode: 0o444 },
			);
			writeFileSync(join(generation, ".locks", id), "", { mode: 0o444 });
		}
		chmodSync(stage, 0o755);
		// A fresh installation stage is required; never overwrite a live install.
		mkdirSync(output);
		renameSync(stage, output);
	} finally {
		rmSync(stage, { recursive: true, force: true });
	}
	return join(output, basename(file));
}
