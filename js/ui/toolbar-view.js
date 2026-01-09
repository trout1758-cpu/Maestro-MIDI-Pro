import { State } from '../state.js';
import { CONFIG } from '../config.js';
import { UIManager } from './ui-manager.js';

export const ToolbarView = {
    init() {
        // Initialize state visuals
        this.updateActiveButton();
        this.checkPitchVisibility();
    },

    toggleCategory(id) {
        // 1. Hide all tool containers
        document.querySelectorAll('#tool-container > div[id^="tools-"]').forEach(el => {
            el.classList.add('hidden');
        });
        
        // 2. Show the requested tool container
        const activeGroup = document.getElementById(`tools-${id}`);
        if (activeGroup) activeGroup.classList.remove('hidden');

        // 3. Update Tab Styling
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-btn[onclick*="${id}"]`);
        if (activeTab) activeTab.classList.add('active');

        // NOTE: We no longer hide/show #pitch-display here. 
        // Its visibility is now strictly determined by the Active Tool or Selection State via checkPitchVisibility().
    },

    selectTool(type, subtype, btn) {
        // Clear previous states
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        
        // Set State
        State.activeTool = type;
        State.noteDuration = subtype;
        State.mode = 'add'; // Reset to add mode when picking a tool
        
        // Update UI
        if (btn) btn.classList.add('active');
        
        // Reset toggle buttons
        const selectBtn = document.getElementById('select-mode-btn');
        const deleteBtn = document.getElementById('delete-mode-btn');
        if (selectBtn) {
            selectBtn.classList.remove('bg-blue-100', 'text-blue-700', 'border-blue-300');
            selectBtn.classList.add('text-gray-600', 'border-gray-300');
        }
        if (deleteBtn) {
            deleteBtn.classList.remove('bg-red-100', 'text-red-700', 'border-red-300');
            deleteBtn.classList.add('text-red-600', 'border-red-200');
        }

        // Check if pitch box should be visible
        this.checkPitchVisibility();
    },

    toggleSelectMode(btn) {
        if (State.mode === 'select') {
            State.mode = 'add';
            btn.classList.remove('bg-blue-100', 'text-blue-700', 'border-blue-300');
            btn.classList.add('text-gray-600', 'border-gray-300');
            
            // Re-highlight the active tool button if it exists
            this.updateActiveButton();
        } else {
            State.mode = 'select';
            btn.classList.remove('text-gray-600', 'border-gray-300');
            btn.classList.add('bg-blue-100', 'text-blue-700', 'border-blue-300');
            
            // Turn off delete mode if on
            const deleteBtn = document.getElementById('delete-mode-btn');
            if(deleteBtn) {
                deleteBtn.classList.remove('bg-red-100', 'text-red-700', 'border-red-300');
                deleteBtn.classList.add('text-red-600', 'border-red-200');
            }
            
            // Remove active state from tool buttons visually (but keep State.activeTool stored)
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        }
        this.checkPitchVisibility();
    },

    toggleDelete(btn) {
        if (State.mode === 'delete') {
            State.mode = 'add';
            btn.classList.remove('bg-red-100', 'text-red-700', 'border-red-300');
            btn.classList.add('text-red-600', 'border-red-200');
            this.updateActiveButton();
        } else {
            State.mode = 'delete';
            btn.classList.remove('text-red-600', 'border-red-200');
            btn.classList.add('bg-red-100', 'text-red-700', 'border-red-300');
            
            // Turn off select mode
            const selectBtn = document.getElementById('select-mode-btn');
            if(selectBtn) {
                selectBtn.classList.remove('bg-blue-100', 'text-blue-700', 'border-blue-300');
                selectBtn.classList.add('text-gray-600', 'border-gray-300');
            }
            
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        }
        this.checkPitchVisibility();
    },

    toggleDot(btn) {
        State.isDotted = !State.isDotted;
        if (State.isDotted) {
            btn.classList.add('text-blue-600', 'font-bold');
        } else {
            btn.classList.remove('text-blue-600', 'font-bold');
        }
    },

    toggleTie(btn) {
        State.isTieMode = !State.isTieMode;
        if (State.isTieMode) {
             btn.classList.add('bg-blue-100', 'text-blue-700', 'border-blue-300');
        } else {
             btn.classList.remove('bg-blue-100', 'text-blue-700', 'border-blue-300');
        }
    },

    toggleAccidental(type, btn) {
        if (State.activeAccidental === type) {
            State.activeAccidental = null;
            btn.classList.remove('active', 'bg-blue-100', 'text-blue-700');
        } else {
            State.activeAccidental = type;
            document.querySelectorAll('.accidental-btn').forEach(b => b.classList.remove('active', 'bg-blue-100', 'text-blue-700'));
            btn.classList.add('active', 'bg-blue-100', 'text-blue-700');
        }
    },

    updateActiveButton() {
        if (State.activeTool && State.noteDuration) {
            // Try to find button matching tool + duration
            // This is a simplified lookup, might need refinement if tool buttons are complex
             const selector = `.tool-btn[onclick*="'${State.activeTool}'"][onclick*="'${State.noteDuration}'"]`;
             const btn = document.querySelector(selector);
             if (btn) btn.classList.add('active');
        }
    },

    updatePitch(text) {
        const el = document.getElementById('pitch-display');
        if (el) el.innerText = text;
    },

    checkPitchVisibility() {
        const display = document.getElementById('pitch-display');
        if (!display) return;

        let shouldBeVisible = false;

        // 1. ADD MODE: Visible if tool is Note or Rest
        if (State.mode === 'add') {
            if (['note', 'rest'].includes(State.activeTool)) {
                shouldBeVisible = true;
            }
        }
        
        // 2. SELECT MODE: Visible if EXACTLY ONE note/rest is selected
        // This covers dragging a single note to a new pitch
        if (State.mode === 'select') {
            if (State.selectedNotes.length === 1) {
                const n = State.selectedNotes[0];
                if (n.type === 'note' || n.type === 'rest') {
                    shouldBeVisible = true;
                }
            }
        }

        if (shouldBeVisible) {
            display.classList.remove('hidden');
            display.style.display = 'flex';
        } else {
            display.classList.add('hidden');
            display.style.display = 'none';
        }
    }
};
