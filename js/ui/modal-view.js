import { State } from '../state.js';
import { UIManager } from './ui-manager.js';

export const ModalView = {
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
    }
};