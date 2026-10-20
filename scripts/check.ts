// Structural checks for the Buena plugin packages. No dependencies; run with Bun.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = join(import.meta.dir, "..");
const section = process.argv[2] ?? "all";
const failures: string[] = [];
const fail = (path: string, reason: string) =>
  failures.push(`FAIL ${relative(root, path) || "."}: ${reason}`);

const PLUGIN = "buena-ai";
const MARKETPLACE = "buena";
const CLAUDE_PKG = "claude/buena-ai";
const OPENAI_PKG = "openai/buena-ai";
const MCP_URL = "https://mcp.buena.ai/mcp";
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;
const SKILLS_DIR = join(root, "skills");

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      fail(path, "symbolic links are not allowed");
      return [];
    }
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function readJson(path: string): any {
  if (!existsSync(path)) {
    fail(path, "missing");
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(path, `invalid JSON: ${(error as Error).message}`);
    return undefined;
  }
}

function pngSize(path: string): { width: number; height: number } | undefined {
  if (!existsSync(path)) {
    fail(path, "missing");
    return undefined;
  }
  const bytes = readFileSync(path);
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature) {
    fail(path, "not a PNG file");
    return undefined;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// Skills are discovered from skills/: every folder is one skill.
function skillNames(): string[] {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => {
      if (!entry.isDirectory()) fail(join(SKILLS_DIR, entry.name), "skills/ may contain only skill folders");
      return entry.name;
    })
    .filter((name) => statSync(join(SKILLS_DIR, name)).isDirectory())
    .sort();
}

function checkSkillsSource() {
  const skills = skillNames();
  if (skills.length === 0) fail(SKILLS_DIR, "no skills found");
  for (const skill of skills) {
    const path = join(SKILLS_DIR, skill, "SKILL.md");
    if (!existsSync(path)) {
      fail(path, "missing");
      continue;
    }
    const text = readFileSync(path, "utf8");
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      fail(path, "front matter must open and close with --- lines");
      continue;
    }
    const fields = Object.fromEntries(
      match[1].split("\n").map((line) => {
        const at = line.indexOf(":");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
    );
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(skill)) fail(path, "skill folder name must be lowercase letters, digits, hyphens");
    if (fields.name !== skill) fail(path, `front matter name must be ${skill}`);
    const description: string = fields.description ?? "";
    if (description.length < 40 || description.length > 1024) {
      fail(path, "front matter description must be one line of 40 to 1024 characters");
    }
    // Keep it a plain YAML scalar so every client parses it the same way.
    if (/: | #|^["'&*!|>%@`[{]/.test(description)) fail(path, "front matter description must be a plain YAML value (no ': ', ' #', or leading quote)");
    if (match[2].trim().split(/\s+/).length < 80) fail(path, "body is too short to be useful");
    // Relative links must resolve inside the same skill folder.
    for (const file of walk(join(SKILLS_DIR, skill)).filter((p) => p.endsWith(".md"))) {
      for (const [, target] of readFileSync(file, "utf8").matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)) {
        const resolved = resolve(dirname(file), target.split("#")[0]);
        if (!resolved.startsWith(join(SKILLS_DIR, skill) + "/") || !existsSync(resolved)) {
          fail(file, `link ${target} must point at a file inside skills/${skill}`);
        }
      }
    }
  }
}

function checkCopy(pkg: string) {
  const source = walk(SKILLS_DIR).map((path) => relative(SKILLS_DIR, path)).sort();
  const copyRoot = join(root, pkg, "skills");
  const copy = walk(copyRoot).map((path) => relative(copyRoot, path)).sort();
  if (JSON.stringify(source) !== JSON.stringify(copy)) {
    fail(copyRoot, "file list differs from /skills; run scripts/sync-skills.sh");
    return;
  }
  for (const file of source) {
    if (!readFileSync(join(SKILLS_DIR, file)).equals(readFileSync(join(copyRoot, file)))) {
      fail(join(copyRoot, file), "differs from /skills; run scripts/sync-skills.sh");
    }
  }
}

function checkPackageFiles(pkg: string) {
  const files = walk(join(root, pkg));
  if (files.length > 512) fail(join(root, pkg), "more than 512 files");
  for (const path of files) {
    const name = path.split("/").pop() ?? "";
    if ([".DS_Store", "Thumbs.db", "desktop.ini"].includes(name)) fail(path, "system file");
    if (!IMAGE.test(path) && statSync(path).size > 256 * 1024) fail(path, "non-image file over 256 KiB");
  }
}

// Every buena_* name in a skill must be a real tool of the public MCP, as
// recorded in tools.snapshot.json (regenerate with scripts/snapshot-tools.ts).
// Each write tool a skill names must have its required parameters named in
// the same paragraph or list at least once, and every public tool must be
// covered somewhere, so new server tools can't slip by unnoticed.
function checkTools() {
  const snapshotPath = join(root, "tools.snapshot.json");
  const snapshot = readJson(snapshotPath);
  const tools: Record<string, { readOnly: boolean; required: string[] }> = snapshot?.tools ?? {};
  if (snapshot && Object.keys(tools).length === 0) fail(snapshotPath, "lists no tools");
  if (!snapshot) return;
  const files = walk(SKILLS_DIR).filter((p) => p.endsWith(".md"));
  const named = new Set<string>();
  const blocks: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    blocks.push(...text.split(/\n[ \t]*\n/));
    for (const m of text.matchAll(/\bbuena_[a-z0-9_]+/g)) {
      const name = m[0];
      const wildcard = name.endsWith("_") && text[(m.index ?? 0) + name.length] === "*";
      if (wildcard) {
        if (!Object.keys(tools).some((tool) => tool.startsWith(name))) fail(file, `${name}* matches no tool in tools.snapshot.json`);
        continue;
      }
      if (!tools[name]) fail(file, `names ${name}, which is not a tool in tools.snapshot.json`);
      else named.add(name);
    }
  }
  for (const name of named) {
    const required = tools[name].required ?? [];
    if (tools[name].readOnly || required.length === 0) continue;
    const word = (param: string) => new RegExp(`\\b${param}\\b`);
    const tool = new RegExp(`\\b${name}\\b`);
    const ok = blocks.some((block) => tool.test(block) && required.every((param) => word(param).test(block)));
    if (!ok) fail(SKILLS_DIR, `${name} must be described with its required parameters (${required.join(", ")}) in one paragraph or list`);
  }
  for (const name of Object.keys(tools)) {
    if (!named.has(name)) fail(SKILLS_DIR, `no skill covers ${name}; describe it or update tools.snapshot.json`);
  }
}

function checkClaude() {
  const pkg = join(root, CLAUDE_PKG);
  const manifest = readJson(join(pkg, ".claude-plugin/plugin.json"));
  if (manifest) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(manifest.name ?? "")) fail(pkg, "plugin.json name must be lowercase letters, digits, hyphens");
    if (manifest.name !== PLUGIN) fail(pkg, `plugin.json name must be ${PLUGIN}`);
    for (const key of ["description", "version", "author", "license"]) {
      if (!manifest[key]) fail(pkg, `plugin.json ${key} is required`);
    }
  }
  const mcp = readJson(join(pkg, ".mcp.json"));
  const server = mcp?.mcpServers?.buena;
  if (mcp && (server?.type !== "http" || server?.url !== MCP_URL)) {
    fail(join(pkg, ".mcp.json"), `mcpServers.buena must be { "type": "http", "url": "${MCP_URL}" }`);
  }
  const readme = join(pkg, "README.md");
  if (!existsSync(readme)) fail(readme, "missing");
  else {
    const text = readFileSync(readme, "utf8");
    const prose = text.replace(/```[\s\S]*?```/g, " ");
    if (prose.split(/\s+/).filter(Boolean).length < 40) fail(readme, "needs at least 40 words outside code blocks");
    if (!text.includes(`${PLUGIN}@${MARKETPLACE}`) && !text.includes(`install ${PLUGIN} --marketplace`)) {
      fail(readme, `needs an install line for ${PLUGIN} from the ${MARKETPLACE} marketplace`);
    }
  }
  if (!existsSync(join(pkg, "LICENSE"))) fail(join(pkg, "LICENSE"), "missing");
  checkCopy(CLAUDE_PKG);
  checkPackageFiles(CLAUDE_PKG);
}

function checkOpenAI() {
  const pkg = join(root, OPENAI_PKG);
  const manifestPath = join(pkg, "plugin.json");
  const manifest = readJson(manifestPath);
  if (manifest) {
    const allowed = ["$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions"];
    for (const key of Object.keys(manifest)) {
      if (!allowed.includes(key)) fail(manifestPath, `top-level key ${key} is not allowed by the Agent Plugins schema`);
    }
    if (manifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") fail(manifestPath, "$schema must be the Agent Plugins 1.0.0 plugin schema");
    if (manifest.name !== PLUGIN) fail(manifestPath, `name must be ${PLUGIN}`);
    const ui = manifest.extensions?.["com.openai"]?.interface;
    if (!ui) fail(manifestPath, "extensions.com.openai.interface is required");
    else {
      const limits: Record<string, number> = { displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80 };
      for (const [key, max] of Object.entries(limits)) {
        if (typeof ui[key] !== "string" || ui[key].length === 0) fail(manifestPath, `interface.${key} is required`);
        else if (ui[key].length > max) fail(manifestPath, `interface.${key} is ${ui[key].length} characters; max ${max}`);
      }
      if (typeof ui.category !== "string" || !ui.category) fail(manifestPath, "interface.category is required");
      for (const key of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
        if (typeof ui[key] !== "string" || !ui[key].startsWith("https://") || ui[key].length > 1024) {
          fail(manifestPath, `interface.${key} must be an https URL of at most 1024 characters`);
        }
      }
      if (!Array.isArray(ui.defaultPrompt) || ui.defaultPrompt.length > 3 || ui.defaultPrompt.some((p: unknown) => typeof p !== "string" || p.length > 128)) {
        fail(manifestPath, "interface.defaultPrompt must be up to 3 prompts of at most 128 characters");
      }
      if (/\$|pric|plan\b|plans\b|subscri|discount|upgrade|free trial/i.test(ui.longDescription ?? "")) {
        fail(manifestPath, "interface.longDescription must not mention pricing, plans, subscriptions, discounts, or upgrades");
      }
      // OpenAI asks for tasks, intended users, and limitations.
      if (!/sales/i.test(ui.longDescription ?? "") || !/Buena account/i.test(ui.longDescription ?? "")) {
        fail(manifestPath, "interface.longDescription must name its intended users (sales teams) and limitations (needs a Buena account)");
      }
      for (const key of ["logo", "composerIcon"]) {
        const value = ui[key];
        // OpenAI: "Use ./-prefixed paths relative to the plugin root".
        if (typeof value !== "string" || !value.startsWith("./")) {
          fail(manifestPath, `interface.${key} must be a ./-prefixed path inside the package`);
          continue;
        }
        const resolved = join(pkg, value);
        if (!resolved.startsWith(pkg + "/")) {
          fail(manifestPath, `interface.${key} must stay inside the package`);
          continue;
        }
        const size = pngSize(resolved);
        if (!size) fail(manifestPath, `interface.${key} must point at a PNG in the package`);
        else if (size.width !== size.height || size.width < 48) fail(resolved, `must be square and at least 48 px; is ${size.width}×${size.height}`);
      }
    }
  }
  const mcpPath = join(pkg, "mcp.json");
  const mcp = readJson(mcpPath);
  if (mcp) {
    if (mcp.$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") fail(mcpPath, "$schema must be the Agent Plugins 1.0.0 MCP schema");
    const server = mcp.mcpServers?.buena;
    if (server?.type !== "streamable-http" || server?.url !== MCP_URL) fail(mcpPath, `mcpServers.buena must be { "type": "streamable-http", "url": "${MCP_URL}" }`);
  }
  for (const banned of [".app.json", "hooks", ".codex-plugin", ".claude-plugin"]) {
    if (existsSync(join(pkg, banned))) fail(join(pkg, banned), "not allowed in the OpenAI package");
  }
  checkCopy(OPENAI_PKG);
  checkPackageFiles(OPENAI_PKG);
}

// The two marketplace catalogs at the repository root, read by Claude and by
// Codex. Each lists the one plugin and points at its package folder.
function marketplaceEntry(path: string, catalog: any) {
  if (!catalog) return undefined;
  if (catalog.name !== MARKETPLACE) fail(path, `name must be ${MARKETPLACE}`);
  const entries = Array.isArray(catalog.plugins) ? catalog.plugins : [];
  if (entries.length !== 1 || entries[0]?.name !== PLUGIN) fail(path, `plugins must list exactly one plugin, ${PLUGIN}`);
  return entries[0];
}

function checkClaudeMarketplace() {
  const path = join(root, ".claude-plugin/marketplace.json");
  const catalog = readJson(path);
  const entry = marketplaceEntry(path, catalog);
  if (catalog && !catalog.owner?.name) fail(path, "owner.name is required");
  if (entry && entry.source !== `./${CLAUDE_PKG}`) fail(path, `plugins[0].source must be "./${CLAUDE_PKG}"`);
}

function checkCodexMarketplace() {
  const path = join(root, ".agents/plugins/marketplace.json");
  const entry = marketplaceEntry(path, readJson(path));
  if (!entry) return;
  if (entry.source?.source !== "local" || entry.source?.path !== `./${OPENAI_PKG}`) {
    fail(path, `plugins[0].source must be { "source": "local", "path": "./${OPENAI_PKG}" }`);
  }
  if (!["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"].includes(entry.policy?.installation)) fail(path, "plugins[0].policy.installation must be AVAILABLE, INSTALLED_BY_DEFAULT or NOT_AVAILABLE");
  if (!["ON_INSTALL", "ON_USE"].includes(entry.policy?.authentication)) fail(path, "plugins[0].policy.authentication must be ON_INSTALL or ON_USE");
}

// One release version: both plugin manifests, and any marketplace entry that
// carries a version, must agree.
function checkVersions() {
  const sources: [string, string | undefined][] = [
    [join(root, CLAUDE_PKG, ".claude-plugin/plugin.json"), readJson(join(root, CLAUDE_PKG, ".claude-plugin/plugin.json"))?.version],
    [join(root, OPENAI_PKG, "plugin.json"), readJson(join(root, OPENAI_PKG, "plugin.json"))?.version],
  ];
  for (const catalog of [".claude-plugin/marketplace.json", ".agents/plugins/marketplace.json"]) {
    const version = readJson(join(root, catalog))?.plugins?.[0]?.version;
    if (version !== undefined) sources.push([join(root, catalog), version]);
  }
  const [, expected] = sources[0];
  if (!/^\d+\.\d+\.\d+$/.test(expected ?? "")) fail(sources[0][0], "version must be MAJOR.MINOR.PATCH");
  for (const [path, version] of sources.slice(1)) {
    if (version !== expected) fail(path, `version ${version} must match ${expected} in ${relative(root, sources[0][0])}`);
  }
}

// Wording the directories and the live server depend on, checked across all
// skills together. Each rule guards a review finding: approval before every
// write, confirm calls that resend the previewed input, identical rubrics,
// plan fit, idempotency keys, and treating server-returned text as data.
const CONTENT_RULES: { include?: RegExp[]; exclude?: RegExp[]; near?: [string, RegExp][] } = {
  include: [
    /as data/i, /Buena membership/, /managed workspace/i, /engage\.buena\.ai/, /approveAll/, /draftIds/,
    /no pending emails/i, /connect a mailbox in the Buena app/i, /never the research `id`/, /byte-for-byte/,
    /linkedInLevel` 0/, /thread injections/, /no steps/,
  ],
  exclude: [/follow them/i, /email draft must exist first/i, /only step\s+here\s+that\s+spends\s+credits/i, /Buena researches each lead and checks/],
  near: [
    ["buena_create_signal", /\byes\b/],
    ["buena_find_people", /credits/],
    ["buena_add_people_to_signal", /confirmed: true/],
    ["buena_add_people_to_signal", /existing people\s+signal/],
    ["buena_search_connections", /Sales Navigator/],
    ["buena_search_connections", /newSignalTitle/],
    ["buena_ranked_signal_results", /identical/],
    ["buena_expand_signal_to_target", /exactly the\s+previewed/],
    ["buena_create_signal_geo_clones", /exactly the previewed/],
    ["buena_create_signal_geo_clones", /prospectCount/],
    ["buena_requeue_signal_enrichment", /reuse the key/i],
    ["buena_create_campaign_from_signal_results", /separate draft/],
    ["buena_create_fractional_sdr_campaign", /selectionConfirmed/],
    ["buena_create_fractional_sdr_campaign", /\byes\b/],
    ["buena_attach_fractional_sdr_to_campaign", /selectionConfirmed/],
    ["buena_attach_fractional_sdr_to_campaign", /\byes\b/],
    ["buena_add_linkedin_senders_to_campaign", /\byes\b/],
    ["buena_create_product", /\byes\b/],
    ["buena_prepare_client_personalization_preview", /sequenceSteps/],
    ["buena_use_first_degree_linkedin_messages", /before preparing/],
    ["buena_update_campaign_draft", /\byes\b/],
    ["buena_update_campaign_sequence_step", /\byes\b/],
    ["buena_workspace_work_email", /buena_workspace_operations/],
    ["buena_workspace_prepare_work", /\byes\b/],
    ["buena_workspace_prepare_work", /buena_list_email_senders/],
    ["buena_workspace_save_supplied_work", /operationId/],
    ["buena_approve_and_activate_campaign", /idempotencyKey/],
  ],
};

function checkSkillContent() {
  const files = walk(SKILLS_DIR).filter((p) => p.endsWith(".md"));
  const text = files.map((file) => readFileSync(file, "utf8")).join("\n\n");
  for (const pattern of CONTENT_RULES.include ?? []) {
    if (!pattern.test(text)) fail(SKILLS_DIR, `skills must mention ${pattern}`);
  }
  for (const pattern of CONTENT_RULES.exclude ?? []) {
    if (pattern.test(text)) fail(SKILLS_DIR, `skills must not say ${pattern}`);
  }
  for (const [tool, pattern] of CONTENT_RULES.near ?? []) {
    const windows = [...text.matchAll(new RegExp(`${tool}\\b`, "g"))].map((m) =>
      text.slice(Math.max(0, (m.index ?? 0) - 400), (m.index ?? 0) + 400),
    );
    if (!windows.some((window) => pattern.test(window))) fail(SKILLS_DIR, `${tool} must be described with ${pattern} nearby`);
  }
}

// The repository is public: no local paths, private endpoints, or private repo names.
function checkPublicHygiene() {
  const leaks = [/\/Users\//, /\/Volumes\//, /\/home\//, /admin\/mcp/, /signals\/mcp/, /buena-mail-app/];
  const files = walk(root).filter(
    (p) => !/\/(\.git|dist|\.superpowers)\//.test(p) && !/\.(png|jpe?g|gif|webp)$/i.test(p),
  );
  for (const path of files) {
    if (path.endsWith("scripts/check.ts")) continue;
    const text = readFileSync(path, "utf8");
    for (const leak of leaks) {
      if (leak.test(text)) fail(path, `contains private detail ${leak}`);
    }
  }
}

if (["skills", "claude", "openai", "all"].indexOf(section) < 0) {
  console.error(`unknown section ${section}; use skills, claude, openai, or all`);
  process.exit(2);
}
checkSkillsSource();
checkSkillContent();
checkTools();
if (section === "claude" || section === "all") {
  checkClaude();
  checkClaudeMarketplace();
}
if (section === "openai" || section === "all") {
  checkOpenAI();
  checkCodexMarketplace();
}
if (section === "all") {
  checkVersions();
  checkPublicHygiene();
}
for (const path of walk(root).filter((p) => !/\/(\.git|dist|\.superpowers)\//.test(p))) {
  if (path.endsWith(".DS_Store")) fail(path, "remove .DS_Store");
}
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log(`OK ${section}`);
