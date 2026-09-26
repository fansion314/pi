import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { archiveEntries, digest, nativeTargets, prepareDnpInstall, readDnp } from "./dnp-package.mjs";

const source = process.env.PI_DNP_TEST_PACKAGE;
test(
	"v4 Pi index covers both platform addons and prepares a relocatable, read-only sidecar",
	{
		skip: !source && "Set PI_DNP_TEST_PACKAGE to the built pi.dnp",
	},
	() => {
		const { manifest, records, packageId } = readDnp(source);
		assert.equal(manifest.entry, "cli.js");
		assert.equal(manifest.desktop, undefined, "Pi CLI does not require desktop metadata or icons");
		assert.deepEqual(
			Object.keys(manifest.targets).sort(),
			Object.values(nativeTargets)
				.map((n) => n.id)
				.sort(),
		);
		for (const target of Object.values(nativeTargets)) {
			const addon = records.find((r) => r.path === target.path);
			assert.equal(addon.target, target.id);
			assert.equal(addon.native, "addon");
			assert.equal(addon.napi, 8);
			assert.ok(manifest.groups.includes(addon.group));
			assert.match(addon.source, /^\.dnr\/p\/[0-9]+-[^/]+$/);
			assert.equal(digest(archiveEntries(source, addon.source)), addon.sha256);
		}
		const temp = mkdtempSync(join(tmpdir(), "pi-dnp-install-test-"));
		try {
			const target = nativeTargets[`${process.platform}-${process.arch}`];
			const addon = records.find((r) => r.path === target.path);
			const installed = prepareDnpInstall(source, join(temp, "install"));
			assert.deepEqual(readFileSync(installed), readFileSync(source));
			const generation = join(`${installed}.unpacked`, "v4", packageId, target.id);
			const native = join(generation, addon.group, "root", addon.path);
			assert.equal(digest(readFileSync(native)), addon.sha256);
			assert.equal(statSync(native).mode & 0o777, addon.mode & ~0o222);
			assert.ok(existsSync(join(generation, ".locks", addon.group)));
			const require = createRequire(import.meta.url);
			const helper = require(native);
			assert.equal(typeof helper.getText, "function");
			assert.equal(typeof helper.getImage, "function");
			assert.throws(() => prepareDnpInstall(source, join(temp, "install")), /EEXIST/);
			assert.deepEqual(readFileSync(installed), readFileSync(source));
			chmodSync(native, 0o644);
		} finally {
			rmSync(temp, { recursive: true, force: true });
		}
	},
);
