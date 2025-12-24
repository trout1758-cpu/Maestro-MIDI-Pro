import { State } from '../state.js';
import { ModalView } from '../ui/modal-view.js';
import { PartListView } from '../ui/part-list-view.js';
import { ToolbarView } from '../ui/toolbar-view.js';
import { CalibrationController } from './calibration-controller.js';
import { NoteRenderer } from '../core/note-renderer.js';

export const PartController = {
    prepareCreate() {
        State.editingPartId = null;
        ModalView.showPartModal(); // Show "Create New Part"
        // Close dropdown if open (handled by UI manager mostly, but good to ensure)
        document.getElementById('parts-menu').classList.remove('show');
    },

    prepareEdit(partId) {
        const part = State.parts.find(p => p.id === partId);
        if (part) {
            State.editingPartId = partId;
            ModalView.showPartModal(part); // Show "Edit Part" with data
            document.getElementById('parts-menu').classList.remove('show');
        }
    },

    save() {
        const name = document.getElementById('part-name').value;
        const instrument = document.getElementById('part-instrument').value;
        const clef = document.getElementById('part-clef').value;

        if (!name) {
            alert("Part name is required");
            return;
        }

        if (State.editingPartId) {
            // Update existing
            const part = State.parts.find(p => p.id === State.editingPartId);
            if (part) {
                part.name = name;
                part.instrument = instrument;
                part.clef = clef;
            }
        } else {
            // Create new
            const newPart = {
                id: Date.now().toString(),
                name: name,
                instrument: instrument,
                clef: clef,
                calibration: [], // Systems
                notes: []
            };
            State.parts.push(newPart);
            this.selectPart(newPart.id);
        }

        PartListView.render();
        ModalView.close();
        ToolbarView.update();
        State.editingPartId = null;
    },

    saveAndCalibrate() {
        // Save first, then enter calibration
        this.save();
        // If we just created/edited, the active part is set.
        if (State.activePartId) {
            CalibrationController.enter();
        }
    },

    selectPart(partId) {
        State.activePartId = partId;
        PartListView.render();
        ToolbarView.update();
        NoteRenderer.renderAll(); // Render notes for this part
    },

    confirmDelete() {
        if (State.editingPartId) {
            ModalView.close(); // Close part modal
            // Show delete confirmation
            const part = State.parts.find(p => p.id === State.editingPartId);
            if(part) ModalView.showDeleteModal(part);
        }
    },

    delete() {
        if (State.editingPartId) {
            State.parts = State.parts.filter(p => p.id !== State.editingPartId);
            if (State.activePartId === State.editingPartId) {
                State.activePartId = null;
            }
            State.editingPartId = null;
            PartListView.render();
            ToolbarView.update();
            NoteRenderer.renderAll();
            ModalView.close();
        }
    }
};
