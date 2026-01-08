import { CONFIG } from '../config.js';
import { PDF } from './pdf-engine.js';

export const Utils = {
    getPdfCoords(e, scale) {
        // Updated to use PDF.overlay instead of PDF.canvas
        // PDF.overlay now spans the full height of all pages combined
        const rect = PDF.overlay.getBoundingClientRect(); 
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        return { x, y };
    },
    
    checkCanvasBounds(e, rect) {
        // rect passed in should be the overlay's rect
        return e.clientX >= rect.left && e.clientX <= rect.right && 
               e.clientY >= rect.top && e.clientY <= rect.bottom;
    },

    getNoteName(refMidi, stepsDown) {
        let currentMidi = refMidi;
        const whiteKeys = [0, 2, 4, 5, 7, 9, 11];
        const direction = stepsDown >= 0 ? -1 : 1;
        const steps = Math.abs(stepsDown);
        for(let i=0; i<steps; i++) {
            currentMidi += direction;
            while(!whiteKeys.includes(((currentMidi % 12) + 12) % 12)) currentMidi += direction;
        }
        // Safety fix: Ensure the index is always positive [0-11]
        const noteIndex = ((currentMidi % 12) + 12) % 12;
        return CONFIG.NOTE_NAMES[noteIndex];
    }
};
