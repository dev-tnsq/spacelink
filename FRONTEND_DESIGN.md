# Frontend Design Notes — Marketplace & Operator Pages

This document summarizes research and a recommended approach for the three main frontend pages you requested:

- Satellite Operator (register satellites)
- Ground Station / Node Operator (register ground stations)
- Marketplace (interactive globe + left-side models/list)

## Research — How other projects build globe UIs

1. **Globe.gl / react-globe.gl**
   - High-level library specialized for globes, markers, arcs, and automatic lat/lon placement.
   - Good for rapid prototyping and production-ready globe visuals.
   - Pros: Easy to use, many features out of the box.
   - Cons: Adds a dependency and limited three.js low-level control.

2. **Three.js + react-three-fiber + drei**
   - Low-level control with best graphics quality and flexibility.
   - Build a textured sphere (Earth) and custom markers, labels and animations.
   - Pros: Full control, integrates with existing r3f code in repo.
   - Cons: More coding required for features like arcs and clustering.

3. **Mapbox / Cesium / Kepler**
   - Heavyweight mapping/3D solutions with geospatial features and tiles.
   - Pros: Built-in global tiling, terrain, imagery.
   - Cons: Overkill for a stylized globe experience; licensing costs.

**Recommendation:** Use react-three-fiber (r3f) + drei (already in repo). The repo already contains useful GL building blocks and shaders that match the project's aesthetic.

If you need exact feature parity with Cesium (terrain tiles, OSM basemaps, huge datasets), we can migrate to Cesium/Resium later. For the MVP and DataFast-like visual style the r3f-based globe provides better design control and lighter-weight integration.

## UI Pattern — DataFast Globe (inspiration)

Key pieces to emulate:

- Full-screen or large central globe.
- Left-side column listing stations (models) and satellites.
- Interactivity: hover a list item → highlight marker on globe; click marker → open detail panel.
- Quick filters and search in the left column.
- Simple booking CTA in details panel.

## Minimal MVP Implementation Plan

1. **Marketplace Page**
   - Left column: `MarketplaceSidebar` showing nodes and satellites (read from contract)
   - Center: `MarketplaceGlobe` (r3f Canvas) rendering Earth and markers
   - Right or bottom: details area when an item is selected
   - Data flow: read-only provider -> contract.nodeCount() -> contract.getNode(i)

2. **Satellite Operator Page**
   - `SatelliteForm` for TLE lines + IPFS CID
   - Connect wallet → call `registerSatellite` with `value = STAKE_AMOUNT`
   - Basic client-side TLE format validation

3. **Node Operator Page**
   - `NodeForm` with lat/lon or "Use my location" button
   - Specs + uptime + IPFS CID
   - Convert lat/lon to scaled integers for contract

## UX Considerations

- Provide clear tooltips explaining the 24-hour dispute window and verification model.
- Use skeleton loaders when fetching node/satellites from chain.
- Show transaction progress messages when registering or booking passes.
- Allow submission of IPFS metadata by uploading files (optional enhancement).

## Next Steps for Polishing

- Add event listeners for `NodeRegistered` and `SatelliteRegistered` to auto-refresh UI.
- Add pagination and clustering for large numbers of nodes.
- Add animation for arcs showing booked passes.
- Add booking flow with payment and modal confirmation.
- Add reputation/staking UI and admin moderation tools.

## References
- Globe.gl (https://github.com/vasturiano/globe.gl)
- react-three-fiber (https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
- three.js/examples (globe and marker examples)
- CelesTrak (TLE sources)

