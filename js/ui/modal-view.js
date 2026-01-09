import { State } from '../state.js';
import { UIManager } from './ui-manager.js';
import { NoteRenderer } from '../core/note-renderer.js';

export const ModalView = {
    // ... (existing methods) ...
    toggleMenu(id) { UIManager.toggleMenu(id); },
    closeAll() { UIManager.closeModals(); },

    open(mode, part) {
        const title = document.getElementById('modal-title');
        const nameInput = document.getElementById('part-name');
        const instInput = document.getElementById('part-instrument');
        const clefInput = document.getElementById('part-clef');
        const delBtn = document.getElementById('btn-delete-part');

        const isEdit = mode === 'edit';
        title.innerText = isEdit ? "Edit Part" : "Create New Part";
        nameInput.value = part ? part.name : `Part ${State.parts.length + 1}`;
        instInput.value = part ? part.instrument : 'Voice';
        const clef = part ? part.clef : 'treble';
        this.selectClef(clef);
        
        if (isEdit) {
            delBtn.classList.remove('hidden');
        } else {
            delBtn.classList.add('hidden');
        }
        
        this.enableCalibrate();

        document.getElementById('part-modal').classList.add('show');
        UIManager.closeModals(); 
        document.getElementById('part-modal').classList.add('show');
    },

    selectClef(type, btn) {
        document.getElementById('part-clef').value = type;
        document.querySelectorAll('.clef-btn').forEach(b => {
            b.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-600', 'active');
            b.classList.add('text-gray-600');
        });
        if (!btn) {
            const idx = type === 'treble' ? 0 : 1;
            btn = document.querySelectorAll('.clef-btn')[idx];
        }
        btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-600', 'active');
        btn.classList.remove('text-gray-600');
    },

    enableCalibrate() {
        const calBtn = document.getElementById('modal-calibrate-btn');
        calBtn.disabled = false;
        calBtn.classList.remove('cursor-not-allowed', 'bg-gray-50', 'text-gray-400');
        calBtn.classList.add('bg-white', 'text-blue-600', 'border-blue-200', 'hover:bg-blue-50');
    },

    getInputs() {
        return {
            name: document.getElementById('part-name').value,
            instrument: document.getElementById('part-instrument').value,
            clef: document.getElementById('part-clef').value
        };
    },

    // --- TEMPO MODAL LOGIC ---
    openTempoModal(currentVal = null) {
        UIManager.closeModals();
        const modal = document.getElementById('tempo-modal');
        const input = document.getElementById('tempo-value');
        const btnIcon = document.getElementById('tempo-btn-icon');
        
        // Reset or populate
        if (currentVal && currentVal.unit && currentVal.bpm) {
            State.pendingTempoUnit = currentVal.unit;
            input.value = currentVal.bpm;
            
            // Map internal unit to symbol
            let symbol = '𝅘𝅥';
            switch(parseFloat(currentVal.unit)) {
                case 2: symbol = '𝅗𝅥'; break;
                case 8: symbol = '𝅘𝅥𝅮'; break;
                case 4.5: symbol = '𝅘𝅥.'; break;
                case 2.5: symbol = '𝅗𝅥.'; break;
                default: symbol = '𝅘𝅥';
            }
            btnIcon.innerText = symbol;
        } else {
            // Defaults
            input.value = '';
            State.pendingTempoUnit = 4; // Quarter note default
            btnIcon.innerText = '𝅘𝅥';
        }
        
        modal.classList.add('show');
        // Auto focus input
        setTimeout(() => input.focus(), 50);
    },

    toggleTempoDropdown() {
        const dd = document.getElementById('tempo-dropdown');
        dd.classList.toggle('hidden');
    },

    selectTempoUnit(unit, symbol) {
        State.pendingTempoUnit = unit;
        document.getElementById('tempo-btn-icon').innerText = symbol;
        document.getElementById('tempo-dropdown').classList.add('hidden');
    },

    cancelTempo() {
        // If we were in the middle of placing a new tempo mark (pending), revert it
        if (State.pendingTempoNote) {
             const part = State.parts.find(p => p.id === State.activePartId);
             if (part) {
                 part.notes = part.notes.filter(n => n !== State.pendingTempoNote);
                 NoteRenderer.renderAll();
             }
             State.pendingTempoNote = null;
        }
        UIManager.closeModals();
    },

    submitTempo() {
        const val = document.getElementById('tempo-value').value || '60';
        const unit = State.pendingTempoUnit || 4;
        
        // Scenario 1: Smart Edit (triggered via toolbar button on selected items)
        if (State.selectedNotes.length > 0 && State.mode === 'select') {
             State.selectedNotes.forEach(n => {
                 if (n.type === 'tempo') {
                     n.bpm = val;
                     n.duration = unit;
                 }
             });
             NoteRenderer.renderAll();
        } 
        // Scenario 2: New Placement (confirmed)
        else if (State.pendingTempoNote) {
             const part = State.parts.find(p => p.id === State.activePartId);
             if (part) {
                 // Update the pending note in-place
                 State.pendingTempoNote.bpm = val;
                 State.pendingTempoNote.duration = unit;
                 NoteRenderer.renderAll();
             }
             State.pendingTempoNote = null;
        }

        UIManager.closeModals();
    }
};
