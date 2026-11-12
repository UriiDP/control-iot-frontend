document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 1. Quitar clase 'active' de todos los botones
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // 2. Agregar clase 'active' al botón presionado
            item.classList.add('active');

            // 3. Ocultar todas las vistas
            const targetId = item.getAttribute('data-target');
            views.forEach(view => {
                if (view.id === targetId) {
                    // Mostrar la vista correcta
                    view.style.display = 'block';
                    // Pequeño delay para que la transición CSS de opacity/transform surta efecto
                    setTimeout(() => {
                        view.classList.add('active');
                    }, 50);
                } else {
                    // Ocultar las demás
                    view.classList.remove('active');
                    // Esperar a que termine la transición CSS antes de quitar el display: block
                    setTimeout(() => {
                        if (!view.classList.contains('active')) {
                            view.style.display = 'none';
                        }
                    }, 400); // 400ms empata con el tiempo de transición en CSS
                }
            });
        });
    });
});