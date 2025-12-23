import { State } from '../state.js';
import { PDF } from './pdf-engine.js';
import { Input } from './input-manager.js';

export const NoteRenderer = {
    renderAll() {
        PDF.overlay.innerHTML = ''; 
        Input.initGhostNote();

        // Only render notes if there is an active part
        if (!State.activePartId) return;

        const part = State.parts.find(p => p.id === State.activePartId);
        if (!part) return;

        part.notes.forEach(note => {
            this.drawNote(note.x, note.y, note.size, note.pitchIndex, note.systemId, note.type, note.subtype);
        });
    },

    drawNote(unscaledX, unscaledY, savedSize, pitchIndex, systemId, type = 'note', subtype = null) {
        const part = State.parts.find(p => p.id === State.activePartId);
        
        // --- SYMBOL RENDERING (Segno/Coda) ---
        if (type === 'symbol') {
            const system = part.calibration[systemId];
            if (!system) return;
            const height = Math.abs(system.bottomY - system.topY);
            
            // Re-calculate fixed position to ensure consistency
            const fixedY = system.topY - (height * 0.25);
            const boxSize = (height * 0.6) * PDF.scale;
            
            const el = document.createElement('div');
            el.className = 'placed-symbol';
            el.innerText = subtype === 'segno' ? '𝄋' : '𝄌';
            el.style.width = boxSize + 'px';
            el.style.height = boxSize + 'px';
            el.style.left = (unscaledX * PDF.scale) + 'px';
            el.style.top = (fixedY * PDF.scale) + 'px';
            
            PDF.overlay.appendChild(el);
            return;
        }

        // --- CLEF RENDERING ---
        if (type === 'clef') {
            const system = part.calibration[systemId];
            if (!system) return;
            const height = Math.abs(system.bottomY - system.topY);
            
            let renderY = unscaledY;

            // Recalculate fixed positions for render consistency
            if (subtype === 'treble') {
                const step = height / 8;
                renderY = system.topY + (6 * step);
            } else if (subtype === 'bass') {
                const step = height / 8;
                renderY = system.topY + (2 * step);
            } 
            
            const boxHeight = (height * 0.9) * PDF.scale;
            const boxWidth = (height * 0.6) * PDF.scale;

            const el = document.createElement('div');
            el.className = `placed-clef ${subtype}`;
            el.style.width = boxWidth + 'px';
            el.style.height = boxHeight + 'px';
            el.style.left = (unscaledX * PDF.scale) + 'px';
            el.style.top = (renderY * PDF.scale) + 'px';
            
            PDF.overlay.appendChild(el);
            return;
        }

        // --- BARLINE RENDERING ---
        if (type === 'barline') {
            const system = part.calibration[systemId];
            if (!system) return;
            
            const height = Math.abs(system.bottomY - system.topY);
            const el = document.createElement('div');
            // Add specific subtype class
            el.className = `placed-barline ${subtype || ''}`;
            el.style.height = (height * PDF.scale) + 'px';
            el.style.left = (unscaledX * PDF.scale) + 'px';
            el.style.top = (system.topY * PDF.scale) + 'px';
            
            PDF.overlay.appendChild(el);
            return;
        }

        // --- NOTE/REST RENDERING ---
        let renderY = unscaledY;
        let renderSize = savedSize;

        if (systemId !== undefined && pitchIndex !== undefined) {
            const system = part.calibration[systemId]; 
            if (system) {
                const height = Math.abs(system.bottomY - system.topY);
                renderSize = height / 4;
                const stepSize = height / 8;
                renderY = system.topY + (pitchIndex * stepSize);
            }
        }
        if (!renderSize) renderSize = 20;

        const el = document.createElement('div');
        el.className = type === 'rest' ? 'placed-note rest' : 'placed-note';
        
        const scaledSize = renderSize * PDF.scale;
        
        el.style.height = scaledSize + 'px';
        el.style.width = (scaledSize * 1.3) + 'px'; 
        el.style.left = (unscaledX * PDF.scale) + 'px';
        el.style.top = (renderY * PDF.scale) + 'px';
        
        if (type === 'rest') {
             el.innerText = '𝄽'; // Quarter rest placeholder
             el.style.fontSize = (scaledSize * 3) + 'px';
        } else {
             el.style.transform = "translate(-50%, -50%) rotate(-15deg)";
        }
        
        PDF.overlay.appendChild(el);
    }
};
