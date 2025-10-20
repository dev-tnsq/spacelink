"use client"

import React, { useEffect, useRef, useState } from "react";
import { useAppData } from "./context/AppDataContext";

// This component loads Cesium and satellite.js from CDN and renders a viewer.
// It keeps an in-memory mapping of entities for nodes & satellites and updates them when AppData changes.

// The Cesium Globe API has a number of appearance & behavior knobs — see
// https://cesium.com/learn/ion-sdk/ref-doc/Globe.html for details. We expose a
// tiny subset via `globeOptions` and apply settings defensively (try/catch)
// because the viewer is loaded from the CDN and the runtime may vary.
export default function CesiumGlobe({ className, onSelect, globeOptions, dataMode }: { className?: string; onSelect?: (id: string) => void; dataMode?: 'nodes' | 'satellites' | 'both'; globeOptions?: { baseColor?: string; enableLighting?: boolean; showGroundAtmosphere?: boolean; showWaterEffect?: boolean; depthTestAgainstTerrain?: boolean; useWorldImagery?: boolean; useWorldTerrain?: boolean; ionToken?: string; initialView?: { lat?: number; lon?: number; height?: number }; showOrbitPaths?: boolean; showGroundTrack?: boolean; showNodeCoverage?: boolean; trackOnSelect?: boolean; orbitDurationMinutes?: number; orbitSampleSeconds?: number; defaultNodeCoverageMeters?: number; } }) {
  // dataMode: controls which dataset to visualize. 'nodes' renders only ground stations,
  // 'satellites' renders only satellites, 'both' renders both (default).
  const renderMode = dataMode ?? 'both';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Advanced visualization toggles. We use refs so the closures inside the
  // init() function can read the latest value even though they run inside
  // the long-lived Cesium viewer lifecycle.
  const [showOrbits, setShowOrbits] = useState<boolean>(globeOptions?.showOrbitPaths ?? true);
  const showOrbitsRef = useRef(showOrbits);
  useEffect(() => { showOrbitsRef.current = showOrbits; }, [showOrbits]);

  const [showGroundTracks, setShowGroundTracks] = useState<boolean>(globeOptions?.showGroundTrack ?? true);
  const showGroundTracksRef = useRef(showGroundTracks);
  useEffect(() => { showGroundTracksRef.current = showGroundTracks; }, [showGroundTracks]);

  const [showCoverage, setShowCoverage] = useState<boolean>(globeOptions?.showNodeCoverage ?? true);
  const showCoverageRef = useRef(showCoverage);
  useEffect(() => { showCoverageRef.current = showCoverage; }, [showCoverage]);

  const [trackOnSelect, setTrackOnSelect] = useState<boolean>(globeOptions?.trackOnSelect ?? true);
  const trackOnSelectRef = useRef(trackOnSelect);
  useEffect(() => { trackOnSelectRef.current = trackOnSelect; }, [trackOnSelect]);

  const [terrainEnabled, setTerrainEnabled] = useState<boolean>(globeOptions?.useWorldTerrain ?? false);
  const terrainEnabledRef = useRef(terrainEnabled);
  useEffect(() => { terrainEnabledRef.current = terrainEnabled; }, [terrainEnabled]);

  // Orbit sampling defaults
  const orbitDurationMinutes = globeOptions?.orbitDurationMinutes ?? 90;
  const orbitSampleSeconds = globeOptions?.orbitSampleSeconds ?? 30;
  const { nodes, satellites } = useAppData();

  useEffect(() => {
    // Inject Cesium CSS if not already present
    const CESIUM_VERSION = "1.119";
    const widgetsCss = `https://unpkg.com/cesium@${CESIUM_VERSION}/Build/Cesium/Widgets/widgets.css`;
    if (!document.querySelector(`link[href*="/Cesium/Widgets/widgets.css"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = widgetsCss;
      document.head.appendChild(link);
    }

    // Helper to load an external script once with verbose diagnostics.
    // Returns when the script is loaded or rejects with details on failure.
    function loadScriptOnce(src: string) {
      return new Promise<void>((resolve, reject) => {
        try {
          const existing = document.querySelector(`script[src="${src}"]`);
          if (existing) {
            console.info(`Script already present: ${src}`);
            // If it already exists, wait a tick to allow any global to attach
            return setTimeout(resolve, 0);
          }
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.onload = () => {
            console.info(`Loaded script: ${src}`);
            resolve();
          };
          s.onerror = (ev) => {
            const msg = `Failed to load script ${src}`;
            console.error(msg, ev);
            reject(new Error(msg));
          };
          // Helpful attributes for some CDNs
          s.crossOrigin = "anonymous";
          document.body.appendChild(s);
        } catch (e) {
          reject(e);
        }
      });
    }

    async function init() {
      try {
        // Load Cesium and satellite.js. Try multiple CDNs to be resilient
        // against transient CDN or network issues.
        const cesiumCandidates = [
          `https://unpkg.com/cesium@${CESIUM_VERSION}/Build/Cesium/Cesium.js`,
          `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/Cesium.js`,
          `https://cdn.jsdelivr.net/gh/CesiumGS/cesium@${CESIUM_VERSION}/Build/Cesium/Cesium.js`,
        ];
        const satJsCandidates = [
          `https://unpkg.com/satellite.js/dist/satellite.min.js`,
          `https://cdn.jsdelivr.net/npm/satellite.js/dist/satellite.min.js`,
        ];

        // Try to load the first successful candidate for Cesium
        let cesiumLoaded = false;
        let lastCesiumErr: any = null;
        for (const url of cesiumCandidates) {
          try {
            await loadScriptOnce(url);
            // Small delay to allow globals to attach
            await new Promise((r) => setTimeout(r, 50));
            if ((window as any).Cesium) { cesiumLoaded = true; break; }
          } catch (e) { lastCesiumErr = e; console.warn('Cesium candidate failed:', url, e); }
        }

        let satelliteLoaded = false;
        for (const url of satJsCandidates) {
          try {
            await loadScriptOnce(url);
            await new Promise((r) => setTimeout(r, 20));
            if ((window as any).satellite) { satelliteLoaded = true; break; }
          } catch (e) { console.warn('satellite.js candidate failed:', url, e); }
        }

        if (!cesiumLoaded) {
          console.error('All Cesium CDN candidates failed to load', lastCesiumErr);
        }

        const Cesium = (window as any).Cesium;
        const satellite = (window as any).satellite;
        if (!Cesium) {
          console.error("Cesium failed to load from CDN");
          setLoadError("Cesium failed to load from the CDN");
          setLoading(false);
          return;
        }

        // Basic viewer setup
        if (!viewerRef.current && containerRef.current) {
          // Configure base URL so Cesium can find its static assets when served from the CDN
          try { (Cesium as any).buildModuleUrl.setBaseUrl(`https://unpkg.com/cesium@${CESIUM_VERSION}/Build/Cesium/`); } catch {}

          // Prefer Cesium World Imagery + Terrain if an Ion token is available
          // and the caller opts in. Otherwise fall back to OpenStreetMap tiles.
          const ionToken = globeOptions?.ionToken ?? (process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN as string | undefined);
          if (ionToken) {
            try {
              // Let the runtime know about the token before calling createWorld* helpers
              try { Cesium.Ion.defaultAccessToken = ionToken; } catch (e) {}
            } catch (e) {}
          }

          let imageryProvider: any = undefined;
          try {
            if (ionToken && (globeOptions?.useWorldImagery ?? true) && typeof Cesium.createWorldImagery === "function") {
              imageryProvider = Cesium.createWorldImagery();
            }
          } catch (e) { imageryProvider = undefined; }
          if (!imageryProvider) {
            imageryProvider = new Cesium.OpenStreetMapImageryProvider({ url: "https://a.tile.openstreetmap.org/" });
          }

          const viewerInitOptions: any = {
            imageryProvider,
            baseLayerPicker: false,
            timeline: false,
            animation: false,
            geocoder: false,
            infoBox: true,
            sceneModePicker: false,
            homeButton: true,
            selectionIndicator: true,
          };

          // If requested and available, enable Cesium World Terrain (requires Ion token)
          try {
            if (ionToken && globeOptions?.useWorldTerrain && typeof Cesium.createWorldTerrain === "function") {
              viewerInitOptions.terrainProvider = Cesium.createWorldTerrain({ requestVertexNormals: true, requestWaterMask: true });
            }
          } catch (e) {}

          viewerRef.current = new Cesium.Viewer(containerRef.current, viewerInitOptions);

          // If we have an Ion token and the caller wanted world imagery/terrain,
          // try to force-add them to ensure the globe shows real Earth textures
          try {
            if (ionToken) {
              try {
                // Ensure Cesium knows the token (redundant but defensive)
                Cesium.Ion.defaultAccessToken = ionToken;
              } catch (e) {}

              // Force-add world imagery provider if requested
              if (globeOptions?.useWorldImagery && typeof Cesium.createWorldImagery === 'function') {
                try {
                  // Remove any placeholder imagery layers and add Cesium World Imagery
                  try { viewerRef.current.scene.imageryLayers.removeAll(); } catch (e) {}
                  viewerRef.current.scene.imageryLayers.addImageryProvider(Cesium.createWorldImagery());
                } catch (e) {
                  console.warn('Failed to add Cesium World Imagery provider:', e);
                }
              }

              // Force-enable Cesium World Terrain if requested
              if (globeOptions?.useWorldTerrain && typeof Cesium.createWorldTerrain === 'function') {
                try {
                  viewerRef.current.terrainProvider = Cesium.createWorldTerrain({ requestVertexNormals: true, requestWaterMask: true });
                } catch (e) {
                  console.warn('Failed to enable Cesium World Terrain:', e);
                }
              }
            }
          } catch (e) {}
          // Extra diagnostics: list imagery layers/providers and ensure at least
          // one imagery layer exists. In some environments the Viewer may be
          // constructed without visible base layers; try to add our prepared
          // imageryProvider and finally fall back to OpenStreetMap.
          try {
            const layers = viewerRef.current.scene.imageryLayers;
            const getLength = (col: any) => (typeof col?.length === 'number' ? col.length : (col && col._layers ? col._layers.length : 0));
            const len = getLength(layers);
            const providers: any[] = [];
            for (let i = 0; i < len; i++) {
              try {
                const layer = typeof layers.get === 'function' ? layers.get(i) : layers._layers && layers._layers[i];
                const providerName = layer && layer.imageryProvider && layer.imageryProvider.constructor && layer.imageryProvider.constructor.name;
                providers.push({ i, providerName });
              } catch (e) {}
            }
            console.info('Cesium imageryLayers count:', len, 'providers:', providers);

            // If there are no imagery layers, attempt to add the imageryProvider
            // we prepared earlier. If that fails, add OpenStreetMap as a final
            // fallback so the globe shows tiles instead of the blue fallback.
            if (len === 0) {
              try {
                console.info('No imagery layers found; attempting to add prepared imagery provider', imageryProvider && imageryProvider.constructor && imageryProvider.constructor.name);
                if (imageryProvider) {
                  viewerRef.current.scene.imageryLayers.addImageryProvider(imageryProvider);
                } else {
                  const osmProv = new Cesium.OpenStreetMapImageryProvider({ url: "https://a.tile.openstreetmap.org/" });
                  viewerRef.current.scene.imageryLayers.addImageryProvider(osmProv);
                }
              } catch (e) {
                console.error('Failed to add fallback imagery provider:', e);
              }

              // Recount and log providers after attempting fallback
              try {
                const layers2 = viewerRef.current.scene.imageryLayers;
                const len2 = getLength(layers2);
                const provs: any[] = [];
                for (let i = 0; i < len2; i++) {
                  try {
                    const layer = typeof layers2.get === 'function' ? layers2.get(i) : layers2._layers && layers2._layers[i];
                    provs.push(layer && layer.imageryProvider && layer.imageryProvider.constructor && layer.imageryProvider.constructor.name);
                  } catch (e) {}
                }
                console.info('After fallback, imageryLayers count:', len2, 'providers:', provs);
              } catch (e) {}
            }
          } catch (e) { console.error('Imagery diagnostics failed:', e); }

          // Apply some conservative, visually pleasing globe defaults. Guard
          // each assignment so older/newer Cesium builds won't throw here.
          try {
            const g = viewerRef.current.scene.globe as any;
            // Lighting — gives day/night shading
            if (typeof g.enableLighting !== "undefined") g.enableLighting = globeOptions?.enableLighting ?? true;
            // Base color tint for oceans/areas without imagery
            if (typeof g.baseColor !== "undefined" && globeOptions?.baseColor) {
              try { g.baseColor = Cesium.Color.fromCssColorString(globeOptions.baseColor); } catch {}
            }
            // Show subtle ground atmosphere near the horizon where supported
            if (typeof g.showGroundAtmosphere !== "undefined") g.showGroundAtmosphere = globeOptions?.showGroundAtmosphere ?? true;
            // Water effect (reflection) — only set if available
            if (typeof g.showWaterEffect !== "undefined" && typeof globeOptions?.showWaterEffect !== 'undefined') g.showWaterEffect = !!globeOptions?.showWaterEffect;
            // Depth-test entities against terrain when terrain is enabled
            try { (viewerRef.current.scene as any).globeDepthTestAgainstTerrain = globeOptions?.depthTestAgainstTerrain ?? true; } catch {}
          } catch (e) {}

          // Diagnostic logs to help debug imagery/terrain loading issues
          try {
            console.info('Cesium init: ionToken present?', !!ionToken, 'useWorldImagery?', globeOptions?.useWorldImagery, 'useWorldTerrain?', globeOptions?.useWorldTerrain);
          } catch (e) {}

          // If we're not using Cesium Ion world imagery/terrain, hide the credit
          // container for the demo. If using Ion assets leave credits visible.
          try {
            if (!ionToken) viewerRef.current.cesiumWidget.creditContainer.style.display = "none";
          } catch (e) {}

          // Apply a dramatic initial view so the user sees the globe as a whole.
          try {
            const init = globeOptions?.initialView;
            const lat = init?.lat ?? 20;
            const lon = init?.lon ?? 0;
            const height = init?.height ?? 20000000; // 20,000 km to see whole globe
            try { viewerRef.current.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, height), orientation: { heading: 0.0, pitch: -0.2, roll: 0.0 } }); } catch (e) {}
          } catch (e) {}

          // Ensure a pleasant sky / atmosphere background
          try {
            viewerRef.current.scene.backgroundColor = Cesium.Color.fromCssColorString("#000000");
            if (viewerRef.current.scene.skyAtmosphere) viewerRef.current.scene.skyAtmosphere.show = globeOptions?.showGroundAtmosphere ?? true;
          } catch (e) {}

          // Apply a natural 'Earth' visual treatment so imagery looks warm
          // and natural (ocean blues, green land tones). Restore higher
          // saturation/brightness values to make the globe appear like
          // daytime Earth imagery, similar to the provided screenshot.
          try {
            const layers = viewerRef.current.scene.imageryLayers;
            const getLength = (col: any) => (typeof col?.length === 'number' ? col.length : (col && col._layers ? col._layers.length : 0));
            const len = getLength(layers);
            for (let i = 0; i < len; i++) {
              try {
                const layer = typeof layers.get === 'function' ? layers.get(i) : layers._layers && layers._layers[i];
                if (!layer) continue;
                // Make land colors pop while preserving water tones
                if (typeof layer.brightness !== 'undefined') layer.brightness = 1.06;
                if (typeof layer.contrast !== 'undefined') layer.contrast = 1.06;
                // Increase saturation slightly; if provider supports colorCorrection use that
                if (typeof layer.saturation !== 'undefined') layer.saturation = 1.15;
                // Some imagery providers expose a colorToAlpha or colorCorrection object
                // We attempt a gentle green boost via colorCorrection where available.
                try {
                  if (layer.colorCorrection && typeof layer.colorCorrection === 'object') {
                    layer.colorCorrection.contrast = layer.colorCorrection.contrast ?? 1.04;
                    layer.colorCorrection.saturation = layer.colorCorrection.saturation ?? 1.12;
                  }
                } catch (e) {}
              } catch (e) {}
            }
            try { viewerRef.current.scene.globe.baseColor = Cesium.Color.fromCssColorString("#dfeffb"); } catch (e) {}
            // Slight sky/atmosphere tweaks for a warmer horizon
            try {
              if (viewerRef.current.scene.skyAtmosphere) {
                try { viewerRef.current.scene.skyAtmosphere.hueShift = -0.02; } catch (e) {}
                try { viewerRef.current.scene.skyAtmosphere.brightnessShift = 0.02; } catch (e) {}
              }
            } catch (e) {}
            console.info('Applied Earth theme to imagery layers (brightness~1.03, saturation~1.05)');
          } catch (e) { console.warn('Failed to apply Earth theme to imagery layers', e); }
        }

        const viewer = viewerRef.current;

        // Map to keep track of entity ids we created
        const createdIds = new Set<string>();

        function addOrUpdateNode(n: any) {
          createdIds.add(n.id);
          const existing = viewer.entities.getById(n.id);
          const pos = Cesium.Cartesian3.fromDegrees(n.lon, n.lat, 0);
          if (existing) {
            existing.position = pos;
            existing.label && (existing.label.text = n.name || "Ground Station");
            existing.description = `${n.description ?? ""}`;
          } else {
            viewer.entities.add({
              id: n.id,
              name: n.name,
              position: pos,
              point: {
                pixelSize: 12,
                color: Cesium.Color.ORANGE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              },
              label: {
                text: n.name,
                font: "12px system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue'",
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                pixelOffset: new Cesium.Cartesian2(0, -18),
              },
              description: `${n.specs ?? ""}\n${n.description ?? ""}`,
            });
          }
          // Coverage ellipse (approximate)
          try {
            const covId = `${n.id}_coverage`;
            const showCov = showCoverageRef.current;
            if (!showCov) {
              const ex = viewer.entities.getById(covId);
              if (ex) viewer.entities.remove(ex);
            } else {
              // default coverage radius, configurable via globeOptions
              const radius = (globeOptions as any)?.defaultNodeCoverageMeters ?? 300000; // 300 km
              const existingCov = viewer.entities.getById(covId);
              if (existingCov) {
                existingCov.position = pos;
                try { existingCov.ellipse.semiMajorAxis = radius; } catch (e) {}
                existingCov.show = true;
                try { if (existingCov.ellipse) existingCov.ellipse.outline = false; } catch (e) {}
              } else {
                // Outlines are unsupported on terrain; avoid enabling outline to prevent runtime warnings
                viewer.entities.add({ id: covId, position: pos, ellipse: { semiMajorAxis: radius, semiMinorAxis: radius, material: Cesium.Color.ORANGE.withAlpha(0.12), outline: false }, name: `${n.name} coverage` });
                createdIds.add(covId);
              }
            }
          } catch (e) {}
        }

        function computeSatPosition(tle1: string, tle2: string, when?: Date) {
          try {
            if (!satellite) return null;
            const satrec = satellite.twoline2satrec(tle1, tle2);
            const now = when ?? new Date();
            const posVel = satellite.propagate(satrec, now);
            if (!posVel || !posVel.position) return null;
            const gmst = satellite.gstime(now);
            const geo = satellite.eciToGeodetic(posVel.position, gmst);
            const lat = satellite.degreesLat(geo.latitude);
            const lon = satellite.degreesLong(geo.longitude);
            const height = geo.height * 1000; // kilometers -> meters
            return { lat, lon, height };
          } catch (e) {
            return null;
          }
        }

        function addOrUpdateSat(s: any) {
          createdIds.add(s.id);
          const existing = viewer.entities.getById(s.id);

          // Use a CallbackProperty so Cesium can update position over time
    const positionCallback = new Cesium.CallbackProperty((time: any) => {
            const p = computeSatPosition(s.tle1, s.tle2);
            if (!p) return null;
            return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, Math.max(p.height, 200000));
          }, false);

          if (existing) {
            existing.position = positionCallback;
            existing.label && (existing.label.text = s.name ?? s.id);
            existing.description = `TLE:\n${s.tle1}\n${s.tle2}`;
          } else {
            viewer.entities.add({
              id: s.id,
              name: s.name ?? s.id,
              position: positionCallback,
              billboard: {
                image: undefined,
              },
              point: {
                pixelSize: 8,
                color: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
              },
              label: {
                text: s.name ?? s.id,
                font: "11px system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue'",
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                pixelOffset: new Cesium.Cartesian2(0, -14),
              },
              description: `TLE:\n${s.tle1}\n${s.tle2}`,
            });
          }
          // Orbit path (static sample for next N minutes)
          try {
            const orbitId = `${s.id}_orbit`;
            const showOrbit = showOrbitsRef.current;
            if (!showOrbit) {
              const ex = viewer.entities.getById(orbitId);
              if (ex) viewer.entities.remove(ex);
            } else {
              const positions: any[] = [];
              const now = new Date();
              for (let dt = 0; dt <= orbitDurationMinutes * 60; dt += orbitSampleSeconds) {
                const when = new Date(now.getTime() + dt * 1000);
                const p = computeSatPosition(s.tle1, s.tle2, when);
                if (!p) continue;
                positions.push(Cesium.Cartesian3.fromDegrees(p.lon, p.lat, Math.max(p.height, 200000)));
              }
              const existingOrbit = viewer.entities.getById(orbitId);
              if (existingOrbit) {
                existingOrbit.polyline.positions = positions;
                existingOrbit.show = true;
              } else {
                viewer.entities.add({ id: orbitId, polyline: { positions, width: 1.5, material: Cesium.Color.YELLOW.withAlpha(0.6), clampToGround: false } });
                createdIds.add(orbitId);
              }
            }
          } catch (e) {}

          // Ground track projection
          try {
            const groundId = `${s.id}_groundtrack`;
            const showGT = showGroundTracksRef.current;
            if (!showGT) {
              const ex = viewer.entities.getById(groundId);
              if (ex) viewer.entities.remove(ex);
            } else {
              const positions2: any[] = [];
              const now = new Date();
              for (let dt = 0; dt <= orbitDurationMinutes * 60; dt += orbitSampleSeconds) {
                const when = new Date(now.getTime() + dt * 1000);
                const p = computeSatPosition(s.tle1, s.tle2, when);
                if (!p) continue;
                positions2.push(Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 1000));
              }
              const existingGT = viewer.entities.getById(groundId);
              if (existingGT) {
                existingGT.polyline.positions = positions2;
                existingGT.show = true;
              } else {
                viewer.entities.add({ id: groundId, polyline: { positions: positions2, width: 2, material: Cesium.Color.CYAN.withAlpha(0.5), clampToGround: false } });
                createdIds.add(groundId);
              }
            }
          } catch (e) {}
        }

        function refreshAll() {
          // Remove any entities we created that are no longer in the dataset
          // Keep base entity ids plus the derived visualization ids we create
          const idsToKeep = new Set([
            ...nodes.map((n: any) => n.id),
            ...satellites.map((s: any) => s.id),
            ...satellites.map((s: any) => `${s.id}_orbit`),
            ...satellites.map((s: any) => `${s.id}_groundtrack`),
            ...nodes.map((n: any) => `${n.id}_coverage`),
          ]);
          viewer.entities.values.slice().forEach((ent: any) => {
            if (ent.id && typeof ent.id === "string" && !idsToKeep.has(ent.id)) {
              viewer.entities.remove(ent);
            }
          });

          // Add or update nodes (if requested)
          if (renderMode === 'both' || renderMode === 'nodes') {
            nodes.forEach((n: any) => addOrUpdateNode(n));
          }

          // Add or update satellites (if requested)
          if (renderMode === 'both' || renderMode === 'satellites') {
            satellites.forEach((s: any) => addOrUpdateSat(s));
          }
        }

  // Initial refresh
  refreshAll();
  setLoading(false);

        // Refresh whenever the datasets change
        const nodesTimer = setInterval(() => refreshAll(), 2500);

        // Allow clicking on entities to zoom and open info box
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        handler.setInputAction(function (click: any) {
          const picked = viewer.scene.pick(click.position);
          if (Cesium.defined(picked) && picked.id) {
            const entity = picked.id;
            try {
              viewer.selectedEntity = entity;
              const idStr = String(entity.id ?? "");
              // If this is a satellite entry, fly to its current position and
              // optionally track it.
              if (idStr.startsWith("sat_")) {
                try {
                  const pos = entity.position && entity.position.getValue(new Date());
                  if (pos) {
                    viewer.camera.flyTo({ destination: pos });
                  }
                } catch (e) {}
                try {
                  if (trackOnSelectRef.current) viewer.trackedEntity = entity;
                } catch (e) {}
              } else if (idStr.startsWith("node_")) {
                // For a node, sample terrain (if available) and fly above terrain
                try {
                  const node = nodes.find((n: any) => n.id === idStr);
                  const lon = node?.lon ?? undefined;
                  const lat = node?.lat ?? undefined;
                  if (typeof lon !== "undefined" && typeof lat !== "undefined") {
                    const carto = Cesium.Cartographic.fromDegrees(lon, lat);
                    if (viewer.terrainProvider && (Cesium as any).sampleTerrainMostDetailed) {
                      try {
                        (Cesium as any).sampleTerrainMostDetailed(viewer.terrainProvider, [carto]).then((updated: any) => {
                          const height = updated && updated[0] && typeof updated[0].height === 'number' ? updated[0].height : 0;
                          viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(height + 5000, 2000)) });
                        }).catch(() => {
                          viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 5000) });
                        });
                      } catch (e) {
                        viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 5000) });
                      }
                    } else {
                      // Fallback: fly to a modest height above ellipsoid
                      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 5000) });
                    }
                  } else {
                    try { viewer.camera.flyTo({ destination: entity.position.getValue(new Date()) }); } catch (e) {}
                  }
                } catch (e) {}
              } else {
                try { viewer.camera.flyTo({ destination: entity.position.getValue(new Date()) }); } catch (e) {}
              }
              try { onSelect && onSelect(entity.id as string); } catch (e) {}
            } catch (e) {}
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Clean up on unmount
        return () => {
          try {
            handler && handler.destroy && handler.destroy();
          } catch (e) {}
          clearInterval(nodesTimer);
          try {
            viewer && viewer.destroy && viewer.destroy();
          } catch (e) {}
          viewerRef.current = null;
        };
      } catch (err) {
        console.error("Failed to initialize Cesium globe:", err);
        setLoadError(String(err));
        setLoading(false);
      }
    }

    init();

    // nothing to clean up here because init returns cleanup closure handled above by React
  }, []);

  // Re-run an effect to update entities whenever the node/satellite arrays change.
  // The globe itself will call refreshAll via the interval; we also trigger a quick refresh by toggling a tiny state.
  useEffect(() => {
    if (!viewerRef.current) return;
    try {
      const viewer = viewerRef.current;
      // Make sure dataset changes are picked up quickly by re-adding entities
      // We'll remove entities that no longer exist and update/create current ones
      // (The logic inside init() already runs on an interval.)
      // For immediacy, trigger a small camera move so labels update visually.
      if (nodes.length > 0) {
        const n = nodes[0];
        try {
          const Cesium = (window as any).Cesium;
          if (Cesium) {
            viewer.camera.lookAt(Cesium.Cartesian3.fromDegrees(n.lon, n.lat, 1000), new Cesium.Cartesian3(0, 0, 0));
          }
        } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
  }, [nodes.length, satellites.length]);

  return (
    <div className={`relative w-full ${className ?? "h-[70vh] md:h-[85vh]"}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading / error overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="text-center text-white">
            <div className="animate-spin mb-2 border-4 border-white/30 border-t-white rounded-full w-10 h-10 mx-auto" />
            <div className="text-sm">Loading globe…</div>
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute left-4 top-4 bg-red-800/90 px-3 py-2 rounded-md text-xs text-white w-64">
          <div className="font-medium text-xs mb-1">Cesium Error</div>
          <div className="text-xs">{loadError}</div>
        </div>
      )}

      <div className="absolute left-4 top-4 bg-background/80 px-3 py-2 rounded-md text-xs w-44">
        <div className="font-medium text-xs mb-1">Cesium Globe</div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showOrbits} onChange={() => setShowOrbits((v) => !v)} /> Orbits</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showGroundTracks} onChange={() => setShowGroundTracks((v) => !v)} /> Ground track</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showCoverage} onChange={() => setShowCoverage((v) => !v)} /> Coverage</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={trackOnSelect} onChange={() => setTrackOnSelect((v) => !v)} /> Auto-track</label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={terrainEnabled} onChange={() => {
              const newEnabled = !terrainEnabledRef.current;
              setTerrainEnabled(newEnabled);
              // apply change immediately if viewer ready
              try {
                const Cesium = (window as any).Cesium;
                const viewer = viewerRef.current;
                const ionToken = globeOptions?.ionToken ?? (process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN as string | undefined);
                if (!viewer || !Cesium) return;
                if (newEnabled) {
                  if (ionToken && typeof Cesium.createWorldTerrain === 'function') {
                    viewer.terrainProvider = Cesium.createWorldTerrain({ requestVertexNormals: true, requestWaterMask: true });
                    try { viewer.scene.globe.depthTestAgainstTerrain = true; } catch (e) {}
                  }
                } else {
                  try { viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider(); } catch (e) {}
                  try { viewer.scene.globe.depthTestAgainstTerrain = false; } catch (e) {}
                }
              } catch (e) {}
            }} /> Terrain
          </label>
        </div>
      </div>
    </div>
  );
}
