// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // L'URL de votre client React
    methods: ["GET", "POST"]
  }
});

// Écoute des connexions des clients
io.on('connection', (socket) => {
  console.log(`Un utilisateur est connecté: ${socket.id}`);

  // Gère la déconnexion
  socket.on('disconnect', () => {
    console.log(`L'utilisateur ${socket.id} s'est déconnecté.`);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🎉 Serveur en écoute sur le port ${PORT}`);
});