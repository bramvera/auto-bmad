#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const HELP = `Usage: node scripts/reset-sprint-wizard.mjs --project-root <path>

Archive the current Auto-BMAD sprint wizard plan. This is intentionally narrow:
it only moves _bmad-output/auto-bmad-artifacts/sprint-plan.yaml and leaves
historical reports untouched.
`;

function parseArgs(argv) {
  const args = { projectRoot: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (arg === "--project-root") {
      args.projectRoot = argv[++i];
      if (!args.projectRoot) fail("--project-root requires a path");
      continue;
    }
    fail(`Unknown option: ${arg}`);
  }
  args.projectRoot = path.resolve(args.projectRoot);
  return args;
}

function fail(message) {
  console.error(`Error: ${message}\n\n${HELP}`);
  process.exit(2);
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function parseYamlValue(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^\\s*${escaped}:\\s*(.+?)\\s*$`, "m"));
  if (!match) return null;
  return match[1].replace(/^["']|["']$/g, "");
}

function resolveProjectPath(projectRoot, value) {
  if (!value) return null;
  const expanded = value.replaceAll("{project-root}", projectRoot);
  return path.isAbsolute(expanded) ? expanded : path.resolve(projectRoot, expanded);
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = path.join(args.projectRoot, "_bmad", "bmm", "config.yaml");
  const configText = readText(configPath);
  const outputFolder = resolveProjectPath(args.projectRoot, parseYamlValue(configText, "output_folder"));
  if (!outputFolder) {
    console.error("Sprint wizard reset failed: _bmad/bmm/config.yaml output_folder is missing.");
    process.exit(1);
  }

  const artifactsDir = path.join(outputFolder, "auto-bmad-artifacts");
  const planPath = path.join(artifactsDir, "sprint-plan.yaml");
  if (!fs.existsSync(planPath)) {
    console.log("No sprint wizard plan found; nothing to reset.");
    return;
  }

  fs.mkdirSync(artifactsDir, { recursive: true });
  const archivePath = path.join(artifactsDir, `sprint-plan-archived-${timestamp()}.yaml`);
  fs.renameSync(planPath, archivePath);
  console.log(`Reset sprint wizard plan; archived previous plan to ${path.relative(args.projectRoot, archivePath)}.`);
}

main();
