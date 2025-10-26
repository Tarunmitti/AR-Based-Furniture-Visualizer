import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
createRoot(document.getElementById('root')).render(<App />)

xdocument.getElementById('photo-upload').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('photo-preview');
    preview.src = e.target.result;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

if (navigator.userAgent.includes("Mobile") || navigator.userAgent.includes("Android") || navigator.userAgent.includes("iPhone")) {
  document.getElementById('ar-btn').classList.remove('hidden');
}