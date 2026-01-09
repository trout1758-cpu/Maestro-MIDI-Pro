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
    mouseX: 0,
    mouseY: 0,
    ghostNote: null,
    
    // Tie Dragging State
    isDraggingTie: false,
    tieStartNote: null,
    tempTiePath: null,
    
    // Hairpin Dragging State
    isDraggingHairpin: false,
    hairpinOriginX: 0,
    hairpinOriginY: 0,
    hairpinSystemId: null,
    hairpinTempPath: null,

    // Selection State
    isSelectingBox: false,
    selectStartX: 0,
    selectStartY: 0,
    selectBox: null,
    isDraggingSelection: false,
    dragStartX: 0,
    dragStartY: 0,

    // Undo/Redo Stacks
    undoStack: [],
    redoStack: [],

    init() {
        this.viewport = document.getElementById('viewport');
        this.initGhostNote();
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        const wrapper = document.getElementById('canvas-wrapper');
        if (wrapper) {
            wrapper.addEventListener('mousedown', this.handleCanvasDown.bind(this));
        }
        
        window.addEventListener('mousemove', this.handleGlobalMove.bind(this));
        window.addEventListener('mouseup', this.handleGlobalUp.bind(this));
        if (this.viewport) {
            this.viewport.addEventListener('mousedown', this.handlePanStart.bind(this));
            this.viewport.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        }
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
            const notesCopy = JSON.parse(JSON.stringify(part.notes));
            this.undoStack.push(notesCopy);
            this.redoStack = []; 
            if (this.undoStack.length > 50) this.undoStack.shift();
        }
    },

    undo() {
        if (!State.activePartId || this.undoStack.length === 0) return;
        const part = State.parts.find(p => p.id === State.activePartId);
        if (part) {
            const currentNotes = JSON.parse(JSON.stringify(part.notes));
            this.redoStack.push(currentNotes);
            part.notes = this.undoStack.pop();
            State.selectedNotes = []; 
            NoteRenderer.renderAll();
        }
    },

    redo() {
        if (!State.activePartId || this.redoStack.length === 0) return;
        const part = State.parts.find(p => p.id === State.activePartId);
        if (part) {
            const currentNotes = JSON.parse(JSON.stringify(part.notes));
            this.undoStack.push(currentNotes);
            part.notes = this.redoStack.pop();
            State.selectedNotes = []; 
            NoteRenderer.renderAll();
        }
    },

    handleKeyDown(e) {
        if (document.activeElement.tagName === 'INPUT') return;

        if (e.key === 'Shift') this.isShift = true;
        
        if (e.key === '.' && !e.repeat) {
            e.preventDefault();
            const dotBtn = document.querySelector('button[title="Dot"]');
            if (dotBtn) {
                ToolbarView.toggleDot(dotBtn);
                this.handleGlobalMove({ clientX: this.mouseX, clientY: this.mouseY });
            }
        }

        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault(); this.isSpace = true;
            if(this.viewport) this.viewport.classList.add('grab-mode');
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) this.redo(); else this.undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { 
             e.preventDefault(); this.redo();
        }
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
             if (State.selectedNotes.length > 0) {
                 this.saveState();
                 const part = State.parts.find(p => p.id === State.activePartId);
                 if (part) {
                     part.notes = part.notes.filter(n => !State.selectedNotes.includes(n));
                     State.selectedNotes = [];
                     NoteRenderer.renderAll();
                 }
             }
        }
    },

    handleKeyUp(e) {
        if (document.activeElement.tagName === 'INPUT') return;

        if (e.key === 'Shift') this.isShift = false;
        
        if (e.key === '.') {
            e.preventDefault();
            const dotBtn = document.querySelector('button[title="Dot"]');
            if (dotBtn) {
                ToolbarView.toggleDot(dotBtn); 
                this.handleGlobalMove({ clientX: this.mouseX, clientY: this.mouseY });
            }
        }

        if (e.code === 'Space') {
            this.isSpace = false; this.isDragging = false;
            if(this.viewport) this.viewport.classList.remove('grab-mode', 'grabbing');
        }
    },

    handleWheel(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -CONFIG.ZOOM_STEP : CONFIG.ZOOM_STEP;
            PDF.adjustZoom(delta, e.clientX, e.clientY);
        } else if (e.shiftKey && this.viewport) {
            e.preventDefault();
            this.viewport.scrollLeft += e.deltaY;
        }
    },

    handlePanStart(e) {
        if (this.isSpace && this.viewport) {
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
        let closestDist = Infinity;
        let closestX = null;
        part.notes.forEach(note => {
            if (note.systemId === systemId) {
                const dist = Math.abs(note.x - x);
                if (dist < closestDist) { closestDist = dist; closestX = note.x; }
            }
        });
        if (closestX !== null && closestDist * PDF.scale < 20) return closestX;
        return null;
    },

    findTargetNote(x, y) {
        const part = State.parts.find(p => p.id === State.activePartId);
        if (!part) return null;
        
        const THRESHOLD = 30 / PDF.scale;
        
        let closest = null;
        let minDist = Infinity;

        part.notes.forEach(n => {
            let cx = n.x, cy = n.y;
            // Adjustment for hairpin hit detection (check proximity to center)
            if (n.type === 'hairpin') {
                cx = n.x + (n.width / 2);
            }
            
            const dx = cx - x;
            const dy = cy - y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < THRESHOLD && dist < minDist) {
                minDist = dist;
                closest = n;
            }
        });
        
        return closest;
    },

    calculatePlacement(x, y) {
        const part = State.parts.find(p => p.id === State.activePartId);
        if (!part) return null;

        const zoning = ZoningEngine.checkZone(y);
        
        // --- DYNAMICS (Text & Hairpins) ---
        if (State.activeTool === 'dynamic' || State.activeTool === 'hairpin') {
            if (!zoning) return null;
            
            // Text directions must be strictly BELOW the staff
            if (['rit.', 'acc.', 'poco', 'a_tempo'].includes(State.noteDuration)) {
                if (y < zoning.bottomY) return null;
            } else {
                // Regular dynamics can't be inside staff
                const buffer = 5 / PDF.scale;
                if (y > zoning.topY + buffer && y < zoning.bottomY - buffer) return null;
            }

            const height = Math.abs(zoning.bottomY - zoning.topY);
            
            return {
                x: x,
                y: y,
                systemId: zoning.id,
                type: State.activeTool,
                subtype: State.noteDuration, 
                meta: { height }
            };
        }

        // --- SYMBOLS (Segno, Coda, Fermata, Caesura) ---
        if (State.activeTool === 'symbol') {
            if (!zoning) return null;

            const height = Math.abs(zoning.bottomY - zoning.topY);
            
            // Fermata/Caesura: Floating X, Fixed Y (Above Staff)
            if (State.noteDuration === 'fermata' || State.noteDuration === 'caesura') {
                const fixedY = zoning.topY - (height * 0.25);
                return {
                    x: x,
                    y: fixedY,
                    systemId: zoning.id,
                    type: 'symbol',
                    subtype: State.noteDuration,
                    meta: { height }
                };
            }
            
            // Segno/Coda: Snap to Barline
            const barlines = part.notes.filter(n => n.type === 'barline' && n.systemId === zoning.id);
            let closestDist = Infinity; 
            let closestBar = null;
            
            barlines.forEach(bar => { 
                const dist = Math.abs(bar.x - x); 
                if (dist < closestDist) { closestDist = dist; closestBar = bar; } 
            });
            
            if (closestBar && closestDist < 20) {
                const fixedY = zoning.topY - (height * 0.25);
                return { 
                    x: closestBar.x, 
                    y: fixedY, 
                    systemId: zoning.id, 
                    type: 'symbol', 
                    subtype: State.noteDuration,
                    meta: { height } 
                };
            }
            return null;
        }

        // --- CLEFS ---
        if (State.activeTool === 'clef') {
            if (State.noteDuration === 'c') {
                const snap = ZoningEngine.calculateSnap(y);
                if(snap) {
                    const system = part.calibration[snap.systemId];
                    const height = Math.abs(system.bottomY - system.topY);
                    return { x, y: snap.y, pitchIndex: snap.pitchIndex, systemId: snap.systemId, type: 'clef', subtype: 'c', meta: { height } };
                }
                return null;
            } else if (zoning) {
                const height = Math.abs(zoning.bottomY - zoning.topY);
                return { x, y: zoning.topY, systemId: zoning.id, type: 'clef', subtype: State.noteDuration, meta: { height } };
            }
            return null;
        }

        // --- BARLINES ---
        if (State.activeTool === 'barline') {
            if (zoning) {
                const height = Math.abs(zoning.bottomY - zoning.topY);
                return { x, y: zoning.topY, systemId: zoning.id, type: 'barline', subtype: State.noteDuration, meta: { height } };
            }
            return null;
        }

        // --- TIME ---
        if (State.activeTool === 'time') {
            if (zoning) {
                const height = Math.abs(zoning.bottomY - zoning.topY);
                const midY = zoning.topY + (height / 2);
                return { x, y: midY, systemId: zoning.id, type: 'time', subtype: State.noteDuration, meta: { height } };
            }
            return null;
        }

        // --- KEY ---
        if (State.activeTool === 'key') {
            if (zoning) {
                const height = Math.abs(zoning.bottomY - zoning.topY);
                const midY = zoning.topY + (height / 2);
                return { x, y: midY, systemId: zoning.id, type: 'key', subtype: State.noteDuration, meta: { height } };
            }
            return null;
        }

        // --- NOTES & RESTS ---
        if (State.activeTool === 'note' || State.activeTool === 'rest') {
            const snap = ZoningEngine.calculateSnap(y);
            if (snap) {
                let finalX = x;
                if (this.isShift) {
                    const snappedX = this.findSnapX(x, snap.systemId);
                    if (snappedX !== null) finalX = snappedX;
                }
                const system = part.calibration[snap.systemId];
                const height = Math.abs(system.bottomY - system.topY);
                const noteSize = height / 4;
                
                return { 
                    x: finalX, 
                    y: snap.y, 
                    size: noteSize, 
                    systemId: snap.systemId, 
                    pitchIndex: snap.pitchIndex, 
                    duration: State.noteDuration, 
                    type: State.activeTool, 
                    isDotted: State.isDotted, 
                    accidental: State.activeAccidental,
                    meta: { height, noteSize } 
                };
            }
        }
        
        return null;
    },

    handleCanvasDown(e) {
        if (this.isSpace) return;
        
        if (State.isCalibrating) {
            const { y } = Utils.getPdfCoords(e, PDF.scale);
            CalibrationController.handleDown(y);
            return;
        }

        if (State.activePartId) {
            const rect = PDF.overlay.getBoundingClientRect(); 
            if (Utils.checkCanvasBounds(e, rect)) {
                let { x, y } = Utils.getPdfCoords(e, PDF.scale);
                const part = State.parts.find(p => p.id === State.activePartId);

                if (State.mode === 'delete') {
                    const target = this.findTargetNote(x, y);
                    if (target) {
                        this.saveState();
                        part.notes = part.notes.filter(n => n !== target);
                        State.selectedNotes = State.selectedNotes.filter(n => n !== target);
                        NoteRenderer.renderAll();
                    }
                    return;
                }

                if (State.mode === 'select') {
                    const target = this.findTargetNote(x, y);
                    if (target) {
                        if (State.selectedNotes.includes(target)) {
                            this.isDraggingSelection = true;
                            this.dragStartX = x;
                            this.dragStartY = y;
                            this.saveState();
                            return;
                        }
                        if (this.isShift) {
                            State.selectedNotes.push(target);
                        } else {
                            State.selectedNotes = [target];
                        }
                        this.isDraggingSelection = true;
                        this.dragStartX = x;
                        this.dragStartY = y;
                        this.saveState();
                        NoteRenderer.renderAll();
                        return;
                    }
                    
                    this.isSelectingBox = true;
                    this.selectStartX = x;
                    this.selectStartY = y;
                    
                    if(this.selectBox) this.selectBox.remove();
                    if (!this.isShift) State.selectedNotes = [];
                    
                    NoteRenderer.renderAll(); 

                    this.selectBox = document.createElement('div');
                    this.selectBox.className = 'selection-box';
                    this.selectBox.style.left = (x * PDF.scale) + 'px';
                    this.selectBox.style.top = (y * PDF.scale) + 'px';
                    this.selectBox.style.width = '0px';
                    this.selectBox.style.height = '0px';
                    document.getElementById('overlay-layer').appendChild(this.selectBox);
                    return;
                }

                if (State.mode === 'add') {
                    if (State.isTieMode) {
                        const clickedNote = this.findTargetNote(x, y);
                        if (clickedNote && clickedNote.type === 'note') {
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
                    
                    // --- HAIRPIN DRAGGING LOGIC ---
                    if (State.activeTool === 'hairpin') {
                        const item = this.calculatePlacement(x, y);
                        if (item) {
                            this.isDraggingHairpin = true;
                            this.hairpinOriginX = item.x;
                            this.hairpinOriginY = item.y;
                            this.hairpinSystemId = item.systemId;
                            
                            // Create temp SVG element for live feedback
                            const svgLayer = document.querySelector('#overlay-layer svg');
                            if (svgLayer) {
                                this.hairpinTempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                this.hairpinTempPath.setAttribute("stroke", "#2563eb");
                                this.hairpinTempPath.setAttribute("stroke-width", "2");
                                this.hairpinTempPath.setAttribute("fill", "none");
                                svgLayer.appendChild(this.hairpinTempPath);
                            }
                        }
                        return;
                    }

                    // --- STANDARD ITEM PLACEMENT ---
                    const item = this.calculatePlacement(x, y);
                    if (item) {
                        this.saveState();
                        const { meta, ...cleanItem } = item; 
                        part.notes.push(cleanItem);
                        NoteRenderer.renderAll();
                    }
                }
            }
        }
    },

    handleGlobalUp(e) {
        if (this.isSelectingBox) {
            this.isSelectingBox = false;
            if (this.selectBox) {
                const { x, y } = Utils.getPdfCoords(e, PDF.scale);
                const startX = this.selectStartX;
                const startY = this.selectStartY;
                
                const minX = Math.min(startX, x);
                const maxX = Math.max(startX, x);
                const minY = Math.min(startY, y);
                const maxY = Math.max(startY, y);
                
                const part = State.parts.find(p => p.id === State.activePartId);
                if (part) {
                    const notesInBox = part.notes.filter(n => {
                        return n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY;
                    });
                    if (this.isShift) {
                        notesInBox.forEach(n => { if (!State.selectedNotes.includes(n)) State.selectedNotes.push(n); });
                    } else {
                        State.selectedNotes = notesInBox;
                    }
                }
                this.selectBox.remove();
                this.selectBox = null;
                NoteRenderer.renderAll();
            }
        }
        
        if (this.isDraggingSelection) {
            this.isDraggingSelection = false;
        }

        if (CalibrationController.draggingLine) {
            CalibrationController.draggingLine = null;
        }
        
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
                    this.saveState(); 
                    this.tieStartNote.hasTie = true; 
                    NoteRenderer.renderAll(); 
                }
            }
            this.tieStartNote = null;
        }

        if (this.isDraggingHairpin) {
            this.isDraggingHairpin = false;
            if (this.hairpinTempPath) {
                this.hairpinTempPath.remove();
                this.hairpinTempPath = null;
            }
            
            const { x, y } = Utils.getPdfCoords(e, PDF.scale);
            let width = x - this.hairpinOriginX;
            
            // Only allow forward dragging (width > 0)
            if (width > 10) { 
                this.saveState();
                const part = State.parts.find(p => p.id === State.activePartId);
                part.notes.push({
                    x: this.hairpinOriginX,
                    y: this.hairpinOriginY,
                    systemId: this.hairpinSystemId,
                    type: 'hairpin',
                    subtype: State.noteDuration, 
                    width: width
                });
                NoteRenderer.renderAll();
            }
        }

        if (this.isDragging) {
            this.isDragging = false;
            if(this.viewport) this.viewport.classList.remove('grabbing');
        }
    },

    handleGlobalMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        const { x, y } = Utils.getPdfCoords(e, PDF.scale);

        if (this.isSelectingBox && this.selectBox) {
            const startX = this.selectStartX * PDF.scale;
            const startY = this.selectStartY * PDF.scale;
            const currX = x * PDF.scale;
            const currY = y * PDF.scale;
            const w = Math.abs(currX - startX);
            const h = Math.abs(currY - startY);
            const l = Math.min(currX, startX);
            const t = Math.min(currY, startY);
            this.selectBox.style.width = w + 'px';
            this.selectBox.style.height = h + 'px';
            this.selectBox.style.left = l + 'px';
            this.selectBox.style.top = t + 'px';
        }
        
        if (this.isDraggingSelection && State.selectedNotes.length > 0) {
             const dx = x - this.dragStartX;
             const dy = y - this.dragStartY;
             State.selectedNotes.forEach(n => {
                 n.x += dx;
                 const newY = n.y + dy;
                 
                 // Smart Y Snapping for Notes/Rests vs Free for Dynamics/Symbols
                 if (n.type === 'note' || n.type === 'rest' || (n.type === 'clef' && n.subtype === 'c')) {
                     const zone = ZoningEngine.checkZone(newY);
                     if (zone) {
                         const height = Math.abs(zone.bottomY - zone.topY);
                         const stepSize = height / 8;
                         const relativeY = newY - zone.topY;
                         const newPitchIndex = Math.round(relativeY / stepSize);
                         const snappedY = zone.topY + (newPitchIndex * stepSize);
                         n.y = snappedY;
                         n.pitchIndex = newPitchIndex;
                         n.systemId = zone.id;
                     } else {
                         n.y = newY; 
                     }
                 } else {
                     const zone = ZoningEngine.checkZone(newY);
                     if (zone && zone.id !== n.systemId) {
                         n.systemId = zone.id;
                         const height = Math.abs(zone.bottomY - zone.topY);
                         if (n.type === 'barline') n.y = zone.topY;
                         if (n.type === 'time' || n.type === 'key') n.y = zone.topY + (height / 2);
                     }
                     n.y = newY;
                 }
             });
             this.dragStartX = x;
             this.dragStartY = y;
             NoteRenderer.renderAll(); 
             return;
        }

        if (this.isDraggingHairpin && this.hairpinTempPath) {
             const startX = this.hairpinOriginX * PDF.scale;
             const startY = this.hairpinOriginY * PDF.scale;
             const currX = x * PDF.scale;
             
             // Visual width can't be negative for hairpins
             const width = Math.max(0, currX - startX);
             const endX = startX + width;
             
             let halfOpening = 10 * PDF.scale; 
             
             const part = State.parts.find(p => p.id === State.activePartId);
             if (part && this.hairpinSystemId !== null) {
                 const system = part.calibration[this.hairpinSystemId];
                 if (system) {
                     const sysHeight = Math.abs(system.bottomY - system.topY);
                     halfOpening = (sysHeight * (3/16)) * PDF.scale; 
                 }
             }
             
             const midY = startY;
             const topY = midY - halfOpening;
             const botY = midY + halfOpening;

             if (State.noteDuration === 'crescendo') {
                 this.hairpinTempPath.setAttribute("d", `M ${endX} ${topY} L ${startX} ${midY} L ${endX} ${botY}`);
             } else {
                 this.hairpinTempPath.setAttribute("d", `M ${startX} ${topY} L ${endX} ${midY} L ${startX} ${botY}`);
             }
             return;
        }

        if (this.isDragging) {
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            if(this.viewport) {
                this.viewport.scrollLeft -= dx;
                this.viewport.scrollTop -= dy;
            }
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            if(this.ghostNote) this.ghostNote.classList.remove('visible');
            return;
        }
        
        if (State.isCalibrating) {
            if (this.ghostNote) this.ghostNote.classList.remove('visible');
            const rect = PDF.overlay.getBoundingClientRect(); 
            const isOver = Utils.checkCanvasBounds(e, rect);
            if (isOver || CalibrationController.draggingLine) {
                CalibrationController.handleMove(y);
            }
            return;
        }

        if (State.activePartId && !this.isSpace) {
            if (State.isTieMode || State.mode === 'delete' || State.mode === 'select') {
                if(this.ghostNote) this.ghostNote.classList.remove('visible');
                return; 
            }
            
            const rect = PDF.overlay.getBoundingClientRect(); 
            if (Utils.checkCanvasBounds(e, rect)) {
                
                this.ghostNote.className = 'ghost-note'; 
                this.ghostNote.innerText = '';
                this.ghostNote.style = '';
                
                const item = this.calculatePlacement(x, y);

                if (!item) {
                    this.ghostNote.classList.remove('visible');
                    ToolbarView.updatePitch("-");
                    return;
                }

                // --- GHOST DYNAMICS & TEXT DIRECTIONS ---
                if (item.type === 'dynamic') {
                    const boxHeight = item.meta.height * 0.6 * PDF.scale; 
                    this.ghostNote.classList.add('visible', 'ghost-dynamic');
                    this.ghostNote.style.height = boxHeight + 'px';
                    this.ghostNote.style.minWidth = boxHeight + 'px';
                    this.ghostNote.innerText = item.subtype; 
                    
                    this.ghostNote.style.fontFamily = "'Noto Music', serif";
                    // Smaller font for longer text instructions
                    if (['rit.', 'acc.', 'poco', 'a_tempo'].includes(item.subtype)) {
                         this.ghostNote.style.fontSize = (boxHeight * 0.5) + 'px';
                         this.ghostNote.style.fontStyle = 'italic';
                         this.ghostNote.style.fontFamily = 'serif';
                         this.ghostNote.style.padding = '0 5px';
                    } else {
                         this.ghostNote.style.fontSize = (boxHeight * 0.8) + 'px';
                    }

                    this.ghostNote.style.display = 'flex';
                    this.ghostNote.style.alignItems = 'center';
                    this.ghostNote.style.justifyContent = 'center';
                    this.ghostNote.style.border = '2px solid rgba(56, 189, 248, 0.6)';
                    this.ghostNote.style.color = 'rgba(56, 189, 248, 0.6)';
                    this.ghostNote.style.borderRadius = '4px';

                    this.ghostNote.style.left = (item.x * PDF.scale) + 'px';
                    this.ghostNote.style.top = (item.y * PDF.scale) + 'px';
                    this.ghostNote.style.transform = 'translate(-50%, -50%)';
                    ToolbarView.updatePitch("-");
                    return;
                }

                if (item.type === 'hairpin') {
                    this.ghostNote.classList.remove('visible');
                    ToolbarView.updatePitch("-");
                    return;
                }

                if (item.type === 'barline') {
                    this.ghostNote.classList.add('visible', 'ghost-barline', item.subtype);
                    this.ghostNote.style.height = (item.meta.height * PDF.scale) + 'px';
                    this.ghostNote.style.left = (item.x * PDF.scale) + 'px';
                    this.ghostNote.style.top = (item.y * PDF.scale) + 'px';
                    this.ghostNote.style.transform = 'translateX(-50%)';
                    ToolbarView.updatePitch("-");
                    return;
                }

                if (item.type === 'clef') {
                    if (item.subtype === 'c') {
                        this.ghostNote.classList.add('visible', 'ghost-clef', 'c');
                        this.ghostNote.innerText = '┌';
                        this.ghostNote.style.fontSize = (item.meta.height * 0.8 * PDF.scale) + 'px';
                        this.ghostNote.style.width = (item.meta.height * 0.5 * PDF.scale) + 'px';
                        this.ghostNote.style.height = (item.meta.height * 0.8 * PDF.scale) + 'px';
                        this.ghostNote.style.left = (item.x * PDF.scale) + 'px';
                        this.ghostNote.style.top = (item.y * PDF.scale) + 'px';
                        this.ghostNote.style.transform = 'translate(-50%, -50%)';
                    } else {
                        this.ghostNote.classList.add('visible', 'ghost-clef');
                        this.ghostNote.innerText = (item.subtype === 'treble') ? '' : '┐';
                        this.ghostNote.style.fontSize = (item.meta.height * 0.8 * PDF.scale) + 'px';
                        this.ghostNote.style.width = (item.meta.height * 0.6 * PDF.scale) + 'px';
                        this.ghostNote.style.height = (item.meta.height * 0.8 * PDF.scale) + 'px';
                        this.ghostNote.style.left = (item.x * PDF.scale) + 'px';
                        this.ghostNote.style.top = (item.y * PDF.scale) + 'px';
                        this.ghostNote.style.transform = 'translate(-50%, 0)';
                    }
                    ToolbarView.updatePitch("-");
                    return;
                }

                if (item.type === 'symbol') {
                    this.ghostNote.classList.add('visible', 'ghost-symbol');
                    let symbolChar = '';
                    switch(item.subtype) {
                        case 'segno': symbolChar = '𝄋'; break;
                        case 'coda': symbolChar = '𝄌'; break;
                        case 'fermata': symbolChar = '𝄐'; break;
                        case 'caesura': symbolChar = '//'; break;
                    }
                    this.ghostNote.innerText = symbolChar;
                    this.ghostNote.style.fontSize = (item.meta.height * 0.5 * PDF.scale) + 'px';
                    this.ghostNote.style.left = (item.x * PDF.scale) + 'px';
                    this.ghostNote.style.top = (item.y * PDF.scale) + 'px';
                    this.ghostNote.style.transform = 'translate(-50%, -50%)';
                    ToolbarView.updatePitch("-");
                    return;
                }

                if (item.type === 'time' || item.type === 'key') {
                    const boxHeight = item.meta.height * PDF.scale;
                    const boxWidth = (item.meta.height * 0.6) * PDF.scale;
                    this.ghostNote.classList.add('visible', (item.type === 'time' ? 'ghost-time' : 'ghost-key'));
                    this.ghostNote.style.width = boxWidth + 'px';
                    this.ghostNote.style.height = boxHeight + 'px';
                    this.ghostNote.style.left = (item.x * PDF.scale) + 'px';
                    this.ghostNote.style.top = (item.y * PDF.scale) + 'px';
                    this.ghostNote.style.transform = 'translate(-50%, -50%)';
                    ToolbarView.updatePitch("-");
                    return;
                }

                // NOTES & RESTS
                if (item.type === 'note' || item.type === 'rest') {
                    let visualWidth, visualHeight;
                    const noteSize = item.meta.noteSize;
                    
                    if (item.type === 'rest') {
                        const dur = parseInt(item.duration);
                         switch(dur) {
                            case 1: case 2: visualHeight = noteSize * 0.5; visualWidth = noteSize * 1.2; break;
                            case 4: visualHeight = noteSize * 3; visualWidth = noteSize * 1.1; break;
                            case 8: visualHeight = noteSize * 2; visualWidth = noteSize * 1.1; break;
                            case 16: visualHeight = noteSize * 2.5; visualWidth = noteSize * 1.5; break;
                            default: visualHeight = noteSize * 2; visualWidth = noteSize;
                         }
                    } else {
                        visualHeight = noteSize;
                        visualWidth = noteSize * 1.3;
                    }
                    visualHeight *= PDF.scale;
                    visualWidth *= PDF.scale;
                    
                    const dottedClass = item.isDotted ? ' dotted' : '';
                    const accidentalClass = item.accidental ? ` accidental-${item.accidental}` : '';

                    if (item.type === 'rest') {
                        this.ghostNote.className = 'ghost-note rest visible' + dottedClass + accidentalClass;
                        this.ghostNote.style.border = '2px solid rgba(239, 68, 68, 0.6)'; 
                        this.ghostNote.style.borderRadius = '0';
                        this.ghostNote.style.transform = 'translate(-50%, -50%)';
                    } else {
                        this.ghostNote.className = 'ghost-note note-head visible' + dottedClass + accidentalClass;
                        this.ghostNote.style.borderRadius = '50%';
                        this.ghostNote.style.transform = "translate(-50%, -50%) rotate(-15deg)";
                    }
                    
                    this.ghostNote.style.width = visualWidth + 'px'; 
                    this.ghostNote.style.height = visualHeight + 'px'; 
                    this.ghostNote.style.left = (item.x * PDF.scale) + 'px'; 
                    this.ghostNote.style.top = (item.y * PDF.scale) + 'px';
                    
                    if (item.type === 'note') {
                         ToolbarView.updatePitch(Utils.getPitchName(item.pitchIndex, item.systemId));
                    } else {
                         ToolbarView.updatePitch("-");
                    }
                }

            } else {
                if(this.ghostNote) this.ghostNote.classList.remove('visible');
                ToolbarView.updatePitch("-");
            }
        }
    }
};
