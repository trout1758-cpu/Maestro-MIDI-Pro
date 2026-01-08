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

    setAddMode() {
        State.mode = 'add';
        State.selectedNotes = []; 
        NoteRenderer.renderAll();
        
        document.querySelectorAll('.header-tool-btn').forEach(b => {
            b.classList.remove('active', 'bg-blue-50', 'text-blue-600', 'border-blue-200');
            b.classList.add('text-gray-600', 'hover:bg-gray-100');
            
            if (b.id === 'delete-mode-btn') {
                 b.classList.remove('bg-red-600', 'text-white');
                 b.classList.add('text-red-600', 'border-red-200');
            }
        });

        document.getElementById('control-deck').classList.remove('selection-mode-active');
    },

    toggleSelectMode(btn) {
        if (State.mode === 'select') {
            this.setAddMode();
        } else {
            State.mode = 'select';
            
            document.querySelectorAll('.header-tool-btn').forEach(b => {
                b.classList.remove('active', 'bg-blue-50', 'text-blue-600', 'border-blue-200');
                b.classList.add('text-gray-600');
                if (b.id === 'delete-mode-btn') {
                     b.classList.remove('bg-red-600', 'text-white');
                     b.classList.add('text-red-600', 'border-red-200');
                }
            });
            btn.classList.remove('text-gray-600');
            btn.classList.add('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
            
            document.getElementById('control-deck').classList.add('selection-mode-active');
            
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            const deck = document.getElementById('control-deck');
            if (deck) {
                deck.querySelectorAll('.maestro-btn').forEach(b => {
                    b.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
                });
            }
        }
    },

    toggleDelete(btn) {
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
            this.setAddMode();
        } else {
            State.mode = 'delete';
            
            document.querySelectorAll('.header-tool-btn').forEach(b => {
                b.classList.remove('active', 'bg-blue-50', 'text-blue-600', 'border-blue-200');
                b.classList.add('text-gray-600');
            });
            
            btn.classList.remove('text-red-600');
            btn.classList.add('active', 'bg-red-600', 'text-white', 'hover:bg-red-700');
            
            State.selectedNotes = [];
            NoteRenderer.renderAll();
        }
    },

    selectTool(tool, subtype, btn) {
        if (State.mode === 'select' && State.selectedNotes.length > 0) {
             Input.saveState(); 
             let modificationsMade = false;
             
             State.selectedNotes.forEach(note => {
                 let isCompatible = false;
                 
                 // Type Compatibility Logic
                 if ((note.type === 'note' || note.type === 'rest') && (tool === 'note' || tool === 'rest')) {
                     isCompatible = true;
                 } else if (note.type === tool) {
                     isCompatible = true;
                 }

                 if (isCompatible) {
                     if (note.type === tool && tool !== 'note' && tool !== 'rest') {
                         note.duration = subtype; 
                         note.subtype = subtype; 
                     } else {
                         note.type = tool; 
                         note.duration = subtype;
                     }
                     
                     if (tool !== 'note' && tool !== 'rest') {
                         delete note.isDotted;
                         delete note.accidental;
                     }
                     modificationsMade = true;
                 }
             });
             
             if (modificationsMade) {
                 NoteRenderer.renderAll();
                 if (btn) {
                     btn.classList.add('flash-active');
                     setTimeout(() => btn.classList.remove('flash-active'), 150);
                 }
             }
             return; 
        }
        
        if (State.mode !== 'add') {
            this.setAddMode();
        }

        State.activeTool = tool;
        if (tool !== 'select') {
            State.noteDuration = subtype;
        }
        
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        if(btn) btn.classList.add('active');

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
        if (State.mode === 'select' && State.selectedNotes.length > 0) {
            Input.saveState();
            let changed = false;
            State.selectedNotes.forEach(n => {
                if (n.type === 'note' || n.type === 'rest') {
                    n.isDotted = !n.isDotted;
                    changed = true;
                }
            });
            if(changed) {
                NoteRenderer.renderAll();
                if (btn) {
                     btn.classList.add('flash-active');
                     setTimeout(() => btn.classList.remove('flash-active'), 150);
                }
            }
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
        
        if (State.mode === 'select' && State.selectedNotes.length > 0) {
            Input.saveState();
            let changed = false;
            State.selectedNotes.forEach(n => {
                if (n.type === 'note') {
                    n.accidental = (n.accidental === type) ? null : type;
                    changed = true;
                }
            });
            if(changed) {
                NoteRenderer.renderAll();
                if (btn) {
                     btn.classList.add('flash-active');
                     setTimeout(() => btn.classList.remove('flash-active'), 150);
                }
            }
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
            if (State.mode !== 'add') {
                 this.setAddMode();
            }
            btn.classList.add('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        } else {
            btn.classList.remove('active', 'text-blue-600', 'bg-blue-50', 'border-blue-200');
        }
    }
};
