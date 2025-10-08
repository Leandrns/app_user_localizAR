# LocalizAR Visitante 📱

**Versão:** 1.0.0  
**Status:** Produção

![WebXR](https://img.shields.io/badge/WebXR-Enabled-brightgreen)
![React](https://img.shields.io/badge/React-19.1.1-blue)
![Three.js](https://img.shields.io/badge/Three.js-0.179.1-orange)

---

## 📋 Sobre

**LocalizAR Visitante** é a aplicação de Realidade Aumentada para visitantes de eventos. Escaneie o QR Code do evento e visualize pontos de interesse em AR diretamente no seu smartphone.

### 🎯 Funcionalidades

- **📱 Fácil Acesso:** Escaneie o QR Code e comece
- **🔍 Visualização AR:** Veja pontos de interesse em realidade aumentada
- **🎁 Sistema de Recompensas:** Ganhe prêmios ao interagir com os pontos
- **🌐 Cross-platform:** Funciona em Android e iOS

---

## 🚀 Instalação Rápida

### Pré-requisitos
- Node.js 16+
- Smartphone com suporte WebXR
- HTTPS (obrigatório)

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/localizar-visitor.git
cd localizar-visitor

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
# Crie um arquivo .env.local com:
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_supabase

# 4. Execute em desenvolvimento
npm run dev

# 5. Build para produção
npm run build
```

---

## 📱 Como Usar

1. **Acesse a aplicação** via HTTPS
2. **Escaneie o QR Code** do evento
3. **Clique em "Start AR"** quando solicitado
4. **Explore** os pontos de interesse em AR
5. **Interaja** clicando nos ícones 3D para ganhar prêmios

---

## 🎁 Sistema de Prêmios

Clique 3 vezes em qualquer ponto AR para ter a chance de ganhar prêmios com diferentes raridades:

- **🔵 Comum** (60% de chance)
- **🟣 Raro** (25% de chance)
- **🟠 Épico** (12% de chance)
- **🟡 Lendário** (3% de chance)

---

## 🛠️ Tecnologias

- React 19.1.1
- Three.js 0.179.1
- WebXR Device API
- Supabase (backend)
- jsQR (scanner QR)

---

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes

---

## 🆘 Suporte

**Problemas comuns:**

| Problema | Solução |
|----------|---------|
| AR não inicia | Verifique se está em HTTPS |
| QR não detecta | Melhore a iluminação |
| Pontos não aparecem | Verifique conexão com internet |

Para mais ajuda, abra uma [issue no GitHub](https://github.com/seu-usuario/localizar-visitor/issues)

---

**Desenvolvido com ❤️ pela equipe LocalizAR**