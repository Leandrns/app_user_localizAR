import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { supabase } from '../supabaseClient';
import {RareCandy} from '../assets/Rare_Candy.png'

function ARView({ calibrado, pontoReferencia }) {
	const containerRef = useRef(null);
	const sceneRef = useRef(null);
	const rendererRef = useRef(null);
	const cameraRef = useRef(null);
	const controllerRef = useRef(null);
	const hitTestSourceRef = useRef(null);
	const localReferenceSpaceRef = useRef(null);
	const loaderRef = useRef(new GLTFLoader());
	const selectableObjectsRef = useRef([]);
	const raycasterRef = useRef(new THREE.Raycaster());
	const tempMatrixRef = useRef(new THREE.Matrix4());
	const flipAnimationsRef = useRef([]);
	const lastTimestampRef = useRef(0);
	
	const [showPrizeModal, setShowPrizeModal] = useState(false);
	const [currentPrize, setCurrentPrize] = useState(null);
	const clickCounterRef = useRef(new Map());

	const prizeSystem = {
		comum: {
			probability: 0.50,
			prizes: [
				{ name: "Pacote com Balas", description: "Pacote com balas", urlImg: RareCandy, rarity: "Comum" },
			]
		},
		raro: {
			probability: 0.35,
			prizes: [
				{ name: "Bulbasaur", description: "Chaveiro com modelo 3D do Bulbasaur", urlImg: "https://projectpokemon.org/images/normal-sprite/bulbasaur.gif", rarity: "Raro" },
				{ name: "Squirtle", description: "Chaveiro com modelo 3D do Squirtle", urlImg: "https://projectpokemon.org/images/normal-sprite/squirtle.gif", rarity: "Raro" },
				{ name: "Charmander", description: "Chaveiro com modelo 3D da Charmander", urlImg: "https://projectpokemon.org/images/normal-sprite/charmander.gif", rarity: "Raro" },
			]
		},
		epico: {
			probability: 0.15,
			prizes: [
				{ name: "Pikachu", description: "Chaveiro com modelo 3D do Pikachu", urlImg: "https://projectpokemon.org/images/normal-sprite/pikachu.gif", rarity: "Ultra-Raro" },
			]
		},
	};

	const rarityColors = {
		"Comum": "#95a5a6",
		"Raro": "#3477db",
		"Ultra-Raro": "#f1c40f"
	};

	useEffect(() => {
		if (calibrado && containerRef.current) {
			initAR();
		}

		return () => {
			cleanup();
		};
	}, [calibrado]);

	const initAR = () => {
		const container = containerRef.current;
		if (!container) return;

		const scene = new THREE.Scene();
		sceneRef.current = scene;

		const camera = new THREE.PerspectiveCamera(
			70,
			window.innerWidth / window.innerHeight,
			0.01,
			20
		);
		cameraRef.current = camera;

		const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
		light.position.set(0.5, 1, 0.25);
		scene.add(light);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight.position.set(1, 1, 1);
		scene.add(directionalLight);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.xr.enabled = true;
		rendererRef.current = renderer;

		container.appendChild(renderer.domElement);

		const arButton = ARButton.createButton(renderer, {
			requiredFeatures: ["hit-test"],
		});
		container.appendChild(arButton);

		const controller = renderer.xr.getController(0);
		controller.addEventListener("select", onSelect);
		controllerRef.current = controller;
		scene.add(controller);

		renderer.xr.addEventListener("sessionstart", onSessionStart);
		renderer.xr.addEventListener("sessionend", onSessionEnd);
		window.addEventListener("resize", onWindowResize);

		animate();
	};

	const onSessionStart = () => {
		const renderer = rendererRef.current;
		if (!renderer) return;

		const session = renderer.xr.getSession();

		session.requestReferenceSpace("viewer").then((viewerReferenceSpace) => {
			session.requestHitTestSource({ space: viewerReferenceSpace }).then((source) => {
				hitTestSourceRef.current = source;
			});
		});

		session.requestReferenceSpace("local").then((refSpace) => {
			localReferenceSpaceRef.current = refSpace;

			if (calibrado && pontoReferencia) {
				if (!pontoReferencia.arPosition) {
					pontoReferencia.arPosition = new THREE.Vector3(0, 0, 0);
				}

				setTimeout(() => {
					carregarPontosSalvos();
				}, 1000);
			}
		});
	};

	const onSessionEnd = () => {
		hitTestSourceRef.current = null;
		localReferenceSpaceRef.current = null;
		limparObjetosAR();
		flipAnimationsRef.current = [];
		lastTimestampRef.current = 0;
		selectableObjectsRef.current = [];
		clickCounterRef.current.clear();
	};

	const generatePrizeByProbability = () => {
		const random = Math.random();
		let cumulativeProbability = 0;

		const rarityOrder = ['lendario', 'epico', 'raro', 'comum'];
		
		for (const rarity of rarityOrder) {
			cumulativeProbability += prizeSystem[rarity].probability;
			
			if (random <= cumulativeProbability) {
				const prizes = prizeSystem[rarity].prizes;
				const randomIndex = Math.floor(Math.random() * prizes.length);
				return prizes[randomIndex];
			}
		}

		const commonPrizes = prizeSystem.comum.prizes;
		return commonPrizes[Math.floor(Math.random() * commonPrizes.length)];
	};

	const onSelect = () => {
		const controller = controllerRef.current;
		const scene = sceneRef.current;
		if (!controller || !scene) return;

		const raycaster = raycasterRef.current;
		const tempMatrix = tempMatrixRef.current;
		tempMatrix.identity().extractRotation(controller.matrixWorld);

		raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
		raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

		const intersects = raycaster.intersectObjects(selectableObjectsRef.current, true);
		if (intersects.length > 0) {
			let selected = intersects[0].object;
			let root = selected;
			while (root.parent && !root.userData?.carregado) {
				root = root.parent;
			}
			if (!root.userData) root = selected;

			const objectId = root.uuid;
			const currentClicks = clickCounterRef.current.get(objectId) || 0;
			const newClickCount = currentClicks + 1;
			clickCounterRef.current.set(objectId, newClickCount);

			startFlipAnimation(root, { axis: "y", degree: (2*Math.PI), duration: 600 });

			if (newClickCount >= 3) {
				const applyBlinkSmooth = (obj) => {
					obj.traverse((child) => {
						if (child.isMesh && child.material) {
							const materials = Array.isArray(child.material) ? child.material : [child.material];
							materials.forEach((mat) => {
								if (mat && mat.color) {
									const originalColor = mat.color.clone();
									const flashColor = new THREE.Color(0xffffff);
									let flashes = 0;
									let direction = 1;
									let progress = 0;

									const interval = setInterval(() => {
										progress += direction * 0.1;
										if (progress >= 1) {
											progress = 1;
											direction = -1;
											flashes++;
										} else if (progress <= 0) {
											progress = 0;
											direction = 1;
											flashes++;
										}

										mat.color.lerpColors(originalColor, flashColor, progress);

										if (flashes >= 4) {
											clearInterval(interval);
											mat.color.copy(originalColor);
										}
									}, 20);
								}
							});
						}
					});
				};

				applyBlinkSmooth(root);
				clickCounterRef.current.set(objectId, 0);
				
				const prize = generatePrizeByProbability();
				setCurrentPrize(prize);
				
				setTimeout(() => {
					setShowPrizeModal(true);
				}, 700);
			}
		}
	};

	const startFlipAnimation = (object3D, { axis = "y", degree = Math.PI, duration = 600 } = {}) => {
		if (!object3D) return;
		const start = object3D.rotation[axis];
		const target = start + degree;
		flipAnimationsRef.current.push({
			object: object3D,
			axis,
			start,
			target,
			elapsed: 0,
			duration,
		});
	};

	const easeOutQuad = (t) => {
		return t * (2 - t);
	};

	const carregarPontosSalvos = async () => {
		if (!calibrado || !pontoReferencia) return;

		try {
			const { data, error } = await supabase
				.from("pontos")
				.select("*")
				.eq("qr_referencia", pontoReferencia.qrCode);

			if (error) {
				console.error("Erro ao carregar pontos do Supabase:", error.message);
				return;
			}

			console.log(`Carregando ${data.length} pontos do banco...`);

			data.forEach((ponto, index) => {
				const posicaoAbsoluta = new THREE.Vector3(
					ponto.pos_x,
					ponto.pos_y,
					ponto.pos_z
				);

				if (pontoReferencia.arPosition) {
					posicaoAbsoluta.add(pontoReferencia.arPosition.clone());
				}

				criarModeloCarregado(posicaoAbsoluta, ponto, index);
			});
		} catch (err) {
			console.error("Erro inesperado ao buscar pontos:", err);
		}
	};

	const criarModeloCarregado = (posicao, dadosPonto, index) => {
		loaderRef.current.load(
			"/map_pointer_3d_icon.glb",
			(gltf) => {
				const model = gltf.scene;
				model.position.copy(posicao);
				model.position.y += 1;
				model.scale.set(0.1, 0.1, 0.1);

				model.userData = {
					carregado: true,
					dadosOriginais: dadosPonto,
				};

				const cor = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);

				model.traverse((child) => {
					if (child.isMesh) {
						if (child.material) child.material = child.material.clone();
						child.material.color = cor;
					}
				});

				sceneRef.current.add(model);
				selectableObjectsRef.current.push(model);
			},
			undefined,
			(error) => {
				console.error("Erro ao carregar modelo:", error);
				criarCuboCarregado(posicao, dadosPonto, index);
			}
		);
	};

	const criarCuboCarregado = (posicao, dadosPonto, index) => {
		const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
		const hue = (index * 0.1) % 1;
		const cor = new THREE.Color().setHSL(hue, 0.7, 0.6);

		const material = new THREE.MeshLambertMaterial({ color: cor });
		const cube = new THREE.Mesh(geometry, material);
		cube.position.copy(posicao);
		cube.position.y += 0.05;

		cube.userData = {
			carregado: true,
			dadosOriginais: dadosPonto,
		};

		sceneRef.current.add(cube);
		selectableObjectsRef.current.push(cube);
	};

	const limparObjetosAR = () => {
		if (!sceneRef.current) return;

		const objetosParaRemover = [];
		sceneRef.current.traverse((child) => {
			if (
				child.isMesh &&
				(child.geometry?.type === "BoxGeometry" || child.userData?.carregado)
			) {
				objetosParaRemover.push(child);
			}
		});

		objetosParaRemover.forEach((obj) => {
			if (obj.parent) obj.parent.remove(obj);
			if (obj.geometry) obj.geometry.dispose();
			if (obj.material) {
				if (Array.isArray(obj.material)) {
					obj.material.forEach((m) => m.dispose && m.dispose());
				} else {
					obj.material.dispose && obj.material.dispose();
				}
			}
		});

		selectableObjectsRef.current = [];
		flipAnimationsRef.current = [];
	};

	const onWindowResize = () => {
		const camera = cameraRef.current;
		const renderer = rendererRef.current;

		if (camera && renderer) {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		}
	};

	const animate = () => {
		const renderer = rendererRef.current;
		if (renderer) {
			renderer.setAnimationLoop(render);
		}
	};

	const render = (timestamp, frame) => {
		const renderer = rendererRef.current;
		const scene = sceneRef.current;
		const camera = cameraRef.current;
		const hitTestSource = hitTestSourceRef.current;
		const localReferenceSpace = localReferenceSpaceRef.current;

		const last = lastTimestampRef.current || timestamp;
		const deltaMs = timestamp - last;
		lastTimestampRef.current = timestamp;

		if (frame && hitTestSource && localReferenceSpace) {
			// Hit test não é necessário para visitor, mas mantém compatibilidade
		}

		if (flipAnimationsRef.current.length > 0) {
			const toRemove = [];
			flipAnimationsRef.current.forEach((anim, idx) => {
				anim.elapsed += deltaMs;
				const t = Math.min(anim.elapsed / anim.duration, 1);
				const eased = easeOutQuad(t);
				const newRot = anim.start + (anim.target - anim.start) * eased;
				if (anim.object && anim.object.rotation) {
					anim.object.rotation[anim.axis] = newRot;
				}
				if (t >= 1) {
					toRemove.push(idx);
				}
			});
			for (let i = toRemove.length - 1; i >= 0; i--) {
				flipAnimationsRef.current.splice(toRemove[i], 1);
			}
		}

		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	};

	const cleanup = () => {
		if (rendererRef.current) {
			rendererRef.current.setAnimationLoop(null);

			if (rendererRef.current.xr.getSession && rendererRef.current.xr.getSession()) {
				rendererRef.current.xr.getSession().end();
			}
		}

		window.removeEventListener("resize", onWindowResize);

		limparObjetosAR();

		if (containerRef.current) {
			containerRef.current.innerHTML = "";
		}
	};

	const closePrizeModal = () => {
		setShowPrizeModal(false);
		setCurrentPrize(null);
	};

	return (
		<>
			<div
				ref={containerRef}
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					zIndex: 1,
				}}
			/>

			{showPrizeModal && currentPrize && (
				<div 
					style={{
						position: "fixed",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						backgroundColor: "rgba(0, 0, 0, 0.9)",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						zIndex: 1000,
						padding: "20px"
					}}
				>
					<div 
						style={{
							backgroundColor: "#1e1e1e",
							border: `3px solid ${rarityColors[currentPrize.rarity]}`,
							borderRadius: "20px",
							padding: "35px",
							textAlign: "center",
							maxWidth: "420px",
							width: "100%",
							color: "#fff",
							boxShadow: `0 8px 32px ${rarityColors[currentPrize.rarity]}40`,
							position: "relative",
							overflow: "hidden"
						}}
					>
						{(currentPrize.rarity === "Épico" || currentPrize.rarity === "Lendário") && (
							<div style={{
								position: "absolute",
								top: "-50%",
								left: "-50%",
								width: "200%",
								height: "200%",
								background: `conic-gradient(from 0deg, transparent, ${rarityColors[currentPrize.rarity]}30, transparent)`,
								animation: "rotate 3s linear infinite",
								pointerEvents: "none"
							}} />
						)}
						
						<div style={{
							position: "absolute",
							top: "15px",
							right: "15px",
							backgroundColor: rarityColors[currentPrize.rarity],
							color: "#000",
							padding: "4px 12px",
							borderRadius: "20px",
							fontSize: "12px",
							fontWeight: "bold",
							textTransform: "uppercase",
							zIndex: 1
						}}>
							{currentPrize.rarity}
						</div>
						
						<div style={{ fontSize: "70px", marginBottom: "15px", zIndex: 1, position: "relative" }}>
							🎉
						</div>
						
						<h2 style={{ 
							color: rarityColors[currentPrize.rarity], 
							marginBottom: "15px",
							fontSize: "26px",
							zIndex: 1,
							position: "relative"
						}}>
							{currentPrize.rarity === "Lendário" ? "INCRÍVEL!" : 
							 currentPrize.rarity === "Épico" ? "FANTÁSTICO!" : 
							 currentPrize.rarity === "Raro" ? "PARABÉNS!" : "Você ganhou!"}
						</h2>
						
						<div style={{ 
							fontSize: "30px", 
							marginBottom: "5px",
							zIndex: 1,
							position: "relative"
						}}>
							<img src={currentPrize.urlImg} alt="" style={{height: "150px"}}/>
						</div>
						
						<h3 style={{ 
							color: "#fff", 
							marginBottom: "12px",
							fontSize: "22px",
							zIndex: 1,
							position: "relative"
						}}>
							{currentPrize.name}
						</h3>
						
						<p style={{ 
							color: "#a0a0a0", 
							marginBottom: "25px",
							lineHeight: "1.5",
							zIndex: 1,
							position: "relative"
						}}>
							{currentPrize.description}<br/>
							Tire um print dessa tela!
						</p>

						<div style={{
							backgroundColor: "rgba(0, 0, 0, 0.3)",
							padding: "10px",
							borderRadius: "8px",
							marginBottom: "25px",
							fontSize: "14px",
							color: "#888",
							zIndex: 1,
							position: "relative"
						}}>
							{currentPrize.rarity === "Lendário" && "Chance: 3% - Extremamente raro! 💎"}
							{currentPrize.rarity === "Épico" && "Chance: 12% - Muito raro! ⭐"}
							{currentPrize.rarity === "Raro" && "Chance: 25% - Raro! 🔮"}
							{currentPrize.rarity === "Comum" && "Chance: 60% - Comum 📋"}
						</div>
						
						<button
							onClick={closePrizeModal}
							style={{
								backgroundColor: rarityColors[currentPrize.rarity],
								color: "#000",
								border: "none",
								padding: "14px 35px",
								borderRadius: "10px",
								fontSize: "16px",
								fontWeight: "bold",
								cursor: "pointer",
								transition: "all 0.3s ease",
								textTransform: "uppercase",
								zIndex: 1,
								position: "relative"
							}}
							onMouseOver={(e) => {
								e.target.style.transform = "scale(1.05)";
								e.target.style.boxShadow = `0 4px 20px ${rarityColors[currentPrize.rarity]}60`;
							}}
							onMouseOut={(e) => {
								e.target.style.transform = "scale(1)";
								e.target.style.boxShadow = "none";
							}}>
							Resgatar prêmio
						</button>
					</div>
				</div>
			)}

			<style>{`
				@keyframes rotate {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
				}
			`}</style>
		</>
	);
}

export default ARView;