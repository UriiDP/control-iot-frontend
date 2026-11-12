/* ==========================================================================
   Motor 3D Interactivo (Three.js) - Escenario de Construcción + Excavadora
   ========================================================================== */

export class Excavator3DManager {
    constructor(containers) {
        this.containers = containers.filter(Boolean);
        this.scenes = [];

        this.state = {
            posX: 0,
            posZ: 0,
            headingRad: 0,
            armElevation: 0.5,
            linearSpeed: 0,
            angularSpeed: 0,
            cameraOrbitYaw: 0.72,
            cameraOrbitPitch: 0.44
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
        const height = container.clientHeight || 315;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x6ec6ff);
        scene.fog = new THREE.FogExp2(0x8fd3ff, 0.024);

        const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 120);
        camera.position.set(5.2, 3.6, 5.2);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        container.prepend(renderer.domElement);

        // Iluminación natural de día en obra
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x6b8e23, 0.9);
        scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
        sunLight.position.set(10, 16, 8);
        sunLight.castShadow = true;
        scene.add(sunLight);

        // Suelo verde / terreno de obra
        const groundGeo = new THREE.CircleGeometry(32, 48);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x6ab04c, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Plataforma central de tierra compactada
        const dirtGeo = new THREE.CircleGeometry(7.2, 40);
        const dirtMat = new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.95 });
        const dirtPad = new THREE.Mesh(dirtGeo, dirtMat);
        dirtPad.rotation.x = -Math.PI / 2;
        dirtPad.position.y = 0.01;
        scene.add(dirtPad);

        // Aro guía alrededor de la excavadora
        const ringGeo = new THREE.RingGeometry(1.42, 1.5, 48);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb703, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = 0.025;
        scene.add(ringMesh);

        // Construir entorno de construcción (nubes, montañas de arena, conos, tubos, edificio y grúa)
        this.buildConstructionSite(scene, THREE);

        // =========================================================
        // EXCAVADORA 3D ARTICULADA
        // =========================================================
        const rootGroup = new THREE.Group();
        scene.add(rootGroup);

        const matYellow = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.25, roughness: 0.35 });
        const matDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.45, roughness: 0.5 });
        const matGlass = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.15 });
        const matSteel = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.75, roughness: 0.25 });

        // Orugas
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

        // Cabina y carrocería
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

        // Brazo y Pala
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

        // Redimensionamiento automático
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

    buildConstructionSite(scene, THREE) {
        // 1. Montículos de arena
        const sandMat = new THREE.MeshStandardMaterial({ color: 0xe6ccb2, roughness: 0.95 });
        const mounds = [
            { x: -4.2, z: -3.2, r: 1.5, h: 1.05 },
            { x: 4.5, z: -4.0, r: 1.8, h: 1.25 },
            { x: -3.8, z: 4.4, r: 1.2, h: 0.85 }
        ];
        mounds.forEach((m) => {
            const geo = new THREE.ConeGeometry(m.r, m.h, 24);
            const mesh = new THREE.Mesh(geo, sandMat);
            mesh.position.set(m.x, m.h / 2, m.z);
            scene.add(mesh);
        });

        // 2. Tubos sueltos de drenaje apilados
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.4, roughness: 0.45 });
        const pipePositions = [
            { x: -3.2, y: 0.22, z: 1.6 },
            { x: -3.2, y: 0.22, z: 2.1 },
            { x: -3.2, y: 0.6, z: 1.85 }
        ];
        pipePositions.forEach((p) => {
            const pipeGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.9, 18);
            const pipe = new THREE.Mesh(pipeGeo, pipeMat);
            pipe.rotation.z = Math.PI / 2;
            pipe.position.set(p.x, p.y, p.z);
            scene.add(pipe);
        });

        // 3. Conos viales naranjas con franja blanca
        const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const coneCoords = [
            [2.6, 2.5], [3.4, 2.1], [2.2, 3.3], [-2.5, -2.6]
        ];
        coneCoords.forEach(([cx, cz]) => {
            const group = new THREE.Group();
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.52, 16), coneMat);
            cone.position.y = 0.26;
            const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.12, 16), stripeMat);
            stripe.position.y = 0.3;
            group.add(cone, stripe);
            group.position.set(cx, 0, cz);
            scene.add(group);
        });

        // 4. Edificio en construcción al fondo
        const bldgMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
        const winMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 });
        const building = new THREE.Mesh(new THREE.BoxGeometry(3.6, 6.2, 3.0), bldgMat);
        building.position.set(-7.5, 3.1, -7.8);
        scene.add(building);

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 2; col++) {
                const win = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.1), winMat);
                win.position.set(-8.2 + col * 1.35, 1.6 + row * 1.6, -6.28);
                scene.add(win);
            }
        }

        // 5. Grúa torre amarilla
        const craneMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.3, roughness: 0.4 });
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.38, 8.8, 0.38), craneMat);
        mast.position.set(-4.8, 4.4, -7.5);
        scene.add(mast);

        const jib = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 0.28), craneMat);
        jib.position.set(-3.2, 8.6, -7.5);
        scene.add(jib);

        // 6. Nubes esponjosas en el cielo
        const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
        const cloudClusters = [
            [-6, 9.5, -10], [5, 10.2, -11], [9, 9.0, -4]
        ];
        cloudClusters.forEach(([x, y, z]) => {
            const cGroup = new THREE.Group();
            const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 14), cloudMat);
            const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 14), cloudMat);
            p2.position.set(0.85, -0.1, 0.2);
            const p3 = new THREE.Mesh(new THREE.SphereGeometry(0.65, 14, 14), cloudMat);
            p3.position.set(-0.8, -0.15, 0.1);
            cGroup.add(p1, p2, p3);
            cGroup.position.set(x, y, z);
            scene.add(cGroup);
        });
    }

    bindOrbitControls() {
        this.containers.forEach((container) => {
            let dragging = false;
            let lastX = 0;
            let lastY = 0;

            // Evita por completo que el navegador haga scroll al tocar el canvas en móvil
            container.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
            container.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

            container.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                dragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                container.setPointerCapture?.(e.pointerId);
            });

            container.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                e.preventDefault();
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                lastX = e.clientX;
                lastY = e.clientY;

                this.state.cameraOrbitYaw -= dx * 0.011;
                this.state.cameraOrbitPitch = Math.max(0.16, Math.min(1.25, this.state.cameraOrbitPitch + dy * 0.009));
            });

            const stopDrag = (e) => {
                dragging = false;
                if (e.pointerId && container.hasPointerCapture?.(e.pointerId)) {
                    container.releasePointerCapture(e.pointerId);
                }
            };

            container.addEventListener('pointerup', stopDrag);
            container.addEventListener('pointercancel', stopDrag);
        });
    }

    aplicarComando(etiqueta) {
        if (etiqueta === 'AVANZAR') {
            this.state.linearSpeed = 0.036;
            this.state.angularSpeed = 0;
        } else if (etiqueta === 'RETROCEDER') {
            this.state.linearSpeed = -0.036;
            this.state.angularSpeed = 0;
        } else if (etiqueta === 'IZQUIERDA') {
            this.state.angularSpeed = 0.04;
            this.state.linearSpeed = 0;
        } else if (etiqueta === 'DERECHA') {
            this.state.angularSpeed = -0.04;
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
        this.state.cameraOrbitYaw = 0.72;
        this.state.cameraOrbitPitch = 0.44;
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

        this.state.headingRad += this.state.angularSpeed;
        if (this.state.linearSpeed !== 0) {
            this.state.posX += Math.cos(this.state.headingRad) * this.state.linearSpeed;
            this.state.posZ -= Math.sin(this.state.headingRad) * this.state.linearSpeed;
            this.state.posX = Math.max(-5.2, Math.min(5.2, this.state.posX));
            this.state.posZ = Math.max(-5.2, Math.min(5.2, this.state.posZ));
        }

        const targetBoomAngle = (this.state.armElevation - 0.5) * 0.75;
        const targetStickAngle = (0.5 - this.state.armElevation) * 0.65;

        this.scenes.forEach((item) => {
            item.rootGroup.position.set(this.state.posX, 0, this.state.posZ);
            item.rootGroup.rotation.y = this.state.headingRad;
            item.ringMesh.position.set(this.state.posX, 0.025, this.state.posZ);

            item.boomPivot.rotation.z += (targetBoomAngle - item.boomPivot.rotation.z) * 0.14;
            item.stickPivot.rotation.z += (targetStickAngle - item.stickPivot.rotation.z) * 0.14;

            const radius = 5.6;
            const camX = this.state.posX + radius * Math.cos(this.state.cameraOrbitPitch) * Math.sin(this.state.cameraOrbitYaw);
            const camY = radius * Math.sin(this.state.cameraOrbitPitch) + 0.55;
            const camZ = this.state.posZ + radius * Math.cos(this.state.cameraOrbitPitch) * Math.cos(this.state.cameraOrbitYaw);

            item.camera.position.set(camX, camY, camZ);
            item.camera.lookAt(this.state.posX, 0.75, this.state.posZ);
            item.renderer.render(item.scene, item.camera);
        });
    }
}