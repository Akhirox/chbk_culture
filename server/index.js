// ✅ CODE COMPLET FINAL V2 POUR server/index.js (Incluant TOUTES les features)

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
        const auth = new google.auth.GoogleAuth({ keyFile: credentialsPath, scopes: 'https://www.googleapis.com/auth/spreadsheets' });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        const metaData = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
        // Filter out sheets starting with '_' (convention for hidden/utility sheets)
        const titles = metaData.data.sheets
                         .map(sheet => sheet.properties.title)
                         .filter(title => !title.startsWith('_'));
        return titles;
    } catch (err) { console.error("Erreur API (getSheetNames):", err); return []; }
}

// --- Fonction pour récupérer les questions (ignore header row) ---
async function fetchQuestions(categories) {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: credentialsPath, scopes: 'https://www.googleapis.com/auth/spreadsheets' });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        const promises = categories.map(category => sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID, range: `${category}!A:C` }));
        const responses = await Promise.all(promises);
        const allQuestions = responses.flatMap(response => {
            const rows = response.data.values;
            if (rows && rows.length > 1) return rows.slice(1).map(row => ({ question: row[0], answer: row[1], image: row[2] || null })).filter(q => q.question && q.answer);
            return [];
        });
        return allQuestions;
    } catch (err) { console.error('Erreur API (fetchQuestions):', err); return []; }
}


function startQuizTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    room.currentQuestionIndex = 0;
    room.answers = {};
    room.players.forEach(p => p.score = 0); // Reset scores

    const sendNextQuestion = () => {
        const maxQuestions = 3; // Keep low for testing
        if (room.currentQuestionIndex >= room.questions.length || room.currentQuestionIndex >= maxQuestions) {
            setTimeout(() => {
                // Check if room still exists before proceeding
                if (!rooms[roomCode]) { console.log(`Room ${roomCode} disparue avant correction.`); return; }
                console.log(`🏁 Quiz terminé pour ${roomCode}. Envoi data correction.`);
                const correctionData = {
                    questions: room.questions.slice(0, maxQuestions),
                    playerAnswers: room.answers,
                    players: room.players, // Scores will be updated by host clicks
                    hostId: room.hostId // **NOUVEAU**: Include hostId here too!
                };
                // --- CORRECTIF : Send correction data to EVERYONE ---
                io.to(roomCode).emit('startCorrection', correctionData);
                console.log(`Données de correction envoyées à la room ${roomCode}`);
                // --- FIN CORRECTIF ---
                 // REMOVED sending 'waitingForCorrection' separately
            }, 500); // Delay for last answers
            return;
        }

        const questionIndex = room.currentQuestionIndex;
        const question = room.questions[questionIndex];
        io.to(roomCode).emit('newQuestion', {
            question, questionIndex: questionIndex + 1, totalQuestions: Math.min(room.questions.length, maxQuestions)
        });
        room.currentQuestionIndex++;
        setTimeout(sendNextQuestion, 20000); // Use 20s timer
    };
    sendNextQuestion();
}

function generateRoomCode() {
    let code = ''; const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return rooms[code] ? generateRoomCode() : code;
}

io.on('connection', (socket) => {
    console.log(`✅ Connexion : ${socket.id}`);

    socket.on('createRoom', async ({ pseudo }) => {
        const roomCode = generateRoomCode();
        socket.join(roomCode);
        const categories = await getSheetNames();
        const initialSelected = [...categories]; // All selected by default
        rooms[roomCode] = {
            hostId: socket.id,
            players: [{ id: socket.id, pseudo: pseudo, score: 0 }],
            questions: [], answers: {}, categories: categories,
            selectedCategories: initialSelected // **NOUVEAU**: Store selected
        };
        socket.emit('roomCreated', {
            roomCode, players: rooms[roomCode].players, categories, hostId: rooms[roomCode].hostId,
            selectedCategories: initialSelected // **NOUVEAU**: Send selected
        });
        console.log(`🚪 Room ${roomCode} créée. Catégories: ${categories.length}`);
        if (!categories || categories.length === 0) { /* ... error handling ... */
             console.error("⚠️ AVERTISSEMENT: Aucune catégorie trouvée.");
             socket.emit('error', "Impossible de charger les catégories.");
        }
    });

   socket.on('joinRoom', ({ pseudo, roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            socket.join(roomCode);
            const newPlayer = { id: socket.id, pseudo: pseudo, score: 0 };
            room.players.push(newPlayer);
            io.to(roomCode).emit('updatePlayerList', {
                players: room.players, hostId: room.hostId, categories: room.categories,
                selectedCategories: room.selectedCategories // **NOUVEAU**: Send selected
            });
            console.log(`👋 ${pseudo} a rejoint ${roomCode}`);
        } else { socket.emit('error', 'Room inexistante.'); }
    });

   // --- **AJOUTÉ :** Host changes category selection ---
    socket.on('hostSelectedCategories', ({ roomCode, selectedCategories }) => {
        const room = rooms[roomCode];
        // Validate it's the host and data is array
        if (room && room.hostId === socket.id && Array.isArray(selectedCategories)) {
             room.selectedCategories = selectedCategories;
             socket.to(roomCode).emit('updateSelectedCategories', selectedCategories); // Broadcast to others
             console.log(`Room ${roomCode} sélection catégories maj:`, selectedCategories.length);
        }
    });


    socket.on('startGame', async ({ roomCode, selectedCategories }) => {
        const room = rooms[roomCode];
        const maxQuestions = 3;
        if (room && room.hostId === socket.id) {
             if (!Array.isArray(selectedCategories) || selectedCategories.length === 0) { socket.emit('error', 'Aucune catégorie sélectionnée.'); return; }
            console.log(`▶️ Lancement quiz ${roomCode} cats: ${selectedCategories.join(', ')}`);
            const questions = await fetchQuestions(selectedCategories);
            if (questions.length > 0) {
                room.questions = questions.sort(() => 0.5 - Math.random()).slice(0, maxQuestions);
                console.log(`${questions.length} questions trouvées, ${room.questions.length} chargées.`);
                startQuizTimer(roomCode);
            } else { socket.emit('error', 'Impossible de charger les questions.'); }
        }
     });

    socket.on('submitAnswer', ({ roomCode, answer, questionIndex }) => {
        const room = rooms[roomCode];
        if (room && room.players.some(p => p.id === socket.id)) {
            if (questionIndex === undefined || questionIndex === null || questionIndex < 0) { console.error(`Index invalide reçu de ${socket.id}`); return; }
            if (!room.answers[questionIndex]) room.answers[questionIndex] = [];
            const alreadyAnswered = room.answers[questionIndex].some(ans => ans.playerId === socket.id);
            if (!alreadyAnswered) {
                 const player = room.players.find(p => p.id === socket.id);
                room.answers[questionIndex].push({ playerId: socket.id, pseudo: player ? player.pseudo : 'Inconnu', answer: answer });
                console.log(`📝 Réponse Q${questionIndex} de ${player ? player.pseudo : socket.id}: "${answer}"`);
            }
        } else console.warn(`Réponse reçue de ${socket.id} pour room ${roomCode} invalide.`);
     });

    socket.on('validateAnswer', ({ roomCode, playerId, isCorrect, questionIndex }) => { // Include questionIndex
        const room = rooms[roomCode];
        if (room && room.hostId === socket.id) {
            const player = room.players.find(p => p.id === playerId);
            if (player) {
                if (player.score === undefined) player.score = 0;
                // Simple +/- logic (Consider revision later)
                if (isCorrect) player.score += 1;
                else if (player.score > 0) player.score -= 1;
                player.score = Math.max(0, player.score);
                console.log(`Score ajusté pour ${player.pseudo} : ${player.score}`);

                // --- **AJOUTÉ :** Broadcast validation ---
                io.to(roomCode).emit('answerValidated', {
                    questionIndex: questionIndex,
                    playerId: playerId,
                    isCorrect: isCorrect
                });
                // --- FIN AJOUT ---
            }
        }
    });

     // --- **AJOUTÉ :** Host navigates correction ---
     socket.on('hostNavigatedCorrection', ({ roomCode, newIndex }) => {
        const room = rooms[roomCode];
        if (room && room.hostId === socket.id && newIndex >= 0 ) {
             // Basic check: ensure newIndex is within bounds of questions asked
             const maxQuestions = 3; // Use the same limit as startQuizTimer
             const actualQuestionsCount = Math.min(room.questions.length, maxQuestions);
             if (newIndex < actualQuestionsCount) {
                 socket.to(roomCode).emit('updateCorrectionView', { newIndex }); // Broadcast to others
                 console.log(`Hôte navigue vers Q${newIndex} dans ${roomCode}`);
             } else {
                 console.warn(`Host tried to navigate to invalid index ${newIndex} in ${roomCode}`);
             }
        }
    });

    socket.on('finishCorrection', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room && room.hostId === socket.id) {
            console.log(`🏁 Correction terminée ${roomCode}. Scores finaux.`);
            const finalScores = room.players.map(p => ({ pseudo: p.pseudo, score: p.score || 0 }));
            finalScores.sort((a, b) => b.score - a.score);
            console.log("Scores:", finalScores);
            io.to(roomCode).emit('showScores', finalScores);
            // Consider deleting room? delete rooms[roomCode];
        }
     });

    socket.on('disconnect', () => {
         console.log(`❌ Déconnexion : ${socket.id}`);
        for (const code in rooms) {
            const room = rooms[code];
            if (!room || !room.players) continue;
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const disconnectedPlayer = room.players.splice(playerIndex, 1)[0];
                console.log(`${disconnectedPlayer.pseudo} retiré de ${code}`);
                if (room.players.length === 0) {
                    delete rooms[code]; console.log(`💥 Room ${code} supprimée.`);
                } else {
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        console.log(`👑 Nouvel hôte ${room.players[0].pseudo} pour ${code}`);
                    }
                    io.to(code).emit('updatePlayerList', {
                        players: room.players, hostId: room.hostId, categories: room.categories,
                        selectedCategories: room.selectedCategories // **AJOUTÉ :** Send selected
                    });
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Le serveur écoute sur le port ${PORT}`);
});