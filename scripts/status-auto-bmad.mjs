#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const HELP = `Usage: node scripts/status-auto-bmad.mjs [options]

Fast read-only Auto-BMAD progress lookup. Reads module YAML config and
sprint-status.yaml only. It does not inspect skills or optional modules.

Options:
  --project-root <path>  Project root to check. Default: current directory.
  --module <name>        Module config to read: bmm or gds. Default: bmm.
  --kind <name>          Output focus: summary, story, sprint, or epic. Default: summary.
  --wizard               Include sprint wizard plan progress when available.
  --json                 Print machine-readable JSON.
  --help                 Show this help.
`;

const DONE_STATUSES = new Set(["done", "completed", "shipped"]);
const OPTIONAL_STATUSES = new Set(["optional"]);
const QUICK_STORY_STEPS = ["create", "dev", "review"];
const QUICK_EPIC_END_STEPS = ["retro"];
const STEP_REQUIREMENTS = {
  create: ["bmad-create-story"],
  dev: ["bmad-dev-story"],
  review: ["bmad-code-review"],
  "security-review": ["bmad-code-review"],
  "extra-review": ["bmad-code-review"],
  retro: ["bmad-retrospective"],
  e2e: ["bmad-qa-generate-e2e-tests"],
  "test-design": ["bmad-testarch-test-design"],
  atdd: ["bmad-testarch-atdd"],
  trace: ["bmad-testarch-trace"],
  automate: ["bmad-testarch-automate"],
  nfr: ["bmad-testarch-nfr"],
  "test-review": ["bmad-testarch-test-review"],
  "project-context": ["bmad-generate-project-context"],
};

function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    module: "bmm",
    kind: "summary",
    wizard: false,
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
    if (arg === "--module") {
      args.module = argv[++i];
      if (!["bmm", "gds"].includes(args.module)) failUsage("--module must be bmm or gds");
      continue;
    }
    if (arg === "--kind") {
      args.kind = argv[++i];
      if (!["summary", "story", "sprint", "epic"].includes(args.kind)) {
        failUsage("--kind must be summary, story, sprint, or epic");
      }
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--wizard") {
      args.wizard = true;
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

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function walkFiles(dir, predicate, out = []) {
  if (!isDirectory(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(entryPath, predicate, out);
    else if (entry.isFile() && predicate(entryPath)) out.push(entryPath);
  }
  return out;
}

function detectSkills(projectRoot) {
  const home = process.env.HOME || "";
  const candidates = [
    path.join(projectRoot, ".agents/skills"),
    path.join(projectRoot, ".codex/skills"),
    path.join(projectRoot, ".claude/skills"),
    path.join(projectRoot, "../.agents/skills"),
    path.join(projectRoot, "../.codex/skills"),
    path.join(projectRoot, "../.claude/skills"),
    home ? path.join(home, ".agents/skills") : null,
    home ? path.join(home, ".codex/skills") : null,
    home ? path.join(home, ".claude/skills") : null,
  ].filter(Boolean);

  const dirs = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved) || !isDirectory(resolved)) continue;
    seen.add(resolved);
    dirs.push(resolved);
  }

  const names = new Set();
  for (const dir of dirs) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) names.add(entry.name);
    }
    for (const skillFile of walkFiles(dir, (filePath) => filePath.endsWith(`${path.sep}SKILL.md`))) {
      names.add(path.basename(path.dirname(skillFile)));
    }
  }

  return { dirs, names };
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

function parseDevelopmentStatus(text) {
  const statuses = [];
  const lines = text.split(/\r?\n/);
  let inDevelopmentStatus = false;

  for (const line of lines) {
    if (/^\s*development_status:\s*$/.test(line)) {
      inDevelopmentStatus = true;
      continue;
    }
    if (inDevelopmentStatus && /^\S/.test(line)) break;
    if (!inDevelopmentStatus) continue;

    const match = line.match(/^\s{2,}([^:#][^:]*):\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1].trim();
    const status = match[2].trim().replace(/^["']|["']$/g, "");
    statuses.push({ key, status });
  }

  return statuses;
}

function storyTitleFromKey(key) {
  return key.replace(/^\d+-\d+-?/, "").replaceAll("-", " ").trim();
}

function buildProgress(projectRoot, moduleName) {
  const configPath = path.join(projectRoot, "_bmad", moduleName, "config.yaml");
  const configText = readText(configPath);
  const outputFolder = resolveProjectPath(projectRoot, parseYamlValue(configText, "output_folder"));
  const planningArtifacts = resolveProjectPath(
    projectRoot,
    parseYamlValue(configText, "planning_artifacts"),
  );
  const implementationArtifacts = resolveProjectPath(
    projectRoot,
    parseYamlValue(configText, "implementation_artifacts"),
  );
  const sprintStatusPath = implementationArtifacts
    ? path.join(implementationArtifacts, "sprint-status.yaml")
    : null;
  const sprintStatusText = sprintStatusPath ? readText(sprintStatusPath) : "";
  const statusRows = parseDevelopmentStatus(sprintStatusText);
  const skills = detectSkills(projectRoot);

  const epics = new Map();
  for (const row of statusRows) {
    const epicMatch = row.key.match(/^epic-(\d+)$/);
    if (epicMatch) {
      const id = epicMatch[1];
      if (!epics.has(id)) epics.set(id, { id, status: row.status, stories: [] });
      epics.get(id).status = row.status;
      continue;
    }

    const storyMatch = row.key.match(/^(\d+)-(\d+)(?:-|$)/);
    if (!storyMatch) continue;

    const epicId = storyMatch[1];
    const storyNumber = storyMatch[2];
    const story = {
      id: `${epicId}-${storyNumber}`,
      epicId,
      storyNumber: Number(storyNumber),
      key: row.key,
      title: storyTitleFromKey(row.key),
      status: row.status,
      done: DONE_STATUSES.has(row.status.toLowerCase()),
      optional: OPTIONAL_STATUSES.has(row.status.toLowerCase()),
    };

    if (!epics.has(epicId)) epics.set(epicId, { id: epicId, status: "unknown", stories: [] });
    epics.get(epicId).stories.push(story);
  }

  const epicList = [...epics.values()]
    .map((epic) => ({
      ...epic,
      stories: epic.stories.sort((a, b) => a.storyNumber - b.storyNumber),
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));

  const pendingStories = epicList
    .flatMap((epic) => epic.stories)
    .filter((story) => !story.done && !story.optional);
  const nextStory = pendingStories[0] || null;
  const nextEpic = nextStory
    ? epicList.find((epic) => epic.id === nextStory.epicId) || null
    : epicList.find((epic) => epic.status && !DONE_STATUSES.has(epic.status.toLowerCase())) || null;

  return {
    projectRoot,
    module: moduleName,
    configPath,
    configFound: isFile(configPath),
    outputFolder,
    planningArtifacts,
    implementationArtifacts,
    sprintStatusPath,
    sprintStatusFound: sprintStatusPath ? isFile(sprintStatusPath) : false,
    planningState: detectPlanningState(planningArtifacts),
    capabilities: detectCapabilities(projectRoot, skills),
    wizard: detectWizardState(outputFolder, skills),
    epics: epicList,
    nextEpic: nextEpic
      ? {
          id: nextEpic.id,
          status: nextEpic.status,
          pendingStories: nextEpic.stories.filter((story) => !story.done && !story.optional).length,
        }
      : null,
    nextStory,
  };
}

function detectCapabilities(projectRoot, skills) {
  const teaConfigPath = path.join(projectRoot, "_bmad", "tea", "config.yaml");
  const hasTea = isFile(teaConfigPath);
  const missingQuick = missingStepSkills([...QUICK_STORY_STEPS, ...QUICK_EPIC_END_STEPS], skills.names);
  const missingE2e = missingStepSkills(["e2e"], skills.names);
  const fullSteps = ["test-design", "atdd", "trace", "automate", "nfr", "test-review", "project-context"];
  const missingFull = missingStepSkills(fullSteps, skills.names);
  return {
    skillsDirs: skills.dirs,
    quickAvailable: missingQuick.length === 0,
    e2eAvailable: missingE2e.length === 0,
    fullAvailable: hasTea && missingFull.length === 0,
    teaConfigFound: hasTea,
    missingQuick,
    missingE2e,
    missingFull,
  };
}

function missingStepSkills(steps, skillNames) {
  const missing = [];
  const seen = new Set();
  for (const step of steps) {
    for (const skill of STEP_REQUIREMENTS[step] || []) {
      if (!skillNames.has(skill) && !seen.has(skill)) {
        seen.add(skill);
        missing.push(skill);
      }
    }
  }
  return missing;
}

function detectWizardState(outputFolder, skills) {
  if (!outputFolder) return { found: false };
  const planPath = path.join(outputFolder, "auto-bmad-artifacts", "sprint-plan.yaml");
  const text = readText(planPath);
  if (!text) return { found: false, planPath };

  const stories = [];
  const epics = [];
  const lines = text.split(/\r?\n/);
  let currentEpic = null;
  let inEpics = false;
  let inStories = false;
  let inSelectedStorySteps = false;
  let inSelectedEpicEnd = false;
  const selectedStorySteps = [];
  const selectedEpicEndSteps = [];

  for (const line of lines) {
    if (/^selected_steps:\s*$/.test(line)) {
      inSelectedStorySteps = false;
      inSelectedEpicEnd = false;
      continue;
    }
    const selectedStoryMatch = line.match(/^\s{2}story:\s*\[(.*?)\]\s*$/);
    if (selectedStoryMatch) {
      selectedStorySteps.push(...parseInlineList(selectedStoryMatch[1]));
      inSelectedStorySteps = false;
      inSelectedEpicEnd = false;
      continue;
    }
    const selectedEpicEndMatch = line.match(/^\s{2}epic_end:\s*\[(.*?)\]\s*$/);
    if (selectedEpicEndMatch) {
      selectedEpicEndSteps.push(...parseInlineList(selectedEpicEndMatch[1]));
      inSelectedStorySteps = false;
      inSelectedEpicEnd = false;
      continue;
    }
    if (/^\s{2}story:\s*$/.test(line)) {
      inSelectedStorySteps = true;
      inSelectedEpicEnd = false;
      continue;
    }
    if (/^\s{2}epic_end:\s*$/.test(line)) {
      inSelectedStorySteps = false;
      inSelectedEpicEnd = true;
      continue;
    }
    const listItemMatch = line.match(/^\s{4}-\s*"?([^"\n]+)"?\s*$/);
    if (listItemMatch && inSelectedStorySteps) {
      selectedStorySteps.push(listItemMatch[1].trim());
      continue;
    }
    if (listItemMatch && inSelectedEpicEnd) {
      selectedEpicEndSteps.push(listItemMatch[1].trim());
      continue;
    }

    if (/^epics:\s*$/.test(line)) {
      inEpics = true;
      continue;
    }
    if (inEpics && /^\S/.test(line) && !/^epics:\s*$/.test(line)) {
      inEpics = false;
      inStories = false;
    }
    if (!inEpics) continue;

    const epicMatch = line.match(/^\s{2}-\s+id:\s*"?([^"\n]+)"?\s*$/);
    if (epicMatch) {
      currentEpic = { id: epicMatch[1].trim(), status: "unknown", stories: [] };
      epics.push(currentEpic);
      inStories = false;
      continue;
    }
    if (!currentEpic) continue;

    const epicStatusMatch = line.match(/^\s{4}status:\s*"?([^"\n]+)"?\s*$/);
    if (epicStatusMatch && !inStories) {
      currentEpic.status = epicStatusMatch[1].trim();
      continue;
    }
    if (/^\s{4}stories:\s*$/.test(line)) {
      inStories = true;
      continue;
    }
    const storyMatch = line.match(/^\s{6}-\s+id:\s*"?([^"\n]+)"?\s*$/);
    if (storyMatch && inStories) {
      const story = {
        id: storyMatch[1].trim(),
        epicId: currentEpic.id,
        status: "unknown",
      };
      currentEpic.stories.push(story);
      stories.push(story);
      continue;
    }
    const storyStatusMatch = line.match(/^\s{8}status:\s*"?([^"\n]+)"?\s*$/);
    if (storyStatusMatch && inStories && currentEpic.stories.length) {
      currentEpic.stories[currentEpic.stories.length - 1].status = storyStatusMatch[1].trim();
    }
  }

  const status = parseYamlValue(text, "status");
  const updated = parseYamlValue(text, "updated");
  const currentEpicId = parseYamlValue(text, "current_epic");
  const currentStory = parseYamlValue(text, "current_story");
  const currentStep = parseYamlValue(text, "current_step");
  const completedStories = stories.filter((story) => DONE_STATUSES.has(story.status.toLowerCase())).length;
  const pendingStories = stories.filter((story) => !DONE_STATUSES.has(story.status.toLowerCase())).length;
  const nextStory = stories.find((story) => !DONE_STATUSES.has(story.status.toLowerCase())) || null;
  const nextEpic = epics.find((epic) => epic.status.toLowerCase() !== "completed") || null;
  const storySteps = unique(selectedStorySteps.length ? selectedStorySteps : QUICK_STORY_STEPS);
  const epicEndSteps = unique(selectedEpicEndSteps.length ? selectedEpicEndSteps : QUICK_EPIC_END_STEPS);
  const allSteps = [...storySteps, ...epicEndSteps];
  const missingStepSkillsList = missingStepSkills(allSteps, skills.names);
  const unavailableSteps = allSteps
    .filter((step) => (STEP_REQUIREMENTS[step] || []).some((skill) => !skills.names.has(skill)))
    .filter((step, index, list) => list.indexOf(step) === index);
  const nonQuickSteps = allSteps.filter((step) => ![...QUICK_STORY_STEPS, ...QUICK_EPIC_END_STEPS].includes(step));

  return {
    found: true,
    planPath,
    status,
    updated,
    currentEpic: currentEpicId,
    currentStory,
    currentStep,
    completedStories,
    pendingStories,
    totalStories: stories.length,
    completedEpics: epics.filter((epic) => epic.status.toLowerCase() === "completed").length,
    totalEpics: epics.length,
    storySteps,
    epicEndSteps,
    remainingTasks: buildRemainingTasks(epics, storySteps, epicEndSteps),
    unavailableSteps,
    missingStepSkills: missingStepSkillsList,
    nonQuickSteps,
    nextStory,
    nextEpic: nextEpic ? { id: nextEpic.id, status: nextEpic.status } : null,
  };
}

function parseInlineList(value) {
  return value
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function unique(items) {
  return items.filter((item, index, list) => list.indexOf(item) === index);
}

function buildRemainingTasks(epics, storySteps, epicEndSteps) {
  const tasks = [];
  for (const epic of epics) {
    if (epic.status.toLowerCase() === "completed") continue;
    for (const story of epic.stories) {
      if (DONE_STATUSES.has(story.status.toLowerCase())) continue;
      for (const step of storySteps) {
        tasks.push({ epicId: epic.id, storyId: story.id, type: "story", step });
      }
    }
    if (epic.stories.every((story) => DONE_STATUSES.has(story.status.toLowerCase()))) {
      for (const step of epicEndSteps) tasks.push({ epicId: epic.id, type: "epic_end", step });
    }
  }
  return tasks;
}

function detectPlanningState(planningArtifacts) {
  if (!planningArtifacts) return { exists: false, hasPrd: false, hasEpics: false, hasArchitecture: false };
  const hasPrd = hasAny(planningArtifacts, ["prd.md", "prd/index.md"]);
  const hasEpics = hasAny(planningArtifacts, ["epics.md", "epics/index.md"]);
  const hasArchitecture = hasAny(planningArtifacts, ["architecture.md", "architecture/index.md"]);
  return {
    exists: isDirectory(planningArtifacts),
    hasPrd,
    hasEpics,
    hasArchitecture,
  };
}

function hasAny(root, relativePaths) {
  return relativePaths.some((relativePath) => isFile(path.join(root, relativePath)));
}

function printHuman(progress, kind) {
  console.log("Auto-BMAD Status");
  console.log(`Project: ${progress.projectRoot}`);
  console.log(`Config: ${relative(progress.projectRoot, progress.configPath)}${progress.configFound ? "" : " (missing)"}`);
  console.log(
    `Sprint status: ${
      progress.sprintStatusPath ? relative(progress.projectRoot, progress.sprintStatusPath) : "(unknown)"
    }${progress.sprintStatusFound ? "" : " (missing)"}`,
  );

  if (progress.wizard?.found) {
    printWizard(progress);
  }

  if (!progress.configFound) {
    console.log(`\nMissing _bmad/${progress.module}/config.yaml.`);
    console.log("This project does not have the BMAD module YAML needed for Auto-BMAD status.");
    console.log("Suggested: install BMAD 6.5 with the module first, then run $auto-bmad again.");
    return;
  }
  if (!progress.sprintStatusFound) {
    printNoSprintStatusFallback(progress);
    return;
  }

  const modePrefix = progress.module === "gds" ? "gds " : "";
  const commandPrefix = progress.module === "gds" ? "gds " : "";
  const storyLabel = progress.nextStory
    ? `${progress.nextStory.id}${progress.nextStory.title ? ` (${progress.nextStory.title})` : ""}`
    : "none";

  if (["summary", "story"].includes(kind)) {
    console.log(`\nNext pending story: ${storyLabel}`);
    if (progress.nextStory) {
      console.log(`Suggested: $auto-bmad ${commandPrefix}quick story ${progress.nextStory.id}`);
    }
  }

  if (["summary", "sprint", "epic"].includes(kind)) {
    const nextEpicId = progress.nextEpic?.id || "none";
    console.log(`\nNext pending epic: ${nextEpicId}`);
    if (progress.nextEpic) {
      console.log(`Pending stories in epic ${progress.nextEpic.id}: ${progress.nextEpic.pendingStories}`);
      console.log(`Suggested: $auto-bmad ${modePrefix}quick sprint ${progress.nextEpic.id}`);
    }
  }

  if (["summary", "story", "sprint", "epic"].includes(kind)) {
    printChoices(progress);
  }
}

function printWizard(progress) {
  const wizard = progress.wizard;
  console.log("\nSprint wizard plan:");
  console.log(`Plan: ${relative(progress.projectRoot, wizard.planPath)}`);
  console.log(`Status: ${wizard.status || "unknown"}${wizard.updated ? ` (updated ${wizard.updated})` : ""}`);
  console.log(`Current: Epic ${wizard.currentEpic || "unknown"}, Story ${wizard.currentStory || "unknown"}, Step ${wizard.currentStep || "unknown"}`);
  console.log(`Progress: ${wizard.completedStories}/${wizard.totalStories} stories, ${wizard.completedEpics}/${wizard.totalEpics} epics completed`);
  if (wizard.nextStory) {
    console.log(`Next pending in plan: Epic ${wizard.nextStory.epicId}, Story ${wizard.nextStory.id}`);
  }
  console.log(`Story steps: ${wizard.storySteps.join(" -> ")}`);
  console.log(`Epic-end steps: ${wizard.epicEndSteps.join(" -> ")}`);
  if (wizard.unavailableSteps.length) {
    console.log("\nCapability warning:");
    console.log(`Plan includes unavailable steps: ${wizard.unavailableSteps.join(", ")}`);
    console.log(`Missing skills: ${wizard.missingStepSkills.join(", ")}`);
    if (wizard.nonQuickSteps.length) {
      console.log("This installation can run quick mode, but the plan includes non-quick/optional steps.");
      console.log("For full mode install TEA/test-architecture config and skills; for E2E install bmad-qa-generate-e2e-tests.");
    }
  } else if (wizard.nonQuickSteps.length) {
    console.log("\nCapability: non-quick/optional plan steps are installed.");
  }
  if (wizard.remainingTasks.length) {
    console.log("\nRemaining task list:");
    for (const task of wizard.remainingTasks.slice(0, 20)) {
      const target = task.type === "story" ? `${task.storyId}` : `epic-${task.epicId}-end`;
      console.log(`- Epic ${task.epicId}: ${target} -> ${task.step}`);
    }
    if (wizard.remainingTasks.length > 20) {
      console.log(`- ... ${wizard.remainingTasks.length - 20} more tasks`);
    }
  }
}

function printChoices(progress) {
  const choices = [];
  const commandPrefix = progress.module === "gds" ? "gds " : "";
  if (progress.nextStory) {
    choices.push({
      label: `Run next story ${progress.nextStory.id}`,
      command: `$auto-bmad ${commandPrefix}quick story ${progress.nextStory.id}`,
    });
  }
  if (progress.nextEpic) {
    choices.push({
      label: `Run next epic ${progress.nextEpic.id}`,
      command: `$auto-bmad ${commandPrefix}quick sprint ${progress.nextEpic.id}`,
    });
  }

  if (!choices.length) return;

  console.log("\nChoose next action:");
  choices.forEach((choice, index) => {
    const suffix = index === 0 ? " (default)" : "";
    console.log(`${index + 1}. ${choice.label}${suffix}`);
    console.log(`   ${choice.command}`);
  });
  console.log("\nReply with 1 or 2. `continue` uses option 1.");
}

function printNoSprintStatusFallback(progress) {
  console.log("\nNo sprint-status.yaml found.");
  console.log("This is normal for a new project or a project that has not run sprint planning yet.");
  console.log("No separate auto-bmad YAML is required for BMAD 6.5+.");

  const planning = progress.planningState;
  if (!planning.exists || (!planning.hasPrd && !planning.hasEpics && !planning.hasArchitecture)) {
    console.log("\nDetected: pre-planning project.");
    console.log("Suggested next step:");
    console.log("- Run $auto-bmad-check once if you want to see whether automated planning is available.");
    console.log("- If full planning is available, run $auto-bmad plan <product context>.");
    console.log("- Otherwise run BMAD planning manually, then run sprint planning to create sprint-status.yaml.");
    return;
  }

  if (planning.hasEpics) {
    console.log("\nDetected: planning artifacts exist, but sprint planning has not created status yet.");
    console.log("Suggested next step:");
    console.log("- Run BMAD sprint planning to create sprint-status.yaml.");
    console.log("- Then run $auto-bmad again for the next story/epic suggestion.");
    return;
  }

  console.log("\nDetected: partial planning artifacts exist.");
  console.log("Suggested next step:");
  console.log("- Finish PRD/architecture/epics planning, then run sprint planning.");
}

function relative(root, filePath) {
  if (!filePath) return "";
  const rel = path.relative(root, filePath);
  return rel && !rel.startsWith("..") ? rel : filePath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const progress = buildProgress(args.projectRoot, args.module);

  if (args.json) {
    console.log(JSON.stringify(progress, null, 2));
    return;
  }

  printHuman(progress, args.kind);
}

main();
