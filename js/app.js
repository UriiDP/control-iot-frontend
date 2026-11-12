document.addEventListener('DOMContentLoaded', () => {
    // 1. Sistema de Pestañas (Liquid Nav)
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (item.classList.contains('active')) return;

            // Actualizar botones
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Actualizar vistas con animación
            const targetId = item.getAttribute('data-target');
            
            views.forEach(view => {
                if (view.id === targetId) {
                    view.style.display = 'block';
                    // Timeout para que el CSS detecte el cambio de display antes de animar opacidad
                    requestAnimationFrame(() => {
                        view.classList.add('active');
                    });
                } else {
                    view.classList.remove('active');
                    // Esperar a que termine la transición para ocultar el bloque
                    setTimeout(() => {
                        if (!view.classList.contains('active')) {
                            view.style.display = 'none';
                        }
                    }, 400); 
                }
            });
        });
    });

    // 2. Sistema Light/Dark Mode
    const themeToggle = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;
    const themeIcon = themeToggle.querySelector('i');

    themeToggle.addEventListener('click', () => {
        const currentTheme = htmlEl.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        htmlEl.setAttribute('data-theme', newTheme);
        
        // Cambiar icono
        if(newTheme === 'light') {
            themeIcon.classList.replace('bx-sun', 'bx-moon');
        } else {
            themeIcon.classList.replace('bx-moon', 'bx-sun');
        }
    });
});