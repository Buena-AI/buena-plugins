---
name: launch-campaign
description: Add email or LinkedIn senders to a Buena campaign, check delivery status, and launch, pause, or resume campaigns — including approving drafts and starting fractional SDR LinkedIn campaigns. Use this whenever someone wants to send, launch, activate, schedule, pause, resume, or check on a Buena campaign, its mailboxes, or its LinkedIn senders.
---

# Launch and run Buena campaigns

Launching is the step that reaches real people, and outreach can't be unsent.
So every launch, pause, and resume shows the user the exact campaign first and
runs only after their explicit yes.

## Senders

- **Email:** list mailboxes with `buena_list_email_senders`, let the user pick
  active ones, show the campaign and the exact mailbox list, then after a yes
  call `buena_add_email_senders_to_campaign` with `selectionConfirmed: true`.
  On an active or paused campaign this moves eligible unsent emails onto the new
  mailboxes, changing their sender, signature, and schedule; say so.
- **LinkedIn:** `buena_list_linkedin_senders` separates regular workspace
  accounts (`workspace_account`) from managed fractional SDRs
  (`managed_fractional_sdr`). An empty managed list doesn't mean the workspace
  has no LinkedIn accounts. To add workspace accounts to a draft, show the
  campaign and the exact accounts, then after a yes call
  `buena_add_linkedin_senders_to_campaign` with `selectionConfirmed: true`.
  The two kinds can't be mixed in one campaign.
- **Fractional SDRs on an email campaign:** once the email draft has its
  sequence (see the personalize-drafts skill) and a connected mailbox, and is
  still a draft, Buena's fractional SDRs can run LinkedIn outreach to the same
  leads. List them with `buena_list_fractional_sdrs`, then show the owner,
  campaign, chosen SDRs, brief, lead count, and LinkedIn-eligible lead count.
  After a yes, call `buena_attach_fractional_sdr_to_campaign` with
  `selectionConfirmed: true` and one UUID `idempotencyKey`, reused unchanged on
  any retry. It uses the campaign's leads that have LinkedIn URLs, so no list
  is needed.

## Check status

`buena_get_campaign_delivery_status` shows leads, drafts, senders, delivery
state, and scheduled times.

## Launch

**Email campaigns** (with or without managed LinkedIn):

1. Check delivery status. If there are no pending drafts, say so and don't
   launch: approving nothing doesn't activate the campaign.
2. Show the exact campaign, the number of pending drafts, the sender
   allocation, and the delivery schedule.
3. After the user explicitly approves, call
   `buena_approve_and_activate_campaign` with `approvalConfirmed: true`, either
   `approveAll: true` (the user approved every pending draft) or the exact
   `draftIds` they approved, and one UUID `idempotencyKey`. Reuse that key if
   you retry; a new key would be a new launch.

**LinkedIn-only fractional SDR campaigns:**

1. Show the owner, campaign, number of LinkedIn-eligible leads, assigned SDRs,
   and schedule.
2. After the user approves, call `buena_activate_fractional_sdr_campaign` with
   `activationConfirmed: true` and one UUID, reused on retry.

The campaign owner can launch their own campaigns; organization owners and
admins can act for a teammate in the same workspace by passing `ownerEmail`.

## Pause and resume

`buena_pause_campaign` and `buena_resume_campaign` need `confirmed: true` after
the user agrees. Use a new UUID `idempotencyKey` for each distinct pause or
resume, and reuse it only to retry that same action. Resuming restarts
sending, so confirm it like a launch.
