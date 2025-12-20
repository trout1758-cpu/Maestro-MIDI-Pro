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
            xml += `  <part id="P${index + 1}">\n    <measure number="1">\n      <attributes>\n        <divisions>4</divisions>\n        <key><fifths>0</fifths></key>\n        <time><beats>4</beats><beat-type>4</beat-type></time>\n        <clef>\n          <sign>${part.clef === 'treble' ? 'G' : 'F'}</sign>\n          <line>${part.clef === 'treble' ? '2' : '4'}</line>\n        </clef>\n      </attributes>\n`;
            
            const sortedNotes = part.notes.sort((a, b) => a.x - b.x);
            
            sortedNotes.forEach(note => {
                const refMidi = CONFIG.CLEF_OFFSETS[part.clef] || 77;
                
                let currentMidi = refMidi;
                const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; 
                const direction = note.pitchIndex >= 0 ? -1 : 1;
                const steps = Math.abs(note.pitchIndex);

                for(let i=0; i<steps; i++) {
                    currentMidi += direction;
                    while(!whiteKeys.includes(currentMidi % 12)) currentMidi += direction;
                }
                
                const stepNames = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
                const stepName = stepNames[currentMidi % 12];
                const octave = Math.floor(currentMidi / 12) - 1; 

                const durationXML = 16 / note.duration; 
                const typeName = note.duration === 1 ? 'whole' : note.duration === 2 ? 'half' : note.duration === 4 ? 'quarter' : 'eighth';

                xml += `      <note>\n`;
                
                if (note.type === 'rest') {
                     xml += `        <rest/>\n`;
                } else {
                     xml += `        <pitch>\n          <step>${stepName}</step>\n          <octave>${octave}</octave>\n        </pitch>\n`;
                }
                
                xml += `        <duration>${durationXML}</duration>\n        <type>${typeName}</type>\n      </note>\n`;
            });

            xml += `    </measure>\n  </part>\n`;
        });

        xml += `</score-partwise>`;

        const blob = new Blob([xml], {type: "text/xml"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "maestro_score.musicxml";
        a.click();
    }
};