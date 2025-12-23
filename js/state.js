export const State = {
    parts: [],
    activePartId: null,
    editingPartId: null,
    isCalibrating: false,
    // TOOL STATE
    activeTool: 'note', // 'note', 'rest', 'barline', 'clef', 'symbol'
    noteDuration: 4,    // 4=quarter, 8=eighth, etc. or subtypes like 'treble', 'segno'
    isDotted: false     // Toggle state for dotted notes
};
