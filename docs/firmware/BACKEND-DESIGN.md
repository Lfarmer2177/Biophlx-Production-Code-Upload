# BIOPHLX additive backend design for future finalized reps

Design only, October 19, 2026. No AWS deployment or live re-audit is performed. This accompanies proposed contract `biophlx.finalized-rep/0.1-proposed`, which firmware 1.3.11 does not implement.

Reuse the October 4 deployed `band_metrics: AWSJSON`, `tut: Float`, and `velocity: Float` fields where their meanings are compatible. Existing top-level `rom` and `score` are integers. Introduce precision-preserving combined data additively and update readers before a new envelope is written. Never overwrite historical version-1 semantics or invent firmware/build metadata for older records.

## Proposed persisted envelope

Keep stable app session/exercise occurrence/set/rep identity and both immutable per-band source events. Retain raw and canonical values, units, validity/reasons, clock domains, receive timestamps, original device/run/event/sequence identities, capture-time firmware/build/profile/calibration, and explicit contract/negotiation evidence. Keep derived `paired-mean/0.1-proposed` outputs separately versioned. A current device registry must never retroactively supply the firmware build for an old workout.

Do not treat the adapter's `complete` flag as server persistence confirmation or metric quality. Preserve separate states for one-band capture, both-band capture, per-metric validity, pending save, confirmed save, conflict and failure. Missing values stay `null`.

The current set-table key `session_id + session_item_index` cannot represent multiple set rows under a reused item key. The current normal runner avoids that collision by allocating distinct items per exercise/set. If normalizing exercise occurrences and sets, create a versioned table/key layout and migrate readers/writers together; do not change primary keys in place or silently reinterpret old grouping.

## Conditional write and acknowledgement semantics

1. Resolve authenticated session ownership or explicitly authorized coach relationship on the server. Reject client-selected ownership.
2. Validate the contract version, permitted metrics, unit conversions, known placement and source provenance. The app's `verified-device-handshake` label alone is not cryptographic proof.
3. Conditional first creation uses the stable canonical rep identity. An identical retry returns the confirmed stored record. A conflicting immutable event is rejected. A later other-band event merges conditionally into the same rep under a revision check.
4. Return canonical key, stored payload, revision, timestamps and completeness. Propagate resolver errors. The client marks saved only after checking this acknowledgement.
5. Derive metric-specific set/day means from matched valid pairs. Expose per-band sample counts, paired-valid count, missing/excluded counts, aggregation version and reconciliation time. Do not use nulls in the mean denominator.
6. Make client/coach summaries identical under the same authorization and calculation version. Preserve original target snapshots and algorithm version if scores are later added.

The future adapter supplies normalization and pairing only. It does not implement the durable outbox, idempotent cloud mutations, table migration, permissions, scoring or summaries.

## OTA records remain a separate additive concern

A release registry should retain immutable source/build ID, board/chip/partition target, artifact references and sizes/hashes, version, capability matrix, release channel and active/revoked status. For current 1.3.11 OTA, keep both compressed and inflated image MD5 values in addition to distribution integrity metadata. Device-side authorization/signing and post-boot recovery remain firmware dependencies; authenticated download alone does not solve them.

Update attempts need stable IDs, owner/device, from/to release, stage/time/error and distinct post-reconnect observation. Transfer success, activation success and verified running identity must remain distinguishable, especially when firmware version strings are reused.

## Before a deployment

Re-read live schema/resolvers, establish staging and recoverable backup, fix owner checks and truthful acknowledgements, deploy compatible readers before writers, migrate explicit mappings, reconcile unique-record counts, and run unauthorized/duplicate/conflict/partial/late/restart/decimal/legacy tests. Those acceptance steps remain open issues; this file authorizes no AWS changes.
