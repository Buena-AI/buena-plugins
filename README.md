# Buena AI plugins

Buena AI finds prospects with people signals, turns them into reviewed draft
campaigns, and launches only what you approve. This repository holds Buena's
plugins for AI assistants. Both connect to Buena's MCP server at
`https://mcp.buena.ai/mcp`, where you sign in with your Buena account.

| Package | For | Folder |
|---|---|---|
| Claude plugin | Claude, Cowork, Claude Code | [`claude/buena-ai`](claude/buena-ai) |
| OpenAI plugin | ChatGPT and Codex | [`openai/buena-ai`](openai/buena-ai) |

Both packages ship the same four skills from [`skills/`](skills):
`find-prospects`, `build-campaign`, `personalize-drafts`, and
`launch-campaign`. The skills explain Buena's workflows to the assistant; the
MCP server does the work, and nothing is sent or activated without your
explicit approval.

If your assistant doesn't support plugins, add the MCP server directly:
`https://mcp.buena.ai/mcp`.

## Development

Edit skills only in `skills/`, then run:

```sh
scripts/sync-skills.sh   # copy skills into both packages
scripts/check.sh all     # structural checks (also run in CI)
```

`scripts/build-openai-zip.sh` writes the OpenAI upload to `dist/`.

Privacy policy: https://buena.ai/privacy-policy · Terms:
https://buena.ai/terms-of-service · Support: https://buena.ai/support

Licensed under the MIT License.
