import { State } from '../state.js';
import { UIManager } from '../ui/ui-manager.js';
import { ModalView } from '../ui/modal-view.js';
import { PartListView } from '../ui/part-list-view.js';
import { ToolbarView } from '../ui/toolbar-view.js';
import { NoteRenderer } from '../core/note-renderer.js';
import { Input } from '../core/input-manager.js';
import { PDF } from '../core/pdf-engine.js';
import { CalibrationController } from './calibration-controller.js';

export const PartController = {
    prepareCreate() { 
        State.editingPartId = null; 
        UIManager.closeModals(); 
        ModalView.open('create', null); 
    },
    
    prepareEdit(id) { 
        State.editingPartId = id; 
        const part = State.parts.find(p => p.id === id); 
        ModalView.open('edit', part); 
    },
    
    save() {
        const { name, instrument, clef } = ModalView.getInputs();
        const fallbackName = `Part ${State.parts.length + 1}`;

        if (State.editingPartId) {
            const part = State.parts.find(p => p.id === State.editingPartId);
            part.name = name || fallbackName; 
            part.instrument = instrument; 
            part.clef = clef;
        } else {
            const newPart = { 
                id: Date.now(), 
                name: name || fallbackName, 
                instrument, 
                clef, 
                notes: [], 
                calibration: [] 
            };
            State.parts.push(newPart);
            this.setActive(newPart.id);
        }
        UIManager.closeModals();
        PartListView.render();
    },

    saveAndCalibrate() {
        const { name, instrument, clef } = ModalView.getInputs();
        const fallbackName = `Part ${State.parts.length + 1}`;
        
        let partId = State.editingPartId;

        if (partId) {
             const part = State.parts.find(p => p.id === partId);
             part.name = name || fallbackName; part.instrument = instrument; part.clef = clef;
        } else {
             const newPart = { 
                 id: Date.now(), 
                 name: name || fallbackName, 
                 instrument, 
                 clef, 
                 notes: [], 
                 calibration: [] 
             };
             State.parts.push(newPart);
             partId = newPart.id;
             State.editingPartId = partId; 
             this.setActive(partId); 
             PartListView.render(); 
        }
        
        CalibrationController.enter();
    },

    setActive(id) {
        State.activePartId = id;
        ToolbarView.update();
        PartListView.render();
        
        // DATA ISOLATION: Re-render notes. If no part active, canvas clears.
        NoteRenderer.renderAll();
        
        // Clear any lingering ghost notes from previous context
        if (Input.ghostNote) Input.ghostNote.classList.remove('visible');
    },

    confirmDelete() {
        const part = State.parts.find(p => p.id === State.editingPartId);
        document.getElementById('delete-part-name').innerText = part.name;
        document.getElementById('delete-modal').classList.add('show');
    },

    delete() {
        State.parts = State.parts.filter(p => p.id !== State.editingPartId);
        if (State.activePartId === State.editingPartId) {
            State.activePartId = null;
            ToolbarView.update();
            PDF.overlay.innerHTML = ''; // Clear canvas
        }
        UIManager.closeModals();
        PartListView.render();
    }
};