export const State = {
    parts: [],
    activePartId: null,
    editingPartId: null,
    isCalibrating: false,
    // TOOL STATE
    activeTool: 'note', // 'note' or 'rest'
    noteDuration: 4     // 4=quarter, 8=eighth, etc.
};