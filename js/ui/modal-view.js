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
        const btn = document.getElementById('tempo-unit-btn');
        
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
            btn.innerText = symbol;
        } else {
            // Defaults
            input.value = '';
            State.pendingTempoUnit = 4; // Quarter note default
            btn.innerText = '𝅘𝅥';
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
        document.getElementById('tempo-unit-btn').innerText = symbol;
        document.getElementById('tempo-dropdown').classList.add('hidden');
    },

    submitTempo() {
        const val = document.getElementById('tempo-value').value || '60';
        const unit = State.pendingTempoUnit || 4;
        
        // If we are editing selected notes
        if (State.selectedNotes.length > 0 && State.mode === 'select') {
             State.selectedNotes.forEach(n => {
                 if (n.type === 'tempo') {
                     n.bpm = val;
                     n.duration = unit;
                 }
             });
             NoteRenderer.renderAll();
        } 
        // If we are creating a new one (triggered from Input Manager)
        else if (State.pendingTempoPlacement) {
             const { x, y, systemId } = State.pendingTempoPlacement;
             const part = State.parts.find(p => p.id === State.activePartId);
             if (part) {
                 part.notes.push({
                     x, y, systemId,
                     type: 'tempo',
                     bpm: val,
                     duration: unit,
                     size: 40 // Default size for box calculation
                 });
                 NoteRenderer.renderAll();
             }
             State.pendingTempoPlacement = null;
        }

        UIManager.closeModals();
    }
};
