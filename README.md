# Buena AI plugins

Buena AI finds prospects with people signals or your own LinkedIn network,
turns them into reviewed draft campaigns, and launches only what you approve.
This repository holds Buena's plugins for AI assistants. Both connect to
Buena's MCP server at `https://mcp.buena.ai/mcp`, where you sign in with your
Buena account.

## Install

- **Claude Code:** `claude plugin install buena-ai --marketplace Buena-AI/buena-plugins`
  (or, in a session, `/plugin marketplace add Buena-AI/buena-plugins` then
  `/plugin install buena-ai@buena`), then run `/mcp`, pick
  `plugin:buena-ai:buena` and sign in.
- **Codex:** `codex plugin marketplace add Buena-AI/buena-plugins && codex plugin add buena-ai@buena && codex mcp login buena`
- **Claude app:** Customize > Plugins > Add marketplace, enter
  `Buena-AI/buena-plugins`, add Buena AI, then Connect on its Connectors tab.
- **MCP only** (assistants without plugins): add `https://mcp.buena.ai/mcp`
  as a remote MCP server. Use one route: installing the plugin and the bare
  server gives you every tool twice.

## What's inside

| Package | For | Folder |
|---|---|---|
| Claude plugin | Claude, Cowork, Claude Code | [`claude/buena-ai`](claude/buena-ai) |
| OpenAI plugin | ChatGPT and Codex | [`openai/buena-ai`](openai/buena-ai) |

Both packages ship one skill, [`buena`](skills/buena/SKILL.md), that covers
the whole workflow: finding people and building signals, searching your
LinkedIn network, qualifying and ranking prospects, growing signals, building
campaigns, personalizing drafts, and launching, pausing or resuming campaigns.
The skill explains Buena's workflow to the assistant; the MCP server does the
work, and nothing spends credits, saves, or sends without your explicit
approval.

Marketplace catalogs: [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)
for Claude and [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json)
for Codex, both named `buena`.

## Development

Edit the skill only in `skills/`, then run:

```sh
scripts/sync-skills.sh   # copy skills into both packages
scripts/check.sh all     # structural checks (also run in CI)
```

`tools.snapshot.json` records the MCP's public tools and their required
parameters; the checks fail if a skill names a tool that doesn't exist, skips
a write tool's required parameters, or leaves a tool uncovered. After an MCP
change, regenerate it from a checkout of the Buena app:
`bun scripts/snapshot-tools.ts <path to its mcp folder>`.

Bump `version` in both plugin manifests with every skill change.
`scripts/build-openai-zip.sh` writes the OpenAI upload to `dist/`.

Privacy policy: https://buena.ai/privacy-policy · Terms:
https://buena.ai/terms-of-service · Support: https://buena.ai/support

Licensed under the MIT License.
