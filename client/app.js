// ✅ CODE COMPLET FINAL V7 (Avec Logs + Fonctions Session Réintégrées + Robustesse)

console.log("--- app.js script START ---"); // Log initial

const SERVER_URL = "https://chbk-culture.onrender.com"; // Assurez-vous que c'est la bonne URL Render
let socket;
try {
    socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'] // Explicitly allow polling as fallback
    });
    console.log("Socket.IO initialized, attempting to connect to:", SERVER_URL);
} catch (err) {
    console.error("!!! Erreur lors de l'initialisation de Socket.IO:", err);
    alert("Erreur critique : Impossible d'initialiser la connexion temps réel. Voir la console.");
}


// --- Sélection des éléments du DOM ---
console.log("Selecting DOM elements...");
const homeScreen = document.getElementById('home-screen'); console.log("homeScreen:", homeScreen ? "Found" : "NOT FOUND!");
const lobbyScreen = document.getElementById('lobby-screen'); console.log("lobbyScreen:", lobbyScreen ? "Found" : "NOT FOUND!");
const quizScreen = document.getElementById('quiz-screen'); console.log("quizScreen:", quizScreen ? "Found" : "NOT FOUND!");
const createBtn = document.getElementById('create-btn'); console.log("createBtn:", createBtn ? "Found" : "NOT FOUND!");
const joinBtn = document.getElementById('join-btn'); console.log("joinBtn:", joinBtn ? "Found" : "NOT FOUND!");
let startGameBtn = document.getElementById('start-game-btn'); console.log("startGameBtn (initial):", startGameBtn ? "Found" : "NOT FOUND!");
const submitAnswerBtn = document.getElementById('submit-answer-btn'); console.log("submitAnswerBtn:", submitAnswerBtn ? "Found" : "NOT FOUND!");
const pseudoCreateInput = document.getElementById('pseudo-create'); console.log("pseudoCreateInput:", pseudoCreateInput ? "Found" : "NOT FOUND!");
const pseudoJoinInput = document.getElementById('pseudo-join'); console.log("pseudoJoinInput:", pseudoJoinInput ? "Found" : "NOT FOUND!");
const roomCodeInput = document.getElementById('room-code-input'); console.log("roomCodeInput:", roomCodeInput ? "Found" : "NOT FOUND!");
let roomCodeDisplay = document.getElementById('room-code-display'); console.log("roomCodeDisplay (initial):", roomCodeDisplay ? "Found" : "NOT FOUND!");
let playerList = document.getElementById('player-list'); console.log("playerList (initial):", playerList ? "Found" : "NOT FOUND!");
const timerDisplay = document.getElementById('timer'); console.log("timerDisplay:", timerDisplay ? "Found" : "NOT FOUND!");
const questionText = document.getElementById('question-text'); console.log("questionText:", questionText ? "Found" : "NOT FOUND!");
const answerInput = document.getElementById('answer-input'); console.log("answerInput:", answerInput ? "Found" : "NOT FOUND!");
let categoryCheckboxesContainer = document.getElementById('category-checkboxes'); console.log("categoryCheckboxesContainer (initial):", categoryCheckboxesContainer ? "Found" : "NOT FOUND!");
const questionImage = document.getElementById('question-image'); console.log("questionImage:", questionImage ? "Found" : "NOT FOUND!");
const confirmationMessage = document.getElementById('confirmation-message'); console.log("confirmationMessage:", confirmationMessage ? "Found" : "NOT FOUND!");
const correctionScreen = document.getElementById('correction-screen'); console.log("correctionScreen:", correctionScreen ? "Found" : "NOT FOUND!");
const correctionTitle = document.getElementById('correction-title'); console.log("correctionTitle:", correctionTitle ? "Found" : "NOT FOUND!");
const correctionQuestionText = document.getElementById('correction-question-text'); console.log("correctionQuestionText:", correctionQuestionText ? "Found" : "NOT FOUND!");
const correctionCorrectAnswer = document.getElementById('correction-correct-answer'); console.log("correctionCorrectAnswer:", correctionCorrectAnswer ? "Found" : "NOT FOUND!");
const correctionAnswersList = document.getElementById('correction-answers-list'); console.log("correctionAnswersList:", correctionAnswersList ? "Found" : "NOT FOUND!");
const prevQuestionBtn = document.getElementById('prev-question-btn'); console.log("prevQuestionBtn:", prevQuestionBtn ? "Found" : "NOT FOUND!");
const nextQuestionBtn = document.getElementById('next-question-btn'); console.log("nextQuestionBtn:", nextQuestionBtn ? "Found" : "NOT FOUND!");
const finishCorrectionBtn = document.getElementById('finish-correction-btn'); console.log("finishCorrectionBtn:", finishCorrectionBtn ? "Found" : "NOT FOUND!");
const scoreScreen = document.getElementById('score-screen'); console.log("scoreScreen:", scoreScreen ? "Found" : "NOT FOUND!");
const finalScoresList = document.getElementById('final-scores-list'); console.log("finalScoresList:", finalScoresList ? "Found" : "NOT FOUND!");
const playAgainBtn = document.getElementById('play-again-btn'); console.log("playAgainBtn:", playAgainBtn ? "Found" : "NOT FOUND!");
let hostControls = document.getElementById('host-controls'); console.log("hostControls (initial):", hostControls ? "Found" : "NOT FOUND!");
let playerView = document.getElementById('player-view'); console.log("playerView (initial):", playerView ? "Found" : "NOT FOUND!");
let categoryListPlayer = document.getElementById('category-list-player'); console.log("categoryListPlayer (initial):", categoryListPlayer ? "Found" : "NOT FOUND!");
console.log("DOM element selection finished.");

let currentRoomCode = null;
let clientTimer = null;
let currentQuestionRealIndex = 0;
let correctionData = null;
let currentCorrectionIndex = 0;
let validatedAnswers = {};
let currentHostId = null;
let isHost = false;
let allAvailableCategories = [];
let isReconnecting = false; // Flag pour gérer la reconnexion


// --- Fonctions utilitaires ---

// === FONCTIONS SESSION ===
function storeSession(pseudo, roomCode) {
    try {
        if(pseudo) sessionStorage.setItem('quizPseudo', pseudo); else sessionStorage.removeItem('quizPseudo');
        if(roomCode) sessionStorage.setItem('quizRoomCode', roomCode); else sessionStorage.removeItem('quizRoomCode');
        console.log("Session stockée:", { pseudo, roomCode });
    } catch (e) {
        console.error("Erreur sessionStorage (store):", e);
    }
}

function getSession() {
    try {
        const pseudo = sessionStorage.getItem('quizPseudo');
        const roomCode = sessionStorage.getItem('quizRoomCode');
        console.log("Session récupérée:", { pseudo, roomCode });
        return { pseudo, roomCode };
    } catch (e) {
        console.error("Erreur sessionStorage (get):", e);
        return { pseudo: null, roomCode: null };
    }
}

function clearSession() {
    try {
        sessionStorage.removeItem('quizPseudo');
        sessionStorage.removeItem('quizRoomCode');
        console.log("Session nettoyée.");
    } catch (e) {
        console.error("Erreur sessionStorage (clear):", e);
    }
}
// === FIN FONCTIONS SESSION ===

function lockAnswerUI(answer) {
    if (answerInput) answerInput.disabled = true;
    if (submitAnswerBtn) submitAnswerBtn.classList.add('hidden');
    if (confirmationMessage) {
        confirmationMessage.textContent = `Réponse enregistrée : "${answer}"`;
        confirmationMessage.classList.remove('hidden');
    }
}

function showLobby(roomData) {
    console.log("--- Entering showLobby ---");
    if (!roomData || !roomData.roomCode || !roomData.players || !roomData.hostId || !roomData.categories || !roomData.selectedCategories) {
        console.error("showLobby: Données de room incomplètes reçues", roomData);
        return;
    }

    // Définir les variables globales D'ABORD, en utilisant roomData
    currentHostId = roomData.hostId;
    currentRoomCode = roomData.roomCode; // <-- DÉFINITION FIABLE ICI
    isHost = (socket && socket.id === currentHostId);
    allAvailableCategories = roomData.categories || [];
    console.log(`[showLobby] currentRoomCode DÉFINI à: ${currentRoomCode}`); // Log de confirmation

    // Masquer les autres écrans
    if (homeScreen) homeScreen.classList.add('hidden');
    if (quizScreen) quizScreen.classList.add('hidden');
    if (correctionScreen) correctionScreen.classList.add('hidden');
    if (scoreScreen) scoreScreen.classList.add('hidden');
    if (!lobbyScreen) { console.error("lobbyScreen element not found!"); return; }
    lobbyScreen.classList.remove('hidden');

    // Reconstruire le HTML
    lobbyScreen.innerHTML = `<h2>Room Code : <span id="room-code-display"></span></h2><h3>Joueurs connectés :</h3><ul id="player-list"></ul><div id="host-controls" class="hidden"><div class="category-selection"><h3>Choisissez les catégories :</h3><div id="category-checkboxes"></div></div><button id="start-game-btn">Lancer le Quiz !</button></div><div id="player-view" class="hidden"><div class="category-selection"><h3>Catégories activées :</h3><div id="category-list-player"></div></div><p class="waiting-message">En attente du lancement par l'hôte...</p></div>`;

    // Re-sélectionner les éléments DANS le lobby reconstruit
    roomCodeDisplay = document.getElementById('room-code-display');
    playerList = document.getElementById('player-list');
    hostControls = document.getElementById('host-controls');
    playerView = document.getElementById('player-view');
    categoryCheckboxesContainer = document.getElementById('category-checkboxes');
    categoryListPlayer = document.getElementById('category-list-player');
    startGameBtn = document.getElementById('start-game-btn');

    if (!roomCodeDisplay || !playerList || !startGameBtn || !hostControls || !playerView || !categoryCheckboxesContainer || !categoryListPlayer) {
        console.error("Éléments critiques du lobby introuvables après reconstruction !"); return;
    }

    // Rattacher listener
    if (startGameBtn) startGameBtn.addEventListener('click', onStartGameClick);

    // Mettre à jour le contenu
    roomCodeDisplay.textContent = currentRoomCode; // Utiliser la variable globale qui vient d'être définie
    updatePlayerListView(roomData.players);
    populateCategoryLists(allAvailableCategories, roomData.selectedCategories);
    updateLobbyView();

    console.log("--- Exiting showLobby ---");
}

function updatePlayerListView(players) {
    console.log("[updatePlayerListView] Called with players:", players);
    if (!players) { console.error("[updatePlayerListView] No players data"); return; }
    const targetList = document.getElementById('player-list'); // Re-select inside
    console.log("[updatePlayerListView] Target list element:", targetList);
    if (!targetList) { console.error("[updatePlayerListView] playerList element NOT FOUND!"); return; }
    targetList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        const isHostPlayer = currentHostId && (player.id === currentHostId);
        li.textContent = player.pseudo + (isHostPlayer ? ' 👑' : '');
        if (isHostPlayer) li.style.fontWeight = 'bold';
        targetList.appendChild(li);
    });
    console.log("[updatePlayerListView] Finished updating list.");
}

function updateLobbyView() {
    hostControls = document.getElementById('host-controls'); // Re-select inside
    playerView = document.getElementById('player-view');   // Re-select inside
    if (!hostControls || !playerView) { console.error("hostControls or playerView not found"); return; }
    if (socket && socket.id === currentHostId) {
        hostControls.classList.remove('hidden'); playerView.classList.add('hidden');
    } else {
        hostControls.classList.add('hidden'); playerView.classList.remove('hidden');
    }
}

function startClientTimer() {
    let time = 20;
    if (timerDisplay) timerDisplay.textContent = time; else console.error("timerDisplay not found");
    clearInterval(clientTimer);
    clientTimer = setInterval(() => {
        time--;
        if (timerDisplay) timerDisplay.textContent = time;
        if (time <= 0) {
            clearInterval(clientTimer);
            if (answerInput && !answerInput.disabled) {
                const answer = answerInput.value;
                console.log(`[TimerEnd] Vérification avant émission auto: currentRoomCode = "${currentRoomCode}"`);
                if(socket && socket.connected) socket.emit('submitAnswer', { roomCode: currentRoomCode, answer: answer, questionIndex: currentQuestionRealIndex });
                else console.error("Socket not connected in timer");
                lockAnswerUI(answer);
            }
        }
    }, 1000);
}

function showWaitingScreen(messageTitle, messageText) {
    if (quizScreen) quizScreen.classList.add('hidden');
    if (homeScreen) homeScreen.classList.add('hidden');
    if (correctionScreen) correctionScreen.classList.add('hidden');
    if (scoreScreen) scoreScreen.classList.add('hidden');
    if (lobbyScreen) {
        lobbyScreen.classList.remove('hidden');
        lobbyScreen.innerHTML = `<h2>${messageTitle}</h2><p>${messageText}</p>`;
    } else console.error("lobbyScreen not found");
}

function displayCorrectionQuestion(index) {
    if (!correctionData || !correctionData.questions || !correctionData.players || index === undefined || index === null) return;
    if (!correctionTitle || !correctionQuestionText || !correctionCorrectAnswer || !correctionAnswersList || !prevQuestionBtn || !nextQuestionBtn || !finishCorrectionBtn) return;
    if (index < 0 || index >= correctionData.questions.length) index = 0;

    const question = correctionData.questions[index];
    const playerAnswers = correctionData.playerAnswers[index] || [];
    correctionTitle.textContent = `Correction Question ${index + 1}/${correctionData.questions.length}`;
    correctionQuestionText.textContent = question.question;
    correctionCorrectAnswer.textContent = question.answer;
    correctionAnswersList.innerHTML = '';

    correctionData.players.forEach(player => {
        if (!player) return;
        const answerObj = playerAnswers.find(ans => ans.playerId === player.id);
        const playerAnswer = answerObj ? answerObj.answer : "(Pas de réponse)";
        const checkboxId = `q${index}-p${player.id}`;
        const item = document.createElement('div');
        item.className = 'answer-item';
        item.id = `answer-${checkboxId}`;

        const checkboxHTML = isHost ? `<input type="checkbox" class="validation-checkbox" id="${checkboxId}" data-player-id="${player.id}">` : '';
        item.innerHTML = `<div class="answer-text"><span class="pseudo">${player.pseudo} :</span><span>${playerAnswer}</span></div>${checkboxHTML}`;

        if (validatedAnswers[checkboxId]) {
            if (isHost) { const input = item.querySelector('input'); if (input) input.checked = true; }
            item.style.backgroundColor = '#d4edda'; // Use dark theme color? #2f855a
        } else { item.style.backgroundColor = '#3b3f45'; } // Dark theme bg
        correctionAnswersList.appendChild(item);
    });

    prevQuestionBtn.disabled = !isHost || (index === 0);
    nextQuestionBtn.disabled = !isHost || (index >= correctionData.questions.length - 1);
    if (finishCorrectionBtn) finishCorrectionBtn.style.display = isHost ? 'block' : 'none';
}

function displayScores(scores) {
    if (correctionScreen) correctionScreen.classList.add('hidden');
    if (!scoreScreen) { console.error("scoreScreen not found"); return; }
    scoreScreen.classList.remove('hidden');
    if (!finalScoresList) { console.error("finalScoresList not found"); return; }
    finalScoresList.innerHTML = '';
    scores.forEach((player, index) => {
        const li = document.createElement('li');
        let medal = '';
        if (index === 0) medal = '🥇'; else if (index === 1) medal = '🥈'; else if (index === 2) medal = '🥉';
        li.innerHTML = `<span>${medal} ${player.pseudo}</span><span>${player.score} points</span>`;
        finalScoresList.appendChild(li);
    });
}

function populateCategoryLists(fullCategoryList, selectedCategoryList) {
    console.log("[populateCategoryLists] Called. Full:", fullCategoryList, "Selected:", selectedCategoryList);
    const hostContainer = document.getElementById('category-checkboxes'); // Re-select inside
    const playerContainer = document.getElementById('category-list-player'); // Re-select inside
    console.log("[populateCategoryLists] Host container:", hostContainer);
    console.log("[populateCategoryLists] Player container:", playerContainer);
    if (!hostContainer || !playerContainer) { console.error("[populateCategoryLists] Category containers missing!"); return; }
    hostContainer.innerHTML = ''; playerContainer.innerHTML = '';
    const categoriesToDisplay = Array.isArray(fullCategoryList) ? fullCategoryList : [];
    const selectedSet = new Set(Array.isArray(selectedCategoryList) ? selectedCategoryList : categoriesToDisplay);
    if (categoriesToDisplay.length === 0) console.warn("[populateCategoryLists] No categories to display.");

    categoriesToDisplay.forEach(category => {
        const isSelected = selectedSet.has(category);
        // Host checkboxes
        const itemDiv = document.createElement('div'); itemDiv.className = 'category-item';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `cat-${category}`; checkbox.name = 'category-checkbox'; checkbox.value = category; checkbox.checked = isSelected;
        const label = document.createElement('label'); label.htmlFor = `cat-${category}`; label.textContent = category;
        itemDiv.style.backgroundColor = isSelected ? '#7289da' : '#3b3f45'; // Dark theme colors
        label.style.color = isSelected ? 'white' : '#f0f8ff'; // Dark theme colors
        itemDiv.appendChild(checkbox); itemDiv.appendChild(label);
        hostContainer.appendChild(itemDiv);

        // Player list items (only show selected)
        if (isSelected) {
            const playerItem = document.createElement('div'); playerItem.className = 'category-item-player'; playerItem.textContent = category;
            playerContainer.appendChild(playerItem);
        }
    });
    console.log("[populateCategoryLists] Finished populating. Attaching listener...");
    attachCategoryClickListener(hostContainer); // Pass the specific container
    console.log("[populateCategoryLists] Finished.");
}

function attachCategoryClickListener(containerElement) {
    const targetContainer = containerElement; // Use the passed element directly
    // Ensure container exists before attaching listener
    if (!targetContainer) {
        console.error("Target container not valid when trying to attach delegate listener");
        return;
    }
    // Remove previous listener IF it was attached to THIS specific element
    if (targetContainer.dataset.listenerAttached === 'true') {
        targetContainer.removeEventListener('click', handleCategoryClick);
        targetContainer.dataset.listenerAttached = 'false';
         console.log("Removed existing listener from:", targetContainer.id); // Debug
    }
    console.log("Attaching delegate listener to:", targetContainer.id);
    targetContainer.addEventListener('click', handleCategoryClick);
    targetContainer.dataset.listenerAttached = 'true'; // Mark as attached
}

function handleCategoryClick(event) {
    const itemDiv = event.target.closest('.category-item');
    if (itemDiv) {
        const checkbox = itemDiv.querySelector('input[type="checkbox"]');
        const label = itemDiv.querySelector('label');
        if (checkbox && label) {
            // Explicitly toggle state ONLY if click wasn't directly on checkbox
            if (event.target !== checkbox) checkbox.checked = !checkbox.checked;
            // Read state after potential toggle and update style
            setTimeout(() => {
                if (checkbox.checked) { itemDiv.style.backgroundColor = '#7289da'; label.style.color = 'white'; }
                else { itemDiv.style.backgroundColor = '#3b3f45'; label.style.color = '#f0f8ff'; }
                // Emit update if host
                if (isHost && categoryCheckboxesContainer) { // Check global container exists
                    const checkedBoxes = categoryCheckboxesContainer.querySelectorAll('input[name="category-checkbox"]:checked');
                    const currentlySelected = Array.from(checkedBoxes).map(cb => cb.value);
                    if(socket) socket.emit('hostSelectedCategories', { roomCode: currentRoomCode, selectedCategories: currentlySelected });
                    else console.error("Socket not available");
                }
            }, 0);
        }
    }
}

// --- Événements des boutons ---
console.log("Attaching button event listeners...");
if (createBtn) {
    console.log(">>> createBtn found. Attaching listener...");
    createBtn.addEventListener('click', () => {
        console.log(">>> CLIC sur 'Créer une Room' DÉTECTÉ ! <<<");
        const pseudo = pseudoCreateInput ? pseudoCreateInput.value : '';
        if (pseudo) {
            console.log("Pseudo found:", pseudo, "- Emitting 'createRoom'...");
            if (socket && socket.connected) {
                 socket.emit('createRoom', { pseudo });
                 console.log("'createRoom' emitted.");
            } else {
                 console.error("ERROR: Socket not connected, cannot emit 'createRoom'.");
                 alert("Erreur: Non connecté au serveur. Veuillez rafraîchir.");
            }
        } else {
             console.log("Pseudo empty, not emitting.");
             alert("Veuillez entrer un pseudo.");
        }
    });
    console.log(">>> Listener attached to createBtn.");
} else console.error("!!! createBtn NOT FOUND !!!");

if (joinBtn) {
    joinBtn.addEventListener('click', () => {
        console.log("Join button CLICKED!");
        const pseudo = pseudoJoinInput ? pseudoJoinInput.value : '';
        const roomCode = roomCodeInput ? roomCodeInput.value.toUpperCase() : '';
        if (pseudo && roomCode) {
            console.log("Emitting joinRoom...");
            if(socket && socket.connected) {
                // Store session ici, c'est bien
                storeSession(pseudo, roomCode);
                socket.emit('joinRoom', { pseudo, roomCode });
            } else console.error("Socket not connected!");
        } else { alert("Veuillez entrer un pseudo et un code de room."); }
    });
} else console.error("joinBtn not found");

function onStartGameClick() {
    console.log("Start Game button CLICKED!");
    // Re-select container inside handler for safety after rebuild
    categoryCheckboxesContainer = document.getElementById('category-checkboxes');
    if (!categoryCheckboxesContainer) { console.error("categoryCheckboxesContainer not found in onStartGameClick"); return; }
    const checkedBoxes = categoryCheckboxesContainer.querySelectorAll('input[name="category-checkbox"]:checked');
    const selectedCategories = Array.from(checkedBoxes).map(cb => cb.value);
    if (selectedCategories.length > 0) {
        console.log("Emitting startGame...");
        if(socket && socket.connected) socket.emit('startGame', { roomCode: currentRoomCode, selectedCategories });
        else console.error("Socket not connected!");
    } else alert("Veuillez choisir au moins une catégorie !");
}
// Re-select button before attaching listener initially
startGameBtn = document.getElementById('start-game-btn');
if (startGameBtn) startGameBtn.addEventListener('click', onStartGameClick);
else console.error("startGameBtn not found initially or after lobby rebuild");

if (submitAnswerBtn) {
    submitAnswerBtn.addEventListener('click', () => {
        console.log("Submit Answer button CLICKED!");
        const answer = answerInput ? answerInput.value : '';
        console.log(`[SubmitClick] Vérification avant émission: currentRoomCode = "${currentRoomCode}"`);
        if(socket && socket.connected) socket.emit('submitAnswer', { roomCode: currentRoomCode, answer, questionIndex: currentQuestionRealIndex });
        else console.error("Socket not connected!");
        lockAnswerUI(answer);
    });
} else console.error("submitAnswerBtn not found");

if (nextQuestionBtn) {
    nextQuestionBtn.addEventListener('click', () => {
        console.log("Next Question button CLICKED!");
        if (isHost && correctionData && currentCorrectionIndex < correctionData.questions.length - 1) {
            currentCorrectionIndex++; displayCorrectionQuestion(currentCorrectionIndex);
            if(socket && socket.connected) socket.emit('hostNavigatedCorrection', { roomCode: currentRoomCode, newIndex: currentCorrectionIndex });
            else console.error("Socket not connected!");
        }
    });
} else console.error("nextQuestionBtn not found");

if (prevQuestionBtn) {
    prevQuestionBtn.addEventListener('click', () => {
        console.log("Previous Question button CLICKED!");
        if (isHost && correctionData && currentCorrectionIndex > 0) {
            currentCorrectionIndex--; displayCorrectionQuestion(currentCorrectionIndex);
            if(socket && socket.connected) socket.emit('hostNavigatedCorrection', { roomCode: currentRoomCode, newIndex: currentCorrectionIndex });
            else console.error("Socket not connected!");
        }
    });
} else console.error("prevQuestionBtn not found");

if (correctionAnswersList) {
    correctionAnswersList.addEventListener('click', (event) => {
        if (isHost && event.target.classList.contains('validation-checkbox')) {
             console.log("Validation checkbox CLICKED!");
            const checkbox = event.target; const playerId = checkbox.dataset.playerId; const isCorrect = checkbox.checked; const checkboxId = checkbox.id;
            if (isCorrect) validatedAnswers[checkboxId] = true; else delete validatedAnswers[checkboxId];
            if(socket && socket.connected) socket.emit('validateAnswer', { roomCode: currentRoomCode, playerId: playerId, isCorrect: isCorrect, questionIndex: currentCorrectionIndex });
            else console.error("Socket not connected!");
            const itemDiv = document.getElementById(`answer-${checkboxId}`);
            if(itemDiv) itemDiv.style.backgroundColor = isCorrect ? '#d4edda' : '#3b3f45'; // Dark theme bg
        }
    });
} else console.error("correctionAnswersList not found");

if (finishCorrectionBtn) {
    finishCorrectionBtn.addEventListener('click', () => {
        console.log("Finish Correction button CLICKED!");
        if(socket && socket.connected) socket.emit('finishCorrection', { roomCode: currentRoomCode });
        else console.error("Socket not connected!");
    });
} else console.error("finishCorrectionBtn not found");

if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
        console.log("Play Again button CLICKED!");
        clearSession(); // Clear session
        window.location.reload();
    });
} else console.error("playAgainBtn not found");

// Attach category delegate listener right after initial selection attempts
attachCategoryClickListener();

console.log("Button event listeners attachment finished.");


// --- Réception des événements du serveur ---
if (socket) {
    console.log("Attaching socket event listeners...");

    socket.on('connect', () => { console.log("Socket connected! ID:", socket.id); });
    socket.on('connect_error', (err) => { console.error("Socket connection error:", err.message); alert(`Connexion serveur échouée: ${err.message}`); });
    socket.on('disconnect', (reason) => { console.log("Socket disconnected:", reason); });

    // --- SESSION STORAGE & RECONNECT LOGIC ---
    setTimeout(() => {
        const session = getSession();
        if (session.pseudo && session.roomCode) {
            console.log("Session found:", session, "Attempting to rejoin...");
            isReconnecting = true;
            if (socket && socket.connected) {
                socket.emit('rejoinRoom', { pseudo: session.pseudo, roomCode: session.roomCode });
            } else { console.warn("Socket not connected yet, rejoin attempt later."); }
        } else { console.log("No previous session found."); }
    }, 500);

    socket.on('reconnect', (attemptNumber) => {
        console.log(`Socket reconnecté après ${attemptNumber} tentatives!`);
        const session = getSession();
        if (session.pseudo && session.roomCode && !isReconnecting) {
            console.log("Tentative de rejoindre la room après reconnexion:", session);
            isReconnecting = true;
            if(socket) socket.emit('rejoinRoom', { pseudo: session.pseudo, roomCode: session.roomCode });
        }
    });
    // --- END SESSION/RECONNECT ---

    socket.on('roomCreated', (roomData) => {
        console.log('Room créée !', roomData);
        if (!roomData) return;
        currentHostId = roomData.hostId;
        isHost = (socket && socket.id === currentHostId);
        allAvailableCategories = roomData.categories || [];
        const hostPseudo = roomData.players.find(p => p.id === socket.id)?.pseudo;
        if(hostPseudo) storeSession(hostPseudo, roomData.roomCode); // Store session
        showLobby(roomData);
        // Listener attached inside populateCategoryLists -> attachCategoryClickListener
    });

    socket.on('updatePlayerList', (data) => {
    console.log('[updatePlayerList] Reçu:', data);
    if (!data || !data.players || !data.hostId || !data.categories || !data.selectedCategories) {
        console.error("[updatePlayerList] Données invalides", data);
        return;
    }

    // Si l'écran d'accueil est visible, c'est un joueur qui rejoint.
    // showLobby va gérer la définition de currentRoomCode et l'affichage.
    if (homeScreen && !homeScreen.classList.contains('hidden')) {
        console.log("[updatePlayerList] Joueur rejoint détecté, appel de showLobby...");
        showLobby(data); // showLobby utilise data.roomCode
    } else if (lobbyScreen && !lobbyScreen.classList.contains('hidden') && !isReconnecting) {
        // Si le lobby est déjà visible (ex: un autre joueur rejoint/part), mettre à jour
        console.log("[updatePlayerList] Lobby déjà visible, mise à jour simple.");
        currentHostId = data.hostId; // Mettre à jour l'hôte global
        isHost = (socket && socket.id === currentHostId);
        allAvailableCategories = data.categories || []; // Mettre à jour les catégories globales

        // Mettre à jour les éléments directement (ils devraient exister)
        updatePlayerListView(data.players);
        populateCategoryLists(allAvailableCategories, data.selectedCategories);
        updateLobbyView();
    }
    isReconnecting = false; // Reset flag
    console.log("[updatePlayerList] Terminé.");
});

    socket.on('updateSelectedCategories', (selectedCategories) => {
        console.log("Server updated selected categories:", selectedCategories);
        if (!Array.isArray(selectedCategories)) { console.error("Invalid selectedCategories"); selectedCategories = []; }
        // Re-select containers for safety
        categoryCheckboxesContainer = document.getElementById('category-checkboxes');
        categoryListPlayer = document.getElementById('category-list-player');
        populateCategoryLists(allAvailableCategories, selectedCategories);
        updateLobbyView();
    });

    socket.on('newQuestion', ({ question, questionIndex, totalQuestions }) => {
         if (!lobbyScreen || !quizScreen || !questionImage || !questionText || !answerInput || !submitAnswerBtn || !confirmationMessage) { console.error("Missing elements"); return; }
         lobbyScreen.classList.add('hidden'); quizScreen.classList.remove('hidden');
         if (question && question.image) { questionImage.src = question.image; questionImage.classList.remove('hidden'); }
         else { if(questionImage) { questionImage.src = ''; questionImage.classList.add('hidden'); } }
         currentQuestionRealIndex = questionIndex - 1;
         if(questionText && question) questionText.textContent = `Question ${questionIndex}/${totalQuestions}: ${question.question}`;
         if(answerInput) answerInput.value = ''; if(answerInput) answerInput.disabled = false; if(submitAnswerBtn) submitAnswerBtn.classList.remove('hidden'); if(confirmationMessage) confirmationMessage.classList.add('hidden');
         if(answerInput) answerInput.focus(); startClientTimer();
    });

    socket.on('startCorrection', (data) => {
         console.log("Données de correction reçues :", data);
         if(!data || !data.questions || !data.players || !data.hostId) { console.error("Invalid data"); return; }
         correctionData = data; currentCorrectionIndex = 0; validatedAnswers = {};
         currentHostId = data.hostId;
         isHost = (socket && socket.id === currentHostId);
         if (!quizScreen || !correctionScreen) { console.error("Missing elements"); return; }
         quizScreen.classList.add('hidden'); correctionScreen.classList.remove('hidden');
         displayCorrectionQuestion(currentCorrectionIndex);
    });

    socket.on('showScores', (scores) => {
        console.log("Scores finaux reçus :", scores);
        if (scores && Array.isArray(scores)) { displayScores(scores); }
        else { console.error("Invalid scores data received:", scores); }
    });

    socket.on('answerValidated', ({ questionIndex, playerId, isCorrect }) => {
        const checkboxId = `q${questionIndex}-p${playerId}`;
        if (isCorrect) validatedAnswers[checkboxId] = true; else delete validatedAnswers[checkboxId];
        if (questionIndex === currentCorrectionIndex) {
            const itemDiv = document.getElementById(`answer-${checkboxId}`);
            if(itemDiv) itemDiv.style.backgroundColor = isCorrect ? '#d4edda' : '#3b3f45'; // Dark theme bg
            if (isHost) {
                 const checkbox = itemDiv ? itemDiv.querySelector(`#${checkboxId}`) : null;
                 if (checkbox) checkbox.checked = isCorrect;
             }
        }
    });

    socket.on('updateCorrectionView', ({ newIndex }) => {
         if (!isHost) {
             console.log(`Host navigated to question ${newIndex}`);
             currentCorrectionIndex = newIndex;
             displayCorrectionQuestion(currentCorrectionIndex);
         }
    });

    socket.on('rejoinSuccess', (roomState) => {
         console.log("Reconnexion réussie:", roomState);
         isReconnecting = false;
         currentHostId = roomState.hostId;
         isHost = (socket && socket.id === currentHostId);
         currentRoomCode = roomState.roomCode;
         allAvailableCategories = roomState.categories || [];

         if (roomState.status === 'lobby') {
             showLobby(roomState);
             // populate called inside showLobby
         } else if (roomState.status === 'quiz') {
             console.warn("Reconnexion pendant quiz - affichage attente.");
             showWaitingScreen("Reconnexion...", "Reprise du quiz...");
         } else if (roomState.status === 'correction') {
              console.log("Reconnexion pendant correction.");
              correctionData = roomState.correctionData;
              currentCorrectionIndex = roomState.currentCorrectionIndex || 0;
              validatedAnswers = roomState.validatedAnswers || {};
              if(quizScreen) quizScreen.classList.add('hidden');
              if(correctionScreen) correctionScreen.classList.remove('hidden');
              displayCorrectionQuestion(currentCorrectionIndex);
         } else if (roomState.status === 'scores') {
              console.log("Reconnexion après scores.");
              displayScores(roomState.scores);
         }
     });

     socket.on('rejoinFailed', (message) => {
         console.error("Échec reconnexion:", message);
         isReconnecting = false;
         clearSession();
         alert("Impossible de rejoindre la partie. Retour à l'accueil.");
         window.location.reload();
     });

    socket.on('error', (message) => { alert(`Erreur Serveur: ${message}`); });

    console.log("Socket event listeners attached.");
} else {
    console.error("Socket object not initialized, cannot attach listeners.");
}

console.log("--- app.js script END ---");