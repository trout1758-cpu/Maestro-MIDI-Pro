import { State } from '../state.js';
import { PDF } from './pdf-engine.js';
import { Input } from './input-manager.js';

export const NoteRenderer = {
    renderAll() {
        PDF.overlay.innerHTML = ''; 
        Input.initGhostNote();

        // Create SVG layer for ties
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '40'; 
        PDF.overlay.appendChild(svg);

        if (!State.activePartId) return;

        const part = State.parts.find(p => p.id === State.activePartId);
        if (!part) return;

        // Clone and Sort for sequential logic
        const sortedNotes = [...part.notes].sort((a, b) => {
             // System ID order primarily
             if (a.systemId !== b.systemId) return a.systemId - b.systemId;
             return a.x - b.x;
        });

        // 1. Render all notes
        part.notes.forEach(note => {
            this.drawNote(note.x, note.y, note.size, note.pitchIndex, note.systemId, note.type, note.subtype, note.isDotted, note.accidental);
        });

        // 2. Render ties
        sortedNotes.forEach((note, index) => {
            if (note.type === 'note' && note.hasTie) {
                let nextNote = null;
                for (let i = index + 1; i < sortedNotes.length; i++) {
                    const candidate = sortedNotes[i];
                    if (candidate.type === 'note') {
                        if (candidate.pitchIndex === note.pitchIndex) {
                            nextNote = candidate;
                            break;
                        }
                    }
                }
                this.drawTie(svg, note, nextNote, part);
            }
        });
    },

    drawTie(svg, startNote, endNote, part) {
        const startX = startNote.x * PDF.scale;
        const startY = startNote.y * PDF.scale;
        
        let endX, endY;
        let isDangling = false;

        if (endNote && endNote.systemId === startNote.systemId) {
            endX = endNote.x * PDF.scale;
            endY = endNote.y * PDF.scale;
        } else {
            isDangling = true;
            endX = startX + (40 * PDF.scale); 
            endY = startY;
        }

        const isStemDown = startNote.pitchIndex <= 4; 
        const curveDir = isStemDown ? -1 : 1; 

        const noteRadius = (startNote.size || 10) * PDF.scale;
        const gap = noteRadius * 0.8;
        
        const x1 = startX + gap;
        const y1 = startY;
        const x2 = endX - gap;
        const y2 = endY;

        const cx = (x1 + x2) / 2;
        const cy = ((y1 + y2) / 2) + (15 * curveDir * PDF.scale); 

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
        path.setAttribute("stroke", "#2563eb");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("fill", "none");
        
        if(isDangling) {
             path.setAttribute("stroke-dasharray", "4");
             path.setAttribute("opacity", "0.5");
        }

        svg.appendChild(path);
    },

    drawNote(unscaledX, unscaledY, savedSize, pitchIndex, systemId, type = 'note', subtype = null, isDotted = false, accidental = null) {
        const part = State.parts.find(p => p.id === State.activePartId);
        
        if (type === 'time') {
            const system = part.calibration[systemId];
            if (!system) return;
            const height = Math.abs(system.bottomY - system.topY);
            const midY = system.topY + (height / 2);
            const boxHeight = (height * 0.8) * PDF.scale;
            const boxWidth = (boxHeight * 0.5);
            const el = document.createElement('div');
            el.className = 'placed-time';
            el.style.width = boxWidth + 'px';
            el.style.height = boxHeight + 'px';
            el.style.left = (unscaledX * PDF.scale) + 'px';
            el.style.top = (midY * PDF.scale) + 'px';
            PDF.overlay.appendChild(el);
            return;
        }

        if (type === 'key') {
            const system = part.calibration[systemId];
            if (!system) return;
            const height = Math.abs(system.bottomY - system.topY);
            const midY = system.topY + (height / 2);
            const ovalHeight = height * PDF.scale;
            const ovalWidth = (height * 1.2) * PDF.scale;
            const el = document.createElement('div');
            el.className = 'placed-key';
            el.style.width = ovalWidth + 'px';
            el.style.height = ovalHeight + 'px';
            el.style.left = (unscaledX * PDF.scale) + 'px';
            el.style.top = (midY * PDF.scale) + 'px';
            PDF.overlay.appendChild(el);
            return;
        }

        if (type === 'symbol') {
            const system = part.calibration[systemId];
            if (!system) return;
            const height = Math.abs(system.bottomY - system.topY);
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

        if (type === 'clef') {
            const system = part.calibration[systemId];
            if (!system) return;
            const height = Math.abs(system.bottomY - system.topY);
            let renderY = unscaledY;
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

        if (type === 'barline') {
            const system = part.calibration[systemId];
            if (!system) return;
            const height = Math.abs(system.bottomY - system.topY);
            const el = document.createElement('div');
            el.className = `placed-barline ${subtype || ''}`;
            el.style.height = (height * PDF.scale) + 'px';
            el.style.left = (unscaledX * PDF.scale) + 'px';
            el.style.top = (system.topY * PDF.scale) + 'px';
            PDF.overlay.appendChild(el);
            return;
        }

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
        let classes = type === 'rest' ? 'placed-note rest' : 'placed-note';
        if (isDotted) classes += ' dotted';
        if (accidental) classes += ` accidental-${accidental}`;
        
        el.className = classes;
        
        const scaledSize = renderSize * PDF.scale;
        
        el.style.height = scaledSize + 'px';
        el.style.width = (scaledSize * 1.3) + 'px'; 
        el.style.left = (unscaledX * PDF.scale) + 'px';
        el.style.top = (renderY * PDF.scale) + 'px';
        
        if (type === 'rest') {
             el.innerText = ''; 
             el.style.border = '2px solid #ef4444'; 
             el.style.backgroundColor = 'transparent';
             el.style.borderRadius = '0';
             el.style.transform = "translate(-50%, -50%)"; 
        } else {
             el.style.transform = "translate(-50%, -50%) rotate(-15deg)";
        }
        
        PDF.overlay.appendChild(el);
    }
};
