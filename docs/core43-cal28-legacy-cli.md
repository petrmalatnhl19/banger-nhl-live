# CAL-28D — Legacy CLI bypass disabled (partial)

The direct command-line invocation of `scripts/core43_cal24_pin.cjs` now fails closed with `cal28d_legacy_cli_disabled_use_cal28_approved`. The evidence-gated CLI is `scripts/core43_cal28_approved.cjs`, which requires a receiver-controlled archive root.

**Not yet complete:** The exported JavaScript `advancePin()` function remains callable without archive verification (and is used by existing synthetic CAL-24/26 tests). Therefore CAL27-03 is **not closed** and this does **not** establish a mandatory archive gate across every code path. The next refactor must move evidence validation under the same exclusive writer lock and remove the ungated exported advancement interface, while updating synthetic tests to use valid CAL-18B archives. Keep the pilot NO-GO.
