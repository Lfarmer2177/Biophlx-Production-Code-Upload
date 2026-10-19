# BIOPHLX — proposed-app-current-firmware

Branch: `codex/proposed-app-current-firmware`. Prepared 2026-10-19 from app commit `75d06cb25ccc8b27dd328bc34678871dc1ee4c0e`.

## Implemented

OTA service discovery, file validation, foreground update screen, shared BLE exclusion, command acknowledgement, resumable transfer and post-reboot version verification. Customer OTA is off by default. Proposed movement dashboard/calendar history, metric-specific comparable means, expandable set > rep > both-band review, fully paginated rep loading, and firmware-owned readiness without an additional app countdown. Capture is armed during two-band preparation.

Both-band STOP is attempted independently, including when one write fails. The surviving band retains an End Workout control after disconnect. A disconnect ends app capture; it is not transparent resume.

## Read before release

This is an integration branch, not a production-certified app. [ISSUES.md](ISSUES.md) lists priorities, owners and acceptance criteria. [Test results](docs/TEST-RESULTS.md) distinguish simulated checks from physical device and AWS validation. [Sources](docs/firmware/REVIEW-SOURCES.md) pin the exact firmware and app revisions. [Backend design](docs/firmware/BACKEND-DESIGN.md) is a proposal only.

The current firmware baseline is **1.3.11**. The new-firmware variant means the proposed future contract; no newer released firmware implementing that contract was found. Current firmware does not provide immutable finalized-rep snapshots. No branch changes firmware or deploys AWS infrastructure. Proposed branches implement selected dashboard/review/integration work; the remaining proposed screens remain in the issue list.

OTA security/signing, boot health/recovery, a reproducible release artifact, real iOS/Android testing, AWS authorization/persistence and complete history pagination remain release gates. Current app retains its prior workout countdown/measurement limitations; proposed variants remove the extra app countdown but cannot correct firmware-side measurement ordering.

## Run and validate

1. Install dependencies in an environment with registry access (`npm install`) and generate/review a consistent lockfile; the inherited `yarn.lock` has not been refreshed for new dependencies.
2. Run `npm test` and `npm run test:source`.
3. Build the native development app (`npm run android` or `npm run ios` on the appropriate host). BLE and OTA require a native development build; a browser or Expo Go is not device validation.
4. The updater is under Home > Device setup > Firmware update. It shows firmware information in normal builds. Only an internal bench build may set `EXPO_PUBLIC_ENABLE_OTA_PILOT=true` after the listed release controls are addressed.
5. Supply an approved padded `.bin.gz`, unique newer target version and uncompressed image MD5. These hashes detect corruption, not publisher authenticity. Update one idle band at a time; both bands must have ended their exercises. The pilot requires at least 10% battery. Firmware older than 1.3.11 requires service/USB bootstrap.

Do not use production customer data or advertise unsigned OTA as customer ready. An OTA attempt is recorded only in local AsyncStorage; no cloud release registry or attempt service is assumed. Keep the app foregrounded. No new firmware image is bundled.
