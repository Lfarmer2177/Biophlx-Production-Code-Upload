# BIOPHLX proposed movement integration

This is a partial implementation of the reviewed proposed experience on production baseline `75d06cb`, using the current app's recorded data contract. It does not implement all 31 proposed screens. The firmware baseline is 1.3.11; no future firmware fields or backend services are assumed.

## Implemented

- Home and session history replace muscle allocation and momentum summaries with recorded movement: range of motion, rep duration, and estimated speed. A local calendar selection controls the displayed records; an empty date remains empty.
- Each metric has a separate comparable-rep mean, denominator, and exclusion count. Missing data is not zero. Zero measurements and zero historical scores remain valid. Complete, incomplete, and records without individual bands are counted separately.
- Pair means require two valid measurements from the same recorded rep and known, opposite-side placements of the same limb type. Mixed limbs, duplicate sides, unknown placement, missing bands, and invalid individual values are excluded from the relevant mean. Individual measurements remain visible.
- Session review uses exercise > set > rep > both bands. Set scores average existing valid rep scores; stored combined and per-band scores are retained. Current live review uses the existing ROM scoring rule and separates repeated exercise runs. No replacement score, muscle activation, form grade, or target-adherence score is invented.
- Rep history follows every returned cursor, checks errors and repeated cursors, and deduplicates overlapping pages by persisted rep identity. Session detail discovery uses actual exercise indices and preserves orphaned reps instead of stopping after gaps or an arbitrary index of 20.
- Failed rep reads show partial counts with retry. Failed set metadata reads preserve the available rep records and show an explicit message.
- Home resolves the signed-in user's customer profile before loading customer sessions. Existing auth, navigation, band connection, trainer, tutorial, and messaging entry points remain.

## Limits and remaining scope

- `band_metrics` version 1 does not record target ranges, movement phase, units metadata, firmware version, or authoritative structured placement. Placement comparisons currently use the recorded labels; phase matching and firmware-origin validation cannot be established from these records. The UI explicitly makes target adherence unavailable. Summaries are descriptive movement means, not evidence of correct form or exercise benefit.
- Current list APIs for sessions, session items, and sets expose arrays without cursor fields in their existing GraphQL selections. The screens load up to 50 sessions; item/set requests use 1,000. Rep connections are fully paginated. Counts are explicitly limited to loaded history; complete long-term history requires a verified backend pagination contract.
- Exercise names can fall back to an exercise number if catalog metadata is missing or fails to load. An exercise catalog failure never creates a measurement.
- Capture sequencing, paired-band freshness, save acknowledgement/retry, disconnect handling, command-result handling, and OTA belong to the shared integration work. This change does not assert that current firmware provides an atomic finalized rep snapshot or that every displayed live rep has been saved.
- The broader proposed scope remains: full onboarding and role flows, workout builder and capture-flow redesign, progress trends with explicit comparability cohorts, export/reporting, trainer workflow redesign, complete accessibility/device visual validation, and the rest of the reviewed screen inventory. No claim of completing the entire proposed application is made.
- No AWS deployment, device commands, firmware edits or app-store submission are part of this branch. See BRANCH-STATUS.md for publication and integrated verification.

## Validation

`node --test tests/movementMetrics.test.cjs tests/sessionHistoryData.test.cjs tests/history.test.cjs tests/repFeedback.test.cjs` passes 20 tests covering zero/missing/invalid values, metric-specific counts, incompatible placements, equal weighting, local dates, empty selections, full rep pagination, duplicate pages, cursor failure, high exercise indices, orphaned reps, set-metadata failures, and unchanged historical scoring.

`npm run test:source` compiles JSX and resolves local imports for six edited screens/components/hooks using the declared Babel development dependencies. This is a source validation, not an Android/iOS build or a device test. Native rendering, paired hardware behavior, real AWS authorization/pagination, persistence, and OTA require integration acceptance testing.
