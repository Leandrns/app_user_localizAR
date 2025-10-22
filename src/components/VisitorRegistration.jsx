import { useState } from "react";
import { supabase } from "../supabaseClient";
import "../styles/registration.css";

function VisitorRegistration({ onRegistrationComplete }) {
	const [formData, setFormData] = useState({ nome: "", telefone: "" });
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const formatTelefone = (value) => {
		const clean = value.replace(/\D/g, "");
		if (clean.length <= 10) {
			return clean.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
		}
		return clean.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
	};

	const handleSubmit = async () => {
		setError("");
		setLoading(true);

		try {
			// Validações
			if (!formData.nome.trim() || formData.nome.trim().length < 3) {
				setError("Nome deve ter pelo menos 3 caracteres");
				setLoading(false);
				return;
			}

			const telefoneClean = formData.telefone.replace(/\D/g, "");
			if (telefoneClean.length < 10) {
				setError("Telefone inválido. Digite com DDD (10 ou 11 dígitos)");
				setLoading(false);
				return;
			}

			// Verifica se telefone já existe
			const { data: existente, error: searchError } = await supabase
				.from("visitantes")
				.select("*")
				.eq("telefone", telefoneClean)
				.maybeSingle();

			if (searchError && searchError.code !== "PGRST116") {
				throw searchError;
			}

			if (existente) {
				// Telefone já cadastrado - recupera dados
				console.log("Visitante já cadastrado, recuperando dados...");
				localStorage.setItem("localizar_visitor", JSON.stringify(existente));
				onRegistrationComplete(existente);
				setLoading(false);
				return;
			}

			// Cria novo visitante
			const novoVisitante = {
				nome: formData.nome.trim(),
				telefone: telefoneClean,
				ganhou_premio: false,
			};

			const { data: criado, error: insertError } = await supabase
				.from("visitantes")
				.insert([novoVisitante])
				.select()
				.single();

			if (insertError) throw insertError;

			// Salva no localStorage
			localStorage.setItem("localizar_visitor", JSON.stringify(criado));
			console.log("✅ Visitante cadastrado com sucesso:", criado);

			onRegistrationComplete(criado);
		} catch (err) {
			console.error("Erro ao cadastrar visitante:", err);
			setError("Erro ao cadastrar. Verifique sua conexão e tente novamente.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="registration-overlay">
			<div className="registration-card">
				<div className="registration-header">
					<h2>Bem-vindo ao LocalizAR!</h2>
					<p>Cadastre-se para participar e ganhar prêmios</p>
				</div>

				<div className="registration-form">
					<div className="input-group">
						<label>
							<i className="fa-solid fa-user"></i> Nome Completo
						</label>
						<input
							type="text"
							value={formData.nome}
							onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
							placeholder="Digite seu nome completo"
							disabled={loading}
						/>
					</div>

					<div className="input-group">
						<label>
							<i className="fa-solid fa-phone"></i> Telefone (com DDD)
						</label>
						<input
							type="tel"
							value={formData.telefone}
							onChange={(e) =>
								setFormData({
									...formData,
									telefone: formatTelefone(e.target.value),
								})
							}
							placeholder="(00) 00000-0000"
							maxLength={15}
							disabled={loading}
						/>
					</div>

					{error && (
						<div className="error-message">
							<i className="fa-solid fa-exclamation-circle"></i>
							{error}
						</div>
					)}

					<button onClick={handleSubmit} disabled={loading} className="btn-register">
						{loading ? (
							<>
								<i className="fa-solid fa-spinner fa-spin"></i> Cadastrando...
							</>
						) : (
							<>
								<i className="fa-solid fa-check"></i> Começar
							</>
						)}
					</button>

					<p className="registration-disclaimer">
						<i className="fa-solid fa-info-circle"></i>
						Ao cadastrar, você concorda em participar do sistema de prêmios. Cada visitante
						pode ganhar apenas 1 prêmio por evento.
					</p>
				</div>
			</div>
		</div>
	);
}

export default VisitorRegistration;
