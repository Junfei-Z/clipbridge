#!/usr/bin/env node
import { applyHandoff, createHandoff, inspectHandoff, listHandoffs } from "../src/handoff.mjs";
import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const command = args.shift();
const flag = (name) => args.includes(`--${name}`);
const value = (name) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };

function help() {
  console.log(`ClipBridge Agent Handoff\n\nCommands:\n  create [--goal TEXT] [--summary TEXT] [--next TEXT] [--push]\n         [--goal-file FILE] [--summary-file FILE] [--next-file FILE]\n  list [--fetch]\n  inspect ID\n  apply ID\n\nOnly tracked changes are exported. Inspect every package before applying it.`);
}

async function textOption(name) {
  const file = value(`${name}-file`);
  return file ? readFile(file, "utf8") : value(name);
}

try {
  if (command === "create") {
    const result = await createHandoff({ goal: await textOption("goal"), summary: await textOption("summary"), next: await textOption("next"), push: flag("push"), allowSensitive: flag("allow-sensitive") });
    console.log(`Created ${result.id}\nBranch: ${result.handoffBranch}\nPackage: ${result.packageDir}\nPushed: ${result.pushed ? "yes" : "no"}`);
  } else if (command === "list") {
    const items = await listHandoffs({ fetch: flag("fetch") });
    if (!items.length) console.log("No handoffs found.");
    else for (const item of items) console.log(`${item.id}\t${item.date}\t${item.ref}`);
  } else if (command === "inspect" && args[0]) {
    console.log((await inspectHandoff(args[0])).markdown);
  } else if (command === "apply" && args[0]) {
    const result = await applyHandoff(args[0]);
    console.log(result.applied ? "Handoff patch applied. Review and test the working tree." : "Handoff has no tracked changes to apply.");
  } else {
    help();
    if (command && command !== "help" && command !== "--help") process.exitCode = 1;
  }
} catch (error) {
  console.error(`ClipBridge handoff failed: ${error.message}`);
  process.exitCode = 1;
}
