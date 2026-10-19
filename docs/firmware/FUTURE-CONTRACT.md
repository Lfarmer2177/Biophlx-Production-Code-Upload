# BIOPHLX proposed finalized-rep contract 0.1

Status: **0.1-proposed; transport unbound; synthetic fixtures only.** Prepared October 19, 2026 for the proposed-app-new-firmware branch. This is an app-side scaffold and firmware handoff specification. It does not implement firmware, define BLE UUIDs, prove a device handshake, or claim firmware 1.3.11 emits these records.

The retained October 17 review pins firmware code `b3fb0b35b6e149dec1aef027c0419c9c51e4460c`, repository head `10cb763b8c58edbec43ad2bceb2cbbd8b5700d64`, and app `75d06cb25ccc8b27dd328bc34678871dc1ee4c0e`. That source still increments reps before final TUT and does not atomically reset all partial-rep state on set advance. Its OTA stream is separate from this proposed measurement contract.

## Gate and trust boundary

`createFinalizedRepAdapter(configuration)` requires explicit `mode: fixture` or `mode: negotiated-device`. There is no default, firmware-version inference, or automatic fallback.

Both configured bands must confirm exactly `contractId: biophlx.finalized-rep`, `contractVersion: 0.1-proposed`, and all three capabilities: `immutable-finalized-rep`, `shared-session-set-rep-identity`, `atomic-set-boundary`. Each negotiation carries an evidence reference, source firmware version, and build ID. Fixture mode accepts only `source: fixture`; device mode requires `source: verified-device-handshake`.

The future transport binding is responsible for verifying that negotiation against an actual device and for checking its authenticity, capabilities and installed build. These JavaScript fields are a trusted caller boundary, **not cryptographic evidence**. Setting them manually cannot make 1.3.11 support this contract. No binding is provided, and production must leave this route disabled until a real binding and bench evidence exist. The test that exercises device-mode validation also uses synthetic data and is not a device test.

Changing this contract requires a new explicit version and compatibility decision. Do not coerce legacy notifications into finalized events merely because values are cached, a timeout expires, or a rep counter increments.

## Configuration and event shape

The implementation is dependency-free CommonJS in `finalizedRepAdapter.js`; tests include complete synthetic configuration/event examples. A separate adapter instance owns one app session, exercise occurrence and set, with two assigned bands. Configuration requires:

| Field | Meaning |
|---|---|
| `sessionId`, `exerciseInstanceId`, `exerciseId` | Stable app session and distinct performed exercise occurrence; repeated exercise names are insufficient |
| `setId`, `setIndex` | Shared stable set identity and original one-based set index |
| `bands[2]` | Distinct slot and device ID, device run ID, actual side (`left/right`), limb (`arm/thigh`), exercise profile, and explicit negotiation evidence |
| `mode` | Explicit `fixture` or `negotiated-device` |
| `maxReps` | Maximum retained logical reps for this set, default/hard ceiling 10,000 |

`adapter.ingest(event, receivedAt)` accepts an immutable, finalized device event after a future transport binding decodes it. Input must be plain JSON data, including:

| Field | Required interpretation |
|---|---|
| `contractId`, `contractVersion`, `status` | Exact proposed ID/version and `status: finalized`; live/partial phase updates are not final events |
| `sessionId`, `exerciseInstanceId`, `exerciseId`, `setId`, `setIndex` | Match the configured shared session/set context |
| `logicalRepId`, `repIndex` | Shared identity within this set and original one-based rep index; both bands must agree before pairing |
| `eventId`, `sequence` | Immutable per-device/run event identity and nonnegative unique safe-integer sequence |
| `deviceId`, `deviceRunId`, `slot`, `side`, `limb` | Match the configured physical band and current run; stale reconnection events are rejected |
| `capturedAt` | Nonnegative safe-integer `value`, unit `ms`, kind `device-monotonic` or `device-utc`, explicit `clockId` |
| `provenance` | Firmware version/build and exercise profile matching negotiation; calibration ID is a known string or `null` |
| `metrics` | All three entries `range`, `duration`, `angularSpeed`; unavailable entries are explicit |

`receivedAt` is a separate app-side canonical UTC timestamp with milliseconds, such as `2026-10-19T14:00:00.000Z`. Capture and receive clocks remain distinct; this adapter never invents a capture time or synchronizes independent device clocks.

Each metric contains `value`, `unit`, `definitionId`, `phase`, `validity`, and `reason`. Phase is `whole-rep`, `concentric`, or `eccentric`. `validity` is `valid`, `missing`, `invalid`, or `unsupported`. Valid values are finite and nonnegative, including real zero. Every unavailable value is `null` with a nonempty reason. A finalized event may contain unavailable metrics; finalized does not mean every measurement is valid.

Supported conversions are explicit: range `deg` or `rad` becomes `deg`; duration `s` or `ms` becomes `s`; angular speed `deg/s` or `rad/s` becomes `deg/s`. Raw units/values and the complete input event remain frozen alongside normalized values. No estimated linear speed, muscle activation, rating, target adherence, or clinical interpretation is calculated.

## Pairing, idempotency and rejection

The canonical storage key is a JSON tuple `[sessionId, exerciseInstanceId, setId, repIndex]`, avoiding delimiter collisions. Arrival order never renumbers reps. Records may arrive out of order, and the counterpart can complete a previously partial pair.

- The same device/run/event ID with identical JSON content returns `status: duplicate`, retains its first receive timestamp, and does not add a row. Property ordering does not affect equality.
- A changed payload under the same immutable event ID, a reused device sequence, a second final event for that band's rep, mismatched shared rep ID, or a logical rep ID reused at another index throws a named `ContractError`.
- Wrong session, occurrence, set, device run, build, profile or assignment is rejected before state mutation. A rejected packet cannot replace the original record.
- Missing sequence numbers are not invented; out-of-order unique sequences are accepted. Gap recovery and replay negotiation belong to the future binding.
- An adapter is scoped to one set. Old-set events must be routed to that retained set's adapter, never silently inserted into the active next set. The caller owns adapter lifetime and retention.

`snapshot()` returns frozen pairs ordered by original rep index. `complete` means both band events arrived, not that their metrics are valid or saved to AWS. Each band remains independently visible.

The combined value for each metric is `(band1 + band2) / 2` only when both are valid, use the same definition and phase, and belong to the same limb placement. Same-unit arm/thigh observations remain separate. Canonical conversion permits compatible source units. The result exposes validity/reason, valid-band count, paired-valid count and calculation version. No valid pair yields `null`, never an invented zero. JavaScript floating-point precision is preserved without display rounding.

## What remains outside this module

Firmware contract implementation, authenticated negotiation, wire encoding/UUIDs, atomic device set reset, event retention/replay, safe disconnect handling, native app integration, durable storage/outbox, backend authorization/conflicts, server summaries, scoring, target snapshots, calibration, and hardware validation are unresolved. The adapter is memory-only: process death loses its in-memory maps. The host app must durably persist accepted originals before presenting them as retained/saved and replay those originals on restoration.

The adapter neither advances sets nor sends workout/OTA commands. It does not establish that a secure boot image is installed or that different firmware builds are comparable; agreed metric definition IDs and a verified negotiated contract provide that app-level compatibility boundary.

## Validation

Run from this folder: `node --test finalizedRepAdapter.test.cjs`.

The 25 tests cover explicit contract gating, fixture separation, unit conversion, decimal means, partial/missing/zero values, mixed placement/phase/definition exclusion, duplicates and conflicts, stable numbering, wrong set/run/build, immutable provenance, timestamps and bounded retention. These are host fixture tests; no BLE device, firmware build, AWS write or deployment is exercised.

Sources: `outputs/BIOPHLX-OTA-Review-2026-10-17/{review-manifest.json,report-text.txt}`; `outputs/BIOPHLX-Firmware-Compatibility/backend-compatibility-gate.md`; `outputs/BIOPHLX-Implementation-Scope/build_scope_pdf.py`.
