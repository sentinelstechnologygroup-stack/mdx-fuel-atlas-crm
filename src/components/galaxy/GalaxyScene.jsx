import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useSettings } from "@/components/context/SettingsContext";
import { differenceInDays } from 'date-fns';
import { cn } from "@/lib/utils";

export default function GalaxyScene({ opportunities }) {
    const mountRef = useRef(null);
    const { theme, pipelineStages, branding } = useSettings();

    // Interaction State
    const [hoveredObject, setHoveredObject] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // THREE refs - kept in refs to persist across renders without triggering re-renders
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const requestRef = useRef(null);
    const interactablesRef = useRef([]);
    const raycaster = useRef(new THREE.Raycaster());
    const mouse = useRef(new THREE.Vector2());

    // --- Data Processing ---
    const { activeDeals, wonDeals, lostDeals, totalWonAmount, totalLostAmount } = useMemo(() => {
        const active = [];
        const won = [];
        const lost = [];
        let wonAmount = 0;
        let lostAmount = 0;

        opportunities.forEach(opp => {
            const val = Number(opp.estimated_monthly_gallons) || 0;
            if (opp.deal_stage === 'Closed Won') {
                won.push(opp);
                wonAmount += val;
            } else if (opp.deal_stage === 'Closed Lost') {
                lost.push(opp);
                lostAmount += val;
            } else {
                active.push(opp);
            }
        });

        return { activeDeals: active, wonDeals: won, lostDeals: lost, totalWonAmount: wonAmount, totalLostAmount: lostAmount };
    }, [opportunities]);

    // Sun Scaling
    const sunBaseRadius = 12;
    const sunScaleFactor = useMemo(() => {
        if (totalWonAmount === 0) return 1;
        const logValue = Math.log10(totalWonAmount + 1);
        return 1 + (logValue * 0.15);
    }, [totalWonAmount]);

    // Helpers
    const activeStages = useMemo(() => pipelineStages.filter(s => s.id !== 'Closed Won' && s.id !== 'Closed Lost'), [pipelineStages]);

    const getStageConfig = (stageId) => {
        const index = activeStages.findIndex(s => s.id === stageId);
        if (index === -1) return { radius: 180 };
        const total = activeStages.length;
        const minOrbit = (sunBaseRadius * sunScaleFactor) + 25;
        const maxOrbit = minOrbit + 120;
        const normalizedPos = 1 - (index / Math.max(total - 1, 1));
        const radius = minOrbit + (normalizedPos * (maxOrbit - minOrbit));
        return { radius };
    };

    const getHexColor = (stageId) => {
        const stage = pipelineStages.find(s => s.id === stageId);
        if (!stage) return 0xFFFFFF;
        if (stage.label.includes('New')) return 0x60A5FA;
        if (stage.label.includes('Discovery')) return 0x818CF8;
        if (stage.label.includes('Proposal')) return 0xC084FC;
        if (stage.label.includes('Negotiation')) return 0xFBBF24;
        return 0x94A3B8;
    };

    const getOrbitalSpeed = (updatedDate) => {
        if (!updatedDate) return 0.0005;
        const days = differenceInDays(new Date(), new Date(updatedDate));
        if (days < 7) return 0.0015;
        if (days < 30) return 0.0008;
        return 0.0002;
    };

    // --- Main Effect ---
    useEffect(() => {
        if (!mountRef.current) return;

        // 1. Setup Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.fog = new THREE.FogExp2(0x000000, 0.0012);

        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
        camera.position.set(0, 100, 220);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxDistance = 600;
        controls.minDistance = 60;
        controlsRef.current = controls;

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.2));
        scene.add(new THREE.PointLight(0xFFD700, 2, 800));

        interactablesRef.current = [];

        // Objects Creation
        // SUN
        const sunGeo = new THREE.SphereGeometry(sunBaseRadius, 64, 64);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFAA00 });
        const sun = new THREE.Mesh(sunGeo, sunMat);
        sun.scale.set(sunScaleFactor, sunScaleFactor, sunScaleFactor);
        sun.userData = { type: 'SUN', label: 'Closed Won', amount: totalWonAmount, count: wonDeals.length };
        scene.add(sun);
        interactablesRef.current.push(sun);

        // Sun Glow
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 200, 0, 1)');
        grad.addColorStop(0.5, 'rgba(255, 100, 0, 0.3)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, blending: THREE.AdditiveBlending }));
        const glowScale = sunBaseRadius * sunScaleFactor * 6;
        sunGlow.scale.set(glowScale, glowScale, 1);
        scene.add(sunGlow);

        // Black Hole
        const bhGroup = new THREE.Group();
        bhGroup.position.set(220, 0, -120);
        const bhMesh = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        bhGroup.add(bhMesh);
        const diskMesh = new THREE.Mesh(new THREE.RingGeometry(18, 40, 64), new THREE.MeshBasicMaterial({ color: 0x7C3AED, side: THREE.DoubleSide, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
        diskMesh.rotation.x = Math.PI / 2.2;
        bhGroup.add(diskMesh);
        const bhInteractable = new THREE.Mesh(new THREE.SphereGeometry(25, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
        bhInteractable.position.copy(bhGroup.position);
        bhInteractable.userData = { type: 'BLACK_HOLE', label: 'Closed Lost', amount: totalLostAmount, count: lostDeals.length };
        scene.add(bhInteractable);
        interactablesRef.current.push(bhInteractable);
        scene.add(bhGroup);

        // Planets
        activeDeals.forEach((opp, i) => {
            const config = getStageConfig(opp.deal_stage);
            const color = getHexColor(opp.deal_stage);
            const val = Number(opp.estimated_monthly_gallons) || 0;
            const size = Math.max(1.2, Math.log10(val + 1) * 1.5);

            const planet = new THREE.Mesh(
                new THREE.SphereGeometry(size, 32, 32),
                new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, emissive: color, emissiveIntensity: 0.2 })
            );

            const angle = (i * 137.5) * (Math.PI / 180);
            const variance = (Math.random() - 0.5) * 15;
            const radius = config.radius + variance;

            planet.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * (radius * 0.1), Math.sin(angle) * radius);
            planet.userData = { type: 'DEAL', opp, angle, radius, speed: getOrbitalSpeed(opp.updated_date), baseY: planet.position.y };
            scene.add(planet);
            interactablesRef.current.push(planet);
        });

        // Stars
        const starsGeo = new THREE.BufferGeometry();
        const starsPos = new Float32Array(3000 * 3);
        for(let i=0; i<3000*3; i++) starsPos[i] = (Math.random() - 0.5) * 2000;
        starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
        const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ size: 1, color: 0x888888, transparent: true, opacity: 0.8 }));
        scene.add(stars);


        // Event Listeners
        const onResize = () => {
            if (!mountRef.current || !camera || !renderer) return;
            const w = mountRef.current.clientWidth;
            const h = mountRef.current.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        const onMouseMove = (event) => {
            if (!mountRef.current) return;
            const rect = mountRef.current.getBoundingClientRect();
            mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        };
        window.addEventListener('mousemove', onMouseMove);

        // Animation Loop
        const animate = () => {
            if (!mountRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;

            requestRef.current = requestAnimationFrame(animate);

            // Orbit
            interactablesRef.current.forEach(obj => {
                if (obj.userData.type === 'DEAL') {
                    obj.userData.angle += obj.userData.speed;
                    obj.position.x = Math.cos(obj.userData.angle) * obj.userData.radius;
                    obj.position.z = Math.sin(obj.userData.angle) * obj.userData.radius;
                    obj.position.y = obj.userData.baseY + Math.sin(Date.now() * 0.001 + obj.userData.angle) * 2;
                    obj.rotation.y += 0.01;
                }
            });

            // Effects
            sun.rotation.y += 0.002;
            const pulse = glowScale + Math.sin(Date.now() * 0.002) * 5;
            sunGlow.scale.set(pulse, pulse, 1);
            sunGlow.lookAt(camera.position);
            diskMesh.rotation.z -= 0.02;
            stars.rotation.y += 0.0001;

            // Interaction
            raycaster.current.setFromCamera(mouse.current, camera);
            const intersects = raycaster.current.intersectObjects(interactablesRef.current);
            const hovered = intersects.length > 0 ? intersects[0].object : null;

            if (hovered) {
                // Update tooltip pos
                const vec = new THREE.Vector3();
                hovered.getWorldPosition(vec);
                vec.project(camera);

                let x = (vec.x * .5 + .5) * mountRef.current.clientWidth;
                let y = (-(vec.y * .5) + .5) * mountRef.current.clientHeight;

                // Clamp
                const tooltipWidth = 320;
                const tooltipHeight = 200;
                if (x + tooltipWidth > mountRef.current.clientWidth) x -= (tooltipWidth + 40);
                if (y + tooltipHeight > mountRef.current.clientHeight) y -= tooltipHeight;
                if (x < 0) x = 20;
                if (y < 0) y = 20;

                setTooltipPos({ x, y });
                document.body.style.cursor = 'pointer';
            } else {
                document.body.style.cursor = 'default';
            }
            setHoveredObject(hovered);

            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousemove', onMouseMove);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (mountRef.current && renderer.domElement && renderer.domElement.parentNode === mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
            // Dispose
            sunGeo.dispose(); sunMat.dispose();
            renderer.dispose();
            scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
                    else object.material.dispose();
                }
            });
        };
    }, [activeDeals, wonDeals, lostDeals, totalWonAmount, totalLostAmount, theme, activeStages, sunScaleFactor]); // Re-run if data changes

    return (
        <div className="relative w-full h-full bg-black">
            <div ref={mountRef} className="w-full h-full" />

            <div className="absolute top-8 left-8 pointer-events-none select-none z-10">
                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-500 to-amber-700 tracking-tighter drop-shadow-2xl relative z-0">
                    GALAXY
                </h1>
                <p className="text-white/30 text-sm font-mono tracking-[0.5em] uppercase ml-1 mt-2">
                    System Mass: ${totalWonAmount.toLocaleString()}
                </p>
            </div>

            {hoveredObject && (
                <div
                    className="absolute z-[100] pointer-events-none transition-all duration-75 ease-out"
                    style={{
                        left: tooltipPos.x,
                        top: tooltipPos.y,
                        transform: 'translate(20px, -20%)'
                    }}
                >
                    <div className={cn(
                        "bg-[#09090b] border p-6 rounded-xl shadow-2xl min-w-[320px] animate-in fade-in zoom-in-95 duration-150",
                        hoveredObject.userData.type === 'SUN' ? "border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.2)]" :
                        hoveredObject.userData.type === 'BLACK_HOLE' ? "border-purple-500/50 shadow-[0_0_30px_rgba(139,92,246,0.2)]" :
                        "border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                    )}>
                        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                            <span className={cn(
                                "text-xs font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded-full",
                                hoveredObject.userData.type === 'SUN' ? "bg-amber-500/20 text-amber-300" :
                                hoveredObject.userData.type === 'BLACK_HOLE' ? "bg-purple-500/20 text-purple-300" :
                                "bg-emerald-500/20 text-emerald-300"
                            )}>
                                {hoveredObject.userData.type === 'DEAL'
                                    ? hoveredObject.userData.opp.deal_stage
                                    : hoveredObject.userData.label}
                            </span>
                            {hoveredObject.userData.type === 'DEAL' && (
                                <span className="text-[10px] text-white/40 font-mono">
                                    {hoveredObject.userData.opp.created_date ? new Date(hoveredObject.userData.opp.created_date).toLocaleDateString() : ''}
                                </span>
                            )}
                        </div>

                        <div className="space-y-1">
                            {hoveredObject.userData.type === 'DEAL' ? (
                                <>
                                    <h3 className="text-xl font-bold text-white leading-tight">{hoveredObject.userData.opp.lead_name}</h3>
                                    <p className="text-sm text-white/50">{hoveredObject.userData.opp.product_type || 'Opportunity'}</p>

                                    <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Value</div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-mono font-bold text-white">
                                                    {`${Number(hoveredObject.userData.opp.estimated_monthly_gallons || 0).toLocaleString('en-US')} gal/mo`}
                                                </span>
                                                <span className="text-xs text-slate-500 font-bold">{branding?.currency || '$'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Probability</div>
                                            <div className="text-2xl font-mono font-bold text-white">
                                                {hoveredObject.userData.opp.probability || 0}%
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 font-mono border-t border-white/5 pt-2">
                                        <span>Target: {hoveredObject.userData.opp.expected_close_date ? new Date(hoveredObject.userData.opp.expected_close_date).toLocaleDateString() : 'N/A'}</span>
                                        <span>{differenceInDays(new Date(), new Date(hoveredObject.userData.opp.updated_date || new Date()))}d ago</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-xl font-bold text-white leading-tight mb-1">{hoveredObject.userData.label}</h3>
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <div>
                                            <div className="text-[10px] text-white/40 uppercase tracking-widest">Count</div>
                                            <div className="text-2xl text-white font-light">{hoveredObject.userData.count}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-white/40 uppercase tracking-widest">Value</div>
                                            <div className={cn("text-xl font-mono", hoveredObject.userData.type === 'SUN' ? "text-amber-400" : "text-purple-400")}>
                                                ${(hoveredObject.userData.amount).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute bottom-6 left-6 pointer-events-none z-10">
                 <div className="flex gap-4">
                     {activeStages.map(stage => (
                         <div key={stage.id} className="flex items-center gap-2 opacity-50">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#' + getHexColor(stage.id).toString(16).padStart(6,'0') }}></div>
                             <span className="text-[10px] text-white font-mono uppercase">{stage.label}</span>
                         </div>
                     ))}
                 </div>
            </div>
        </div>
    );
}