export const State = {
    parts: [],
    activePartId: null,
    editingPartId: null,
    isCalibrating: false,

    // GLOBAL INTERACTION MODE
    // 'add': Standard tool placement
    // 'select': Selection, moving, marquee
    // 'delete': Click to delete
    mode: 'add', 

    // TOOL STATE
    activeTool: 'note', // 'note', 'rest', 'barline', 'clef', 'symbol'
    noteDuration: 4,    // 4=quarter, 8=eighth, etc. or subtypes like 'treble', 'segno'
    isDotted: false,    // Toggle state for dotted notes
    activeAccidental: null, // null, 'sharp', 'flat', 'natural'
    isTieMode: false,   // Toggle state for Tie tool
    
    // SELECTION DATA
    selectedNotes: []    // Array of note objects (references) from the active part
};
