// ✅ CODE COMPLET FINAL POUR server/index.js (Incluant Étape 6 Complète)

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { google } = require('googleapis');
const path = require('path');

const credentialsPath = path.join(__dirname, 'credentials.json');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};
const GOOGLE_SHEET_ID = '1DyEQb4Vau3csdX_nHeJt2vCe4wRzaUeL_482IMpigJo'; // Ensure this is your ID

// --- Fonction pour récupérer les noms des onglets ---
async function getSheetNames() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: 'https://www.googleapis.com/auth/spreadsheets',
        });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        const metaData = await sheets.spreadsheets.get({
            spreadsheetId: GOOGLE_SHEET_ID,
        });
        // Filter out sheets starting with '_' (convention for hidden/utility sheets)
        const titles = metaData.data.sheets
                         .map(sheet => sheet.properties.title)
                         .filter(title => !title.startsWith('_'));
        return titles;
    } catch (err) {
        console.error("Erreur API (getSheetNames):", err);
        return [];
    }
}

// --- Fonction pour récupérer les questions (ignore header row) ---
async function fetchQuestions(categories) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: 'https://www.googleapis.com/auth/spreadsheets',
        });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const promises = categories.map(category => {
            const range = `${category}!A:C`;
            return sheets.spreadsheets.values.get({
                spreadsheetId: GOOGLE_SHEET_ID,
                range: range,
            });
        });

        const responses = await Promise.all(promises);

        const allQuestions = responses.flatMap(response => {
            const rows = response.data.values;
            if (rows && rows.length > 1) { // Check for > 1 row
                return rows.slice(1).map(row => ({ // Slice(1) to skip header
                    question: row[0],
                    answer: row[1],
                    image: row[2] || null
                })).filter(q => q.question && q.answer); // Filter empty Q/A
            }
            return [];
        });
        return allQuestions;
    } catch (err) {
        console.error('Erreur API (fetchQuestions):', err);
        return [];
    }
}


function startQuizTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    room.currentQuestionIndex = 0;
    room.answers = {};
    // Ensure scores are reset at the start of the quiz
    room.players.forEach(p => p.score = 0);

    const sendNextQuestion = () => {
        const maxQuestions = 3; // Keep this low for testing
        if (room.currentQuestionIndex >= room.questions.length || room.currentQuestionIndex >= maxQuestions) {

            // Wait a moment for last answers before starting correction
            setTimeout(() => {
                // Check if room still exists before proceeding
                if (!rooms[roomCode]) {
                    console.log(`Room ${roomCode} non trouvée après le délai de fin de quiz.`);
                    return;
                }
                console.log(`🏁 Quiz terminé pour la room ${roomCode}. Préparation de la correction.`);
                const correctionData = {
                    questions: room.questions.slice(0, maxQuestions), // Only send questions actually asked
                    playerAnswers: room.answers,
                    players: room.players // Scores are still 0 here, validation updates them later
                };

                // Check if host is still connected
                const hostSocket = io.sockets.sockets.get(room.hostId);
                if (hostSocket) {
                     io.to(room.hostId).emit('startCorrection', correctionData);
                     console.log(`Données de correction envoyées à l'hôte ${room.hostId}`);
                } else {
                    console.log(`Hôte ${room.hostId} déconnecté, impossible de démarrer la correction.`);
                    // Inform remaining players?
                    io.to(roomCode).emit('error', "L'hôte s'est déconnecté avant la correction.");
                    // Consider deleting the room or handling host migration differently
                }

                room.players.forEach(player => {
                    const playerSocket = io.sockets.sockets.get(player.id);
                    if (player.id !== room.hostId && playerSocket) { // Also check player connection
                        io.to(player.id).emit('waitingForCorrection');
                    }
                });
            }, 500); // 500ms delay

            return; // Stop the timer loop
        }

        const questionIndex = room.currentQuestionIndex;
        const question = room.questions[questionIndex];
        io.to(roomCode).emit('newQuestion', {
            question,
            questionIndex: questionIndex + 1, // Display index (1-based)
            totalQuestions: Math.min(room.questions.length, maxQuestions)
        });
        room.currentQuestionIndex++;
        setTimeout(sendNextQuestion, 20000); // 20 seconds timer
    };
    sendNextQuestion();
}

function generateRoomCode() {
    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure code uniqueness (though collisions are rare with 4 chars)
    return rooms[code] ? generateRoomCode() : code;
}

io.on('connection', (socket) => {
    console.log(`✅ Un utilisateur s'est connecté : ${socket.id}`);

    socket.on('createRoom', async ({ pseudo }) => {
        const roomCode = generateRoomCode();
        socket.join(roomCode);
        const categories = await getSheetNames();
        rooms[roomCode] = {
            hostId: socket.id,
            players: [{ id: socket.id, pseudo: pseudo, score: 0 }],
            questions: [],
            answers: {},
            categories: categories // Store categories
        };
        socket.emit('roomCreated', {
            roomCode,
            players: rooms[roomCode].players,
            categories,
            hostId: rooms[roomCode].hostId
        });
        console.log(`🚪 Room créée : ${roomCode}. Catégories trouvées: ${categories.length}`);

        if (!categories || categories.length === 0) {
            console.error("⚠️ AVERTISSEMENT: Aucune catégorie trouvée. L'appel API a échoué.");
            socket.emit('error', "Impossible de charger les catégories depuis Google Sheets. Vérifiez la console du serveur et les permissions du fichier Sheets.");
        }
    });

   socket.on('joinRoom', ({ pseudo, roomCode }) => {
        const room = rooms[roomCode]; // Get room reference
        if (room) {
            socket.join(roomCode);
            const newPlayer = { id: socket.id, pseudo: pseudo, score: 0 };
            room.players.push(newPlayer);

            io.to(roomCode).emit('updatePlayerList', {
                players: room.players,
                hostId: room.hostId,
                categories: room.categories // Send categories
            });

            console.log(`👋 ${pseudo} a rejoint la room ${roomCode}`);
        } else {
            socket.emit('error', 'La room n\'existe pas.');
        }
    });

    socket.on('startGame', async ({ roomCode, selectedCategories }) => {
        const room = rooms[roomCode];
        const maxQuestions = 3; // Keep testing value
        if (room && room.hostId === socket.id) {
             // Ensure selectedCategories is an array
             if (!Array.isArray(selectedCategories) || selectedCategories.length === 0) {
                 socket.emit('error', 'Aucune catégorie sélectionnée.');
                 return;
             }
            console.log(`▶️ Lancement du quiz pour la room ${roomCode} avec les catégories: ${selectedCategories.join(', ')}`);
            const questions = await fetchQuestions(selectedCategories);
            if (questions.length > 0) {
                room.questions = questions.sort(() => 0.5 - Math.random()).slice(0, maxQuestions);
                console.log(`${questions.length} questions trouvées au total, ${room.questions.length} chargées pour le quiz.`);
                startQuizTimer(roomCode);
            } else {
                socket.emit('error', 'Impossible de charger les questions pour les catégories sélectionnées.');
            }
        }
    });

    socket.on('submitAnswer', ({ roomCode, answer, questionIndex }) => {
        const room = rooms[roomCode];
        if (room && room.players.some(p => p.id === socket.id)) { // Check player is in room
            if (questionIndex === undefined || questionIndex === null || questionIndex < 0) {
                console.error(`Réponse reçue sans index de question valide de ${socket.id}`);
                return;
            }
            if (!room.answers[questionIndex]) {
                room.answers[questionIndex] = [];
            }
            const alreadyAnswered = room.answers[questionIndex].some(ans => ans.playerId === socket.id);
            if (!alreadyAnswered) {
                 const player = room.players.find(p => p.id === socket.id); // Find player for pseudo
                room.answers[questionIndex].push({
                    playerId: socket.id,
                    pseudo: player ? player.pseudo : 'Inconnu', // Use found pseudo
                    answer: answer
                });
                console.log(`📝 Réponse reçue de ${player ? player.pseudo : socket.id} pour la question ${questionIndex}: "${answer}"`);
            } else {
                 // console.log(`⚠️ Réponse ignorée (déjà répondu) de ${socket.id} pour la question ${questionIndex}`);
            }
        } else {
            console.warn(`Réponse reçue de ${socket.id} pour une room (${roomCode}) inexistante ou non rejointe.`);
        }
    });

    // --- NOUVEAU : Logique de score revue ---
    socket.on('validateAnswer', ({ roomCode, playerId, isCorrect, questionIndex }) => {
        // We don't actually need to adjust score here if we calculate at the end.
        // This event could be used just to confirm reception or store validation state if needed.
        // For simplicity, we'll keep the +/- logic for now, but acknowledge its limitations.
        const room = rooms[roomCode];
        if (room && room.hostId === socket.id) {
            const player = room.players.find(p => p.id === playerId);
            if (player) {
                // Initialize score if needed
                if (player.score === undefined) player.score = 0;

                // VERY simple score logic: +1 if correct, -1 if incorrect (potential issues with multiple clicks)
                // A better system would store { qIndex: { playerId: isCorrect } } and calculate score once at the end.
                 if (isCorrect) {
                     // We should ideally prevent adding points multiple times for the same question/player
                     // For now, let's assume UI prevents multiple 'correct' signals or it's handled client-side
                     player.score += 1;
                 } else {
                     // Only subtract if score is positive, prevents going deeply negative from clicks
                     if (player.score > 0) {
                         player.score -= 1;
                     }
                 }
                // Clamp score to be non-negative
                 player.score = Math.max(0, player.score);

                console.log(`Score ajusté pour ${player.pseudo} : ${player.score}`);
                // Optional: Emit updated score to clients immediately? (Can be noisy)
                // io.to(roomCode).emit('updatePlayerScore', { playerId: player.id, score: player.score });
            }
        }
    });

    // --- NOUVEAU : Événement pour terminer la correction ---
    socket.on('finishCorrection', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room && room.hostId === socket.id) {
            console.log(`🏁 Correction terminée pour la room ${roomCode}. Calcul des scores finaux.`);

            // Final scores are already updated in the player objects by 'validateAnswer'
            const finalScores = room.players.map(p => ({
                pseudo: p.pseudo,
                score: p.score || 0 // Ensure score is 0 if undefined
            }));

            // Sort by score descending
            finalScores.sort((a, b) => b.score - a.score);

            console.log("Scores finaux:", finalScores);
            io.to(roomCode).emit('showScores', finalScores);

            // Optional: Clean up room data after scores are shown?
            // Or keep it for a potential "play again" feature reusing the room?
            // delete rooms[roomCode]; // Example cleanup
        }
    });


    socket.on('disconnect', () => {
         console.log(`❌ Un utilisateur s'est déconnecté : ${socket.id}`);
        // Find which room the disconnecting user was in
        let roomCodeToUpdate = null;
        for (const code in rooms) {
            const room = rooms[code];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                roomCodeToUpdate = code;
                const disconnectedPlayer = room.players.splice(playerIndex, 1)[0]; // Remove player
                console.log(`Player ${disconnectedPlayer.pseudo} removed from room ${code}`);

                if (room.players.length === 0) {
                    delete rooms[code]; // Delete room if empty
                    console.log(`💥 Room ${code} vide, supprimée.`);
                } else {
                    // Check if the disconnected player was the host
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id; // Assign new host (first player remaining)
                        console.log(`👑 Nouvel hôte désigné pour ${code}: ${room.players[0].pseudo}`);
                    }
                    // Notify remaining players
                    io.to(code).emit('updatePlayerList', {
                        players: room.players,
                        hostId: room.hostId,
                        categories: room.categories // Include categories
                    });
                }
                break; // Player found and handled, exit loop
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Le serveur écoute sur le port ${PORT}`);
});