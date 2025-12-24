import { ToolbarView } from './toolbar-view.js';
import { ModalView } from './modal-view.js';
import { Input } from '../core/input-manager.js';

export const UIManager = {
    toggleMenu(menuId) {
        const menu = document.getElementById(menuId);
        if (menu) {
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m.id !== menuId) m.classList.remove('show');
            });
            menu.classList.toggle('show');
        }
    },

    closeModals() {
        ModalView.close();
    },

    selectTuplet(count, label, icon) {
        const btn = document.getElementById('tuplet-btn');
        const display = document.getElementById('tuplet-display');
        if(btn && display) {
            display.innerHTML = `<div class="text-xs -mb-2">${label}</div><div class="text-xl tracking-tighter">${icon}</div>`;
            document.getElementById('tuplet-menu').classList.remove('show');
        }
    },
    
    handleGlobalClick(e) {
        if (!e.target.closest('.dropdown-menu') && !e.target.closest('#parts-dropdown-btn') && !e.target.closest('#tuplet-btn')) {
             document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        }
    }
};

document.addEventListener('click', UIManager.handleGlobalClick);
