import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { supabase } from "../supabaseClient";

function ARView({
	calibrado,
	pontoReferencia,
	pontoSelecionado,
	pontosDisponiveis,
}) {
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
	const availablePrizes = useRef([]);
	const clickCounterRef = useRef(new Map());

	useEffect(() => {
		if (calibrado && pontoSelecionado && containerRef.current) {
			initAR();
		}

		return () => {
			cleanup();
		};
	}, [calibrado, pontoSelecionado]);

	useEffect(() => {
		loadAvailablePrizes();
	}, []);

	const loadAvailablePrizes = async () => {
		try {
			const { data, error } = await supabase
				.from("recompensas")
				.select("*")
				.gt("quantidade", 0)

			if (error) {
				throw error;
			}
			availablePrizes.current = data || [];
		} catch (err) {
			console.error("Erro ao carregar prêmios:", err);
		}
	};

	const generatePrizeByProbability = async () => {
		const localVisitor = localStorage.getItem("localizar_visitor");
		if (!localVisitor) {
			alert("Você precisa estar cadastrado para ganhar prêmios!");
			return null;
		}

		const visitor = JSON.parse(localVisitor);

		const { data: visitorData, error: visitorError } = await supabase
			.from("visitantes")
			.select("ganhou_premio")
			.eq("id", visitor.id)
			.single();

		if (visitorError || visitorData?.ganhou_premio) {
			return null;
		}

		const disponiveis = availablePrizes.current.filter((r) => r.quantidade > 0);
		if (disponiveis.length === 0) {
			alert("Não há mais prêmios disponíveis no momento 😢");
			return null;
		}

		const random = Math.random();
		let cumulative = 0;
		const totalProb = disponiveis.reduce((sum, r) => sum + r.probability, 0);

		for (const reward of disponiveis) {
			cumulative += reward.probability / totalProb;
			if (random <= cumulative) {
				return reward;
			}
		}

		return disponiveis[0];
	};

	const rarityColors = {
		Comum: "#95a5a6",
		Raro: "#3477db",
		"Ultra-Raro": "#f1c40f",
	};

	// ===== FUNÇÃO PARA CRIAR LABEL DE TEXTO 3D =====
	const createTextLabel = (text, position) => {
		// Cria um canvas para desenhar o texto
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		
		// Define a fonte ANTES de medir o texto
		const fontSize = 48;
		context.font = `Bold ${fontSize}px Lexend, Arial, sans-serif`;
		
		// Mede a largura real do texto
		const metrics = context.measureText(text);
		const textWidth = metrics.width;
		
		// Adiciona padding horizontal (20% de cada lado)
		const padding = textWidth * 0.4;
		const canvasWidth = Math.ceil(textWidth + padding);
		const canvasHeight = Math.ceil(fontSize * 2); // Altura = 2x o tamanho da fonte
		
		// Define as dimensões do canvas
		canvas.width = canvasWidth;
		canvas.height = canvasHeight;
		
		// IMPORTANTE: Redefinir a fonte após mudar o tamanho do canvas
		context.font = `Bold ${fontSize}px Lexend, Arial, sans-serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		
		// Desenha o fundo com bordas arredondadas
		const borderRadius = 15;
		context.fillStyle = 'rgba(0, 0, 0, 0.7)';
		
		// Retângulo com bordas arredondadas
		context.beginPath();
		context.moveTo(borderRadius, 0);
		context.lineTo(canvasWidth - borderRadius, 0);
		context.quadraticCurveTo(canvasWidth, 0, canvasWidth, borderRadius);
		context.lineTo(canvasWidth, canvasHeight - borderRadius);
		context.quadraticCurveTo(canvasWidth, canvasHeight, canvasWidth - borderRadius, canvasHeight);
		context.lineTo(borderRadius, canvasHeight);
		context.quadraticCurveTo(0, canvasHeight, 0, canvasHeight - borderRadius);
		context.lineTo(0, borderRadius);
		context.quadraticCurveTo(0, 0, borderRadius, 0);
		context.closePath();
		context.fill();
		
		// Desenha o texto
		context.fillStyle = '#ffffff';
		context.fillText(text, canvasWidth / 2, canvasHeight / 2);
		
		// Cria textura do canvas
		const texture = new THREE.CanvasTexture(canvas);
		texture.needsUpdate = true;
		
		// Cria material sprite
		const spriteMaterial = new THREE.SpriteMaterial({ 
			map: texture,
			transparent: true,
			depthTest: false, // Sempre visível por cima de outros objetos
			depthWrite: false
		});
		
		const sprite = new THREE.Sprite(spriteMaterial);
		
		// Calcula a escala proporcional do sprite
		// Mantém a proporção do canvas
		const aspectRatio = canvasWidth / canvasHeight;
		const baseHeight = 0.15; // Altura base em metros
		sprite.scale.set(baseHeight * aspectRatio, baseHeight, 1);
		
		// Posiciona acima do marcador
		sprite.position.copy(position);
		sprite.position.y += 0.4; // 40cm acima do marcador
		
		return sprite;
	};

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

		// estilos personalizados ao botão AR
		arButton.style.padding = "12px";
		arButton.style.fontSize = "13px";
		arButton.style.width = "200px";
		arButton.style.fontWeight = "bold";
		arButton.style.backgroundColor = "#4ecdc4";
		arButton.style.color = "#000";
		arButton.style.border = "none";
		arButton.style.borderRadius = "12px";
		arButton.style.boxShadow = "0 4px 15px rgba(78, 205, 196, 0.4)";
		arButton.style.fontFamily = "Lexend, Arial, sans-serif";
		arButton.style.opacity = "1";

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
					carregarPontoSelecionado();
				}, 1000);
			}
		});
	};

	const onSessionEnd = () => {
		limparObjetosAR();
		hitTestSourceRef.current = null;
		localReferenceSpaceRef.current = null;
		flipAnimationsRef.current = [];
		lastTimestampRef.current = 0;
		selectableObjectsRef.current = [];
		clickCounterRef.current.clear();
	};

	const onSelect = async () => {
		const controller = controllerRef.current;
		const scene = sceneRef.current;
		if (!controller || !scene) return;

		const raycaster = raycasterRef.current;
		const tempMatrix = tempMatrixRef.current;
		tempMatrix.identity().extractRotation(controller.matrixWorld);

		raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
		raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

		const intersects = raycaster.intersectObjects(
			selectableObjectsRef.current,
			true
		);

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

			startFlipAnimation(root, { axis: "y", degree: 2 * Math.PI, duration: 600 });

			if (newClickCount >= 3) {
				applyBlinkSmooth(root);
				clickCounterRef.current.set(objectId, 0);

				const prize = await generatePrizeByProbability();

				if (prize) {
					setCurrentPrize(prize);
					setTimeout(() => {
						setShowPrizeModal(true);
					}, 700);
				}
			}
		}
	};

	const applyBlinkSmooth = (obj) => {
		obj.traverse((child) => {
			if (child.isMesh && child.material) {
				const materials = Array.isArray(child.material)
					? child.material
					: [child.material];
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

	const resgatarPremio = async () => {
		if (!currentPrize) return;

		try {
			const localVisitor = localStorage.getItem("localizar_visitor");
			if (!localVisitor) {
				alert("Erro: Visitante não encontrado");
				return;
			}

			const visitor = JSON.parse(localVisitor);

			const { error: resgateError } = await supabase
				.from("premios_resgatados")
				.insert([
					{
						visitante_id: visitor.id,
						recompensa_id: currentPrize.id,
						resgatado_em: new Date().toISOString(),
					},
				]);

			if (resgateError) throw resgateError;

			const { error: visitorError } = await supabase
				.from("visitantes")
				.update({ ganhou_premio: true })
				.eq("id", visitor.id);

			if (visitorError) throw visitorError;

			const { error: estoqueError } = await supabase
				.from("recompensas")
				.update({ quantidade: currentPrize.quantidade - 1 })
				.eq("id", currentPrize.id);

			if (estoqueError) throw estoqueError;

			const updatedVisitor = { ...visitor, ganhou_premio: true };
			localStorage.setItem("localizar_visitor", JSON.stringify(updatedVisitor));

			alert("🎉 Prêmio resgatado com sucesso! Apresente seu print no nosso stand.");
			setShowPrizeModal(false);
			setCurrentPrize(null);

			loadAvailablePrizes();
		} catch (err) {
			console.error("Erro ao resgatar prêmio:", err);
			alert("Erro ao resgatar prêmio. Tente novamente ou procure um organizador.");
		}
	};

	const startFlipAnimation = (
		object3D,
		{ axis = "y", degree = Math.PI, duration = 600 } = {}
	) => {
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

	const carregarPontoSelecionado = () => {
		if (!calibrado || !pontoReferencia || !pontoSelecionado) return;

		if (pontoSelecionado == "Todos") {
			pontosDisponiveis.forEach((ponto, index) => {
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
		} else {
			const posicaoAbsoluta = new THREE.Vector3(
				pontoSelecionado.pos_x,
				pontoSelecionado.pos_y,
				pontoSelecionado.pos_z
			);

			if (pontoReferencia.arPosition) {
				posicaoAbsoluta.add(pontoReferencia.arPosition.clone());
			}

			criarModeloCarregado(posicaoAbsoluta, pontoSelecionado);
		}
	};

	const criarModeloCarregado = (posicao, dadosPonto) => {
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

				const cor = new THREE.Color().setHSL(0.3, 0.8, 0.5);

				model.traverse((child) => {
					if (child.isMesh) {
						if (child.material) child.material = child.material.clone();
						child.material.color = cor;
					}
				});

				sceneRef.current.add(model);
				selectableObjectsRef.current.push(model);

				// ===== ADICIONA LABEL DE TEXTO =====
				const labelPosition = model.position.clone();
				const textLabel = createTextLabel(dadosPonto.nome, labelPosition);
				sceneRef.current.add(textLabel);
			},
			undefined,
			(error) => {
				console.error("Erro ao carregar modelo:", error);
				criarCuboCarregado(posicao, dadosPonto);
			}
		);
	};

	const criarCuboCarregado = (posicao, dadosPonto) => {
		const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
		const cor = new THREE.Color().setHSL(0.3, 0.8, 0.5);

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

		// ===== ADICIONA LABEL DE TEXTO PARA O CUBO TAMBÉM =====
		const labelPosition = cube.position.clone();
		const textLabel = createTextLabel(dadosPonto.nome, labelPosition);
		sceneRef.current.add(textLabel);
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
			// Remove sprites (labels de texto)
			if (child instanceof THREE.Sprite) {
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
						padding: "20px",
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
							overflow: "hidden",
						}}
					>
						{(currentPrize.rarity === "Raro" || currentPrize.rarity === "Ultra-Raro") && (
							<div
								style={{
									position: "absolute",
									top: "-50%",
									left: "-50%",
									width: "200%",
									height: "200%",
									background: `conic-gradient(from 0deg, transparent, ${
										rarityColors[currentPrize.rarity]
									}30, transparent)`,
									animation: "rotate 3s linear infinite",
									pointerEvents: "none",
								}}
							/>
						)}

						<div
							style={{
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
								zIndex: 1,
							}}
						>
							{currentPrize.rarity}
						</div>

						<div
							style={{
								fontSize: "70px",
								marginBottom: "15px",
								zIndex: 1,
								position: "relative",
							}}
						>
							🎉
						</div>

						<h2
							style={{
								color: rarityColors[currentPrize.rarity],
								marginBottom: "15px",
								fontSize: "26px",
								zIndex: 1,
								position: "relative",
							}}
						>
							{currentPrize.rarity === "Ultra-Raro"
								? "INCRÍVEL!"
								: currentPrize.rarity === "Raro"
								? "PARABÉNS!"
								: "Você ganhou!"}
						</h2>

						<div
							style={{
								fontSize: "30px",
								marginBottom: "5px",
								zIndex: 1,
								position: "relative",
							}}
						>
							<img src={currentPrize.url_imagem} alt="" style={{ height: "150px" }} />
						</div>

						<h3
							style={{
								color: "#fff",
								marginBottom: "12px",
								fontSize: "22px",
								zIndex: 1,
								position: "relative",
							}}
						>
							{currentPrize.nome}
						</h3>

						<p
							style={{
								color: "#a0a0a0",
								marginBottom: "25px",
								lineHeight: "1.5",
								zIndex: 1,
								position: "relative",
							}}
						>
							{currentPrize.descricao}
							<br />
							<strong>Tire um print dessa tela!</strong>
						</p>

						<div
							style={{
								backgroundColor: "rgba(0, 0, 0, 0.3)",
								padding: "10px",
								borderRadius: "8px",
								marginBottom: "25px",
								fontSize: "14px",
								color: "#888",
								zIndex: 1,
								position: "relative",
							}}
						>
							{currentPrize.rarity === "Ultra-Raro" && "Chance: " + currentPrize.probability + " - Extremamente raro! 💎"}
							{currentPrize.rarity === "Raro" && "Chance: " + currentPrize.probability + " - Raro! 🔮"}
							{currentPrize.rarity === "Comum" && "Chance: " + currentPrize.probability + " - Comum 📋"}
						</div>

						<div style={{ display: "flex", gap: "10px" }}>
							{/* <button
								onClick={closePrizeModal}
								style={{
									flex: 1,
									backgroundColor: "transparent",
									border: "2px solid #666",
									color: "#888",
									padding: "14px 20px",
									borderRadius: "10px",
									fontSize: "16px",
									fontWeight: "bold",
									cursor: "pointer",
									transition: "all 0.3s ease",
								}}
							>
								Cancelar
							</button> */}

							<button
								onClick={resgatarPremio}
								style={{
									flex: 2,
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
									position: "relative",
								}}
							>
								Resgatar Prêmio
							</button>
						</div>
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