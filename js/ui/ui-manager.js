export const UIManager = {
    toggleMenu(id) { 
        const el = document.getElementById(id);
        if(el) {
            el.classList.toggle('show');
        }
    },
    
    selectTuplet(val, topText, bottomText) {
         const display = document.getElementById('tuplet-display');
         if(display) {
             display.innerHTML = `
                <div class="text-xs -mb-2">${topText}</div>
                <div class="text-xl tracking-tighter">${bottomText}</div> 
             `;
         }
         const menu = document.getElementById('tuplet-menu');
         if(menu) menu.classList.remove('show');
    },
    
    closeModals() {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.tuplet-dropdown').forEach(el => el.classList.remove('show'));
    }
};