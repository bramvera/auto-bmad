#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const HELP = `Usage: node scripts/preflight-auto-bmad.mjs [options]

Read-only safety preflight before Auto-BMAD execution. Blocks when the git
worktree is dirty because Auto-BMAD retry paths can commit and reset.

Options:
  --project-root <path>  Project root to check. Default: current directory.
  --json                 Print machine-readable JSON.
  --help                 Show this help.
`;

function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    json: false,
  };

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

function git(projectRoot, args) {
  return spawnSync("git", ["-C", projectRoot, ...args], {
    encoding: "utf8",
  });
}

function checkGit(projectRoot) {
  const inside = git(projectRoot, ["rev-parse", "--is-inside-work-tree"]);
  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    return {
      projectRoot,
      gitRepo: false,
      clean: false,
      dirtyCount: 0,
      entries: [],
      blocked: true,
      reason: "not a git repository",
    };
  }

  const status = git(projectRoot, ["status", "--short"]);
  const entries = status.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  return {
    projectRoot,
    gitRepo: true,
    clean: entries.length === 0,
    dirtyCount: entries.length,
    entries,
    blocked: entries.length > 0,
    reason: entries.length > 0 ? "dirty worktree" : "clean",
  };
}

function printHuman(result) {
  console.log("Auto-BMAD Git Preflight");
  console.log(`Project: ${result.projectRoot}`);

  if (!result.gitRepo) {
    console.log("\nResult: BLOCKED - not a git repository.");
    console.log("Auto-BMAD requires git checkpoints and rollback safety.");
    console.log("\nChoose next action:");
    console.log("1. Initialize git / move to a git repo, then rerun Auto-BMAD");
    console.log("2. Abort");
    return;
  }

  if (result.clean) {
    console.log("\nResult: PASS - git worktree is clean.");
    return;
  }

  console.log(`\nResult: BLOCKED - dirty worktree detected (${result.dirtyCount} entries).`);
  console.log("Auto-BMAD must not skip or continue because retries may use git reset --hard.");
  console.log("\nChanged files:");
  for (const entry of result.entries.slice(0, 20)) console.log(`- ${entry}`);
  if (result.entries.length > 20) {
    console.log(`- ... ${result.entries.length - 20} more`);
  }

  console.log("\nChoose next action:");
  console.log("1. I will commit/stash/clean these changes manually, then rerun Auto-BMAD");
  console.log("2. Create a safety commit of all current changes, then continue");
  console.log("3. Abort");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = checkGit(args.projectRoot);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  process.exit(result.blocked ? 3 : 0);
}

main();
