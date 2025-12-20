import { State } from '../state.js';

export const PartListView = {
    render() {
        const container = document.getElementById('parts-list-container');
        container.innerHTML = '';
        State.parts.forEach(part => {
            const div = document.createElement('div');
            div.className = `part-item ${part.id === State.activePartId ? 'active' : ''}`;
            div.innerHTML = `
                <div onclick="PartController.setActive(${part.id})" class="flex-1">
                    <div class="font-bold text-sm text-slate-700">${part.name}</div>
                    <div class="text-xs text-slate-400">${part.instrument} • ${part.clef}</div>
                </div>
                <button onclick="PartController.prepareEdit(${part.id})" class="p-2 text-gray-300 hover:text-blue-500 transition-colors"><i data-lucide="pencil" size="14"></i></button>
            `;
            container.appendChild(div);
        });
        lucide.createIcons();
    }
};