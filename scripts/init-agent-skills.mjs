#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, "..");

const RUNTIME_DIR = "_auto-bmad-runtime";
const SCRIPT_NAMES = [
  "check-auto-bmad.mjs",
  "check-bmad-refs.mjs",
  "menu-auto-bmad.mjs",
  "preflight-auto-bmad.mjs",
  "smoke-auto-bmad-flow.mjs",
  "status-auto-bmad.mjs",
  "token-report.py",
];

const HELP = `Usage: node scripts/init-agent-skills.mjs [options]

Install Auto-BMAD shared Agent Skills into an existing BMAD 6.5 project.

Options:
  --project-root <path>   Target project root (default: current directory)
  --source-root <path>    Auto-BMAD source root (default: this repository)
  --dry-run              Print planned writes without changing files
  --help                 Show this help

This writes only under <project-root>/.agents/skills. It does not edit
.claude, .claude-plugin, or commands/*.md.
`;

function parseArgs(argv) {
  const options = {
    projectRoot: process.cwd(),
    sourceRoot: DEFAULT_SOURCE_ROOT,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--project-root" || arg === "-p") {
      options.projectRoot = argv[++i];
    } else if (arg === "--source-root") {
      options.sourceRoot = argv[++i];
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.projectRoot = path.resolve(options.projectRoot);
  options.sourceRoot = path.resolve(options.sourceRoot);
  return options;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function copyFile(src, dest, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function removeDir(dir, dryRun) {
  if (dryRun) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function parseFrontmatter(markdown, filePath) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error(`Missing frontmatter in ${filePath}`);
  }

  const frontmatter = match[1];
  const body = markdown.slice(match[0].length);
  const nameMatch = frontmatter.match(/^name:\s*['"]?([^'"\n]+)['"]?\s*$/m);
  const descriptionMatch = frontmatter.match(/^description:\s*['"]?([^'"\n]+)['"]?\s*$/m);

  if (!nameMatch) {
    throw new Error(`Missing frontmatter name in ${filePath}`);
  }

  return {
    name: nameMatch[1].trim(),
    description: descriptionMatch ? descriptionMatch[1].trim() : `Auto-BMAD workflow from ${path.basename(filePath)}`,
    body,
  };
}

function titleFromName(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function commandNameForSkill(name) {
  return `/${name}`;
}

function workflowKind(name) {
  if (/(^|-)story(-|$)/.test(name)) return "story";
  if (/(^|-)sprint(-|$)/.test(name)) return "sprint";
  if (/(^|-)epic-(start|end)$/.test(name)) return "epic";
  return null;
}

function workflowModule(name) {
  return name.startsWith("auto-gds-") ? "gds" : "bmm";
}

function workflowStatusInstruction(name) {
  const kind = workflowKind(name);
  if (!kind) return "";

  const moduleArg = workflowModule(name) === "gds" ? " --module gds" : "";
  const noun = kind === "story" ? "story id" : "epic number";
  const example = kind === "story" ? "1-1" : "1";
  const heading = kind === "story" ? "Story" : "Epic";

  return `
## Missing ${heading} Selection

If the user invokes this skill without a ${noun}, do not ask a bare question first. Run the fast status helper and show its numbered suggestion output:

\`\`\`bash
node .agents/skills/${RUNTIME_DIR}/scripts/status-auto-bmad.mjs --project-root . --kind ${kind}${moduleArg}
\`\`\`

Then ask the user to reply with the suggested number or provide a ${noun} manually. If the status helper cannot find a suggestion, ask: \`Which ${noun}? Example: ${example}\`.
`;
}

function escapeFrontmatter(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildSkill({ name, description, body }) {
  const title = titleFromName(name);
  const commandName = commandNameForSkill(name);
  const statusInstruction = workflowStatusInstruction(name);

  return `---\nname: ${name}\ndescription: "${escapeFrontmatter(description)}"\n---\n\n# ${title}\n\nThis is the shared Agent Skills wrapper for Claude Code command \`${commandName}\`.\n\n## Shared Agent Skills Host Adaptation\n\nFollow the workflow below as the source of truth. This wrapper exists so Agent Skills-compatible CLIs can expose Auto-BMAD workflows through their native skill surface, for example \`$${name}\` in Codex or \`/skill:${name}\` in slash-skill hosts.\n\n- Do not edit the original Claude command files.\n- When the workflow says to use a Claude Code foreground Task tool, use this host's closest fresh-context subagent mechanism. If the host has no equivalent, execute the BMAD skill calls sequentially in the current session and preserve all coordinator duties.\n- When the workflow references a BMAD slash command such as \`/bmad-dev-story\`, invoke the installed BMAD skill using this host's skill syntax, such as \`$bmad-dev-story\` or \`/skill:bmad-dev-story\`, if direct slash commands are not available.\n- Preserve Auto-BMAD git safety exactly: record start commits, run per-step WIP commits, update story/sprint status files, run the final squash/final commit, and check \`git status --short\` before reporting completion.\n- If the workflow references \`./scripts/<script>\` and that path is missing, use \`.agents/skills/${RUNTIME_DIR}/scripts/<script>\` from the project root.\n- If the token cost report script is unavailable on this host, skip only the cost report and mark estimated cost as unavailable. Do not skip workflow validation, commits, status updates, or reports.\n- Do not report the workflow as complete while implemented changes remain uncommitted unless the user explicitly asked to stop before committing.\n${statusInstruction}\n## Source Workflow\n\n${body.trimEnd()}\n`;
}

function listCommandFiles(commandsDir) {
  return fs.readdirSync(commandsDir)
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => path.join(commandsDir, entry));
}

function validateSourceRoot(sourceRoot) {
  const commandsDir = path.join(sourceRoot, "commands");
  const scriptsDir = path.join(sourceRoot, "scripts");
  if (!fs.existsSync(commandsDir)) {
    throw new Error(`Auto-BMAD commands directory not found: ${commandsDir}`);
  }
  if (!fs.existsSync(scriptsDir)) {
    throw new Error(`Auto-BMAD scripts directory not found: ${scriptsDir}`);
  }
  return { commandsDir, scriptsDir };
}

function validateTarget(projectRoot) {
  const skillsDir = path.join(projectRoot, ".agents", "skills");
  if (!fs.existsSync(skillsDir)) {
    throw new Error(
      `Target .agents/skills directory not found: ${skillsDir}\n` +
      "Complete BMAD 6.5 project setup first, then rerun Auto-BMAD init."
    );
  }
  return skillsDir;
}

function installRuntimeScripts({ scriptsDir, targetSkillsDir, dryRun }) {
  const runtimeScriptsDir = path.join(targetSkillsDir, RUNTIME_DIR, "scripts");
  removeDir(path.join(targetSkillsDir, RUNTIME_DIR), dryRun);

  const copied = [];
  for (const scriptName of SCRIPT_NAMES) {
    const src = path.join(scriptsDir, scriptName);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(runtimeScriptsDir, scriptName);
    copyFile(src, dest, dryRun);
    copied.push(path.relative(targetSkillsDir, dest));
  }

  const manifest = {
    name: RUNTIME_DIR,
    description: "Runtime scripts used by generated Auto-BMAD shared Agent Skills.",
    scripts: copied,
    generatedAt: new Date().toISOString(),
  };
  writeText(
    path.join(targetSkillsDir, RUNTIME_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    dryRun
  );

  return copied;
}

function installCommandSkills({ commandsDir, targetSkillsDir, dryRun }) {
  const generated = [];
  for (const commandFile of listCommandFiles(commandsDir)) {
    const parsed = parseFrontmatter(readText(commandFile), commandFile);
    const skillDir = path.join(targetSkillsDir, parsed.name);
    const skillPath = path.join(skillDir, "SKILL.md");
    const skill = buildSkill(parsed);

    removeDir(skillDir, dryRun);
    writeText(skillPath, skill, dryRun);
    generated.push({
      name: parsed.name,
      source: path.relative(commandsDir, commandFile),
      target: path.relative(targetSkillsDir, skillPath),
    });
  }
  return generated;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(HELP);
    process.exit(2);
  }

  if (options.help) {
    console.log(HELP);
    return;
  }

  try {
    const { commandsDir, scriptsDir } = validateSourceRoot(options.sourceRoot);
    const targetSkillsDir = validateTarget(options.projectRoot);

    const generated = installCommandSkills({
      commandsDir,
      targetSkillsDir,
      dryRun: options.dryRun,
    });
    const runtimeScripts = installRuntimeScripts({
      scriptsDir,
      targetSkillsDir,
      dryRun: options.dryRun,
    });

    console.log("Auto-BMAD Agent Skills Init");
    console.log(`Project: ${options.projectRoot}`);
    console.log(`Target: ${path.relative(options.projectRoot, targetSkillsDir) || targetSkillsDir}`);
    console.log(`Mode: ${options.dryRun ? "dry-run" : "copy"}`);
    console.log("");
    console.log(`Generated workflow skills: ${generated.length}`);
    for (const item of generated) {
      console.log(`- ${item.name} (${item.source})`);
    }
    console.log("");
    console.log(`Runtime scripts: ${runtimeScripts.length}`);
    for (const item of runtimeScripts) {
      console.log(`- ${item}`);
    }
    console.log("");
    console.log("Done. Codex/shared Agent Skills hosts should expose these as skill commands, for example $auto-bmad-sprint-quick or /skill:auto-bmad-sprint-quick.");
  } catch (error) {
    console.error(`Auto-BMAD init failed: ${error.message}`);
    process.exit(1);
  }
}

main();
