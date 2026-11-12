/* ==========================================================================
   Motor 3D Interactivo (Three.js) - Gemelo Digital Excavadora RC
   ========================================================================== */

export class Excavator3DManager {
    constructor(containers) {
        this.containers = containers.filter(Boolean);
        this.scenes = [];

        // Estado cinemático compartido
        this.state = {
            posX: 0,
            posZ: 0,
            headingRad: 0,       // Rotación izquierda/derecha en 3D
            armElevation: 0.5,   // 0 (abajo) a 1 (arriba)
            linearSpeed: 0,
            angularSpeed: 0,
            cameraOrbitYaw: 0.65,
            cameraOrbitPitch: 0.48
        };

        if (typeof window.THREE === 'undefined' || this.containers.length === 0) return;

        this.containers.forEach((container) => {
            const instance = this.createViewport(container);
            if (instance) this.scenes.push(instance);
        });

        this.bindOrbitControls();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    createViewport(container) {
        const THREE = window.THREE;
        const width = container.clientWidth || 420;
        const height = container.clientHeight || 300;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
        camera.position.set(4.6, 3.4, 4.6);
        camera.lookAt(0, 0.7, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.prepend(renderer.domElement);

        // Iluminación
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfff5d6, 1.4);
        dirLight.position.set(6, 10, 5);
        scene.add(dirLight);

        const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
        rimLight.position.set(-6, 4, -5);
        scene.add(rimLight);

        // Cuadrícula espacial del suelo
        const gridHelper = new THREE.GridHelper(16, 24, 0xffb703, 0x334155);
        gridHelper.material.opacity = 0.35;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);

        // Aro guía alrededor de la base
        const ringGeo = new THREE.RingGeometry(1.45, 1.52, 48);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb703, side: THREE.DoubleSide, transparent: true, opacity: 0.45 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = 0.01;
        scene.add(ringMesh);

        // Construcción de la Excavadora 3D Articulada
        const rootGroup = new THREE.Group();
        scene.add(rootGroup);

        const matYellow = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.25, roughness: 0.35 });
        const matDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.45, roughness: 0.5 });
        const matGlass = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.15, transparent: true, opacity: 0.75 });
        const matSteel = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.75, roughness: 0.25 });

        // 1. Chasis inferior y orugas izquierda/derecha
        const trackGeo = new THREE.BoxGeometry(1.9, 0.34, 0.36);
        const leftTrack = new THREE.Mesh(trackGeo, matDark);
        leftTrack.position.set(0, 0.17, -0.62);
        rootGroup.add(leftTrack);

        const rightTrack = new THREE.Mesh(trackGeo, matDark);
        rightTrack.position.set(0, 0.17, 0.62);
        rootGroup.add(rightTrack);

        const axle = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 1.0), matDark);
        axle.position.set(0, 0.24, 0);
        rootGroup.add(axle);

        // 2. Torretas y cabina superior
        const upperBody = new THREE.Group();
        upperBody.position.set(0, 0.42, 0);
        rootGroup.add(upperBody);

        const deck = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 1.15), matYellow);
        deck.position.set(-0.1, 0.22, 0);
        upperBody.add(deck);

        const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 1.12), matDark);
        counterweight.position.set(-0.75, 0.26, 0);
        upperBody.add(counterweight);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.68, 0.56), matGlass);
        cabin.position.set(0.18, 0.72, -0.26);
        upperBody.add(cabin);

        const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.62), matYellow);
        cabinRoof.position.set(0.18, 1.08, -0.26);
        upperBody.add(cabinRoof);

        // 3. Brazo articulado (Boom + Stick + Garra/Pala)
        const boomPivot = new THREE.Group();
        boomPivot.position.set(0.45, 0.42, 0.24);
        upperBody.add(boomPivot);

        const boom = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.2, 0.18), matYellow);
        boom.position.set(0.58, 0.35, 0);
        boom.rotation.z = 0.52;
        boomPivot.add(boom);

        const stickPivot = new THREE.Group();
        stickPivot.position.set(1.12, 0.68, 0);
        boomPivot.add(stickPivot);

        const stick = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.15), matSteel);
        stick.position.set(0.35, -0.35, 0);
        stick.rotation.z = -0.85;
        stickPivot.add(stick);

        const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.34), matDark);
        bucket.position.set(0.72, -0.75, 0);
        bucket.rotation.z = -0.3;
        stickPivot.add(bucket);

        // Redimensionamiento responsivo automático
        const resizeObserver = new ResizeObserver(() => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w > 0 && h > 0) {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            }
        });
        resizeObserver.observe(container);

        return { container, scene, camera, renderer, rootGroup, ringMesh, boomPivot, stickPivot };
    }

    bindOrbitControls() {
        this.containers.forEach((container) => {
            let dragging = false;
            let lastX = 0;
            let lastY = 0;

            container.addEventListener('pointerdown', (e) => {
                dragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
            });

            window.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                lastX = e.clientX;
                lastY = e.clientY;

                this.state.cameraOrbitYaw -= dx * 0.01;
                this.state.cameraOrbitPitch = Math.max(0.18, Math.min(1.25, this.state.cameraOrbitPitch + dy * 0.008));
            });

            window.addEventListener('pointerup', () => {
                dragging = false;
            });
        });
    }

    aplicarComando(etiqueta) {
        if (etiqueta === 'AVANZAR') {
            this.state.linearSpeed = 0.035;
            this.state.angularSpeed = 0;
        } else if (etiqueta === 'RETROCEDER') {
            this.state.linearSpeed = -0.035;
            this.state.angularSpeed = 0;
        } else if (etiqueta === 'IZQUIERDA') {
            this.state.angularSpeed = 0.038;
            this.state.linearSpeed = 0;
        } else if (etiqueta === 'DERECHA') {
            this.state.angularSpeed = -0.038;
            this.state.linearSpeed = 0;
        } else if (etiqueta === 'GIRO IZQ 90°') {
            this.state.headingRad += Math.PI / 2;
            this.state.linearSpeed = 0;
            this.state.angularSpeed = 0;
        } else if (etiqueta === 'GIRO DER 90°') {
            this.state.headingRad -= Math.PI / 2;
            this.state.linearSpeed = 0;
            this.state.angularSpeed = 0;
        } else if (etiqueta === 'SUBIR GARRA') {
            this.state.armElevation = Math.min(1, this.state.armElevation + 0.25);
        } else if (etiqueta === 'BAJAR GARRA') {
            this.state.armElevation = Math.max(0, this.state.armElevation - 0.25);
        } else if (etiqueta === 'NEUTRAL' || etiqueta.includes('STOP')) {
            this.state.linearSpeed = 0;
            this.state.angularSpeed = 0;
        }
    }

    reset() {
        this.state.posX = 0;
        this.state.posZ = 0;
        this.state.headingRad = 0;
        this.state.armElevation = 0.5;
        this.state.linearSpeed = 0;
        this.state.angularSpeed = 0;
        this.state.cameraOrbitYaw = 0.65;
        this.state.cameraOrbitPitch = 0.48;
    }

    getTelemetry() {
        const deg = Math.round(((this.state.headingRad * 180) / Math.PI) % 360);
        return {
            angleDeg: deg,
            armPct: Math.round(this.state.armElevation * 100),
            posX: this.state.posX.toFixed(1),
            posZ: this.state.posZ.toFixed(1)
        };
    }

    animate() {
        requestAnimationFrame(this.animate);

        // Integrar movimiento continuo
        this.state.headingRad += this.state.angularSpeed;
        if (this.state.linearSpeed !== 0) {
            this.state.posX += Math.cos(this.state.headingRad) * this.state.linearSpeed;
            this.state.posZ -= Math.sin(this.state.headingRad) * this.state.linearSpeed;
            // Mantener dentro de los límites de la plataforma
            this.state.posX = Math.max(-5.5, Math.min(5.5, this.state.posX));
            this.state.posZ = Math.max(-5.5, Math.min(5.5, this.state.posZ));
        }

        const targetBoomAngle = (this.state.armElevation - 0.5) * 0.75;
        const targetStickAngle = (0.5 - this.state.armElevation) * 0.65;

        this.scenes.forEach((item) => {
            item.rootGroup.position.set(this.state.posX, 0, this.state.posZ);
            item.rootGroup.rotation.y = this.state.headingRad;
            item.ringMesh.position.set(this.state.posX, 0.01, this.state.posZ);

            item.boomPivot.rotation.z += (targetBoomAngle - item.boomPivot.rotation.z) * 0.14;
            item.stickPivot.rotation.z += (targetStickAngle - item.stickPivot.rotation.z) * 0.14;

            // Cámara orbital alrededor de la excavadora
            const radius = 5.6;
            const camX = this.state.posX + radius * Math.cos(this.state.cameraOrbitPitch) * Math.sin(this.state.cameraOrbitYaw);
            const camY = radius * Math.sin(this.state.cameraOrbitPitch) + 0.5;
            const camZ = this.state.posZ + radius * Math.cos(this.state.cameraOrbitPitch) * Math.cos(this.state.cameraOrbitYaw);

            item.camera.position.set(camX, camY, camZ);
            item.camera.lookAt(this.state.posX, 0.75, this.state.posZ);
            item.renderer.render(item.scene, item.camera);
        });
    }
}