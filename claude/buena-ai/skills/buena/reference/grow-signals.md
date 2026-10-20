# Grow signals (managed)

Read this before adding people to signals or copying a signal to other
countries. The Rules in [../SKILL.md](../SKILL.md) apply here too.

Both tools recompute the plan from the confirming call's input: the
`operationId` alone doesn't carry it, and omitted counts fall back to defaults
that can request more or fewer people than the user approved.

**More people.** `buena_preview_signal_expansion` with `signalIds` (up to 20)
and `targetResultCount` (total per signal, up to 100, default 100); keep the
`operationId` it returns. Show each signal's current count, target and
missing people, and the total. After a yes, `buena_expand_signal_to_target`
with exactly the previewed `signalIds`, `targetResultCount` and
`operationId`, plus `confirmed: true`. Buena requests only the missing people.

**Other countries.** Read the source with `buena_get_signal`; one with more
than five criteria can't be cloned. `buena_preview_signal_geo_clones` with
`sourceSignalId`, `sourceGeography`, optional `sourceLanguages`, `targets`
(up to 20 `{country, languages}`) and `prospectCount` (per new signal,
default 25); keep its `operationId`. Show every planned query and criterion
and the total (countries × `prospectCount`). After a yes,
`buena_create_signal_geo_clones` with exactly the previewed `sourceSignalId`,
`sourceGeography`, `sourceLanguages`, `targets`, `prospectCount` and
`operationId`, plus `confirmed: true`. Retrying with that `operationId` never
duplicates signals.
