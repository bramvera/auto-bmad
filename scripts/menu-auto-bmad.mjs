#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HELP = `Usage: node scripts/menu-auto-bmad.mjs [options]

Print a Codex-friendly Auto-BMAD command menu. Read-only.

Options:
  --project-root <path>  Project root to check. Default: current directory.
  --json                 Print machine-readable JSON.
  --help                 Show this help.
`;

const COMMANDS = [
  {
    group: "Start here",
    capability: "diagnostic",
    syntax: "/auto-bmad-check",
    codex: "$auto-bmad-check",
    summary: "Readiness check. Confirms quick mode and optional module availability.",
    example: "$auto-bmad-check",
  },
  {
    group: "BMM quick",
    capability: "BMM quick",
    syntax: "/auto-bmad-story-quick <story-id>",
    codex: "$auto-bmad quick story <story-id>",
    summary: "Run one BMAD story in 3 steps: create, develop, code review.",
    example: "$auto-bmad quick story 1-1",
  },
  {
    group: "BMM quick",
    capability: "BMM quick",
    syntax: "/auto-bmad-sprint-quick <epic>",
    codex: "$auto-bmad quick sprint <epic>",
    summary: "Run all pending stories in one epic with quick-mode gates.",
    example: "$auto-bmad quick sprint 1",
  },
  {
    group: "BMM quick",
    capability: "BMM quick",
    syntax: "/auto-bmad-assess [epic]",
    codex: "$auto-bmad assess [epic]",
    summary: "Assess project or epic complexity and recommend quick vs full mode.",
    example: "$auto-bmad assess 1",
  },
  {
    group: "BMM quick",
    capability: "BMM quick",
    syntax: "/auto-bmad-sprint-wizard",
    codex: "$auto-bmad sprint wizard",
    summary: "Interactive sprint selection and resume flow. Full choices still require TEA.",
    example: "$auto-bmad sprint wizard",
  },
  {
    group: "Brownfield",
    capability: "BMM change-spec",
    syntax: "/auto-bmad-change-spec <change>",
    codex: "$auto-bmad change spec <change>",
    summary: "Create an implementation-ready change spec. Interactive; no TEA required.",
    example: "$auto-bmad change spec add CSV export",
  },
  {
    group: "Brownfield",
    capability: "BMM change-dev",
    syntax: "/auto-bmad-change-dev <spec>",
    codex: "$auto-bmad change dev <spec>",
    summary: "Implement an approved change spec with regression safety.",
    example: "$auto-bmad change dev _bmad-output/implementation-artifacts/change-spec.md",
  },
  {
    group: "BMM planning",
    capability: "BMM plan",
    syntax: "/auto-bmad-plan <product-context>",
    codex: "$auto-bmad plan <product-context>",
    summary: "Run the pre-implementation planning pipeline.",
    example: "$auto-bmad plan @idea.md",
  },
  {
    group: "BMM full",
    capability: "BMM full",
    syntax: "/auto-bmad-story <story-id>",
    codex: "$auto-bmad full story <story-id>",
    summary: "Run one story with the 10-step full quality pipeline.",
    example: "$auto-bmad full story 1-1",
  },
  {
    group: "BMM full",
    capability: "BMM full",
    syntax: "/auto-bmad-sprint <epic>",
    codex: "$auto-bmad full sprint <epic>",
    summary: "Run one epic with full per-story gates and epic-end gates.",
    example: "$auto-bmad full sprint 1",
  },
  {
    group: "BMM full",
    capability: "BMM full",
    syntax: "/auto-bmad-epic-start <epic>",
    codex: "$auto-bmad epic start <epic>",
    summary: "Create epic-level test design before story execution.",
    example: "$auto-bmad epic start 1",
  },
  {
    group: "BMM full",
    capability: "BMM full",
    syntax: "/auto-bmad-epic-end <epic>",
    codex: "$auto-bmad epic end <epic>",
    summary: "Close an epic with trace, NFR, test review, retro, and context refresh.",
    example: "$auto-bmad epic end 1",
  },
  {
    group: "GDS quick",
    capability: "GDS quick",
    syntax: "/auto-gds-story-quick <story-id>",
    codex: "$auto-bmad gds quick story <story-id>",
    summary: "Run one game-dev story in quick mode.",
    example: "$auto-bmad gds quick story 1-1",
  },
  {
    group: "GDS quick",
    capability: "GDS quick",
    syntax: "/auto-gds-sprint-quick <epic>",
    codex: "$auto-bmad gds quick sprint <epic>",
    summary: "Run one game-dev epic in quick mode.",
    example: "$auto-bmad gds quick sprint 1",
  },
  {
    group: "GDS full",
    capability: "GDS full",
    syntax: "/auto-gds-story <story-id>",
    codex: "$auto-bmad gds full story <story-id>",
    summary: "Run one game-dev story with full GDS quality gates.",
    example: "$auto-bmad gds full story 1-1",
  },
  {
    group: "GDS full",
    capability: "GDS full",
    syntax: "/auto-gds-sprint <epic>",
    codex: "$auto-bmad gds full sprint <epic>",
    summary: "Run one game-dev epic with full GDS quality gates.",
    example: "$auto-bmad gds full sprint 1",
  },
  {
    group: "GDS full",
    capability: "GDS full",
    syntax: "/auto-gds-epic-start <epic>",
    codex: "$auto-bmad gds epic start <epic>",
    summary: "Create epic-level game test design.",
    example: "$auto-bmad gds epic start 1",
  },
  {
    group: "GDS full",
    capability: "GDS full",
    syntax: "/auto-gds-epic-end <epic>",
    codex: "$auto-bmad gds epic end <epic>",
    summary: "Close a GDS epic with retro and context refresh.",
    example: "$auto-bmad gds epic end 1",
  },
  {
    group: "GDS planning",
    capability: "GDS plan",
    syntax: "/auto-gds-plan <game-context>",
    codex: "$auto-bmad gds plan <game-context>",
    summary: "Run the GDS pre-implementation planning pipeline.",
    example: "$auto-bmad gds plan @game-idea.md",
  },
];

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (arg === "--project-root") {
      args.projectRoot = argv[++i];
      if (!args.projectRoot) failUsage("--project-root requires a path");
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    failUsage(`Unknown option: ${arg}`);
  }
  args.projectRoot = path.resolve(args.projectRoot);
  return args;
}

function failUsage(message) {
  console.error(`Error: ${message}\n\n${HELP}`);
  process.exit(2);
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function runCheck(projectRoot) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const checkScript = path.join(scriptDir, "check-auto-bmad.mjs");
  if (!isFile(checkScript)) return { ok: false, error: "check-auto-bmad.mjs not found" };

  const result = spawnSync(process.execPath, [checkScript, "--project-root", projectRoot, "--json"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.stderr || result.stdout || "Auto-BMAD check failed").trim(),
    };
  }

  try {
    return { ok: true, data: JSON.parse(result.stdout) };
  } catch (error) {
    return { ok: false, error: `Invalid check JSON: ${error.message}` };
  }
}

function buildCapabilityMap(check) {
  const map = new Map();
  map.set("diagnostic", { available: true, reason: "always available", label: "Diagnostics" });
  if (!check.ok) return map;

  for (const item of [...(check.data.ready || []), ...(check.data.optional || [])]) {
    map.set(item.label, {
      available: Boolean(item.available),
      reason: item.reason || "",
      label: item.label,
    });
  }
  return map;
}

function enrichCommands(capabilities) {
  return COMMANDS.map((command) => {
    const capability = capabilities.get(command.capability);
    const rawReason = capability && !capability.available ? capability.reason : "";
    return {
      ...command,
      available: capability ? capability.available : false,
      unavailableReason: friendlyReason(rawReason),
    };
  });
}

function friendlyReason(reason) {
  if (!reason) return "";
  if (reason.includes("TEA config missing")) {
    return "TEA is not installed; only needed for this full/testing workflow.";
  }
  if (reason.includes("GDS config missing")) {
    return "GDS is not installed; only needed for game-dev workflows.";
  }
  return reason;
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function printCommands(title, items, includeReason = false) {
  if (!items.length) return;
  console.log(`\n${title}`);
  for (const [group, commands] of groupBy(items, "group")) {
    console.log(`\n${group}`);
    for (const command of commands) {
      console.log(`- ${command.codex}`);
      console.log(`  Claude: ${command.syntax}`);
      console.log(`  ${command.summary}`);
      if (includeReason && command.unavailableReason) {
        console.log(`  Unavailable: ${command.unavailableReason}`);
      }
    }
  }
}

function printHuman(projectRoot, check, commands) {
  console.log("Auto-BMAD Command Menu");
  console.log(`Project: ${projectRoot}`);
  console.log("");
  console.log("Use `$auto-bmad` as the one command users need to remember.");
  console.log("Examples:");
  console.log("- $auto-bmad-check");
  console.log("- $auto-bmad quick story 1-1");
  console.log("- $auto-bmad quick sprint 1");
  console.log("- $auto-bmad dry-run /auto-bmad-story-quick 1-1");

  if (!check.ok) {
    console.log(`\nCapability check unavailable: ${check.error}`);
    printCommands("All Known Workflows", commands);
    return;
  }

  const ready = commands.filter((command) => command.available);
  const unavailable = commands.filter((command) => !command.available);

  printCommands("Ready In This Project", ready);
  printCommands("Optional Or Currently Unavailable", unavailable, true);

  if (check.data.issues?.length) {
    console.log("\nBlocking Issues");
    for (const issue of check.data.issues) console.log(`- ${issue}`);
  }

  if (check.data.warnings?.length) {
    console.log("\nWarnings");
    for (const warning of check.data.warnings) console.log(`- ${warning}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const check = runCheck(args.projectRoot);
  const capabilities = buildCapabilityMap(check);
  const commands = enrichCommands(capabilities);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          projectRoot: args.projectRoot,
          check: check.ok ? check.data : { error: check.error },
          commands,
        },
        null,
        2,
      ),
    );
    return;
  }

  printHuman(args.projectRoot, check, commands);
}

main();
