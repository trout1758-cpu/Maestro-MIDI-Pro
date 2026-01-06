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
            // Check if note object is in selectedNotes array
            const isSelected = State.selectedNotes.includes(note);
            this.drawNote(note.x, note.y, note.size, note.pitchIndex, note.systemId, note.type, note.subtype, note.isDotted, note.accidental, isSelected);
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

    drawNote(unscaledX, unscaledY, savedSize, pitchIndex, systemId, type = 'note', subtype = null, isDotted = false, accidental = null, isSelected = false) {
        const part = State.parts.find(p => p.id === State.activePartId);
        
        const el = document.createElement('div');
        // Add .selected class if selected
        if (isSelected) {
            el.classList.add('selected');
        }

        if (type === 'time') {
            const system = part.calibration[systemId];
            if (!system) return;
            const height = Math.abs(system.bottomY - system.topY);
            const midY = system.topY + (height / 2);
            
            // UPDATED: Full staff height scaling
            const boxHeight = height * PDF.scale;
            const boxWidth = (height * 0.6) * PDF.scale;

            el.className += ' placed-time'; // Append to existing classes
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

            el.className += ' placed-key';
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
            
            el.className += ' placed-symbol';
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
            let boxHeight = (height * 0.9) * PDF.scale;
            let boxWidth = (height * 0.6) * PDF.scale;

            if (subtype === 'treble') {
                // UPDATED Treble Clef Size
                boxHeight = (height * 1.5) * PDF.scale; 
                renderY = system.topY + (0.75 * height);
            } else if (subtype === 'bass') {
                // UPDATED Bass Clef Size
                boxHeight = (height * 0.9) * PDF.scale;
                renderY = system.topY + (0.25 * height);
            } else if (subtype === 'c') {
                boxHeight = (height * 0.8) * PDF.scale;
                boxWidth = (height * 0.5) * PDF.scale;
            }
            
            el.className += ` placed-clef ${subtype}`;
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
            el.className += ` placed-barline ${subtype || ''}`;
            el.style.height = (height * PDF.scale) + 'px';
            el.style.left = (unscaledX * PDF.scale) + 'px';
            el.style.top = (system.topY * PDF.scale) + 'px';
            
            PDF.overlay.appendChild(el);
            return;
        }

        let renderY = unscaledY;
        let renderSize = savedSize;
        let spaceHeight = 20; // fallback

        if (systemId !== undefined && pitchIndex !== undefined) {
            const system = part.calibration[systemId]; 
            if (system) {
                const height = Math.abs(system.bottomY - system.topY);
                spaceHeight = height / 4;
                renderSize = spaceHeight;
                const stepSize = height / 8;
                renderY = system.topY + (pitchIndex * stepSize);
            }
        }
        if (!renderSize) renderSize = 20;

        let classes = type === 'rest' ? 'placed-note rest' : 'placed-note';
        if (isDotted) classes += ' dotted';
        if (accidental) classes += ` accidental-${accidental}`;
        if (isSelected) classes += ' selected'; 
        
        el.className += ' ' + classes; 
        
        let scaledWidth, scaledHeight;

        // UPDATED: Placed Note Sizing
        if (type === 'rest') {
             // Match logic in input-manager.js
             let dur = 4;
             if (savedSize && subtype) dur = parseInt(subtype); // use subtype as duration for rests if available
             else if (savedSize && !subtype && State.noteDuration) dur = parseInt(State.noteDuration); // Fallback if freshly placed

             // If reading from saved note, subtype usually stores duration for rests?
             // In input manager: part.notes.push({ ... subtype: State.noteDuration ... })
             // So note.subtype holds the duration
             
             if (subtype) dur = parseInt(subtype);

             switch(dur) {
                case 1: case 2: scaledHeight = spaceHeight * 0.5; scaledWidth = spaceHeight * 1.2; break;
                case 4: scaledHeight = spaceHeight * 3; scaledWidth = spaceHeight * 1.1; break;
                case 8: scaledHeight = spaceHeight * 2; scaledWidth = spaceHeight * 1.1; break;
                case 16: scaledHeight = spaceHeight * 2.5; scaledWidth = spaceHeight * 1.5; break;
                default: scaledHeight = spaceHeight * 2; scaledWidth = spaceHeight;
             }
             
             scaledHeight *= PDF.scale;
             scaledWidth *= PDF.scale;

             el.innerText = ''; 
             el.style.border = '2px solid #ef4444'; 
             el.style.backgroundColor = 'transparent';
             el.style.borderRadius = '0';
             el.style.transform = "translate(-50%, -50%)"; 
             
             if (isSelected) {
                 el.style.borderColor = '#22c55e';
             }
        } else {
             scaledHeight = renderSize * PDF.scale;
             scaledWidth = (renderSize * 1.3) * PDF.scale;
             el.style.transform = "translate(-50%, -50%) rotate(-15deg)";
        }
        
        el.style.height = scaledHeight + 'px';
        el.style.width = scaledWidth + 'px'; 
        el.style.left = (unscaledX * PDF.scale) + 'px';
        el.style.top = (renderY * PDF.scale) + 'px';
        
        PDF.overlay.appendChild(el);
    }
};
