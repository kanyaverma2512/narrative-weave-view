# Polish the existing TRENDLY dashboard

## Scope
- Preserve the current layout, navigation, datasets, filters, and interactions.
- Refine the India map with clearer translucent activity tiers, crisp luminous boundaries, legible markers and labels, and persistent hover/selected feedback.
- Apply restrained depth and edge lighting to existing cards, controls, active navigation, and charts without turning the full interface neon.
- Keep effects lightweight, responsive, and reduced-motion friendly.

## Implementation
- Extend the semantic design tokens for map-active cyan, map-important amber, map-critical red, surface highlights, and restrained shadows.
- Update the existing SVG map paths and markers only; derive color states from current activity, sentiment, and selection data.
- Add reusable surface polish through the existing global utilities and button variants, avoiding layout changes.
- Verify the Geo Intelligence page and representative dashboard views at desktop and mobile sizes, then check the current build status.
