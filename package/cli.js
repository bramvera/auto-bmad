#!/usr/bin/env node
const { execFileSync } = require("child_process");
const { createInterface } = require("readline");
const fs = require("fs");
const path = require("path");

const PLUGIN_NAME = "auto-bmad";
const MARKETPLACE = "bramvera-plugins";
const MARKETPLACE_REPO = "bramvera/claude-code-plugins";
const NPM_SCOPE = "@bramvera";

const noColor = process.env.NO_COLOR || !process.stdout.isTTY;
const GREEN = noColor ? "" : "\x1b[32m";
const RED = noColor ? "" : "\x1b[31m";
const YELLOW = noColor ? "" : "\x1b[33m";
const BOLD = noColor ? "" : "\x1b[1m";
const RESET = noColor ? "" : "\x1b[0m";

function run(args, opts = {}) {
  return execFileSync(args[0], args.slice(1), { stdio: "inherit", ...opts });
}

function findSourceRoot() {
  const candidates = [
    path.resolve(__dirname, ".."),
    __dirname,
    process.cwd(),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, "commands")) &&
      fs.existsSync(path.join(candidate, "scripts", "init-agent-skills.mjs"))
    ) {
      return candidate;
    }
  }
  return null;
}

function printHelp() {
  console.log(`Usage:
  auto-bmad init [options]      Copy shared Agent Skills into .agents/skills
  auto-bmad --uninstall         Uninstall the Claude Code plugin
  auto-bmad                     Install the Claude Code plugin

Init options:
  --project-root <path>         Target project root (default: current directory)
  --dry-run                     Print planned writes without changing files
`);
}

function claudeExists() {
  try {
    execFileSync("claude", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args[0] === "help") {
    printHelp();
    return;
  }

  if (args[0] === "init") {
    const sourceRoot = findSourceRoot();
    if (!sourceRoot) {
      console.error(`${RED}Error: Auto-BMAD command sources not found.${RESET}`);
      console.error("Run from an Auto-BMAD checkout or reinstall the npm package with bundled sources.");
      process.exit(1);
    }
    const script = path.join(sourceRoot, "scripts", "init-agent-skills.mjs");
    run([process.execPath, script, "--source-root", sourceRoot, ...args.slice(1)]);
    return;
  }

  if (!claudeExists()) {
    console.error(`${RED}Error: claude CLI not found.${RESET}`);
    console.error("Install Claude Code first: https://docs.anthropic.com/en/docs/claude-code");
    process.exit(1);
  }

  // Uninstall
  if (args.includes("--uninstall")) {
    console.log(`Uninstalling ${PLUGIN_NAME}...`);
    try {
      run(["claude", "plugin", "uninstall", `${PLUGIN_NAME}@${MARKETPLACE}`]);
      console.log(`${GREEN}${PLUGIN_NAME} uninstalled.${RESET}`);
    } catch {
      console.log(`${PLUGIN_NAME} is not installed.`);
    }
    return;
  }

  // Choose scope
  console.log();
  console.log(`${BOLD}Install scope:${RESET}`);
  console.log("  1) project — shared with team via .claude/settings.json (default)");
  console.log("  2) user    — available across all your projects");
  console.log("  3) local   — this project only, personal, gitignored");
  console.log();

  const choice = await ask("Choose scope [1]: ");
  const scope = choice === "2" ? "user" : choice === "3" ? "local" : "project";

  // Install
  console.log();
  console.log(`${BOLD}Installing ${PLUGIN_NAME} (scope: ${scope})...${RESET}`);
  console.log();

  // Add marketplace (idempotent)
  console.log(`Adding marketplace ${MARKETPLACE_REPO}...`);
  try { run(["claude", "plugin", "marketplace", "add", MARKETPLACE_REPO], { stdio: "pipe" }); } catch {}

  // Install plugin
  console.log("Installing plugin...");
  try {
    run(["claude", "plugin", "install", `${PLUGIN_NAME}@${MARKETPLACE}`, "--scope", scope]);
    console.log();
    console.log(`${GREEN}${BOLD}${PLUGIN_NAME} installed successfully.${RESET}`);
    console.log();
    console.log("Start Claude Code in this project directory to use the plugin.");
    console.log(`Run ${YELLOW}npx ${NPM_SCOPE}/${PLUGIN_NAME} --uninstall${RESET} to remove.`);
    console.log();
  } catch {
    console.error();
    console.error(`${RED}Installation failed.${RESET}`);
    console.error("Try installing manually inside Claude Code:");
    console.error(`  /plugin marketplace add ${MARKETPLACE_REPO}`);
    console.error(`  /plugin install ${PLUGIN_NAME}@${MARKETPLACE}`);
    process.exit(1);
  }
}

main();
