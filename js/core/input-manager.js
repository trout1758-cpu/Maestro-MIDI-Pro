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
    lastX: 0, 
    lastY: 0, 
    ghostNote: null,

    init() {
        this.viewport = document.getElementById('viewport');
        this.initGhostNote();
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Wait for PDF elements to be ready via PDF.initElements() called in main, 
        // but we bind to the wrapper which is always there.
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

    handleKeyDown(e) {
        if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault(); this.isSpace = true;
            this.viewport.classList.add('grab-mode');
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (State.activePartId && !State.isCalibrating) {
                const part = State.parts.find(p => p.id === State.activePartId);
                if (part && part.notes.length > 0) {
                    part.notes.pop();
                    NoteRenderer.renderAll();
                }
            }
        }
    },

    handleKeyUp(e) {
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
                const { x, y } = Utils.getPdfCoords(e, PDF.scale);
                
                // --- SYMBOL LOGIC (Segno/Coda) ---
                if (State.activeTool === 'symbol') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        const part = State.parts.find(p => p.id === State.activePartId);
                        
                        // SNAP TO BARLINE
                        const barlines = part.notes.filter(n => n.type === 'barline' && n.systemId === system.id);
                        let closestDist = Infinity;
                        let closestBar = null;
                        
                        barlines.forEach(bar => {
                            const dist = Math.abs(bar.x - x);
                            if (dist < closestDist) {
                                closestDist = dist;
                                closestBar = bar;
                            }
                        });
                        
                        if (closestBar && closestDist < 20) {
                            const height = Math.abs(system.bottomY - system.topY);
                            // Place fixed above top line
                            const fixedY = system.topY - (height * 0.25);
                            
                            part.notes.push({
                                x: closestBar.x, // Snap x
                                y: fixedY, 
                                systemId: system.id,
                                type: 'symbol',
                                subtype: State.noteDuration 
                            });
                            NoteRenderer.drawNote(closestBar.x, fixedY, 0, 0, system.id, 'symbol', State.noteDuration);
                        }
                    }
                    return;
                }

                // --- CLEF LOGIC ---
                if (State.activeTool === 'clef') {
                    if (State.noteDuration === 'c') {
                        // C-Clef: Needs snapping
                        const snap = ZoningEngine.calculateSnap(y);
                        if (snap) {
                            const part = State.parts.find(p => p.id === State.activePartId);
                            part.notes.push({
                                x,
                                y: snap.y, 
                                pitchIndex: snap.pitchIndex,
                                systemId: snap.systemId,
                                type: 'clef',
                                subtype: 'c'
                            });
                            NoteRenderer.drawNote(x, snap.y, 0, snap.pitchIndex, snap.systemId, 'clef', 'c');
                        }
                    } else {
                        // Treble/Bass: Fixed vertical pos
                        const system = ZoningEngine.checkZone(y);
                        if (system) {
                            const part = State.parts.find(p => p.id === State.activePartId);
                            part.notes.push({
                                x,
                                y: system.topY, 
                                systemId: system.id,
                                type: 'clef',
                                subtype: State.noteDuration 
                            });
                            NoteRenderer.drawNote(x, system.topY, 0, 0, system.id, 'clef', State.noteDuration);
                        }
                    }
                    return;
                }

                // BARLINE LOGIC
                if (State.activeTool === 'barline') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                        const part = State.parts.find(p => p.id === State.activePartId);
                        part.notes.push({
                            x,
                            y: system.topY, 
                            systemId: system.id,
                            type: 'barline',
                            subtype: State.noteDuration 
                        });
                        NoteRenderer.drawNote(x, system.topY, 0, 0, system.id, 'barline', State.noteDuration);
                    }
                    return;
                }

                // NOTE/REST LOGIC
                const snap = ZoningEngine.calculateSnap(y);
                if (!snap) return; 

                const part = State.parts.find(p => p.id === State.activePartId);
                const system = part.calibration[snap.systemId];
                const dist = Math.abs(system.bottomY - system.topY);
                const noteSize = dist / 4;

                part.notes.push({ 
                    x, 
                    y: snap.y, 
                    size: noteSize,
                    systemId: snap.systemId,
                    pitchIndex: snap.pitchIndex,
                    duration: State.noteDuration, // Save Duration
                    type: State.activeTool, // Save Type (Note vs Rest)
                    isDotted: State.isDotted, // Save Dot State
                    accidental: State.activeAccidental // Save Accidental State (null, 'sharp', 'flat', 'natural')
                });
                
                NoteRenderer.drawNote(x, snap.y, noteSize, snap.pitchIndex, snap.systemId, State.activeTool, null, State.isDotted, State.activeAccidental);
            }
        }
    },

    handleGlobalUp(e) {
        if (CalibrationController.draggingLine) {
            CalibrationController.draggingLine = null;
        }
        if (this.isDragging) {
            this.isDragging = false;
            this.viewport.classList.remove('grabbing');
        }
    },

    handleGlobalMove(e) {
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
            const rect = PDF.canvas.getBoundingClientRect();
            if (Utils.checkCanvasBounds(e, rect)) {
                const { x, y } = Utils.getPdfCoords(e, PDF.scale);
                
                // --- SYMBOL GHOST LOGIC ---
                if (State.activeTool === 'symbol') {
                    const system = ZoningEngine.checkZone(y);
                    if (system) {
                         const part = State.parts.find(p => p.id === State.activePartId);
                         const barlines = part.notes.filter(n => n.type === 'barline' && n.systemId === system.id);
                         let closestDist = Infinity;
                         let closestBar = null;
                         
                         barlines.forEach(bar => {
                             const dist = Math.abs(bar.x - x);
                             if (dist < closestDist) {
                                 closestDist = dist;
                                 closestBar = bar;
                             }
                         });
                         
                         if (closestBar && closestDist < 20) {
                             const height = Math.abs(system.bottomY - system.topY);
                             const fixedY = system.topY - (height * 0.25);
                             const boxSize = (height * 0.6) * PDF.scale;
                             
                             this.ghostNote.className = 'ghost-symbol visible';
                             this.ghostNote.innerText = State.noteDuration === 'segno' ? '𝄋' : '𝄌';
                             this.ghostNote.style.width = boxSize + 'px';
                             this.ghostNote.style.height = boxSize + 'px';
                             this.ghostNote.style.left = (closestBar.x * PDF.scale) + 'px'; // Snap ghost
                             this.ghostNote.style.top = (fixedY * PDF.scale) + 'px';
                             this.ghostNote.style.transform = 'translate(-50%, -50%)';
                         } else {
                             this.ghostNote.classList.remove('visible');
                         }
                    } else {
                        this.ghostNote.classList.remove('visible');
                    }
                    ToolbarView.updatePitch("-");
                    return;
                }

                // --- CLEF GHOST LOGIC ---
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
                         } else {
                             this.ghostNote.classList.remove('visible');
                         }
                    } else {
                        const system = ZoningEngine.checkZone(y);
                        if (system) {
                             const height = Math.abs(system.bottomY - system.topY);
                             const boxHeight = (height * 0.9) * PDF.scale; 
                             const boxWidth = (height * 0.6) * PDF.scale;
                             
                             const step = height / 8;
                             const idx = State.noteDuration === 'treble' ? 6 : 2;
                             const fixedY = system.topY + (idx * step);

                             this.ghostNote.className = 'ghost-clef visible';
                             this.ghostNote.innerText = '';
                             this.ghostNote.style.width = boxWidth + 'px';
                             this.ghostNote.style.height = boxHeight + 'px';
                             this.ghostNote.style.left = (x * PDF.scale) + 'px';
                             this.ghostNote.style.top = (fixedY * PDF.scale) + 'px';
                             this.ghostNote.style.transform = 'translate(-50%, -50%)';
                        } else {
                             this.ghostNote.classList.remove('visible');
                        }
                    }
                    ToolbarView.updatePitch("-");
                    return;
                }

                // BARLINE GHOST LOGIC
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
                    } else {
                        this.ghostNote.classList.remove('visible');
                    }
                    ToolbarView.updatePitch("-");
                    return;
                }

                // NOTE/REST GHOST LOGIC
                const snap = ZoningEngine.calculateSnap(y);
                
                if (snap) {
                    const part = State.parts.find(p => p.id === State.activePartId);
                    const system = part.calibration[snap.systemId];
                    const dist = Math.abs(system.bottomY - system.topY);
                    const noteHeightUnscaled = dist / 4;
                    
                    const visualHeight = noteHeightUnscaled * PDF.scale;
                    const visualWidth = visualHeight * 1.3; 
                    
                    // Apply modifier classes
                    const dottedClass = State.isDotted ? ' dotted' : '';
                    const accidentalClass = State.activeAccidental ? ` accidental-${State.activeAccidental}` : '';

                    if (State.activeTool === 'rest') {
                        this.ghostNote.className = 'ghost-note rest visible' + dottedClass + accidentalClass;
                        this.ghostNote.innerText = ''; // Clear Symbol
                        this.ghostNote.style.width = visualWidth + 'px'; // Box size
                        this.ghostNote.style.height = visualHeight + 'px'; // Box size
                        this.ghostNote.style.fontSize = '';
                        this.ghostNote.style.backgroundColor = 'transparent';
                        this.ghostNote.style.border = '2px solid rgba(239, 68, 68, 0.6)'; // Red border
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
                    
                    this.ghostNote.style.left = (x * PDF.scale) + 'px';
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
