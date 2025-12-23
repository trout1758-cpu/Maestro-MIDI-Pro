import { State } from '../state.js';

export const ToolbarView = {
    update() {
        const label = document.getElementById('current-part-label');
        const deck = document.getElementById('control-deck');
        const toolContainer = document.getElementById('tool-container');

        if (State.activePartId) {
            const part = State.parts.find(p => p.id === State.activePartId);
            label.innerText = part ? part.name : "Error";
            deck.classList.remove('toolbar-disabled');
            toolContainer.classList.remove('opacity-50');
        } else {
            label.innerText = "No Part Selected";
            deck.classList.add('toolbar-disabled');
            toolContainer.classList.add('opacity-50');
            this.updatePitch("-");
        }
    },

    updatePitch(text) { 
        document.getElementById('pitch-display').innerText = text; 
    },

    toggleCategory(category) {
        const deck = document.getElementById('control-deck');
        const tabs = deck.querySelectorAll('.tab-btn');
        tabs.forEach(t => {
            t.classList.remove('text-blue-600', 'border-blue-600', 'active');
            t.classList.add('text-gray-500', 'border-transparent');
        });
        
        const clickedTab = Array.from(tabs).find(t => t.innerText.toLowerCase().replace('/','').includes(category.replace('/','')));
        if(clickedTab) {
            clickedTab.classList.remove('text-gray-500', 'border-transparent');
            clickedTab.classList.add('text-blue-600', 'border-blue-600', 'active');
        }

        document.querySelectorAll('#tool-container > div').forEach(div => div.classList.add('hidden'));

        const target = document.getElementById(`tools-${category}`);
        if (target) {
            target.classList.remove('hidden');
        }
    },

    selectTool(tool, duration, btn) {
        // Disable special modes when selecting a normal tool
        State.isTieMode = false;
        State.isDeleteMode = false;
        
        // Reset Visuals for special toggles
        const tieBtn = document.querySelector('button[title="Tie"]');
        if(tieBtn) tieBtn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        
        const delBtn = document.getElementById('delete-mode-btn');
        if(delBtn) {
             delBtn.classList.remove('bg-red-600', 'text-white', 'hover:bg-red-700');
             delBtn.classList.add('text-red-600', 'hover:bg-red-50');
        }

        State.activeTool = tool;
        State.noteDuration = duration;
        
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        if(btn) btn.classList.add('active');

        // Logic for Enabling/Disabling Accidentals
        const accidentals = document.querySelectorAll('.accidental-btn');
        if (tool === 'note') {
            accidentals.forEach(b => {
                b.classList.remove('placeholder', 'opacity-50', 'cursor-not-allowed');
                b.disabled = false;
            });
        } else {
            // Disable accidentals
            accidentals.forEach(b => {
                b.classList.add('placeholder', 'opacity-50', 'cursor-not-allowed');
                b.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200'); 
                b.disabled = true;
            });
            State.activeAccidental = null; 
        }
    },

    toggleDot(btn) {
        State.isDotted = !State.isDotted;
        if (State.isDotted) {
            btn.classList.add('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        } else {
            btn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        }
    },

    toggleAccidental(type, btn) {
        if (btn.classList.contains('placeholder')) return;

        if (State.activeAccidental === type) {
            State.activeAccidental = null;
            btn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        } else {
            State.activeAccidental = type;
            document.querySelectorAll('.accidental-btn').forEach(b => {
                b.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
            });
            btn.classList.add('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        }
    },

    toggleTie(btn) {
        // Toggle Tie Mode
        State.isTieMode = !State.isTieMode;
        
        // If Tie is on, Delete must be off
        if (State.isTieMode) {
            State.isDeleteMode = false;
            const delBtn = document.getElementById('delete-mode-btn');
            if(delBtn) {
                delBtn.classList.remove('bg-red-600', 'text-white');
                delBtn.classList.add('text-red-600');
            }
            
            btn.classList.add('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        } else {
            btn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        }
    },

    toggleDelete(btn) {
        State.isDeleteMode = !State.isDeleteMode;
        
        // If Delete is on, Tie must be off
        if (State.isDeleteMode) {
            State.isTieMode = false;
            const tieBtn = document.querySelector('button[title="Tie"]');
            if(tieBtn) tieBtn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');

            // Visuals for active delete button (Solid Red)
            btn.classList.remove('text-red-600', 'hover:bg-red-50');
            btn.classList.add('bg-red-600', 'text-white', 'hover:bg-red-700');
        } else {
            // Visuals for inactive delete button (Outline/Text Red)
            btn.classList.remove('bg-red-600', 'text-white', 'hover:bg-red-700');
            btn.classList.add('text-red-600', 'hover:bg-red-50');
        }
    }
};
