#!/usr/bin/env node

// src/wizard.ts
import * as p from "@clack/prompts";
import chalk from "chalk";
import { dirname as dirname3, join as join4, resolve } from "path";
import { existsSync as existsSync4, mkdirSync as mkdirSync3, readFileSync as readFileSync3, unlinkSync, writeFileSync as writeFileSync3 } from "fs";
import yaml2 from "js-yaml";

// src/detect.ts
import { existsSync } from "fs";
import { join } from "path";
function detectMode(cwd) {
  return existsSync(join(cwd, "profile.yaml")) ? "update" : "install";
}

// src/scaffold.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2, readFileSync as readFileSync2 } from "fs";
import { join as join3, dirname as dirname2 } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

// src/template.ts
function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return key in vars ? vars[key] : `{{${key}}}`;
  });
}

// src/upgrade.ts
import { existsSync as existsSync3, mkdirSync, writeFileSync } from "fs";
import { join as join2, dirname } from "path";

// src/checksums.ts
import { createHash } from "crypto";
import { readFileSync, existsSync as existsSync2 } from "fs";
function hashContent(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
function hashFile(filePath) {
  if (!existsSync2(filePath)) return null;
  return hashContent(readFileSync(filePath, "utf8"));
}
var LINKEDIN_MANAGED_FILES = [
  ".claude/commands/li-all.md",
  ".claude/commands/li-about.md",
  ".claude/commands/li-headline.md",
  ".claude/commands/li-experience.md",
  ".claude/commands/li-skills.md",
  ".claude/commands/li-featured.md",
  ".claude/commands/li-activity.md"
];
var MODULE_MANAGED_FILES = {
  linkedin: [
    ...LINKEDIN_MANAGED_FILES,
    ".claude/modules/linkedin/manifest.md"
  ]
};
var MODULE_CONTENT_FILES = {
  linkedin: [
    "INSTRUCTIONS.md",
    "LinkedIn Current State.md",
    "LinkedIn About.md",
    "LinkedIn Headline.md",
    "LinkedIn Experience.md",
    "LinkedIn Skills.md",
    "LinkedIn Featured.md",
    "LinkedIn Activity.md"
  ]
};

// src/upgrade.ts
function writeManagedFile(targetDir, relativePath, newContent, storedChecksums) {
  const fullPath = join2(targetDir, relativePath);
  const newChecksum = hashContent(newContent);
  if (!existsSync3(fullPath)) {
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, newContent, "utf8");
    return { outcome: "added", checksum: newChecksum };
  }
  const currentHash = hashFile(fullPath);
  const storedHash = storedChecksums[relativePath];
  if (!storedHash || currentHash === storedHash) {
    writeFileSync(fullPath, newContent, "utf8");
    return { outcome: "updated", checksum: newChecksum };
  }
  return { outcome: "skipped", checksum: storedHash };
}

// src/scaffold.ts
var __dirname = dirname2(fileURLToPath(import.meta.url));
var TEMPLATES_DIR = join3(__dirname, "templates");
function tpl(relativePath) {
  return readFileSync2(join3(TEMPLATES_DIR, relativePath), "utf8");
}
function writeRaw(targetDir, relativePath, content) {
  const full = join3(targetDir, relativePath);
  mkdirSync2(dirname2(full), { recursive: true });
  writeFileSync2(full, content, "utf8");
}
function touch(targetDir, relativePath) {
  const full = join3(targetDir, relativePath);
  mkdirSync2(dirname2(full), { recursive: true });
  writeFileSync2(full, "", "utf8");
}
function profileToVars(profile, liProfileUrl) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return {
    PATINA_NAME: profile.patina_name,
    USER_NAME: profile.name,
    USER_TITLE: profile.title ?? "",
    ROLE_DESCRIPTION: profile.role_description ?? "",
    COMPANY_NAME: profile.work.company_name,
    COMPANY_DESCRIPTION: profile.work.company_description ?? "",
    CONTENT_DIR: profile.content_dir,
    EDITOR: profile.editor,
    LI_PROFILE_URL: liProfileUrl ?? profile.linkedin?.profile_url ?? "",
    TODAY: today
  };
}
function baseManagedFiles(vars, editor, targetDir) {
  const files = [
    ["CLAUDE.md", render(tpl("CLAUDE.md"), vars)],
    [".claude/settings.json", tpl(".claude/settings.json")],
    [".claude/commands/add.md", render(tpl(".claude/commands/add.md"), vars)],
    [".claude/commands/reflect.md", render(tpl(".claude/commands/reflect.md"), vars)]
  ];
  if (editor === "obsidian" && targetDir) {
    const mcp = {
      mcpServers: {
        obsidian: {
          command: "npx",
          args: ["-y", "mcp-obsidian@latest", join3(targetDir, vars.CONTENT_DIR)]
        }
      }
    };
    files.push([".mcp.json", JSON.stringify(mcp, null, 2) + "\n"]);
  }
  return files;
}
function moduleManagedFiles(module, vars) {
  if (module === "linkedin") {
    const liCmds = [
      "li-all.md",
      "li-about.md",
      "li-headline.md",
      "li-experience.md",
      "li-skills.md",
      "li-featured.md",
      "li-activity.md"
    ];
    const files = liCmds.map((cmd) => [
      `.claude/commands/${cmd}`,
      render(tpl(`modules/linkedin/commands/${cmd}`), vars)
    ]);
    files.push([
      ".claude/modules/linkedin/manifest.md",
      render(tpl("modules/linkedin/manifest.md"), vars)
    ]);
    return files;
  }
  return [];
}
function moduleContentFiles(module, vars, contentDir) {
  if (module === "linkedin") {
    const files = MODULE_CONTENT_FILES["linkedin"] ?? [];
    return files.map((file) => [
      `${contentDir}/linkedin/${file}`,
      render(tpl(`modules/linkedin/graph/${file}`), vars)
    ]);
  }
  return [];
}
async function scaffold(opts) {
  const {
    targetDir,
    patinaName,
    userName,
    title,
    roleDescription,
    jobDescriptionUrl,
    work,
    editor,
    modules,
    liProfileUrl,
    contentDir
  } = opts;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const tempProfile = {
    patina_name: patinaName,
    name: userName,
    title,
    role_description: roleDescription || void 0,
    job_description_url: jobDescriptionUrl || void 0,
    work,
    editor,
    modules,
    content_dir: contentDir,
    created: today,
    ...modules.includes("linkedin") && liProfileUrl ? { linkedin: { profile_url: liProfileUrl } } : {}
  };
  const vars = {
    PATINA_NAME: patinaName,
    USER_NAME: userName,
    USER_TITLE: title,
    ROLE_DESCRIPTION: roleDescription,
    COMPANY_NAME: work.company_name,
    COMPANY_DESCRIPTION: work.company_description ?? "",
    CONTENT_DIR: contentDir,
    EDITOR: editor,
    LI_PROFILE_URL: liProfileUrl,
    TODAY: today
  };
  mkdirSync2(targetDir, { recursive: true });
  const checksums = {};
  const managedFiles = [
    ...baseManagedFiles(vars, editor, targetDir),
    ...modules.flatMap((m) => moduleManagedFiles(m, vars))
  ];
  for (const [relativePath, content] of managedFiles) {
    const { checksum } = writeManagedFile(targetDir, relativePath, content, {});
    checksums[relativePath] = checksum;
  }
  const baseDirs = ["notes", "skills", "posts"];
  for (const dir of baseDirs) {
    touch(targetDir, `${contentDir}/${dir}/.gitkeep`);
  }
  writeRaw(targetDir, `${contentDir}/notes/README.md`, render(tpl("graph/notes/README.md"), vars));
  writeRaw(targetDir, `${contentDir}/notes/exclusions.md`, render(tpl("graph/notes/exclusions.md"), vars));
  if (modules.includes("linkedin")) {
    for (const [relativePath, content] of moduleContentFiles("linkedin", vars, contentDir)) {
      writeRaw(targetDir, relativePath, content);
    }
  }
  const profile = {
    ...tempProfile,
    _checksums: checksums
  };
  writeRaw(targetDir, "profile.yaml", yaml.dump(profile));
  writeRaw(targetDir, ".gitignore", ".obsidian/\n.DS_Store\n");
}

// src/wizard.ts
function printBanner() {
  const gradient = ["#FF6B6B", "#FF8C42", "#FFAB2E", "#C084FC", "#818CF8"];
  const title = "patina".split("").map((char, i) => chalk.bold.hex(gradient[i % gradient.length])(char)).join("");
  console.log("");
  console.log(`  ${title}`);
  console.log(`  ${chalk.hex("#94A3B8")("your professional story, organized")}`);
  console.log("");
}
function privacyNote() {
  return [
    chalk.bold.hex("#38BDF8")("Your content stays on your computer. Always."),
    chalk.hex("#CBD5E1")(
      "Everything in your patina \u2014 your profile, notes, skills,\nand LinkedIn drafts \u2014 lives in a folder on your machine.\nNothing is sent to the internet, nothing is stored in the\ncloud, and nothing is shared with anyone. You own it all\nand can open, edit, or delete any of it at any time."
    )
  ].join("\n\n");
}
function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patina";
}
function label(text2) {
  return chalk.bold.hex("#C084FC")(text2);
}
var MULTISELECT_HINT = `
  ${chalk.hex("#64748B")("\u2191\u2193 to move  \xB7  space to select  \xB7  enter to confirm")}`;
var OPTIONAL_HINT = ` ${chalk.dim.italic("optional, but helps a lot \u2014 hit enter to skip")}`;
async function main() {
  printBanner();
  const cwd = process.cwd();
  const mode = detectMode(cwd);
  if (mode === "update") {
    await runUpdate(cwd);
  } else {
    await runInstall(cwd);
  }
}
async function runInstall(cwd) {
  p.intro(chalk.hex("#94A3B8")("No patina found here \u2014 let's create one."));
  p.note(privacyNote(), label("Privacy first"));
  const identity = await p.group(
    {
      patinaName: () => p.text({
        message: "What do you want to call your patina?",
        placeholder: "patina",
        defaultValue: "patina",
        hint: chalk.hex("#64748B")("becomes your folder name")
      }),
      userName: () => p.text({
        message: "What's your name?",
        placeholder: "Your full name",
        validate: (v) => v.trim() === "" ? "Name is required." : void 0
      }),
      title: () => p.text({
        message: `What's your professional title?${OPTIONAL_HINT}`,
        placeholder: "e.g. Senior Engineer, Creative Director, Freelance Photographer"
      }),
      roleDescription: () => p.text({
        message: `Describe what you do \u2014 in your own words, not your title.${OPTIONAL_HINT}`,
        placeholder: "e.g. I lead a small team building software for financial advisors"
      }),
      jobDescriptionUrl: () => p.text({
        message: `Got a link to a job description or role overview?${OPTIONAL_HINT}`,
        placeholder: "https://..."
      })
    },
    { onCancel }
  );
  console.log("");
  console.log(`  ${label("Where you work")}`);
  const selfEmployed = await p.confirm({
    message: "Are you self-employed or freelance?",
    initialValue: false
  });
  if (p.isCancel(selfEmployed)) onCancel();
  const companyLabel = selfEmployed ? "What's your company called?" : "Where do you work?";
  const companyPlaceholder = selfEmployed ? "Freelance" : "Company or organisation name";
  const work = await p.group(
    {
      companyName: () => p.text({
        message: companyLabel,
        placeholder: companyPlaceholder,
        hint: chalk.hex("#64748B")(selfEmployed ? 'hit enter to use "Freelance"' : "")
      }),
      website: () => p.text({
        message: `${selfEmployed ? "Company website?" : "Their website?"}${OPTIONAL_HINT}`,
        placeholder: "https://..."
      }),
      companyDescription: () => p.text({
        message: `${selfEmployed ? "What does your company do?" : "What does the company do?"}${OPTIONAL_HINT}`,
        placeholder: "One or two sentences"
      })
    },
    { onCancel }
  );
  console.log("");
  console.log(`  ${label("Setup")}`);
  const setup = await p.group(
    {
      editor: () => p.select({
        message: "How do you want to view and edit your files?",
        options: [
          {
            value: "obsidian",
            label: "Obsidian",
            hint: chalk.hex("#64748B")("free app \u2014 adds AI access to your files")
          },
          { value: "vscode", label: "VS Code" },
          { value: "other", label: "I'll choose later" }
        ]
      }),
      modules: () => p.multiselect({
        message: `Which modules do you want to add?${MULTISELECT_HINT}`,
        options: [
          {
            value: "linkedin",
            label: "LinkedIn",
            hint: chalk.hex("#64748B")("draft and refine your LinkedIn profile")
          }
        ],
        required: false
      })
    },
    { onCancel }
  );
  const modules = Array.isArray(setup.modules) ? setup.modules : [];
  let liProfileUrl = "";
  if (modules.includes("linkedin")) {
    const url = await p.text({
      message: "What's your LinkedIn profile URL?",
      placeholder: "https://linkedin.com/in/yourname",
      hint: chalk.hex("#64748B")("optional \u2014 you can add this later in profile.yaml")
    });
    liProfileUrl = typeof url === "string" ? url : "";
  }
  const slug = slugify(identity.patinaName);
  const targetDir = resolve(cwd, slug);
  const s = p.spinner();
  s.start(chalk.hex("#C084FC")("Creating your patina..."));
  const workInfo = {
    self_employed: selfEmployed,
    company_name: work.companyName?.trim() || (selfEmployed ? "Freelance" : ""),
    website: work.website?.trim() || void 0,
    company_description: work.companyDescription?.trim() || void 0
  };
  try {
    await scaffold({
      targetDir,
      patinaName: identity.patinaName,
      userName: identity.userName.trim(),
      title: (identity.title ?? "").trim(),
      roleDescription: (identity.roleDescription ?? "").trim(),
      jobDescriptionUrl: (identity.jobDescriptionUrl ?? "").trim(),
      work: workInfo,
      editor: setup.editor,
      modules,
      liProfileUrl,
      contentDir: "graph"
    });
    s.stop(chalk.green("Done."));
  } catch (err) {
    s.stop(chalk.red("Something went wrong."));
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  p.note(
    [
      chalk.hex("#94A3B8")("  cd ") + chalk.bold.white(slug),
      chalk.hex("#94A3B8")("  claude")
    ].join("\n"),
    label("Next steps")
  );
  p.outro(chalk.hex("#94A3B8")("Run claude from inside your patina to get started."));
}
function writeProfile(cwd, profile) {
  const full = join4(cwd, "profile.yaml");
  writeFileSync3(full, yaml2.dump(profile), "utf8");
}
function removeManagedFileIfUnmodified(targetDir, rel, stored) {
  const fullPath = join4(targetDir, rel);
  if (!existsSync4(fullPath)) return "deleted";
  const currentHash = hashFile(fullPath);
  const storedHash = stored[rel];
  if (storedHash && currentHash !== storedHash) {
    return "kept";
  }
  unlinkSync(fullPath);
  return "deleted";
}
async function runUpdate(cwd) {
  const profile = yaml2.load(readFileSync3(join4(cwd, "profile.yaml"), "utf8"));
  p.intro(chalk.hex("#94A3B8")(`Found: ${chalk.bold.white(profile.patina_name || "patina")}`));
  p.note(
    [
      `${chalk.hex("#64748B")("Name:")}    ${profile.name}`,
      `${chalk.hex("#64748B")("Title:")}   ${profile.title || "\u2014"}`,
      `${chalk.hex("#64748B")("Company:")} ${profile.work?.company_name || "\u2014"}`,
      `${chalk.hex("#64748B")("Modules:")} ${profile.modules?.join(", ") || "none"}`
    ].join("\n"),
    label("Current profile")
  );
  const action = await p.select({
    message: "What do you want to do?",
    options: [
      { value: "profile", label: "Update personal info" },
      { value: "modules", label: "Add or remove modules" },
      { value: "nothing", label: "Nothing \u2014 just checking" }
    ]
  });
  if (p.isCancel(action) || action === "nothing") {
    p.outro(chalk.hex("#94A3B8")("No changes made."));
    return;
  }
  if (action === "profile") {
    await runUpdateProfile(cwd, profile);
  } else if (action === "modules") {
    await runUpdateModules(cwd, profile);
  }
}
async function runUpdateProfile(cwd, profile) {
  console.log("");
  console.log(`  ${label("Update personal info")}`);
  console.log(`  ${chalk.hex("#64748B")("Press enter to keep the current value.")}`);
  const identity = await p.group(
    {
      name: () => p.text({
        message: "What's your name?",
        initialValue: profile.name,
        validate: (v) => v.trim() === "" ? "Name is required." : void 0
      }),
      title: () => p.text({
        message: `What's your professional title?${OPTIONAL_HINT}`,
        initialValue: profile.title ?? ""
      }),
      roleDescription: () => p.text({
        message: `Describe what you do \u2014 in your own words, not your title.${OPTIONAL_HINT}`,
        initialValue: profile.role_description ?? ""
      }),
      jobDescriptionUrl: () => p.text({
        message: `Got a link to a job description or role overview?${OPTIONAL_HINT}`,
        initialValue: profile.job_description_url ?? ""
      })
    },
    { onCancel }
  );
  console.log("");
  console.log(`  ${label("Where you work")}`);
  const selfEmployed = await p.confirm({
    message: "Are you self-employed or freelance?",
    initialValue: profile.work?.self_employed ?? false
  });
  if (p.isCancel(selfEmployed)) onCancel();
  const companyLabel = selfEmployed ? "What's your company called?" : "Where do you work?";
  const work = await p.group(
    {
      companyName: () => p.text({
        message: companyLabel,
        initialValue: profile.work?.company_name ?? ""
      }),
      website: () => p.text({
        message: `${selfEmployed ? "Company website?" : "Their website?"}${OPTIONAL_HINT}`,
        initialValue: profile.work?.website ?? ""
      }),
      companyDescription: () => p.text({
        message: `${selfEmployed ? "What does your company do?" : "What does the company do?"}${OPTIONAL_HINT}`,
        initialValue: profile.work?.company_description ?? ""
      })
    },
    { onCancel }
  );
  const updatedProfile = {
    ...profile,
    name: identity.name.trim(),
    title: (identity.title ?? "").trim(),
    role_description: (identity.roleDescription ?? "").trim() || void 0,
    job_description_url: (identity.jobDescriptionUrl ?? "").trim() || void 0,
    work: {
      self_employed: selfEmployed,
      company_name: work.companyName?.trim() || (selfEmployed ? "Freelance" : ""),
      website: work.website?.trim() || void 0,
      company_description: work.companyDescription?.trim() || void 0
    }
  };
  const vars = profileToVars(updatedProfile);
  const stored = profile._checksums ?? {};
  const newChecksums = {};
  const files = [
    ...baseManagedFiles(vars, updatedProfile.editor, cwd),
    ...updatedProfile.modules.flatMap((m) => moduleManagedFiles(m, vars))
  ];
  const updated = [];
  const skipped = [];
  for (const [rel, content] of files) {
    const { outcome, checksum } = writeManagedFile(cwd, rel, content, stored);
    newChecksums[rel] = checksum;
    if (outcome === "skipped") {
      skipped.push(rel);
    } else {
      updated.push(rel);
    }
  }
  for (const [rel, hash] of Object.entries(stored)) {
    if (!(rel in newChecksums)) {
      newChecksums[rel] = hash;
    }
  }
  updatedProfile._checksums = newChecksums;
  writeProfile(cwd, updatedProfile);
  const summaryLines = [];
  if (updated.length > 0) {
    summaryLines.push(chalk.hex("#94A3B8")(`Updated: ${updated.join(", ")}`));
  }
  if (skipped.length > 0) {
    summaryLines.push(chalk.hex("#FFAB2E")(`Kept your edits: ${skipped.join(", ")}`));
  }
  p.note(summaryLines.join("\n"), label("Done"));
  p.outro(chalk.hex("#94A3B8")("Profile updated."));
}
async function runUpdateModules(cwd, profile) {
  const currentModules = profile.modules ?? [];
  const selected = await p.multiselect({
    message: `Which modules do you want active?${MULTISELECT_HINT}`,
    options: [
      {
        value: "linkedin",
        label: "LinkedIn",
        hint: chalk.hex("#64748B")("draft and refine your LinkedIn profile")
      }
    ],
    initialValues: currentModules,
    required: false
  });
  if (p.isCancel(selected)) {
    p.cancel(chalk.hex("#94A3B8")("No changes made."));
    return;
  }
  const selectedModules = Array.isArray(selected) ? selected : [];
  const toAdd = selectedModules.filter((m) => !currentModules.includes(m));
  const toRemove = currentModules.filter((m) => !selectedModules.includes(m));
  if (toAdd.length === 0 && toRemove.length === 0) {
    p.outro(chalk.hex("#94A3B8")("No changes \u2014 modules unchanged."));
    return;
  }
  const stored = profile._checksums ?? {};
  const newChecksums = { ...stored };
  const updatedProfile = { ...profile, modules: [...currentModules] };
  const addedFiles = [];
  const skippedFiles = [];
  const deletedFiles = [];
  const keptFiles = [];
  for (const module of toAdd) {
    if (module === "linkedin" && !updatedProfile.linkedin?.profile_url) {
      const url = await p.text({
        message: "What's your LinkedIn profile URL?",
        placeholder: "https://linkedin.com/in/yourname (optional)"
      });
      if (p.isCancel(url)) {
        p.cancel(chalk.hex("#94A3B8")("No changes made."));
        return;
      }
      if (typeof url === "string" && url.trim()) {
        updatedProfile.linkedin = { profile_url: url.trim() };
      }
    }
    const vars = profileToVars(updatedProfile);
    const contentDir = updatedProfile.content_dir;
    for (const [rel, content] of moduleManagedFiles(module, vars)) {
      const { outcome, checksum } = writeManagedFile(cwd, rel, content, stored);
      newChecksums[rel] = checksum;
      if (outcome === "skipped") {
        skippedFiles.push(rel);
      } else {
        addedFiles.push(rel);
      }
    }
    for (const [relativePath, content] of moduleContentFiles(module, vars, contentDir)) {
      const fullPath = join4(cwd, relativePath);
      if (!existsSync4(fullPath)) {
        mkdirSync3(dirname3(fullPath), { recursive: true });
        writeFileSync3(fullPath, content, "utf8");
        addedFiles.push(relativePath);
      }
    }
    updatedProfile.modules = [...updatedProfile.modules, module];
  }
  for (const module of toRemove) {
    const managedRels = MODULE_MANAGED_FILES[module] ?? [];
    for (const rel of managedRels) {
      const result = removeManagedFileIfUnmodified(cwd, rel, stored);
      if (result === "deleted") {
        deletedFiles.push(rel);
        delete newChecksums[rel];
      } else {
        keptFiles.push(rel);
      }
    }
    updatedProfile.modules = updatedProfile.modules.filter((m) => m !== module);
    if (module === "linkedin") {
      delete updatedProfile.linkedin;
    }
  }
  updatedProfile._checksums = newChecksums;
  writeProfile(cwd, updatedProfile);
  const summaryLines = [];
  if (addedFiles.length > 0) summaryLines.push(chalk.hex("#94A3B8")(`Added: ${addedFiles.join(", ")}`));
  if (skippedFiles.length > 0) summaryLines.push(chalk.hex("#FFAB2E")(`Kept your edits: ${skippedFiles.join(", ")}`));
  if (deletedFiles.length > 0) summaryLines.push(chalk.hex("#94A3B8")(`Removed: ${deletedFiles.join(", ")}`));
  if (keptFiles.length > 0) summaryLines.push(chalk.hex("#FFAB2E")(`Kept your edited files: ${keptFiles.join(", ")}`));
  p.note(summaryLines.join("\n") || "No file changes.", label("Done"));
  p.outro(chalk.hex("#94A3B8")("Modules updated."));
}
function onCancel() {
  p.cancel(chalk.hex("#94A3B8")("Setup cancelled."));
  process.exit(0);
}

// src/cli.ts
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
