# BIOPHLX iPhone / TestFlight build - current-app-ota

This checkout prepares a separate iOS app named **BIOPHLX OTA Pilot**, with bundle ID `com.londof.biophlxAppTestAWS.currentota`. Its Expo project ID remains `d0a8b706-94fd-4ccf-b08c-e4de8bdc6e5f`. Ordinary `production` and local builds keep the original app ID `com.londof.biophlxAppTestAWS`. The `testflight` build profile selects this branch explicitly, makes a store-signed build, auto-increments the build number and keeps customer OTA disabled.

**Current state:** Config and host tests are prepared. No signed `.ipa` exists. No EAS build, App Store Connect upload, TestFlight tester invitation or phone installation was completed. The local workstation could not reach `api.expo.dev` or `registry.npmjs.org` when checked on 2026-10-31. The inherited `yarn.lock` lacks the newly declared `pako@2.1.0` and `expo-document-picker@~14.0.7` resolutions, so a frozen dependency install is not yet release-ready. The last full host suite before this TestFlight configuration had 46/46 passing tests; this configuration adds three separate identity tests.

## Prerequisites before any cloud build

1. Restore registry and Expo API access on the desktop. Start from a clean checkout of this branch commit and run `git status --short` before building. Then run `yarn install` to regenerate `yarn.lock` for the new dependencies, review and commit that diff on a named branch, and run `yarn install --frozen-lockfile` and `npm test`. The `TF-Current` release checkout is detached; update the named branch and then reset that checkout to its new commit before building. Do not submit a build with an inconsistent lockfile.
2. Confirm `eas whoami` can read the intended Expo account and EAS project. The current CLI check could not reach Expo, so account ownership and available build slots are unverified.
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

These are three separate TestFlight apps so they can coexist on one phone. Their app icons come from the shared BIOPHLX asset; their iPhone display names distinguish them. The future-firmware variant still uses the current 1.3.11 path because the proposed finalized-rep firmware and BLE binding do not exist. OTA is default-off in every TestFlight profile. Native/device/AWS acceptance remains in `ISSUES.md`.

Sources: [Expo TestFlight guide](https://docs.expo.dev/submit/testflight/), [Expo app variants](https://docs.expo.dev/build-reference/variants/), [EAS Submit profiles](https://docs.expo.dev/submit/eas-json/).
