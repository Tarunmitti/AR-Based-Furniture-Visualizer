import React, { useState, useRef, useEffect } from "react";
import "@google/model-viewer";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PlaneGeometry, MeshStandardMaterial, Mesh } from "three";
import "./index.css";

export default function App() {
  const canvasRef = useRef(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isARSupported, setIsARSupported] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showARCanvas, setShowARCanvas] = useState(false);
  const [sceneData, setSceneData] = useState(null);

  useEffect(() => {
    fetch("/products.json")
      .then((res) => res.json())
      .then(setModels)
      .catch((err) => console.error("Error loading products:", err));

    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) setIsMobile(true);
    if (navigator.xr)
      navigator.xr.isSessionSupported("immersive-ar").then(setIsARSupported);
  }, []);

  const startAR = async () => {
    if (!isARSupported) {
      alert("AR not supported on this device or browser.");
      return;
    }

    setShowARCanvas(true);

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "local-floor"],
    });

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: canvasRef.current,
    });
    renderer.xr.enabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    // Ambient and directional lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    hemiLight.position.set(0, 1, 0);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 3, 1);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Ground shadow plane
    const planeGeometry = new PlaneGeometry(10, 10);
    const planeMaterial = new MeshStandardMaterial({
      color: 0x000000,
      opacity: 0.25,
      transparent: true,
    });
    const ground = new Mesh(planeGeometry, planeMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const loader = new GLTFLoader();
    let model = null;
    let hitTestSource = null;
    const referenceSpace = await session.requestReferenceSpace("local");
    const hitSource = await session.requestHitTestSource({ space: referenceSpace });
    hitTestSource = hitSource;

    let velocity = 0;
    let rotationVelocity = 0;

    // Gesture setup
    let startDistance = 0;
    let startScale = 1;
    let startRotation = 0;
    let dragging = false;
    let lastTouch = { x: 0, y: 0 };

    const handleTouchStart = (e) => {
      if (!model) return;
      if (e.touches.length === 1) {
        dragging = true;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      if (e.touches.length === 2) {
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        startDistance = Math.hypot(dx, dy);
        startRotation = Math.atan2(dy, dx);
        startScale = model.scale.x;
      }
    };

    const handleTouchMove = (e) => {
      if (!model) return;
      if (e.touches.length === 1 && dragging) {
        const dx = e.touches[0].clientX - lastTouch.x;
        model.position.x += dx * 0.0005;
        model.position.z -= dx * 0.0005;
        velocity = dx * 0.0005;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        const distance = Math.hypot(dx, dy);
        const rotation = Math.atan2(dy, dx);

        const scaleFactor = distance / startDistance;
        model.scale.setScalar(startScale * scaleFactor);

        const rotationDelta = rotation - startRotation;
        model.rotation.y += rotationDelta * 0.5;
        rotationVelocity = rotationDelta * 0.5;
        startRotation = rotation;
      }
    };

    const handleTouchEnd = () => {
      dragging = false;
    };

    const canvas = canvasRef.current;
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchmove", handleTouchMove);
    canvas.addEventListener("touchend", handleTouchEnd);

    session.addEventListener("select", () => {
      if (selectedModel && !model) {
        loader.load(selectedModel.model, (gltf) => {
          model = gltf.scene;
          model.scale.set(0.5, 0.5, 0.5);
          model.traverse((child) => {
            if (child.isMesh) child.castShadow = true;
          });
          scene.add(model);
        });
      }
    });

    const onXRFrame = (time, frame) => {
      session.requestAnimationFrame(onXRFrame);
      const pose = frame.getViewerPose(referenceSpace);
      if (!pose) return;

      const hitResults = frame.getHitTestResults(hitTestSource);
      if (hitResults.length && model) {
        const hitPose = hitResults[0].getPose(referenceSpace);
        if (!dragging) {
          // smooth damping
          model.position.y = THREE.MathUtils.lerp(
            model.position.y,
            hitPose.transform.position.y,
            0.2
          );
        }
      }

      // inertia
      if (Math.abs(velocity) > 0.00001) {
        model.position.x += velocity;
        model.position.z -= velocity;
        velocity *= 0.9;
      }
      if (Math.abs(rotationVelocity) > 0.001) {
        model.rotation.y += rotationVelocity;
        rotationVelocity *= 0.85;
      }

      renderer.render(scene, camera);
    };

    renderer.xr.setSession(session);
    session.requestAnimationFrame(onXRFrame);

    setSceneData({ session, renderer, model });
  };

  const exitAR = () => {
    if (sceneData?.session) {
      sceneData.session.end();
      setShowARCanvas(false);
      setSceneData(null);
    }
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1>AR Furniture Visualizer (Advanced)</h1>
      </header>

      <main>
        <div className="catalog">
          {models.map((item) => (
            <div
              key={item.id}
              className={`catalog-row ${
                selectedModel?.id === item.id ? "active" : ""
              }`}
              onClick={() => setSelectedModel(item)}
            >
              <img src={item.image} alt={item.name} className="thumb" />
              <p>{item.name}</p>
            </div>
          ))}
        </div>

        {!isMobile && selectedModel && (
          <div className="ar-area card mt-4">
            <model-viewer
              key={selectedModel.id}
              src={selectedModel.model}
              ios-src={selectedModel.usdz}
              alt={selectedModel.name}
              camera-controls
              environment-image="neutral"
              shadow-intensity="1"
              auto-rotate
              style={{ width: "100%", height: "400px" }}
            ></model-viewer>
          </div>
        )}

        {isMobile && (
          <button
            className="start-ar"
            onClick={startAR}
            disabled={!selectedModel}
          >
            🚀 Launch AR Mode
          </button>
        )}

        {showARCanvas && <canvas ref={canvasRef} className="ar-canvas"></canvas>}

        {showARCanvas && (
          <div className="control-panel">
            <button className="btn ghost" onClick={exitAR}>
              ✖ Exit AR
            </button>
          </div>
        )}
      </main>

      <footer className="footer">© 2025 AR Furniture Visualizer</footer>
    </div>
  );
}