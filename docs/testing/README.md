# BIOPHLX validation - September 19, 2026

12 unit tests and 31 browser checks passed. Live AWS checks: 38 passed, 2 failed, both related to standalone exercise persistence. Browser services are simulated; live AWS calls were tested separately. See the PDF and structured results for details.

## Outstanding release blockers

Standalone exercises send a null workout_id; the session-item resolver writes this into an indexed attribute and the mutation returns null. Historical exercise readback fails. The correction has been proposed but is NOT implemented in this commit.

Checkout requires server-side price lookup and authenticated buyer identification. Native mobile/BLE, real signup/reset email delivery, and Stripe sandbox checkout/webhook/entitlement tests remain outstanding.

The nullable band_metrics schema/resolver extension was previously applied to AWS. It does not fix the separate session-item save issue. This branch is not a production-release approval.
