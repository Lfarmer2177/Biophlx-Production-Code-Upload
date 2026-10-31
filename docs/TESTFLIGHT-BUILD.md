# BIOPHLX iPhone / TestFlight build - proposed-app-current-firmware

This checkout prepares a separate iOS app named **BIOPHLX Proposed**, with bundle ID `com.londof.biophlxAppTestAWS.proposedcurrent`. Its Expo project ID remains `d0a8b706-94fd-4ccf-b08c-e4de8bdc6e5f`. Ordinary `production` and local builds keep the original app ID `com.londof.biophlxAppTestAWS`. The `testflight` build profile selects this branch explicitly, makes a store-signed build, auto-increments the build number and keeps customer OTA disabled.

**Current state (2026-10-31):** The branch is published to the requested GitHub repository. Expo account/project access is verified, SDK 54 packages are aligned, the frozen Yarn install succeeds, 63/63 host tests and source checks pass. No signed `.ipa`, App Store Connect upload, TestFlight invitation or verified iPhone installation exists yet. The first EAS build reached Apple Developer authentication; the local Apple session is expired.

## Prerequisites before any cloud build

1. Use the clean normal Git clone `C:\Users\londo\Documents\Codex\TF-Build-Proposed`. The older EAS CLI did not recognize the detached `TF-*` worktrees. Its `node_modules` is a local ignored junction for EAS configuration; EAS cloud installs from the committed lockfile.
2. The Expo account `londof` and project `@londof/biophlxAppTestAWS` were verified. The new bundle ID and signing still require Apple Developer account access.
3. Sign in to the Apple Developer team `5F7CG99WV8` through the EAS interactive credential flow. Each of the three bundle IDs needs its own Apple app identifier, distribution provisioning profile and App Store Connect app record. Account credentials and signing material should stay in Expo/Apple, not this repository.
4. Confirm the TestFlight app record and submission profile show the correct bundle ID. The first interactive EAS submission can create an App Store Connect record if one is missing. An App Store Connect API key or interactive Apple access is required for upload.

## Build and submit this checkout

Run from a reviewed, clean checkout of this branch, with working network, a validated lockfile and account access:

```powershell
yarn install --frozen-lockfile
npm test
npm run test:source
eas whoami
eas build --platform ios --profile testflight --auto-submit
```

The last command builds a store-distribution `.ipa` and, after successful signing, asks EAS Submit to upload it to TestFlight using the matching `submit.testflight` profile. It does **not** submit the app for public App Store review. For the first build, resolve credential and App Store Connect prompts interactively; non-interactive submission cannot create missing signing/API credentials. If automatic submission is not appropriate, build without `--auto-submit`, note the returned build ID, then use `eas submit --platform ios --profile testflight --id <build-id>`.

## Install on the iPhone

After Apple processes the upload, add the intended Apple ID to the app's TestFlight internal tester group in App Store Connect and accept its invitation in the TestFlight iPhone app. Internal testing is limited to App Store Connect team members; external testers require an external group and Apple's Beta App Review. The EAS build URL identifies the binary for the developer, but a phone tester needs the TestFlight invitation or verified public TestFlight link. Do not call a local file or an unverified EAS URL phone-installable.

These are three separate TestFlight apps so they can coexist on one phone. Their app icons come from the shared BIOPHLX asset; their iPhone display names distinguish them. The future-firmware variant still uses the current 1.3.11 path because the proposed finalized-rep firmware and BLE binding do not exist. OTA is default-off in every TestFlight profile. All three variants use the currently configured AWS Cognito/AppSync/S3 backend, so tester activity may create records there. Native/device/AWS acceptance remains in `ISSUES.md`.

Sources: [Expo TestFlight guide](https://docs.expo.dev/submit/testflight/), [Expo app variants](https://docs.expo.dev/build-reference/variants/), [EAS Submit profiles](https://docs.expo.dev/submit/eas-json/).
