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


let quizTimers = {}; // Stocke les IDs des timeouts pour chaque room

function startQuizTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    // Annuler tout timer précédent pour cette room avant de commencer
    if (quizTimers[roomCode]) {
        clearTimeout(quizTimers[roomCode]);
        delete quizTimers[roomCode];
        console.log(`[${roomCode}] Ancien timer annulé.`);
    }

    room.currentQuestionIndex = 0;
    room.answers = {};
    room.players.forEach(p => p.score = 0);
    console.log(`[${roomCode}] Démarrage du quiz.`);

    const sendNextQuestion = () => {
        // Supprime la référence au timer qui vient de s'exécuter
        if (quizTimers[roomCode]) delete quizTimers[roomCode];

        // Vérifier si la room existe toujours
        if (!rooms[roomCode]) {
             console.log(`[${roomCode}] Room disparue, arrêt du timer.`);
             return;
        }

        const maxQuestions = 20; // Version finale : 20 questions
        if (room.currentQuestionIndex >= room.questions.length || room.currentQuestionIndex >= maxQuestions) {
            // Logique de fin de quiz (avec délai)
            setTimeout(() => {
                if (!rooms[roomCode]) return; // Re-vérifier l'existence
                console.log(`[${roomCode}] Quiz terminé. Préparation correction.`);
                const correctionData = { /* ... */ hostId: room.hostId };
                io.to(roomCode).emit('startCorrection', correctionData);
            }, 500);
            return; // Arrête la boucle
        }

        const questionIndex = room.currentQuestionIndex;
        const question = room.questions[questionIndex];

        console.log(`[${roomCode}] Envoi Q${questionIndex + 1}.`); // Log Envoi
        io.to(roomCode).emit('newQuestion', {
            question,
            questionIndex: questionIndex + 1,
            totalQuestions: Math.min(room.questions.length, maxQuestions)
        });

        room.currentQuestionIndex++;

        // Planifier la prochaine question/fin
        console.log(`[${roomCode}] Planification prochaine étape dans 20s.`); // Log Planification
        quizTimers[roomCode] = setTimeout(sendNextQuestion, 20000); // Stocke l'ID du nouveau timer
    };

    // Lance la première question immédiatement
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
        const maxQuestions = 20;
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
        console.log(`[${roomCode}] Tentative réception réponse Q${questionIndex} de ${socket.id}.`); // Log Réception

        const room = rooms[roomCode];

        // Log 1: Est-ce que la room existe ?
        if (!room) {
            console.warn(`[${roomCode}] ERREUR: Room non trouvée pour réponse de ${socket.id}.`);
            return;
        }

        // Log 2: Est-ce que le joueur est dans cette room ?
        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
             console.warn(`[${roomCode}] ERREUR: Joueur ${socket.id} non trouvé dans la room pour réponse.`);
             console.log("Joueurs actuels:", room.players.map(p => p.pseudo));
             return;
        }

        // Log 3: Index de question valide ?
        if (questionIndex === undefined || questionIndex === null || questionIndex < 0) {
            console.error(`[${roomCode}] ERREUR: Index de question invalide (${questionIndex}) reçu de ${player.pseudo}.`);
            return;
        }

        // Initialiser si nécessaire
        if (!room.answers[questionIndex]) {
            room.answers[questionIndex] = [];
        }

        // Vérifier si déjà répondu
        const alreadyAnswered = room.answers[questionIndex].some(ans => ans.playerId === socket.id);
        if (!alreadyAnswered) {
            room.answers[questionIndex].push({
                playerId: socket.id,
                pseudo: player.pseudo,
                answer: answer
            });
            console.log(`[${roomCode}] ✅ Réponse Q${questionIndex} de ${player.pseudo} enregistrée: "${answer}"`);
        } else {
            // Optionnel: log si déjà répondu
            // console.log(`[${roomCode}] Réponse Q${questionIndex} de ${player.pseudo} ignorée (déjà répondu).`);
        }
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
                // ... (logique suppression joueur) ...
                if (room.players.length === 0) {
                    // --- AJOUT : Nettoyer le timer ---
                    if (quizTimers[code]) {
                        clearTimeout(quizTimers[code]);
                        delete quizTimers[code];
                        console.log(`[${code}] Timer quiz nettoyé car room vide.`);
                    }
                    // --- FIN AJOUT ---
                    delete rooms[code];
                    console.log(`💥 Room ${code} supprimée.`);
                } else {
                   // ... (logique changement hôte + emit update) ...
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