document.addEventListener('DOMContentLoaded', () => {
    const dock = document.getElementById('liquid-dock');
    const dockItems = document.querySelectorAll('.dock-item');
    const activePill = document.getElementById('liquid-active-pill');
    const views = document.querySelectorAll('.view');

    // Posiciona la burbuja líquida exactamente debajo del botón activo
    function moveLiquidPill(targetBtn) {
        if (!dock || !activePill || !targetBtn) return;
        const dockRect = dock.getBoundingClientRect();
        const btnRect = targetBtn.getBoundingClientRect();
        const offsetX = btnRect.left - dockRect.left;

        activePill.style.width = `${btnRect.width}px`;
        activePill.style.transform = `translateX(${offsetX - 10}px)`;
    }

    // Inicializar posición de la burbuja al cargar
    const initialActive = document.querySelector('.dock-item.active');
    if (initialActive) {
        requestAnimationFrame(() => moveLiquidPill(initialActive));
    }
    window.addEventListener('resize', () => {
        const currentActive = document.querySelector('.dock-item.active');
        if (currentActive) moveLiquidPill(currentActive);
    });

    // Cambio de pestañas con transición fluida
    dockItems.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetViewId = btn.getAttribute('data-target');
            if (btn.classList.contains('active')) return;

            dockItems.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');
            moveLiquidPill(btn);

            views.forEach((view) => {
                if (view.id === targetViewId) {
                    view.style.display = 'block';
                    requestAnimationFrame(() => {
                        view.classList.add('active');
                    });
                } else {
                    view.classList.remove('active');
                    setTimeout(() => {
                        if (!view.classList.contains('active')) {
                            view.style.display = 'none';
                        }
                    }, 360);
                }
            });
        });
    });

    // Botón para expandir 3D a la pestaña completa
    const btnExpand3d = document.getElementById('btn-expand-3d');
    if (btnExpand3d) {
        btnExpand3d.addEventListener('click', () => {
            const tab3d = document.querySelector('.dock-item[data-target="view-3d"]');
            if (tab3d) tab3d.click();
        });
    }

    // Botón de Modo Claro / Oscuro (con memoria en localStorage)
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const rootHtml = document.documentElement;

    const savedTheme = localStorage.getItem('iot-theme') || 'dark';
    rootHtml.setAttribute('data-theme', savedTheme);
    if (themeIcon) {
        themeIcon.className = savedTheme === 'light' ? 'bx bx-moon' : 'bx bx-sun';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = rootHtml.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            rootHtml.setAttribute('data-theme', next);
            localStorage.setItem('iot-theme', next);
            if (themeIcon) {
                themeIcon.className = next === 'light' ? 'bx bx-moon' : 'bx bx-sun';
            }
        });
    }
});