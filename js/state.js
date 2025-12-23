export const State = {
    parts: [],
    activePartId: null,
    editingPartId: null,
    isCalibrating: false,
    // TOOL STATE
    activeTool: 'note', // 'note', 'rest', 'barline', 'clef', 'symbol', 'select'
    noteDuration: 4,    // 4=quarter, 8=eighth, etc. or subtypes like 'treble', 'segno'
    isDotted: false,    // Toggle state for dotted notes
    activeAccidental: null, // null, 'sharp', 'flat', 'natural'
    isTieMode: false,   // Toggle state for Tie tool
    isDeleteMode: false, // Toggle state for Delete tool
    
    // SELECTION STATE
    selectionMode: null, // 'single', 'multi', 'measure'
    selectedNotes: []    // Array of note objects (references) from the active part
};
