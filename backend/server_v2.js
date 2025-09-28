// server_v2.js - Basic server for Darts V2 development.
// REVAMPED: Team system overhaul. All participants are now teams. Persistent storage is for individual players only.
// RULE CHANGE (3FF): Guaranteed inclusion of at least one '3FF' and one 'hard_score' objective in every game.
// FIX (Stats): Corrected the loadData function to properly parse the stats.json object instead of discarding it.
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// --- Server Setup ---
const app = express();
app.use(express.static(path.join(__dirname)));
app.use('/games', express.static(path.join(__dirname, 'games')));
const server = http.createServer(app);
const V2_PORT = process.env.PORT || 8046;
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- Game State, Persistent Players & Stats ---
let v2CurrentGame = null;
const MAX_HISTORY_LENGTH = 20;

// Paths for persistent data
const DATA_DIR = path.join(__dirname, 'data');
const PERSISTENT_PLAYERS_FILE = path.join(DATA_DIR, 'persistent_players.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

let persistentPlayersList = [];
let historicalStats = { teams: {}, players: {} };
let sessionStats = { teams: {}, players: {} };

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[V2 Server] Created data directory:', DATA_DIR);
}

// FIX: Modified loadData to correctly handle both array (players) and object (stats) data structures.
function loadData(filePath, defaultData) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            if (!data) return defaultData; // Handle empty file
            const parsed = JSON.parse(data);
            // The original logic was only built for the players array.
            // This now correctly handles the stats object as well.
            if (Array.isArray(parsed)) {
                return parsed.map(p => ({ id: p.id, name: p.name }));
            }
            // If it's not an array, it's our stats object, which can be returned directly.
            return parsed;
        }
        console.log(`[V2 Server] ${path.basename(filePath)} not found. Initializing with default data.`);
        return defaultData;
    } catch (error) {
        console.error(`[V2 Server] Error loading or parsing ${path.basename(filePath)}:`, error);
        return defaultData;
    }
}

function saveData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[V2 Server] Data saved successfully to: ${filePath}`);
    } catch (error)
    {
        console.error(`[V2 Server] Error saving data to ${filePath}:`, error);
    }
}


// Load initial data on server start
persistentPlayersList = loadData(PERSISTENT_PLAYERS_FILE, []);
historicalStats = loadData(STATS_FILE, { teams: {}, players: {} });


// --- Stats Logic ---
function processGameWinner(winnerData) {
    if (!winnerData || !winnerData.name || winnerData.type === 'tie' || winnerData.type === 'error' || winnerData.type === 'none') {
        console.log('[Stats] No valid winner to process.');
        return;
    }

    console.log(`[Stats] Processing winner: ${winnerData.name} (Type: ${winnerData.type})`);

    const increment = (name, category) => {
        // Ensure the category exists before trying to access it.
        if (!sessionStats[category]) sessionStats[category] = {};
        if (!historicalStats[category]) historicalStats[category] = {};
        
        sessionStats[category][name] = (sessionStats[category][name] || 0) + 1;
        historicalStats[category][name] = (historicalStats[category][name] || 0) + 1;
    };

    if (winnerData.type === 'team' && winnerData.name) {
        increment(winnerData.name, 'teams');
        const winningTeam = v2CurrentGame.participants.find(p => p.id === winnerData.id);
        if (winningTeam && winningTeam.players && Array.isArray(winningTeam.players)) {
            winningTeam.players.forEach(playerName => {
                if (playerName) {
                    increment(playerName, 'players');
                }
            });
        }
    }

    saveData(STATS_FILE, historicalStats);
    io.emit('statsUpdate', { sessionStats, historicalStats });
    console.log('[Stats] Stats updated and broadcasted.');
}

function concludeGame() {
    if (v2CurrentGame && v2CurrentGame.gameOver && v2CurrentGame.winner) {
        console.log(`[concludeGame] Game ${v2CurrentGame.id} concluded. Processing winner.`);
        processGameWinner(v2CurrentGame.winner);
    }
}


// --- Game Constants ---
const CRICKET_OBJECTIVES_CONFIG = [
    { name: "B", value: 25, isNumeric: true },
    { name: "T", value: 0, isNumeric: false },
    { name: "D", value: 0, isNumeric: false },
    { name: "20", value: 20, isNumeric: true },
    { name: "19", value: 19, isNumeric: true },
    { name: "18", value: 18, isNumeric: true },
    { name: "17", value: 17, isNumeric: true },
    { name: "16", value: 16, isNumeric: true },
    { name: "15", value: 15, isNumeric: true }
];
const CRICKET_CLOSABLE_OBJECTIVES = ["20", "19", "18", "17", "16", "15", "B", "T", "D"];

const THREE_FF_STATIC_OBJECTIVES_ORDERED = ["20", "19", "18", "17", "16", "15", "B"];
const THREE_FF_RANDOM_CHALLENGES_POOL = ["3C#", "D", "EOE", "OEO", "ASC", "3DC", "Holes", "T", "AS#", "B", "Nines"];

const THREE_FF_RANDOM_CHALLENGE_DETAILS = {
    "3C#": { description: "Hit 3 Consecutive Numbers in one turn (Must call up or down)." },
    "D": { description: "Hit any Double." },
    "EOE": { description: "Hit Even, Odd, Even numbers in sequence." },
    "OEO": { description: "Hit Odd, Even, Odd numbers in sequence." },
    "ASC": { description: "Hit all the same colour." },
    "3DC": { description: "Hit 3 different Doubles or Trebles in one turn (e.g., D20, T10, D5)." },
    "Holes": { description: "Hit a hole in outside ring of numbers on the dartboard." },
    "T": { description: "Hit any Triple." },
    "AS#": { description: "Score the same number with all darts as your first dart thrown." },
    "B": { description: "Hit a Bullseye (either single or double). Enter 25 or 50." },
    "Nines": { description: "Achieve a score that ends in the number 9. Enter your total score for the turn." }
};

const THREE_FF_HARD_SCORES_VALUES = [61, 65, 69];
const THREE_FF_SPECIAL_OBJECTIVE_NAME = "3FF";
const NUM_RANDOM_CHALLENGES_FOR_3FF = 4;
const FIVE_ZERO_ONE_START_SCORE = 501;

const ATW_OBJECTIVES_NUMBERS_MAX = 20;
const ATW_TARGET_QUALIFY_SB = 21;
const ATW_TARGET_WIN_DB = 22;
const ATW_LOGICAL_WIN_VIA_SB = 23;
const ATW_LOGICAL_WIN_VIA_DB = 24;
const ATW_REPORTED_VALUE_SB = 25;
const ATW_REPORTED_VALUE_DB = 50;
const ATW_REPORTED_VALUE_MISS = 0;
const ATW_MAX_SB_HITS_FOR_WIN = 5;

const BEERS_LETTERS = ['B', 'E', 'E', 'R', 'S'];
const GOLF_NUM_HOLES = 18;
const BASEBALL_NUM_INNINGS = 9;
const BASEBALL_SB_VALUE = 25;
const BASEBALL_DB_VALUE = 50;

const KILLER_LIVES_START = 3;
const KILLER_NUMBERS_TO_CHOOSE_FROM = Array.from({ length: 20 }, (_, i) => i + 1);
const CONTROLLER_DEVICE_ACTION_ID = "CONTROLLER_DEVICE_ACTION";


// --- Helper Functions ---
function pushToHistory(game) {
    if (!game) return;
    if (!game.history) game.history = [];
    const stateToSave = JSON.parse(JSON.stringify(game));
    delete stateToSave.history;
    game.history.push(stateToSave);
    if (game.history.length > MAX_HISTORY_LENGTH) {
        game.history.shift();
    }
}

function getAtwDisplayTarget(targetValue) {
    if (targetValue >= 1 && targetValue <= ATW_OBJECTIVES_NUMBERS_MAX) return String(targetValue);
    if (targetValue === ATW_TARGET_QUALIFY_SB) return 'SB';
    if (targetValue === ATW_TARGET_WIN_DB) return 'DB';
    if (targetValue === ATW_LOGICAL_WIN_VIA_DB || targetValue === ATW_LOGICAL_WIN_VIA_SB ) return 'WIN!';
    return 'N/A';
}

function getAtwReportedHitDisplay(reportedValue) {
    if (reportedValue === ATW_REPORTED_VALUE_MISS) return 'Miss';
    if (reportedValue === ATW_REPORTED_VALUE_SB) return 'SB';
    if (reportedValue === ATW_REPORTED_VALUE_DB) return 'DB';
    if (reportedValue >= 1 && reportedValue <= ATW_OBJECTIVES_NUMBERS_MAX) return String(reportedValue);
    return 'Unknown Hit';
}

function advanceTurnRR(game) {
    if (!game || game.gameOver || !game.participants || game.participants.length === 0) {
        console.log("[advanceTurnRR] Game over, no participants, or no game. Returning false.");
        return false;
    }

    const numParticipants = game.participants.length;

    // MODIFICATION: Added 'THREE_FF' to use the round-robin turn logic.
    if (game.mode === 'CRICKET' || game.mode === 'FIVE_ZERO_ONE' || game.mode === 'AROUND_THE_WORLD' || game.mode === 'THREE_FF') {
        let nextTeamIdx = game.currentPlayerIndex ?? -1;
        let nextPlayerSlot = game.currentPlayerTurnInTeam ?? 0;

        const maxPlayersOnAnyTeam = Math.max(1, ...game.participants.map(p => (p.players ? p.players.length : 1)));
        const maxAttempts = (numParticipants * maxPlayersOnAnyTeam) + 5;

        for (let i = 0; i < maxAttempts; i++) {
            nextTeamIdx++;
            if (nextTeamIdx >= numParticipants) {
                nextTeamIdx = 0;
                nextPlayerSlot++;
            }
            if (nextPlayerSlot >= maxPlayersOnAnyTeam) {
                nextPlayerSlot = 0;
            }

            const potentialNextTeam = game.participants[nextTeamIdx];
            
            const teamHasPlayerInSlot = potentialNextTeam && potentialNextTeam.players && nextPlayerSlot < potentialNextTeam.players.length;

            let shouldSkip = false;
            if (!potentialNextTeam || !teamHasPlayerInSlot) { 
                shouldSkip = true; 
            }
            else if (potentialNextTeam.isEliminated) { shouldSkip = true; } 
            else if (game.mode === 'AROUND_THE_WORLD' && potentialNextTeam.atw_isWinner) { shouldSkip = true; }

            if (!shouldSkip) {
                game.currentPlayerIndex = nextTeamIdx;
                game.currentPlayerTurnInTeam = nextPlayerSlot;
                console.log(`[advanceTurnRR - ${game.mode}] Turn advanced. New TeamIndex: ${game.currentPlayerIndex}, PlayerInTeamSlot: ${game.currentPlayerTurnInTeam}`);
                return true;
            }
        }

        console.error(`[advanceTurnRR - ${game.mode}] Exceeded max search attempts (${maxAttempts}). Game might be stuck or over.`);
        return false;
    }

    let currentParticipantIndex = game.currentPlayerIndex;
    let currentPlayerSlotInTeam = game.currentPlayerTurnInTeam || 0;
    
    let attempts = 0;
    const maxAttemptsGeneral = numParticipants * (game.participants.reduce((max, p) => Math.max(max, (p.players ? p.players.length : 1)), 0) + 1) + 5;

    do {
        attempts++;
        if (attempts > maxAttemptsGeneral) {
            console.error(`[advanceTurnRR - ${game.mode}] Exceeded max search attempts (${maxAttemptsGeneral}).`);
            return false;
        }

        let currentParticipant = game.participants[currentParticipantIndex];
        if (currentParticipant && currentParticipant.players && currentParticipant.players.length > (currentPlayerSlotInTeam + 1)) {
            currentPlayerSlotInTeam++;
        } else {
            currentParticipantIndex = (currentParticipantIndex + 1) % numParticipants;
            currentPlayerSlotInTeam = 0;
        }

        const potentialNextParticipant = game.participants[currentParticipantIndex];

        if (!potentialNextParticipant) {
             console.error(`[advanceTurnRR] Critical Error: potentialNextParticipant is undefined at index ${currentParticipantIndex}. numParticipants: ${numParticipants}.`);
             if (numParticipants > 0 && attempts < maxAttemptsGeneral -1 ) {
                currentParticipantIndex = -1;
                currentPlayerSlotInTeam = 0;
                continue;
             }
             return false;
        }

        let skip = false;
        if (potentialNextParticipant.isEliminated) skip = true;
        if (game.mode === 'KILLER' && potentialNextParticipant.killer_is_eliminated) skip = true;
        if (potentialNextParticipant.players && currentPlayerSlotInTeam >= potentialNextParticipant.players.length) {
            skip = true;
        }

        if (!skip) {
            game.currentPlayerIndex = currentParticipantIndex;
            game.currentPlayerTurnInTeam = currentPlayerSlotInTeam;
            console.log(`[advanceTurnRR - ${game.mode}] Turn advanced. New PlayerIndex: ${game.currentPlayerIndex}, PlayerInTeam: ${game.currentPlayerTurnInTeam}`);
            return true;
        }
    } while (true);
}


// --- Game Specific Initialization & Logic ---

// --- CRICKET ---
function initializeCricketParticipantState(participant) {
    const marks = {};
    CRICKET_OBJECTIVES_CONFIG.forEach(obj => {
        marks[obj.name] = 0;
    });

    participant.score = 0;
    participant.marks = marks;
    participant.dartsThrownThisTurn = 0;
    return participant;
}

function checkCricketWinCondition(game) {
    if (!game || game.mode !== 'CRICKET' || game.gameOver) return false;

    const allScoringEntities = game.participants;

    if (allScoringEntities.length === 0) return false;

    let playersWhoClosedAllRequired = [];
    for (const entity of allScoringEntities) {
        if (CRICKET_CLOSABLE_OBJECTIVES.every(objName => (entity.marks[objName] || 0) >= 3)) {
            playersWhoClosedAllRequired.push(entity);
        }
    }

    if (playersWhoClosedAllRequired.length === 0) return false;

    let overallHighestScore = -Infinity;
    allScoringEntities.forEach(entity => {
        if (entity.score > overallHighestScore) overallHighestScore = entity.score;
    });

    let trueWinner = null;
    for (const entityClosed of playersWhoClosedAllRequired) {
        if (entityClosed.score >= overallHighestScore) {
            if (!trueWinner || entityClosed.score > trueWinner.score) {
                trueWinner = entityClosed;
            }
        }
    }

    if (trueWinner) {
        game.gameOver = true;
        game.winner = {
            id: trueWinner.id,
            name: trueWinner.name,
            score: trueWinner.score,
            type: 'team'
        };
        console.log(`[Cricket Win] Game Over. Winner: ${game.winner.name} with score ${game.winner.score}`);
        concludeGame();
        return true;
    }
    return false;
}


// --- 3 FRIENDLY FLIGHTS (THREE_FF) ---
function generateThreeFFObjectives() {
    let objectiveIdCounter = 0;
    const finalObjectives = [];

    // Create the static number objectives
    const staticObjectives = THREE_FF_STATIC_OBJECTIVES_ORDERED.map(name => ({
        id: `3ff_obj_${objectiveIdCounter++}`,
        name: name,
        type: 'static_number',
        value: name === 'B' ? 25 : parseInt(name),
        description: `Hit a ${name === 'B' ? 'Bullseye' : name}.`
    }));

    // --- Start: New Guaranteed Objective Logic ---
    const guaranteedObjectives = [];

    // 1. Guarantee one "3FF" objective
    guaranteedObjectives.push({
        id: `3ff_obj_${objectiveIdCounter++}`,
        name: THREE_FF_SPECIAL_OBJECTIVE_NAME,
        type: 'special_3ff',
        description: "Nice Grouping! (Flights must be touching, add up all darts with a score)"
    });

    // 2. Guarantee at least one "hard_score" objective
    const hardScoreValue = THREE_FF_HARD_SCORES_VALUES[Math.floor(Math.random() * THREE_FF_HARD_SCORES_VALUES.length)];
    guaranteedObjectives.push({
        id: `3ff_obj_${objectiveIdCounter++}`,
        name: `${hardScoreValue}`,
        type: 'hard_score',
        value: hardScoreValue,
        description: `Achieve exactly ${hardScoreValue} points.`
    });

    // --- End: New Guaranteed Objective Logic ---

    // Create the pool of other random objectives
    const otherObjectivesPool = [];
    const shuffledChallenges = [...THREE_FF_RANDOM_CHALLENGES_POOL].sort(() => 0.5 - Math.random());
    for (let i = 0; i < NUM_RANDOM_CHALLENGES_FOR_3FF && i < shuffledChallenges.length; i++) {
        const challengeName = shuffledChallenges[i];
        const details = THREE_FF_RANDOM_CHALLENGE_DETAILS[challengeName];
        if (details) {
            otherObjectivesPool.push({
                id: `3ff_obj_${objectiveIdCounter++}`,
                name: challengeName,
                type: 'random_challenge',
                description: details.description
            });
        } else {
            console.warn(`[3FF Objectives] Details not found for random challenge: ${challengeName}`);
        }
    }

    // Combine guaranteed and random objectives into a single "other" pool and shuffle
    const combinedOtherObjectives = [...guaranteedObjectives, ...otherObjectivesPool];
    combinedOtherObjectives.sort(() => 0.5 - Math.random());


    // Interleave the static objectives with the combined "other" objectives
    for (let i = 0; i < staticObjectives.length; i++) {
        finalObjectives.push(staticObjectives[i]);
        if (combinedOtherObjectives[i]) {
            finalObjectives.push(combinedOtherObjectives[i]);
        }
    }
    // Add any remaining "other" objectives if the list is longer than the static list
    if (combinedOtherObjectives.length > staticObjectives.length) {
        finalObjectives.push(...combinedOtherObjectives.slice(staticObjectives.length));
    }

    return finalObjectives.map(obj => ({ ...obj, status: 'open' }));
}
function initializeThreeFFParticipantState(participant) { return { ...participant, score: 0, justHalvedScore: false }; }
function advanceTurnAndObjectiveThreeFF(game) {
    if (!game || game.gameOver) return;
    game.participants.forEach(p => {
        if (p.justHalvedScore) p.justHalvedScore = false;
    });

    const successfullyAdvancedPlayer = advanceTurnRR(game);

    if (!successfullyAdvancedPlayer && !game.gameOver) {
        console.error("[3FF] advanceTurnRR returned false. Game may be stuck or over.");
        game.gameOver = true; let highScore = -Infinity; let winners = [];
        game.participants.forEach(p => {
            if (p.score > highScore) { highScore = p.score; winners = [p]; }
            else if (p.score === highScore) winners.push(p);
        });
        if (winners.length === 1) game.winner = { id: winners[0].id, name: winners[0].name, score: winners[0].score, type: 'team' };
        else if (winners.length > 1) game.winner = { name: `Tie (${winners.map(w => w.name).join(' & ')})`, score: highScore, type: 'tie' };
        else game.winner = { name: "No Winner", score: 0, type: 'none'};
        game.showMetMissPromptFor = null; game.showKeypadFor3FF = null;
        concludeGame();
        return;
    }
    if (game.gameOver) return;
    let objectiveRoundComplete = false;
    if (game.participants.length > 0) {
        if (game.currentPlayerIndex === game.threeFF_currentObjectiveRoundStartIndex &&
            game.currentPlayerTurnInTeam === game.threeFF_currentObjectiveRoundStartPlayerInTeamIndex) {
            objectiveRoundComplete = true;
        }
    }
    if (objectiveRoundComplete) {
        if (game.objectives[game.activeObjectiveIndex]) {
            game.objectives[game.activeObjectiveIndex].status = 'closed';
        }
        game.activeObjectiveIndex++;
        if (game.activeObjectiveIndex >= game.objectives.length) {
            game.gameOver = true;
            let highScore = -Infinity; let winners = [];
            game.participants.forEach(p => {
                if (p.score > highScore) { highScore = p.score; winners = [p]; }
                else if (p.score === highScore) winners.push(p);
            });
            if (winners.length === 1) game.winner = { id: winners[0].id, name: winners[0].name, score: winners[0].score, type: 'team' };
            else if (winners.length > 1) game.winner = { name: `Tie (${winners.map(w => w.name).join(' & ')})`, score: highScore, type: 'tie' };
            else game.winner = { name: "No Winner", score: 0, type: 'none'};
            game.showMetMissPromptFor = null; game.showKeypadFor3FF = null;
            concludeGame();
            return;
        } else {
            game.threeFF_currentObjectiveRoundStartIndex = game.currentPlayerIndex;
            game.threeFF_currentObjectiveRoundStartPlayerInTeamIndex = game.currentPlayerTurnInTeam;
        }
    }
    if (!game.gameOver && game.objectives[game.activeObjectiveIndex]) {
        const nextObjectiveForPrompt = game.objectives[game.activeObjectiveIndex];
        game.showMetMissPromptFor = {
            participantIndex: game.currentPlayerIndex,
            playerInTeamIndex: game.currentPlayerTurnInTeam,
            objectiveName: nextObjectiveForPrompt.name,
            objectiveId: nextObjectiveForPrompt.id,
            objectiveDescription: nextObjectiveForPrompt.description
        };
        game.showKeypadFor3FF = null;
    } else {
        game.showMetMissPromptFor = null;
        game.showKeypadFor3FF = null;
    }
}

// --- 501 ---
function initializeFiveZeroOneParticipantState(participant) {
    return { ...participant, score: FIVE_ZERO_ONE_START_SCORE, isDoubledIn: false, previousScoreThisTurn: FIVE_ZERO_ONE_START_SCORE, dartsThrownThisTurnCount: 0, lastValidScore: FIVE_ZERO_ONE_START_SCORE, lastTurnScore: 0 };
}
function advanceTurnFiveZeroOne(game) {
    if (!game || game.gameOver) return;
    const participantWhoseTurnEnded = game.participants[game.currentPlayerIndex];
    if (participantWhoseTurnEnded) participantWhoseTurnEnded.dartsThrownThisTurnCount = 0;
    const successfullyAdvanced = advanceTurnRR(game);
    if (!successfullyAdvanced && !game.gameOver) {
        game.gameOver = true; game.winner = game.winner || { name: "Error - No Next Turn", score: 0, type: 'error' }; game.showFiveZeroOneActionPrompt = false; game.showKeypadForFiveZeroOne = null; game.bustMessage = "Error: Could not determine next player."; 
        concludeGame();
        return;
    }
    if (game.gameOver) return;
    const nextParticipant = game.participants[game.currentPlayerIndex];
    if (nextParticipant) nextParticipant.previousScoreThisTurn = nextParticipant.score;
    game.showFiveZeroOneActionPrompt = true; game.showKeypadForFiveZeroOne = null; game.bustMessage = null;
}

// --- AROUND THE WORLD - Refined Logic ---
function initializeAroundTheWorldParticipantState(participant) {
    return {
        ...participant,
        atw_currentTargetValue: 1,
        atw_sb_hit_count: 0,
        atw_has_hit_sb_this_game: false,
        atw_hitsLog: [],
        atw_isWinner: false
    };
}
function advanceAroundTheWorldTurn_Simplified(game) {
    if (!game || game.gameOver) return;

    const successfullyAdvanced = advanceTurnRR(game);
    if (!successfullyAdvanced && !game.gameOver) {
        const activePlayers = game.participants.filter(p => !p.atw_isWinner);
        if (activePlayers.length === 0 && !game.gameOver) {
            game.gameOver = true;
            game.winner = game.winner || { name: "All Players Completed/Won", type: "tie" };
            concludeGame();
        }
    }
    if (game.gameOver) {
        game.showAroundTheWorldActionPrompt = null;
        game.showATWObjectiveSelectorModal = null;
        return;
    }
    const nextActiveParticipant = game.participants[game.currentPlayerIndex];
    if(nextActiveParticipant && !nextActiveParticipant.atw_isWinner) {
        game.showAroundTheWorldActionPrompt = {
            participantIndex: game.currentPlayerIndex,
            playerInTeamIndex: game.currentPlayerTurnInTeam,
            currentTargetForDisplay: nextActiveParticipant.atw_currentTargetValue
        };
    } else {
        game.showAroundTheWorldActionPrompt = null;
        if (!game.participants.some(p => !p.atw_isWinner) && !game.gameOver) {
             game.gameOver = true;
             game.winner = game.winner || { name: "All Players Won", type: "tie"};
             concludeGame();
        }
    }
    game.showATWObjectiveSelectorModal = null;
}
function checkAroundTheWorldWinCondition(game, participantWhoMightHaveWon) {
    if (participantWhoMightHaveWon && participantWhoMightHaveWon.atw_isWinner && !game.gameOver) {
        game.gameOver = true;
        game.winner = { id: participantWhoMightHaveWon.id, name: participantWhoMightHaveWon.name, score: getAtwDisplayTarget(participantWhoMightHaveWon.atw_currentTargetValue), type: 'team' };
        game.showAroundTheWorldActionPrompt = null;
        game.showATWObjectiveSelectorModal = null;
        console.log(`[V2 ATW WinCheck] Game Over! Winner: ${participantWhoMightHaveWon.name} via ${getAtwDisplayTarget(participantWhoMightHaveWon.atw_currentTargetValue)}`);
        concludeGame();
        return true;
    }
    if (game.participants.every(p => p.atw_isWinner) && !game.gameOver) {
        game.gameOver = true;
        game.winner = game.winner || { name: "All Players Won", type: "tie" };
         game.showAroundTheWorldActionPrompt = null;
        game.showATWObjectiveSelectorModal = null;
        console.log(`[V2 ATW WinCheck] All players have won. Game Over.`);
        concludeGame();
        return true;
    }
    return game.gameOver;
}

// --- BEERS ---
function initializeBeersParticipantState(participant) {
    return { ...participant, lettersGiven: [], isEliminated: false, lastScore: null };
}
function advanceBeersTurn(game) {
    if (!game || game.gameOver) return;
    const activePlayers = game.participants.filter(p => !p.isEliminated);
    if (activePlayers.length <= 1) {
        game.gameOver = true;
        if (activePlayers.length === 1) {
            game.winner = { id: activePlayers[0].id, name: activePlayers[0].name, score: activePlayers[0].lettersGiven.length, type: 'team' };
        } else {
            game.winner = { name: "No Winner", score: 0, type: 'none' };
        }
        game.promptForPlayerAction = null; 
        game.showKeypadForBeers = null; 
        game.promptToTakeLetter = null;
        concludeGame();
        return;
    }
    let nextPlayerIdx = game.currentPlayerIndex; 
    let attempts = 0; 
    const maxAttempts = game.participants.length * 2;
    do {
        nextPlayerIdx = (nextPlayerIdx + 1) % game.participants.length; 
        attempts++;
        if (attempts > maxAttempts) { 
            game.gameOver = true; 
            game.winner = { name: "Error - Turn Stuck", score: 0, type: 'error' }; 
            concludeGame();
            return; 
        }
    } while (game.participants[nextPlayerIdx].isEliminated);
    
    game.currentPlayerIndex = nextPlayerIdx;
    game.promptForPlayerAction = { participantIndex: game.currentPlayerIndex };
    game.showKeypadForBeers = null;
}

// --- GOLF ---
function initializeGolfParticipantState(participant) {
    participant.golfScores = Array(GOLF_NUM_HOLES).fill(null);
    participant.golfTotalScore = 0;
    return participant;
}

function determineGolfHonorsAndOrder(game) {
    if (!game || !game.participants || game.participants.length === 0) {
        game.golfTurnOrder = [];
        game.golfHonorsHolderIndex = undefined;
        return;
    }

    let honorsParticipantIndex = 0;

    if (game.currentHole > 1) {
        const prevHoleIndex = game.currentHole - 2;
        let bestScorePrevHole = Infinity;
        let honorsCandidates = [];

        game.participants.forEach((p, index) => {
            const scoreForHonors = p.golfScores ? p.golfScores[prevHoleIndex] : null;

            if (scoreForHonors !== null && scoreForHonors < bestScorePrevHole) {
                bestScorePrevHole = scoreForHonors;
                honorsCandidates = [index];
            } else if (scoreForHonors !== null && scoreForHonors === bestScorePrevHole) {
                honorsCandidates.push(index);
            }
        });

        if (honorsCandidates.length === 1) {
            honorsParticipantIndex = honorsCandidates[0];
        } else if (honorsCandidates.length > 1) {
            honorsParticipantIndex = honorsCandidates.includes(game.golfHonorsHolderIndex) ? game.golfHonorsHolderIndex : honorsCandidates[0];
        } else {
            honorsParticipantIndex = game.golfHonorsHolderIndex ?? 0;
        }
    }
    
    game.golfHonorsHolderIndex = honorsParticipantIndex;

    const turnOrder = [honorsParticipantIndex];
    for(let i = 0; i < game.participants.length; i++) {
        if (i !== honorsParticipantIndex) {
            turnOrder.push(i);
        }
    }
    
    game.golfTurnOrder = turnOrder;
    game.golfCurrentTurnOrderIndex = 0;
    console.log(`[GOLF] Hole ${game.currentHole}: Honors to ${game.participants[honorsParticipantIndex].name}. Turn Order:`, game.golfTurnOrder.map(i => game.participants[i].name));
}

function advanceGolfTurn(game) {
    if (!game || game.gameOver) return;

    game.golfCurrentTurnOrderIndex++;

    if (game.golfCurrentTurnOrderIndex >= game.golfTurnOrder.length) {
        game.currentHole++;
        if (game.currentHole > game.numHoles) {
            game.gameOver = true;
            let bestTotalScore = Infinity;
            let winners = [];
            game.participants.forEach(p => {
                if (p.golfTotalScore < bestTotalScore) { bestTotalScore = p.golfTotalScore; winners = [p]; }
                else if (p.golfTotalScore === bestTotalScore) winners.push(p);
            });
            if (winners.length === 1) game.winner = { id: winners[0].id, name: winners[0].name, score: winners[0].golfTotalScore, type: 'team' };
            else if (winners.length > 1) game.winner = { name: `Tie (${winners.map(w => w.name).join(' & ')})`, score: bestTotalScore, type: 'tie' };
            else game.winner = { name: "No Winner", score: 0, type: 'none' };
            game.promptForGolfScore = null;
            concludeGame();
            return;
        } else {
            determineGolfHonorsAndOrder(game);
        }
    }
    
    const nextParticipantIndex = game.golfTurnOrder[game.golfCurrentTurnOrderIndex];
    if (typeof nextParticipantIndex !== 'undefined' && !game.gameOver) {
        game.promptForGolfScore = {
            participantIndex: nextParticipantIndex,
            currentHole: game.currentHole
        };
    } else if (!game.gameOver) {
        console.error("[GOLF AdvanceTurn] Could not set prompt for next turn. State:", game);
        game.gameOver = true;
        game.winner = {name: "Error: Turn order failure", type: "error"};
        concludeGame();
    }
}


// --- BASEBALL (REVAMPED for Team-Based Scoring) ---
function initializeBaseballParticipantState(participant) {
    const innings = Array(BASEBALL_NUM_INNINGS).fill(null);
    return {
        ...participant,
        baseball_total_score: 0,
        baseball_innings: innings,
    };
}

function advanceBaseballTurn(game) {
    if (!game || game.gameOver) return;

    let nextPlayerIndex = (game.currentPlayerIndex ?? -1) + 1;

    if (nextPlayerIndex >= game.participants.length) {
        game.baseball_currentInning++;
        nextPlayerIndex = 0;

        if (game.baseball_currentInning > game.BASEBALL_NUM_INNINGS) {
            game.gameOver = true;
            let highScore = -Infinity;
            let winners = [];
            game.participants.forEach(p => {
                if (p.baseball_total_score > highScore) {
                    highScore = p.baseball_total_score;
                    winners = [p];
                } else if (p.baseball_total_score === highScore) {
                    winners.push(p);
                }
            });

            if (winners.length === 1) {
                game.winner = { id: winners[0].id, name: winners[0].name, score: winners[0].baseball_total_score, type: 'team' };
            } else if (winners.length > 1) {
                game.winner = { name: `Tie (${winners.map(w => w.name).join(' & ')})`, score: highScore, type: 'tie' };
            } else {
                game.winner = { name: "No Winner", score: 0, type: 'none' };
            }
            
            game.baseball_actionPrompt = null;
            game.showKeypadForBaseball = null;
            concludeGame();
            return;
        }
    }

    game.currentPlayerIndex = nextPlayerIndex;
    
    game.baseball_actionPrompt = {
        participantIndex: game.currentPlayerIndex,
        inning: game.baseball_currentInning,
    };
    game.showKeypadForBaseball = null;
}


// --- KILLER ---
function initializeKillerParticipantState(participant) {
    return {
        ...participant,
        killer_number: null,
        killer_is_killer: false,
        killer_is_eliminated: false,
        killer_lives: KILLER_LIVES_START,
    };
}


// --- Game Mode Agnostic Start Function ---
function startNewV2Game(modeId, options = {}) {
    console.log(`[V2 Server StartGame] Attempting to start ${modeId} with options:`, options);
    if (modeId === 'KILLER') {
        console.warn("[V2 Server StartGame] KILLER mode should be started via 'startKillerGame' event, not generic 'startGame'.");
        return null;
    }

    v2CurrentGame = {
        id: uuidv4(),
        mode: modeId,
        participants: [],
        history: [],
        gameOver: false,
        winner: null,
        lastScoredInfo: null,
        ATW_OBJECTIVES_NUMBERS_MAX: ATW_OBJECTIVES_NUMBERS_MAX,
        ATW_TARGET_QUALIFY_SB: ATW_TARGET_QUALIFY_SB,
        ATW_TARGET_WIN_DB: ATW_TARGET_WIN_DB,
        ATW_LOGICAL_WIN_VIA_SB: ATW_LOGICAL_WIN_VIA_SB,
        ATW_LOGICAL_WIN_VIA_DB: ATW_LOGICAL_WIN_VIA_DB,
        ATW_MAX_SB_HITS_FOR_WIN: ATW_MAX_SB_HITS_FOR_WIN,
        showATWObjectiveSelectorModal: null,
        BASEBALL_NUM_INNINGS: options.baseballNumInnings || BASEBALL_NUM_INNINGS,
        GOLF_NUM_HOLES: options.golfNumHoles || GOLF_NUM_HOLES,
        doubleIn: modeId === 'FIVE_ZERO_ONE' ? true : (options.doubleIn || false),
        doubleOut: options.doubleOut || false,
    };

    if (modeId === 'CRICKET') {
        v2CurrentGame.objectives = JSON.parse(JSON.stringify(CRICKET_OBJECTIVES_CONFIG));
    }

    if (options.names && Array.isArray(options.names) && options.names.length > 0) {
        v2CurrentGame.participants = options.names.map((teamData, index) => {
            const baseParticipant = {
                id: teamData.id || uuidv4(),
                type: 'team',
                name: teamData.name || `Team ${index + 1}`,
                players: teamData.players || []
            };

            if (modeId === 'CRICKET') return initializeCricketParticipantState(baseParticipant);
            if (modeId === 'THREE_FF') return initializeThreeFFParticipantState(baseParticipant);
            if (modeId === 'FIVE_ZERO_ONE') return initializeFiveZeroOneParticipantState(baseParticipant);
            if (modeId === 'AROUND_THE_WORLD') return initializeAroundTheWorldParticipantState(baseParticipant);
            if (modeId === 'BEERS') return initializeBeersParticipantState(baseParticipant);
            if (modeId === 'GOLF') return initializeGolfParticipantState(baseParticipant);
            if (modeId === 'BASEBALL') return initializeBaseballParticipantState(baseParticipant);
            return {...baseParticipant, score: 0};
        });
    } else {
        const fallbackId = uuidv4();
        let fallbackParticipant = { id: `team_${fallbackId}`, type: 'team', name: 'Team 1 (Default)', players: ['Player 1'] };
        if (modeId === 'CRICKET') fallbackParticipant = initializeCricketParticipantState(fallbackParticipant);
        else if (modeId === 'THREE_FF') fallbackParticipant = initializeThreeFFParticipantState(fallbackParticipant);
        else if (modeId === 'BASEBALL') fallbackParticipant = initializeBaseballParticipantState(fallbackParticipant);
        else fallbackParticipant.score = 0;
        v2CurrentGame.participants = [fallbackParticipant];
    }

    if (v2CurrentGame.participants.length === 0) { console.error("CRITICAL: No participants initialized for", modeId); return null; }

    v2CurrentGame.currentPlayerIndex = -1;
    v2CurrentGame.currentPlayerTurnInTeam = 0;

    if (modeId === 'THREE_FF') {
        v2CurrentGame.objectives = generateThreeFFObjectives();
        v2CurrentGame.activeObjectiveIndex = 0;
        v2CurrentGame.isThreeFF = true;
        v2CurrentGame.currentPlayerIndex = 0;
        v2CurrentGame.currentPlayerTurnInTeam = 0;
        v2CurrentGame.threeFF_currentObjectiveRoundStartIndex = 0;
        v2CurrentGame.threeFF_currentObjectiveRoundStartPlayerInTeamIndex = 0;
        if (v2CurrentGame.participants.length > 0 && v2CurrentGame.objectives.length > 0) {
            const firstObjective = v2CurrentGame.objectives[0];
            v2CurrentGame.showMetMissPromptFor = {
                participantIndex: 0,
                playerInTeamIndex: 0,
                objectiveName: firstObjective.name,
                objectiveId: firstObjective.id,
                objectiveDescription: firstObjective.description
            };
        }
    } else if (modeId === 'CRICKET') {
        v2CurrentGame.isCricket = true;
        advanceTurnRR(v2CurrentGame);
        if (v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex]) v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex].dartsThrownThisTurn = 0;
    } else if (modeId === 'FIVE_ZERO_ONE') {
        v2CurrentGame.isFiveZeroOne = true;
        console.log(`[501 Game Start] DoubleIn set to: ${v2CurrentGame.doubleIn}, DoubleOut: ${v2CurrentGame.doubleOut}`);
        advanceTurnFiveZeroOne(v2CurrentGame);
    } else if (modeId === 'AROUND_THE_WORLD') {
        v2CurrentGame.isAroundTheWorld = true;
        advanceAroundTheWorldTurn_Simplified(v2CurrentGame);
    } else if (modeId === 'BEERS') {
        v2CurrentGame.beersGlobalHighLowRule = options.beersRule || 'HIGHER';
        v2CurrentGame.scoreToBeat = null;
        v2CurrentGame.isBeers = true;
        v2CurrentGame.currentPlayerIndex = -1;
        advanceBeersTurn(v2CurrentGame);
    } else if (modeId === 'GOLF') {
        v2CurrentGame.isGolf = true;
        v2CurrentGame.currentHole = 1;
        v2CurrentGame.numHoles = v2CurrentGame.GOLF_NUM_HOLES;
        determineGolfHonorsAndOrder(v2CurrentGame);
        if (v2CurrentGame.golfTurnOrder && v2CurrentGame.golfTurnOrder.length > 0 && !v2CurrentGame.gameOver) {
            const initialTurnParticipantIndex = v2CurrentGame.golfTurnOrder[0];
            const initialTeamForPrompt = v2CurrentGame.participants[initialTurnParticipantIndex];
            if (initialTeamForPrompt) {
                v2CurrentGame.promptForGolfScore = {
                    participantIndex: initialTurnParticipantIndex,
                    currentHole: v2CurrentGame.currentHole
                };
            }
        }
    } else if (modeId === 'BASEBALL') {
        v2CurrentGame.isBaseball = true;
        v2CurrentGame.baseball_currentInning = 1;
        v2CurrentGame.currentPlayerIndex = -1;
        advanceBaseballTurn(v2CurrentGame);
    }

    pushToHistory(v2CurrentGame);
    return v2CurrentGame;
}


// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log('[V2 Server] A user connected:', socket.id);

    // --- Player Management ---
    socket.on('getPersistentPlayersList', () => socket.emit('persistentPlayersList', persistentPlayersList));
    socket.on('updatePersistentPlayersList', (newList) => {
        if (Array.isArray(newList)) {
            persistentPlayersList = newList.map(p => ({ id: p.id, name: p.name }));
            saveData(PERSISTENT_PLAYERS_FILE, persistentPlayersList);
            io.emit('persistentPlayersList', persistentPlayersList);
            socket.emit('persistentPlayersUpdateStatus', { success: true, message: 'Player list updated and saved.' });
        } else {
            socket.emit('persistentPlayersUpdateStatus', { success: false, message: 'Invalid list format received.' });
        }
    });

    // --- Stats Management ---
    socket.on('requestStats', () => {
        console.log(`[Stats] Client ${socket.id} requested stats.`);
        socket.emit('statsUpdate', { sessionStats, historicalStats });
    });

    socket.on('resetSessionStats', () => {
        console.log(`[Stats] Received resetSessionStats from ${socket.id}.`);
        sessionStats = { teams: {}, players: {} };
        io.emit('statsUpdate', { sessionStats, historicalStats });
        console.log('[Stats] Session stats reset and broadcasted.');
    });

    socket.on('resetHistoricalStats', () => {
        console.log(`[Stats] Received resetHistoricalStats from ${socket.id}. Wiping all stats.`);
        sessionStats = { teams: {}, players: {} };
        historicalStats = { teams: {}, players: {} };
        saveData(STATS_FILE, historicalStats);
        io.emit('statsUpdate', { sessionStats, historicalStats });
        console.log('[Stats] All session and historical stats have been reset and broadcasted.');
    });

    socket.on('showStatsScreen', () => {
        console.log(`[V2 Server] Received showStatsScreen from controller ${socket.id}. Broadcasting.`);
        io.emit('displayStatsScreen');
    });


    // --- Game State Management ---
    socket.on('requestGameState', () => {
        if (v2CurrentGame) {
            socket.emit('gameState', v2CurrentGame);
        } else {
            socket.emit('noGameActive');
        }
    });

    socket.on('startGame', (modeId, clientOptions = {}) => {
        const gameModeId = String(modeId).toUpperCase();
        if (gameModeId === 'KILLER') {
            socket.emit('gameStartError', `For KILLER mode, please use the 'startKillerGame' event.`);
            console.warn(`[V2 Server] Client tried to start KILLER via generic 'startGame'. Sent error.`);
            return;
        }
        const newGame = startNewV2Game(gameModeId, clientOptions);
        if (newGame) {
            io.emit('gameState', newGame);
        } else {
            socket.emit('gameStartError', `Server failed to initialize ${gameModeId} game. Check server logs.`);
        }
    });

    socket.on('requestMainMenu', () => {
        console.log(`[V2 Server] Received requestMainMenu from ${socket.id}.`);
        if (v2CurrentGame) {
            console.log(`[V2 Server] Ending current game ${v2CurrentGame.id} (${v2CurrentGame.mode}) due to Main Menu request.`);
        }
        v2CurrentGame = null;
        io.emit('gameStateUpdate', null);
        io.emit('noGameActive');
    });

    socket.on('endGame', () => {
        if (v2CurrentGame) {
            console.log(`[V2 Server] Game ${v2CurrentGame.id} (${v2CurrentGame.mode}) ended by 'endGame' client request.`);
            v2CurrentGame = null;
            io.emit('gameStateUpdate', null);
            io.emit('noGameActive');
        }
    });

    socket.on('undoLastAction', () => {
        if (!v2CurrentGame || !v2CurrentGame.history || v2CurrentGame.history.length < 2) {
            console.log('[Undo] Not enough history to undo or no game active.');
            return;
        }
    
        const lastState = v2CurrentGame.history[v2CurrentGame.history.length - 1];
        if (lastState && lastState.gameOver && lastState.winner && lastState.winner.name && lastState.winner.type !== 'tie' && lastState.winner.type !== 'error' && lastState.winner.type !== 'none') {
            console.log(`[Undo] Detected undoing a game-over state. Reversing stats for winner: ${lastState.winner.name}`);
    
            const decrement = (name, category, statsObject) => {
                if (statsObject[category] && statsObject[category][name]) {
                    statsObject[category][name] = Math.max(0, statsObject[category][name] - 1);
                    if (statsObject[category][name] === 0) {
                        delete statsObject[category][name];
                    }
                }
            };
    
            const winnerData = lastState.winner;
            if (winnerData.type === 'team') {
                decrement(winnerData.name, 'teams', sessionStats);
                decrement(winnerData.name, 'teams', historicalStats);
                
                const winningTeam = lastState.participants.find(p => p.id === winnerData.id);
                if (winningTeam && winningTeam.players && Array.isArray(winningTeam.players)) {
                    winningTeam.players.forEach(playerName => {
                        if (playerName) {
                            decrement(playerName, 'players', sessionStats);
                            decrement(playerName, 'players', historicalStats);
                        }
                    });
                }
            }
    
            saveData(STATS_FILE, historicalStats);
            console.log('[Undo] Stats reversed and saved.');
            
            io.emit('statsUpdate', { sessionStats, historicalStats });
        }
    
        v2CurrentGame.history.pop();
        const prevState = v2CurrentGame.history[v2CurrentGame.history.length - 1];
        const restoredGameState = JSON.parse(JSON.stringify(prevState));
        restoredGameState.history = v2CurrentGame.history;
        v2CurrentGame = restoredGameState;
        
        console.log(`[Undo] Game ${v2CurrentGame.id} (${v2CurrentGame.mode}) rolled back. Current player: ${v2CurrentGame.currentPlayerIndex}`);
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    // --- CRICKET Handlers ---
    socket.on('cricketMark', (data) => {
        if (!v2CurrentGame || !v2CurrentGame.isCricket || v2CurrentGame.gameOver || !data) return;
        
        v2CurrentGame.lastScoredInfo = null;
        const { participantIndex, objectiveName } = data;
        const mainParticipant = v2CurrentGame.participants[participantIndex];
        const objective = CRICKET_OBJECTIVES_CONFIG.find(o => o.name === objectiveName);

        if (!mainParticipant || !objective) {
            console.warn("[CricketMark] Invalid participant or objective:", { participantIndex, objectiveName });
            return;
        }
        if (participantIndex !== v2CurrentGame.currentPlayerIndex) {
            console.warn(`[CricketMark] Mark attempt by non-current participant. Current: ${v2CurrentGame.currentPlayerIndex}, Attempted: ${participantIndex}`);
            return;
        }

        pushToHistory(v2CurrentGame);

        mainParticipant.marks[objectiveName]++;
        mainParticipant.dartsThrownThisTurn = (mainParticipant.dartsThrownThisTurn || 0) + 1;
        const newMarkCount = mainParticipant.marks[objectiveName];

        const canScoreOnObjective = v2CurrentGame.participants.some(p =>
            p.id !== mainParticipant.id && (p.marks[objectiveName] || 0) < 3
        );

        if (newMarkCount > 3 && canScoreOnObjective) {
            if (objective.isNumeric) {
                mainParticipant.score += objective.value;
                v2CurrentGame.lastScoredInfo = { participantId: mainParticipant.id, score: objective.value };
            } else if (objectiveName === 'D' || objectiveName === 'T') {
                v2CurrentGame.showKeypadFor = { 
                    participantIndex, 
                    playerInTeamIndex: v2CurrentGame.currentPlayerTurnInTeam, 
                    objectiveName 
                };
            }
        }
        
        checkCricketWinCondition(v2CurrentGame);
        io.emit('gameStateUpdate', v2CurrentGame);
    });


    socket.on('submitCricketScore', (data) => {
        if (!v2CurrentGame || !v2CurrentGame.isCricket || v2CurrentGame.gameOver || !data || !v2CurrentGame.showKeypadFor) return;
        
        v2CurrentGame.lastScoredInfo = null;
        const { score } = data;
        const { participantIndex } = v2CurrentGame.showKeypadFor;
        const mainParticipant = v2CurrentGame.participants[participantIndex];

        if (!mainParticipant || typeof score !== 'number' || score < 0) {
            v2CurrentGame.showKeypadFor = null;
            io.emit('gameStateUpdate', v2CurrentGame); return;
        }
        pushToHistory(v2CurrentGame);
        
        mainParticipant.score += score;
        v2CurrentGame.lastScoredInfo = { participantId: mainParticipant.id, score: score };

        v2CurrentGame.showKeypadFor = null;
        checkCricketWinCondition(v2CurrentGame);
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    socket.on('cancelCricketKeypad', () => {
        if (!v2CurrentGame || !v2CurrentGame.isCricket || !v2CurrentGame.showKeypadFor) return;
        pushToHistory(v2CurrentGame);
        v2CurrentGame.showKeypadFor = null;
        v2CurrentGame.lastScoredInfo = null;
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    socket.on('cricketControllerEndTurn', (data) => {
        if (!v2CurrentGame || !v2CurrentGame.isCricket || v2CurrentGame.gameOver || !data || !data.participantId) {
            console.warn("[Cricket EndTurn] Invalid request.");
            return;
        }

        v2CurrentGame.lastScoredInfo = null;
        const currentParticipantOnServer = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
        if (!currentParticipantOnServer || currentParticipantOnServer.id !== data.participantId) {
            console.warn(`[Cricket EndTurn] Request to end turn for ${data.participantId}, but server's current player is ${currentParticipantOnServer ? currentParticipantOnServer.id : 'UNKNOWN'}. Turn not ended.`);
            socket.emit('gameStateUpdate', v2CurrentGame);
            return;
        }

        pushToHistory(v2CurrentGame);
        currentParticipantOnServer.dartsThrownThisTurn = 0;

        if (!checkCricketWinCondition(v2CurrentGame)) {
            const advanced = advanceTurnRR(v2CurrentGame);
            if (advanced) {
                const nextP = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
                if (nextP) {
                    nextP.dartsThrownThisTurn = 0;
                }
            } else if (!v2CurrentGame.gameOver) {
                console.error("[Cricket EndTurn] advanceTurnRR failed but game not over. State may be inconsistent.");
            }
        }
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    // --- 3FF Handlers ---
    socket.on('threeFFObjectiveAction', (data) => {
        if (!v2CurrentGame || !v2CurrentGame.isThreeFF || v2CurrentGame.gameOver || !data || !v2CurrentGame.showMetMissPromptFor) return;
        const { action } = data;
        const { participantIndex, playerInTeamIndex, objectiveId } = v2CurrentGame.showMetMissPromptFor;
        const participant = v2CurrentGame.participants[participantIndex];
        const objective = v2CurrentGame.objectives.find(o => o.id === objectiveId);
        if (!participant || !objective ||
            participantIndex !== v2CurrentGame.currentPlayerIndex ||
            playerInTeamIndex !== v2CurrentGame.currentPlayerTurnInTeam ||
            objectiveId !== v2CurrentGame.objectives[v2CurrentGame.activeObjectiveIndex].id) {
            console.warn("[3FF Action] Mismatch or invalid state for action:", { data, showMetMissPromptFor: v2CurrentGame.showMetMissPromptFor, game: { cpI: v2CurrentGame.currentPlayerIndex, cpTIT: v2CurrentGame.currentPlayerTurnInTeam, activeObjId: v2CurrentGame.objectives[v2CurrentGame.activeObjectiveIndex].id } });
            return;
        }
        pushToHistory(v2CurrentGame);
        v2CurrentGame.showMetMissPromptFor = null;
        if (action === 'met') {
            v2CurrentGame.showKeypadFor3FF = {
                participantIndex,
                playerInTeamIndex,
                objectiveId,
                objectiveName: objective.name,
                objectiveType: objective.type,
                objectiveDescription: objective.description
            };
        } else if (action === 'missed') {
            participant.score = Math.ceil(participant.score / 2);
            participant.justHalvedScore = true;
            advanceTurnAndObjectiveThreeFF(v2CurrentGame);
        }
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('submitThreeFFScore', (data) => {
        if (!v2CurrentGame || !v2CurrentGame.isThreeFF || v2CurrentGame.gameOver || !data || !v2CurrentGame.showKeypadFor3FF) return;
        const { score } = data;
        const { participantIndex } = v2CurrentGame.showKeypadFor3FF;
        const participant = v2CurrentGame.participants[participantIndex];
        
        if (!participant || typeof score !== 'number' || score < 0) {
            v2CurrentGame.showKeypadFor3FF = null;
            const currentObjectiveForPrompt = v2CurrentGame.objectives[v2CurrentGame.activeObjectiveIndex];
            if (currentObjectiveForPrompt && !v2CurrentGame.gameOver) {
                 v2CurrentGame.showMetMissPromptFor = {
                    participantIndex: v2CurrentGame.currentPlayerIndex,
                    playerInTeamIndex: v2CurrentGame.currentPlayerTurnInTeam,
                    objectiveName: currentObjectiveForPrompt.name,
                    objectiveId: currentObjectiveForPrompt.id,
                    objectiveDescription: currentObjectiveForPrompt.description
                };
            }
            io.emit('gameStateUpdate', v2CurrentGame);
            return;
        }

        pushToHistory(v2CurrentGame);
        participant.score += score;
        v2CurrentGame.showKeypadFor3FF = null;
        advanceTurnAndObjectiveThreeFF(v2CurrentGame);
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('cancelThreeFFKeypad', () => {
        if (!v2CurrentGame || !v2CurrentGame.isThreeFF || !v2CurrentGame.showKeypadFor3FF) return;
        pushToHistory(v2CurrentGame);
        const { participantIndex, playerInTeamIndex, objectiveId, objectiveName, objectiveDescription } = v2CurrentGame.showKeypadFor3FF;
        v2CurrentGame.showKeypadFor3FF = null;
        v2CurrentGame.showMetMissPromptFor = { participantIndex, playerInTeamIndex, objectiveId, objectiveName, objectiveDescription };
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    // --- 501 Handlers ---
    socket.on('fiveZeroOneTurnAction', (data) => {
        if (!v2CurrentGame || !v2CurrentGame.isFiveZeroOne || v2CurrentGame.gameOver || !data || !v2CurrentGame.showFiveZeroOneActionPrompt) return;
        const { action } = data;
        const participant = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
        if (!participant) return;
        pushToHistory(v2CurrentGame);
        v2CurrentGame.bustMessage = null;
        if (action === 'score_counts') {
            v2CurrentGame.showKeypadForFiveZeroOne = { participantIndex: v2CurrentGame.currentPlayerIndex, playerInTeamIndex: v2CurrentGame.currentPlayerTurnInTeam };
            v2CurrentGame.showFiveZeroOneActionPrompt = false;
        }
        else if (action === 'no_score') {
            participant.dartsThrownThisTurnCount = 3;
            participant.lastTurnScore = 0;
            advanceTurnFiveZeroOne(v2CurrentGame);
        }
        else if (action === 'bust_acknowledged') {
            advanceTurnFiveZeroOne(v2CurrentGame);
        }
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('submitFiveZeroOneScore', (data) => {
        const canSubmitDueToKeypad = v2CurrentGame && v2CurrentGame.showKeypadForFiveZeroOne &&
                                     v2CurrentGame.showKeypadForFiveZeroOne.participantIndex === v2CurrentGame.currentPlayerIndex;
        const canSubmitDueToActionPrompt = v2CurrentGame && v2CurrentGame.showFiveZeroOneActionPrompt;
        if (!v2CurrentGame || !v2CurrentGame.isFiveZeroOne || v2CurrentGame.gameOver || !data ||
            !(canSubmitDueToKeypad || canSubmitDueToActionPrompt) ) {
            if (v2CurrentGame && v2CurrentGame.isFiveZeroOne && !v2CurrentGame.gameOver) {
                v2CurrentGame.showKeypadForFiveZeroOne = null;
                v2CurrentGame.showFiveZeroOneActionPrompt = true;
                io.emit('gameStateUpdate', v2CurrentGame);
            }
            return;
        }
        let { score } = data;
        const participant = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
        if (!participant) {
             if (v2CurrentGame && v2CurrentGame.isFiveZeroOne && !v2CurrentGame.gameOver) {
                v2CurrentGame.showKeypadForFiveZeroOne = null;
                v2CurrentGame.showFiveZeroOneActionPrompt = true;
                io.emit('gameStateUpdate', v2CurrentGame);
            }
            return;
        }
        if (typeof score !== 'number' || score < 0 || score > 180) {
            v2CurrentGame.showKeypadForFiveZeroOne = null;
            v2CurrentGame.showFiveZeroOneActionPrompt = true;
            io.emit('gameStateUpdate', v2CurrentGame); return;
        }
        pushToHistory(v2CurrentGame);
        if (!participant.isDoubledIn && score > 0 && v2CurrentGame.doubleIn) {
            participant.isDoubledIn = true;
        }
        if ((v2CurrentGame.doubleIn && participant.isDoubledIn) || !v2CurrentGame.doubleIn) {
            participant.score -= score;
        } else if (v2CurrentGame.doubleIn && !participant.isDoubledIn && score > 0) {
            // Score does not count
        }
        participant.dartsThrownThisTurnCount += 3;
        participant.lastTurnScore = score;
        let isBust = false;
        if (participant.score < 0 || participant.score === 1) {
            isBust = true;
        }
        if (participant.score === 0) {
            if (v2CurrentGame.doubleOut) {
                v2CurrentGame.gameOver = true;
                v2CurrentGame.winner = { id: participant.id, name: participant.name, score: 0, type: 'team' };
                concludeGame();
            } else {
                v2CurrentGame.gameOver = true;
                v2CurrentGame.winner = { id: participant.id, name: participant.name, score: 0, type: 'team' };
                concludeGame();
            }
        } else if (participant.score < 2 && v2CurrentGame.doubleOut) {
             isBust = true;
        }
        if (isBust) {
            participant.score = participant.previousScoreThisTurn;
            v2CurrentGame.bustMessage = `BUST! ${participant.name} reverts to ${participant.score}.`;
        }
        v2CurrentGame.showKeypadForFiveZeroOne = null;
        if (!v2CurrentGame.gameOver && !isBust) {
            advanceTurnFiveZeroOne(v2CurrentGame);
        } else if (isBust) {
            v2CurrentGame.showFiveZeroOneActionPrompt = true;
        } else if (v2CurrentGame.gameOver) {
            v2CurrentGame.showFiveZeroOneActionPrompt = false;
        }
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('cancelFiveZeroOneKeypad', () => {
        if (!v2CurrentGame || !v2CurrentGame.isFiveZeroOne || !v2CurrentGame.showKeypadForFiveZeroOne) return;
        pushToHistory(v2CurrentGame);
        v2CurrentGame.showKeypadForFiveZeroOne = null;
        v2CurrentGame.showFiveZeroOneActionPrompt = true;
        v2CurrentGame.bustMessage = null;
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    // --- AROUND THE WORLD Socket Handlers ---
    socket.on('aroundTheWorldClientRequestsObjectiveModal', () => {
        if (!v2CurrentGame || !v2CurrentGame.isAroundTheWorld || v2CurrentGame.gameOver) return;
        const participant = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
        if (!participant || participant.atw_isWinner) return;
        if (!v2CurrentGame.showAroundTheWorldActionPrompt || v2CurrentGame.showAroundTheWorldActionPrompt.participantIndex !== v2CurrentGame.currentPlayerIndex) return;
        pushToHistory(v2CurrentGame);
        v2CurrentGame.showATWObjectiveSelectorModal = {
            participantIndex: v2CurrentGame.currentPlayerIndex,
            playerInTeamIndex: v2CurrentGame.currentPlayerTurnInTeam,
            currentTargetValue: participant.atw_currentTargetValue
        };
        v2CurrentGame.showAroundTheWorldActionPrompt = null;
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    socket.on('aroundTheWorldTurnResult', (data) => {
        if (!v2CurrentGame || !v2CurrentGame.isAroundTheWorld || v2CurrentGame.gameOver || !data || typeof data.reportedValue === 'undefined') {
            return;
        }
    
        const { reportedValue } = data;
        const participant = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
    
        const isActionFromModal = v2CurrentGame.showATWObjectiveSelectorModal && v2CurrentGame.showATWObjectiveSelectorModal.participantIndex === v2CurrentGame.currentPlayerIndex;
        const isActionFromMainPromptAsMiss = (reportedValue === ATW_REPORTED_VALUE_MISS) && v2CurrentGame.showAroundTheWorldActionPrompt && v2CurrentGame.showAroundTheWorldActionPrompt.participantIndex === v2CurrentGame.currentPlayerIndex;
    
        if (!isActionFromModal && !isActionFromMainPromptAsMiss) {
            console.warn("[ATW TurnResult] Received in an invalid state.");
            return;
        }
    
        if (!participant || participant.atw_isWinner) {
            return;
        }
    
        pushToHistory(v2CurrentGame);
    
        const oldTargetForLog = participant.atw_currentTargetValue;
        let logMessage = "";
        const isBullHit = reportedValue === ATW_REPORTED_VALUE_SB || reportedValue === ATW_REPORTED_VALUE_DB;
    
        if (isBullHit) {
            participant.atw_has_hit_sb_this_game = true;
            participant.atw_sb_hit_count = (participant.atw_sb_hit_count || 0) + 1;
    
            // If they were on a number, hitting a bull advances them past all numbers.
            if (oldTargetForLog <= ATW_OBJECTIVES_NUMBERS_MAX) {
                participant.atw_currentTargetValue = ATW_TARGET_WIN_DB;
            }
    
            if (participant.atw_sb_hit_count >= ATW_MAX_SB_HITS_FOR_WIN) {
                participant.atw_isWinner = true;
                participant.atw_currentTargetValue = ATW_LOGICAL_WIN_VIA_SB;
                logMessage = `Hit Bull, reaching ${participant.atw_sb_hit_count} SBs - Player Wins!`;
            } else if (reportedValue === ATW_REPORTED_VALUE_DB && oldTargetForLog >= ATW_TARGET_QUALIFY_SB) {
                participant.atw_isWinner = true;
                participant.atw_currentTargetValue = ATW_LOGICAL_WIN_VIA_DB;
                logMessage = `Hit DB while qualified - Player Wins!`;
            } else {
                logMessage = `Hit ${getAtwReportedHitDisplay(reportedValue)}. Next: ${getAtwDisplayTarget(participant.atw_currentTargetValue)}. (SBs: ${participant.atw_sb_hit_count})`;
            }
        } else if (reportedValue >= 1 && reportedValue <= ATW_OBJECTIVES_NUMBERS_MAX) {
            if (reportedValue >= oldTargetForLog) {
                participant.atw_currentTargetValue = reportedValue + 1;
                if (participant.atw_currentTargetValue > ATW_OBJECTIVES_NUMBERS_MAX) {
                     participant.atw_currentTargetValue = participant.atw_has_hit_sb_this_game ? ATW_TARGET_WIN_DB : ATW_TARGET_QUALIFY_SB;
                }
                logMessage = `Hit ${reportedValue}. Next: ${getAtwDisplayTarget(participant.atw_currentTargetValue)}.`;
            } else {
                logMessage = `Hit ${reportedValue} (Target: ${getAtwDisplayTarget(oldTargetForLog)}). No advance.`;
            }
        } else if (reportedValue === ATW_REPORTED_VALUE_MISS) {
            logMessage = `Missed (Target: ${getAtwDisplayTarget(oldTargetForLog)}).`;
        }
    
        if (logMessage) {
            participant.atw_hitsLog.push({ display: logMessage });
        }
    
        v2CurrentGame.showATWObjectiveSelectorModal = null;
    
        if (participant.atw_isWinner) {
            checkAroundTheWorldWinCondition(v2CurrentGame, participant);
        }
        
        if (!v2CurrentGame.gameOver) {
            // A turn always ends unless it was an SB hit that didn't result in a win.
            if (isBullHit && !participant.atw_isWinner) {
                const currentP = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
                v2CurrentGame.showAroundTheWorldActionPrompt = { 
                     participantIndex: v2CurrentGame.currentPlayerIndex, 
                     playerInTeamIndex: v2CurrentGame.currentPlayerTurnInTeam, 
                     currentTargetForDisplay: currentP.atw_currentTargetValue 
                };
            } else {
                 advanceAroundTheWorldTurn_Simplified(v2CurrentGame);
            }
        }
    
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    socket.on('aroundTheWorldCancelObjectiveEntry', () => {
        if (!v2CurrentGame || !v2CurrentGame.isAroundTheWorld || !v2CurrentGame.showATWObjectiveSelectorModal) return;
        pushToHistory(v2CurrentGame);
        const participant = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
        const { participantIndex, playerInTeamIndex } = v2CurrentGame.showATWObjectiveSelectorModal;
        v2CurrentGame.showATWObjectiveSelectorModal = null;
        if (participant && !participant.atw_isWinner && !v2CurrentGame.gameOver &&
            participantIndex === v2CurrentGame.currentPlayerIndex &&
            playerInTeamIndex === v2CurrentGame.currentPlayerTurnInTeam) {
            v2CurrentGame.showAroundTheWorldActionPrompt = { participantIndex: participantIndex, playerInTeamIndex: playerInTeamIndex, currentTargetForDisplay: participant.atw_currentTargetValue };
        } else if (!v2CurrentGame.gameOver) {
            advanceAroundTheWorldTurn_Simplified(v2CurrentGame);
        }
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    // --- BEERS Handlers ---
    socket.on('beersRequestScoreEntry', () => {
        if (!v2CurrentGame || !v2CurrentGame.isBeers || v2CurrentGame.gameOver || !v2CurrentGame.promptForPlayerAction) return;
        const participant = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
        if (!participant || participant.isEliminated) return;
        pushToHistory(v2CurrentGame);
        v2CurrentGame.showKeypadForBeers = { participantIndex: v2CurrentGame.currentPlayerIndex, isSettingInitialScore: v2CurrentGame.scoreToBeat === null };
        v2CurrentGame.promptForPlayerAction = null;
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('beersSubmitScore', (data) => {
        if (!v2CurrentGame || !v2CurrentGame.isBeers || v2CurrentGame.gameOver || !data || !v2CurrentGame.showKeypadForBeers) return;
        const { score } = data;
        const participant = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
        const currentPlayerOriginalIndex = v2CurrentGame.currentPlayerIndex;
        if (!participant || typeof score !== 'number' || score < 0 || score > 180) {
            v2CurrentGame.showKeypadForBeers = null;
            v2CurrentGame.promptForPlayerAction = { participantIndex: v2CurrentGame.currentPlayerIndex };
            io.emit('gameStateUpdate', v2CurrentGame); return;
        }
        pushToHistory(v2CurrentGame);
        participant.lastScore = score;
        let takeLetter = false;
        if (v2CurrentGame.scoreToBeat !== null) {
            if (v2CurrentGame.beersGlobalHighLowRule === 'HIGHER' && score <= v2CurrentGame.scoreToBeat) takeLetter = true;
            else if (v2CurrentGame.beersGlobalHighLowRule === 'LOWER' && score >= v2CurrentGame.scoreToBeat) takeLetter = true;
        }
        v2CurrentGame.scoreToBeat = score;
        v2CurrentGame.showKeypadForBeers = null;
        if (takeLetter) {
            participant.lettersGiven.push(BEERS_LETTERS[participant.lettersGiven.length % BEERS_LETTERS.length]);
            if (participant.lettersGiven.length >= BEERS_LETTERS.length) participant.isEliminated = true;
            v2CurrentGame.promptToTakeLetter = { participantIndex: currentPlayerOriginalIndex, letter: participant.lettersGiven[participant.lettersGiven.length -1]};
        } else if (!v2CurrentGame.gameOver) {
            advanceBeersTurn(v2CurrentGame);
        }
        const activePlayers = v2CurrentGame.participants.filter(p => !p.isEliminated);
        if (activePlayers.length <= 1 && !v2CurrentGame.gameOver) {
            v2CurrentGame.gameOver = true;
            if (activePlayers.length === 1) {
                v2CurrentGame.winner = { 
                    id: activePlayers[0].id, 
                    name: activePlayers[0].name, 
                    score: activePlayers[0].lettersGiven.length, 
                    type: 'team' 
                };
            } else {
                 v2CurrentGame.winner = { name: "No Winner", score: 0, type: 'none' };
            }
            v2CurrentGame.promptForPlayerAction = null; 
            v2CurrentGame.promptToTakeLetter = null;
            concludeGame();
        }
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('beersCancelScoreEntry', () => {
        if (!v2CurrentGame || !v2CurrentGame.isBeers || !v2CurrentGame.showKeypadForBeers) return;
        pushToHistory(v2CurrentGame);
        v2CurrentGame.showKeypadForBeers = null;
        v2CurrentGame.promptForPlayerAction = { participantIndex: v2CurrentGame.currentPlayerIndex };
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('beersAcknowledgeLetter', () => {
        if (v2CurrentGame && v2CurrentGame.isBeers && v2CurrentGame.promptToTakeLetter) {
            pushToHistory(v2CurrentGame);
            v2CurrentGame.promptToTakeLetter = null;
            if (!v2CurrentGame.gameOver) advanceBeersTurn(v2CurrentGame);
            io.emit('gameStateUpdate', v2CurrentGame);
        }
    });

    // --- GOLF Handlers ---
    socket.on('golfRequestScoreEntry', () => {
        if (!v2CurrentGame || !v2CurrentGame.isGolf || v2CurrentGame.gameOver || !v2CurrentGame.promptForGolfScore) return;
        
        const currentTurnParticipantIndex = v2CurrentGame.golfTurnOrder[v2CurrentGame.golfCurrentTurnOrderIndex];
        if (v2CurrentGame.promptForGolfScore.participantIndex !== currentTurnParticipantIndex) return;
        
        pushToHistory(v2CurrentGame);
        v2CurrentGame.showKeypadForGolf = {
            participantIndex: currentTurnParticipantIndex,
            currentHole: v2CurrentGame.currentHole
        };
        v2CurrentGame.promptForGolfScore = null;
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('golfSubmitScore', (data) => {
        if (!v2CurrentGame || !v2CurrentGame.isGolf || v2CurrentGame.gameOver || !v2CurrentGame.showKeypadForGolf) return;
        
        const currentTurnParticipantIndex = v2CurrentGame.golfTurnOrder[v2CurrentGame.golfCurrentTurnOrderIndex];
        if (v2CurrentGame.showKeypadForGolf.participantIndex !== currentTurnParticipantIndex) return;

        const { score } = data;
        const { participantIndex, currentHole } = v2CurrentGame.showKeypadForGolf;
        const participant = v2CurrentGame.participants[participantIndex];
        if (!participant || typeof score !== 'number' || score < 1 || score > 6) {
            v2CurrentGame.showKeypadForGolf = null;
            v2CurrentGame.promptForGolfScore = { participantIndex, currentHole };
            io.emit('gameStateUpdate', v2CurrentGame); return;
        }
        pushToHistory(v2CurrentGame);
        
        participant.golfScores[currentHole - 1] = score;
        participant.golfTotalScore = participant.golfScores.reduce((sum, s) => sum + (s || 0), 0);
        
        v2CurrentGame.showKeypadForGolf = null;
        advanceGolfTurn(v2CurrentGame);
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('golfCancelScoreEntry', () => {
        if (!v2CurrentGame || !v2CurrentGame.isGolf || !v2CurrentGame.showKeypadForGolf) return;
        pushToHistory(v2CurrentGame);
        const { participantIndex, currentHole } = v2CurrentGame.showKeypadForGolf;
        v2CurrentGame.showKeypadForGolf = null;
        v2CurrentGame.promptForGolfScore = { participantIndex, currentHole };
        io.emit('gameStateUpdate', v2CurrentGame);
    });

    // --- BASEBALL Handlers (REVAMPED for team-based inning scores) ---
    socket.on('baseballRequestScoreEntry', () => {
        if (v2CurrentGame && v2CurrentGame.isBaseball && v2CurrentGame.baseball_actionPrompt) {
            pushToHistory(v2CurrentGame);
            v2CurrentGame.showKeypadForBaseball = {
                participantIndex: v2CurrentGame.currentPlayerIndex,
                inning: v2CurrentGame.baseball_currentInning,
            };
            v2CurrentGame.baseball_actionPrompt = null;
            io.emit('gameStateUpdate', v2CurrentGame);
        }
    });

    socket.on('baseballSubmitInningScore', ({ score }) => {
        if (!v2CurrentGame || !v2CurrentGame.isBaseball || v2CurrentGame.gameOver || !v2CurrentGame.showKeypadForBaseball || typeof score !== 'number') {
            return;
        }
        
        const participant = v2CurrentGame.participants[v2CurrentGame.currentPlayerIndex];
        const currentInningIndex = v2CurrentGame.baseball_currentInning - 1;

        if (!participant || v2CurrentGame.showKeypadForBaseball.participantIndex !== v2CurrentGame.currentPlayerIndex) {
            console.warn('[BASEBALL] Score submitted by wrong team or in an invalid state.');
            return;
        }

        pushToHistory(v2CurrentGame);
        
        participant.baseball_innings[currentInningIndex] = score;
        participant.baseball_total_score = participant.baseball_innings.reduce((total, inn_score) => total + (inn_score || 0), 0);

        v2CurrentGame.showKeypadForBaseball = null;
        advanceBaseballTurn(v2CurrentGame);

        io.emit('gameStateUpdate', v2CurrentGame);
    });

    socket.on('baseballCancelKeypad', () => {
        if (v2CurrentGame && v2CurrentGame.isBaseball && v2CurrentGame.showKeypadForBaseball) {
            pushToHistory(v2CurrentGame);
            v2CurrentGame.showKeypadForBaseball = null;
            v2CurrentGame.baseball_actionPrompt = {
                participantIndex: v2CurrentGame.currentPlayerIndex,
                inning: v2CurrentGame.baseball_currentInning,
            };
            io.emit('gameStateUpdate', v2CurrentGame);
        }
    });


    // --- KILLER (Live, No Turn) - Reworked Logic ---
    socket.on('startKillerGame', ({ players }) => {
        if (!players || !Array.isArray(players) || players.length === 0) {
            socket.emit('gameStartError', 'Cannot start Killer game: Invalid player data.');
            return;
        }
        v2CurrentGame = {
            id: uuidv4(),
            mode: 'KILLER',
            participants: players.map(p => ({
                id: p.id || uuidv4(),
                name: p.name || `Player ${uuidv4().substring(0,4)}`,
                type: 'team',
                players: p.players || [p.name],
                killer_number: null,
                killer_is_killer: false,
                killer_is_eliminated: false,
                killer_lives: KILLER_LIVES_START,
            })),
            KILLER_NUMBERS_TO_CHOOSE_FROM,
            KILLER_LIVES_START,
            history: [],
            gameOver: false,
            winner: null,
        };
        pushToHistory(v2CurrentGame);
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('killerChooseNumber', ({ playerId, chosenNumber }) => {
        if (!v2CurrentGame || v2CurrentGame.mode !== 'KILLER' || v2CurrentGame.gameOver) {
            return;
        }
        const player = v2CurrentGame.participants.find(p => p.id === playerId);
        if (!player) {
            return;
        }
        if (player.killer_number) {
             socket.emit('killerError', `You have already chosen number ${player.killer_number}.`);
             return;
        }
        if (v2CurrentGame.participants.some(p => p.killer_number === chosenNumber)) {
            socket.emit('killerError', `Number ${chosenNumber} is already taken.`);
            return;
        }
        if (!KILLER_NUMBERS_TO_CHOOSE_FROM.includes(chosenNumber)) {
            socket.emit('killerError', `Invalid number ${chosenNumber}. Please choose from 1-20.`);
            return;
        }
        pushToHistory(v2CurrentGame);
        player.killer_number = chosenNumber;
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('killerBecomeKiller', ({ playerId }) => {
        if (!v2CurrentGame || v2CurrentGame.mode !== 'KILLER' || v2CurrentGame.gameOver) {
            return;
        }
        const player = v2CurrentGame.participants.find(p => p.id === playerId);
        if (!player) {
            return;
        }
        if (!player.killer_number) {
            socket.emit('killerError', 'You must choose a number first.');
            return;
        }
        if (player.killer_is_killer) {
            return;
        }
        if (player.killer_is_eliminated) {
            socket.emit('killerError', 'Eliminated players cannot become killers.');
            return;
        }
        const allNumbersChosen = v2CurrentGame.participants.every(p => p.killer_number !== null);
        if (!allNumbersChosen) {
            socket.emit('killerError', 'All players must choose a number before anyone can become a Killer.');
            return;
        }
        pushToHistory(v2CurrentGame);
        player.killer_is_killer = true;
        io.emit('gameStateUpdate', v2CurrentGame);
    });
    socket.on('killerRemoveLife', ({ fromPlayerId, targetPlayerId }) => {
        if (!v2CurrentGame || v2CurrentGame.mode !== 'KILLER' || v2CurrentGame.gameOver) {
            return;
        }
        const target = v2CurrentGame.participants.find(p => p.id === targetPlayerId);
        if (!target) {
            socket.emit('killerError', 'Target player not found.');
            return;
        }
        if (target.killer_is_eliminated) {
            socket.emit('killerError', `${target.name} is already eliminated.`);
            return;
        }
        if (target.killer_lives <= 0) {
            target.killer_is_eliminated = true;
            io.emit('gameStateUpdate', v2CurrentGame);
            return;
        }
        let actionAuthorized = false;
        if (fromPlayerId === CONTROLLER_DEVICE_ACTION_ID) {
            const anyActiveKillerExists = v2CurrentGame.participants.some(p => p.killer_is_killer && !p.killer_is_eliminated);
            if (anyActiveKillerExists) {
                actionAuthorized = true;
            } else {
                socket.emit('killerError', 'Action requires an active killer in the game.');
                return;
            }
        } else {
            const fromPlayer = v2CurrentGame.participants.find(p => p.id === fromPlayerId);
            if (!fromPlayer) {
                socket.emit('killerError', 'Attacker player not found.');
                return;
            }
            if (!fromPlayer.killer_is_killer) {
                socket.emit('killerError', 'Only Killers can remove lives.');
                return;
            }
            if (fromPlayer.killer_is_eliminated) {
                socket.emit('killerError', 'Eliminated players cannot act.');
                return;
            }
            actionAuthorized = true;
        }
        if (!actionAuthorized) {
            socket.emit('killerError', 'Action not authorized.');
            return;
        }
        if (fromPlayerId !== CONTROLLER_DEVICE_ACTION_ID && fromPlayerId === targetPlayerId) {
            socket.emit('killerError', 'You cannot target yourself to remove a life.');
            return;
        }
        pushToHistory(v2CurrentGame);
        target.killer_lives -= 1;
        if (target.killer_lives <= 0) {
            target.killer_is_eliminated = true;
            target.killer_is_killer = false;
        }
        const alivePlayers = v2CurrentGame.participants.filter(p => !p.killer_is_eliminated);
        if (alivePlayers.length === 1) {
            v2CurrentGame.gameOver = true;
            v2CurrentGame.winner = { id: alivePlayers[0].id, name: alivePlayers[0].name, type: 'team' };
            concludeGame();
        } else if (alivePlayers.length === 0) {
            v2CurrentGame.gameOver = true;
            v2CurrentGame.winner = { name: "Draw - All players eliminated", type: "tie" };
            concludeGame();
        }
        io.emit('gameStateUpdate', v2CurrentGame);
    });


    socket.on('disconnect', () => {
        console.log('[V2 Server] User disconnected:', socket.id);
    });
});

server.listen(V2_PORT, '0.0.0.0', () => {
    console.log(`[V2 Server] Darts V2 development server listening on all interfaces at port ${V2_PORT}`);
});

