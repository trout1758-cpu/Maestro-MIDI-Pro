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
            // Handle specific mismatch for "Notes/Rests" -> "noterest" vs "notesrests"
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

    selectTool(tool, subtype, btn) {
        // --- EDIT SELECTED ENTITIES LOGIC ---
        // If we have selected notes and the user clicks a modification tool (not a select tool), apply change.
        if (State.selectedNotes.length > 0 && tool !== 'select') {
             Input.saveState(); // Undo point
             
             State.selectedNotes.forEach(note => {
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
        
        // --- NORMAL TOOL SELECTION ---
        State.isTieMode = false;
        State.isDeleteMode = false;
        State.selectionMode = null;
        
        if (tool !== 'select') {
            State.selectedNotes = []; // Clear selection when switching to placement tool
            NoteRenderer.renderAll();
        }
        
        // Reset Visuals
        const tieBtn = document.querySelector('button[title="Tie"]');
        if(tieBtn) tieBtn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        
        const delBtn = document.getElementById('delete-mode-btn');
        if(delBtn) {
             delBtn.classList.remove('bg-red-600', 'text-white', 'hover:bg-red-700');
             delBtn.classList.add('text-red-600', 'hover:bg-red-50');
        }

        State.activeTool = tool;
        if (tool !== 'select') {
            State.noteDuration = subtype;
        } else {
            State.selectionMode = subtype; // 'single', 'multi'
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
        if (State.selectedNotes.length > 0) {
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
        
        if (State.selectedNotes.length > 0) {
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
        // If selection active, just delete selected
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

        State.isDeleteMode = !State.isDeleteMode;
        
        if (State.isDeleteMode) {
            State.isTieMode = false;
            const tieBtn = document.querySelector('button[title="Tie"]');
            if(tieBtn) tieBtn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');

            btn.classList.remove('text-red-600', 'hover:bg-red-50');
            btn.classList.add('bg-red-600', 'text-white', 'hover:bg-red-700');
        } else {
            btn.classList.remove('bg-red-600', 'text-white', 'hover:bg-red-700');
            btn.classList.add('text-red-600', 'hover:bg-red-50');
        }
    }
};
