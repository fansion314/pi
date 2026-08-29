#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") {
	throw new Error(`The Deno standalone build only supports macOS; received ${process.platform}.`);
}

const target =
	process.arch === "arm64"
		? "aarch64-apple-darwin"
		: process.arch === "x64"
			? "x86_64-apple-darwin"
			: undefined;

if (!target) {
	throw new Error(`Unsupported macOS architecture: ${process.arch}.`);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectory = join(repoRoot, "packages", "coding-agent");
const bundleDirectory = join(packageDirectory, "dist", "bundle");
const clipboardNativePackage = `@mariozechner/clipboard-darwin-${process.arch}`;
const output = join(packageDirectory, "dist", "pi");

if (!existsSync(join(bundleDirectory, "cli.js"))) {
	throw new Error(`Missing build input: ${bundleDirectory}. Build the coding-agent package first.`);
}

const stagingDirectory = mkdtempSync(join(tmpdir(), "pi-deno-build-"));
const stagedBundleDirectory = join(stagingDirectory, "dist", "bundle");

try {
	for (const [source, destination] of [
		[bundleDirectory, stagedBundleDirectory],
		[join(packageDirectory, "dist", "modes", "interactive", "theme"), join(stagingDirectory, "dist", "modes", "interactive", "theme")],
		[join(packageDirectory, "dist", "modes", "interactive", "assets"), join(stagingDirectory, "dist", "modes", "interactive", "assets")],
		[join(packageDirectory, "dist", "core", "export-html"), join(stagingDirectory, "dist", "core", "export-html")],
		[join(packageDirectory, "docs"), join(stagingDirectory, "docs")],
		[join(packageDirectory, "examples"), join(stagingDirectory, "examples")],
	]) {
		cpSync(source, destination, { recursive: true });
	}

	for (const filename of ["package.json", "README.md", "CHANGELOG.md"]) {
		cpSync(join(packageDirectory, filename), join(stagingDirectory, filename));
	}

	for (const [packageName, relativeFile] of [
		["jiti", "package.json"],
		["jiti", "lib/jiti.cjs"],
		["jiti", "dist/jiti.cjs"],
		["jiti", "dist/babel.cjs"],
		["@silvia-odwyer/photon-node", "package.json"],
		["@silvia-odwyer/photon-node", "photon_rs.js"],
		["@silvia-odwyer/photon-node", "photon_rs_bg.js"],
		["@silvia-odwyer/photon-node", "photon_rs_bg.wasm"],
		["@mariozechner/clipboard", "package.json"],
		["@mariozechner/clipboard", "index.js"],
		[clipboardNativePackage, "package.json"],
		[clipboardNativePackage, `clipboard.darwin-${process.arch}.node`],
	]) {
		const segments = packageName.split("/");
		const source = join(repoRoot, "node_modules", ...segments, relativeFile);
		const destination = join(stagingDirectory, "node_modules", ...segments, relativeFile);
		if (!existsSync(source)) {
			throw new Error(`Missing runtime file: ${packageName}/${relativeFile}. Run npm ci first.`);
		}
		mkdirSync(dirname(destination), { recursive: true });
		cpSync(source, destination);
	}

	const nativePlatform = `darwin-${process.arch}`;
	const nativeSource = join(
		repoRoot,
		"packages",
		"tui",
		"native",
		"darwin",
		"prebuilds",
		nativePlatform,
		"darwin-modifiers.node",
	);
	const nativeDestination = join(
		stagedBundleDirectory,
		"native",
		"darwin",
		"prebuilds",
		nativePlatform,
		"darwin-modifiers.node",
	);
	mkdirSync(dirname(nativeDestination), { recursive: true });
	cpSync(nativeSource, nativeDestination);

	const entrypoint = join(stagedBundleDirectory, "cli.js");
	const result = spawnSync(
		"deno",
		[
			"compile",
			"--allow-all",
			"--no-check",
			"--no-code-cache",
			"--no-config",
			"--node-modules-dir=manual",
			"--target",
			target,
			"--include",
			stagingDirectory,
			"--output",
			output,
			entrypoint,
		],
		{
			cwd: stagingDirectory,
			stdio: "inherit",
		},
	);

	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`Deno compile failed with exit code ${result.status ?? "unknown"}.`);
	}
} finally {
	rmSync(stagingDirectory, { force: true, recursive: true });
}

console.log(`Built macOS Deno executable: ${output}`);
