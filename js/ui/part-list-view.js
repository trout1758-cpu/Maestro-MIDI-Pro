import { State } from '../state.js';
import { PartController } from '../controllers/part-controller.js';

export const PartListView = {
    render() {
        const container = document.getElementById('parts-list-container');
        if (!container) return;

        container.innerHTML = '';

        if (State.parts.length === 0) {
            container.innerHTML = '<div class="px-4 py-3 text-sm text-gray-500 italic text-center">No parts created</div>';
            return;
        }

        State.parts.forEach(part => {
            const item = document.createElement('div');
            item.className = `part-item ${State.activePartId === part.id ? 'active' : ''}`;
            
            // Allow clicking to select
            item.onclick = (e) => {
                // If clicking edit/delete icon, don't select?
                // Let's make the whole row select, and have an edit button on the right.
                PartController.selectPart(part.id);
                // Close menu
                document.getElementById('parts-menu').classList.remove('show');
            };

            const nameSpan = document.createElement('span');
            nameSpan.className = "font-semibold text-slate-700";
            nameSpan.innerText = part.name;

            const editBtn = document.createElement('button');
            editBtn.innerHTML = '<i data-lucide="edit-3" size="14"></i>';
            editBtn.className = "text-gray-400 hover:text-blue-600 p-1";
            editBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent selecting
                PartController.prepareEdit(part.id);
            };

            item.appendChild(nameSpan);
            item.appendChild(editBtn);
            container.appendChild(item);
        });

        // Re-init icons for the new elements
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
};
