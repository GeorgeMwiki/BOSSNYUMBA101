# SOTA Geo-Platform Research — May 2026

**Scope.** Define what "state-of-the-art" looks like for the Muzima
geo-platform (`packages/geo-platform`) as of 2026-05-24. A property
manager opens a map, sees photorealistic 3D, paints a parcel
boundary, drops elements on walls / garages / fences, sets a geofence,
and gets real-time advisory (solar, air, traffic, pollen, drive-time,
parking, walkability).

This is the input to `packages/geo-platform/` build plan. Companion
spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` —
that file already covers DB-side polygon storage, snap-to-building,
color-coding, and the `ParcelMap` shell. `geo-platform` is the layer
above it: third-party real-time data + photorealistic rendering +
geofence runtime + segmentation assist.

---

## 1. Google Maps Platform — Live (paid, primary)

### 1.1 Aerial View API (GA Feb 2025)

- Photorealistic 3D video flyovers around a `(lat, lng)` plus optional
  POI label. Returns an MP4 + thumbnail URL, plus a "live" pannable
  preview if the location has streamed coverage.
- Endpoint: `POST https://aerialview.googleapis.com/v1/videos:lookupVideo`.
- Status flow: `PROCESSING` → `ACTIVE`. Cache hits return
  `ACTIVE` immediately.
- Use case for Muzima: hero shot when the manager lands on a parcel
  detail page; "share to WhatsApp" thumbnail; investor tour preview.
- Quota: 1000 free/mo, then $7.50 / 1000 lookups.

### 1.2 Map Tiles API — 3D Photorealistic (GA Q3 2024)

- Per-tile streaming of the same Google Earth meshes that power
  Aerial View, but pannable / zoomable inside our own viewer.
- Endpoint: `https://tile.googleapis.com/v1/3dtiles/root.json` →
  Cesium-style 3D Tiles 1.1 (`b3dm` / `glb`).
- We render with **Cesium 1.117** or **deck.gl `Tile3DLayer`** —
  deck.gl integrates cleanly with our MapLibre map so we keep one
  camera and one event loop.
- Use case: the painting / element-placement screen — the manager can
  rotate to see the back wall before dropping a "broken downspout" pin.
- Quota: $40 / 1000 sessions (a "session" = 30 min of streaming).

### 1.3 Routes API — real-time traffic (GA, replaces Directions)

- `POST https://routes.googleapis.com/directions/v2:computeRoutes`
- `routingPreference: TRAFFIC_AWARE_OPTIMAL` gives live traffic.
- We use it for the "drive time to CBD / nearest hospital / airport"
  pills on every listing and for the parcel-to-tenant commute
  estimate during onboarding.
- Quota: $5 / 1000 (basic) → $10 / 1000 (traffic-aware).

### 1.4 Address Validation API (GA)

- `POST https://addressvalidation.googleapis.com/v1:validateAddress`
- Returns: `verdict.hasInferredComponents`, geocoded position, and
  USPS / global postal normalization. Returns a `validationGranularity`
  enum (ROUTE, PREMISE, SUB_PREMISE) so we can decide whether to ask
  the user for a unit number.
- Use case: tenant lease form, owner KYC, and parcel-creation address
  cross-check (catch typos against the Aerial View geocode).
- Quota: 1000 free/mo, then $17 / 1000.

### 1.5 Place Details + Reviews (GA, Places API v1)

- `GET https://places.googleapis.com/v1/places/{place_id}` with field
  mask. Returns name, reviews, ratings, photo refs, opening hours.
- For the "Nearby" tab — supermarkets, schools, hospitals near the
  parcel. Crucial for the marketing brain's listing-quality copy.
- Quota: $17 / 1000 for "details" SKU, free up to 1000/mo.

---

## 2. Environmental APIs (Google, paid)

### 2.1 Solar API (GA Apr 2024)

- `GET https://solar.googleapis.com/v1/buildingInsights:findClosest`
  → roof shape, segment angle / azimuth, annual sun hours, panel
  recommendations, CO₂ savings.
- `GET .../dataLayers:get` → orthophoto, monthly flux PNG, mask PNG.
- Coverage: continental US, most of EU, urban LATAM, parts of AU, JP,
  and South Africa — **NOT** yet East Africa. We must degrade to
  PVGIS-API + drone-DEM heuristic for TZ/KE/UG.
- Quota: $5 / 1000 (basic), $10 / 1000 (with data layers).

### 2.2 Air Quality API (GA Aug 2023)

- `POST https://airquality.googleapis.com/v1/currentConditions:lookup`
  → Universal AQI + per-pollutant µg/m³ (PM2.5, PM10, NO₂, O₃, SO₂,
  CO) + dominant pollutant + health recommendations.
- `:forecast` and `:history` endpoints (up to 96h / 30d).
- Heatmap tiles available.
- BreeZoMeter-powered (Google acquired 2022). Global coverage but
  fidelity drops in EA — we still treat it as the canonical signal.
- Quota: $5 / 1000.

### 2.3 Pollen API (GA Q1 2024)

- `GET https://pollen.googleapis.com/v1/forecast:lookup` → daily
  index (grass / tree / weed) + plant descriptions + 5-day forecast.
- Heatmap tiles.
- Less relevant for TZ but essential for our LATAM and US expansion.

---

## 3. Open-source rendering path (fallback / free tier)

### 3.1 MapLibre GL JS v5 (Mar 2025)

- WebGL2 → WebGPU runtime, vector tiles, terrain (DEM), 3D buildings
  via `fill-extrusion`, true 3D mesh via `add3DTilesLayer` (added in
  v5.2).
- Best with **PMTiles** (`@protomaps/maplibre-pmtiles`) for static
  hosting or **Martin** for on-prem dynamic vector tiles from PostGIS.

### 3.2 Martin v0.16 (Rust tile server)

- Reads PostGIS, MBTiles, PMTiles, COG. Single binary, ~20 MB RAM at
  rest, ~3000 RPS on a single core. Our parcel polygons go straight
  from PostGIS → Martin → MapLibre with no transform pipeline.

### 3.3 PMTiles v3

- Single-file static tile archive over HTTPS Range requests. We can
  ship a pre-built tenant-region PMTiles to S3 → CloudFront and serve
  millions of map loads for ~$0 / month. Perfect for the read-only
  public marketing pages.

### 3.4 Cesium 1.117 (3D mesh fallback)

- Industry standard 3D Tiles viewer; the open path for photorealistic
  3D when we don't have the Google Maps Tiles budget (or in markets
  where Google has no mesh — most of TZ secondary cities).
- Pair with **Cesium Ion** free tier (5 GB streaming/mo) or with
  self-hosted Mapbox Terrain-RGB + open building footprints extruded.

### 3.5 Mapillary (Meta, free)

- Crowdsourced street-level imagery. Public Graph API.
- Coverage gap-filler in EA where Street View is sparse.
- We use it as a "verify the gate looks right" QA on listing photos
  and as a source for the segmentation model below.

---

## 4. Building footprints (foundation for snap-to-building)

| Source | Coverage | Format | Licence | Best for |
| --- | --- | --- | --- | --- |
| **Overture Maps Buildings** (2024-11) | Global, 2.3 B polygons | PMTiles / parquet | CDLA 2.0 | Default primary — already in `spatial-engine` |
| **Google Open Buildings v3** (2023-09) | Africa + S. Asia + LATAM, 1.8 B | CSV/GeoJSON / Earth Engine | CC-BY 4.0 | **EA primary**, 100 m boundary accuracy |
| **Microsoft Building Footprints** | US, CA, AU, KE, TZ, NG, plus 100+ more | GeoJSON via GitHub | ODbL | Cross-check / fill-in |
| **OpenStreetMap** | Global, ~600 M | OSM PBF / Overpass | ODbL | Centroid sanity check |

The `footprint-snapper` we ship below tries Google Open Buildings
first (best in EA), falls back to Overture, then Microsoft, then OSM.

---

## 5. Parcel / boundary segmentation (the "paint with AI" UX)

### 5.1 SAM 2.1 — Segment Anything v2.1 (Meta, Sep 2024)

- Vision foundation model — given a high-res image and a click /
  bounding box, returns a precise mask in <100 ms.
- For Muzima: the manager clicks inside their parcel on the
  satellite image → we send the image bytes + click to SAM 2.1
  (running on Replicate, Modal, or a self-hosted A10G) → we get back
  a polygon → snap to nearest building edges from §4 → done.
- Model file: 360 MB (`sam2.1_hiera_large.pt`).
- Falls back to Mask R-CNN (Detectron2) if SAM unavailable.

### 5.2 Drone DEM ingestion

- **DroneDeploy / Pix4D / WebODM** all export GeoTIFF DEM + ortho.
- We accept these in the import endpoint (see `area-insights`) and
  pipe through GDAL → COG → MapLibre `raster-dem` source. Extracts
  per-parcel slope, roof pitch, elevation for the solar fallback.

### 5.3 3D Gaussian Splatting (Polycam, Luma, Scaniverse — 2024)

- Phone-camera capture → cloud-side splatting → embeddable WebGL viewer.
- For premium listings: "walk around the actual property" tour.
- We don't host the splatter; we accept a URL (`.splat`, `.ply`, or
  Polycam embed code) and render with `splat-viewer` or `@mkkellogg/gaussian-splats-3d`.

---

## 6. Geofence engine

### 6.1 RBush v3.0

- 5-line npm dependency, ~3 KB. R-tree spatial index for fast bbox
  queries. We index polygons by bbox, then point-in-polygon check
  the candidate set using turf.js `booleanPointInPolygon`.
- 100k polygons → sub-ms lookup on the browser.

### 6.2 Event semantics

We model **cross-in** and **cross-out** events plus a configurable
dwell time. The engine is an `EventEmitter` so the LiveMap component
can subscribe and toast / push-notify.

### 6.3 Buffer / dilation

For "alert me when a worker is within 10 m of the boundary" we use
turf `buffer` (or a custom geodesic dilation if turf isn't present)
to inflate the polygon, then point-in-polygon test against the
inflated ring.

---

## 7. Photo capture w/ camera GPS (boundary tracing)

- HTML5 `<input type="file" capture="environment">` exposes phone
  cameras; on iOS Safari and Chrome Android the resulting JPEG carries
  EXIF GPS tags. We parse with `exifr` (~10 KB) and convert
  `GPSLatitude` / `GPSLongitude` → decimal degrees, accuracy from
  `GPSDOP` if present.
- Workflow: manager walks the boundary, taps shutter at each corner;
  client deduplicates GPS positions within 2 m; sends the array →
  polygon to the parcel-service.

---

## 8. What we DO NOT build right now (deferred)

- Server-side rendering of 3D for emails (too expensive — use Aerial
  View thumbnail).
- Federated learning across tenants for segmentation (privacy review
  pending).
- Live drone telemetry ingest (Phase 2).

---

## 9. Env vars cataloged

| Var | Source | Used by | Required? |
| --- | --- | --- | --- |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console → Maps Platform | Aerial View, Solar, Air Quality, Pollen, Routes, Address Validation | YES for live data |
| `GOOGLE_MAPS_TILES_KEY` | optional separate key for 3D tiles billing | LiveMap 3D layer | optional |
| `SAM_REPLICATE_TOKEN` | replicate.com SAM 2.1 endpoint | sam-segmenter | optional — stubs OK |
| `MAPILLARY_CLIENT_TOKEN` | mapillary.com Graph API | (future) street-view widget | optional |

All `*_KEY` / `*_TOKEN` env reads MUST be lazy (inside the function,
not at module import) so we can run unit tests without env in CI.
They MUST be redacted from any log.

---

## 10. Acceptance for the v0 build

- TypeScript types strict (`strict: true`, `exactOptionalPropertyTypes`).
- Zero `process.exit`, zero top-level `await`.
- All real-fetch clients: `AbortController` + 10s default timeout,
  structured `{ ok: false, error }` on non-200 (no throws).
- API key NEVER appears in `console.*` or thrown error messages.
- Unit tests cover: geofence engine math, footprint-snapper distance
  selection, Solar + Air Quality fetch shaping (with `vi.stubGlobal`
  on `fetch`), area-insights bundle composition.
- React components stay tree-shakable behind `./react` export so the
  Node-only server can `import '@bossnyumba/geo-platform'` and not
  pull `maplibre-gl` into the bundle.

---

## 11. Recommended sequencing for the build

1. `types.ts` first — locks the shape every other file depends on.
2. `google/*-client.ts` — five real-fetch wrappers, each ~80 LOC.
3. `geofence/` — pure logic, easy to test.
4. `segmentation/` — SAM stub + footprint-snapper.
5. `advisory/area-insights.ts` — aggregator over §2 + §1.3.
6. `components/*.tsx` — last (peer deps on maplibre-gl + React).
7. `__tests__/` — written alongside as each piece lands.
