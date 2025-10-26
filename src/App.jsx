// src/App.jsx
import React, { useState, useEffect } from 'react';
import '@google/model-viewer';
import './index.css';

export default function App() {
  const [photo, setPhoto] = useState(null);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    fetch('/products.json')
      .then(res => res.json())
      .then(setProducts)
      .catch(err => console.error('Error loading products:', err));

    if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
      setIsMobile(true);
    }
  }, []);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1 className="text-xl font-bold">AR Furniture Visualizer</h1>
        {isMobile && selected && (
          <a
            id="ar-btn"
            className="btn"
            href={selected.usdz}
            rel="ar"
          >
            View in AR
          </a>
        )}
      </header>

      <main className="grid-2">
        {/* Left side: photo upload */}
        <section className="card">
          <h2 className="text-lg font-semibold mb-2">Upload Your Room Photo</h2>
          <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload} />
          <div className="photo-container mt-3">
            {photo ? (
              <img id="photo-preview" src={photo} alt="Room Preview" />
            ) : (
              <p className="hint">Upload a photo of your room to preview furniture.</p>
            )}
          </div>
        </section>

        {/* Right side: furniture catalog */}
        <section className="card">
          <h2 className="text-lg font-semibold mb-2">Select Furniture</h2>
          <div id="catalog" className="catalog">
            {products.map(item => (
              <div
                key={item.id}
                className={`catalog-row ${selected?.id === item.id ? 'active' : ''}`}
                onClick={() => setSelected(item)}
              >
                <img src={item.image} alt={item.name} className="thumb" />
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="small">{item.style}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Model preview area */}
      {selected && (
        <div className="ar-area card mt-4">
          <model-viewer
            key={selected.id}
            src={selected.model}
            ios-src={selected.usdz}
            alt={selected.name}
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            environment-image="neutral"
            shadow-intensity="1"
            style={{ width: '100%', height: '400px' }}
          ></model-viewer>
        </div>
      )}

      <footer className="footer">© 2025 AR Furniture Visualizer</footer>
    </div>
  );
}
