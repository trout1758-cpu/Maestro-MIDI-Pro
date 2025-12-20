import { State } from '../state.js';
import { CONFIG } from '../config.js';
import { ToolbarView } from '../ui/toolbar-view.js';
import { Utils } from './utils.js';

export const ZoningEngine = {
    calculateSnap(y) {
        const part = State.parts.find(p => p.id === State.activePartId);
        if (!part || !part.calibration || part.calibration.length === 0) return null;
        const system = this.findSystemZone(y, part.calibration);
        if (!system) return null;

        let minDist = Infinity;
        let snappedY = y;
        let pitchIndex = 0;

        for (let i = -10; i <= 18; i++) {
            const stepSize = system.height / 8; 
            const targetY = system.topY + (i * stepSize);
            const dist = Math.abs(y - targetY);
            if (dist < minDist) {
                minDist = dist;
                snappedY = targetY;
                pitchIndex = i;
            }
        }

        if (minDist > system.height) return null; 

        const refMidi = CONFIG.CLEF_OFFSETS[part.clef] || 77;
        const noteName = Utils.getNoteName(refMidi, pitchIndex);
        ToolbarView.updatePitch(noteName);

        return { y: snappedY, pitchIndex, systemId: system.id };
    },

    checkZone(y) {
         const part = State.parts.find(p => p.id === State.activePartId);
         if(!part) return null;
         return this.findSystemZone(y, part.calibration);
    },

    findSystemZone(y, systems) {
        if(!systems) return null;
        for (let i = 0; i < systems.length; i++) {
            const sys = systems[i];
            const height = Math.abs(sys.bottomY - sys.topY);
            const buffer = height * 1.5; 
            if (y >= sys.topY - buffer && y <= sys.bottomY + buffer) {
                return { ...sys, height, id: i }; 
            }
        }
        return null;
    }
};