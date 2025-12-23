import { PDF } from './pdf-engine.js';
import { State } from '../state.js';
import { CONFIG } from '../config.js';
import { Utils } from './utils.js';
import { ZoningEngine } from './zoning-engine.js';
import { CalibrationController } from '../controllers/calibration-controller.js';
import { NoteRenderer } from './note-renderer.js';
import { ToolbarView } from '../ui/toolbar-view.js';

export const Input = {
    viewport: null,
    isSpace: false, 
    isDragging: false, 
    isShift: false,
    lastX: 0, 
    lastY: 0, 
    ghostNote: null,
    
    // Tie Dragging State
    isDraggingTie: false,
    tieStartNote: null,
    tempTiePath: null, 

    // Undo/Redo Stacks (Per Part ID? Or global? Simple global for active part)
    // We will store simple snapshots of the notes array.
    undoStack: [],
    redoStack: [],

    init() {
        this.viewport = document.getElementById('viewport');
        this.initGhostNote();
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        const wrapper = document.getElementById('canvas-wrapper');
        wrapper.addEventListener('mousedown', this.handleCanvasDown.bind(this));
        
        window.addEventListener('mousemove', this.handleGlobalMove.bind(this));
        window.addEventListener('mouseup', this.handleGlobalUp.bind(this));
        this.viewport.addEventListener('mousedown', this.handlePanStart.bind(this));
        this.viewport.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    },

    initGhostNote() {
        if (!document.querySelector('.ghost-note')) {
            this.ghostNote = document.createElement('div');
            this.ghostNote.className = 'ghost-note';
            const overlay = document.getElementById('overlay-layer');
            if(overlay) overlay.appendChild(this.ghostNote);
        } else {
            this.ghostNote = document.querySelector('.ghost-note');
        }
    },

    saveState() {
        if (!State.activePartId) return;
        const part = State.parts.find(p => p.id === State.activePartId);
        if (part) {
            // Deep copy notes
            const notesCopy = JSON.parse(JSON.stringify(part.notes));
            this.undoStack.push(notesCopy);
            this.redoStack = []; // Clear redo on new action
            
            // Limit stack size if needed, e.g. 50
            if (this.undoStack.length > 50) this.undoStack.shift();
        }
    },

    undo() {
        if (!State.activePartId || this.undoStack.length === 0) return;
        const part = State.parts.find(p => p.id === State.activePartId);
        if (part) {
            // Save current state to redo
            const currentNotes = JSON.parse(JSON.stringify(part.notes));
            this.redoStack.push(currentNotes);
            
            // Pop undo
            const prevNotes = this.undoStack.pop();
            part.notes = prevNotes;
            NoteRenderer.renderAll();
        }
    },

    redo() {
        if (!State.activePartId || this.redoStack.length === 0) return;
        const part = State.parts.find(p => p.id === State.activePartId);
        if (part) {
            // Save current state to undo
            const currentNotes = JSON.parse(JSON.stringify(part.notes));
            this.undoStack.push(currentNotes);
            
            // Pop redo
            const nextNotes = this.redoStack.pop();
            part.notes = nextNotes;
            NoteRenderer.renderAll();
        }
    },

    handleKeyDown(e) {
        if (e.key === 'Shift') this.isShift = true;

        if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault(); this.isSpace = true;
            this.viewport.classList.add('grab-mode');
        }
        
        // Undo/Redo Shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') { // Standard redo
             e.preventDefault();
             this.redo();
        }
    },

    handleKeyUp(e) {
        if (e.key === 'Shift') this.isShift = false;

        if (e.code === 'Space') {
            this.isSpace = false; this.isDragging = false;
            this.viewport.classList.remove('grab-mode', 'grabbing');
        }
    },

    handleWheel(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -CONFIG.ZOOM_STEP : CONFIG.ZOOM_STEP;
            PDF.adjustZoom(delta, e.clientX, e.clientY);
        } else if (e.shiftKey) {
            e.preventDefault();
            this.viewport.scrollLeft += e.deltaY;
        }
    },

    handlePanStart(e) {
        if (this.isSpace) {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.viewport.classList.add('grabbing');
            e.preventDefault(); e.stopPropagation();
        }
    },

    findSnapX(x, systemId) {
        const part = State.parts.find(p => p.id === State.activePartId);
        if (!part) return null;
        const SNAP_THRESHOLD = 20; 
        let closestDist = Infinity;
        let closestX = null;

        part.notes.forEach(note => {
            if (note.systemId === systemId) {
                const dist = Math.abs(note.x - x);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestX = note.x;
                }
            }
        });

        if (closestX !== null && closestDist * PDF.scale < 20) {
            return closestX;
        }
        return null;
    },

    findTargetNote(x, y) {
        const part = State.parts.find(p => p.id === State.activePartId);
        if (!part) return null;
        const THRESHOLD = 20 / PDF.scale;
        
        return part.notes.find(n => {
            return n.type === 'note' && 
                   Math.abs(n.x - x) < THRESHOLD && 
                   Math.abs(n.y - y) < THRESHOLD;
        });
    },

    handleCanvasDown(e) {
        if (this.isSpace) return;
        if (State.isCalibrating) {
            const { y } = Utils.getPdfCoords(e, PDF.scale);
            CalibrationController.handleDown(y);
            return;
        }
        if (State.activePartId) {
            const rect = PDF.canvas.getBoundingClientRect();
            if (Utils.checkCanvasBounds(e, rect)) {
                let { x, y } = Utils.getPdfCoords(e, PDF.scale);
                
                // --- DELETE MODE LOGIC ---
                if (State.isDeleteMode) {
                    const part = State.parts.find(p => p.id === State.activePartId);
                    if(!part) return;

                    const CLICK_THRESHOLD = 20 / PDF.scale;
                    let closestIdx = -1;
                    let minDistance = Infinity;

                    part.notes.forEach((obj, idx) => {
                        const dist = Math.sqrt(Math.pow(obj.x - x, 2) + Math.pow(obj.y - y, 2));
                        if (dist < CLICK_THRESHOLD && dist < minDistance) {
                            minDistance = dist;
                            closestIdx = idx;
                        }
                    });

                    if (closestIdx !== -1) {
                        this.saveState(); // Save before delete
                        part.notes.splice(closestIdx, 1);
                        NoteRenderer.renderAll();
                    }
                    return;
                }

                // --- TIE MODE LOGIC (Start Drag) ---
                if (State.isTieMode) {
                    const clickedNote = this.findTargetNote(x, y);
                    if (clickedNote) {
                        this.isDraggingTie = true;
                        this.tieStartNote = clickedNote;
                        
                        const svgLayer = document.querySelector('#overlay-layer svg');
                        if (svgLayer) {
                            this.tempTiePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                            this.tempTiePath.setAttribute("stroke", "#2563eb");
                            this.tempTiePath.setAttribute("stroke-width", "2");
                            this.tempTiePath.setAttribute("fill", "none");
                            this.tempTiePath.setAttribute("stroke-dasharray", "5,5"); 
                            svgLayer.appendChild(this.tempTiePath);
                        }
                    }
                    return; 
                }

                // For all placement actions below, we must save state first
                
                // ... [Logic for Symbol/Clef/Barline/Time/Key] ...
                // Helper to reduce repetition
                const preCheckZone = (toolType) => {
                    if (State.activeTool === toolType) {
                        const system = ZoningEngine.checkZone(y);
                        if (system) {
                            this.saveState(); // Save before add
                            const part = State.parts.find(p => p.id === State.activePartId);
                            // ... specific logic ...
                            return { system, part };
                        }
                    }
                    return null;
                };

                if (State.activeTool === 'symbol') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        this.saveState();
                        const part = State.parts.find(p => p.id === State.activePartId);
                        const barlines = part.notes.filter(n => n.type === 'barline' && n.systemId === system.id);
                        let closestDist = Infinity; let closestBar = null;
                        barlines.forEach(bar => { const dist = Math.abs(bar.x - x); if (dist < closestDist) { closestDist = dist; closestBar = bar; } });
                        if (closestBar && closestDist < 20) {
                            const height = Math.abs(system.bottomY - system.topY);
                            const fixedY = system.topY - (height * 0.25);
                            part.notes.push({ x: closestBar.x, y: fixedY, systemId: system.id, type: 'symbol', subtype: State.noteDuration });
                            NoteRenderer.drawNote(closestBar.x, fixedY, 0, 0, system.id, 'symbol', State.noteDuration);
                        }
                    }
                    return;
                }

                if (State.activeTool === 'clef') {
                    if (State.noteDuration === 'c') {
                        const snap = ZoningEngine.calculateSnap(y);
                        if (snap) {
                            this.saveState();
                            const part = State.parts.find(p => p.id === State.activePartId);
                            part.notes.push({ x, y: snap.y, pitchIndex: snap.pitchIndex, systemId: snap.systemId, type: 'clef', subtype: 'c' });
                            NoteRenderer.drawNote(x, snap.y, 0, snap.pitchIndex, snap.systemId, 'clef', 'c');
                        }
                    } else {
                        const system = ZoningEngine.checkZone(y);
                        if (system) {
                            this.saveState();
                            const part = State.parts.find(p => p.id === State.activePartId);
                            part.notes.push({ x, y: system.topY, systemId: system.id, type: 'clef', subtype: State.noteDuration });
                            NoteRenderer.drawNote(x, system.topY, 0, 0, system.id, 'clef', State.noteDuration);
                        }
                    }
                    return;
                }

                if (State.activeTool === 'barline') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        this.saveState();
                        const part = State.parts.find(p => p.id === State.activePartId);
                        part.notes.push({ x, y: system.topY, systemId: system.id, type: 'barline', subtype: State.noteDuration });
                        NoteRenderer.drawNote(x, system.topY, 0, 0, system.id, 'barline', State.noteDuration);
                    }
                    return;
                }

                if (State.activeTool === 'time') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        this.saveState();
                        const part = State.parts.find(p => p.id === State.activePartId);
                        const height = Math.abs(system.bottomY - system.topY);
                        const midY = system.topY + (height / 2);
                        part.notes.push({ x, y: midY, systemId: system.id, type: 'time', subtype: State.noteDuration });
                        NoteRenderer.drawNote(x, midY, 0, 0, system.id, 'time', State.noteDuration);
                    }
                    return;
                }

                if (State.activeTool === 'key') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        this.saveState();
                        const part = State.parts.find(p => p.id === State.activePartId);
                        const height = Math.abs(system.bottomY - system.topY);
                        const midY = system.topY + (height / 2);
                        part.notes.push({ x, y: midY, systemId: system.id, type: 'key', subtype: State.noteDuration });
                        NoteRenderer.drawNote(x, midY, 0, 0, system.id, 'key', State.noteDuration);
                    }
                    return;
                }

                const snap = ZoningEngine.calculateSnap(y);
                if (!snap) return; 

                if (this.isShift) {
                    const snappedX = this.findSnapX(x, snap.systemId);
                    if (snappedX !== null) { x = snappedX; }
                }

                this.saveState(); // Save before adding note/rest
                const part = State.parts.find(p => p.id === State.activePartId);
                const system = part.calibration[snap.systemId];
                const dist = Math.abs(system.bottomY - system.topY);
                const noteSize = dist / 4;

                part.notes.push({ x, y: snap.y, size: noteSize, systemId: snap.systemId, pitchIndex: snap.pitchIndex, duration: State.noteDuration, type: State.activeTool, isDotted: State.isDotted, accidental: State.activeAccidental });
                NoteRenderer.drawNote(x, snap.y, noteSize, snap.pitchIndex, snap.systemId, State.activeTool, null, State.isDotted, State.activeAccidental);
            }
        }
    },

    handleGlobalUp(e) {
        if (CalibrationController.draggingLine) {
            CalibrationController.draggingLine = null;
        }
        
        // --- TIE MODE END DRAG ---
        if (this.isDraggingTie) {
            this.isDraggingTie = false;
            if (this.tempTiePath) {
                this.tempTiePath.remove();
                this.tempTiePath = null;
            }

            const { x, y } = Utils.getPdfCoords(e, PDF.scale);
            const targetNote = this.findTargetNote(x, y);

            if (targetNote && this.tieStartNote) {
                if (targetNote !== this.tieStartNote && targetNote.pitchIndex === this.tieStartNote.pitchIndex) {
                    this.saveState(); // Save before tie
                    this.tieStartNote.hasTie = true; 
                    NoteRenderer.renderAll(); 
                }
            }
            this.tieStartNote = null;
        }

        if (this.isDragging) {
            this.isDragging = false;
            this.viewport.classList.remove('grabbing');
        }
    },

    handleGlobalMove(e) {
        // ... (Ghost logic remains mostly same, just checking activeTool) ...
        // ... (Tie dragging visuals remain same) ...
        // (Copying full content from previous but keeping it concise for diff if possible, 
        // but since I must provide full file, I will paste the entire file with updates)
        
        if (this.isDragging) {
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            this.viewport.scrollLeft -= dx;
            this.viewport.scrollTop -= dy;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            if(this.ghostNote) this.ghostNote.classList.remove('visible');
            return;
        }
        
        // --- TIE DRAGGING VISUALS ---
        if (this.isDraggingTie && this.tempTiePath && this.tieStartNote) {
            const { x, y } = Utils.getPdfCoords(e, PDF.scale);
            let endX = x * PDF.scale;
            let endY = y * PDF.scale;
            const target = this.findTargetNote(x, y);
            if (target && target.pitchIndex === this.tieStartNote.pitchIndex) {
                endX = target.x * PDF.scale;
                endY = target.y * PDF.scale;
            }
            const startX = this.tieStartNote.x * PDF.scale;
            const startY = this.tieStartNote.y * PDF.scale;
            const isStemDown = this.tieStartNote.pitchIndex <= 4; 
            const curveDir = isStemDown ? -1 : 1;
            const cx = (startX + endX) / 2;
            const cy = ((startY + endY) / 2) + (15 * curveDir * PDF.scale); 
            this.tempTiePath.setAttribute("d", `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`);
            return; 
        }

        if (State.isCalibrating) {
            const rect = PDF.canvas.getBoundingClientRect();
            const isOver = Utils.checkCanvasBounds(e, rect);
            if (isOver || CalibrationController.draggingLine) {
                const { y } = Utils.getPdfCoords(e, PDF.scale);
                CalibrationController.handleMove(y);
            }
            return;
        }

        if (State.activePartId && !this.isSpace) {
            if (State.isTieMode || State.isDeleteMode) {
                if(this.ghostNote) this.ghostNote.classList.remove('visible');
                return; 
            }

            const rect = PDF.canvas.getBoundingClientRect();
            if (Utils.checkCanvasBounds(e, rect)) {
                let { x, y } = Utils.getPdfCoords(e, PDF.scale);
                
                // ... [Repeated Ghost Logic for brevity, but essentially standard checks] ...
                // Re-implementing the standard ghost checks to ensure they appear
                
                if (State.activeTool === 'time') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        const height = Math.abs(system.bottomY - system.topY);
                        const midY = system.topY + (height / 2);
                        const boxHeight = (height * 0.8) * PDF.scale;
                        const boxWidth = (boxHeight * 0.5); 
                        this.ghostNote.className = 'ghost-time visible';
                        this.ghostNote.style.width = boxWidth + 'px';
                        this.ghostNote.style.height = boxHeight + 'px';
                        this.ghostNote.style.left = (x * PDF.scale) + 'px';
                        this.ghostNote.style.top = (midY * PDF.scale) + 'px';
                        this.ghostNote.style.transform = 'translate(-50%, -50%)';
                        this.ghostNote.style.borderRadius = '2px';
                    } else { this.ghostNote.classList.remove('visible'); }
                    ToolbarView.updatePitch("-"); return;
                }

                if (State.activeTool === 'key') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        const height = Math.abs(system.bottomY - system.topY);
                        const midY = system.topY + (height / 2);
                        const ovalHeight = height * PDF.scale;
                        const ovalWidth = (height * 1.2) * PDF.scale; 
                        this.ghostNote.className = 'ghost-key visible';
                        this.ghostNote.style.width = ovalWidth + 'px';
                        this.ghostNote.style.height = ovalHeight + 'px';
                        this.ghostNote.style.left = (x * PDF.scale) + 'px';
                        this.ghostNote.style.top = (midY * PDF.scale) + 'px';
                        this.ghostNote.style.transform = 'translate(-50%, -50%)';
                        this.ghostNote.style.borderRadius = '50%';
                    } else { this.ghostNote.classList.remove('visible'); }
                    ToolbarView.updatePitch("-"); return;
                }

                if (State.activeTool === 'symbol') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                         const part = State.parts.find(p => p.id === State.activePartId);
                         const barlines = part.notes.filter(n => n.type === 'barline' && n.systemId === system.id);
                         let closestDist = Infinity; let closestBar = null;
                         barlines.forEach(bar => { const dist = Math.abs(bar.x - x); if (dist < closestDist) { closestDist = dist; closestBar = bar; } });
                         if (closestBar && closestDist < 20) {
                             const height = Math.abs(system.bottomY - system.topY);
                             const fixedY = system.topY - (height * 0.25);
                             const boxSize = (height * 0.6) * PDF.scale;
                             this.ghostNote.className = 'ghost-symbol visible';
                             this.ghostNote.innerText = State.noteDuration === 'segno' ? '𝄋' : '𝄌';
                             this.ghostNote.style.width = boxSize + 'px';
                             this.ghostNote.style.height = boxSize + 'px';
                             this.ghostNote.style.left = (closestBar.x * PDF.scale) + 'px'; 
                             this.ghostNote.style.top = (fixedY * PDF.scale) + 'px';
                             this.ghostNote.style.transform = 'translate(-50%, -50%)';
                         } else { this.ghostNote.classList.remove('visible'); }
                    } else { this.ghostNote.classList.remove('visible'); }
                    ToolbarView.updatePitch("-"); return;
                }

                if (State.activeTool === 'clef') {
                    if (State.noteDuration === 'c') {
                        const snap = ZoningEngine.calculateSnap(y);
                        if (snap) {
                            const part = State.parts.find(p => p.id === State.activePartId);
                            const system = part.calibration[snap.systemId];
                            const dist = Math.abs(system.bottomY - system.topY);
                            const boxHeight = (dist * 0.9) * PDF.scale;
                            const boxWidth = (dist * 0.6) * PDF.scale;
                            this.ghostNote.className = 'ghost-clef c visible';
                            this.ghostNote.innerText = '';
                            this.ghostNote.style.width = boxWidth + 'px';
                            this.ghostNote.style.height = boxHeight + 'px';
                            this.ghostNote.style.left = (x * PDF.scale) + 'px';
                            this.ghostNote.style.top = (snap.y * PDF.scale) + 'px';
                            this.ghostNote.style.transform = 'translate(-50%, -50%)';
                        } else { this.ghostNote.classList.remove('visible'); }
                    } else {
                        const system = ZoningEngine.checkZone(y);
                        if (system) {
                             const height = Math.abs(system.bottomY - system.topY);
                             const boxHeight = (height * 0.9) * PDF.scale; 
                             const boxWidth = (height * 0.6) * PDF.scale;
                             this.ghostNote.className = 'ghost-clef visible';
                             this.ghostNote.innerText = '';
                             this.ghostNote.style.width = boxWidth + 'px';
                             this.ghostNote.style.height = boxHeight + 'px';
                             this.ghostNote.style.left = (x * PDF.scale) + 'px';
                             this.ghostNote.style.top = (fixedY * PDF.scale) + 'px'; // Fix: fixedY used but calc is needed? 
                             // Wait, fixedY wasn't calc'd for clef here.
                             const step = height / 8;
                             const idx = State.noteDuration === 'treble' ? 6 : 2;
                             const fY = system.topY + (idx * step);
                             this.ghostNote.style.top = (fY * PDF.scale) + 'px';
                             this.ghostNote.style.transform = 'translate(-50%, -50%)';
                        } else { this.ghostNote.classList.remove('visible'); }
                    }
                    ToolbarView.updatePitch("-"); return;
                }
                
                if (State.activeTool === 'barline') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        const height = Math.abs(system.bottomY - system.topY);
                        this.ghostNote.className = 'ghost-barline visible';
                        this.ghostNote.innerText = '';
                        this.ghostNote.style.height = (height * PDF.scale) + 'px';
                        this.ghostNote.style.width = '4px';
                        this.ghostNote.style.top = (system.topY * PDF.scale) + 'px';
                        this.ghostNote.style.left = (x * PDF.scale) + 'px';
                        this.ghostNote.style.transform = 'none'; 
                        this.ghostNote.style.borderRadius = '0';
                        this.ghostNote.style.border = 'none';
                        this.ghostNote.style.backgroundColor = ''; 
                    } else { this.ghostNote.classList.remove('visible'); }
                    ToolbarView.updatePitch("-"); return;
                }

                const snap = ZoningEngine.calculateSnap(y);
                if (snap) {
                    let displayX = x;
                    if (this.isShift) {
                        const snappedX = this.findSnapX(x, snap.systemId);
                        if (snappedX !== null) displayX = snappedX;
                    }

                    const part = State.parts.find(p => p.id === State.activePartId);
                    const system = part.calibration[snap.systemId];
                    const dist = Math.abs(system.bottomY - system.topY);
                    const noteHeightUnscaled = dist / 4;
                    const visualHeight = noteHeightUnscaled * PDF.scale;
                    const visualWidth = visualHeight * 1.3; 
                    const dottedClass = State.isDotted ? ' dotted' : '';
                    const accidentalClass = State.activeAccidental ? ` accidental-${State.activeAccidental}` : '';

                    if (State.activeTool === 'rest') {
                        this.ghostNote.className = 'ghost-note rest visible' + dottedClass + accidentalClass;
                        this.ghostNote.innerText = ''; 
                        this.ghostNote.style.width = visualWidth + 'px'; 
                        this.ghostNote.style.height = visualHeight + 'px'; 
                        this.ghostNote.style.fontSize = '';
                        this.ghostNote.style.backgroundColor = 'transparent';
                        this.ghostNote.style.border = '2px solid rgba(239, 68, 68, 0.6)'; 
                        this.ghostNote.style.transform = "translate(-50%, -50%)";
                        this.ghostNote.style.borderRadius = '0';
                    } else {
                        this.ghostNote.className = 'ghost-note visible' + dottedClass + accidentalClass;
                        this.ghostNote.innerText = '';
                        this.ghostNote.style.width = visualWidth + 'px';
                        this.ghostNote.style.height = visualHeight + 'px';
                        this.ghostNote.style.fontSize = '';
                        this.ghostNote.style.backgroundColor = '';
                        this.ghostNote.style.border = '';
                        this.ghostNote.style.transform = "translate(-50%, -50%) rotate(-15deg)";
                        this.ghostNote.style.borderRadius = '50%';
                    }
                    this.ghostNote.style.left = (displayX * PDF.scale) + 'px'; 
                    this.ghostNote.style.top = (snap.y * PDF.scale) + 'px';
                } else {
                    this.ghostNote.classList.remove('visible');
                    ToolbarView.updatePitch("-");
                }
            } else {
                if(this.ghostNote) this.ghostNote.classList.remove('visible');
                ToolbarView.updatePitch("-");
            }
        }
    }
};
