// 501.js - 501 Game Component - Arcade Styling Update
// REVAMPED: Added WinTracker component definition.
// ENHANCED: Overhauled visuals for a more dynamic, arcade feel and added a "Current Thrower" pop-up.
// POLISHED: Increased optimal out font size, removed redundant title, and implemented a central pop-up with directional arrows.
// FIX: Adjusted team name alignment to avoid being obscured by the current player pop-up.

// --- Helper Component: WinTracker ---
const WinTracker = ({ name, type, sessionStats }) => {
    if (!sessionStats || !name) return null;
    const wins = (type === 'team' ? sessionStats.teams?.[name] : sessionStats.players?.[name]) || 0;
    if (wins === 0) return null;
    return React.createElement('span', {
        className: "text-yellow-400 ml-3 text-3xl tracking-wide",
        title: `${wins} session win${wins > 1 ? 's' : ''}`
    }, '🏆'.repeat(wins));
};

// --- Helper Component: Central Thrower Pop-up ---
const FiveZeroOneCurrentThrowerPopup = ({ throwerName, teamName, colorTheme, position, totalColumns }) => {
    if (!throwerName) return null;

    let arrow = null;
    const colIndex = position % totalColumns;

    // Determine arrow direction based on column position
    if (totalColumns > 1) {
        if (colIndex === 0) { // First column
            arrow = '◄';
        } else if (colIndex === totalColumns - 1) { // Last column
            arrow = '►';
        } else { // Middle columns
            arrow = '▼';
        }
    }

    return React.createElement('div', {
        className: 'absolute top-2 left-1/2 -translate-x-1/2 w-full max-w-lg z-20 pointer-events-none animate-fade-in-pop'
    },
        React.createElement('div', {
            className: `p-3 bg-black/70 backdrop-blur-sm rounded-xl border-2 ${colorTheme.border} shadow-2xl`
        },
            React.createElement('div', { className: 'flex items-center justify-center gap-4' },
                arrow && React.createElement('div', { className: `text-6xl font-bold ${colorTheme.text}` }, arrow),
                React.createElement('div', { className: 'text-center' },
                    React.createElement('p', { className: "text-slate-200 text-2xl" }, teamName),
                    React.createElement('p', { className: "text-sky-300 text-6xl font-bold" }, throwerName)
                ),
                arrow && React.createElement('div', { className: `text-6xl font-bold ${colorTheme.text}` }, arrow),
            )
        )
    );
};


const FIVE_ZERO_ONE_CHECKOUT_CHART = {
    170: "T20, T20, Bull", 167: "T20, T19, Bull", 164: "T20, T18, Bull", 161: "T20, T17, Bull",
    160: "T20, T20, D20", 158: "T20, T20, D19", 157: "T20, T19, D20", 156: "T20, T20, D18",
    155: "T20, T19, D19", 154: "T20, T18, D20", 153: "T20, T19, D18", 152: "T20, T20, D16",
    151: "T20, T17, D20", 150: "T20, T20, D15", 149: "T20, T19, D16", 148: "T20, T16, D20",
    147: "T20, T17, D18", 146: "T20, T18, D16", 145: "T20, T15, D20", 144: "T20, T20, D12",
    143: "T20, T17, D16", 142: "T20, T14, D20", 141: "T20, T19, D12", 140: "T20, T20, D10",
    139: "T19, T14, D20", 138: "T20, T18, D12", 137: "T19, T20, D10", 136: "T20, T20, D8",
    135: "T20, T17, D12", 134: "T20, T14, D16", 133: "T20, T19, D8", 132: "T20, T16, D12",
    131: "T20, T13, D16", 130: "T20, T20, D5", 129: "T19, T16, D12", 128: "T18, T14, D16",
    127: "T20, T17, D8", 126: "T19, T19, D6", 125: "Bull, T20, D20",
    124: "T20, S16, D20", 123: "T19, T16, D9", 122: "T18, T20, D4",
    121: "T20, T11, D14", 120: "T20, S20, D20", 119: "T19, S12, D20",
    118: "T20, S18, D20", 117: "T20, S17, D20", 116: "T20, S16, D20",
    115: "T20, S15, D20", 114: "T20, S14, D20", 113: "T19, S16, D20",
    112: "T20, S12, D20", 111: "T19, S14, D20", 110: "T20, Bull",
    109: "T19, S12, D20", 108: "T20, S16, D16", 107: "T19, Bull",
    106: "T20, S10, D18", 105: "T20, S13, D16", 104: "T18, S10, D20",
    103: "T19, S6, D20", 102: "T20, S10, D16", 101: "T17, Bull",
    100: "T20, D20", 99: "T19, D20", 98: "T20, D19", 97: "T19, D20", 96: "T20, D18",
    95: "T19, D19", 94: "T18, D20", 93: "T19, D18", 92: "T20, D16", 91: "T17, D20",
    90: "T20, D15", 89: "T19, D16", 88: "T20, D14", 87: "T17, D18", 86: "T18, D16",
    85: "T15, D20", 84: "T20, D12", 83: "T17, D16", 82: "T14, D20",
    81: "T19, D12", 80: "T20, D10", 79: "T13, D20", 78: "T18, D12", 77: "T15, D16",
    76: "T20, D8", 75: "T17, D12", 74: "T14, D16", 73: "T19, D8", 72: "T16, D12",
    71: "T13, D16", 70: "T10, D20", 69: "T19, D6",  68: "T20, D4",
    67: "T17, D8", 66: "T10, D18", 65: "T19, D4",  64: "T16, D8",
    63: "T13, D12", 62: "T10, D16", 61: "T15, D8", 60: "S20, D20",
    59: "S19, D20", 58: "S18, D20", 57: "S17, D20", 56: "S16, D20",
    55: "S15, D20", 54: "S14, D20", 53: "S13, D20", 52: "S12, D20",
    51: "S19, D16", 50: "Bull", 49: "S9, D20", 48: "S16, D16",
    47: "S15, D16", 46: "S6, D20", 45: "S13, D16", 44: "S4, D20",
    43: "S3, D20", 42: "S10, D16", 41: "S9, D16", 40: "D20",
    39: "S7, D16", 38: "D19", 37: "S5, D16", 36: "D18", 35: "S3, D16",
    34: "D17", 33: "S1, D16", 32: "D16", 31: "S15, D8", 30: "D15",
    29: "S13, D8", 28: "D14", 27: "S11, D8", 26: "D13", 25: "S9, D8",
    24: "D12", 23: "S7, D8", 22: "D11", 21: "S5, D8", 20: "D10",
    19: "S3, D8", 18: "D9", 17: "S1, D8", 16: "D8", 15: "S7, D4", 14: "D7",
    13: "S5, D4", 12: "D6", 11: "S3, D4", 10: "D5", 9: "S1, D4", 8: "D4",
    7: "S3, D2", 6: "D3", 5: "S1, D2", 4: "D2", 3: "S1, D1", 2: "D1"
};
const BOGEY_NUMBERS_501 = [169, 168, 166, 165, 163, 162, 159];
const FIVE_ZERO_ONE_START_SCORE_CONST = 501;

// Icons
const ICON_LEADER = "🏆";
const ICON_DART_TARGET = "🎯";
const ICON_MISS_SHRUG = "🤷";
const ICON_UNDO = "↩️";
const ICON_DOUBLE_IN_WARN = "⚠️";
const ICON_GAME_SHOT = "🎉";
const ICON_NEXT_PLAYER_OK = "✅";

// Player specific background colors
const PLAYER_COLORS = [
    { bg: 'from-red-800 to-red-900', border: 'border-red-500', text: 'text-red-200' },
    { bg: 'from-blue-800 to-blue-900', border: 'border-blue-500', text: 'text-blue-200' },
    { bg: 'from-green-800 to-green-900', border: 'border-green-500', text: 'text-green-200' },
    { bg: 'from-cyan-800 to-cyan-900', border: 'border-cyan-500', text: 'text-cyan-200' },
    { bg: 'from-purple-800 to-purple-900', border: 'border-purple-500', text: 'text-purple-200' },
    { bg: 'from-pink-800 to-pink-900', border: 'border-pink-500', text: 'text-pink-200' },
    { bg: 'from-teal-800 to-teal-900', border: 'border-teal-500', text: 'text-teal-200' },
    { bg: 'from-orange-800 to-orange-900', border: 'border-orange-500', text: 'text-orange-200' }
];


const FiveZeroOneGame = ({ gameMode, onGameEnd, socket, gameState, displayRole, sessionStats }) => {
    
    // --- 1. Initial Game State Validation ---
    if (!gameState || typeof gameState !== 'object' || gameState.mode !== 'FIVE_ZERO_ONE' || !Array.isArray(gameState.participants)) {
        console.error("FiveZeroOneGame: Invalid or incomplete gameState", gameState);
        return React.createElement('div', { className: "p-8 text-center text-red-500 text-2xl sm:text-3xl" }, "Loading 501 Game State or Invalid State...");
    }

    // --- 3. Destructure Game State Properties ---
    const {
        participants = [],
        currentPlayerIndex,
        currentPlayerTurnInTeam,
        showFiveZeroOneActionPrompt,
        showKeypadForFiveZeroOne,
        bustMessage,
        history,
        doubleIn,
        doubleOut
    } = gameState;

    // --- 4. Current Player and Undo Logic ---
    const currentParticipant = participants[currentPlayerIndex];
    const canUndo = history && Array.isArray(history) && history.length > 1 && !showKeypadForFiveZeroOne && !bustMessage;

    // --- 5. Helper Functions ---
    const getPlayerDisplayName = React.useCallback((participant, teamMemberIndex) => {
        if (!participant) return "N/A";
        let name = participant.name || `Team ${participants.findIndex(p => p.id === participant.id) + 1}`;
        if (participant.players && typeof teamMemberIndex === 'number' && participant.players[teamMemberIndex]) {
            name += ` (${participant.players[teamMemberIndex]})`;
        }
        return name;
    }, [participants]);

    const getCheckoutSuggestion = React.useCallback((score) => {
        if (score <= 1 || score > 170 || BOGEY_NUMBERS_501.includes(score)) {
            if (score > 1 && score <= 40 && score % 2 === 0) return `D${score / 2}`;
            if (score === 50) return "Bull";
            return "NO_STANDARD_OUT";
        }
        return FIVE_ZERO_ONE_CHECKOUT_CHART[score] || "CONSIDER_SETUP";
    }, []);

    // --- 6. Event Handlers ---
    const handleKeypadSubmit = (score) => {
        if (socket && currentParticipant) {
             socket.emit('submitFiveZeroOneScore', { score });
        }
    };
    
    const handleTurnAction = (action) => {
        if (action === 'no_score') handleKeypadSubmit(0);
        else if (socket) socket.emit('fiveZeroOneTurnAction', { action });
    };
    const handleKeypadCancel = () => { if (socket) socket.emit('cancelFiveZeroOneKeypad'); };
    const handleUndo = () => { if (socket && canUndo) socket.emit('undoLastAction'); };

    // --- 7. UI Configuration ---
    const numPlayers = participants.length;
    let gridColsClass = "grid-cols-1";
    let totalColumns = 1;
    if (numPlayers === 2) { gridColsClass = "grid-cols-2"; totalColumns = 2; }
    else if (numPlayers >= 3 && numPlayers <= 4) { gridColsClass = "grid-cols-2"; totalColumns = 2; }
    else if (numPlayers >= 5 && numPlayers <= 6) { gridColsClass = "grid-cols-3"; totalColumns = 3; }
    else if (numPlayers > 6) { gridColsClass = "grid-cols-4"; totalColumns = 4; }
    
    const PlayerHighScores = ({ participantId, history, colorClass }) => {
        const highScores = React.useMemo(() => {
            if (!history || !participantId) return [];
            const scores = new Set();
            history.forEach(gameState => {
                const p = gameState.participants.find(player => player.id === participantId);
                if (p && p.lastTurnScore && p.lastTurnScore >= 100) {
                    scores.add(p.lastTurnScore);
                }
            });
            return Array.from(scores).sort((a, b) => b - a).slice(0, 3); // Show top 3
        }, [participantId, history]);

        if (highScores.length === 0) return null;

        return React.createElement('div', { className: 'animate-fade-in-pop mt-auto' },
            React.createElement('h4', { className: `font-arcade-main text-2xl md:text-3xl ${colorClass} mb-2` }, 'HIGH SCORES'),
            React.createElement('div', { className: 'flex flex-col items-center gap-2' }, 
                highScores.map((score, index) => (
                    React.createElement('div', { key: index, className: 'font-arcade-main text-4xl md:text-5xl text-slate-100 flex items-center' },
                        React.createElement('span', { className: 'text-yellow-400 mr-2 text-2xl' }, '⭐'),
                        score
                    )
                ))
            )
        );
    };

    const renderMainDisplayViewFiveZeroOne = () => {
        let leadingPlayerId = null;
        if (!gameState.gameOver && participants.length > 0) {
            let minScore = FIVE_ZERO_ONE_START_SCORE_CONST + 1;
            participants.forEach(p => {
                if (p.score < minScore) {
                    minScore = p.score;
                    leadingPlayerId = p.id;
                }
            });
            if (minScore >= FIVE_ZERO_ONE_START_SCORE_CONST) {
                leadingPlayerId = null;
            }
        }

        return (
            React.createElement('div', { className: "w-full h-full flex flex-col bg-slate-900 text-slate-100 p-2 relative" },
                React.createElement('div', { className: `grid ${gridColsClass} gap-2 flex-grow min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-1` },
                    participants.map((p, index) => {
                        if (!p || typeof p !== 'object') return null;
                        const isCurrent = index === currentPlayerIndex;
                        const isLeading = p.id === leadingPlayerId;
                        const needsDoubleInUI = doubleIn && p.score === FIVE_ZERO_ONE_START_SCORE_CONST;
                        const colorTheme = PLAYER_COLORS[index % PLAYER_COLORS.length];
                        const colIndex = index % totalColumns;
                        const isRightSideColumn = totalColumns > 1 && colIndex === totalColumns - 1;

                        let cardClasses = `bg-gradient-to-br ${colorTheme.bg} border-4 ${colorTheme.border} rounded-xl shadow-2xl flex flex-col p-4 transition-all duration-300 ease-in-out relative`;
                        
                        if (isCurrent) {
                            cardClasses += " animate-outer-pulse scale-105 z-10";
                        }
                        
                        const scoreStyle = { fontSize: 'clamp(5rem, 15vw, 10rem)', textShadow: '0 0 10px rgba(255,255,255,0.3), 3px 3px 5px rgba(0,0,0,0.5)' };
                        const checkoutText = getCheckoutSuggestion(p.score);
                        
                        return (
                            React.createElement('div', { key: p.id || index, className: cardClasses },
                                React.createElement('div', { className: `flex items-start w-full ${isRightSideColumn ? 'justify-end' : 'justify-between'}` },
                                    !isRightSideColumn && React.createElement('h3', {
                                        className: `font-arcade-main text-3xl md:text-4xl lg:text-5xl text-white break-words leading-tight`,
                                        style: { textShadow: '2px 2px 3px rgba(0,0,0,0.7)' }
                                    }, getPlayerDisplayName(p, isCurrent ? currentPlayerTurnInTeam : undefined)),
                                    isLeading && !isCurrent && React.createElement('span', { className: `text-5xl animate-subtle-pulse ${isRightSideColumn ? 'order-first' : ''}`}, ICON_LEADER),
                                    isRightSideColumn && React.createElement('h3', {
                                        className: `font-arcade-main text-3xl md:text-4xl lg:text-5xl text-white break-words leading-tight text-right`,
                                        style: { textShadow: '2px 2px 3px rgba(0,0,0,0.7)' }
                                    }, getPlayerDisplayName(p, isCurrent ? currentPlayerTurnInTeam : undefined))
                                ),
                                React.createElement('div', { className: "flex-grow flex flex-col items-center justify-center my-4" },
                                    React.createElement('p', { className: "font-black text-white leading-none", style: scoreStyle }, p.score),
                                    needsDoubleInUI && React.createElement('p', { className: 'font-arcade-main text-orange-300 text-3xl mt-2 animate-pulse' }, "D-IN REQ."),
                                    p.score > 0 && p.score <= 170 && !BOGEY_NUMBERS_501.includes(p.score) &&
                                        React.createElement('p', { className: 'font-arcade-main text-emerald-300 text-5xl lg:text-6xl mt-3' }, `Out: ${checkoutText}`)
                                ),
                                React.createElement(PlayerHighScores, { participantId: p.id, history: history, colorClass: colorTheme.text }),
                                React.createElement(WinTracker, { name: p.name, type: 'team', sessionStats: sessionStats })
                            )
                        );
                    })
                ),
                currentParticipant && React.createElement(FiveZeroOneCurrentThrowerPopup, {
                    throwerName: currentParticipant.players[currentPlayerTurnInTeam],
                    teamName: currentParticipant.name,
                    colorTheme: PLAYER_COLORS[currentPlayerIndex % PLAYER_COLORS.length],
                    position: currentPlayerIndex,
                    totalColumns: totalColumns
                })
            )
        );
    };

    const renderControllerViewFiveZeroOne = () => {
        const controllerButtonClass = "flex-1 text-lg font-bold rounded-lg shadow-md transition-transform hover:scale-105 active:scale-95 flex items-center justify-center text-center leading-tight p-4";
        const controllerInfoTextClass = "text-lg sm:text-xl text-center text-slate-300 mb-1";
        const controllerPlayerNameClass = "text-2xl sm:text-3xl text-yellow-300 font-semibold text-center mb-2 game-title-font leading-tight";
        const controllerScoreClass = "text-6xl sm:text-7xl font-black text-sky-300 my-1 text-center [text-shadow:0_0_8px_rgba(56,189,248,0.5)]";
        const ActualKeypadComponent = window.Keypad;

        if (!currentParticipant) {
            return React.createElement('div', { className: "flex flex-col items-center justify-center h-full p-4 bg-slate-800 rounded-lg" },
                React.createElement('p', { className: controllerInfoTextClass }, "Waiting for current player data...")
            );
        }
        const displayName = getPlayerDisplayName(currentParticipant, currentPlayerTurnInTeam);
        const isBustedForController = showFiveZeroOneActionPrompt && bustMessage && !showKeypadForFiveZeroOne;
        const needsToDoubleInMessageController = doubleIn && currentParticipant.score === FIVE_ZERO_ONE_START_SCORE_CONST;
        const canEnterScore = showFiveZeroOneActionPrompt && !isBustedForController && !showKeypadForFiveZeroOne;

        return React.createElement('div', { className: "flex flex-col items-center justify-between h-full p-3 space-y-4 bg-slate-800 rounded-lg shadow-2xl" },
            React.createElement('div', { className: "w-full text-center" },
                React.createElement('h3', { className: controllerPlayerNameClass }, `Turn: ${displayName}`),
                React.createElement('p', { className: controllerScoreClass }, currentParticipant.score),
                needsToDoubleInMessageController &&
                    React.createElement('p', {className: `${controllerInfoTextClass} text-orange-400 font-semibold animate-pulse`}, `${ICON_DOUBLE_IN_WARN} Needs Double-In!`),
                currentParticipant.score > 0 && currentParticipant.score <= 170 && (!doubleOut || (doubleIn && currentParticipant.score < FIVE_ZERO_ONE_START_SCORE_CONST) || !doubleIn ) &&
                    React.createElement('p', {className: `${controllerInfoTextClass} text-emerald-300`},
                        "Out: ", React.createElement('strong', { className: "text-lg" }, getCheckoutSuggestion(currentParticipant.score).replace(/T/g, 'T').replace(/D/g, 'D'))
                    )
            ),
            React.createElement('div', { className: "w-full max-w-md flex flex-col items-center space-y-3" },
                canEnterScore && React.createElement('div', { className: "flex flex-row items-stretch justify-center w-full gap-3" },
                    React.createElement('button', {
                        onClick: () => handleTurnAction('score_counts'),
                        className: `${controllerButtonClass} bg-sky-500 hover:bg-sky-600 text-white`
                    }, `${ICON_DART_TARGET} Enter Score`),
                    React.createElement('button', {
                        onClick: () => handleTurnAction('no_score'),
                        className: `${controllerButtonClass} bg-slate-600 hover:bg-slate-700 text-white`
                    }, `${ICON_MISS_SHRUG} No Score`)
                ),
                isBustedForController && React.createElement('div', { className: "text-center w-full p-3 bg-red-800/60 rounded-lg flex flex-col items-center" },
                    React.createElement('p', { className: "text-2xl sm:text-3xl text-red-200 font-bold animate-bounce" }, `💥 ${bustMessage.toUpperCase()}!!!`),
                    React.createElement('button', {
                        onClick: () => handleTurnAction('bust_acknowledged'),
                        className: `${controllerButtonClass} bg-orange-500 hover:bg-orange-600 text-white mt-2 w-auto px-8`
                    }, `${ICON_NEXT_PLAYER_OK} OK`)
                ),
                showKeypadForFiveZeroOne && showKeypadForFiveZeroOne.participantIndex === currentPlayerIndex && ActualKeypadComponent &&
                    React.createElement(ActualKeypadComponent, {
                        onSubmit: handleKeypadSubmit,
                        onCancel: handleKeypadCancel,
                        title: `Score for ${displayName}`
                    },
                     React.createElement('div', { className: "text-center text-sm text-gray-300 mb-2" },
                        "Enter total score for 3 darts.",
                         needsToDoubleInMessageController && React.createElement('p', {className: "text-orange-300 font-semibold mt-0.5"}, `${ICON_DOUBLE_IN_WARN} Double-In required!`),
                        doubleOut && currentParticipant.score <= 170 && currentParticipant.score > 1 && !BOGEY_NUMBERS_501.includes(currentParticipant.score) && (currentParticipant.score % 2 === 0 || currentParticipant.score === 50) &&
                            React.createElement('p', {className: "text-green-300 font-semibold mt-0.5"}, `${ICON_DART_TARGET} Double-Out required!`)
                     )
                ),
                canUndo && React.createElement('button', {
                    onClick: handleUndo,
                    className: `${controllerButtonClass} bg-yellow-500 hover:bg-yellow-600 text-black w-auto px-8`
                }, `${ICON_UNDO} Undo`)
            )
        );
    };

    if (displayRole === 'controller') {
        return renderControllerViewFiveZeroOne();
    } else {
        return renderMainDisplayViewFiveZeroOne();
    }
};

