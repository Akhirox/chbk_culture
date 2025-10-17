// ✅ CODE COMPLET FINAL (AVEC CORRECTION, SCORES, ET FIX CATEGORIES V3 - Listener Délégué Corrigé)

const SERVER_URL = "https://chbk-culture.onrender.com";
const socket = io(SERVER_URL);

// --- Sélection des éléments du DOMM ---
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
let categoryCheckboxesContainer = document.getElementById('category-checkboxes'); // ** MUST EXIST INITIALLY OR BE HANDLED **
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


// --- Fonctions utilitaires ---
function lockAnswerUI(answer) { /* ... same ... */
    if (answerInput) answerInput.disabled = true;
    if (submitAnswerBtn) submitAnswerBtn.classList.add('hidden');
    if (confirmationMessage) {
        confirmationMessage.textContent = `Réponse enregistrée : "${answer}"`;
        confirmationMessage.classList.remove('hidden');
    }
}

function showLobby(roomData) { /* ... same ... */
    console.log("--- Entering showLobby ---");
    if (homeScreen) homeScreen.classList.add('hidden');
    if (quizScreen) quizScreen.classList.add('hidden');
    if (correctionScreen) correctionScreen.classList.add('hidden');
    if (scoreScreen) scoreScreen.classList.add('hidden');
    if (!lobbyScreen) { console.error("lobbyScreen element not found!"); return; }
    lobbyScreen.classList.remove('hidden');

    lobbyScreen.innerHTML = `<h2>Room Code : <span id="room-code-display"></span></h2><h3>Joueurs connectés :</h3><ul id="player-list"></ul><div id="host-controls" class="hidden"><div class="category-selection"><h3>Choisissez les catégories :</h3><div id="category-checkboxes"></div></div><button id="start-game-btn">Lancer le Quiz !</button></div><div id="player-view" class="hidden"><div class="category-selection"><h3>Catégories activées :</h3><div id="category-list-player"></div></div><p class="waiting-message">En attente du lancement par l'hôte...</p></div>`;

    // Re-select elements after innerHTML rewrite
    roomCodeDisplay = document.getElementById('room-code-display');
    playerList = document.getElementById('player-list');
    hostControls = document.getElementById('host-controls');
    playerView = document.getElementById('player-view');
    categoryCheckboxesContainer = document.getElementById('category-checkboxes'); // Re-assign global
    categoryListPlayer = document.getElementById('category-list-player');
    startGameBtn = document.getElementById('start-game-btn');

    if (!roomCodeDisplay || !playerList || !startGameBtn || !hostControls || !playerView || !categoryCheckboxesContainer || !categoryListPlayer) {
        console.error("Critical lobby elements not found after innerHTML rewrite!"); return;
    }

    // Re-attach listener for start button
    startGameBtn.addEventListener('click', onStartGameClick);

    currentHostId = roomData.hostId;
    currentRoomCode = roomData.roomCode;
    roomCodeDisplay.textContent = currentRoomCode;

    if (roomData.players) updatePlayerListView(roomData.players); else console.error("roomData.players missing");

    // Populate categories AFTER re-selecting containers
    if (categoryCheckboxesContainer && categoryListPlayer && roomData.categories) {
        categoryCheckboxesContainer.innerHTML = '';
        categoryListPlayer.innerHTML = '';
        roomData.categories.forEach(category => {
            // Host checkboxes
            const itemDiv = document.createElement('div');
            itemDiv.className = 'category-item';
             itemDiv.style.backgroundColor = '#007bff'; // Initial style
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox'; checkbox.id = `cat-${category}`; checkbox.name = 'category-checkbox'; checkbox.value = category; checkbox.checked = true;
            const label = document.createElement('label');
            label.htmlFor = `cat-${category}`; label.textContent = category;
             label.style.color = 'white'; // Initial style
            // NO individual listener here
            itemDiv.appendChild(checkbox); itemDiv.appendChild(label);
            categoryCheckboxesContainer.appendChild(itemDiv);

            // Player list items
            const playerItem = document.createElement('div');
            playerItem.className = 'category-item-player';
            playerItem.textContent = category;
            categoryListPlayer.appendChild(playerItem);
        });
    } else console.warn("Could not populate categories - missing elements or data");

    updateLobbyView();
    console.log("--- Exiting showLobby ---");
}


function updatePlayerListView(players) { /* ... same ... */
    if (!players) { console.error("No players data"); return; }
    // Use the global variable, re-select if necessary
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

function updateLobbyView() { /* ... same ... */
    // Use global variables, re-select if necessary
    if (!hostControls) hostControls = document.getElementById('host-controls');
    if (!playerView) playerView = document.getElementById('player-view');
    if (!hostControls || !playerView) { console.error("hostControls or playerView not found"); return; }
    if (socket.id === currentHostId) {
        hostControls.classList.remove('hidden');
        playerView.classList.add('hidden');
    } else {
        hostControls.classList.add('hidden');
        playerView.classList.remove('hidden');
    }
}

function startClientTimer() { /* ... same ... */
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

function showWaitingScreen(messageTitle, messageText) { /* ... same ... */
    if (quizScreen) quizScreen.classList.add('hidden');
    if (homeScreen) homeScreen.classList.add('hidden');
    if (correctionScreen) correctionScreen.classList.add('hidden');
    if (scoreScreen) scoreScreen.classList.add('hidden');
    if (lobbyScreen) {
        lobbyScreen.classList.remove('hidden');
        lobbyScreen.innerHTML = `<h2>${messageTitle}</h2><p>${messageText}</p>`;
    } else console.error("lobbyScreen not found");
}

function displayCorrectionQuestion(index) { /* ... same ... */
     if (!correctionData || !correctionData.questions || !correctionData.players || index === undefined || index === null) { return; }
     if (!correctionTitle || !correctionQuestionText || !correctionCorrectAnswer || !correctionAnswersList || !prevQuestionBtn || !nextQuestionBtn) { return; }
     if (index < 0 || index >= correctionData.questions.length) index = 0;
     const question = correctionData.questions[index];
     const playerAnswers = correctionData.playerAnswers[index] || [];
     correctionTitle.textContent = `Correction de la Question ${index + 1}/${correctionData.questions.length}`;
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
         item.innerHTML = `<div class="answer-text"><span class="pseudo">${player.pseudo} :</span><span>${playerAnswer}</span></div><input type="checkbox" class="validation-checkbox" id="${checkboxId}" data-player-id="${player.id}">`;
         if (validatedAnswers[checkboxId]) {
             const input = item.querySelector('input'); if (input) input.checked = true;
         }
         correctionAnswersList.appendChild(item);
     });
     prevQuestionBtn.disabled = (index === 0);
     nextQuestionBtn.disabled = (index >= correctionData.questions.length - 1);
}

function displayScores(scores) { /* ... same ... */
    if(correctionScreen) correctionScreen.classList.add('hidden');
    if(scoreScreen) scoreScreen.classList.remove('hidden'); else { console.error("scoreScreen not found"); return;}
    if(!finalScoresList) { console.error("finalScoresList not found"); return;}
    finalScoresList.innerHTML = '';
    scores.forEach((player, index) => {
        const li = document.createElement('li');
        let medal = '';
        if (index === 0) medal = '🥇'; else if (index === 1) medal = '🥈'; else if (index === 2) medal = '🥉';
        li.innerHTML = `<span>${medal} ${player.pseudo}</span><span>${player.score} points</span>`;
        finalScoresList.appendChild(li);
    });
}


// --- Événements des boutons ---
if (createBtn) createBtn.addEventListener('click', () => { /* ... same ... */
    const pseudo = pseudoCreateInput ? pseudoCreateInput.value : ''; if (pseudo) socket.emit('createRoom', { pseudo });
}); else console.error("createBtn not found");

if (joinBtn) joinBtn.addEventListener('click', () => { /* ... same ... */
    const pseudo = pseudoJoinInput ? pseudoJoinInput.value : ''; const roomCode = roomCodeInput ? roomCodeInput.value.toUpperCase() : ''; if (pseudo && roomCode) socket.emit('joinRoom', { pseudo, roomCode });
}); else console.error("joinBtn not found");

function onStartGameClick() { /* ... same ... */
    // Use the potentially re-assigned categoryCheckboxesContainer
    if (!categoryCheckboxesContainer) { console.error("categoryCheckboxesContainer not found"); return; }
    const checkedBoxes = categoryCheckboxesContainer.querySelectorAll('input[name="category-checkbox"]:checked');
    const selectedCategories = Array.from(checkedBoxes).map(cb => cb.value);
    if (selectedCategories.length > 0) socket.emit('startGame', { roomCode: currentRoomCode, selectedCategories });
    else alert("Veuillez choisir au moins une catégorie !");
}
// Attach listener initially (will be re-attached in showLobby)
if (startGameBtn) startGameBtn.addEventListener('click', onStartGameClick);
else console.error("startGameBtn not found initially");


if (submitAnswerBtn) submitAnswerBtn.addEventListener('click', () => { /* ... same ... */
    const answer = answerInput ? answerInput.value : '';
    socket.emit('submitAnswer', { roomCode: currentRoomCode, answer, questionIndex: currentQuestionRealIndex });
    lockAnswerUI(answer);
}); else console.error("submitAnswerBtn not found");

if (nextQuestionBtn) nextQuestionBtn.addEventListener('click', () => { /* ... same ... */
    if (correctionData && currentCorrectionIndex < correctionData.questions.length - 1) { currentCorrectionIndex++; displayCorrectionQuestion(currentCorrectionIndex); }
}); else console.error("nextQuestionBtn not found");

// --- CORRECTED : Event Delegation for Category Checkboxes ---
// This listener MUST be attached to the container AFTER the container itself is selected.
// It should ideally be attached only once. Let's ensure it's attached after the first potential selection.
function attachCategoryClickListener() {
    // Remove previous listener if any to prevent duplicates
    if (window.categoryClickListenerAttached) {
         if(categoryCheckboxesContainer) categoryCheckboxesContainer.removeEventListener('click', handleCategoryClick);
         window.categoryClickListenerAttached = false;
    }

    // Re-select container just in case it wasn't available before
    if (!categoryCheckboxesContainer) categoryCheckboxesContainer = document.getElementById('category-checkboxes');

    if (categoryCheckboxesContainer) {
        console.log("Attaching delegate listener to categoryCheckboxesContainer"); // DEBUG
        categoryCheckboxesContainer.addEventListener('click', handleCategoryClick);
        window.categoryClickListenerAttached = true; // Flag that it's attached
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
            // === SIMPLIFIED LOGIC V2 ===
            // REMOVED: if (event.target !== checkbox) { checkbox.checked = !checkbox.checked; }
            // Let the browser handle the check/uncheck via the label's 'for' attribute.
            // Read the state slightly after the click to update the style.
            setTimeout(() => {
                if (checkbox.checked) {
                    itemDiv.style.backgroundColor = '#007bff'; // Blue when checked
                    label.style.color = 'white';
                } else {
                    itemDiv.style.backgroundColor = '#e9ecef'; // Grey when unchecked
                    label.style.color = 'black';
                }
             }, 0); // Delay allows browser to process the click first
            // === END SIMPLIFIED LOGIC V2 ===
        }
    }
}
// --- END CORRECTION ---


if (correctionAnswersList) correctionAnswersList.addEventListener('click', (event) => { /* ... same ... */
    if (event.target.classList.contains('validation-checkbox')) {
        const checkbox = event.target; const playerId = checkbox.dataset.playerId; const isCorrect = checkbox.checked; const checkboxId = checkbox.id;
        if (isCorrect) validatedAnswers[checkboxId] = true; else delete validatedAnswers[checkboxId];
        socket.emit('validateAnswer', { roomCode: currentRoomCode, playerId: playerId, isCorrect: isCorrect });
    }
}); else console.error("correctionAnswersList not found");

if (prevQuestionBtn) prevQuestionBtn.addEventListener('click', () => { /* ... same ... */
    if (correctionData && currentCorrectionIndex > 0) { currentCorrectionIndex--; displayCorrectionQuestion(currentCorrectionIndex); }
}); else console.error("prevQuestionBtn not found");

if(finishCorrectionBtn) { /* ... same ... */
    finishCorrectionBtn.addEventListener('click', () => { console.log("Clic sur 'Terminer la Correction'"); socket.emit('finishCorrection', { roomCode: currentRoomCode }); });
} else console.error("finishCorrectionBtn not found");

if(playAgainBtn) { /* ... same ... */
    playAgainBtn.addEventListener('click', () => {
        if (scoreScreen) scoreScreen.classList.add('hidden'); if (homeScreen) homeScreen.classList.remove('hidden');
        currentRoomCode = null; currentHostId = null; correctionData = null; currentCorrectionIndex = 0; validatedAnswers = {}; currentQuestionRealIndex = 0;
        // window.location.reload(); // Consider reload
    });
} else console.error("playAgainBtn not found");


// --- Réception des événements du serveur ---

socket.on('roomCreated', (roomData) => {
    console.log('Room créée !', roomData);
    if (!roomData) { console.error("No roomData"); return; }
    currentHostId = roomData.hostId;
    showLobby(roomData); // Rebuilds DOM, re-selects elements, attaches listeners

    // Attach the category click listener AFTER showLobby finishes rebuilding
    attachCategoryClickListener();
});

socket.on('updatePlayerList', (data) => {
    console.log('Liste des joueurs mise à jour', data);
    if (!data || !data.players || !data.hostId) { console.error("Invalid data", data); return; }
    currentHostId = data.hostId;

    let lobbyJustShown = false;
    if (homeScreen && !homeScreen.classList.contains('hidden')) {
        if (!lobbyScreen || !roomCodeInput) { console.error("Missing elements"); return; }
        homeScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        lobbyJustShown = true;
        currentRoomCode = roomCodeInput.value.toUpperCase();
        roomCodeDisplay = document.getElementById('room-code-display'); // Re-select
        if (roomCodeDisplay) roomCodeDisplay.textContent = currentRoomCode;
         else console.log("roomCodeDisplay not found after join");
    }

    // Re-select containers
    categoryCheckboxesContainer = document.getElementById('category-checkboxes');
    categoryListPlayer = document.getElementById('category-list-player');

    // Repopulate Categories if needed
    if (categoryCheckboxesContainer && categoryListPlayer && data.categories && Array.isArray(data.categories)) {
        if (lobbyJustShown || categoryListPlayer.innerHTML === '' || categoryCheckboxesContainer.innerHTML === '') {
             console.log("Populating categories in updatePlayerList...");
             categoryCheckboxesContainer.innerHTML = '';
             categoryListPlayer.innerHTML = '';
             data.categories.forEach(category => {
                 // Host checkboxes
                 const itemDiv = document.createElement('div');
                 itemDiv.className = 'category-item';
                 itemDiv.style.backgroundColor = '#007bff';
                 const checkbox = document.createElement('input');
                 checkbox.type = 'checkbox'; checkbox.id = `cat-${category}`; checkbox.name = 'category-checkbox'; checkbox.value = category; checkbox.checked = true;
                 const label = document.createElement('label');
                 label.htmlFor = `cat-${category}`; label.textContent = category;
                 label.style.color = 'white';
                 // Delegate listener handles clicks
                 itemDiv.appendChild(checkbox); itemDiv.appendChild(label);
                 if(categoryCheckboxesContainer) categoryCheckboxesContainer.appendChild(itemDiv);

                 // Player list items
                 const playerItem = document.createElement('div');
                 playerItem.className = 'category-item-player';
                 playerItem.textContent = category;
                 if(categoryListPlayer) categoryListPlayer.appendChild(playerItem);
             });
             // Ensure listener is attached after repopulating
             attachCategoryClickListener();
        }
    } else console.warn("Could not populate categories - missing elements or category data");

    updatePlayerListView(data.players);
    updateLobbyView();
});


socket.on('newQuestion', ({ question, questionIndex, totalQuestions }) => { /* ... same as before, with checks ... */
    if (!lobbyScreen || !quizScreen || !questionImage || !questionText || !answerInput || !submitAnswerBtn || !confirmationMessage) { console.error("Missing elements"); return; }
    lobbyScreen.classList.add('hidden'); quizScreen.classList.remove('hidden');
    if (question && question.image) { questionImage.src = question.image; questionImage.classList.remove('hidden'); }
    else { if(questionImage) { questionImage.src = ''; questionImage.classList.add('hidden'); } }
    currentQuestionRealIndex = questionIndex - 1;
    if(questionText && question) questionText.textContent = `Question ${questionIndex}/${totalQuestions}: ${question.question}`;
    if(answerInput) answerInput.value = ''; if(answerInput) answerInput.disabled = false; if(submitAnswerBtn) submitAnswerBtn.classList.remove('hidden'); if(confirmationMessage) confirmationMessage.classList.add('hidden');
    if(answerInput) answerInput.focus(); startClientTimer();
});

socket.on('startCorrection', (data) => { /* ... same as before, with checks ... */
    console.log("Données de correction reçues :", data);
    if(!data || !data.questions || !data.players) { console.error("Invalid data"); return; }
    correctionData = data; currentCorrectionIndex = 0; validatedAnswers = {};
    if (!quizScreen || !correctionScreen) { console.error("Missing elements"); return; }
    quizScreen.classList.add('hidden'); correctionScreen.classList.remove('hidden');
    displayCorrectionQuestion(currentCorrectionIndex);
});

socket.on('waitingForCorrection', () => { /* ... same as before ... */
    showWaitingScreen( "En attente de la correction...", "L'hôte valide les réponses..." );
});

socket.on('showScores', (scores) => { /* ... same as before, with checks ... */
    console.log("Scores finaux reçus :", scores);
    if (scores && Array.isArray(scores)) {
        displayScores(scores);
    } else {
        console.error("Invalid scores data received:", scores);
    }
});

socket.on('error', (message) => { /* ... same as before ... */
    alert(`Erreur : ${message}`);
});