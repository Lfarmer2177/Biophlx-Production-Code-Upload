# BIOPHLX three-second hold and set progression

The app follows the Gen3 firmware button behavior: while exercising, hold each
band's center button for three seconds to complete its set, reset its rep count,
and advance to the next set. Release after the vibration. Each band advances
independently; the runner shows both set numbers and prompts for the other band
when they differ. Use **End Workout** in the app to stop both bands.

The firmware's completed-set counter starts at zero. The app displays and saves
the current set as that counter plus one. A set notification clears the previous
rep readings atomically, and rep tracking includes the set counter so separate
notifications or batched renders cannot duplicate the last rep. Both-band ratings
pair by exercise run, set, and rep. Set summaries wait for both bands, include only
their own reps, and wait for rep persistence before writing the set record.

The countdown implementation is unchanged. No firmware was modified or flashed.

## Verification

- `node --test tests/*.test.cjs`: 19 passed, including seven firmware counter and
  packet-sequence regression tests.
- JavaScript/JSX parsing and existing source checks passed.
- Browser demo build passed (existing duplicate-style-key warnings remain).
- Five browser workflow checks passed against the app screens with simulated BLE
  and AWS: initial set 1, independently advancing bands, reset to set 2 rep 1,
  reverse band arrival to set 3, and ending with the app control.
- Saved mock rep identities were `(set 1, rep 1)`, `(set 1, rep 2)`,
  `(set 2, rep 1)`, and `(set 3, rep 1)`, with two band snapshots per rep.
  Set summaries 1 and 2 remained separate. No browser runtime errors occurred.

For an interactive local check, run `review-demo/Build-Demo.ps1`, start
`node review-demo/full-serve.cjs`, and open `http://127.0.0.1:4174`. Connect both
demo bands, start an exercise, record sample reps, and use each band's
**Simulate 3-second hold** control. These controls simulate firmware notifications;
physical button timing, vibration, and live AWS integration were not retested.
