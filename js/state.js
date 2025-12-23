export const State = {
    parts: [],
    activePartId: null,
    editingPartId: null,
    isCalibrating: false,
    // TOOL STATE
    activeTool: 'note', // 'note', 'rest', 'barline', 'clef', 'symbol'
    noteDuration: 4,    // 4=quarter, 8=eighth, etc. or subtypes like 'treble', 'segno'
    isDotted: false,    // Toggle state for dotted notes
    activeAccidental: null, // null, 'sharp', 'flat', 'natural'
    isTieMode: false,   // Toggle state for Tie tool
    isDeleteMode: false, // Toggle state for Delete tool
    
    // UNDO/REDO
    // We will store snapshots of the 'notes' array for the active part
    // A more complex app would use command pattern, but snapshots work for this scale.
    // However, since 'parts' is the source of truth, we might need to handle it carefully.
    // For now, let's assume InputManager handles the logic using part.notes directly.
};
