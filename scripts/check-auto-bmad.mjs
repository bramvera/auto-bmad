#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HELP = `Usage: node scripts/check-auto-bmad.mjs [options]

Read-only Auto-BMAD capability check. Quick mode is the baseline success path;
TEA and GDS are optional capabilities.

Options:
  --project-root <path>  Project root to check. Default: current directory.
  --skills-dir <path>    Skill directory to check. Default: auto-detect project and home dirs.
  --extra-skills-dir <path>
                         Additional skill/source directory. Repeatable.
  --json                 Print machine-readable JSON.
  --help                 Show this help.
`;

const BMM_QUICK_SKILLS = [
  "bmad-create-story",
  "bmad-dev-story",
  "bmad-code-review",
  "bmad-retrospective",
];

const BMM_FULL_SKILLS = [
  ...BMM_QUICK_SKILLS,
  "bmad-review-adversarial-general",
  "bmad-review-edge-case-hunter",
  "bmad-testarch-test-design",
  "bmad-testarch-atdd",
  "bmad-testarch-trace",
  "bmad-testarch-automate",
  "bmad-testarch-nfr",
  "bmad-testarch-test-review",
  "bmad-generate-project-context",
];

const BMM_PLAN_SKILLS = [
  "bmad-product-brief",
  "bmad-create-prd",
  "bmad-validate-prd",
  "bmad-create-ux-design",
  "bmad-create-architecture",
  "bmad-testarch-framework",
  "bmad-testarch-test-design",
  "bmad-create-epics-and-stories",
  "bmad-check-implementation-readiness",
  "bmad-generate-project-context",
  "bmad-sprint-planning",
];

const CHANGE_SPEC_SKILLS = ["bmad-correct-course"];

const CHANGE_DEV_SKILLS = [
  "bmad-testarch-automate",
  "bmad-testarch-atdd",
  "bmad-quick-dev",
  "bmad-review-edge-case-hunter",
  "bmad-code-review",
  "bmad-testarch-trace",
];

const GDS_QUICK_SKILLS = [
  "gds-create-story",
  "gds-dev-story",
  "gds-code-review",
  "gds-retrospective",
];

const GDS_FULL_SKILLS = [
  ...GDS_QUICK_SKILLS,
  "bmad-review-adversarial-general",
  "bmad-review-edge-case-hunter",
  "gds-test-design",
  "gds-performance-test",
  "gds-test-automate",
  "gds-test-review",
  "gds-generate-project-context",
];

const GDS_PLAN_SKILLS = [
  "gds-create-game-brief",
  "gds-create-gdd",
  "gds-create-narrative",
  "gds-game-architecture",
  "gds-test-framework",
  "gds-test-design",
  "gds-generate-project-context",
  "gds-sprint-planning",
];

function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    skillsDir: null,
    extraSkillsDirs: [],
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
    failUsage(`Unknown option: ${arg}`);
  }

  args.projectRoot = path.resolve(args.projectRoot);
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

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
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

function parseManifest(manifestPath) {
  const text = readText(manifestPath);
  const result = { version: null, modules: {}, ides: [] };
  if (!text) return result;

  const installation = text.match(/^installation:\s*\n(?:^[^\S\n].*\n)*?^\s{2}version:\s*(.+)$/m);
  if (installation) result.version = installation[1].trim();

  let currentModule = null;
  let inIdes = false;
  for (const line of text.split(/\r?\n/)) {
    const moduleMatch = line.match(/^\s{2}- name:\s*(.+)$/);
    if (moduleMatch) {
      currentModule = moduleMatch[1].trim();
      inIdes = false;
      continue;
    }
    const versionMatch = line.match(/^\s{4}version:\s*(.+)$/);
    if (currentModule && versionMatch) {
      result.modules[currentModule] = versionMatch[1].trim();
      continue;
    }
    if (line.match(/^ides:\s*$/)) {
      currentModule = null;
      inIdes = true;
      continue;
    }
    const ideMatch = line.match(/^\s{2}-\s*(.+)$/);
    if (inIdes && ideMatch) result.ides.push(ideMatch[1].trim());
  }

  return result;
}

function missingSkills(requiredSkills, skills) {
  return requiredSkills.filter((skill) => !skills.has(skill));
}

function capability(label, available, reason, commands = []) {
  return { label, available, reason, commands };
}

function pathStatus(filePath) {
  if (!filePath) return { path: null, exists: false, writable: false, parentWritable: false };
  const pathExists = exists(filePath);
  let writable = false;
  let parentWritable = false;
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }

  let current = pathExists ? filePath : path.dirname(filePath);
  while (current && !exists(current)) {
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  try {
    fs.accessSync(current, fs.constants.W_OK);
    parentWritable = true;
  } catch {
    parentWritable = false;
  }

  return { path: filePath, exists: pathExists, writable, parentWritable };
}

function formatMissing(missing) {
  return missing.length === 0 ? "" : `missing skills: ${missing.join(", ")}`;
}

function buildReport(args) {
  const bmadDir = path.join(args.projectRoot, "_bmad");
  const manifestPath = path.join(bmadDir, "_config/manifest.yaml");
  const bmmConfigPath = path.join(bmadDir, "bmm/config.yaml");
  const teaConfigPath = path.join(bmadDir, "tea/config.yaml");
  const gdsConfigPath = path.join(bmadDir, "gds/config.yaml");
  const rootTomlPath = path.join(bmadDir, "config.toml");
  const rootYamlPath = path.join(bmadDir, "config.yaml");

  const manifest = parseManifest(manifestPath);
  const skillsDirs = detectSkillsDirs(args.projectRoot, args.skillsDir, args.extraSkillsDirs);
  const skills = listSkills(skillsDirs);
  const bmmText = readText(bmmConfigPath);
  const gdsText = readText(gdsConfigPath);
  const outputFolder = resolveProjectPath(args.projectRoot, parseYamlValue(bmmText, "output_folder"));
  const implementationArtifacts = resolveProjectPath(
    args.projectRoot,
    parseYamlValue(bmmText, "implementation_artifacts"),
  );
  const planningArtifacts = resolveProjectPath(
    args.projectRoot,
    parseYamlValue(bmmText, "planning_artifacts"),
  );
  const gdsOutputFolder = resolveProjectPath(args.projectRoot, parseYamlValue(gdsText, "output_folder"));
  const autoBmadArtifacts = outputFolder ? path.join(outputFolder, "auto-bmad-artifacts") : null;
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const tokenReporter = path.join(scriptDir, "token-report.py");

  const errors = [];
  const warnings = [];
  const info = [];

  const bmadExists = isDirectory(bmadDir);
  const bmmConfigExists = exists(bmmConfigPath);
  const teaConfigExists = exists(teaConfigPath);
  const gdsConfigExists = exists(gdsConfigPath);

  if (!bmadExists) errors.push("BMAD install not found: _bmad/ is missing.");
  if (skillsDirs.length === 0) {
    errors.push("No skill directory found: expected .agents/skills, .codex/skills, .claude/skills, or matching home skill dirs.");
  }
  if (!bmmConfigExists) errors.push("BMM quick mode unavailable: _bmad/bmm/config.yaml is missing.");

  const bmmQuickMissing = missingSkills(BMM_QUICK_SKILLS, skills);
  const bmmFullMissing = missingSkills(BMM_FULL_SKILLS, skills);
  const bmmPlanMissing = missingSkills(BMM_PLAN_SKILLS, skills);
  const changeSpecMissing = missingSkills(CHANGE_SPEC_SKILLS, skills);
  const changeDevMissing = missingSkills(CHANGE_DEV_SKILLS, skills);
  const gdsQuickMissing = missingSkills(GDS_QUICK_SKILLS, skills);
  const gdsFullMissing = missingSkills(GDS_FULL_SKILLS, skills);
  const gdsPlanMissing = missingSkills(GDS_PLAN_SKILLS, skills);

  if (bmmQuickMissing.length > 0) {
    errors.push(`BMM quick mode unavailable: ${formatMissing(bmmQuickMissing)}.`);
  }

  if (!teaConfigExists) warnings.push("TEA is not installed: BMM full, BMM plan, and change-dev are unavailable.");
  if (!gdsConfigExists) warnings.push("GDS is not installed: GDS commands are unavailable.");
  if (!exists(tokenReporter)) warnings.push("Token cost reporter not found in this plugin checkout.");

  const bmmQuickAvailable = bmmConfigExists && bmmQuickMissing.length === 0 && skillsDirs.length > 0;
  const bmmFullAvailable = bmmQuickAvailable && teaConfigExists && bmmFullMissing.length === 0;
  const bmmPlanAvailable = bmmConfigExists && teaConfigExists && bmmPlanMissing.length === 0;
  const changeSpecAvailable = bmmConfigExists && changeSpecMissing.length === 0;
  const changeDevAvailable = bmmConfigExists && teaConfigExists && changeDevMissing.length === 0;
  const gdsQuickAvailable = gdsConfigExists && gdsQuickMissing.length === 0;
  const gdsFullAvailable = gdsQuickAvailable && gdsFullMissing.length === 0;
  const gdsPlanAvailable = gdsConfigExists && gdsPlanMissing.length === 0;

  const ready = [];
  const optional = [];

  ready.push(
    capability(
      "BMM quick",
      bmmQuickAvailable,
      bmmQuickAvailable
        ? "available"
        : [
            !bmmConfigExists ? "_bmad/bmm/config.yaml missing" : null,
            bmmQuickMissing.length ? formatMissing(bmmQuickMissing) : null,
          ].filter(Boolean).join("; "),
      ["/auto-bmad-story-quick", "/auto-bmad-sprint-quick"],
    ),
  );

  optional.push(
    capability(
      "BMM full",
      bmmFullAvailable,
      bmmFullAvailable
        ? "available"
        : [
            !teaConfigExists ? "TEA config missing" : null,
            bmmFullMissing.length ? formatMissing(bmmFullMissing) : null,
          ].filter(Boolean).join("; "),
      ["/auto-bmad-story", "/auto-bmad-sprint"],
    ),
    capability(
      "BMM plan",
      bmmPlanAvailable,
      bmmPlanAvailable
        ? "available"
        : [
            !teaConfigExists ? "TEA config missing" : null,
            bmmPlanMissing.length ? formatMissing(bmmPlanMissing) : null,
          ].filter(Boolean).join("; "),
      ["/auto-bmad-plan"],
    ),
    capability(
      "BMM change-spec",
      changeSpecAvailable,
      changeSpecAvailable
        ? "available"
        : [
            !bmmConfigExists ? "_bmad/bmm/config.yaml missing" : null,
            changeSpecMissing.length ? formatMissing(changeSpecMissing) : null,
          ].filter(Boolean).join("; "),
      ["/auto-bmad-change-spec"],
    ),
    capability(
      "BMM change-dev",
      changeDevAvailable,
      changeDevAvailable
        ? "available"
        : [
            !teaConfigExists ? "TEA config missing" : null,
            changeDevMissing.length ? formatMissing(changeDevMissing) : null,
          ].filter(Boolean).join("; "),
      ["/auto-bmad-change-dev"],
    ),
    capability(
      "GDS quick",
      gdsQuickAvailable,
      gdsQuickAvailable
        ? "available"
        : [
            !gdsConfigExists ? "GDS config missing" : null,
            gdsQuickMissing.length ? formatMissing(gdsQuickMissing) : null,
          ].filter(Boolean).join("; "),
      ["/auto-gds-story-quick", "/auto-gds-sprint-quick"],
    ),
    capability(
      "GDS full",
      gdsFullAvailable,
      gdsFullAvailable
        ? "available"
        : [
            !gdsConfigExists ? "GDS config missing" : null,
            gdsFullMissing.length ? formatMissing(gdsFullMissing) : null,
          ].filter(Boolean).join("; "),
      ["/auto-gds-story", "/auto-gds-sprint"],
    ),
    capability(
      "GDS plan",
      gdsPlanAvailable,
      gdsPlanAvailable
        ? "available"
        : [
            !gdsConfigExists ? "GDS config missing" : null,
            gdsPlanMissing.length ? formatMissing(gdsPlanMissing) : null,
          ].filter(Boolean).join("; "),
      ["/auto-gds-plan"],
    ),
  );

  if (exists(rootTomlPath)) info.push("Config model: BMAD 6.4+ TOML plus generated module YAML.");
  else if (exists(rootYamlPath)) info.push("Config model: legacy root YAML.");
  else if (bmadExists) info.push("Config model: generated module YAML only.");

  return {
    projectRoot: args.projectRoot,
    bmad: {
      present: bmadExists,
      version: manifest.version,
      modules: manifest.modules,
      ides: manifest.ides,
      configModel: {
        toml: exists(rootTomlPath),
        rootYaml: exists(rootYamlPath),
      },
    },
    skills: {
      dirs: skillsDirs,
      count: skills.size,
    },
    configs: {
      bmm: bmmConfigExists ? bmmConfigPath : null,
      tea: teaConfigExists ? teaConfigPath : null,
      gds: gdsConfigExists ? gdsConfigPath : null,
    },
    paths: {
      outputFolder: pathStatus(outputFolder),
      implementationArtifacts: pathStatus(implementationArtifacts),
      planningArtifacts: pathStatus(planningArtifacts),
      autoBmadArtifacts: pathStatus(autoBmadArtifacts),
      gdsOutputFolder: pathStatus(gdsOutputFolder),
    },
    tokenReporter: exists(tokenReporter) ? tokenReporter : null,
    ready,
    optional,
    issues: errors,
    warnings,
    info,
  };
}

function renderCapability(item) {
  const mark = item.available ? "available" : `unavailable: ${item.reason || "requirements missing"}`;
  return `- ${item.label}: ${mark}`;
}

function renderReport(report) {
  const lines = [];
  lines.push("Auto-BMAD Check");
  lines.push("");
  lines.push(`Project: ${report.projectRoot}`);
  lines.push(`BMAD: ${report.bmad.version || "unknown"}${report.bmad.present ? "" : " (missing)"}`);
  lines.push(`Skills: ${report.skills.count} from ${report.skills.dirs.length ? report.skills.dirs.join(", ") : "none"}`);
  if (report.info.length > 0) {
    for (const item of report.info) lines.push(item);
  }
  lines.push("");
  lines.push("Ready");
  for (const item of report.ready) lines.push(renderCapability(item));
  lines.push("");
  lines.push("Optional");
  for (const item of report.optional) lines.push(renderCapability(item));
  lines.push("");
  lines.push("Issues");
  if (report.issues.length === 0) lines.push("- none for quick mode");
  else for (const issue of report.issues) lines.push(`- ${issue}`);
  lines.push("");
  lines.push("Warnings");
  if (report.warnings.length === 0) lines.push("- none");
  else for (const warning of report.warnings) lines.push(`- ${warning}`);
  lines.push("");
  lines.push("Paths");
  for (const [label, state] of Object.entries(report.paths)) {
    if (!state.path) continue;
    const availability = state.exists
      ? state.writable ? "exists, writable" : "exists, not writable"
      : state.parentWritable ? "missing, parent writable" : "missing, parent not writable";
    lines.push(`- ${label}: ${state.path} (${availability})`);
  }
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport(args);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderReport(report));
  }
  process.exit(report.issues.length > 0 ? 1 : 0);
}

main();
