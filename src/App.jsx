import { useState } from "react";
import UserScreen from "./components/UserScreen";
import HomeScreen from "./components/HomeScreen";
import "./App.css";

function App() {
  const [currentMode, setCurrentMode] = useState("home");
  const [calibrado, setCalirado] = useState(false);
  const [pontoReferencia, setPontoReferencia] = useState(null);
  const [qntdPontos, setQntdPontos] = useState(0);

  const resetSystem = () => {
		setCalirado(false);
		setPontoReferencia(null);
		setCurrentMode("home");
	};

  return (
    <div className="app">
      {currentMode === "home" && (
				<HomeScreen onModeChange={setCurrentMode} />
			)}

			{currentMode === "user" && (
				<UserScreen
					calibrado={calibrado}
					setCalirado={setCalirado}
					pontoReferencia={pontoReferencia}
					setPontoReferencia={setPontoReferencia}
					qntdPontos={qntdPontos}
					setQntdPontos={setQntdPontos}
					onGoHome={resetSystem}
				/>
			)}
    </div>
  );
}

export default App;