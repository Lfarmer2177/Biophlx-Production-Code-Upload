# BIOPHLX remote TestFlight signing option

The local interactive EAS build stopped at Apple Developer authentication because the saved Apple session expired. This branch includes a guarded GitHub Actions build option for an authorized Apple Account Holder or Admin who cannot use the desktop terminal. It prepares an EAS **build**, not a TestFlight upload or tester invitation. A first-time non-interactive credential setup may still need an authorized Apple team member to finish provisioning in Expo.

This representative workflow is on `codex/current-app-ota`. If the Apple team can provide the key, the same workflow can be applied to the other two release branches. It runs only when a pushed commit message starts with `Release TestFlight:` and does not run on ordinary pushes. No Apple or Expo credential belongs in Git, chat, or app code.

## Private setup

1. Rotate any Apple password previously shared in chat.
2. In [App Store Connect](https://appstoreconnect.apple.com/), an Account Holder or Admin opens **Users and Access → Integrations → App Store Connect API → Team Keys**, creates a key with **Admin** access, and downloads its `.p8` file. Apple permits downloading that private key only once. Team keys can act across all apps in the Apple team, so revoke this temporary key when the builds are complete if it is no longer needed.
3. In the `londof` [Expo dashboard](https://expo.dev/), create an access token for the project. Treat it as a password and revoke it when the release is complete if it is no longer needed.
4. In this GitHub repository's **Settings → Secrets and variables → Actions**, create these repository **secrets**: `EXPO_TOKEN` (Expo token), `APPLE_ASC_KEY_ID` (Apple Key ID), `APPLE_ASC_ISSUER_ID` (Apple Issuer ID), and `APPLE_ASC_TEAM_KEY_P8` (the complete downloaded `.p8` text). Create repository **variable** `APPLE_TEAM_TYPE` with `COMPANY_OR_ORGANIZATION` or `INDIVIDUAL`, matching the Apple Developer membership. Do not paste any of these values in chat.
5. An authorized repo writer can push a deliberately empty commit with a message such as `Release TestFlight: current-app-ota` to the intended branch. The guarded workflow validates dependencies, runs tests, and requests an EAS iOS store build using the matching `testflight` profile. The GitHub Actions run shows whether Apple accepts the API key and creates the necessary signing credentials.

An App Store Connect app record and EAS Submit setup are still needed before TestFlight distribution. Non-interactive EAS Submit requires that app's numeric `ascAppId`; do not claim a phone-installable link until Apple processes the upload and a tester invitation or public TestFlight link is verified.

Sources: [Expo Apple credentials and API token option](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/), [Expo CI environment variables](https://docs.expo.dev/build/building-on-ci/), [Apple API key creation and scope](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/), [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [Expo iOS submission](https://docs.expo.dev/submit/ios/).
