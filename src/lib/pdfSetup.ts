import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker before any components load
if (pdfjs && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
} else {
  // Fallback for when pdfjs is not properly loaded
  console.warn('PDF.js not available, PDF viewing will be disabled');
}

