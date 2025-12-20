import { PDF } from './pdf-engine.js';

export const FileManager = {
    triggerUpload() { 
        const input = document.getElementById('file-upload');
        if(input) input.click();
    },
    init() {
        const input = document.getElementById('file-upload');
        if(!input) return;

        input.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;

            const isValidType = file.type === 'application/pdf';
            const isValidExt = file.name.toLowerCase().endsWith('.pdf');

            if (isValidType || isValidExt) {
                PDF.load(file).catch(err => {
                    console.error("PDF Load Error:", err);
                    alert("Failed to load PDF. Please try a different file.");
                });
            } else {
                alert("Please upload a valid PDF file.");
            }
        });
    }
};