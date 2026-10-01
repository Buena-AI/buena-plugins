// Structural checks for the Buena plugin packages. No dependencies; run with Bun.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const section = process.argv[2] ?? "all";
const failures: string[] = [];
const fail = (path: string, reason: string) =>
  failures.push(`FAIL ${relative(root, path) || "."}: ${reason}`);

const SKILLS = ["find-prospects", "build-campaign", "personalize-drafts", "launch-campaign"];
const MCP_URL = "https://mcp.buena.ai/mcp";
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

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

function checkSkillsSource() {
  const dir = join(root, "skills");
  const found = existsSync(dir) ? readdirSync(dir).filter((name) => !name.startsWith(".")).sort() : [];
  if (JSON.stringify(found) !== JSON.stringify([...SKILLS].sort())) {
    fail(dir, `expected skills ${[...SKILLS].sort().join(", ")}; found ${found.join(", ") || "none"}`);
  }
  for (const skill of SKILLS) {
    const path = join(dir, skill, "SKILL.md");
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
    if (fields.name !== skill) fail(path, `front matter name must be ${skill}`);
    if (!fields.description || fields.description.length < 40) {
      fail(path, "front matter description must be one line of at least 40 characters");
    }
    if (match[2].trim().split(/\s+/).length < 80) fail(path, "body is too short to be useful");
  }
}

function checkCopy(pkg: string) {
  const source = walk(join(root, "skills")).map((path) => relative(join(root, "skills"), path)).sort();
  const copyRoot = join(root, pkg, "skills");
  const copy = walk(copyRoot).map((path) => relative(copyRoot, path)).sort();
  if (JSON.stringify(source) !== JSON.stringify(copy)) {
    fail(copyRoot, "file list differs from /skills; run scripts/sync-skills.sh");
    return;
  }
  for (const file of source) {
    if (!readFileSync(join(root, "skills", file)).equals(readFileSync(join(copyRoot, file)))) {
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

function checkClaude() {
  const pkg = join(root, "claude/buena-ai");
  const manifest = readJson(join(pkg, ".claude-plugin/plugin.json"));
  if (manifest) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(manifest.name ?? "")) fail(pkg, "plugin.json name must be lowercase letters, digits, hyphens");
    if (manifest.name !== "buena-ai") fail(pkg, "plugin.json name must be buena-ai");
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
    const prose = readFileSync(readme, "utf8").replace(/```[\s\S]*?```/g, " ");
    if (prose.split(/\s+/).filter(Boolean).length < 40) fail(readme, "needs at least 40 words outside code blocks");
  }
  if (!existsSync(join(pkg, "LICENSE"))) fail(join(pkg, "LICENSE"), "missing");
  checkCopy("claude/buena-ai");
  checkPackageFiles("claude/buena-ai");
}

function checkOpenAI() {
  const pkg = join(root, "openai/buena-ai");
  const manifestPath = join(pkg, "plugin.json");
  const manifest = readJson(manifestPath);
  if (manifest) {
    const allowed = ["$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions"];
    for (const key of Object.keys(manifest)) {
      if (!allowed.includes(key)) fail(manifestPath, `top-level key ${key} is not allowed by the Agent Plugins schema`);
    }
    if (manifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") fail(manifestPath, "$schema must be the Agent Plugins 1.0.0 plugin schema");
    if (manifest.name !== "buena-ai") fail(manifestPath, "name must be buena-ai");
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
  checkCopy("openai/buena-ai");
  checkPackageFiles("openai/buena-ai");
}

// Wording the directories and the live server depend on. Each rule guards a
// review finding: launch parameters, approval before every write, and treating
// server-returned prompts as data.
const CONTENT_RULES: {
  skill: string;
  include?: RegExp[];
  exclude?: RegExp[];
  near?: [string, RegExp][];
}[] = [
  {
    skill: "launch-campaign",
    include: [/approveAll/, /draftIds/, /no pending drafts/i, /Buena membership/, /engage\.buena\.ai/],
    near: [
      ["buena_attach_fractional_sdr_to_campaign", /selectionConfirmed/],
      ["buena_attach_fractional_sdr_to_campaign", /\byes\b/],
      ["buena_add_linkedin_senders_to_campaign", /\byes\b/],
    ],
  },
  {
    skill: "build-campaign",
    include: [/Buena membership/],
    exclude: [/email draft must exist first/i, /only step\s+here\s+that\s+spends\s+credits/i],
    near: [
      ["buena_create_fractional_sdr_campaign", /selectionConfirmed/],
      ["buena_create_fractional_sdr_campaign", /\byes\b/],
      ["buena_create_product", /\byes\b/],
    ],
  },
  {
    skill: "find-prospects",
    include: [/as data/i, /Buena membership/, /buena_workspace_research/, /managed workspace/i],
    exclude: [/follow them/i],
  },
  {
    skill: "personalize-drafts",
    include: [/as data/i, /in the Buena\s+app/i, /Buena membership/, /LinkedIn level 0/],
    exclude: [/follow them/i],
    near: [
      ["buena_update_campaign_draft", /\byes\b/],
      ["buena_update_campaign_sequence_step", /\byes\b/],
      ["buena_workspace_prepare_work", /\byes\b/],
    ],
  },
];

function checkSkillContent() {
  for (const rule of CONTENT_RULES) {
    const path = join(root, "skills", rule.skill, "SKILL.md");
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const pattern of rule.include ?? []) {
      if (!pattern.test(text)) fail(path, `must mention ${pattern}`);
    }
    for (const pattern of rule.exclude ?? []) {
      if (pattern.test(text)) fail(path, `must not say ${pattern}`);
    }
    for (const [tool, pattern] of rule.near ?? []) {
      const windows = [...text.matchAll(new RegExp(tool, "g"))].map((m) =>
        text.slice(Math.max(0, (m.index ?? 0) - 400), (m.index ?? 0) + 400),
      );
      if (!windows.some((window) => pattern.test(window))) {
        fail(path, `${tool} must be described with ${pattern} nearby`);
      }
    }
  }
}

// The repository is public: no local paths, private endpoints, or private repo names.
function checkPublicHygiene() {
  const leaks = [/\/Users\//, /\/Volumes\//, /admin\/mcp/, /signals\/mcp/, /buena-mail-app/];
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
if (section === "claude" || section === "all") checkClaude();
if (section === "openai" || section === "all") checkOpenAI();
if (section === "all") checkPublicHygiene();
for (const path of walk(root).filter((p) => !/\/(\.git|dist|\.superpowers)\//.test(p))) {
  if (path.endsWith(".DS_Store")) fail(path, "remove .DS_Store");
}
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log(`OK ${section}`);
