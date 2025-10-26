// src/components/ARScene.jsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ARButton } from "three/examples/jsm/webxr/ARButton";

export default function ARScene({ modelUrl }) {
  const mountRef = useRef();
  const placedRef = useRef(null); // reference to the placed object
  const furnitureModelRef = useRef(null); // the loaded GLTF scene for cloning
  const bboxRef = useRef(null); // base model bbox (size)
  const [measuring, setMeasuring] = useState(false);
  const measurePointsRef = useRef([]); // store two Vector3s
  const [measurement, setMeasurement] = useState(null); // meters
  const [scaleValue, setScaleValue] = useState(1.0); // UI slider controlled scale
  const [rotationDeg, setRotationDeg] = useState(0); // UI rotation
  const reticleRef = useRef(null);

  useEffect(() => {
    let renderer, scene, camera, controller;
    let hitTestSource = null;
    let localRefSpace = null;
    const container = mountRef.current;
    if (!container) return;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, 480);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // AR Button (enter AR)
    document.body.appendChild(
      ARButton.createButton(renderer, { requiredFeatures: ["hit-test"] })
    );

    // Scene & Camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();

    // Light
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Reticle
    const ring = new THREE.RingGeometry(0.12, 0.15, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const reticle = new THREE.Mesh(ring, material);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    reticleRef.current = reticle;

    // Loader
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        // store the source model for cloning later
        furnitureModelRef.current = gltf.scene;
        // compute base bbox on raw model
        const tmp = new THREE.Box3().setFromObject(gltf.scene);
        const tmpSize = new THREE.Vector3();
        tmp.getSize(tmpSize);
        bboxRef.current = tmpSize; // width (x), height (y), depth (z)
        // Optionally apply a small default scale so models aren't huge
        // gltf.scene.scale.setScalar(1.0);
      },
      undefined,
      (err) => {
        console.error("GLTF load error", err);
      }
    );

    // Controller (select = tap in AR)
    controller = renderer.xr.getController(0);
    controller.addEventListener("select", () => {
      // placing or measuring logic when user taps in AR
      if (!reticle.visible) return;

      const position = new THREE.Vector3().setFromMatrixPosition(
        reticle.matrix
      );

      if (measuring) {
        // measure mode: collect two points
        const pts = measurePointsRef.current;
        pts.push(position.clone());
        if (pts.length === 2) {
          // compute distance (meters, WebXR uses meters)
          const d = pts[0].distanceTo(pts[1]);
          setMeasurement(d);
          setMeasuring(false);
          measurePointsRef.current = []; // reset
        } else {
          // prompt user to select second point
        }
        return;
      }

      // Normal placement: clone the model if needed, or move existing
      if (!furnitureModelRef.current) {
        console.warn("Model not loaded yet");
        return;
      }

      if (!placedRef.current) {
        // clone and add to scene
        const clone = furnitureModelRef.current.clone(true);
        // set initial scale and rotation
        clone.scale.setScalar(scaleValue);
        clone.position.copy(position);
        clone.quaternion.setFromRotationMatrix(reticle.matrix);
        clone.rotation.x = 0; // ensure upright
        clone.userData.baseScale = scaleValue;
        scene.add(clone);
        placedRef.current = clone;
      } else {
        // move existing placed object to new position
        placedRef.current.position.copy(position);
        placedRef.current.quaternion.setFromRotationMatrix(reticle.matrix);
      }
    });
    scene.add(controller);

    // WebXR session start: request hit test source
    function onSessionStart() {
      const session = renderer.xr.getSession();
      session.requestReferenceSpace("viewer").then((ref) => {
        session.requestHitTestSource({ space: ref }).then((source) => {
          hitTestSource = source;
        });
      });
      session.requestReferenceSpace("local").then((ref) => {
        localRefSpace = ref;
      });
      session.addEventListener("end", () => {
        hitTestSource = null;
        localRefSpace = null;
      });
    }
    renderer.xr.addEventListener("sessionstart", onSessionStart);

    // animation loop
    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const session = renderer.xr.getSession();
        if (hitTestSource && localRefSpace) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(localRefSpace);
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
        }
      }

      // apply UI-driven transforms to placed object every frame
      if (placedRef.current) {
        // set scale (uniform)
        placedRef.current.scale.setScalar(scaleValue);
        // set rotation (around Y)
        placedRef.current.rotation.y = (rotationDeg * Math.PI) / 180;
      }

      renderer.render(scene, camera);
    });

    // cleanup on unmount
    return () => {
      renderer.setAnimationLoop(null);
      if (renderer.domElement) container.removeChild(renderer.domElement);
      try {
        // remove the ARButton created earlier
        const btn = document.querySelector(".webxr-button");
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
      } catch (e) {}
    };
  }, [modelUrl, measuring, scaleValue, rotationDeg]);

  // UI handlers (React-controlled)
  function startMeasure() {
    setMeasurement(null);
    measurePointsRef.current = [];
    setMeasuring(true);
  }

  function autoFit() {
    if (!measurement) {
      alert("Measure a distance first (tap two points while in AR).");
      return;
    }
    if (!bboxRef.current || !placedRef.current) {
      alert("Place a model first in AR.");
      return;
    }
    // compute model's current width in world meters
    const modelWidth = bboxRef.current.x; // base width in model's units (should be meters for GLTF exported to meters)
    if (modelWidth <= 0) {
      alert("Cannot determine model width.");
      return;
    }
    // desired scaleFactor such that modelWidth * scaleFactor === measurement
    const desiredScale = (measurement / modelWidth);
    // apply via scaleValue state (keeps uniform scaling)
    setScaleValue(desiredScale);
    // applied in render loop
  }

  function resetPlacement() {
    // remove placed object if any
    const mount = mountRef.current;
    if (!mount) return;
    // find scene from renderer? Simpler: reload page to reset scene
    // But we can attempt to remove placedRef.current
    if (placedRef.current) {
      // placedRef.current.parent.remove(placedRef.current)
      placedRef.current.visible = false;
      placedRef.current = null;
    }
    setMeasurement(null);
    setScaleValue(1.0);
    setRotationDeg(0);
  }

  return (
    <div className="relative">
      <div ref={mountRef} className="w-full h-[480px] bg-black rounded" />
      <div className="mt-2 text-xs text-gray-500">
        Tap the AR button (added to the page), then tap anywhere in the AR view to place/move the model.
      </div>

      {/* Controls panel (desktop + mobile) */}
      <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded shadow max-w-[320px] z-50">
        <div className="flex gap-2 mb-2">
          <button
            onClick={startMeasure}
            className={`px-2 py-1 rounded border ${measuring ? "bg-yellow-300" : "bg-white"}`}
            title="Tap two points in AR to measure"
          >
            Measure (2 taps)
          </button>
          <button onClick={autoFit} className="px-2 py-1 bg-indigo-600 text-white rounded">
            Auto-fit
          </button>
          <button onClick={resetPlacement} className="px-2 py-1 bg-red-500 text-white rounded">
            Reset
          </button>
        </div>

        <div className="mb-2">
          <div className="text-[11px] text-gray-700">Scale: {scaleValue.toFixed(2)}x</div>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.01"
            value={scaleValue}
            onChange={(e) => setScaleValue(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="mb-2">
          <div className="text-[11px] text-gray-700">Rotation: {rotationDeg.toFixed(0)}°</div>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={rotationDeg}
            onChange={(e) => setRotationDeg(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="text-[12px] text-gray-600">
          {measurement ? (
            <div>
              Measured: <strong>{measurement.toFixed(2)} m</strong>
            </div>
          ) : measuring ? (
            <div>Measuring: tap first point, then tap second point in AR</div>
          ) : (
            <div>Tap model in AR to place/move it. Use Auto-fit to match measurement.</div>
          )}
        </div>
      </div>
    </div>
  );
}
