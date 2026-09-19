# BIOPHLX UI theme

The attached BIOPHLX Light and Dark reference defines the visual direction: red primary actions, neutral light surfaces, charcoal dark surfaces, white primary-button labels and a clear card hierarchy. Device appearance controls light/dark mode through useColorScheme. Navigation, customer/trainer screens, forms, setup modals and rating cards use the shared theme.

BIOPHLXTokens.js contains the palette and the compatibility mapping for existing styles. BIOPHLXTheme.js adapts StyleSheet and inline styles. BrandButton supplies consistent 48-point minimum touch targets, rounded corners, disabled feedback and accessible button labels. Status colors and anatomy illustration skin tones are preserved. Placement modals now use the light/dark photos extracted from the reference PDF, with mirrored combined placement for the left side.

Validation: nine rating/theme regression tests passed, including normal-text contrast for the palette. Browser preview built successfully with existing duplicate-style warnings. Six customer screens rendered in both modes; simulated band placement and per-band rating flows completed in both modes. Source syntax checks passed. Native mobile rendering, the native message sheet, Bluetooth and production accounts were not exercised by the browser preview.

Preview artifacts are in outputs/BIOPHLX-theme in the parent workspace. See docs/testing for the latest integration results and remaining release blockers.
