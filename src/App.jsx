import React, { useEffect, useState } from 'react'
import Recommender from './components/Recommender'
import ARScene from './components/ARScene'
import ARViewerFallback from './components/ARViewerFallback'
export default function App(){
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [showAR, setShowAR] = useState(false)
  useEffect(()=>{
    fetch('/products.json').then(r=>r.json()).then(setProducts)
  },[])
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">AR Furniture Visualizer</h1>
        <p className="text-sm text-gray-600">Take a photo of your room to get AI-based recommendations, then place 3D furniture using AR.</p>
      </header>
      <main className="max-w-4xl mx-auto mt-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 md:col-span-2 bg-white p-4 rounded shadow">
            <h2 className="font-semibold">Room Photo (for recommendations)</h2>
            <input type="file" accept="image/*" onChange={(e)=>{ const f = e.target.files[0]; if(!f) return; const url = URL.createObjectURL(f); setPhoto(url); }} className="mt-2" />
            {photo && <img src={photo} alt="room" className="mt-3 w-full max-h-60 object-cover" />}
            <Recommender photo={photo} products={products} onRecommend={(p)=> setSelected(p)} />
          </div>
          <aside className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold">Catalog</h3>
            <div className="mt-2 space-y-2">
              {products.map(p => (
                <div key={p.id} className="flex items-center space-x-3">
                  <img src={p.image} className="w-16 h-16 object-cover rounded" />
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.style}</div>
                  </div>
                  <div>
                    <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={()=>{ setSelected(p); setShowAR(true); }}>Place in AR</button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
        {selected && showAR && (
          <section className="mt-6 bg-white p-4 rounded shadow">
            <h2 className="font-semibold">AR Placement - {selected.name}</h2>
            <div className="mt-3">
              <ARScene modelUrl={selected.model} />
              <div className="mt-4">
                <p className="text-xs text-gray-500">iOS fallback / Quick Look:</p>
                <ARViewerFallback modelUrl={selected.model} usdzUrl={selected.usdz} />
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
