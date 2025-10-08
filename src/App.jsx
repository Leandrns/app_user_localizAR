import { useState } from "react";
import UserScreen from "./components/UserScreen";
import "./App.css";

function App() {
  const [calibrado, setCalirado] = useState(false);
  const [pontoReferencia, setPontoReferencia] = useState(null);
  const [qntdPontos, setQntdPontos] = useState(0);

  return (
    <div className="app">
      <UserScreen
        calibrado={calibrado}
        setCalirado={setCalirado}
        pontoReferencia={pontoReferencia}
        setPontoReferencia={setPontoReferencia}
        qntdPontos={qntdPontos}
        setQntdPontos={setQntdPontos}
      />
    </div>
  );
}

export default App;