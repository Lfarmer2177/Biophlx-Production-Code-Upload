// The checked-in app.json remains the source of truth for normal builds.
// This profile creates a separately installable TestFlight app for this branch.
const BRANCH = 'proposed-app-current-firmware';
const TESTFLIGHT_BUNDLE_ID = 'com.londof.biophlxAppTestAWS.proposedcurrent';
const TESTFLIGHT_NAME = 'BIOPHLX Proposed';

module.exports = ({ config }) => {
  const requested = process.env.BIOPHLX_TESTFLIGHT_VARIANT;
  if (requested && requested !== BRANCH) {
    throw new Error(`This checkout is ${BRANCH}; refusing to build ${requested}.`);
  }
  const testflight = requested === BRANCH;
  return {
    ...config,
    name: testflight ? TESTFLIGHT_NAME : config.name,
    ios: {
      ...config.ios,
      bundleIdentifier: testflight ? TESTFLIGHT_BUNDLE_ID : config.ios.bundleIdentifier,
    },
    extra: {
      ...config.extra,
      buildVariant: BRANCH,
      testflightVariant: testflight,
    },
  };
};
