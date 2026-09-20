#!/usr/bin/env node
import { parseArgs } from "node:util";
import { prepareDnpInstall } from "./dnp-package.mjs";

const { values } = parseArgs({
	options: {
		package: { type: "string" },
		output: { type: "string" },
		target: { type: "string", default: `${process.platform}-${process.arch}` },
	},
});
if (!values.package || !values.output) {
	throw new Error(
		"Usage: node scripts/prepare-dnp-install.mjs --package pi.dnp --output new-directory [--target linux-x64|darwin-arm64]",
	);
}
console.log(`Prepared ${prepareDnpInstall(values.package, values.output, values.target)}`);
