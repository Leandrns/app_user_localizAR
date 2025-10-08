function HomeScreen({ onModeChange }) {
  return (
    <div id="home-screen">
      <img src="/logoprojeto.png" alt='Logo LocalizAR' id='imagem'></img>
      <p>
        Sistema de realidade aumentada para navegação em eventos. <br></br><br></br>
        Entre no modo visitante:
      </p>

      <button 
        className="home-btn user-btn" 
        onClick={() => onModeChange('user')}
      >
        <i className="fa-solid fa-users"></i>  Modo Visitante
        <br />
        <small>Visualizar pontos do evento</small>
      </button>
    </div>
  )
}

export default HomeScreen