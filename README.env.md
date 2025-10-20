Environment variables

- NEXT_PUBLIC_CESIUM_ION_TOKEN: Your Cesium Ion access token. Paste it into `.env.local` at the project root.

How to run

1. Install dependencies: `pnpm install` or `yarn`
2. Create `.env.local` and add `NEXT_PUBLIC_CESIUM_ION_TOKEN=your_token`
3. Run the dev server: `yarn dev`

Notes

- The Cesium globe component reads the token from `process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN` or from the component `globeOptions.ionToken` prop. Setting the env value is the usual approach.
