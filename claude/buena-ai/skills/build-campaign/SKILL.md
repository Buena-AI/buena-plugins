---
name: build-campaign
description: Turn Buena signal results or the user's own prospect list into a draft campaign — choose a product, pick exact people, choose how emails are found, create email or LinkedIn drafts, add Buena fractional SDRs, reveal work emails, or fix email enrichment already in progress. Use this whenever someone wants to reach out to prospects, start or build a campaign, enrich leads, find emails, upload a lead list, or use a fractional SDR, even if they never say "campaign".
---

# Build a Buena draft campaign

Everything here creates drafts. Nothing is sent until the user launches the
campaign (see the launch-campaign skill). Enrichment, requeued enrichment, and
work-email reveals can spend credits, so say so before each one.

## Which path your workspace has

- **Buena membership:** campaigns are email-only and start from a list: the
  people you found with research (reveal their work emails first) or the
  user's own list. Use "From the user's own list" and "Reveal work emails"
  below.
- **Managed workspace:** every section applies.

Only call tools you can see.

## From signal results (managed workspaces)

1. **Product.** Call `buena_list_products` and let the user choose the product
   the campaign is about. If none fits, draft one from facts the user gives
   you: the product governs what drafts may claim, so never invent outcomes,
   customers, or numbers. Show the draft, and after a yes create it with
   `buena_create_product`.
2. **People.** Show results with `buena_list_signal_results` and let the user
   pick the exact people. Don't choose for them.
3. **Email lookup.** Ask which kind of email to look for:
   - `work_only`: a verified work email, with no personal fallback
   - `personal`: a personal email only
   - `work`: a work email first, falling back to a personal one
4. **Confirm.** Enrichment spends credits. Show the product, the number of
   people, and the lookup mode; after the user approves, call
   `buena_create_campaign_from_signal_results` with `selectionConfirmed: true`.
5. **Wait.** Check `buena_get_campaign_creation_status` until the draft
   campaign exists, then show it with `buena_get_campaign`.

## Fix enrichment in progress (managed workspaces)

- **Stop it:** `buena_cancel_signal_enrichment` removes queued work. Include
  whole batches only, show the owner, signal, result count, and batch IDs, and
  pass `cancellationConfirmed: true` after a yes. Credits already spent with
  the provider are not refunded; say so.
- **Wrong email type:** `buena_requeue_signal_enrichment` resubmits the same
  results with a new lookup mode. It can spend more credits, so it needs
  `additionalCreditSpendConfirmed: true` after the user agrees. Work one signal
  and at most 100 results per call; pass `targetCampaignId` to add the results
  to an existing campaign.

## From the user's own list

Use this when the user already has prospects (a CSV, spreadsheet, CRM export,
or pasted list), or, in a Buena membership, for people found with research. No
signals, enrichment, or credits are involved.

1. Read the list yourself and normalize up to 500 rows. Every row needs an
   email if email is a channel, and a LinkedIn profile URL if LinkedIn is.
2. Choose the product, senders (`buena_list_email_senders`, and, in managed
   workspaces, regular workspace accounts from `buena_list_linkedin_senders`),
   schedule, and brief. A campaign needs a sender: if there's no active
   mailbox, stop and ask the user to connect a mailbox in the Buena app first.
3. Show the owner, row count, duplicate and suppression handling, senders, and
   schedule. After a yes, call `buena_create_campaign_from_customer_list` with
   `selectionConfirmed: true` and one UUID `idempotencyKey`, generated once and
   reused unchanged on any retry.

## Fractional SDRs (managed workspaces)

Buena's fractional SDRs send LinkedIn outreach for the user. Buena doesn't
generate leads for these campaigns; they use the user's list or an existing
draft's leads.

- List them with `buena_list_fractional_sdrs` and let the user choose.
- **New campaign from the user's list:** every row needs a LinkedIn profile
  URL. Show the owner, SDRs, brief, and prospect count; after a yes call
  `buena_create_fractional_sdr_campaign` with `selectionConfirmed: true` and
  one UUID `idempotencyKey`, reused unchanged on any retry.
- **Add LinkedIn to an email campaign:** this comes after the email draft has
  its messages and a mailbox, so it's covered in the launch-campaign skill.
- **Replace SDRs on a draft:** call
  `buena_preview_fractional_sdr_campaign_reassignment`, show the current,
  added, removed, and final SDRs, then after a yes call
  `buena_reassign_fractional_sdr_campaign` with the preview's
  `expectedRevision`.

## Reveal work emails

Get a quote with `buena_workspace_quote` (action `work-email`), show it, and
after the user approves call `buena_workspace_work_email` for up to 10 people
with `maximumCredits` and `confirmed: true`. Describe each person by their
LinkedIn URL, first and last name, and company domain, never the research `id`
(it comes from a different provider and won't match). Only emails actually
found are charged. The reveal runs in the background: check
`buena_workspace_operations` until it settles and read the emails there.
Reuse the same `operationId` after a timeout.

## What comes next

The personalize-drafts skill writes the messages; the launch-campaign skill
adds senders and launches.
