import { useState, useEffect } from "react";
import QRScanner from "./QRScanner";
import ARView from "./ARView";
import VisitorRegistration from "./VisitorRegistration";
import { supabase } from "../supabaseClient";
import "../styles/user.css";

function UserScreen({
	calibrado,
	setCalirado,
	pontoReferencia,
	setPontoReferencia,
	onGoHome,
}) {
	const [showQRScanner, setShowQRScanner] = useState(false);
	const [showAR, setShowAR] = useState(false);
	const [showRegistration, setShowRegistration] = useState(false);
	const [visitante, setVisitante] = useState(null);
	const [pontosDisponiveis, setPontosDisponiveis] = useState([]);
	const [pontoSelecionado, setPontoSelecionado] = useState(null);
	const [loadingPontos, setLoadingPontos] = useState(false);

	// Verifica se visitante já está cadastrado ao carregar
	useEffect(() => {
		checkVisitorRegistration();
	}, []);

	// Carrega pontos quando calibrado
	useEffect(() => {
		if (calibrado && pontoReferencia) {
			carregarPontosDisponiveis();
		}
	}, [calibrado, pontoReferencia]);

	const checkVisitorRegistration = async () => {
		try {
			const localVisitor = localStorage.getItem("localizar_visitor");

			if (localVisitor) {
				const visitorData = JSON.parse(localVisitor);

				// Valida no Supabase se visitante ainda existe
				const { data, error } = await supabase
					.from("visitantes")
					.select("*")
					.eq("id", visitorData.id)
					.maybeSingle();

				if (data) {
					setVisitante(data);
					console.log("✅ Visitante encontrado:", data);
				} else {
					// Dados locais inválidos, pede novo cadastro
					localStorage.removeItem("localizar_visitor");
					setShowRegistration(true);
				}
			} else {
				setShowRegistration(true);
			}
		} catch (err) {
			console.error("Erro ao verificar visitante:", err);
			setShowRegistration(true);
		}
	};

	const handleRegistrationComplete = (visitor) => {
		setVisitante(visitor);
		setShowRegistration(false);
		console.log("✅ Cadastro completo:", visitor);
	};

	const carregarPontosDisponiveis = async () => {
		setLoadingPontos(true);
		try {
			const { data, error } = await supabase
				.from("pontos")
				.select("id, nome, pos_x, pos_y, pos_z")
				.eq("qr_referencia", pontoReferencia.qrCode)
				.order("nome");

			if (error) {
				console.error("Erro ao carregar pontos:", error.message);
				alert("Erro ao carregar pontos do evento");
				return;
			}

			setPontosDisponiveis(data || []);
			console.log(`✅ ${data.length} pontos encontrados para o evento`);
		} catch (err) {
			console.error("Erro ao buscar pontos:", err);
		} finally {
			setLoadingPontos(false);
		}
	};

	const handleQRDetected = (qrData) => {
		if (qrData.length > 3) {
			const novoPontoReferencia = {
				qrCode: qrData,
				timestamp: Date.now(),
				gps: null,
				arPosition: null,
			};

			setPontoReferencia(novoPontoReferencia);
			setCalirado(true);
			setShowQRScanner(false);
		} else {
			alert("QR Code inválido. Use um QR Code válido.");
		}
	};

	const handleIniciarAR = () => {
		if (!pontoSelecionado) {
			alert("Por favor, selecione um ponto de interesse primeiro!");
			return;
		}

		if (!visitante) {
			alert("Você precisa estar cadastrado para usar o AR!");
			setShowRegistration(true);
			return;
		}

		setShowAR(true);
	};

	// Mostra tela de registro se necessário
	if (showRegistration) {
		return (
			<VisitorRegistration onRegistrationComplete={handleRegistrationComplete} />
		);
	}

	// Mostra QR Scanner
	if (showQRScanner) {
		return (
			<QRScanner
				onQRDetected={handleQRDetected}
				onCancel={() => setShowQRScanner(false)}
			/>
		);
	}

	return (
		<div className="user-container">
			<main className="user-card">
				<header className="user-card-header">
					<h2>
						<i className="fa-solid fa-map-marker-alt"></i> Modo Visitante
					</h2>
					<button className="btn-icon" onClick={onGoHome} title="Voltar">
						<i className="fa-solid fa-arrow-left"></i> Voltar
					</button>
				</header>
				{/* Informações do Visitante */}
				{visitante && (
					<section className="visitor-info">
						<div className="visitor-badge">
							<i className="fa-solid fa-user-check"></i>
							<div>
								<strong>{visitante.nome.split(" ")[0]}</strong>
								<span>{visitante.telefone}</span>
							</div>
						</div>

						<div
							className={`prize-status ${visitante.ganhou_premio ? "won" : "available"}`}
						>
							<i
								className={visitante.ganhou_premio ? "fa-solid fa-trophy" : "fa-solid fa-gift"}
							></i>
							<span>
								{visitante.ganhou_premio ? "Prêmio já resgatado" : "Prêmio disponível"}
							</span>
						</div>
					</section>
				)}

				{!calibrado ? (
					<section className="user-card-body calibration-needed">
						<div className="status-badge nao-calibrado">
							<i className="fa-solid fa-qrcode"></i> Calibração Necessária
						</div>
						<p className="instructions">
							Para começar, aponte a câmera para o QR Code do evento para calibrar sua
							posição.
						</p>
						<button
							className="botao btn-calibrar-user"
							onClick={() => setShowQRScanner(true)}
						>
							<i className="fa-solid fa-qrcode"></i> Calibrar com QR Code
						</button>
					</section>
				) : (
					<section className="user-card-body calibration-done">
						{/* <div className="status-badge calibrado">
							<i className="fa-solid fa-check"></i> Sistema Calibrado
						</div> */}

						<div className="info-group">
							<div className="info-item">
								<span>Evento: </span>
								<strong>{pontoReferencia.qrCode}</strong>
							</div>
						</div>

						{/* Seleção de Ponto */}
						<div className="point-selection">
							<label htmlFor="ponto-select" className="select-label">
								<i className="fa-solid fa-location-dot"></i> Escolha um ponto de interesse:
							</label>

							{loadingPontos ? (
								<div className="loading-pontos">
									<i className="fa-solid fa-spinner fa-spin"></i> Carregando pontos...
								</div>
							) : pontosDisponiveis.length === 0 ? (
								<div className="no-pontos">
									<i className="fa-solid fa-info-circle"></i>
									Nenhum ponto de interesse disponível neste evento ainda.
								</div>
							) : (
								<select
									id="ponto-select"
									className="ponto-select"
									value={pontoSelecionado?.id || pontoSelecionado || ""}
									onChange={(e) => {
										const ponto = pontosDisponiveis.find((p) => p.id === e.target.value);
										const valorSelect = e.target.value;
										if (valorSelect === "Todos") {
											setPontoSelecionado(valorSelect);
										} else {
											setPontoSelecionado(ponto || null);
										}
									}}
								>
									<option value="">-- Selecione um ponto --</option>
									{pontosDisponiveis.map((ponto) => (
										<option key={ponto.id} value={ponto.id}>
											{ponto.nome}
										</option>
									))}
									<option value="Todos">Todos os pontos</option>
								</select>
							)}
						</div>

						{/* {pontoSelecionado && (
							<div className="selected-point-info">
								<i className="fa-solid fa-check-circle"></i>
								Ponto selecionado: <strong>{pontoSelecionado?.nome || pontoSelecionado}</strong>
							</div>
						)} */}

						<p className="instructions">
							{pontoSelecionado
								? "Clique no botão abaixo para visualizar em Realidade Aumentada!"
								: "Selecione um ponto de interesse acima para começar."}
						</p>

						{!visitante?.ganhou_premio && (
							<div className="prize-tip">
								<i className="fa-solid fa-lightbulb"></i>
								<span>
									Dica: Clique 3 vezes em um ponto AR para ganhar prêmios! Você só saberá qual
									prêmio ganhou quando sair do modo AR.
								</span>
							</div>
						)}

						<div className="action-buttons">
							<button className="botao btn-recalibrar" onClick={() => setShowQRScanner(true)}>
								<i className="fa-solid fa-rotate-right"></i> Recalibrar
							</button>
							<button
								className="botao btn-iniciar"
								onClick={handleIniciarAR}
								disabled={!pontoSelecionado || pontosDisponiveis.length === 0}
							>
								<i className="fa-solid fa-eye"></i> Modo AR
							</button>
						</div>
					</section>
				)}
			</main>

			{showAR && calibrado && pontoSelecionado && visitante && (
				<ARView
					mode="user"
					calibrado={calibrado}
					pontoReferencia={pontoReferencia}
					pontoSelecionado={pontoSelecionado}
					pontosDisponiveis={pontosDisponiveis}
				/>
			)}
		</div>
	);
}

export default UserScreen;
