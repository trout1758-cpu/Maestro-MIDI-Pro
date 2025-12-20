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
                    type: State.activeTool // Save Type (Note vs Rest)
                });
                
                NoteRenderer.drawNote(x, snap.y, noteSize, snap.pitchIndex, snap.systemId, State.activeTool);
            }
        }
    },

    handleGlobalUp(e) {
        // Calibration drag end logic if needed, currently implied by lack of move
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
                const snap = ZoningEngine.calculateSnap(y);
                
                if (snap) {
                    const part = State.parts.find(p => p.id === State.activePartId);
                    const system = part.calibration[snap.systemId];
                    const dist = Math.abs(system.bottomY - system.topY);
                    const noteHeightUnscaled = dist / 4;
                    
                    const visualHeight = noteHeightUnscaled * PDF.scale;
                    const visualWidth = visualHeight * 1.3; 
                    
                    if (State.activeTool === 'rest') {
                        this.ghostNote.className = 'ghost-note rest visible';
                        this.ghostNote.innerText = '𝄽';
                        this.ghostNote.style.width = 'auto';
                        this.ghostNote.style.height = 'auto';
                        this.ghostNote.style.fontSize = (visualHeight * 3) + 'px';
                        this.ghostNote.style.backgroundColor = 'transparent';
                        this.ghostNote.style.border = 'none';
                        this.ghostNote.style.transform = "translate(-50%, -50%)";
                    } else {
                        this.ghostNote.className = 'ghost-note visible';
                        this.ghostNote.innerText = '';
                        this.ghostNote.style.width = visualWidth + 'px';
                        this.ghostNote.style.height = visualHeight + 'px';
                        this.ghostNote.style.fontSize = '';
                        this.ghostNote.style.backgroundColor = '';
                        this.ghostNote.style.border = '';
                        this.ghostNote.style.transform = "translate(-50%, -50%) rotate(-15deg)";
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