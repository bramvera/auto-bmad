#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const HELP = `Usage: node scripts/check-bmad-refs.mjs [options]

Checks /bmad-* slash references against installed BMAD skill directories.

Options:
  --repo-root <path>      Repository root to scan. Default: current directory.
  --skills-dir <path>     Skill directory to check. Default: project and home skill dirs.
  --extra-skills-dir <path>
                          Additional skill directory/source tree to check. Repeatable.
  --require-gds          Fail on /gds-* references too.
  --help                 Show this help.
`;

function parseArgs(argv) {
  const args = {
    repoRoot: process.cwd(),
    skillsDir: null,
    extraSkillsDirs: [],
    requireGds: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
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
    if (arg === "--require-gds") {
      args.requireGds = true;
      continue;
    }
    failUsage(`Unknown option: ${arg}`);
  }

  args.repoRoot = path.resolve(args.repoRoot);
  if (args.skillsDir) {
    args.skillsDir = path.resolve(args.repoRoot, args.skillsDir);
  }
  args.extraSkillsDirs = args.extraSkillsDirs.map((dir) =>
    path.resolve(args.repoRoot, dir),
  );
  return args;
}

function failUsage(message) {
  console.error(`Error: ${message}\n\n${HELP}`);
  process.exit(2);
}

function resolveSkillsDirs(repoRoot, explicitDir) {
  const home = process.env.HOME || "";
  const candidates = explicitDir
    ? [explicitDir]
    : [
        path.resolve(repoRoot, ".agents/skills"),
        path.resolve(repoRoot, ".codex/skills"),
        path.resolve(repoRoot, ".claude/skills"),
        path.resolve(repoRoot, "../.agents/skills"),
        path.resolve(repoRoot, "../.codex/skills"),
        path.resolve(repoRoot, "../.claude/skills"),
        home ? path.resolve(home, ".agents/skills") : null,
        home ? path.resolve(home, ".codex/skills") : null,
        home ? path.resolve(home, ".claude/skills") : null,
      ];

  const seen = new Set();
  const dirs = candidates
    .filter(Boolean)
    .filter((candidate) => {
      if (seen.has(candidate) || !isDirectory(candidate)) return false;
      seen.add(candidate);
      return true;
    });
  if (dirs.length > 0) return dirs;

  console.error("Error: no skills directory found. Pass --skills-dir <path>.");
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

function listSkillNames(skillsDirs) {
  const skills = new Set();

  for (const skillsDir of skillsDirs) {
    if (!isDirectory(skillsDir)) {
      console.error(`Error: skills directory not found: ${skillsDir}`);
      process.exit(2);
    }

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

function walkFiles(dir, predicate, out = []) {
  if (!isDirectory(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, predicate, out);
    } else if (entry.isFile() && predicate(entryPath)) {
      out.push(entryPath);
    }
  }
  return out;
}

function collectScanFiles(repoRoot) {
  const files = [];
  const directFiles = [
    "README.md",
    "CHANGELOG.md",
    "docs/commands-reference.md",
    "docs/concepts.md",
    "docs/faq.md",
    "docs/getting-started.md",
    "docs/installation.md",
    "docs/sprints.md",
    "docs/tutorial-bmm.md",
    "docs/tutorial-codex.md",
    "docs/tutorial-gds.md",
  ];

  for (const file of directFiles) {
    const fullPath = path.join(repoRoot, file);
    if (isFile(fullPath)) files.push(fullPath);
  }

  files.push(
    ...walkFiles(path.join(repoRoot, "commands"), (filePath) =>
      filePath.endsWith(".md"),
    ),
  );
  files.push(
    ...walkFiles(path.join(repoRoot, "skills"), (filePath) =>
      filePath.endsWith(".md") ||
      filePath.endsWith(".yaml") ||
      filePath.endsWith(".csv"),
    ),
  );

  return [...new Set(files)].sort();
}

const URL_PREFIX_RE = /https?:\/\/[^\s)]+$/;
const REF_RE = /\/((?:bmad|gds)-[a-z0-9][a-z0-9-]*)/g;

function shouldIgnoreRef(ref, beforeSlash, afterRef) {
  if (URL_PREFIX_RE.test(beforeSlash)) return true;
  if (ref.endsWith("-")) return true;

  const previous = beforeSlash.at(-1) || "";
  if (previous && /[A-Za-z0-9_.-]/.test(previous)) return true;

  const next = afterRef.at(0) || "";
  if (next && /[A-Za-z0-9_-]/.test(next)) return true;

  return false;
}

function extractRefs(filePath, repoRoot) {
  const content = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(repoRoot, filePath);
  const refs = [];

  content.split(/\r?\n/).forEach((line, index) => {
    for (const match of line.matchAll(REF_RE)) {
      const beforeSlash = line.slice(0, match.index);
      const afterRef = line.slice(match.index + match[0].length);
      if (shouldIgnoreRef(match[1], beforeSlash, afterRef)) continue;
      refs.push({
        file: relPath,
        line: index + 1,
        ref: match[1],
      });
    }
  });

  return refs;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const skillsDirs = [...resolveSkillsDirs(args.repoRoot, args.skillsDir), ...args.extraSkillsDirs];
  const skills = listSkillNames(skillsDirs);
  const scanFiles = collectScanFiles(args.repoRoot);
  const refs = scanFiles.flatMap((filePath) => extractRefs(filePath, args.repoRoot));
  const failures = [];
  const ignoredGds = new Set();

  for (const ref of refs) {
    if (ref.ref.startsWith("gds-") && !args.requireGds) {
      ignoredGds.add(ref.ref);
      continue;
    }
    if (!skills.has(ref.ref)) failures.push(ref);
  }

  if (failures.length > 0) {
    console.error("Missing BMAD skill references:");
    for (const failure of failures) {
      console.error(`  ${failure.file}:${failure.line} /${failure.ref}`);
    }
    console.error(`\nChecked skills: ${skillsDirs.join(", ")}`);
    if (ignoredGds.size > 0) {
      console.error(
        `Ignored GDS refs: ${[...ignoredGds].sort().map((ref) => `/${ref}`).join(", ")}`,
      );
    }
    process.exit(1);
  }

  console.log(`BMAD reference check passed (${refs.length} refs, ${skills.size} skills).`);
  console.log(`Checked skills: ${skillsDirs.join(", ")}`);
  if (ignoredGds.size > 0) {
    console.log(
      `Ignored GDS refs: ${[...ignoredGds].sort().map((ref) => `/${ref}`).join(", ")}`,
    );
  }
}

main();
