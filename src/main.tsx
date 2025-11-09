import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import './styles/react-split.css';

// Configure PDF.js worker before any components load
import * as pdfjs from 'pdfjs-dist';
if (pdfjs && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

