import { PDF } from './core/pdf-engine.js';
import { FileManager } from './core/file-manager.js';
import { Input } from './core/input-manager.js';
import { ExportManager } from './core/export-manager.js';
import { UIManager } from './ui/ui-manager.js';
import { ToolbarView } from './ui/toolbar-view.js';
import { ModalView } from './ui/modal-view.js';
import { PartController } from './controllers/part-controller.js';
import { CalibrationController } from './controllers/calibration-controller.js';

// --- INITIALIZATION ---

// 1. Initialize Icons
lucide.createIcons();

// 2. Initialize Core Systems
PDF.initElements();
FileManager.init();
Input.init();

// --- BINDING TO WINDOW FOR HTML INLINE EVENTS ---
// Since the HTML uses onclick="PartController.something()", we must expose these modules to window.
window.PDF = PDF;
window.FileManager = FileManager;
window.ExportManager = ExportManager;
window.UIManager = UIManager;
window.ToolbarView = ToolbarView;
window.ModalView = ModalView;
window.PartController = PartController;
window.CalibrationController = CalibrationController;

console.log("Maestro Module Loaded Successfully");