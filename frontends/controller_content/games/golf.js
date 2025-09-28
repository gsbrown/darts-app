// golf.js - Golf Game Component
// REVAMPED: Updated to handle the new "all-teams" participant structure.
// UI CHANGE: Removed title and enlarged the "On the Tee" section for better visibility of the active team. Team names are now the sole identifier on scorecards.
// FEATURE: Team name initials are now reversed on the back 9 to indicate the change in player order.

const GolfGame = ({ gameMode, onGameEnd, socket, gameState, displayRole, sessionStats }) => {
    // --- 1. Initial Game State Validation ---
    if (!gameState || typeof gameState !== 'object' || gameState.mode !== 'GOLF' ||
        !Array.isArray(gameState.participants) || typeof gameState.currentHole !== 'number') {
        console.error("GolfGame: Invalid or incomplete gameState", gameState);
        return React.createElement('div', { className: "p-8 text-center text-red-500 text-2xl font-sans" }, "Loading Golf Game State or Invalid State...");
    }

    // --- 3. Destructure Game State Properties ---
    const {
        participants = [],
        currentHole,
        numHoles = 18,
        golfTurnOrder = [],
        golfCurrentTurnOrderIndex = 0,
        promptForGolfScore,
        showKeypadForGolf,
        golfHonorsHolderIndex,
        history
    } = gameState;

    const PAR_FOR_HOLE = 3;

    // --- 4. Current Player and Undo Logic ---
    const currentOverallParticipantIndex = golfTurnOrder[golfCurrentTurnOrderIndex];
    const currentParticipant = participants[currentOverallParticipantIndex];
    const isMyTurnForScoreEntry = showKeypadForGolf && showKeypadForGolf.participantIndex === currentOverallParticipantIndex;
    const canUndo = history && Array.isArray(history) && history.length > 1;

    // --- 5. Effect to auto-request score entry ---
    React.useEffect(() => {
        const isMyTurnForScorePrompt = promptForGolfScore && promptForGolfScore.participantIndex === currentOverallParticipantIndex;
        if (isMyTurnForScorePrompt && socket) {
            socket.emit('golfRequestScoreEntry');
        }
    }, [promptForGolfScore, currentOverallParticipantIndex, socket]);

    // --- 6. Helper Functions ---
    // REVAMP: Updated display name logic to reverse on the back 9.
    const getPlayerDisplayName = (participant) => {
        if (!participant) return "Unknown";

        // If it's the back 9 (holes 10-18) and it's a multi-person team, reverse the player initials.
        if (currentHole > 9 && participant.name && participant.name.includes(' / ')) {
            const initials = participant.name.split(' / ');
            return initials.reverse().join(' / ');
        }
        
        // Otherwise, return the normal team name for the front 9 or single players.
        return participant.name;
    };
    
    const getHoleSubtotal = (scores, startHole, endHole) => {
        let subtotal = 0;
        if (scores && Array.isArray(scores)) {
            for (let i = startHole - 1; i < endHole && i < scores.length; i++) {
                if (scores[i] !== null && typeof scores[i] === 'number') {
                    subtotal += scores[i];
                }
            }
        }
        return subtotal;
    };

    // --- 7. Event Handlers ---
    const handleScoreSubmit = (score) => {
        if (socket && currentParticipant && isMyTurnForScoreEntry) {
            const numericScore = parseInt(score, 10);
            if (!isNaN(numericScore) && numericScore >= 1 && numericScore <= 6) {
                socket.emit('golfSubmitScore', { score: numericScore });
            }
        }
    };
    const handleUndo = () => { if (socket && canUndo) socket.emit('undoLastAction'); };
    
    // --- 8. UI Sizing ---
    const numActivePlayers = participants.length;
    let holeInfoFontSize, turnIndicatorFontSize, scoreCellFontSize, totalCellFontSize, playerNameFontSize, teamPlayerListFontSize, headerFontSize, holeNumberHeaderFontSize, cellPaddingY, cellPaddingX, honorsEmojiSize, turnIndicatorSectionPadding;
    if (numActivePlayers <= 2) { holeInfoFontSize = "text-3xl xl:text-4xl"; turnIndicatorFontSize = "text-5xl xl:text-6xl"; scoreCellFontSize = "text-7xl xl:text-8xl"; totalCellFontSize = "text-8xl xl:text-9xl font-bold"; playerNameFontSize = "text-4xl xl:text-5xl font-bold"; teamPlayerListFontSize = "text-3xl xl:text-4xl"; headerFontSize = "text-3xl xl:text-4xl font-bold"; holeNumberHeaderFontSize = "text-2xl xl:text-3xl"; cellPaddingY = "py-4 sm:py-5"; cellPaddingX = "px-2 sm:px-3"; honorsEmojiSize = "text-5xl"; turnIndicatorSectionPadding = "p-5 md:p-6"; }
    else if (numActivePlayers <= 4) { holeInfoFontSize = "text-2xl xl:text-3xl"; turnIndicatorFontSize = "text-4xl xl:text-5xl"; scoreCellFontSize = "text-6xl xl:text-7xl"; totalCellFontSize = "text-6xl xl:text-7xl font-bold"; playerNameFontSize = "text-3xl xl:text-4xl font-bold"; teamPlayerListFontSize = "text-2xl xl:text-3xl"; headerFontSize = "text-2xl xl:text-3xl font-bold"; holeNumberHeaderFontSize = "text-xl xl:text-2xl"; cellPaddingY = "py-3 sm:py-4"; cellPaddingX = "px-1 sm:px-2"; honorsEmojiSize = "text-4xl"; turnIndicatorSectionPadding = "p-4 md:p-5"; }
    else { holeInfoFontSize = "text-xl xl:text-2xl"; turnIndicatorFontSize = "text-3xl xl:text-4xl"; scoreCellFontSize = "text-5xl xl:text-6xl"; totalCellFontSize = "text-5xl xl:text-6xl font-bold"; playerNameFontSize = "text-2xl xl:text-3xl font-bold"; teamPlayerListFontSize = "text-xl xl:text-2xl"; headerFontSize = "text-xl xl:text-2xl font-bold"; holeNumberHeaderFontSize = "text-lg xl:text-xl"; cellPaddingY = "py-2 sm:py-3"; cellPaddingX = "px-1 sm:px-1.5"; honorsEmojiSize = "text-3xl"; turnIndicatorSectionPadding = "p-3 sm:p-4"; }
    const cellBorderClass = "border border-gray-600";

    const renderMainDisplayViewGolf = () => {
        return (
            React.createElement('div', { className: "golf-game-area w-full px-1 py-2 flex flex-col h-screen bg-slate-900 text-slate-100 font-sans" },
                React.createElement('h3', { className: `${holeInfoFontSize} font-bold text-sky-300 text-center mb-2 shrink-0` }, `Hole ${currentHole} `, React.createElement('span', { className: "text-3xl sm:text-4xl text-sky-500" }, `/ ${numHoles}`)),
                currentParticipant && !gameState.gameOver && (
                    React.createElement('div', { className: `flex flex-row items-center justify-center mb-4 sm:mb-5 ${turnIndicatorSectionPadding} bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 rounded-xl shadow-2xl shrink-0 ring-4 ring-yellow-300` },
                        React.createElement('p', { className: `${turnIndicatorFontSize} text-white flex items-center` }, 
                            currentOverallParticipantIndex === golfHonorsHolderIndex && React.createElement('span', { className: `mr-3 ${honorsEmojiSize} animate-pulse text-yellow-300` }, "🏆"), 
                            React.createElement('span', {className: `mr-3 ${honorsEmojiSize}`}, "⛳️"), 
                            React.createElement('span', {className: "font-semibold"}, "On the tee: "), 
                            React.createElement('span', { className: `ml-3 font-bold ${currentOverallParticipantIndex === golfHonorsHolderIndex ? 'text-yellow-300' : 'text-lime-300'}`}, getPlayerDisplayName(currentParticipant))
                        )
                    )
                ),
                React.createElement('div', { className: "flex-grow overflow-auto custom-scrollbar pb-4" },
                    participants.map((p, pIdx) => {
                        const outScore = getHoleSubtotal(p.golfScores, 1, 9);
                        const inScore = getHoleSubtotal(p.golfScores, 10, 18);
                        const isCurrentTurnOverall = pIdx === currentOverallParticipantIndex;
                        const hasHonorsCurrentTurn = pIdx === golfHonorsHolderIndex && !gameState.gameOver;
                        let cardBg = 'bg-slate-800', cardRing = '', cardShadow = 'shadow-xl';
                        if (isCurrentTurnOverall && !gameState.gameOver) { cardBg = 'bg-sky-700'; cardRing = 'ring-4 ring-yellow-400'; cardShadow = 'shadow-yellow-400/40 shadow-2xl'; }
                        return (
                            React.createElement('div', { key: p.id || pIdx, className: `participant-scorecard-block ${cardBg} ${cardRing} ${cardShadow} rounded-xl mb-3 sm:mb-4 p-3 sm:p-4 ${cellBorderClass} transition-all duration-300` },
                                React.createElement('div', { className: `mb-2 ${playerNameFontSize} ${hasHonorsCurrentTurn ? 'text-yellow-300' : 'text-white'} flex items-center` }, hasHonorsCurrentTurn && React.createElement('span', { className: `mr-2 ${honorsEmojiSize} animate-bounce` }, "🏆"), getPlayerDisplayName(p), React.createElement(WinTracker, { name: p.name, type: 'team', sessionStats: sessionStats })),
                                React.createElement('div', {className: "space-y-3"},
                                    React.createElement('table', { className: "min-w-full table-fixed border-collapse" },
                                        React.createElement('thead', { className: "bg-slate-700" }, React.createElement('tr', null, [...Array(9)].map((_, i) => React.createElement('th', { key: `f9-h${i+1}`, className: `${cellPaddingY} ${cellPaddingX} text-center ${headerFontSize} text-gray-300 ${holeNumberHeaderFontSize} ${cellBorderClass}` }, i+1)), React.createElement('th', { className: `${cellPaddingY} ${cellPaddingX} text-center ${headerFontSize} text-yellow-300 ${cellBorderClass} bg-slate-600` }, "OUT"))),
                                        React.createElement('tbody', {className: "bg-slate-800/[.5]"}, React.createElement('tr', null, [...Array(9)].map((_, i) => { const score = p.golfScores[i]; let scoreColor = 'text-gray-100'; if (score === 1) scoreColor = 'text-red-400 font-extrabold'; else if (score === PAR_FOR_HOLE - 1) scoreColor = 'text-green-400 font-bold'; else if (score > PAR_FOR_HOLE + 1) scoreColor = 'text-orange-400 font-semibold'; return (React.createElement('td', { key: `s${pIdx}-h${i+1}-front`, className: `${cellPaddingY} ${cellPaddingX} text-center align-middle ${scoreCellFontSize} ${scoreColor} ${cellBorderClass}` }, score !== null ? score : '-')); }), React.createElement('td', { className: `${cellPaddingY} ${cellPaddingX} text-center align-middle ${totalCellFontSize} text-yellow-300 ${cellBorderClass} bg-slate-700` }, outScore)))
                                    ),
                                    React.createElement('table', { className: "min-w-full table-fixed border-collapse" },
                                        React.createElement('thead', { className: "bg-slate-700" }, React.createElement('tr', null, [...Array(9)].map((_, i) => React.createElement('th', { key: `b9-h${i+10}`, className: `${cellPaddingY} ${cellPaddingX} text-center ${headerFontSize} text-gray-300 ${holeNumberHeaderFontSize} ${cellBorderClass}` }, i+10)), React.createElement('th', { className: `${cellPaddingY} ${cellPaddingX} text-center ${headerFontSize} text-yellow-400 ${cellBorderClass} bg-slate-600` }, "IN"), React.createElement('th', { className: `${cellPaddingY} ${cellPaddingX} text-center ${headerFontSize} text-green-300 ${cellBorderClass} bg-slate-600` }, "TOTAL"))),
                                        React.createElement('tbody', {className: "bg-slate-800/[.5]"}, React.createElement('tr', null, [...Array(9)].map((_, i) => { const score = p.golfScores[i+9]; let scoreColor = 'text-gray-100'; if (score === 1) scoreColor = 'text-red-400 font-extrabold'; else if (score === PAR_FOR_HOLE - 1) scoreColor = 'text-green-400 font-bold'; else if (score > PAR_FOR_HOLE + 1) scoreColor = 'text-orange-400 font-semibold'; return (React.createElement('td', { key: `s${pIdx}-h${i+10}-back`, className: `${cellPaddingY} ${cellPaddingX} text-center align-middle ${scoreCellFontSize} ${scoreColor} ${cellBorderClass}` }, score !== null ? score : '-')); }), React.createElement('td', { className: `${cellPaddingY} ${cellPaddingX} text-center align-middle ${totalCellFontSize} text-yellow-400 ${cellBorderClass} bg-slate-700` }, inScore), React.createElement('td', { className: `${cellPaddingY} ${cellPaddingX} text-center align-middle ${totalCellFontSize} text-green-300 ${cellBorderClass} bg-slate-700` }, p.golfTotalScore)))
                                    )
                                )
                            )
                        );
                    })
                )
            )
        );
    };

    const renderControllerViewGolf = () => {
        const largeButtonBase = "w-full text-xl font-bold rounded-lg shadow-md my-2 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center text-center leading-tight";
        const undoButtonClass = `${largeButtonBase} py-4 text-lg bg-yellow-500 hover:bg-yellow-600 text-black`;
        const scoreButtonClass = "w-full text-2xl font-bold rounded-lg shadow-md p-5 transition-transform hover:scale-105 active:scale-95 bg-sky-500 hover:bg-sky-600 text-white";
        const controllerInfoTextClass = "text-base text-center text-slate-300 mb-1";
        const controllerPlayerNameClass = "text-2xl game-title-font text-yellow-300 font-semibold text-center mb-1 leading-tight";
        const controllerHoleInfoClass = "text-4xl font-black text-sky-300 my-2 text-center p-3 rounded bg-slate-700 shadow-lg";

        if (gameState.gameOver) {
             return React.createElement('div', { className: "flex flex-col items-center justify-center h-full p-4 bg-slate-800 rounded-lg space-y-3" },
                React.createElement('p', { className: `${controllerInfoTextClass} font-semibold text-2xl text-green-400` }, "Game Over!"),
                React.createElement('button', { onClick: () => onGameEnd(false), className: `${largeButtonBase} py-4 text-lg bg-slate-500 hover:bg-slate-600 text-white`}, "Close Controller")
            );
        }
        
        if (!currentParticipant) {
            return React.createElement('div', { className: "flex items-center justify-center h-full p-4 bg-slate-800 rounded-lg" }, React.createElement('p', { className: controllerInfoTextClass }, "Waiting for player data..."));
        }

        const honorsHolderName = participants[golfHonorsHolderIndex] ? getPlayerDisplayName(participants[golfHonorsHolderIndex]) : "N/A";

        const renderMainContent = () => {
            if (isMyTurnForScoreEntry) {
                return React.createElement('div', { className: "flex flex-col items-center w-full" },
                    React.createElement('h4', { className: "text-lg text-slate-200 mb-3 text-center" }, `Enter Score for Hole ${currentHole}`),
                    React.createElement('div', { className: "grid grid-cols-3 gap-3 w-full" },
                        [1, 2, 3, 4, 5, 6].map(scoreValue => React.createElement('button', { key: `score-btn-${scoreValue}`, onClick: () => handleScoreSubmit(scoreValue), className: scoreButtonClass }, scoreValue))
                    )
                );
            } else {
                return React.createElement('p', { className: `${controllerInfoTextClass} text-lg py-8` }, "Waiting for other players...");
            }
        };

        return React.createElement('div', { className: "flex flex-col h-full p-3 bg-slate-800 rounded-lg" },
            React.createElement('div', { className: "text-center w-full shrink-0" },
                React.createElement('h3', { className: controllerPlayerNameClass }, `Team: ${getPlayerDisplayName(currentParticipant)}`),
                React.createElement('p', { className: controllerHoleInfoClass }, `Hole ${currentHole}`),
                React.createElement('p', { className: `${controllerInfoTextClass} text-sm` }, "Honors: ", React.createElement('span', {className: "font-semibold text-yellow-200"}, honorsHolderName), currentOverallParticipantIndex === golfHonorsHolderIndex && React.createElement('span', {className: "ml-1"}, "🏆"))
            ),
            React.createElement('div', { className: "flex-grow flex flex-col items-center justify-center w-full max-w-xs mx-auto" }, renderMainContent()),
            React.createElement('div', { className: "w-full max-w-xs mx-auto shrink-0 pt-4" },
                canUndo && React.createElement('button', { onClick: handleUndo, className: undoButtonClass }, "↩️ Undo Last")
            )
        );
    };

    if (displayRole === 'controller') {
        return renderControllerViewGolf();
    } else {
        return renderMainDisplayViewGolf();
    }
};

