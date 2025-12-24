import { ToolbarView } from './toolbar-view.js';
import { ModalView } from './modal-view.js';
import { Input } from '../core/input-manager.js';

export const UIManager = {
    toggleMenu(menuId) {
        const menu = document.getElementById(menuId);
        if (menu) {
            // Close others
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m.id !== menuId) m.classList.remove('show');
            });
            menu.classList.toggle('show');
        }
    },

    closeModals() {
        ModalView.close();
    },

    // Handle Tuple Selection from the dropdown
    selectTuplet(count, label, icon) {
        const btn = document.getElementById('tuplet-btn');
        const display = document.getElementById('tuplet-display');
        if(btn && display) {
            // Update display logic if needed, typically we just set the tool
            // For now, assume this sets a tool state for tuplets?
            // Or just visually updates the button.
            // We need a State for tuplets if we implement them logic-wise.
            // For now, let's just update the visual button.
            display.innerHTML = `<div class="text-xs -mb-2">${label}</div><div class="text-xl tracking-tighter">${icon}</div>`;
            document.getElementById('tuplet-menu').classList.remove('show');
        }
    },
    
    // Global click handler to close menus
    handleGlobalClick(e) {
        if (!e.target.closest('.dropdown-menu') && !e.target.closest('#parts-dropdown-btn') && !e.target.closest('#tuplet-btn')) {
             document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        }
    }
};

// Initialize global listeners
document.addEventListener('click', UIManager.handleGlobalClick);
