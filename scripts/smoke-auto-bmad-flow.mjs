#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const HELP = `Usage: node scripts/smoke-auto-bmad-flow.mjs --command <command> [options]

Dry-run an Auto-BMAD command file and verify that referenced BMAD/GDS skills exist.
No BMAD skills are executed.

Options:
  --command <name>       Auto-BMAD command, with or without leading slash.
  --project-root <path>  Project root to check. Default: current directory.
  --repo-root <path>     Auto-BMAD repo/plugin root. Default: parent of this script.
  --skills-dir <path>    Skill directory to check. Default: auto-detect project and home dirs.
  --extra-skills-dir <path>
                         Additional skill/source directory. Repeatable.
  --json                 Print machine-readable JSON.
  --list                 List known Auto-BMAD command names.
  --help                 Show this help.
`;

function parseArgs(argv) {
  const args = {
    command: null,
    projectRoot: process.cwd(),
    repoRoot: path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."),
    skillsDir: null,
    extraSkillsDirs: [],
    json: false,
    list: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (arg === "--command") {
      args.command = argv[++i];
      if (!args.command) failUsage("--command requires a command name");
      continue;
    }
    if (arg === "--project-root") {
      args.projectRoot = argv[++i];
      if (!args.projectRoot) failUsage("--project-root requires a path");
      continue;
    }
    if (arg === "--repo-root") {
      args.repoRoot = argv[++i];
      if (!args.repoRoot) failUsage("--repo-root requires a path");
      continue;
    }
    if (arg === "--skills-dir") {
      args.skillsDir = argv[++i];
      if (!args.skillsDir) failUsage("--skills-dir requires a path");
      continue;
    }
    if (arg === "--extra-skills-dir") {
      const extraSkillsDir = argv[++i];
      if (!extraSkillsDir) failUsage("--extra-skills-dir requires a path");
      args.extraSkillsDirs.push(extraSkillsDir);
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--list") {
      args.list = true;
      continue;
    }
    failUsage(`Unknown option: ${arg}`);
  }

  args.projectRoot = path.resolve(args.projectRoot);
  args.repoRoot = path.resolve(args.repoRoot);
  if (args.skillsDir) args.skillsDir = path.resolve(args.projectRoot, args.skillsDir);
  args.extraSkillsDirs = args.extraSkillsDirs.map((dir) =>
    path.resolve(args.projectRoot, dir),
  );
  return args;
}

function failUsage(message) {
  console.error(`Error: ${message}\n\n${HELP}`);
  process.exit(2);
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function walkFiles(dir, predicate, out = []) {
  if (!isDirectory(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, predicate, out);
    } else if (entry.isFile() && predicate(entryPath)) {
      out.push(entryPath);
    }
  }
  return out;
}

function detectSkillsDirs(projectRoot, explicitDir, extraSkillsDirs) {
  const home = process.env.HOME || "";
  const candidates = explicitDir
    ? [explicitDir]
    : [
        path.join(projectRoot, ".agents/skills"),
        path.join(projectRoot, ".codex/skills"),
        path.join(projectRoot, ".claude/skills"),
        path.join(projectRoot, "../.agents/skills"),
        path.join(projectRoot, "../.codex/skills"),
        path.join(projectRoot, "../.claude/skills"),
        home ? path.join(home, ".agents/skills") : null,
        home ? path.join(home, ".codex/skills") : null,
        home ? path.join(home, ".claude/skills") : null,
      ];

  const seen = new Set();
  return [...candidates, ...extraSkillsDirs]
    .filter(Boolean)
    .filter((dir) => {
      const resolved = path.resolve(dir);
      if (seen.has(resolved) || !isDirectory(resolved)) return false;
      seen.add(resolved);
      return true;
    });
}

function listSkills(skillsDirs) {
  const skills = new Set();
  for (const skillsDir of skillsDirs) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) skills.add(entry.name);
    }
    for (const skillFile of walkFiles(skillsDir, (filePath) =>
      filePath.endsWith(`${path.sep}SKILL.md`),
    )) {
      skills.add(path.basename(path.dirname(skillFile)));
    }
  }
  return skills;
}

function collectCommandFiles(repoRoot) {
  const commandsDir = path.join(repoRoot, "commands");
  const commands = new Map();
  for (const filePath of walkFiles(commandsDir, (file) => file.endsWith(".md"))) {
    const text = readText(filePath);
    const nameMatch = text.match(/^name:\s*['"]?([^'"\n]+)['"]?\s*$/m);
    if (!nameMatch) continue;
    commands.set(nameMatch[1].trim(), filePath);
  }
  return commands;
}

function normalizeCommand(command) {
  return command
    .trim()
    .replace(/^\//, "")
    .replace(/^auto-bmad:/, "auto-bmad-")
    .replace(/^auto-gds:/, "auto-gds-");
}

function extractTaskPrompts(text) {
  const prompts = [];
  const patterns = [
    /\*\*Task prompt(?: \(via Bash\))?:\*\*\s*`([^`]+)`/g,
    /Task prompt:\s*`([^`]+)`/g,
    /Task prompt(?: \(via Bash\))?:\s*`([^`]+)`/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const prompt = match[1].trim();
      prompts.push(prompt);
    }
  }
  return prompts;
}

function extractSkillRef(prompt) {
  const match = prompt.match(/^\/((?:bmad|gds)-[a-z0-9][a-z0-9-]*)\b/);
  return match ? match[1] : null;
}

function requiredConfigs(commandText) {
  const configs = [];
  if (commandText.includes("_bmad/bmm/config.yaml")) configs.push("_bmad/bmm/config.yaml");
  const mentionsTeaConfig = commandText.includes("_bmad/tea/config.yaml");
  const explicitlySkipsTea = /Do NOT read [`"]?_bmad\/tea\/config\.yaml[`"]?/i.test(commandText);
  const teaIsOptional = /_bmad\/tea\/config\.yaml`\s*\(if exists\)/i.test(commandText);
  if (mentionsTeaConfig && !explicitlySkipsTea && !teaIsOptional) {
    configs.push("_bmad/tea/config.yaml");
  }
  if (commandText.includes("_bmad/gds/config.yaml")) configs.push("_bmad/gds/config.yaml");
  return [...new Set(configs)];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const commands = collectCommandFiles(args.repoRoot);

  if (args.list) {
    for (const name of [...commands.keys()].sort()) console.log(name);
    return;
  }

  if (!args.command) failUsage("--command is required unless --list is used");

  const commandName = normalizeCommand(args.command);
  const commandFile = commands.get(commandName);
  if (!commandFile) {
    console.error(`Unknown Auto-BMAD command: ${args.command}`);
    console.error(`Known commands: ${[...commands.keys()].sort().join(", ")}`);
    process.exit(2);
  }

  const commandText = readText(commandFile);
  const prompts = extractTaskPrompts(commandText);
  const skillRefs = prompts.map((prompt) => ({
    prompt,
    skill: extractSkillRef(prompt),
  }));
  const skillsDirs = detectSkillsDirs(args.projectRoot, args.skillsDir, args.extraSkillsDirs);
  const skills = listSkills(skillsDirs);
  const missingSkills = skillRefs
    .filter((item) => item.skill && !skills.has(item.skill))
    .map((item) => item.skill);
  const configs = requiredConfigs(commandText);
  const missingConfigs = configs.filter((config) => !isFile(path.join(args.projectRoot, config)));

  const result = {
    projectRoot: args.projectRoot,
    repoRoot: args.repoRoot,
    command: commandName,
    commandFile: path.relative(args.repoRoot, commandFile),
    dryRunOnly: true,
    skillsDirs,
    taskCount: prompts.length,
    calls: skillRefs.map((item, index) => ({
      step: index + 1,
      skill: item.skill,
      prompt: item.prompt,
      status: item.skill ? (skills.has(item.skill) ? "ok" : "missing") : "non-skill",
    })),
    configs: configs.map((config) => ({
      path: config,
      status: isFile(path.join(args.projectRoot, config)) ? "ok" : "missing",
    })),
    missingSkills: [...new Set(missingSkills)].sort(),
    missingConfigs,
  };

  const exitCode = result.missingSkills.length > 0 || result.missingConfigs.length > 0 ? 1 : 0;

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(exitCode);
  }

  console.log("Auto-BMAD Flow Smoke Check");
  console.log("");
  console.log(`Project: ${result.projectRoot}`);
  console.log(`Command: /${result.command}`);
  console.log(`Command file: ${result.commandFile}`);
  console.log("Mode: dry-run only; no BMAD/GDS skills executed.");
  console.log(`Skills: ${skills.size} from ${skillsDirs.length ? skillsDirs.join(", ") : "none"}`);
  console.log("");

  console.log("Configs");
  if (result.configs.length === 0) {
    console.log("- none required by command file");
  } else {
    for (const config of result.configs) console.log(`- ${config.path}: ${config.status}`);
  }
  console.log("");

  console.log("Resolved Calls");
  if (result.calls.length === 0) {
    console.log("- no Task prompts found");
  } else {
    for (const call of result.calls) {
      const label = call.skill ? `/${call.skill}` : "non-skill";
      console.log(`${call.step}. ${label}: ${call.status}`);
    }
  }
  console.log("");

  if (exitCode === 0) {
    console.log("Result: PASS - command routing is resolvable. Execution intentionally stopped.");
  } else {
    console.log("Result: FAIL - command routing has blockers.");
    if (result.missingConfigs.length > 0) {
      console.log(`Missing configs: ${result.missingConfigs.join(", ")}`);
    }
    if (result.missingSkills.length > 0) {
      console.log(`Missing skills: ${result.missingSkills.map((skill) => `/${skill}`).join(", ")}`);
    }
  }

  process.exit(exitCode);
}

main();
