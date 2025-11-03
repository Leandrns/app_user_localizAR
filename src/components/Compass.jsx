import { useEffect, useState, useRef } from 'react';
import '../styles/compass.css';

function Compass({ userPosition, targetPoints, onPointSelect }) {
  const [heading, setHeading] = useState(0);
  const [pointDirections, setPointDirections] = useState([]);
  const [deviceSupported, setDeviceSupported] = useState(true);
  const compassRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    // Verifica suporte ao DeviceOrientation
    if (!window.DeviceOrientationEvent) {
      setDeviceSupported(false);
      return;
    }

    let lastHeading = 0;
    const smoothingFactor = 0.15; // Suavização do movimento

    const handleOrientation = (event) => {
      let alpha = event.alpha; // Rotação em torno do eixo Z (norte magnético)
      
      if (alpha !== null) {
        // Normaliza para 0-360
        alpha = alpha % 360;
        if (alpha < 0) alpha += 360;

        // Suaviza o movimento
        const diff = alpha - lastHeading;
        const shortestDiff = ((diff + 180) % 360) - 180;
        lastHeading = (lastHeading + shortestDiff * smoothingFactor) % 360;
        
        setHeading(lastHeading);
      }
    };

    const requestPermission = async () => {
      // iOS 13+ requer permissão
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
          } else {
            setDeviceSupported(false);
          }
        } catch (error) {
          console.error('Erro ao solicitar permissão:', error);
          setDeviceSupported(false);
        }
      } else {
        // Navegadores que não precisam de permissão
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        // Fallback para deviceorientation
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    };

    requestPermission();

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!userPosition || !targetPoints || targetPoints.length === 0) return;

    // Calcula direções para cada ponto
    const directions = targetPoints.map(point => {
      const dx = point.pos_x - userPosition.x;
      const dz = point.pos_z - userPosition.z;
      
      // Calcula ângulo em radianos e converte para graus
      let angle = Math.atan2(dx, dz) * (180 / Math.PI);
      
      // Normaliza para 0-360
      angle = (angle + 360) % 360;
      
      // Calcula distância
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      return {
        ...point,
        angle,
        distance: distance.toFixed(1)
      };
    });

    setPointDirections(directions);
  }, [userPosition, targetPoints]);

  if (!deviceSupported) {
    return (
      <div className="compass-error">
        <i className="fa-solid fa-exclamation-triangle"></i>
        <span>Bússola não disponível neste dispositivo</span>
      </div>
    );
  }

  return (
    <div className="compass-container">
      <div className="compass-wrapper">
        {/* Círculo externo da bússola */}
        <div 
          ref={compassRef}
          className="compass-circle" 
          style={{ transform: `rotate(${-heading}deg)` }}
        >
          {/* Marcações cardeais */}
          <div className="compass-mark north">N</div>
          <div className="compass-mark east">L</div>
          <div className="compass-mark south">S</div>
          <div className="compass-mark west">O</div>
          
          {/* Linhas de marcação */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
            <div
              key={angle}
              className={`compass-tick ${angle % 90 === 0 ? 'major' : ''}`}
              style={{ transform: `rotate(${angle}deg)` }}
            />
          ))}

          {/* Indicadores de pontos de interesse */}
          {pointDirections.map((point, index) => {
            const relativeAngle = (point.angle - heading + 360) % 360;
            const isInView = relativeAngle > 270 || relativeAngle < 90; // Campo de visão ±90°
            
            return (
              <div
                key={point.id || index}
                className={`point-indicator ${isInView ? 'in-view' : ''}`}
                style={{ transform: `rotate(${point.angle}deg)` }}
                onClick={() => onPointSelect && onPointSelect(point)}
              >
                <div className="point-marker">
                  <i className="fa-solid fa-location-dot"></i>
                  <span className="point-distance">{point.distance}m</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Indicador central (você está aqui) */}
        <div className="compass-center">
          <div className="compass-needle">
            <div className="needle-north"></div>
          </div>
        </div>

        {/* Informação de heading */}
        <div className="compass-info">
          <span className="heading-value">{Math.round(heading)}°</span>
          <span className="heading-label">{getCardinalDirection(heading)}</span>
        </div>
      </div>

      {/* Lista de pontos visíveis */}
      {pointDirections.length > 0 && (
        <div className="points-list">
          <div className="points-list-header">
            <i className="fa-solid fa-map-marker-alt"></i>
            <span>Pontos de Interesse ({pointDirections.length})</span>
          </div>
          
          <div className="points-items">
            {pointDirections
              .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
              .map((point, index) => {
                const relativeAngle = (point.angle - heading + 360) % 360;
                const direction = getRelativeDirection(relativeAngle);
                
                return (
                  <div 
                    key={point.id || index} 
                    className="point-item"
                    onClick={() => onPointSelect && onPointSelect(point)}
                  >
                    <div className="point-item-icon">
                      <i className="fa-solid fa-location-dot"></i>
                    </div>
                    <div className="point-item-info">
                      <span className="point-name">{point.nome}</span>
                      <span className="point-details">
                        {point.distance}m • {direction}
                      </span>
                    </div>
                    <div className="point-item-arrow">
                      <i 
                        className="fa-solid fa-arrow-up" 
                        style={{ transform: `rotate(${relativeAngle}deg)` }}
                      ></i>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// Função auxiliar para converter graus em direção cardeal
function getCardinalDirection(degrees) {
  const directions = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(((degrees % 360) / 45)) % 8;
  return directions[index];
}

// Função auxiliar para direção relativa
function getRelativeDirection(angle) {
  if (angle > 337.5 || angle <= 22.5) return 'À frente';
  if (angle > 22.5 && angle <= 67.5) return 'Frente-direita';
  if (angle > 67.5 && angle <= 112.5) return 'À direita';
  if (angle > 112.5 && angle <= 157.5) return 'Atrás-direita';
  if (angle > 157.5 && angle <= 202.5) return 'Atrás';
  if (angle > 202.5 && angle <= 247.5) return 'Atrás-esquerda';
  if (angle > 247.5 && angle <= 292.5) return 'À esquerda';
  return 'Frente-esquerda';
}

export default Compass;