import React, { useEffect, useState } from 'react'
import * as mobilenet from '@tensorflow-models/mobilenet'
function cosine(a,b){
  let dot=0, na=0, nb=0
  for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  return dot/ (Math.sqrt(na)*Math.sqrt(nb)+1e-8)
}
export default function Recommender({ photo, products, onRecommend }){
  const [model, setModel] = useState(null)
  const [productEmbeds, setProductEmbeds] = useState(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  useEffect(()=>{
    let cancelled=false
    mobilenet.load().then(m=>{ if(!cancelled){ setModel(m); } })
    return ()=>{ cancelled=true }
  },[])
  useEffect(()=>{
    if(!model || !products?.length) return
    let mounted=true
    async function compute(){
      const embeds = []
      for(const p of products){
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = p.image
        await new Promise(res=> img.onload = res)
        const activation = model.infer(img, true)
        const arr = Array.from(await activation.data())
        embeds.push({ id: p.id, embed: arr })
        activation.dispose()
      }
      if(mounted) setProductEmbeds(embeds)
    }
    compute()
    return ()=>{ mounted=false }
  },[model, products])
  useEffect(()=>{
    if(!model || !photo || !productEmbeds) return
    let mounted=true
    ;(async ()=>{
      setLoading(true)
      const img = new Image(); img.crossOrigin='anonymous'; img.src = photo
      await new Promise(r=> img.onload=r)
      const act = model.infer(img, true)
      const q = Array.from(await act.data())
      act.dispose()
      const scored = productEmbeds.map(pe=>({ id: pe.id, score: cosine(q, pe.embed) }))
      scored.sort((a,b)=>b.score-a.score)
      const top = scored.slice(0,3).map(s => products.find(p=>p.id===s.id))
      if(mounted) setResults(top)
      setLoading(false)
    })()
    return ()=>{ mounted=false }
  },[model, photo, productEmbeds])
  if(!model) return <div className="mt-3 text-sm text-gray-500">Loading AI model...</div>
  return (
    <div className="mt-4">
      <h4 className="font-medium">AI Recommendations</h4>
      {loading && <div className="text-sm text-gray-500">Processing...</div>}
      {!loading && results?.length===0 && <div className="text-sm text-gray-500">Upload a photo to get suggestions</div>}
      <div className="mt-2 space-y-2">
        {results.map(r=> (
          <div key={r.id} className="flex items-center space-x-3 border p-2 rounded">
            <img src={r.image} className="w-16 h-16 object-cover rounded" />
            <div className="flex-1">
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-gray-500">{r.style}</div>
            </div>
            <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={()=>onRecommend(r)}>Place</button>
          </div>
        ))}
      </div>
    </div>
  )
}
