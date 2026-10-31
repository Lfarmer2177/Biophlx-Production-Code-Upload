const { test } = require('node:test');
const assert = require('node:assert/strict');
const config = require('../app.config.js');
const app = require('../app.json').expo;
const eas = require('../eas.json');

test('default build keeps the existing app identity', () => {
  const prior = process.env.BIOPHLX_TESTFLIGHT_VARIANT;
  delete process.env.BIOPHLX_TESTFLIGHT_VARIANT;
  try {
    const result = config({ config: app });
    assert.equal(result.ios.bundleIdentifier, app.ios.bundleIdentifier);
    assert.equal(result.name, app.name);
  } finally {
    if (prior === undefined) delete process.env.BIOPHLX_TESTFLIGHT_VARIANT;
    else process.env.BIOPHLX_TESTFLIGHT_VARIANT = prior;
  }
});

test('TestFlight profile selects this branch and a separate iOS app', () => {
  const expected = eas.build.testflight.env.BIOPHLX_TESTFLIGHT_VARIANT;
  const prior = process.env.BIOPHLX_TESTFLIGHT_VARIANT;
  process.env.BIOPHLX_TESTFLIGHT_VARIANT = expected;
  try {
    const result = config({ config: app });
    assert.equal(result.extra.buildVariant, expected);
    assert.equal(result.ios.bundleIdentifier, 'com.londof.biophlxAppTestAWS.proposedfuture');
    assert.equal(result.name, 'BIOPHLX Future');
    assert.equal(eas.build.testflight.distribution, 'store');
    assert.equal(eas.build.testflight.env.EXPO_PUBLIC_ENABLE_OTA_PILOT, 'false');
  } finally {
    if (prior === undefined) delete process.env.BIOPHLX_TESTFLIGHT_VARIANT;
    else process.env.BIOPHLX_TESTFLIGHT_VARIANT = prior;
  }
});

test('wrong branch cannot silently produce the wrong binary', () => {
  const prior = process.env.BIOPHLX_TESTFLIGHT_VARIANT;
  process.env.BIOPHLX_TESTFLIGHT_VARIANT = 'current-app-ota';
  try { assert.throws(() => config({ config: app }), /refusing to build/); }
  finally {
    if (prior === undefined) delete process.env.BIOPHLX_TESTFLIGHT_VARIANT;
    else process.env.BIOPHLX_TESTFLIGHT_VARIANT = prior;
  }
});
