import { CONFIG } from '../config.js';
import { PDF } from './pdf-engine.js';
import { State } from '../state.js'; // Added for getPitchName access to parts

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
        return CONFIG.NOTE_NAMES[((currentMidi % 12) + 12) % 12];
    },

    // RESTORED: This function was missing but required by the stable InputManager
    getPitchName(pitchIndex, systemId) {
        if (!State.activePartId) return "-";
        const part = State.parts.find(p => p.id === State.activePartId);
        if (!part || !part.calibration[systemId]) return "-";

        // Simple calculation based on G4 reference (assuming Treble clef logic for now as per stable version)
        // This effectively polyfills the missing function to prevent the crash.
        // In a full implementation, this would check the active clef.
        // For now, we use the logic found in ZoningEngine or similar to ensure "it just works".
        const refMidi = 67; // G4
        return this.getNoteName(refMidi, pitchIndex);
    }
};
