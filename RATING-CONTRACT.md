# BIOPHLX rating storage contract

The deployed createSessionItemRep resolver stores the app-provided score; it does not calculate a score. Exercise has no target_rom_arm/target_rom_leg fields, and the deployed Query type exposes no ExerciseProfile lookup. The app therefore uses its pre-existing ROM scoring policy consistently, without inventing exercise targets:

- ROM from 0 through 90 degrees: 0.
- ROM above 90 through 120 degrees: 50.
- ROM above 120 degrees: 100.
- Missing, negative or non-finite ROM: not rated.

Each band receives its own score. The matched two-band rep stores the rounded average in SessionItemRep.score. Example: 130 degrees and 110 degrees produce scores 100 and 50, saving 75. A zero measurement is valid; a missing band never substitutes zero or the other band.

This is a generic ROM score, not an exercise-specific form assessment. Exercise-specific scoring requires an agreed backend profile contract and validated targets; this change does not add either.

repMetricsInput is shared by automatic rep saving and the summary-save path. score, rom and momentum are nullable GraphQL Int values. tut and velocity are nullable Float values; decimal precision is preserved. Backend changes are not required. The schema cannot store separate left/right scores on SessionItemRep; separate scores remain on the live cards and their average is persisted.

Validation on 2026-09-19:
- Six node:test regression tests passed: node --test tests/repFeedback.test.cjs
- Three live AWS assertions passed: rated rep write, nullable rep write, and readback of score 75, velocity 1.05 and tut 3.15.
- Temporary AWS account and isolated rep records deleted; strong read verified cleanup.
- Changed JSX parsed successfully. Native mobile and physical BLE testing were not performed.

The earlier BLE angle decoding and device-sequence audit findings remain separate unresolved work.

## Historical review (2026-09-19)
New reps also store `band_metrics` as version 1 AWSJSON, containing both band labels and independent score, ROM, TUT, velocity and momentum. Automatic and manual saves share the serializer. The nullable schema extension is deployed; older records retain combined metrics and show individual band values as Not recorded.

Historical cards display the unchanged stored score. Badge colors use the rounded displayed score: red 0–49, orange 50–69, yellow 70–84, green 85–100. Set score averages valid rep scores, excluding missing values and including zero. These colors are presentation thresholds, not a new scoring algorithm.
