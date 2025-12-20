import { CONFIG } from '../config.js';
import { PDF } from './pdf-engine.js';

export const Utils = {
    getPdfCoords(e, scale) {
        const rect = PDF.canvas.getBoundingClientRect(); 
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        return { x, y };
    },
    
    checkCanvasBounds(e, rect) {
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
            while(!whiteKeys.includes(currentMidi % 12)) currentMidi += direction;
        }
        return CONFIG.NOTE_NAMES[currentMidi % 12];
    }
};