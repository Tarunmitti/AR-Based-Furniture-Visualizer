import React from 'react'
import '@google/model-viewer'
export default function ARViewerFallback({ modelUrl, usdzUrl }){
  return (
    <div>
      <model-viewer
        src={modelUrl}
        ios-src={usdzUrl}
        alt="Furniture"
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        style={{ width: '100%', height: '360px' }}>
      </model-viewer>
      <p className="text-xs text-gray-500 mt-2">On iOS, tap the AR icon to open Quick Look (requires .usdz). On Android, model-viewer will trigger Scene Viewer where supported.</p>
    </div>
  )
}
