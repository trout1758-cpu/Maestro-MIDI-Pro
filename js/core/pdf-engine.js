import { CONFIG } from '../config.js';
import { State } from '../state.js';
import { NoteRenderer } from './note-renderer.js';
import { CalibrationController } from '../controllers/calibration-controller.js';

export const PDF = {
    doc: null, 
    scale: 1.0, 
    wrapper: null,
    overlay: null,
    
    // We no longer rely on a single 'this.canvas'. 
    // Instead, we manage multiple canvases inside the wrapper.
    
    initElements() {
        this.wrapper = document.getElementById('canvas-wrapper');
        this.overlay = document.getElementById('overlay-layer');
        // Set worker (must run once)
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    },

    async load(file) {
        const buffer = await file.arrayBuffer();
        this.doc = await pdfjsLib.getDocument(buffer).promise;
        this.render();
    },

    async render() {
        if (!this.doc) return;

        // 1. Detach overlay to preserve it (it might contain UI elements temporarily)
        // actually, NoteRenderer clears it anyway, but it's cleaner to keep the ref.
        this.overlay.remove();
        
        // 2. Clear the wrapper (removes old canvases)
        this.wrapper.innerHTML = '';
        
        let totalHeight = 0;
        let maxWidth = 0;
        const PAGE_GAP = 20; // Pixels between pages

        // 3. Loop through all pages
        for (let pageNum = 1; pageNum <= this.doc.numPages; pageNum++) {
            const page = await this.doc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });
            
            // Create a canvas for this page
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.display = 'block';
            
            // Add margin for visual separation (except last page)
            if (pageNum < this.doc.numPages) {
                canvas.style.marginBottom = `${PAGE_GAP}px`;
            }

            // Track total dimensions
            totalHeight += viewport.height;
            if (pageNum < this.doc.numPages) totalHeight += PAGE_GAP;
            
            if (viewport.width > maxWidth) maxWidth = viewport.width;

            this.wrapper.appendChild(canvas);
            
            // Render content
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
        }

        // 4. Reattach and resize overlay to cover ALL pages
        this.wrapper.appendChild(this.overlay);
        this.overlay.style.width = maxWidth + 'px';
        this.overlay.style.height = totalHeight + 'px';
        this.wrapper.style.width = maxWidth + 'px';
        this.wrapper.style.height = totalHeight + 'px';

        // 5. Update UI
        if (State.isCalibrating) CalibrationController.render();
        
        // Re-render placed notes if not calibrating
        if (!State.isCalibrating && State.activePartId) {
            NoteRenderer.renderAll();
        }
    },

    adjustZoom(delta, mouseX, mouseY) {
        this.scale = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, this.scale + delta));
        this.scale = Math.round(this.scale * 100) / 100;
        this.render();
        document.querySelectorAll('.zoom-display').forEach(el => el.innerText = Math.round(this.scale * 100) + "%");
    }
};
