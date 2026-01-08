import { State } from '../state.js';
import { CONFIG } from '../config.js';

export const ExportManager = {
    exportXML() {
        if (State.parts.length === 0) {
            alert("No parts created.");
            return;
        }
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="3.1">\n  <part-list>\n`;

        State.parts.forEach((part, index) => {
            xml += `    <score-part id="P${index + 1}">\n      <part-name>${part.name}</part-name>\n    </score-part>\n`;
        });
        xml += `  </part-list>\n`;

        State.parts.forEach((part, index) => {
            xml += `  <part id="P${index + 1}">\n`;
            
            // --- STEP 1: PREPARE AND SORT DATA ---
            const systems = part.calibration.map((sys, idx) => ({ ...sys, originalId: idx }));
            systems.sort((a, b) => a.topY - b.topY);
            
            const systemOrderMap = {};
            systems.forEach((sys, orderIdx) => {
                systemOrderMap[sys.originalId] = orderIdx;
            });

            // Sort notes by System Y, then X
            const sortedNotes = part.notes.sort((a, b) => {
                const sysA = systemOrderMap[a.systemId];
                const sysB = systemOrderMap[b.systemId];
                
                if (sysA !== sysB) return sysA - sysB; // Different systems
                
                // Same system: Sort by X
                // Small priority tweaks for coincident items (Clef < Key < Time < Note)
                if (Math.abs(a.x - b.x) < 5.0) {
                    const getPriority = (type) => {
                        if (type === 'barline') return 0;
                        if (type === 'clef' || type === 'key' || type === 'time') return 1;
                        if (type === 'symbol') return 2;
                        return 3; 
                    };
                    const pA = getPriority(a.type);
                    const pB = getPriority(b.type);
                    if (pA !== pB) return pA - pB;
                    return b.y - a.y; // Top-down for same X/Type
                }
                return a.x - b.x;
            });

            // --- STEP 2: SCAN FOR INITIAL ATTRIBUTES ---
            let currentClefType = part.clef; 
            let currentBeats = 4;
            let currentBeatType = 4;
            let currentFifths = 0;

            // Look ahead for first Time/Key/Clef to set initial measure attributes
            for (let i = 0; i < sortedNotes.length; i++) {
                const n = sortedNotes[i];
                if (n.type === 'note' || n.type === 'rest' || n.type === 'barline') break;
                
                if (n.type === 'time') {
                    const [b, bt] = n.subtype.split('/');
                    currentBeats = parseInt(b);
                    currentBeatType = parseInt(bt);
                }
                if (n.type === 'key') {
                    const keyMap = { 'C': 0, 'A': 3, 'B': 5, 'D': 2, 'E': 4, 'F': -1, 'G': 1, 'C#': 7, 'F#': 6, 'G#': 8, 'D#': 9, 'A#': 10, 'E#': 11, 'B#': 12, 'Cb': -7, 'Gb': -6, 'Db': -5, 'Ab': -4, 'Eb': -3, 'Bb': -2, 'Fb': -8 };
                    if (keyMap.hasOwnProperty(n.subtype)) currentFifths = keyMap[n.subtype];
                }
                if (n.type === 'clef') {
                    if (n.subtype === 'treble') currentClefType = 'treble';
                    else if (n.subtype === 'bass') currentClefType = 'bass';
                    else if (n.subtype === 'c') currentClefType = 'alto';
                }
            }

            let measureNum = 1;
            xml += `    <measure number="${measureNum}">\n      <attributes>\n        <divisions>24</divisions>\n        <key><fifths>${currentFifths}</fifths></key>\n        <time><beats>${currentBeats}</beats><beat-type>${currentBeatType}</beat-type></time>\n        <clef>\n          <sign>${currentClefType === 'treble' ? 'G' : (currentClefType === 'bass' ? 'F' : 'C')}</sign>\n          <line>${currentClefType === 'treble' ? '2' : (currentClefType === 'bass' ? '4' : '3')}</line>\n        </clef>\n      </attributes>\n`;
            
            // --- STEP 3: MAIN PROCESSING LOOP ---
            for (let i = 0; i < sortedNotes.length; i++) {
                const note = sortedNotes[i];
                const prevNote = i > 0 ? sortedNotes[i-1] : null;
                const nextNote = i < sortedNotes.length - 1 ? sortedNotes[i+1] : null;

                if (note.type === 'time') {
                    const [beats, beatType] = note.subtype.split('/');
                    currentBeats = parseInt(beats);
                    currentBeatType = parseInt(beatType);
                    xml += `      <attributes><time><beats>${currentBeats}</beats><beat-type>${currentBeatType}</beat-type></time></attributes>\n`;
                    continue;
                }

                if (note.type === 'key') {
                    const keyMap = { 'C': 0, 'A': 3, 'B': 5, 'D': 2, 'E': 4, 'F': -1, 'G': 1, 'C#': 7, 'F#': 6, 'G#': 8, 'D#': 9, 'A#': 10, 'E#': 11, 'B#': 12, 'Cb': -7, 'Gb': -6, 'Db': -5, 'Ab': -4, 'Eb': -3, 'Bb': -2, 'Fb': -8 };
                    let newFifths = 0;
                    if (keyMap.hasOwnProperty(note.subtype)) newFifths = keyMap[note.subtype];
                    currentFifths = newFifths;
                    xml += `      <attributes><key><fifths>${currentFifths}</fifths></key></attributes>\n`;
                    continue;
                }

                if (note.type === 'symbol') {
                    if (note.subtype === 'segno') {
                        xml += `      <direction placement="above"><direction-type><segno/></direction-type></direction>\n`;
                    } else if (note.subtype === 'coda') {
                         xml += `      <direction placement="above"><direction-type><coda/></direction-type></direction>\n`;
                    }
                    continue; 
                }

                if (note.type === 'clef') {
                    let sign = 'G'; let line = '2';
                    if (note.subtype === 'treble') { sign = 'G'; line = '2'; currentClefType = 'treble'; }
                    else if (note.subtype === 'bass') { sign = 'F'; line = '4'; currentClefType = 'bass'; }
                    else if (note.subtype === 'c') { sign = 'C'; line = Math.round(5 - (note.pitchIndex / 2)); currentClefType = 'alto'; }
                    xml += `      <attributes><clef><sign>${sign}</sign><line>${line}</line></clef></attributes>\n`;
                    continue;
                }

                if (note.type === 'barline') {
                    let barlineXML = '';
                    if (note.subtype === 'double') barlineXML = '<barline location="right"><bar-style>light-light</bar-style></barline>';
                    else if (note.subtype === 'final') barlineXML = '<barline location="right"><bar-style>light-heavy</bar-style></barline>';
                    else if (note.subtype === 'repeat') barlineXML = '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>';

                    if (barlineXML) xml += `      ${barlineXML}\n`;
                    
                    xml += `    </measure>\n`;
                    measureNum++;
                    xml += `    <measure number="${measureNum}">\n`;
                    continue;
                }

                // Check for Chords or Polyphony
                let isChord = false;
                let isVoice2 = false;
                let backupDuration = 0;

                if (prevNote && (prevNote.type === 'note' || prevNote.type === 'rest') && (note.type === 'note' || note.type === 'rest')) {
                    if (Math.abs(note.x - prevNote.x) < 2.0) {
                        const sameDuration = (note.duration === prevNote.duration) && (!!note.isDotted === !!prevNote.isDotted);
                        if (sameDuration) {
                            isChord = true;
                        } else {
                            // Different duration at same X -> Polyphony (Voice 2)
                            isVoice2 = true;
                            // Calculate backup duration from previous note
                            let prevDur = (4 * 24) / prevNote.duration;
                            if (prevNote.isDotted) prevDur *= 1.5;
                            backupDuration = prevDur;
                        }
                    }
                }

                if (isVoice2) { xml += `      <backup><duration>${backupDuration}</duration></backup>\n`; }

                // Pitch Calculation
                const refMidi = CONFIG.CLEF_OFFSETS[currentClefType] || CONFIG.CLEF_OFFSETS['treble'];
                let currentMidi = refMidi;
                const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; 
                const direction = note.pitchIndex >= 0 ? -1 : 1;
                const steps = Math.abs(note.pitchIndex);
                
                // Simple diatonic walk
                for(let k=0; k<steps; k++) {
                    currentMidi += direction;
                    while(!whiteKeys.includes(currentMidi % 12)) currentMidi += direction;
                }

                const stepNames = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
                const stepName = stepNames[currentMidi % 12];
                const octave = Math.floor(currentMidi / 12) - 1; 

                // Duration Calculation
                let durationXML = (4 * 24) / note.duration;
                if (note.isDotted) durationXML *= 1.5;
                
                const typeName = note.duration === 1 ? 'whole' : 
                                 note.duration === 2 ? 'half' : 
                                 note.duration === 4 ? 'quarter' : 
                                 note.duration === 8 ? 'eighth' : '16th';

                // --- TIE LOGIC ---
                const tieStart = note.hasTie;
                let tieStop = false;
                if (note.type === 'note') {
                    // Check backwards for a tied note of same pitch
                    for (let j = i - 1; j >= 0; j--) {
                        const cand = sortedNotes[j];
                        if (cand.type === 'note') {
                            if (cand.pitchIndex === note.pitchIndex) {
                                if (cand.hasTie) tieStop = true;
                                break; 
                            }
                        }
                    }
                }

                // --- BEAMING LOGIC ---
                // Simple heuristic: If 8th/16th notes are close together, beam them.
                const isBeamable = (n) => n && n.type === 'note' && (n.duration === 8 || n.duration === 16);
                let beam1 = null; let beam2 = null; 

                if (note.type === 'note' && !isChord && !isVoice2) { 
                    if (isBeamable(note)) {
                        const prevIsBeamable = isBeamable(prevNote) && Math.abs(note.x - prevNote.x) > 2.0; // Not a chord/voice with prev
                        const nextIsBeamable = isBeamable(nextNote) && Math.abs(nextNote.x - note.x) > 2.0; 
                        
                        if (!prevIsBeamable && nextIsBeamable) { beam1 = 'begin'; }
                        else if (prevIsBeamable && !nextIsBeamable) { beam1 = 'end'; }
                        else if (prevIsBeamable && nextIsBeamable) { beam1 = 'continue'; }
                        
                        // 16th note secondary beam
                        if (note.duration === 16) {
                            const prevIs16 = prevIsBeamable && prevNote.duration === 16;
                            const nextIs16 = nextIsBeamable && nextNote.duration === 16;
                            if (!prevIs16 && nextIs16) beam2 = 'begin';
                            else if (prevIs16 && !nextIs16) beam2 = 'end';
                            else if (prevIs16 && nextIs16) beam2 = 'continue';
                        }
                    }
                }

                xml += `      <note>\n`;
                if (isChord) { xml += `        <chord/>\n`; }
                if (note.type === 'rest') { xml += `        <rest/>\n`; } 
                else {
                     xml += `        <pitch>\n          <step>${stepName}</step>\n`;
                     // Handle accidental logic if stored
                     if (note.accidental) {
                         let alter = 0;
                         if (note.accidental === 'sharp') alter = 1;
                         if (note.accidental === 'flat') alter = -1;
                         if (note.accidental === 'natural') alter = 0; 
                         if (alter !== 0) xml += `          <alter>${alter}</alter>\n`;
                     }
                     xml += `          <octave>${octave}</octave>\n        </pitch>\n`;
                }
                
                xml += `        <duration>${durationXML}</duration>\n`;
                if (isVoice2) { xml += `        <voice>2</voice>\n`; } else { xml += `        <voice>1</voice>\n`; }
                xml += `        <type>${typeName}</type>\n`;
                
                if (note.isDotted) xml += `        <dot/>\n`;
                if (note.accidental) xml += `        <accidental>${note.accidental}</accidental>\n`;

                if (tieStop) xml += `        <tie type="stop"/>\n`;
                if (tieStart) xml += `        <tie type="start"/>\n`;
                
                if (tieStop || tieStart) {
                    xml += `        <notations>\n`;
                    if (tieStop) xml += `          <tied type="stop"/>\n`;
                    if (tieStart) xml += `          <tied type="start"/>\n`;
                    xml += `        </notations>\n`;
                }

                if (beam1) xml += `        <beam number="1">${beam1}</beam>\n`;
                if (beam2) xml += `        <beam number="2">${beam2}</beam>\n`;

                xml += `      </note>\n`;
            }

            xml += `    </measure>\n  </part>\n`;
        });

        xml += `</score-partwise>`;

        const blob = new Blob([xml], {type: "text/xml"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "maestro_score.xml";
        a.click();
    }
};
