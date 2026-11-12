/* ==========================================================================
   Motor 3D Interactivo (Three.js) - Sincronizado con IDs RDS 11 al 21
   ========================================================================== */

export class Excavator3DManager {
    constructor(containers) {
        this.containers = containers.filter(Boolean);
        this.scenes = [];

        this.state = {
            posX: 0,
            posZ: 0,
            chassisYawRad: 0,       // Orientación de las orugas
            chassisAngularSpeed: 0, // Giro continuo del chasis (IDs 13 y 14)
            cabinYawRad: 0,         // Ángulo actual de la cabina superior
            targetCabinYawRad: 0,   // Ángulo objetivo de la cabina (IDs 15 y 16)
            armElevation: 0.5,      // Elevación de la garra (IDs 17 y 18)
            linearSpeed: 0,         // Avance/retroceso (IDs 11 y 12)
            speedMultiplier: 1.0,   // Multiplicador de velocidad (ID 19)
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

        // Iluminación
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x6b8e23, 0.9);
        scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
        sunLight.position.set(10, 16, 8);
        sunLight.castShadow = true;
        scene.add(sunLight);

        // Suelo verde
        const ground = new THREE.Mesh(
            new THREE.CircleGeometry(32, 48),
            new THREE.MeshStandardMaterial({ color: 0x6ab04c, roughness: 0.9 })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Plataforma de tierra
        const dirtPad = new THREE.Mesh(
            new THREE.CircleGeometry(7.2, 40),
            new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.95 })
        );
        dirtPad.rotation.x = -Math.PI / 2;
        dirtPad.position.y = 0.01;
        scene.add(dirtPad);

        // Aro guía
        const ringMesh = new THREE.Mesh(
            new THREE.RingGeometry(1.42, 1.5, 48),
            new THREE.MeshBasicMaterial({ color: 0xffb703, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
        );
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = 0.025;
        scene.add(ringMesh);

        this.buildConstructionSite(scene, THREE);

        // =========================================================
        // EXCAVADORA 3D (CHASSIS + CABINA SUPERIOR GIRATORIA)
        // =========================================================
        const rootGroup = new THREE.Group();
        scene.add(rootGroup);

        const matYellow = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.25, roughness: 0.35 });
        const matDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.45, roughness: 0.5 });
        const matGlass = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.15 });
        const matSteel = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.75, roughness: 0.25 });

        // 1. Orugas y chasis base
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

        // Corona giratoria central
        const turretRing = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.48, 0.12, 24), matSteel);
        turretRing.position.set(0, 0.38, 0);
        rootGroup.add(turretRing);

        // 2. Cabina superior y torreta (gira independientemente sobre las orugas)
        const upperBody = new THREE.Group();
        upperBody.position.set(0, 0.44, 0);
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

        // 3. Brazo y Garra acoplados a la cabina giratoria
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

        return { container, scene, camera, renderer, rootGroup, upperBody, ringMesh, boomPivot, stickPivot };
    }

    buildConstructionSite(scene, THREE) {
        const sandMat = new THREE.MeshStandardMaterial({ color: 0xe6ccb2, roughness: 0.95 });
        [
            { x: -4.2, z: -3.2, r: 1.5, h: 1.05 },
            { x: 4.5, z: -4.0, r: 1.8, h: 1.25 },
            { x: -3.8, z: 4.4, r: 1.2, h: 0.85 }
        ].forEach((m) => {
            const mesh = new THREE.Mesh(new THREE.ConeGeometry(m.r, m.h, 24), sandMat);
            mesh.position.set(m.x, m.h / 2, m.z);
            scene.add(mesh);
        });

        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.4, roughness: 0.45 });
        [
            { x: -3.2, y: 0.22, z: 1.6 },
            { x: -3.2, y: 0.22, z: 2.1 },
            { x: -3.2, y: 0.6, z: 1.85 }
        ].forEach((p) => {
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.9, 18), pipeMat);
            pipe.rotation.z = Math.PI / 2;
            pipe.position.set(p.x, p.y, p.z);
            scene.add(pipe);
        });

        const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        [[2.6, 2.5], [3.4, 2.1], [2.2, 3.3], [-2.5, -2.6]].forEach(([cx, cz]) => {
            const group = new THREE.Group();
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.52, 16), coneMat);
            cone.position.y = 0.26;
            const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.12, 16), stripeMat);
            stripe.position.y = 0.3;
            group.add(cone, stripe);
            group.position.set(cx, 0, cz);
            scene.add(group);
        });

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

        const craneMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.3, roughness: 0.4 });
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.38, 8.8, 0.38), craneMat);
        mast.position.set(-4.8, 4.4, -7.5);
        scene.add(mast);

        const jib = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 0.28), craneMat);
        jib.position.set(-3.2, 8.6, -7.5);
        scene.add(jib);

        const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
        [[-6, 9.5, -10], [5, 10.2, -11], [9, 9.0, -4]].forEach(([x, y, z]) => {
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

    playHornBeep() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(340, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.28);
        } catch (_) {}
    }

    aplicarComando(idComando, etiqueta = '') {
        const cmd = Number(idComando);
        const upper = String(etiqueta).toUpperCase();

        if (cmd === 11 || upper === 'AVANZAR') {
            this.state.linearSpeed = 0.036 * this.state.speedMultiplier;
            this.state.chassisAngularSpeed = 0;
        } else if (cmd === 12 || upper === 'RETROCEDER') {
            this.state.linearSpeed = -0.036 * this.state.speedMultiplier;
            this.state.chassisAngularSpeed = 0;
        } else if (cmd === 13 || upper === 'GIRAR IZQUIERDA') {
            this.state.chassisAngularSpeed = 0.032 * this.state.speedMultiplier;
            this.state.linearSpeed = 0;
        } else if (cmd === 14 || upper === 'GIRAR DERECHA') {
            this.state.chassisAngularSpeed = -0.032 * this.state.speedMultiplier;
            this.state.linearSpeed = 0;
        } else if (cmd === 15 || upper.includes('CABINA IZQ')) {
            // 15: Gira Cabina Izquierda 90° independiente sobre las orugas
            this.state.targetCabinYawRad += Math.PI / 2;
            this.state.linearSpeed = 0;
            this.state.chassisAngularSpeed = 0;
        } else if (cmd === 16 || upper.includes('CABINA DER')) {
            // 16: Gira Cabina Derecha 90° independiente sobre las orugas
            this.state.targetCabinYawRad -= Math.PI / 2;
            this.state.linearSpeed = 0;
            this.state.chassisAngularSpeed = 0;
        } else if (cmd === 17 || upper.includes('ELEVAR') || upper.includes('SUBIR')) {
            // 17: Elevar Garra
            this.state.armElevation = Math.min(1, this.state.armElevation + 0.25);
        } else if (cmd === 18 || upper.includes('BAJAR')) {
            // 18: Bajar Garra
            this.state.armElevation = Math.max(0, this.state.armElevation - 0.25);
        } else if (cmd === 19 || upper.includes('VELOCIDAD')) {
            // 19: Alternar velocidad normal / turbo
            this.state.speedMultiplier = this.state.speedMultiplier === 1.0 ? 1.8 : 1.0;
        } else if (cmd === 21 || upper.includes('SONIDO')) {
            // 21: Claxon
            this.playHornBeep();
        } else if (cmd === 0 || cmd === 20 || upper === 'NEUTRAL' || upper.includes('STOP') || upper.includes('ENC/APAG')) {
            // 20 / 0: Detener / Enc-Apag
            this.state.linearSpeed = 0;
            this.state.chassisAngularSpeed = 0;
        }
    }

    reset() {
        this.state.posX = 0;
        this.state.posZ = 0;
        this.state.chassisYawRad = 0;
        this.state.chassisAngularSpeed = 0;
        this.state.cabinYawRad = 0;
        this.state.targetCabinYawRad = 0;
        this.state.armElevation = 0.5;
        this.state.linearSpeed = 0;
        this.state.speedMultiplier = 1.0;
        this.state.cameraOrbitYaw = 0.72;
        this.state.cameraOrbitPitch = 0.44;
    }

    getTelemetry() {
        const deg = Math.round(((this.state.cabinYawRad * 180) / Math.PI) % 360);
        return {
            angleDeg: deg,
            armPct: Math.round(this.state.armElevation * 100),
            posX: this.state.posX.toFixed(1),
            posZ: this.state.posZ.toFixed(1)
        };
    }

    animate() {
        requestAnimationFrame(this.animate);

        // Rotación del chasis/orugas (IDs 13 y 14)
        if (this.state.chassisAngularSpeed !== 0) {
            this.state.chassisYawRad += this.state.chassisAngularSpeed;
        }

        // Rotación independiente de la cabina (IDs 15 y 16)
        this.state.cabinYawRad += (this.state.targetCabinYawRad - this.state.cabinYawRad) * 0.14;

        // Desplazamiento lineal de las orugas (IDs 11 y 12)
        if (this.state.linearSpeed !== 0) {
            this.state.posX += Math.cos(this.state.chassisYawRad) * this.state.linearSpeed;
            this.state.posZ -= Math.sin(this.state.chassisYawRad) * this.state.linearSpeed;
            this.state.posX = Math.max(-5.2, Math.min(5.2, this.state.posX));
            this.state.posZ = Math.max(-5.2, Math.min(5.2, this.state.posZ));
        }

        // Elevación de la garra/brazo (IDs 17 y 18)
        const targetBoomAngle = (this.state.armElevation - 0.5) * 0.75;
        const targetStickAngle = (0.5 - this.state.armElevation) * 0.65;

        this.scenes.forEach((item) => {
            item.rootGroup.position.set(this.state.posX, 0, this.state.posZ);
            item.rootGroup.rotation.y = this.state.chassisYawRad;

            // La cabina gira independientemente sobre el chasis
            item.upperBody.rotation.y = this.state.cabinYawRad;

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