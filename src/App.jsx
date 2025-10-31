import React, { useEffect, useRef, useState } from "react";
import "@google/model-viewer";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "./index.css";

export default function App() {
  const mountRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [models, setModels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const [userScale, setUserScale] = useState(1);
  const [userRotation, setUserRotation] = useState(0);

  const runtimeRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    modelGroup: null,
    initialFitScale: 1,
    modelLoaded: false,
  });

  useEffect(() => {
    fetch("/products.json")
      .then((r) => r.json())
      .then((d) => setModels(d))
      .catch((e) => console.error("products.json load error", e));
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) setIsMobile(true);
  }, []);

  const handlePhotoUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setPhoto(ev.target.result);
    r.readAsDataURL(f);
  };

  const computeAndCenter = (object3d) => {
    const box = new THREE.Box3().setFromObject(object3d);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const pivot = new THREE.Group();
    object3d.position.sub(center);
    pivot.add(object3d);
    return { pivot, size, center };
  };

  const computeInitialScaleForFit = (size, camera) => {
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera.fov * Math.PI) / 180;
    const camDistance = 5;
    const visibleHeight = 2 * camDistance * Math.tan(fov / 2);
    const targetSize = visibleHeight * 0.6;
    return targetSize / (maxDim || 1);
  };

  useEffect(() => {
    const prev = runtimeRef.current;
    if (prev.renderer) {
      prev.renderer.forceContextLoss();
      prev.renderer.dispose();
      mountRef.current.innerHTML = "";
    }

    if (!photo || !selected || !mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = 420;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(1, 2, 3);
    scene.add(ambient, dir);

    const texLoader = new THREE.TextureLoader();
    setTimeout(() => {
      texLoader.load(
        photo,
        (texture) => {
          const aspect = texture.image.width / texture.image.height || 1;
          const camZ = camera.position.z;
          const fov = (camera.fov * Math.PI) / 180;
          const visibleHeight = 2 * Math.tan(fov / 2) * camZ;
          const visibleWidth = visibleHeight * camera.aspect;
          let planeWidth = visibleWidth;
          let planeHeight = planeWidth / aspect;
          if (planeHeight < visibleHeight) {
            planeHeight = visibleHeight;
            planeWidth = planeHeight * aspect;
          }
          const geo = new THREE.PlaneGeometry(planeWidth, planeHeight);
          const mat = new THREE.MeshBasicMaterial({ map: texture });
          const plane = new THREE.Mesh(geo, mat);
          plane.position.z = -5;
          plane.material.depthWrite = false;
          plane.material.depthTest = false;
          scene.add(plane);

        },
        undefined,
        (err) => console.warn("texture load failed", err)
      );
    }, 50);

    const modelGroup = new THREE.Group();
    modelGroup.visible = false;
    scene.add(modelGroup);

    const loader = new GLTFLoader();
    loader.load(
      selected.model,
      (gltf) => {
        const root = gltf.scene;
        const { pivot, size } = computeAndCenter(root);
        const initialScale = computeInitialScaleForFit(size, camera);
        runtimeRef.current.initialFitScale = initialScale || 1;
        modelGroup.add(pivot);
        modelGroup.scale.set(initialScale, initialScale, initialScale);
        modelGroup.visible = true;
        runtimeRef.current.modelLoaded = true;
        runtimeRef.current.modelGroup = modelGroup;
        setUserScale(1);
        setUserRotation(0);
      },
      undefined,
      (err) => console.error("GLTF load error:", err)
    );

    const state = { dragging: false, lastX: 0, lastY: 0, touchLastDist: null };
    const canvas = renderer.domElement;

    const pixelToWorldFactor = () => {
      const z = camera.position.z;
      const fov = (camera.fov * Math.PI) / 180;
      const visibleHeight = 2 * z * Math.tan(fov / 2);
      return visibleHeight / height;
    };

    const onMouseDown = (e) => {
      if (!runtimeRef.current.modelLoaded) return;
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    };
    const onMouseUp = () => (state.dragging = false);
    const onMouseMove = (e) => {
      if (!state.dragging || !runtimeRef.current.modelLoaded) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      const factor = pixelToWorldFactor();
      runtimeRef.current.modelGroup.position.x += dx * factor;
      runtimeRef.current.modelGroup.position.y -= dy * factor;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    };

    const onWheel = (e) => {
      if (!runtimeRef.current.modelLoaded) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      setUserScale((s) => Math.max(0.05, Math.min(4, s + delta)));
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const handleResize = () => {
      const w = mountRef.current.clientWidth || width;
      const h = 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    const animate = () => {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    runtimeRef.current = {
      renderer,
      scene,
      camera,
      modelGroup,
      initialFitScale: runtimeRef.current.initialFitScale,
      modelLoaded: true,
    };

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, [photo, selected]);

  useEffect(() => {
    const mg = runtimeRef.current.modelGroup;
    if (!mg) return;
    const base = runtimeRef.current.initialFitScale || 1;
    mg.scale.set(base * userScale, base * userScale, base * userScale);
    mg.rotation.y = userRotation;
  }, [userScale, userRotation]);

  const resetTransform = () => {
    if (!runtimeRef.current.modelLoaded || !runtimeRef.current.modelGroup) return;
    runtimeRef.current.modelGroup.position.set(0, 0, 0);
    setUserScale(1);
    setUserRotation(0);
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1 className="text-2xl font-bold">AR Furniture Visualizer</h1>
      </header>

      <main className="grid-2">
        <section className="card">
          <h2>Upload Room Photo</h2>
          <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          {photo && (
            <div style={{ marginTop: 12 }}>
              <img src={photo} alt="room" style={{ width: "100%", borderRadius: 8, objectFit: "cover" }} />
            </div>
          )}
        </section>

        <section className="card">
          <h2>Select Furniture</h2>
          <div className="catalog">
            {models.map((it) => (
              <div
                key={it.id}
                className={`catalog-row ${selected?.id === it.id ? "active" : ""}`}
                onClick={() => setSelected(it)}
              >
                <img src={it.image} alt={it.name} className="thumb" />
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{it.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{it.style}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <div className="card" style={{ marginTop: 16, minHeight: 460 }}>
        <div ref={mountRef} style={{ width: "100%", height: 420 }} />
        {photo && selected && (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginTop: 12 }}>
            <label>Size</label>
            <input type="range" min="0.05" max="4" step="0.01" value={userScale} onChange={(e) => setUserScale(parseFloat(e.target.value))} />
            <label>Rotate</label>
            <input type="range" min={-Math.PI} max={Math.PI} step="0.01" value={userRotation} onChange={(e) => setUserRotation(parseFloat(e.target.value))} />
            <button className="btn ghost" onClick={resetTransform}>Reset</button>
          </div>
        )}
      </div>

      {/* Mobile AR Launch */}
{isMobile && selected && (
  <div style={{ textAlign: "center", marginTop: 12 }}>
    <model-viewer
      src={selected.model}
      ios-src={selected.usdz || ""}
      ar
      ar-modes="scene-viewer quick-look webxr"
      ar-scale="auto"
      camera-controls
      style={{ width: "100%", height: "400px", borderRadius: "12px" }}
    >
    </model-viewer>
    <p className="hint" style={{ marginTop: 8 }}>
      Tap the <b>AR</b> icon above to view furniture in your space.
    </p>
  </div>
)}


      <footer className="footer" style={{ marginTop: 18 }}>© 2025 AR Furniture Visualizer</footer>
    </div>
  );
}
