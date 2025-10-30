import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ARButton } from "three/examples/jsm/webxr/ARButton";

export default function ARScene({ modelUrl }) {
  const mountRef = useRef();
  const placedRef = useRef(null);
  const furnitureModelRef = useRef(null);
  const bboxRef = useRef(null);
  const [measuring, setMeasuring] = useState(false);
  const measurePointsRef = useRef([]);
  const [measurement, setMeasurement] = useState(null);
  const [scaleValue, setScaleValue] = useState(1.0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const reticleRef = useRef(null);

  useEffect(() => {
    let renderer, scene, camera, controller;
    let hitTestSource = null;
    let localRefSpace = null;
    const container = mountRef.current;
    if (!container) return;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, 480);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    document.body.appendChild(
      ARButton.createButton(renderer, { requiredFeatures: ["hit-test"] })
    );

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    const ring = new THREE.RingGeometry(0.12, 0.15, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const reticle = new THREE.Mesh(ring, material);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    reticleRef.current = reticle;

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        furnitureModelRef.current = gltf.scene;
        const tmp = new THREE.Box3().setFromObject(gltf.scene);
        const tmpSize = new THREE.Vector3();
        tmp.getSize(tmpSize);
        bboxRef.current = tmpSize;
      },
      undefined,
      (err) => {
        console.error("GLTF load error", err);
      }
    );

    controller = renderer.xr.getController(0);
    controller.addEventListener("select", () => {
      if (!reticle.visible) return;

      const position = new THREE.Vector3().setFromMatrixPosition(
        reticle.matrix
      );

      if (measuring) {
        const pts = measurePointsRef.current;
        pts.push(position.clone());
        if (pts.length === 2) {
          const d = pts[0].distanceTo(pts[1]);
          setMeasurement(d);
          setMeasuring(false);
          measurePointsRef.current = [];
        }
        return;
      }

      if (!furnitureModelRef.current) {
        console.warn("Model not loaded yet");
        return;
      }

      if (!placedRef.current) {
        const clone = furnitureModelRef.current.clone(true);
        clone.scale.setScalar(scaleValue);
        clone.position.copy(position);
        clone.quaternion.setFromRotationMatrix(reticle.matrix);
        clone.rotation.x = 0;
        clone.userData.baseScale = scaleValue;
        scene.add(clone);
        placedRef.current = clone;
      } else {
        placedRef.current.position.copy(position);
        placedRef.current.quaternion.setFromRotationMatrix(reticle.matrix);
      }
    });
    scene.add(controller);

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

      if (placedRef.current) {
        placedRef.current.scale.setScalar(scaleValue);
        placedRef.current.rotation.y = (rotationDeg * Math.PI) / 180;
      }

      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      if (renderer.domElement) container.removeChild(renderer.domElement);
      try {
        const btn = document.querySelector(".webxr-button");
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
      } catch (e) {}
    };
  }, [modelUrl, measuring, scaleValue, rotationDeg]);

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
    const modelWidth = bboxRef.current.x; 
    if (modelWidth <= 0) {
      alert("Cannot determine model width.");
      return;
    }
    const desiredScale = (measurement / modelWidth);
    setScaleValue(desiredScale);
  }

  function resetPlacement() {
    const mount = mountRef.current;
    if (!mount) return;
    if (placedRef.current) {
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

      {}
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
