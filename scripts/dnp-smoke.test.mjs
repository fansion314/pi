import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	symlinkSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { digest, nativeTargets, prepareDnpInstall, readDnp } from "./dnp-package.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = process.env.PI_DNP_TEST_PACKAGE;

for (const mode of ["cache", "sidecar"]) {
	test(
		`v3 dnp runs outside the checkout with ${mode} native groups`,
		{
			skip: !packagePath && "Set PI_DNP_TEST_PACKAGE to the built pi.dnp",
			timeout: 60000,
		},
		() => {
			const temp = realpathSync(mkdtempSync(join(tmpdir(), "pi-dnp-smoke-")));
			try {
				const app = join(temp, "app");
				const cwd = join(temp, "caller");
				const bin = join(temp, "bin");
				const runtimeTmp = join(temp, "runtime-tmp");
				mkdirSync(app);
				mkdirSync(cwd);
				mkdirSync(bin);
				mkdirSync(runtimeTmp);
				const dnr = (process.env.PATH ?? "")
					.split(delimiter)
					.map((path) => join(path, "dnr"))
					.find(existsSync);
				assert.ok(dnr, "dnr must be on PATH");
				symlinkSync(realpathSync(dnr), join(bin, "dnr"));
				const source = resolve(packagePath);
				const archive = join(app, "pi.dnp");
				if (mode === "sidecar" && existsSync(`${source}.unpacked`)) {
					cpSync(source, archive);
					cpSync(`${source}.unpacked`, `${archive}.unpacked`, { recursive: true });
				} else if (mode === "sidecar") {
					rmSync(app, { recursive: true });
					prepareDnpInstall(source, app);
				} else cpSync(source, archive);
				const { manifest, records, packageId } = readDnp(archive);
				const target = nativeTargets[`${process.platform}-${process.arch}`];
				const nativeRecord = records.find((record) => record.target === target.id && record.native === "addon");
				assert.ok(nativeRecord);
				const nativeCache = join(temp, "native-cache");
				const generation = mode === "sidecar"
					? join(`${archive}.unpacked`, "v3", packageId, target.id)
					: join(nativeCache, "v3", digest(Buffer.from(realpathSync(archive))), "generations", packageId, "native", target.id);
				const materialized = join(generation, nativeRecord.group, "root", nativeRecord.path);
				assert.equal(manifest.formatVersion, 3);
				const launcher = join(bin, "pi");
				symlinkSync(archive, launcher);
				const zip = readFileSync(archive);
				const marker = Buffer.from("# DNRZIP1\n");
				const zipStart = zip.indexOf(marker) + marker.length;
				assert.ok(zipStart >= marker.length, "dnp must contain its shell/ZIP marker");
				assert.equal(zip.readUInt32LE(zipStart), 0x04034b50);
				const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
				assert.ok(end > zipStart);
				const count = zip.readUInt16LE(end + 10);
				const nativePath = `native/${process.platform}/prebuilds/${process.platform}-${process.arch}/${process.platform}-platform${process.platform === "linux" ? "-x11" : ""}.node`;
				let offset = zipStart + zip.readUInt32LE(end + 16);
				const entries = [];
				for (let index = 0; index < count; index++) {
					assert.equal(zip.readUInt32LE(offset), 0x02014b50);
					const nameLength = zip.readUInt16LE(offset + 28);
					const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
					const method = zip.readUInt16LE(offset + 10);
					assert.ok(method === 0 || method === 93, "dnp uses stored or Zstd entries");
					if (!name.startsWith("examples/") && !name.startsWith("docs/")) assert.doesNotMatch(name, /\.(ts|tsx)$/);
					entries.push(name);
					offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
				}
				assert.deepEqual(
					entries.filter((entry) => !entry.endsWith("/")).sort(),
					readFileSync(process.env.PI_DNP_TEST_FILE_LIST ?? `${source}.files.txt`, "utf8")
						.trim()
						.split("\n")
						.sort(),
				);
				assert.ok(entries.includes(".dnr/meta.bin"));
				assert.ok(entries.includes("chunks/image-resize-worker.js"));
				assert.deepEqual(
					entries.filter((entry) => /\.(node|dylib|so)$/.test(entry)).sort(),
					records
						.filter((record) => record.native === "addon")
						.map((record) => record.source)
						.sort(),
				);
				const deployed = mode === "sidecar" ? [...(existsSync(join(app, ".dnr-install.lock")) ? [".dnr-install.lock"] : []), "pi.dnp", "pi.dnp.unpacked"] : ["pi.dnp"];
				assert.deepEqual(readdirSync(app).sort(), deployed);
				const extension = join(cwd, "extension.ts");
				cpSync(join(repoRoot, "scripts/fixtures/dnp-extension.ts"), extension);
				// A compressible large PNG forces the real Photon WASM resize path.
				function chunk(type, data) {
					const body = Buffer.concat([Buffer.from(type), data]);
					let crc = 0xffffffff;
					for (const byte of body) {
						crc ^= byte;
						for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
					}
					const result = Buffer.alloc(body.length + 8);
					result.writeUInt32BE(data.length);
					body.copy(result, 4);
					result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
					return result;
				}
				const header = Buffer.alloc(13);
				header.writeUInt32BE(2400, 0);
				header.writeUInt32BE(2400, 4);
				header[8] = 8;
				header[9] = 2;
				writeFileSync(
					join(cwd, "large.png"),
					Buffer.concat([
						Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
						chunk("IHDR", header),
						chunk("IDAT", deflateSync(Buffer.alloc((2400 * 3 + 1) * 2400))),
						chunk("IEND", Buffer.alloc(0)),
					]),
				);
				const env = {
					PATH: [bin, "/usr/bin", "/bin"].join(delimiter),
					TERM: "xterm-256color",
					TMPDIR: runtimeTmp,
					DNR_CACHE_DIR: nativeCache,
					XDG_DATA_HOME: join(temp, "data"),
					DNP_TEST_MATERIALIZED_PATH: materialized,
					PI_OFFLINE: "1",
					PI_TELEMETRY: "0",
					PI_CODING_AGENT_DIR: join(temp, "config"),
					DNP_TEST_CWD: cwd,
					DNP_TEST_PACKAGE_DIR: app,
					DNP_TEST_NATIVE_PATH: nativePath,
				};
				function run(args) {
					const result = spawnSync(launcher, args, {
						cwd,
						env,
						encoding: "utf8",
						timeout: 45000,
						maxBuffer: 4 * 1024 * 1024,
					});
					assert.equal(result.status, 0, `${result.error ?? ""}\n${result.stdout}\n${result.stderr}`);
					assert.doesNotMatch(result.stderr, /Failed to load extension|Error in extension|AssertionError/);
					assert.deepEqual(
						readdirSync(runtimeTmp).filter((name) => name.startsWith("dnr-native-")),
						[],
						"v3 must not use v1 temporary native directories",
					);
					return result.stdout;
				}
				const version = JSON.parse(readFileSync(join(repoRoot, "packages/coding-agent/package.json"), "utf8")).version;
				assert.equal(run(["--version"]).trim(), version);
				assert.match(run(["--help"]), /Usage:/);
				const session = join(cwd, "session.jsonl");
				const smokeArgs = [
					"--no-extensions",
					"--no-skills",
					"--no-context-files",
					"--no-prompt-templates",
					"--no-themes",
					"-e",
					extension,
					"--provider",
					"dnp-smoke",
					"--model",
					"local",
					"--session",
					session,
					"--tools",
					"bash",
					"-p",
					"Run the smoke test",
				];
				const output = run(smokeArgs);
				assert.ok(existsSync(materialized), "native group must persist after exit");
				const before = statSync(materialized);
				assert.match(run(smokeArgs), /DNP_SMOKE_OK/);
				const after = statSync(materialized);
				assert.equal(after.ino, before.ino);
				assert.equal(after.mtimeMs, before.mtimeMs);
				if (mode === "sidecar") {
					assert.equal(existsSync(join(nativeCache, "v3", digest(Buffer.from(realpathSync(archive))), "generations", packageId, "native")), false, "sidecar must avoid duplicate native extraction");
				}
				assert.match(output, /DNP_SMOKE_OK/);
				assert.ok(existsSync(join(cwd, "extension-ok")), `extension assertions must have completed: ${output}`);
				assert.match(readFileSync(session, "utf8"), /dnp-tool-ok/);
				const html = join(cwd, "session.html");
				run(["--export", session, html]);
				assert.match(readFileSync(html, "utf8"), /<!DOCTYPE html>/i);
				assert.deepEqual(readdirSync(app).sort(), deployed, "runtime must not create new adjacent files");
				console.log(
					"Verified single-file deployment, v3 native groups and persistent reuse, CLI, TypeScript extension, dual DeepSeek catalogs, Photon resize, bash tool, session storage, HTML export, and caller cwd.",
				);
			} finally {
				rmSync(temp, { recursive: true, force: true });
			}
		},
	);
}
