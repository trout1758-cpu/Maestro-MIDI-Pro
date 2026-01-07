import { State } from '../state.js';
import { NoteRenderer } from '../core/note-renderer.js';
import { Input } from '../core/input-manager.js';

export const ToolbarView = {
    update() {
        const label = document.getElementById('current-part-label');
        const deck = document.getElementById('control-deck');
        const toolContainer = document.getElementById('tool-container');

        if (State.activePartId) {
            const part = State.parts.find(p => p.id === State.activePartId);
            if (label) label.innerText = part ? part.name : "Error";
            deck.classList.remove('toolbar-disabled');
            toolContainer.classList.remove('opacity-50');
        } else {
            if (label) label.innerText = "No Part Selected";
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
        
        // Robust matching for tab selection
        const cleanCat = category.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const clickedTab = Array.from(tabs).find(t => {
            const cleanTab = t.innerText.replace(/[^a-z0-9]/gi, '').toLowerCase();
            if (cleanCat === 'noterest' && cleanTab.includes('notesrests')) return true;
            return cleanTab.includes(cleanCat);
        });

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

    // --- NEW MODE SWITCHING LOGIC ---

    setAddMode(btn) {
        State.mode = 'add';
        State.selectedNotes = []; 
        NoteRenderer.renderAll();
        this._updateHeaderVisuals(btn);
        
        const deck = document.getElementById('control-deck');
        if(deck) deck.classList.remove('selection-mode-active');
    },

    setSelectMode(btn) {
        State.mode = 'select';
        this._updateHeaderVisuals(btn);
        
        const deck = document.getElementById('control-deck');
        if(deck) deck.classList.add('selection-mode-active');
    },

    toggleDelete(btn) {
        // If items are selected, delete them instantly without changing mode
        if (State.selectedNotes.length > 0) {
            Input.saveState();
            const part = State.parts.find(p => p.id === State.activePartId);
            if (part) {
                part.notes = part.notes.filter(n => !State.selectedNotes.includes(n));
                State.selectedNotes = [];
                NoteRenderer.renderAll();
            }
            return;
        }

        if (State.mode === 'delete') {
            this.setAddMode(document.getElementById('add-mode-btn'));
        } else {
            State.mode = 'delete';
            this._updateHeaderVisuals(btn);
        }
    },

    _updateHeaderVisuals(activeBtn) {
        document.querySelectorAll('.header-tool-btn').forEach(b => {
            b.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
            b.classList.remove('bg-red-600', 'text-white', 'hover:bg-red-700'); 
            b.classList.remove('text-red-600', 'border-red-200');
            
            if (b.id === 'delete-mode-btn') {
                 b.classList.add('text-red-600', 'hover:bg-red-50', 'border-red-200');
            } else {
                 b.classList.add('text-gray-600', 'hover:bg-gray-100');
            }
        });

        if (activeBtn) {
            if (activeBtn.id === 'delete-mode-btn') {
                activeBtn.classList.remove('text-red-600', 'hover:bg-red-50');
                activeBtn.classList.add('bg-red-600', 'text-white', 'hover:bg-red-700');
            } else {
                activeBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
                activeBtn.classList.add('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
            }
        }
    },

    selectTool(tool, subtype, btn) {
        // --- SMART EDIT LOGIC ---
        // If in SELECT mode, clicking a tool MODIFIES the selection instead of changing the placement tool
        if (State.mode === 'select' && State.selectedNotes.length > 0) {
             Input.saveState(); 
             
             State.selectedNotes.forEach(note => {
                 // Only modify if types are compatible (e.g. changing note duration)
                 if (tool === 'note' || tool === 'rest') {
                     if (note.type === 'note' || note.type === 'rest') {
                         note.type = tool; 
                         note.duration = subtype; 
                     }
                 }
             });
             
             NoteRenderer.renderAll();
             return; 
        }
        
        // --- STANDARD TOOL SELECTION ---
        // If we click a tool, we usually want to be in Add Mode
        if (State.mode !== 'add') {
            this.setAddMode(document.getElementById('add-mode-btn'));
        }

        State.activeTool = tool;
        if (tool !== 'select') {
            State.noteDuration = subtype;
        }
        
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
            accidentals.forEach(b => {
                b.classList.add('placeholder', 'opacity-50', 'cursor-not-allowed');
                b.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200'); 
                b.disabled = true;
            });
            State.activeAccidental = null; 
        }
    },

    toggleDot(btn) {
        // Smart Edit: Toggle dot on selected notes
        if (State.mode === 'select' && State.selectedNotes.length > 0) {
            Input.saveState();
            const anyDotted = State.selectedNotes.some(n => n.isDotted);
            const newState = !anyDotted; 
            State.selectedNotes.forEach(n => n.isDotted = newState);
            NoteRenderer.renderAll();
            return;
        }

        State.isDotted = !State.isDotted;
        if (State.isDotted) {
            btn.classList.add('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        } else {
            btn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        }
    },

    toggleAccidental(type, btn) {
        if (btn.classList.contains('placeholder')) return;
        
        // Smart Edit: Toggle accidental on selected notes
        if (State.mode === 'select' && State.selectedNotes.length > 0) {
            Input.saveState();
            State.selectedNotes.forEach(n => {
                if (n.type === 'note') n.accidental = (n.accidental === type) ? null : type;
            });
            NoteRenderer.renderAll();
            return;
        }

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
        State.isTieMode = !State.isTieMode;
        if (State.isTieMode) {
            // Tie is an additive tool, switch to Add mode
            if (State.mode !== 'add') {
                 this.setAddMode(document.getElementById('add-mode-btn'));
            }
            btn.classList.add('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        } else {
            btn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        }
    }
};
