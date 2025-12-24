export const ModalView = {
    showPartModal(part = null) {
        const modal = document.getElementById('part-modal');
        const title = document.getElementById('modal-title');
        const nameInput = document.getElementById('part-name');
        const instInput = document.getElementById('part-instrument');
        const clefInput = document.getElementById('part-clef');
        const deleteBtn = document.getElementById('btn-delete-part');

        if (part) {
            title.innerText = "Edit Part";
            nameInput.value = part.name;
            instInput.value = part.instrument;
            clefInput.value = part.clef;
            this.updateClefVisuals(part.clef);
            deleteBtn.classList.remove('hidden');
        } else {
            title.innerText = "Create New Part";
            nameInput.value = "";
            instInput.value = "Voice"; // Default
            clefInput.value = "treble";
            this.updateClefVisuals('treble');
            deleteBtn.classList.add('hidden');
        }

        modal.classList.add('show');
    },

    showDeleteModal(part) {
        const modal = document.getElementById('delete-modal');
        document.getElementById('delete-part-name').innerText = part.name;
        modal.classList.add('show');
    },

    close() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
    },

    selectClef(clef, btn) {
        document.getElementById('part-clef').value = clef;
        this.updateClefVisuals(clef);
    },

    updateClefVisuals(activeClef) {
        document.querySelectorAll('.clef-btn').forEach(b => {
            b.classList.remove('active', 'border-blue-500', 'bg-blue-50', 'text-blue-600');
            b.classList.add('text-gray-600');
            // Check if this button corresponds to the active clef
            // We assume the onclick handler passed the string 'treble' or 'bass'
            // But we can't easily check the btn element here without passing it.
            // So we rely on the button's onclick to pass 'this' and handle styling there?
            // Better: Re-query them.
        });
        
        // Simple re-query based on onclick attribute or text content
        // This is a bit hacky, but standardizes it.
        // Let's assume the HTML structure is consistent.
        const buttons = document.querySelectorAll('.clef-btn');
        buttons.forEach(b => {
            if (b.getAttribute('onclick').includes(`'${activeClef}'`)) {
                b.classList.add('active', 'border-blue-500', 'bg-blue-50', 'text-blue-600');
                b.classList.remove('text-gray-600');
            }
        });
    }
};
