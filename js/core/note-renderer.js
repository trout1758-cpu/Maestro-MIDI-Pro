import { State } from '../state.js';
import { PDF } from './pdf-engine.js';

export const NoteRenderer = {
    renderAll() {
        const overlay = document.getElementById('overlay-layer');
        if (!overlay) return;
        overlay.innerHTML = '';

        // Add SVG Layer for connections (Ties, Hairpins)
        const svgNS = "http://www.w3.org/2000/svg";
        const svgLayer = document.createElementNS(svgNS, "svg");
        svgLayer.style.position = 'absolute';
        svgLayer.style.top = '0';
        svgLayer.style.left = '0';
        svgLayer.style.width = '100%';
        svgLayer.style.height = '100%';
        svgLayer.style.pointerEvents = 'none'; // Let clicks pass through to divs
        overlay.appendChild(svgLayer);

        if (!State.activePartId) return;
        const part = State.parts.find(p => p.id === State.activePartId);
        if (!part) return;

        // Render Connections First (Bottom Layer)
        part.notes.forEach(note => {
            if (note.hasTie && note.type === 'note') {
                const nextNote = this.findNextNote(part.notes, note);
                if (nextNote) {
                    this.drawTie(svgLayer, note, nextNote);
                }
            }
            if (note.type === 'hairpin') {
                this.drawHairpin(svgLayer, note);
            }
        });

        // Render Items
        part.notes.forEach(note => {
            if (note.type !== 'hairpin') { // Hairpins drawn on SVG layer
                this.drawNote(note.x, note.y, note.size, note.pitchIndex, note.systemId, note.type, note.subtype || note.duration, note.isDotted, note.accidental, note);
            }
        });
    },

    findNextNote(allNotes, currentNote) {
        // Find next note of same pitch in same system
        const candidates = allNotes.filter(n => 
            n.systemId === currentNote.systemId && 
            n.pitchIndex === currentNote.pitchIndex && 
            n.x > currentNote.x &&
            n.type === 'note'
        );
        return candidates.sort((a,b) => a.x - b.x)[0];
    },

    drawTie(svgLayer, start, end) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const startX = start.x * PDF.scale;
        const startY = start.y * PDF.scale;
        const endX = end.x * PDF.scale;
        const endY = end.y * PDF.scale;

        const isStemDown = start.pitchIndex <= 4; 
        const curveDir = isStemDown ? -1 : 1;
        
        const cx = (startX + endX) / 2;
        const cy = ((startY + endY) / 2) + (15 * curveDir * PDF.scale);

        path.setAttribute("d", `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`);
        path.setAttribute("stroke", "#2563eb");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("fill", "none");
        
        if (State.selectedNotes.includes(start)) {
             path.setAttribute("stroke", "#22c55e");
        }

        svgLayer.appendChild(path);
    },

    drawHairpin(svgLayer, hairpin) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const startX = hairpin.x * PDF.scale;
        const startY = hairpin.y * PDF.scale;
        const width = hairpin.width * PDF.scale;
        const h = 10 * PDF.scale; // Height of opening

        const color = State.selectedNotes.includes(hairpin) ? "#22c55e" : "#2563eb";
        
        if (hairpin.subtype === 'crescendo') {
             path.setAttribute("d", `M ${startX+width} ${startY-h} L ${startX} ${startY} L ${startX+width} ${startY+h}`);
        } else {
             path.setAttribute("d", `M ${startX} ${startY-h} L ${startX+width} ${startY} L ${startX} ${startY+h}`);
        }

        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("fill", "none");
        
        // Transparent hit area for selection
        const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        hitArea.setAttribute("x", startX);
        hitArea.setAttribute("y", startY - h);
        hitArea.setAttribute("width", width);
        hitArea.setAttribute("height", h*2);
        hitArea.setAttribute("fill", "transparent");
        hitArea.setAttribute("class", "placed-hairpin"); 

        svgLayer.appendChild(path);
        svgLayer.appendChild(hitArea);
    },

    drawNote(x, y, size, pitchIndex, systemId, type, subtype, isDotted, accidental, noteObj) {
        const el = document.createElement('div');
        
        el.style.left = (x * PDF.scale) + 'px';
        el.style.top = (y * PDF.scale) + 'px';
        
        const isSelected = State.selectedNotes.includes(noteObj);
        const selClass = isSelected ? ' selected' : '';

        // --- DYNAMICS ---
        if (type === 'dynamic') {
            el.className = 'placed-dynamic' + selClass;
            el.innerText = subtype;
            
            const part = State.parts.find(p => p.id === State.activePartId);
            const system = part.calibration[systemId];
            if (system) {
                 const height = Math.abs(system.bottomY - system.topY);
                 const boxHeight = height * PDF.scale;
                 const boxWidth = (height * 1.5) * PDF.scale;
                 el.style.width = boxWidth + 'px';
                 el.style.height = boxHeight + 'px';
                 el.style.fontSize = (boxHeight * 0.6) + 'px';
            } else {
                 el.style.width = (40 * PDF.scale) + 'px';
                 el.style.height = (30 * PDF.scale) + 'px';
            }
            
            document.getElementById('overlay-layer').appendChild(el);
            return;
        }

        if (type === 'barline') {
            const part = State.parts.find(p => p.id === State.activePartId);
            const system = part.calibration[systemId];
            const height = Math.abs(system.bottomY - system.topY);
            
            el.className = `placed-barline ${subtype}` + selClass;
            el.style.height = (height * PDF.scale) + 'px';
            el.style.top = (system.topY * PDF.scale) + 'px'; 
            el.style.transform = 'translateX(-50%)';
            document.getElementById('overlay-layer').appendChild(el);
            return;
        }

        if (type === 'clef') {
            const part = State.parts.find(p => p.id === State.activePartId);
            const system = part.calibration[systemId];
            const height = Math.abs(system.bottomY - system.topY);
            
            let renderY = y;
            if (subtype === 'treble') {
                const step = height / 8;
                renderY = system.topY + (6 * step);
            } else if (subtype === 'bass') {
                const step = height / 8;
                renderY = system.topY + (2 * step);
            } 
            
            const boxHeight = (height * 0.9) * PDF.scale;
            const boxWidth = (height * 0.6) * PDF.scale;

            el.className = `placed-clef ${subtype}` + selClass;
            el.style.fontSize = (height * 0.8 * PDF.scale) + 'px';
            el.style.width = boxWidth + 'px';
            el.style.height = boxHeight + 'px';
            el.style.top = (renderY * PDF.scale) + 'px';
            
            if (subtype === 'c') {
                el.innerText = '𝄡';
                el.style.top = (y * PDF.scale) + 'px';
                el.style.transform = 'translate(-50%, -50%)';
            } else {
                el.innerText = subtype === 'treble' ? '𝄞' : '𝄢';
                el.style.transform = 'translate(-50%, 0)';
            }
            document.getElementById('overlay-layer').appendChild(el);
            return;
        }

        if (type === 'time' || type === 'key') {
            const part = State.parts.find(p => p.id === State.activePartId);
            const system = part.calibration[systemId];
            const height = Math.abs(system.bottomY - system.topY);
            
            el.className = (type === 'time' ? 'placed-time' : 'placed-key') + selClass;
            el.style.width = ((height * 0.6) * PDF.scale) + 'px';
            el.style.height = (height * PDF.scale) + 'px';
            document.getElementById('overlay-layer').appendChild(el);
            return;
        }

        if (type === 'symbol') {
            const part = State.parts.find(p => p.id === State.activePartId);
            const system = part.calibration[systemId];
            const height = Math.abs(system.bottomY - system.topY);
            
            el.className = 'placed-symbol' + selClass;
            el.innerText = subtype === 'segno' ? '𝄋' : '𝄌';
            el.style.fontSize = (height * 0.5 * PDF.scale) + 'px';
            document.getElementById('overlay-layer').appendChild(el);
            return;
        }

        // Notes & Rests
        let visualWidth, visualHeight;
        size = size * PDF.scale; 
        
        if (type === 'rest') {
            const dur = parseInt(subtype || 4);
             switch(dur) {
                case 1: case 2: visualHeight = size * 0.5; visualWidth = size * 1.2; break;
                case 4: visualHeight = size * 3; visualWidth = size * 1.1; break;
                case 8: visualHeight = size * 2; visualWidth = size * 1.1; break;
                case 16: visualHeight = size * 2.5; visualWidth = size * 1.5; break;
                default: visualHeight = size * 2; visualWidth = size;
             }
        } else {
            visualHeight = size;
            visualWidth = size * 1.3;
        }
        
        el.style.width = visualWidth + 'px';
        el.style.height = visualHeight + 'px';

        const dottedClass = isDotted ? ' dotted' : '';
        const accidentalClass = accidental ? ` accidental-${accidental}` : '';

        if (type === 'rest') {
            el.className = 'placed-note rest' + dottedClass + accidentalClass + selClass;
        } else {
            el.className = 'placed-note' + dottedClass + accidentalClass + selClass;
        }
        
        // Reset transforms specific to notes
        if (type === 'rest') {
             el.innerText = ''; 
             el.style.border = '2px solid #ef4444'; 
             el.style.backgroundColor = 'transparent';
             el.style.borderRadius = '0';
             el.style.transform = "translate(-50%, -50%)"; 
             if (isSelected) el.style.borderColor = '#22c55e';
        } else {
             el.style.transform = "translate(-50%, -50%) rotate(-15deg)";
        }
        
        document.getElementById('overlay-layer').appendChild(el);
    }
};
