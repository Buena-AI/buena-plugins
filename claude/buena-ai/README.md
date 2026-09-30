# Buena AI for Claude

Buena AI helps sales teams find the right people to contact and prepare
personalized outreach, from Claude, Cowork, and Claude Code.

## What it does

- **Find prospects:** create and refine Buena people signals, reuse targeting
  in other countries, grow signals, and rank prospects with a rubric scored by
  Claude.
- **Build campaigns:** turn selected people or your own list into draft email
  or LinkedIn campaigns, with verified work-email enrichment or Buena's
  fractional SDRs.
- **Personalize:** Buena researches each lead, Claude writes the drafts, and
  Buena checks them before they're saved.
- **Launch on your terms:** anything that spends credits, changes a campaign,
  or reaches real people is shown to you first and runs only after you
  approve it.

## What it connects to

This plugin adds one MCP server, `https://mcp.buena.ai/mcp`, and four skills
(`find-prospects`, `build-campaign`, `personalize-drafts`, `launch-campaign`).
You sign in with your Buena account through Buena's OAuth page at
`engage.buena.ai`, and the plugin acts only within your own workspace
permissions. The plugin contains no code and sends data nowhere else: the
skills are instructions for Claude, and all actions go through the Buena MCP
server.

You need a Buena account. Research, work-email reveals, and enrichment can use
credits, and every such action asks for your approval first.

- Privacy policy: https://buena.ai/privacy-policy
- Terms: https://buena.ai/terms-of-service
- Support: https://buena.ai/support

Licensed under the MIT License.
