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
                b.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200'); // Reset visual state
                b.disabled = true;
            });
            State.activeAccidental = null; // Reset logic state
        }
    },

    toggleDot(btn) {
        State.isDotted = !State.isDotted;
        if (State.isDotted) {
            btn.classList.add('active');
            btn.classList.add('text-blue-600');
            btn.classList.add('bg-blue-50');
            btn.classList.add('border-blue-200');
        } else {
            btn.classList.remove('active');
            btn.classList.remove('text-blue-600');
            btn.classList.remove('bg-blue-50');
            btn.classList.remove('border-blue-200');
        }
    },

    toggleAccidental(type, btn) {
        // Prevent toggling if button is effectively disabled/placeholder
        if (btn.classList.contains('placeholder')) return;

        if (State.activeAccidental === type) {
            // Untoggle if clicking same
            State.activeAccidental = null;
            btn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        } else {
            // Activate new one, deactivate others
            State.activeAccidental = type;
            
            // Reset all accidental buttons visual state
            document.querySelectorAll('.accidental-btn').forEach(b => {
                b.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
            });
            
            // Set active visual state
            btn.classList.add('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        }
    }
};
