# Buena AI for Claude

Buena AI helps sales teams find the right people to contact and prepare
personalized outreach, from Claude, Cowork, and Claude Code.

## Install

- **Claude Code:** `claude plugin install buena-ai --marketplace Buena-AI/buena-plugins`
  (or, in a session, `/plugin marketplace add Buena-AI/buena-plugins` then
  `/plugin install buena-ai@buena`), then run `/mcp`, pick
  `plugin:buena-ai:buena` and sign in.
- **Codex:** `codex plugin marketplace add Buena-AI/buena-plugins && codex plugin add buena-ai@buena && codex mcp login buena`
- **Claude app:** Customize > Plugins > Add marketplace, enter
  `Buena-AI/buena-plugins`, add Buena AI, then Connect on its Connectors tab.

## What it does

The plugin ships one skill, `buena`, that walks Claude through the whole
Buena workflow:

- **Find prospects:** design and refine Buena people signals with Claude,
  look up named people, search your own LinkedIn network with Sales
  Navigator, grow signals or reuse their targeting in other countries, and
  rank prospects with a rubric scored by Claude.
- **Build campaigns:** turn selected people or your own list into draft email
  or LinkedIn campaigns, with verified work-email enrichment or Buena's
  fractional SDRs.
- **Personalize:** Buena researches each lead, Claude writes the drafts, and
  Buena checks them before they're saved.
- **Launch on your terms:** anything that spends credits, changes a campaign,
  or reaches real people is shown to you first and runs only after you
  approve it.

## What it connects to

This plugin adds one MCP server, `https://mcp.buena.ai/mcp`, and the `buena`
skill. You sign in with your Buena account through Buena's OAuth page at
`engage.buena.ai`, and the plugin acts only within your own workspace
permissions. The plugin contains no code and sends data nowhere else: the
skill is instructions for Claude, and all actions go through the Buena MCP
server. If you also added Buena as a connector, every Buena tool appears
twice; either works.

You need a Buena account. Research, searches, work-email reveals, and
enrichment can use credits, and every such action asks for your approval
first.

- Privacy policy: https://buena.ai/privacy-policy
- Terms: https://buena.ai/terms-of-service
- Support: https://buena.ai/support

Licensed under the MIT License.
