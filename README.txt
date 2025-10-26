
AR Furniture Visualizer - Ready Project (Placeholders for 3D models)

What's included:
- Full React + Vite project with TFJS recommender and Three.js WebXR AR placement.
- public/models contains placeholder .glb and .usdz files for each product.
- public/images contains thumbnail images for each product.
- public/products.json lists all products.

How to run:
1. Extract the ZIP.
2. Install Node.js 16+ if not installed.
3. In project folder run:
   npm install
   npm run dev
4. Open the printed local URL on your Android (Chrome) for WebXR testing, or iOS Safari for Quick Look (.usdz).

Notes on models:
- The .glb and .usdz files are placeholders. For full AR, replace them with real models.
- Recommended free model sources:
  - Sketchfab (https://sketchfab.com) - filter by downloadable and glTF/GLB
  - Free3D (https://free3d.com)
  - Poly Haven / Poly (archived models)
  - Google 3D Warehouse / TurboSquid / CGTrader (use free filter)
- To convert .glb to .usdz (if needed):
  - Use Apple's Reality Converter (macOS) or online converters.
  - Or use glTF-to-USDZ tools (e.g., usdzconvert).

Tips:
- For best WebXR support, test on Android Chrome (latest).
- iOS Quick Look requires .usdz and HTTPS.
- Consider precomputing product embeddings offline for faster load.

If you want, I can:
- Attempt to fetch and include actual free models into the ZIP (requires internet and verifying licenses).
- Or provide links to 8-10 curated downloadable models that you can download and drop into public/models/.
