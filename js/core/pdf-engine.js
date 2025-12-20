import { CONFIG } from '../config.js';
import { State } from '../state.js';
import { NoteRenderer } from './note-renderer.js';
import { CalibrationController } from '../controllers/calibration-controller.js';

export const PDF = {
    doc: null, pageNum: 1, scale: 1.0, 
    canvas: null, // Will be initialized on load
    ctx: null,
    wrapper: null,
    overlay: null,
    
    initElements() {
        this.canvas = document.getElementById('pdf-render');
        this.ctx = this.canvas.getContext('2d');
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
        const page = await this.doc.getPage(this.pageNum);
        const viewport = page.getViewport({ scale: this.scale });
        
        this.canvas.width = viewport.width;
        this.canvas.height = viewport.height;
        this.wrapper.style.width = viewport.width + 'px';
        this.wrapper.style.height = viewport.height + 'px';
        this.overlay.style.width = viewport.width + 'px';
        this.overlay.style.height = viewport.height + 'px';

        await page.render({ canvasContext: this.ctx, viewport }).promise;
        
        if (State.isCalibrating) CalibrationController.render();
        
        // IMPORTANT: Re-render placed notes if not calibrating
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