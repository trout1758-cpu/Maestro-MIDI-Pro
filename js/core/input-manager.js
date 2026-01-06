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
        if (e.key === 'Shift') this.isShift = true;
        if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT') {
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
        if (e.key === 'Shift') this.isShift = false;
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
            const dx = n.x - x;
            const dy = n.y - y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < THRESHOLD && dist < minDist) {
                minDist = dist;
                closest = n;
            }
        });
        
        return closest;
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

                // --- SELECTION LOGIC ---
                if (State.activeTool === 'select') {
                    const target = this.findTargetNote(x, y);
                    
                    if (target && State.selectedNotes.includes(target)) {
                        this.isDraggingSelection = true;
                        this.dragStartX = x;
                        this.dragStartY = y;
                        this.saveState(); 
                        return; 
                    }

                    if (State.selectionMode === 'multi') {
                         this.isSelectingBox = true;
                         this.selectStartX = x;
                         this.selectStartY = y;
                         this.selectBox = document.createElement('div');
                         this.selectBox.className = 'selection-box';
                         this.selectBox.style.left = (x * PDF.scale) + 'px';
                         this.selectBox.style.top = (y * PDF.scale) + 'px';
                         document.getElementById('overlay-layer').appendChild(this.selectBox);
                         
                         State.selectedNotes = [];
                         NoteRenderer.renderAll();
                    } else {
                         if (target) {
                             State.selectedNotes = [target];
                             this.isDraggingSelection = true;
                             this.dragStartX = x;
                             this.dragStartY = y;
                             this.saveState();
                         } else {
                             State.selectedNotes = [];
                         }
                         NoteRenderer.renderAll();
                    }
                    return;
                }

                // --- DELETE MODE LOGIC ---
                if (State.isDeleteMode) {
                    const target = this.findTargetNote(x, y);
                    if (target) {
                        this.saveState();
                        part.notes = part.notes.filter(n => n !== target);
                        State.selectedNotes = State.selectedNotes.filter(n => n !== target);
                        NoteRenderer.renderAll();
                    }
                    return;
                }

                // --- TIE MODE LOGIC ---
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

                // --- NORMAL PLACEMENT LOGIC ---
                const zoning = ZoningEngine.checkZone(y);
                const placeItem = (item) => {
                    this.saveState();
                    part.notes.push(item);
                    NoteRenderer.drawNote(item.x, item.y, item.size, item.pitchIndex, item.systemId, item.type, item.subtype, item.isDotted, item.accidental);
                };
                
                if (State.activeTool === 'symbol' && zoning) {
                    const barlines = part.notes.filter(n => n.type === 'barline' && n.systemId === zoning.id);
                    let closestDist = Infinity; let closestBar = null;
                    barlines.forEach(bar => { const dist = Math.abs(bar.x - x); if (dist < closestDist) { closestDist = dist; closestBar = bar; } });
                    if (closestBar && closestDist < 20) {
                        const height = Math.abs(zoning.bottomY - zoning.topY);
                        const fixedY = zoning.topY - (height * 0.25);
                        placeItem({ x: closestBar.x, y: fixedY, systemId: zoning.id, type: 'symbol', subtype: State.noteDuration });
                        return;
                    }
                }
                
                if (State.activeTool === 'clef') {
                    if (State.noteDuration === 'c') {
                        const snap = ZoningEngine.calculateSnap(y);
                        if(snap) placeItem({ x, y: snap.y, pitchIndex: snap.pitchIndex, systemId: snap.systemId, type: 'clef', subtype: 'c' });
                        return;
                    } else if (zoning) {
                        placeItem({ x, y: zoning.topY, systemId: zoning.id, type: 'clef', subtype: State.noteDuration });
                        return;
                    }
                }

                if (State.activeTool === 'barline' && zoning) {
                    placeItem({ x, y: zoning.topY, systemId: zoning.id, type: 'barline', subtype: State.noteDuration });
                    return;
                }
                
                if (State.activeTool === 'time' && zoning) {
                    const height = Math.abs(zoning.bottomY - zoning.topY);
                    const midY = zoning.topY + (height / 2);
                    placeItem({ x, y: midY, systemId: zoning.id, type: 'time', subtype: State.noteDuration });
                    return;
                }

                if (State.activeTool === 'key' && zoning) {
                    const height = Math.abs(zoning.bottomY - zoning.topY);
                    const midY = zoning.topY + (height / 2);
                    placeItem({ x, y: midY, systemId: zoning.id, type: 'key', subtype: State.noteDuration });
                    return;
                }

                const snap = ZoningEngine.calculateSnap(y);
                if (snap) {
                    if (this.isShift) {
                        const snappedX = this.findSnapX(x, snap.systemId);
                        if (snappedX !== null) x = snappedX;
                    }
                    const system = part.calibration[snap.systemId];
                    const dist = Math.abs(system.bottomY - system.topY);
                    const noteSize = dist / 4;
                    placeItem({ 
                        x, y: snap.y, size: noteSize, systemId: snap.systemId, pitchIndex: snap.pitchIndex, 
                        duration: State.noteDuration, type: State.activeTool, isDotted: State.isDotted, accidental: State.activeAccidental 
                    });
                }
            }
        }
    },

    handleGlobalUp(e) {
        if (this.isSelectingBox) {
            this.isSelectingBox = false;
            const box = this.selectBox;
            if (box) {
                const { x, y } = Utils.getPdfCoords(e, PDF.scale);
                const startX = this.selectStartX;
                const startY = this.selectStartY;
                
                const minX = Math.min(startX, x);
                const maxX = Math.max(startX, x);
                const minY = Math.min(startY, y);
                const maxY = Math.max(startY, y);
                
                const part = State.parts.find(p => p.id === State.activePartId);
                if (part) {
                    State.selectedNotes = part.notes.filter(n => {
                        return n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY;
                    });
                }
                
                box.remove();
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

        if (this.isDragging) {
            this.isDragging = false;
            if(this.viewport) this.viewport.classList.remove('grabbing');
        }
    },

    handleGlobalMove(e) {
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
            return;
        }
        
        if (this.isDraggingSelection && State.selectedNotes.length > 0) {
             const dx = x - this.dragStartX;
             const dy = y - this.dragStartY;
             
             State.selectedNotes.forEach(n => {
                 n.x += dx;
                 n.y += dy;
             });
             
             this.dragStartX = x;
             this.dragStartY = y;
             NoteRenderer.renderAll(); 
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
        
        if (this.isDraggingTie && this.tempTiePath && this.tieStartNote) {
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
            const rect = PDF.overlay.getBoundingClientRect(); 
            const isOver = Utils.checkCanvasBounds(e, rect);
            if (isOver || CalibrationController.draggingLine) {
                CalibrationController.handleMove(y);
            }
            return;
        }

        if (State.activePartId && !this.isSpace) {
            if (State.isTieMode || State.isDeleteMode || State.activeTool === 'select') {
                if(this.ghostNote) this.ghostNote.classList.remove('visible');
                return; 
            }
            
            const rect = PDF.overlay.getBoundingClientRect(); 
            if (Utils.checkCanvasBounds(e, rect)) {
                if (State.activeTool === 'time') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        const height = Math.abs(system.bottomY - system.topY);
                        const midY = system.topY + (height / 2);
                        
                        // UPDATED: Fill full height, tangent to top and bottom
                        const boxHeight = height * PDF.scale;
                        const boxWidth = (height * 0.6) * PDF.scale; // Adjustable width
                        
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
                            // C-clef usually smaller, roughly 3 spaces
                            const boxHeight = (dist * 0.8) * PDF.scale;
                            const boxWidth = (dist * 0.5) * PDF.scale;
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
                             
                             // UPDATED Clef Sizing
                             // Treble clef (roughly 7-8 spaces tall visually)
                             // Bass clef (roughly 3.5-4 spaces)
                             let boxHeight, boxWidth, fY;
                             const step = height / 8;

                             if (State.noteDuration === 'treble') {
                                 boxHeight = (height * 1.5) * PDF.scale; 
                                 boxWidth = (height * 0.6) * PDF.scale;
                                 // Anchor logic: 2nd line from bottom (G-line) is center
                                 // Top line is system.topY
                                 // G-Line (Line 2) is at topY + 0.75h
                                 fY = system.topY + (0.75 * height); 
                             } else {
                                 // Bass clef
                                 boxHeight = (height * 0.9) * PDF.scale; 
                                 boxWidth = (height * 0.6) * PDF.scale;
                                 // Anchor: 2nd line from top (F-line)
                                 // F-Line (Line 4) is at topY + 0.25h
                                 fY = system.topY + (0.25 * height); 
                             }

                             this.ghostNote.className = 'ghost-clef visible';
                             this.ghostNote.innerText = '';
                             this.ghostNote.style.width = boxWidth + 'px';
                             this.ghostNote.style.height = boxHeight + 'px';
                             this.ghostNote.style.left = (x * PDF.scale) + 'px';
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
                    const dist = Math.abs(system.bottomY - system.topY); // Total staff height (4 spaces)
                    const spaceHeight = dist / 4; 
                    
                    const noteSize = spaceHeight; // Standard note head size
                    let visualWidth, visualHeight;

                    // UPDATED Ghost Sizing Logic
                    if (State.activeTool === 'rest') {
                        // Rest sizes based on duration (1, 2, 4, 8, 16)
                        // Scaling relative to spaceHeight
                        switch(parseInt(State.noteDuration)) {
                            case 1: // Whole
                            case 2: // Half
                                visualHeight = spaceHeight * 0.5;
                                visualWidth = spaceHeight * 1.2;
                                break;
                            case 4: // Quarter
                                visualHeight = spaceHeight * 3;
                                visualWidth = spaceHeight * 1.1;
                                break;
                            case 8: // Eighth
                                visualHeight = spaceHeight * 2;
                                visualWidth = spaceHeight * 1.1;
                                break;
                            case 16: // 16th
                                visualHeight = spaceHeight * 2.5;
                                visualWidth = spaceHeight * 1.5;
                                break;
                            default:
                                visualHeight = spaceHeight * 2;
                                visualWidth = spaceHeight;
                        }
                    } else {
                        // Standard Note
                        visualHeight = noteSize;
                        visualWidth = noteSize * 1.3;
                    }

                    visualHeight *= PDF.scale;
                    visualWidth *= PDF.scale;

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
