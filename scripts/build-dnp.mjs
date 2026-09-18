#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { transform } from "esbuild";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = join(repoRoot, "packages/coding-agent");
const { values } = parseArgs({
	options: {
		output: { type: "string" },
		dnc: { type: "string", default: process.env.DNC_BIN ?? "dnc" },
		help: { type: "boolean", default: false },
	},
});

if (values.help) {
	console.log(
		"Usage: node scripts/build-dnp.mjs [--output path/to/pi.dnp] [--dnc path/to/dnc]\nRequires installed dependencies, hydrated model data, and dnc. Runs TypeScript compilation, minified bundling, and dnc packaging. Native helpers are written to native/ beside the package.",
	);
	process.exit(0);
}

const target = `${process.platform}-${process.arch}`;
if (target !== "darwin-arm64" && target !== "linux-x64") {
	throw new Error(`dnr supports darwin-arm64 and linux-x64; this host is ${target}.`);
}
const output = resolve(values.output ?? join(packageDir, "dist/dnr/pi.dnp"));
const nativePath = `native/${process.platform}/prebuilds/${target}/${process.platform}-platform${process.platform === "linux" ? "-x11" : ""}.node`;
const nativeSource = join(repoRoot, "packages/tui", nativePath);
if (!existsSync(nativeSource)) throw new Error(`Missing native helper: ${nativeSource}`);

function run(command, args, options = {}) {
	const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit", ...options });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${command} failed (${result.signal ?? result.status}).`);
}

run(values.dnc, ["--version"]);
// Use the upstream TS compiler to rewrite .ts imports and emit real JavaScript.
// The offline AI build validates generated catalogs instead of fetching at build time.
for (const name of ["chord", "tui", "telemetry", "ai", "agent", "coding-agent"]) {
	run("npm", [
		"--prefix",
		join(repoRoot, "packages", name),
		"run",
		name === "ai" ? "build:offline" : name === "coding-agent" ? "build:unbundled" : "build",
	]);
}

const staging = mkdtempSync(join(tmpdir(), "pi-dnp-"));
const appDir = join(staging, "app");
try {
	run(process.execPath, [join(repoRoot, "scripts/build-coding-agent-bundle.mjs")], {
		env: { ...process.env, PI_DNP_BUNDLE_DIR: appDir },
	});
	for (const [path, pattern] of [
		["modes/interactive/theme", /\.json$/],
		["modes/interactive/assets", /\.png$/],
		["core/export-html", /^(template\.(html|css|js)|vendor)$/],
	]) {
		for (const file of readdirSync(join(packageDir, "src", path)).filter((file) => pattern.test(file))) {
			const destination = join(appDir, "dist", path, file);
			mkdirSync(dirname(destination), { recursive: true });
			cpSync(join(packageDir, "src", path, file), destination, { recursive: true });
		}
	}
	for (const path of ["docs", "examples", "README.md", "CHANGELOG.md"]) {
		cpSync(join(packageDir, path), join(appDir, path), {
			recursive: true,
			filter: (source) => !["node_modules", "dist", ".git"].includes(source.split("/").at(-1)),
		});
	}
	cpSync(join(repoRoot, "LICENSE"), join(appDir, "LICENSE"));
	const pkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
	writeFileSync(
		join(appDir, "package.json"),
		`${JSON.stringify(
			{
				name: pkg.name,
				version: pkg.version,
				type: "module",
				piConfig: pkg.piConfig,
				main: "./index.js",
				bin: { pi: "./cli.js" },
				exports: { ".": "./index.js", "./rpc-entry": "./rpc-entry.js" },
			},
			null,
			2,
		)}\n`,
	);

	// These modules use require-relative files / WASM and must retain their layout.
	// jiti remains a runtime compiler for user-supplied extensions, not Pi itself.
	for (const [name, files] of [
		["jiti", ["package.json", "lib/jiti.cjs", "dist/jiti.cjs", "dist/babel.cjs", "LICENSE"]],
		[
			"@silvia-odwyer/photon-node",
			["package.json", "photon_rs.js", "photon_rs_bg.js", "photon_rs_bg.wasm", "LICENSE.md"],
		],
	]) {
		for (const file of files) {
			const source = join(repoRoot, "node_modules", name, file);
			const dest = join(appDir, "node_modules", name, file);
			mkdirSync(dirname(dest), { recursive: true });
			if (/\.(?:cjs|js)$/.test(file)) {
				const result = await transform(readFileSync(source, "utf8"), {
					loader: "js",
					minify: true,
					target: "es2022",
					legalComments: "inline",
				});
				writeFileSync(dest, result.code);
			} else {
				cpSync(source, dest);
			}
		}
	}

	// Include license notices even when dependency code was folded into chunks.
	const licenseDir = join(appDir, "licenses");
	mkdirSync(licenseDir);
	for (const entry of readdirSync(join(repoRoot, "node_modules"))) {
		if (entry.startsWith(".")) continue;
		const names = entry.startsWith("@")
			? readdirSync(join(repoRoot, "node_modules", entry)).map((child) => `${entry}/${child}`)
			: [entry];
		for (const name of names) {
			const dir = join(repoRoot, "node_modules", name);
			if (!statSync(dir).isDirectory()) continue;
			for (const file of readdirSync(dir).filter((file) => /^(license|copying|notice)(\.|$)/i.test(file))) {
				if (statSync(join(dir, file)).isFile())
					cpSync(join(dir, file), join(licenseDir, `${name.replaceAll("/", "__")}__${file}`));
			}
		}
	}

	const paths = [];
	function collect(dir) {
		for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) collect(path);
			else {
				if (/\.(node|dylib|so)$/.test(entry.name))
					throw new Error(`Native library cannot be placed in dnp: ${path}`);
				paths.push(relative(appDir, path));
			}
		}
	}
	collect(appDir);
	mkdirSync(dirname(output), { recursive: true });
	const stagedOutput = join(staging, "pi.dnp");
	run(values.dnc, [appDir, "--entry", "cli.js", "--app-id", "org.pi.coding-agent", "--output", stagedOutput]);
	const nativeOutput = join(dirname(output), nativePath);
	mkdirSync(dirname(nativeOutput), { recursive: true });
	cpSync(nativeSource, nativeOutput);
	// Copy to the destination filesystem before atomic replacement.
	const pendingOutput = `${output}.tmp-${process.pid}`;
	try {
		cpSync(stagedOutput, pendingOutput);
		renameSync(pendingOutput, output);
	} finally {
		rmSync(pendingOutput, { force: true });
	}
	const entries = [".dnr/manifest.json", ...paths].sort();
	writeFileSync(`${output}.files.txt`, entries.join("\n") + "\n");
	const tree = Object.create(null);
	for (const entry of entries) {
		let node = tree;
		for (const segment of entry.split("/")) node = node[segment] ??= Object.create(null);
	}
	const lines = ["pi.dnp (ZIP)"];
	function renderTree(node, prefix) {
		const children = Object.entries(node);
		for (const [index, [name, child]] of children.entries()) {
			const last = index === children.length - 1;
			const directory = Object.keys(child).length > 0;
			lines.push(`${prefix}${last ? "└── " : "├── "}${name}${directory ? "/" : ""}`);
			if (directory) renderTree(child, `${prefix}${last ? "    " : "│   "}`);
		}
	}
	renderTree(tree, "");
	writeFileSync(`${output}.tree.txt`, lines.join("\n") + "\n");
	console.log(
		`Built ${output} (${statSync(output).size} bytes)\nNative helper: ${nativeOutput}\nZIP tree: ${output}.tree.txt`,
	);
} finally {
	rmSync(staging, { recursive: true, force: true });
}
