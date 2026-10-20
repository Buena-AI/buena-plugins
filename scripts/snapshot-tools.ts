// Regenerates tools.snapshot.json from the Buena MCP server source, so
// scripts/check.ts can verify every tool the skills name. Lists the public
// /mcp tool set as each kind of workspace sees it, including the
// membership-only buena_workspace_* tools. Run with Bun:
//   bun scripts/snapshot-tools.ts <path to the Buena app's mcp folder>
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const mcpDir = process.argv[2] ? resolve(process.argv[2]) : "";
if (!mcpDir || !existsSync(join(mcpDir, "src/server.ts"))) {
  console.error("usage: bun scripts/snapshot-tools.ts <path to the Buena app's mcp folder>");
  process.exit(2);
}

const sdk = join(mcpDir, "node_modules/@modelcontextprotocol/sdk/dist/esm");
const { Client } = await import(join(sdk, "client/index.js"));
const { InMemoryTransport } = await import(join(sdk, "inMemory.js"));
const { createBuenaMcpServer } = await import(join(mcpDir, "src/server.ts"));

// Token workspace stamps, and the name the snapshot uses for each.
const WORKSPACES = { managed: "managed", membership: "self_serve", legacy: undefined } as const;

type Listed = {
  name: string;
  inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
  annotations?: { readOnlyHint?: boolean };
};

async function listTools(workspace: string | undefined) {
  // Any API client works: listing tools never calls the Buena API.
  const server = createBuenaMcpServer({}, {
    type: "oauth",
    userId: "snapshot",
    organizationId: "snapshot",
    clientId: "snapshot",
    role: "USER",
    scopes: ["mcp:tools"],
    workspace,
  }, { toolset: "full" });
  const client = new Client({ name: "buena-plugins-snapshot", version: "1.0.0" });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const tools = (await client.listTools()).tools as Listed[];
  const version = client.getServerVersion();
  await client.close();
  await server.close();
  return { tools, version };
}

const tools: Record<string, { readOnly: boolean; required: string[]; optional: string[]; workspaces: string[] }> = {};
const counts: Record<string, number> = {};
let server = { name: "", version: "" };
for (const [label, stamp] of Object.entries(WORKSPACES)) {
  const listed = await listTools(stamp);
  server = { name: listed.version?.name ?? "", version: listed.version?.version ?? "" };
  counts[label] = listed.tools.length;
  for (const tool of listed.tools) {
    const properties = Object.keys(tool.inputSchema?.properties ?? {});
    const required = new Set(tool.inputSchema?.required ?? []);
    tools[tool.name] ??= {
      readOnly: tool.annotations?.readOnlyHint === true,
      required: properties.filter((name) => required.has(name)).sort(),
      optional: properties.filter((name) => !required.has(name)).sort(),
      workspaces: [],
    };
    tools[tool.name].workspaces.push(label);
  }
}

const sorted = Object.fromEntries(
  Object.keys(tools)
    .sort()
    .map((name) => [name, { ...tools[name], workspaces: tools[name].workspaces.sort() }]),
);
const snapshot = { server, endpoint: "https://mcp.buena.ai/mcp", counts, tools: sorted };
const out = join(import.meta.dir, "..", "tools.snapshot.json");
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${Object.keys(sorted).length} tools (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}) to tools.snapshot.json`);
