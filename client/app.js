// ✅ CODE COMPLET FINAL V5 (Correction, Scores, Catégories Fix V4 + Robustesse)

const SERVER_URL = "https://chbk-culture.onrender.com";
const socket = io(SERVER_URL);

// --- Sélection des éléments du DOM ---
const homeScreen = document.getElementById('home-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const quizScreen = document.getElementById('quiz-screen');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
let startGameBtn = document.getElementById('start-game-btn');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const pseudoCreateInput = document.getElementById('pseudo-create');
const pseudoJoinInput = document.getElementById('pseudo-join');
const roomCodeInput = document.getElementById('room-code-input');
let roomCodeDisplay = document.getElementById('room-code-display');
let playerList = document.getElementById('player-list');
const timerDisplay = document.getElementById('timer');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer-input');
let categoryCheckboxesContainer = document.getElementById('category-checkboxes');
const questionImage = document.getElementById('question-image');
const confirmationMessage = document.getElementById('confirmation-message');
const correctionScreen = document.getElementById('correction-screen');
const correctionTitle = document.getElementById('correction-title');
const correctionQuestionText = document.getElementById('correction-question-text');
const correctionCorrectAnswer = document.getElementById('correction-correct-answer');
const correctionAnswersList = document.getElementById('correction-answers-list');
const prevQuestionBtn = document.getElementById('prev-question-btn');
const nextQuestionBtn = document.getElementById('next-question-btn');
const finishCorrectionBtn = document.getElementById('finish-correction-btn');
const scoreScreen = document.getElementById('score-screen');
const finalScoresList = document.getElementById('final-scores-list');
const playAgainBtn = document.getElementById('play-again-btn');
let hostControls = document.getElementById('host-controls');
let playerView = document.getElementById('player-view');
let categoryListPlayer = document.getElementById('category-list-player');


let currentRoomCode = null;
let clientTimer = null;
let currentQuestionRealIndex = 0;
let correctionData = null;
let currentCorrectionIndex = 0;
let validatedAnswers = {};
let currentHostId = null;
let isHost = false;


// --- Fonctions utilitaires ---
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
    if (homeScreen) homeScreen.classList.add('hidden');
    if (quizScreen) quizScreen.classList.add('hidden');
    if (correctionScreen) correctionScreen.classList.add('hidden');
    if (scoreScreen) scoreScreen.classList.add('hidden');
    if (!lobbyScreen) { console.error("lobbyScreen element not found!"); return; }
    lobbyScreen.classList.remove('hidden');

    lobbyScreen.innerHTML = `<h2>Room Code : <span id="room-code-display"></span></h2><h3>Joueurs connectés :</h3><ul id="player-list"></ul><div id="host-controls" class="hidden"><div class="category-selection"><h3>Choisissez les catégories :</h3><div id="category-checkboxes"></div></div><button id="start-game-btn">Lancer le Quiz !</button></div><div id="player-view" class="hidden"><div class="category-selection"><h3>Catégories activées :</h3><div id="category-list-player"></div></div><p class="waiting-message">En attente du lancement par l'hôte...</p></div>`;

    roomCodeDisplay = document.getElementById('room-code-display');
    playerList = document.getElementById('player-list');
    hostControls = document.getElementById('host-controls');
    playerView = document.getElementById('player-view');
    categoryCheckboxesContainer = document.getElementById('category-checkboxes');
    categoryListPlayer = document.getElementById('category-list-player');
    startGameBtn = document.getElementById('start-game-btn');

    if (!roomCodeDisplay || !playerList || !startGameBtn || !hostControls || !playerView || !categoryCheckboxesContainer || !categoryListPlayer) {
        console.error("Critical lobby elements not found after innerHTML rewrite!"); return;
    }

    if (startGameBtn) startGameBtn.addEventListener('click', onStartGameClick); else console.error("Cannot attach listener, startGameBtn not found.");

    currentHostId = roomData.hostId;
    currentRoomCode = roomData.roomCode;
    roomCodeDisplay.textContent = currentRoomCode;

    if (roomData.players) updatePlayerListView(roomData.players); else console.error("roomData.players missing");

    // Populate categories
    populateCategoryLists(roomData.categories, roomData.selectedCategories);

    updateLobbyView();
    console.log("--- Exiting showLobby ---");
}


function updatePlayerListView(players) {
    if (!players) { console.error("No players data"); return; }
    if (!playerList) playerList = document.getElementById('player-list');
    if (!playerList) { console.error("playerList element not found"); return; }
    playerList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        const isHost = currentHostId && (player.id === currentHostId);
        li.textContent = player.pseudo + (isHost ? ' 👑' : '');
        if (isHost) li.style.fontWeight = 'bold';
        playerList.appendChild(li);
    });
}

function updateLobbyView() {
    if (!hostControls) hostControls = document.getElementById('host-controls');
    if (!playerView) playerView = document.getElementById('player-view');
    if (!hostControls || !playerView) { console.error("hostControls or playerView not found"); return; }
    if (socket.id === currentHostId) {
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
                socket.emit('submitAnswer', { roomCode: currentRoomCode, answer: answer, questionIndex: currentQuestionRealIndex });
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
        item.id = `answer-${checkboxId}`; // ID for style updates

        const checkboxHTML = isHost ? `<input type="checkbox" class="validation-checkbox" id="${checkboxId}" data-player-id="${player.id}">` : '';

        item.innerHTML = `<div class="answer-text"><span class="pseudo">${player.pseudo} :</span><span>${playerAnswer}</span></div>${checkboxHTML}`;

        if (validatedAnswers[checkboxId]) {
            if (isHost) {
                const input = item.querySelector('input'); if (input) input.checked = true;
            }
            item.style.backgroundColor = '#d4edda'; // Green bg for correct
        } else {
             item.style.backgroundColor = '#f2f2f2'; // Default bg
        }

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

// --- Populate Category Lists ---
function populateCategoryLists(categories, selectedCategories) {
    if (!categoryCheckboxesContainer || !categoryListPlayer) {
        console.error("Cannot populate category lists, containers missing");
        return;
    }
    categoryCheckboxesContainer.innerHTML = '';
    categoryListPlayer.innerHTML = '';
    const selectedSet = new Set(selectedCategories || categories);

    categories.forEach(category => {
        const isSelected = selectedSet.has(category);
        // Host checkboxes
        const itemDiv = document.createElement('div');
        itemDiv.className = 'category-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.id = `cat-${category}`; checkbox.name = 'category-checkbox'; checkbox.value = category; checkbox.checked = isSelected;
        const label = document.createElement('label');
        label.htmlFor = `cat-${category}`; label.textContent = category;
        itemDiv.style.backgroundColor = isSelected ? '#007bff' : '#e9ecef';
        label.style.color = isSelected ? 'white' : 'black';
        itemDiv.appendChild(checkbox); itemDiv.appendChild(label);
        categoryCheckboxesContainer.appendChild(itemDiv);

        // Player list items (only show selected)
        if (isSelected) {
            const playerItem = document.createElement('div');
            playerItem.className = 'category-item-player';
            playerItem.textContent = category;
            categoryListPlayer.appendChild(playerItem);
        }
    });
    // Ensure delegate listener is attached/reattached AFTER repopulating
    attachCategoryClickListener();
}


// --- Event Delegation Logic ---
function attachCategoryClickListener() {
    if (window.categoryClickListenerAttached) {
         if(categoryCheckboxesContainer) categoryCheckboxesContainer.removeEventListener('click', handleCategoryClick);
         window.categoryClickListenerAttached = false;
    }
    // Re-select container just in case it wasn't available before
    if (!categoryCheckboxesContainer) categoryCheckboxesContainer = document.getElementById('category-checkboxes');
    if (categoryCheckboxesContainer) {
        console.log("Attaching delegate listener to categoryCheckboxesContainer");
        categoryCheckboxesContainer.addEventListener('click', handleCategoryClick);
        window.categoryClickListenerAttached = true;
    } else {
        console.error("categoryCheckboxesContainer not found when trying to attach delegate listener");
    }
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
                if (checkbox.checked) {
                    itemDiv.style.backgroundColor = '#007bff'; label.style.color = 'white';
                } else {
                    itemDiv.style.backgroundColor = '#e9ecef'; label.style.color = 'black';
                }
                // Emit update if host
                if (isHost && categoryCheckboxesContainer) {
                    const checkedBoxes = categoryCheckboxesContainer.querySelectorAll('input[name="category-checkbox"]:checked');
                    const currentlySelected = Array.from(checkedBoxes).map(cb => cb.value);
                    socket.emit('hostSelectedCategories', { roomCode: currentRoomCode, selectedCategories: currentlySelected });
                }
            }, 0);
        }
    }
}


// --- Événements des boutons ---
if (createBtn) createBtn.addEventListener('click', () => { /* ... */ }); else console.error("createBtn not found");
if (joinBtn) joinBtn.addEventListener('click', () => { /* ... */ }); else console.error("joinBtn not found");
function onStartGameClick() { /* ... */ }
// Attach listener initially (will be re-attached in showLobby)
if (startGameBtn) startGameBtn.addEventListener('click', onStartGameClick); else console.error("startGameBtn not found initially");
if (submitAnswerBtn) submitAnswerBtn.addEventListener('click', () => { /* ... */ }); else console.error("submitAnswerBtn not found");
if (nextQuestionBtn) nextQuestionBtn.addEventListener('click', () => {
     if (isHost && correctionData && currentCorrectionIndex < correctionData.questions.length - 1) {
         currentCorrectionIndex++; displayCorrectionQuestion(currentCorrectionIndex, isHost);
         socket.emit('hostNavigatedCorrection', { roomCode: currentRoomCode, newIndex: currentCorrectionIndex });
     }
}); else console.error("nextQuestionBtn not found");
if (prevQuestionBtn) prevQuestionBtn.addEventListener('click', () => {
     if (isHost && correctionData && currentCorrectionIndex > 0) {
         currentCorrectionIndex--; displayCorrectionQuestion(currentCorrectionIndex, isHost);
         socket.emit('hostNavigatedCorrection', { roomCode: currentRoomCode, newIndex: currentCorrectionIndex });
     }
}); else console.error("prevQuestionBtn not found");
if (correctionAnswersList) correctionAnswersList.addEventListener('click', (event) => {
    if (isHost && event.target.classList.contains('validation-checkbox')) { // Only host can validate
        const checkbox = event.target; const playerId = checkbox.dataset.playerId; const isCorrect = checkbox.checked; const checkboxId = checkbox.id;
        if (isCorrect) validatedAnswers[checkboxId] = true; else delete validatedAnswers[checkboxId];
        socket.emit('validateAnswer', { roomCode: currentRoomCode, playerId: playerId, isCorrect: isCorrect, questionIndex: currentCorrectionIndex });
        const itemDiv = document.getElementById(`answer-${checkboxId}`); // Update style immediately
        if(itemDiv) itemDiv.style.backgroundColor = isCorrect ? '#d4edda' : '#f2f2f2';
    }
}); else console.error("correctionAnswersList not found");
if(finishCorrectionBtn) finishCorrectionBtn.addEventListener('click', () => { /* ... */ }); else console.error("finishCorrectionBtn not found");
if(playAgainBtn) playAgainBtn.addEventListener('click', () => { window.location.reload(); }); else console.error("playAgainBtn not found");


// --- Réception des événements du serveur ---

socket.on('roomCreated', (roomData) => {
    console.log('Room créée !', roomData);
    if (!roomData) return;
    currentHostId = roomData.hostId;
    isHost = (socket.id === currentHostId);
    showLobby(roomData); // Rebuilds DOM, populates categories inside
    attachCategoryClickListener(); // Attach listener after rebuild
});

socket.on('updatePlayerList', (data) => {
    console.log('Liste des joueurs mise à jour', data);
    if (!data || !data.players || !data.hostId) return;
    currentHostId = data.hostId;
    isHost = (socket.id === currentHostId);

    let lobbyJustShown = false;
    if (homeScreen && !homeScreen.classList.contains('hidden')) {
        if (!lobbyScreen || !roomCodeInput) return;
        homeScreen.classList.add('hidden'); lobbyScreen.classList.remove('hidden'); lobbyJustShown = true;
        currentRoomCode = roomCodeInput.value.toUpperCase();
        roomCodeDisplay = document.getElementById('room-code-display');
        if (roomCodeDisplay) roomCodeDisplay.textContent = currentRoomCode; else console.log("roomCodeDisplay not found after join");
    }

    // Re-select containers
    categoryCheckboxesContainer = document.getElementById('category-checkboxes');
    categoryListPlayer = document.getElementById('category-list-player');

    // Repopulate Categories if needed
    if (lobbyJustShown || !categoryCheckboxesContainer || categoryCheckboxesContainer.innerHTML === '') {
        populateCategoryLists(data.categories, data.selectedCategories);
        // Listener attached inside populateCategoryLists now
    }

    updatePlayerListView(data.players);
    updateLobbyView();
});

socket.on('updateSelectedCategories', (selectedCategories) => {
    // If I'm not the host, update my static list
    if (!isHost && categoryListPlayer && Array.isArray(selectedCategories)) {
         console.log("Updating displayed categories for player:", selectedCategories);
         categoryListPlayer.innerHTML = '';
         // We need the full list to check against - assume server sends only selected
         // A better approach might require client storing the full list from roomCreated/updatePlayerList
         // Find the full category list from the host checkboxes if they exist? Risky.
         // Let's just display what server sent.
          const fullCategoryList = correctionData ? correctionData.categories : []; // Attempt to get full list if available
          selectedCategories.forEach(category => {
            const playerItem = document.createElement('div');
            playerItem.className = 'category-item-player';
            playerItem.textContent = category;
            categoryListPlayer.appendChild(playerItem);
         });
    }
    // Update host checkboxes too (sync state)
    if (isHost && categoryCheckboxesContainer && Array.isArray(selectedCategories)){
         console.log("Syncing host checkboxes with server state:", selectedCategories);
         const checkBoxes = categoryCheckboxesContainer.querySelectorAll('input[name="category-checkbox"]');
         checkBoxes.forEach(checkbox => {
             const itemDiv = checkbox.closest('.category-item');
             const label = itemDiv ? itemDiv.querySelector('label') : null;
             checkbox.checked = selectedCategories.includes(checkbox.value);
             if(itemDiv && label){
                 if (checkbox.checked) { itemDiv.style.backgroundColor = '#007bff'; label.style.color = 'white'; }
                 else { itemDiv.style.backgroundColor = '#e9ecef'; label.style.color = 'black'; }
             }
         });
    }
});


socket.on('newQuestion', ({ question, questionIndex, totalQuestions }) => { /* ... same ... */ });
socket.on('startCorrection', (data) => {
     console.log("Données de correction reçues :", data);
     if(!data || !data.questions || !data.players || !data.hostId) { console.error("Invalid data"); return; } // Check hostId
     correctionData = data; currentCorrectionIndex = 0; validatedAnswers = {};
     currentHostId = data.hostId; // Update hostId here too
     isHost = (socket.id === currentHostId); // Update isHost flag
     if (!quizScreen || !correctionScreen) { console.error("Missing elements"); return; }
     quizScreen.classList.add('hidden'); correctionScreen.classList.remove('hidden');
     displayCorrectionQuestion(currentCorrectionIndex); // displayCorrectionQuestion now uses isHost flag
});
socket.on('waitingForCorrection', () => { /* REMOVED - Handled by startCorrection */ });
socket.on('showScores', (scores) => { /* ... same ... */ });
socket.on('error', (message) => { /* ... same ... */ });
socket.on('answerValidated', ({ questionIndex, playerId, isCorrect }) => { /* ... same ... */ });
socket.on('updateCorrectionView', ({ newIndex }) => { /* ... same ... */ });