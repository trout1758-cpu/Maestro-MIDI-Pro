export const State = {
    parts: [],
    activePartId: null,
    editingPartId: null,
    isCalibrating: false,
    
    // PRIMARY MODE: 'add', 'select', 'delete'
    mode: 'add', 

    // TOOL STATE
    activeTool: 'note', 
    noteDuration: 4,    
    isDotted: false,    
    activeAccidental: null, 
    isTieMode: false,   
    
    // SELECTION DATA
    selectedNotes: []    
};
