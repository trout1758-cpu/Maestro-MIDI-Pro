import { State } from '../state.js';
import { PDF } from '../core/pdf-engine.js';
import { CONFIG } from '../config.js';
import { UIManager } from '../ui/ui-manager.js';
import { NoteRenderer } from '../core/note-renderer.js';
// We import PartController via window or dynamic import to avoid circular dependency issues in some envs, 
// but ES modules usually handle it. For safety, we will rely on PartController being available via Main Glue 
// OR simpler: just re-importing.
import { PartController } from './part-controller.js';

export const CalibrationController = {
    tempSystems: [], step: 0, sysIndex: 0, draggingLine: null,
    
    enter() {
        const part = State.parts.find(p => p.id === State.editingPartId);
        if (!part) return;
        this.tempSystems = part.calibration ? JSON.parse(JSON.stringify(part.calibration)) : [];
        State.isCalibrating = true;
        document.body.classList.add('calibration-mode');
        UIManager.closeModals();
        this.step = 0;
        this.render();
    },
    
    exit(save) {
        if (save) {
            const part = State.parts.find(p => p.id === State.editingPartId);
            const validSystems = this.tempSystems
                .filter(s => s.topY !== -999 && s.bottomY !== -999)
                .sort((a, b) => a.topY - b.topY);
            if (part) part.calibration = JSON.parse(JSON.stringify(validSystems));
        }
        State.isCalibrating = false;
        document.body.classList.remove('calibration-mode');
        
        // Circular dependency handling: Call part controller logic
        PartController.prepareEdit(State.editingPartId);
        
        if (State.activePartId === State.editingPartId) NoteRenderer.renderAll();
    },
    
    addSystem() {
        this.step = 1;
        if (this.tempSystems.length > 0) this.step = 3; 
        else { this.sysIndex = this.tempSystems.length; this.tempSystems.push({ topY: -999, bottomY: -999 }); }
    },
    
    clearAll() { if(confirm("Clear all lines?")) { this.tempSystems = []; this.render(); } },
    
    render() {
        PDF.overlay.innerHTML = '';
        this.tempSystems.forEach((sys, idx) => {
            if (sys.topY > 0) this.drawLine(sys.topY, 'cal-line top', `System ${idx+1}`);
            if (sys.bottomY > 0) this.drawLine(sys.bottomY, 'cal-line bottom', `System ${idx+1}`);
        });
    },
    
    drawLine(y, cls, title='') {
        const el = document.createElement('div');
        el.className = cls;
        el.style.top = (y * PDF.scale) + 'px'; 
        if (title) el.title = title;
        PDF.overlay.appendChild(el);
    },
    
    handleDown(y) {
        const hit = this.findHit(y);
        if (hit) { this.draggingLine = hit; return; }
        if (this.step === 1) { this.tempSystems[this.sysIndex].topY = y; this.step = 2; }
        else if (this.step === 2) { this.tempSystems[this.sysIndex].bottomY = y; this.step = 0; }
        else if (this.step === 3) {
            const ref = this.tempSystems[0];
            const h = Math.abs(ref.bottomY - ref.topY);
            this.tempSystems.push({ topY: y, bottomY: y + h });
            this.step = 0;
        }
        this.render();
    },
    
    handleMove(y) {
        if (this.draggingLine) {
            const sys = this.tempSystems[this.draggingLine.index];
            if (this.draggingLine.type === 'top') sys.topY = y; else sys.bottomY = y;
            this.render();
            return;
        }
        document.querySelectorAll('.ghost-line').forEach(el => el.remove());
        if (this.step === 1) this.drawLine(y, 'ghost-line top');
        else if (this.step === 2) this.drawLine(y, 'ghost-line bottom');
        else if (this.step === 3 && this.tempSystems.length > 0) {
            const ref = this.tempSystems[0];
            const h = Math.abs(ref.bottomY - ref.topY);
            this.drawLine(y, 'ghost-line top');
            this.drawLine(y + h, 'ghost-line bottom');
        }
    },
    
    findHit(y) {
        const thresh = CONFIG.HIT_THRESHOLD_PX / PDF.scale;
        for (let i = 0; i < this.tempSystems.length; i++) {
            const sys = this.tempSystems[i];
            if (Math.abs(sys.topY - y) < thresh) return { index: i, type: 'top' };
            if (Math.abs(sys.bottomY - y) < thresh) return { index: i, type: 'bottom' };
        }
        return null;
    }
};