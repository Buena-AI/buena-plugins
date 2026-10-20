# Fractional SDRs (managed)

Read this before creating, attaching or replacing fractional SDRs. The Rules
in [../SKILL.md](../SKILL.md) apply here too.

Buena's fractional SDRs send LinkedIn outreach from their own profiles to the
user's list or a draft's leads. List them with `buena_list_fractional_sdrs`,
let the user choose, and show owner, SDRs, brief and counts before each call.

- **New LinkedIn campaign from a list:** after a yes,
  `buena_create_fractional_sdr_campaign` with a UUID `idempotencyKey`,
  `name`, `campaignBrief`, `prospects` (each with `linkedinUrl`),
  `senderProfileIds`, optional `productId` and `settings`, and
  `selectionConfirmed: true`.
- **Add LinkedIn to an email draft** that already has its email sequence and
  a connected mailbox: after a yes, `buena_attach_fractional_sdr_to_campaign`
  with a UUID `idempotencyKey`, `campaignId`, `campaignBrief`,
  `senderProfileIds` and `selectionConfirmed: true`. It uses every lead with
  a LinkedIn URL; show the lead and LinkedIn-eligible counts.
- **Replace SDRs on a draft:**
  `buena_preview_fractional_sdr_campaign_reassignment` with `campaignId` and
  the exact final `senderProfileIds` (not an addition); show current, added,
  removed and final SDRs. After a yes, `buena_reassign_fractional_sdr_campaign`
  with the same `campaignId` and `senderProfileIds`, the preview's
  `expectedRevision`, a UUID `idempotencyKey`, and `reassignmentConfirmed: true`.
