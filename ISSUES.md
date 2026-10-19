# BIOPHLX proposed app with current firmware: issue list

Prepared 2026-10-19. Logical variant: `proposed-app-current-firmware`.

Implement proposed app behavior compatible with current 1.3.11, retaining honest legacy measurement limits.

Firmware target: **1.3.11 / code b3fb0b35; repository head 10cb763b**.

App branch implementation, documentation and host tests only; firmware protected. No AWS deployment, firmware build/flash, GitHub issue creation or push is established by this catalog.

October 17 source review and October 4 AWS export; neither is a new live/hardware test on October 19.

1 issues have limited local/evidence resolution; 5 contain implemented app work with acceptance still open. All other listed issues remain unresolved. No implemented status below means native, hardware, firmware or backend release acceptance is complete.

Repository links are relative to this app branch root. Dated private AWS/planning evidence is summarized in [review sources](docs/firmware/REVIEW-SOURCES.md); private exports are not included.

| ID | Priority | Status | Owner | Issue |
|---|---|---|---|---|
| SHARED-001 | P2 | resolved-evidence-only | Integration maintainer | Pin the review baseline and distinguish the three variants |
| SHARED-002 | P0 | unresolved-protected-firmware | Firmware maintainer + release security owner | Device-side image authenticity and OTA authorization |
| SHARED-003 | P0 | unresolved-protected-firmware | Firmware maintainer + device support owner | Post-activation health and recovery |
| SHARED-004 | P1 | unresolved-release-artifact | Release engineer + firmware maintainer | Supply a reproducible, uniquely identified update artifact |
| SHARED-005 | P0 | unresolved-hardware | Mobile QA + hardware validation owner | Run the physical iOS/Android OTA and workout acceptance matrix |
| SHARED-006 | P1 | unresolved-backend | Backend engineer + security owner | Add release/attempt services with authorization and truthful acknowledgements |
| SHARED-007 | P1 | implemented-pending-native-validation | Mobile engineer | Validate foreground lifecycle, navigation and shared BLE exclusion |
| SHARED-008 | P1 | unresolved-service-process | Device support owner + firmware maintainer | Bootstrap older bands through an approved service process |
| B1-001 | P1 | implemented-pending-native-validation | Mobile transport engineer | Integrate and verify the 1.3.11 OTA state machine |
| B1-002 | P1 | implemented-pending-native-validation | Mobile UI engineer | Validate the implemented gated band firmware screen |
| B2-001 | P1 | partially-implemented-open | Workout engineer | Expose 1.3.11 compatibility limits in the proposed runner |
| B2-002 | P1 | implemented-pending-native-validation | Mobile UI engineer | Retain one combined set and band review |
| B2-003 | P1 | unresolved-persistence | App persistence engineer + backend engineer | Preserve original identity through offline, retry and late-band updates |
| B2-004 | P1 | unresolved-schema-migration | Backend engineer | Migrate set keys and metric envelopes compatibly |
| B2-005 | P1 | unresolved-metric-policy | Measurement/product owner + backend engineer | Define target scoring and comparable summaries |
| B2-006 | P1 | unresolved-legacy-reliability | Workout engineer + hardware QA | Validate current-firmware two-band set and disconnect behavior |
| B2-007 | P2 | unresolved-remaining-screen-scope | Product owner + mobile/backend engineers | Track the remaining proposed screen and service scope separately |
| B2-008 | P1 | unresolved-pagination-contract | Backend engineer + history engineer | Expose complete session/item/set pagination rather than inferring completeness |

## SHARED-001: Pin the review baseline and distinguish the three variants

**P2 · resolved-evidence-only · Owner: Integration maintainer**

The retained October 17 review pins code b3fb0b35, head 10cb763b and current app 75d06cb. The third branch targets a future contract, not a newer firmware claim.

Complete acceptance criteria:

- Retain exact source SHAs and dates in branch documentation.
- Do not describe the October 4 AWS export as a fresh live audit or 1.3.11 as finalized-rep capable.

Resolution/status evidence: Source/branch intent is documented locally; no device behavior is certified.

Sources/evidence:

- [manifest](https://github.com/Lfarmer2177/BiophlxFirmwareCode/commit/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64)
- [firmwareCodeCommit](https://github.com/Lfarmer2177/BiophlxFirmwareCode/commit/b3fb0b35b6e149dec1aef027c0419c9c51e4460c)
- [appBaseline](https://github.com/Lfarmer2177/Biophlx-Production-Code-Upload/tree/75d06cb25ccc8b27dd328bc34678871dc1ee4c0e)
- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)

## SHARED-002: Device-side image authenticity and OTA authorization

**P0 · unresolved-protected-firmware · Owner: Firmware maintainer + release security owner**

Reviewed 1.3.11 accepts unrestricted OTA GATT writes and caller-provided MD5; secure boot/signed-app verification are off. An app login and download hash do not authorize the device writer.

Complete acceptance criteria:

- Agree and independently implement device-side authenticity/authorization controls outside these app branches.
- Demonstrate rejection of unauthorized, unsigned and wrong-target images under the agreed design.

Firmware dependency: recommendation/acceptance requirement only. Firmware edits, compilation, flashing and publishing are outside this app-branch task.

Sources/evidence:

- [firmwareOta](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Ota.cpp)
- [firmwareBle](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Ble.cpp)
- [firmwareConfiguration](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/sdkconfig.release-gen1-3-pico-d4)
- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)

## SHARED-003: Post-activation health and recovery

**P0 · unresolved-protected-firmware · Owner: Firmware maintainer + device support owner**

The inactive slot protects a transfer but automatic boot rollback is disabled; a valid image that crashes can require USB recovery.

Complete acceptance criteria:

- Document and bench-test the actual post-activation recovery procedure.
- If rollback is chosen, implement and validate boot health/rollback separately; determine bootloader/partition USB requirements.
- Remove any blanket promise that every failed update leaves the device operational.

Firmware dependency: recommendation/acceptance requirement only. Firmware edits, compilation, flashing and publishing are outside this app-branch task.

Sources/evidence:

- [firmwareConfiguration](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/sdkconfig.release-gen1-3-pico-d4)
- [firmwareOta](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Ota.cpp)
- [firmwareAdminGuide](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/documents/Biophlx_OTA_Admin_Guide.pdf)

## SHARED-004: Supply a reproducible, uniquely identified update artifact

**P1 · unresolved-release-artifact · Owner: Release engineer + firmware maintainer**

No signed-off release artifact or source-to-binary bench evidence is supplied by these app scaffolds. Version reuse cannot identify an exact running build.

Complete acceptance criteria:

- Retain immutable padded application .gz, source/build identity, board/partition target, compressed/inflated sizes and both MD5 values.
- Pin dependencies, build the intended target and verify its image; do not use factory ZIP, bootloader or partition files for BLE OTA.
- Use a unique verified target version/build; do not infer an exact build from a reused version string.

Firmware dependency: recommendation/acceptance requirement only. Firmware edits, compilation, flashing and publishing are outside this app-branch task.

Sources/evidence:

- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)
- [manifest](https://github.com/Lfarmer2177/BiophlxFirmwareCode/commit/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64)

## SHARED-005: Run the physical iOS/Android OTA and workout acceptance matrix

**P0 · unresolved-hardware · Owner: Mobile QA + hardware validation owner**

Host fixtures and source review do not prove native Bluetooth timing, sensor behavior, power safety or installed firmware.

Complete acceptance criteria:

- Test each band slot on real iOS/Android through download, transfer, verification, reboot and rediscovery.
- Exercise packet loss, duplicate/reordered ACKs, low battery/USB, background/lock/process death, Bluetooth loss, low/changed MTU and power loss at each stage.
- Validate post-update start/readiness, two sets, mid-rep hold, STOP, disconnect, Mountain Climbers placement and sensor/battery recovery.
- Retain artifact/device/app identifiers and actual results, including failures.

Sources/evidence:

- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)
- [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md)

## SHARED-006: Add release/attempt services with authorization and truthful acknowledgements

**P1 · unresolved-backend · Owner: Backend engineer + security owner**

The October 4 AWS snapshot has no OTA release/attempt model and identifies missing caller ownership checks and success-looking rep resolver responses.

Complete acceptance criteria:

- Re-read live AWS before designing migrations; reuse the existing stack and deployed band_metrics/tut/velocity fields.
- Implement authorized immutable release distribution and idempotent attempt state in staging if cloud distribution is selected.
- Return confirmed stored values and errors; test cross-user denial, identical retry, conflict and partial-to-complete merge.
- Make installed-version observation distinct from transfer completion.

Sources/evidence:

- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)
- [docs/firmware/BACKEND-DESIGN.md](docs/firmware/BACKEND-DESIGN.md)

## SHARED-007: Validate foreground lifecycle, navigation and shared BLE exclusion

**P1 · implemented-pending-native-validation · Owner: Mobile engineer**

The shared operation gate, acknowledged workout-command writes, and foreground/lifecycle protections are implemented. Native navigation, background/reconnect timing and cross-screen exclusion still require device validation.

Implemented app scope:

- Shared BLE operation gate excludes OTA and workout/Identify operations and guards connection actions.
- Workout writes wait for firmware return-code acknowledgement instead of treating a GATT write as success.
- Foreground/lifecycle and updater-owned reconnect handling are implemented.

Still open:

- Run real iOS/Android navigation, screen lock/background, connection loss and simultaneous-action tests.
- Verify retained workout data, unknown-outcome recovery and selected-device rediscovery across app interruption.

Complete acceptance criteria:

- All app workout/Identify/update commands and connection actions respect one shared update lock.
- Keep pending workout data before OTA; prevent starting during capture.
- Validate navigation/screen lock/background behavior in native builds and show interrupted/unknown outcomes honestly.
- Check completion only after selected-device rediscovery and target identity verification.

Resolution/status evidence: App protections implemented; full acceptance remains open until native/hardware evidence is recorded.

Sources/evidence:

- [src/context/BleContext.js](src/context/BleContext.js)
- [src/services/ble/commandResult.js](src/services/ble/commandResult.js)
- [src/services/ota/updater.js](src/services/ota/updater.js)
- [src/screens/FirmwareUpdateScreen.js](src/screens/FirmwareUpdateScreen.js)
- [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md)

## SHARED-008: Bootstrap older bands through an approved service process

**P1 · unresolved-service-process · Owner: Device support owner + firmware maintainer**

1.3.11 is the first reviewed firmware with image transfer; read-only OTA version service on 1.3.9 does not provide the initial update path.

Complete acceptance criteria:

- Detect presence of the required OTA characteristics, not a version string alone.
- Show service-update-required for older or unsupported devices.
- Document and test USB bootstrap on the intended hardware outside these app branches; do not execute it as part of this work.

Firmware dependency: recommendation/acceptance requirement only. Firmware edits, compilation, flashing and publishing are outside this app-branch task.

Sources/evidence:

- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)
- [manifest](https://github.com/Lfarmer2177/BiophlxFirmwareCode/commit/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64)

## B1-001: Integrate and verify the 1.3.11 OTA state machine

**P1 · implemented-pending-native-validation · Owner: Mobile transport engineer**

The 1.3.11 OTA transport is implemented and its 13 mocked protocol tests pass. This is host state-machine evidence; native timing, hardware recovery and customer release acceptance remain open.

Implemented app scope:

- Exact 22-byte START, status-before-ACK parsing, fixed-payload/window flow control and bounded sequence guards.
- Distinct compressed/image MD5s, retransmission/reconnect logic and no requirement for a final ACK.
- Finalization cancellation barrier, selected-device target-version verification and scoped monitor cleanup.

Still open:

- Run the transport in actual iOS/Android builds with a validated release artifact and both band slots.
- Complete physical loss/background/power/recovery acceptance; do not infer signed-image support or rollback from passing mocks.

Complete acceptance criteria:

- Encode the exact 22-byte little-endian START; distinguish status constants from ACK values.
- Use fixed payload P, window 32, bounded sequence, distinct compressed/image MD5s, and recovery without waiting for an unspecified final ACK.
- Retain selected-device identity; cancellation stops being offered before finalization; resolve reconnect state before a new START.
- Run protocol unit tests and native integration tests without adding firmware changes.

Test evidence: **13 passed, 0 failed** — mocked host protocol tests. See [tests/ota.test.cjs](tests/ota.test.cjs) and [branch test results](docs/TEST-RESULTS.md).

Resolution/status evidence: Implemented with 13/13 mocked tests passing. The issue remains open for native/hardware acceptance.

Sources/evidence:

- [src/services/ota/protocol.js](src/services/ota/protocol.js)
- [src/services/ota/updater.js](src/services/ota/updater.js)
- [tests/ota.test.cjs](tests/ota.test.cjs)
- [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md)
- [firmwareOta](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Ota.cpp)
- [firmwareBle](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Ble.cpp)

## B1-002: Validate the implemented gated band firmware screen

**P1 · implemented-pending-native-validation · Owner: Mobile UI engineer**

The band firmware route/UI, default-off pilot gate, local file validator, device identity checks and battery preflight are implemented. Native end-to-end operation and release-service acceptance remain open.

Implemented app scope:

- Band firmware route and updater UI with explicit transfer/verification/restart/outcome states.
- OTA pilot defaults off; selecting or starting an update remains gated.
- Local artifact validation and device identity/capability/battery checks before transfer.

Still open:

- Validate the file-picker, permissions, screen/lifecycle behavior and target identity handling on actual iOS/Android builds.
- Provide an approved release artifact and production distribution/eligibility policy; the local pilot UI does not establish a release catalog.
- Keep device-side authenticity, rollback and physical verification open under the shared firmware issues.

Complete acceptance criteria:

- Show selected band, source/target version, eligible artifact and charge status.
- Separate transfer, verification, restart, verified completion, retry and service-required states.
- Default the pilot off; do not advertise customer readiness merely because a source branch exists.
- Leave other current app behavior visible and document retained issues.

Test evidence: **8 passed, 0 failed** — host artifact tests using application dependencies with independent Node hashes. See [tests/otaArtifact.test.cjs](tests/otaArtifact.test.cjs) and [branch test results](docs/TEST-RESULTS.md).

Resolution/status evidence: App route, guarded UI and preflight implementation are present; 8/8 artifact helper tests pass. Native/hardware acceptance is not complete.

Sources/evidence:

- [App.js](App.js)
- [src/screens/FirmwareUpdateScreen.js](src/screens/FirmwareUpdateScreen.js)
- [src/config/appVariant.js](src/config/appVariant.js)
- [src/services/otaArtifact.js](src/services/otaArtifact.js)
- [tests/otaArtifact.test.cjs](tests/otaArtifact.test.cjs)
- [src/context/BleContext.js](src/context/BleContext.js)
- [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md)

## B2-001: Expose 1.3.11 compatibility limits in the proposed runner

**P1 · partially-implemented-open · Owner: Workout engineer**

The shared BLE controller now uses signed int16 ROM/current-position decoding and acknowledged workout commands. Proposed runner readiness/capture behavior and legacy measurement reliability still require their remaining acceptance evidence; the future finalized-rep contract stays disabled for 1.3.11.

Implemented app scope:

- Signed int16 ROM/current-position decoding in the shared BLE controller.
- Acknowledged workout-command path shared with the OTA operation gate.

Still open:

- Confirm the final proposed runner uses device readiness without an extra countdown.
- Validate legacy/consolidated subscription selection and delayed per-band metrics on hardware.
- Do not present cached legacy rep-edge values as immutable finalized events.

Complete acceptance criteria:

- Use actual readiness/command results with no extra user countdown.
- Decode ROM/current-position as signed int16; retain existing duration/speed widths.
- Do not subscribe only to orientation while still relying on suppressed legacy measurement notifications.
- Preserve source identity, missing/late values and per-band capture status without claiming atomically finalized data.

Resolution/status evidence: Shared decoder/command changes are implemented; complete runner and measurement acceptance remains open.

Sources/evidence:

- [src/context/BleContext.js](src/context/BleContext.js)
- [src/services/ble/commandResult.js](src/services/ble/commandResult.js)
- [firmwareBle](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Ble.cpp)
- [firmwareExercise](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Exercises.cpp)
- [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md)

## B2-002: Retain one combined set and band review

**P1 · implemented-pending-native-validation · Owner: Mobile UI engineer**

The proposed history and feedback components implement Set -> Rep -> both-band details, separate per-metric means and explicit exclusions, while preserving historical score meaning. Native review/capture lifecycle and trustworthy persisted provenance remain acceptance work.

Implemented app scope:

- Shared HistoryCards and RepFeedbackCard reuse one set/rep/both-band review.
- Movement summaries use recorded rep data and preserve existing scores without inventing target adherence.

Still open:

- Validate reviewing completed sets during next-set preparation without stopping incoming device capture.
- Verify partial/sync/confirmed-save behavior against real capture and staging persistence.
- Do not infer missing phase, target or firmware provenance for legacy records.

Complete acceptance criteria:

- Expand Set -> original Rep -> both bands in place.
- Show independent metrics, units, validity and separate comparable per-metric means.
- Keep completed sets accessible during next-set preparation and continue incoming capture while reviewing.
- Show partial/unscored and syncing/confirmed-save states distinctly; do not fabricate missing values.

Test evidence: **20 passed, 0 failed** — 7 movement, 4 loader and 9 existing host tests; six JSX modules compile/import-resolve. See [branch test results](docs/TEST-RESULTS.md).

Resolution/status evidence: Core review and movement-summary implementation is present; 20 host tests pass and six JSX modules compile/import-resolve. Full native/capture/persistence acceptance remains open.

Sources/evidence:

- [src/Components/history/HistoryCards.js](src/Components/history/HistoryCards.js)
- [src/Components/history/movementMetrics.js](src/Components/history/movementMetrics.js)
- [tests/movementMetrics.test.cjs](tests/movementMetrics.test.cjs)
- [src/Components/history/sessionHistoryData.js](src/Components/history/sessionHistoryData.js)
- [tests/sessionHistoryData.test.cjs](tests/sessionHistoryData.test.cjs)
- [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md)
- [docs/firmware/BACKEND-DESIGN.md](docs/firmware/BACKEND-DESIGN.md)
- [Proposed movement integration](docs/PROPOSED-MOVEMENT-INTEGRATION.md)

## B2-003: Preserve original identity through offline, retry and late-band updates

**P1 · unresolved-persistence · Owner: App persistence engineer + backend engineer**

The retained review identifies arrival-order/retry numbering and success-looking save paths. In-memory pairing alone does not repair durable persistence.

Complete acceptance criteria:

- Allocate stable session/exercise-occurrence/set/rep identities once and persist pending originals before acknowledging retention.
- Restart/retry/late-band updates use the same keys and do not duplicate counts.
- Propagate write failures and mark Saved only after canonical server acknowledgement.
- Test process restart, missing band, final save and conflicting retry against staging.

Sources/evidence:

- [docs/firmware/BACKEND-DESIGN.md](docs/firmware/BACKEND-DESIGN.md)
- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)

## B2-004: Migrate set keys and metric envelopes compatibly

**P1 · unresolved-schema-migration · Owner: Backend engineer**

The deployed set key only supports one row per session/item; the current runner avoids collisions with separate items. New exercise-to-multiple-set grouping needs a coordinated schema plan.

Complete acceptance criteria:

- Preserve deployed AWSJSON and Float support; do not regress velocity to Int.
- Use additive precision-preserving values and compatible readers before new envelopes are written.
- If normalizing set storage, migrate a versioned key/table and explicit legacy mappings with backup and count reconciliation.
- Keep combined-only and version-1 history readable without invented per-band metadata.

Sources/evidence:

- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)
- [docs/firmware/BACKEND-DESIGN.md](docs/firmware/BACKEND-DESIGN.md)

## B2-005: Define target scoring and comparable summaries

**P1 · unresolved-metric-policy · Owner: Measurement/product owner + backend engineer**

The current score is ROM-only 0/50/100. New target adherence and normalized ratings require their own definitions and immutable target snapshots.

Complete acceptance criteria:

- Version eligible metrics, units, targets and calculation policy per exercise/placement.
- Expose eligible/matched/excluded/incomplete denominators; no target means baseline and no target score.
- Do not combine unlike raw metrics or treat arm/thigh as bilateral symmetry.
- Client and coach summaries agree and preserve historical formula meaning.

Sources/evidence:

- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)
- [docs/firmware/BACKEND-DESIGN.md](docs/firmware/BACKEND-DESIGN.md)

## B2-006: Validate current-firmware two-band set and disconnect behavior

**P1 · unresolved-legacy-reliability · Owner: Workout engineer + hardware QA**

Each physical three-second hold advances only its own band; disconnect stops its exercise and a new START resets counters.

Complete acceptance criteria:

- Display completed sets + 1, show each band's confirmation, and do not count a set-transition as a rep.
- Keep two-thigh Mountain Climbers placement and current exercise assignment.
- Treat disconnect as interruption with explicit recovery; do not advertise transparent resume.
- A mid-rep hold must not produce a falsely reliable next-set metric; flag unsupported reliability until firmware correction.

Firmware dependency: recommendation/acceptance requirement only. Firmware edits, compilation, flashing and publishing are outside this app-branch task.

Sources/evidence:

- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)
- [firmwareExercise](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Exercises.cpp)
- [firmwareButtons](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Buttons.cpp)

## B2-007: Track the remaining proposed screen and service scope separately

**P2 · unresolved-remaining-screen-scope · Owner: Product owner + mobile/backend engineers**

This branch work adds selected movement/review and integration changes; it does not complete all 31 planning slides, account/payment/trainer flows or their backend repairs.

Complete acceptance criteria:

- Maintain an implemented-versus-open screen inventory against the retained approval ledger.
- Do not represent every detailed screen or deployment as accepted by the overall-direction decision.
- Carry account, trainer, payment, entitlement, target and history service repairs as explicit work with independent acceptance evidence.

Sources/evidence:

- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)

## B2-008: Expose complete session/item/set pagination rather than inferring completeness

**P1 · unresolved-pagination-contract · Owner: Backend engineer + history engineer**

The proposed history reader can page and deduplicate rep connections, but existing array-only session/item/set APIs do not provide a reliable completeness contract.

Complete acceptance criteria:

- Add compatible items/nextToken connection responses for every required list and paginate end to end.
- Preserve orphan rep evidence and visible metadata/query errors rather than silently dropping records.
- Verify histories longer than one API page and date/time-zone boundaries; reconcile summaries to unique persisted reps.

Sources/evidence:

- [docs/firmware/REVIEW-SOURCES.md](docs/firmware/REVIEW-SOURCES.md)
- [docs/firmware/BACKEND-DESIGN.md](docs/firmware/BACKEND-DESIGN.md)
- [src/Components/history/sessionHistoryData.js](src/Components/history/sessionHistoryData.js)
- [tests/sessionHistoryData.test.cjs](tests/sessionHistoryData.test.cjs)
