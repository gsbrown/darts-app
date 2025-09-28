// baseball.js - Baseball Game Component
// REVAMPED: Logic updated for team-based inning scoring, similar to Golf.
// UI MAKEOVER: Removed title, redesigned the 'At Bat' section for better aesthetics, and removed individual player names from the scoreboard to focus on team play.

const BaseballGame = ({ gameMode, onGameEnd, socket, gameState, displayRole, sessionStats }) => {
    // --- 1. Initial Game State Validation ---
    if (!gameState || typeof gameState !== 'object' || gameState.mode !== 'BASEBALL' ||
        !Array.isArray(gameState.participants) || !gameState.baseball_currentInning) {
        return React.createElement( 'div', { className: "p-10 text-center text-red-500 text-4xl font-sans" }, "Loading Baseball Game State or Invalid State...");
    }

    // --- 3. Destructure Game State Properties (Updated) ---
    const {
        participants = [],
        currentPlayerIndex,
        baseball_currentInning,
        baseball_actionPrompt,
        showKeypadForBaseball,
        history,
        BASEBALL_NUM_INNINGS = 9,
    } = gameState;

    // --- 4. Current Player and Game Info (Updated) ---
    const currentParticipant = participants[currentPlayerIndex];
    const isMyTurnForAction = baseball_actionPrompt && currentParticipant && baseball_actionPrompt.participantIndex === currentPlayerIndex;
    const canUndoController = history && history.length > 1 && isMyTurnForAction && !showKeypadForBaseball;

    let leadingPlayerIds = [];
    if (participants.length > 0) {
        let maxScore = -1;
        participants.forEach(p => {
            if ((p.baseball_total_score || 0) > maxScore) {
                maxScore = p.baseball_total_score || 0;
            }
        });
        if (maxScore > 0) {
            leadingPlayerIds = participants.filter(p => (p.baseball_total_score || 0) === maxScore).map(p => p.id);
        }
    }

    // --- 5. Helper Functions (Updated) ---
    const getPlayerDisplayName = (p, forController = false) => {
        if (!p) return "Unknown Team";
        let displayName = p.name;
        if (forController && p.players && p.players.length > 0) {
            // Controller can still show detailed player info if needed
            displayName = `${p.name} (${p.players.join(', ')})`;
        }
        return displayName;
    };

    const getInningScore = (p, i) => {
        const score = p?.baseball_innings?.[i];
        if (score === null || score === undefined) return '-';
        return score;
    };

    // --- 6. Event Handlers (Updated) ---
    const handleRequestScoreEntry = () => {
        if (socket && isMyTurnForAction) {
            socket.emit('baseballRequestScoreEntry');
        }
    };
    
    const handleKeypadSubmit = (score) => {
        if (socket && showKeypadForBaseball) {
            socket.emit('baseballSubmitInningScore', { score });
        }
    };

    const handleKeypadCancel = () => {
        if (socket && showKeypadForBaseball) {
            socket.emit('baseballCancelKeypad');
        }
    };
    
    const handleUndo = () => {
        if (socket && canUndoController) {
            socket.emit('undoLastAction');
        }
    };

    // --- 7. Dynamic Sizing ---
    const numPlayers = participants.length;
    let atBatPanelPadding, atBatPlayerNameSize, atBatInfoSize,
        scoreCellFontSize, totalCellFontSize, playerNameScoreboardFontSize,
        inningHeaderFontSize, tableCellPaddingY, tableCellPaddingX,
        scoreboardPlayerNamePaddingX;

    atBatPanelPadding = "p-4 md:p-5 lg:p-6";
    atBatPlayerNameSize = "text-5xl md:text-6xl lg:text-7xl";
    atBatInfoSize = "text-3xl md:text-4xl lg:text-5xl";
    scoreCellFontSize = "text-8xl md:text-9xl";
    totalCellFontSize = "text-8xl md:text-9xl font-bold";
    playerNameScoreboardFontSize = "text-7xl md:text-8xl";
    inningHeaderFontSize = "text-4xl md:text-5xl";
    tableCellPaddingY = "py-10 md:py-12 lg:py-14";
    tableCellPaddingX = "px-2 md:px-3";
    scoreboardPlayerNamePaddingX = "px-3 md:px-4";

    if (numPlayers >= 3 && numPlayers <= 4) {
        scoreCellFontSize = "text-7xl md:text-8xl lg:text-9xl";
        totalCellFontSize = "text-7xl md:text-8xl lg:text-9xl font-bold";
        playerNameScoreboardFontSize = "text-6xl md:text-7xl lg:text-8xl";
        inningHeaderFontSize = "text-3xl md:text-4xl lg:text-5xl";
        tableCellPaddingY = "py-12 md:py-14 lg:py-16";
    } else if (numPlayers >= 5 && numPlayers <= 6) {
        atBatPlayerNameSize = "text-4xl md:text-5xl lg:text-6xl";
        atBatInfoSize = "text-2xl md:text-3xl lg:text-4xl";
        scoreCellFontSize = "text-6xl md:text-7xl lg:text-8xl";
        totalCellFontSize = "text-6xl md:text-7xl lg:text-8xl font-bold";
        playerNameScoreboardFontSize = "text-5xl md:text-6xl lg:text-7xl";
        inningHeaderFontSize = "text-2xl md:text-3xl lg:text-4xl";
        tableCellPaddingY = "py-10 md:py-12 lg:py-14";
    } else if (numPlayers >= 7) {
        atBatPlayerNameSize = "text-3xl md:text-4xl";
        atBatInfoSize = "text-xl md:text-2xl";
        scoreCellFontSize = "text-5xl md:text-6xl lg:text-7xl";
        totalCellFontSize = "text-5xl md:text-6xl lg:text-7xl font-bold";
        playerNameScoreboardFontSize = "text-4xl md:text-5xl lg:text-6xl";
        inningHeaderFontSize = "text-xl md:text-2xl lg:text-3xl";
        tableCellPaddingY = "py-8 md:py-10 lg:py-12";
    }

    const renderInningHeaders = () => {
        const headers = [];
        for (let i = 1; i <= BASEBALL_NUM_INNINGS; i++) {
            headers.push(React.createElement('th', { key: `h-${i}`, className: `whitespace-nowrap ${tableCellPaddingY} ${tableCellPaddingX} border-r border-slate-600/70 text-center align-middle ${inningHeaderFontSize} font-medium ${i === baseball_currentInning ? 'bg-sky-700 text-white ring-1 ring-sky-400' : 'bg-slate-700 text-slate-300'}`}, i));
        }
        headers.push(React.createElement('th', { key: "total", className: `whitespace-nowrap ${tableCellPaddingY} ${tableCellPaddingX} text-center align-middle ${inningHeaderFontSize} font-semibold bg-slate-800 text-yellow-300 rounded-r-md`}, "Total"));
        return headers;
    };

    const renderPlayerRow = (p, isCurrent) => {
        const cells = [];
        for (let i = 0; i < BASEBALL_NUM_INNINGS; i++) {
            const score = getInningScore(p, i);
            let scoreCellClasses = `${tableCellPaddingY} ${tableCellPaddingX} border-r border-slate-600/70 text-center align-middle ${scoreCellFontSize} `;
            let scoreTextColorClass = "";
            if (score === '-') scoreTextColorClass = "text-slate-500";
            else if (score >= 7) scoreTextColorClass = "text-orange-400 font-extrabold";
            else if (score >= 5) scoreTextColorClass = "text-yellow-400 font-bold";
            else if (score >= 3) scoreTextColorClass = "text-sky-400 font-semibold";
            else if (score > 0) scoreTextColorClass = "text-slate-100";
            else scoreTextColorClass = "text-slate-400";
            let scoreCellBg = '';
            if ((i + 1) === baseball_currentInning && isCurrent && (isMyTurnForAction || showKeypadForBaseball)) scoreCellBg = 'bg-yellow-500/70 ring-2 ring-yellow-300';
            else if (isCurrent) scoreCellBg = 'bg-indigo-600/60';
            else if ((i + 1) === baseball_currentInning) scoreCellBg = 'bg-slate-600/50';
            else scoreCellBg = 'bg-slate-700/60';
            scoreCellClasses += `${scoreCellBg} ${scoreTextColorClass}`;
            cells.push(React.createElement('td', { key: `p${p.id}-i${i+1}`, className: scoreCellClasses }, score));
        }
        let totalScoreBg = isCurrent ? 'bg-indigo-700' : 'bg-slate-800/90';
        let totalScoreText = isCurrent ? 'text-yellow-200' : 'text-yellow-300';
        cells.push(React.createElement('td', { key: `p${p.id}-total`, className: `${tableCellPaddingY} ${tableCellPaddingX} text-center align-middle ${totalCellFontSize} ${totalScoreBg} ${totalScoreText} rounded-r-md`}, p.baseball_total_score || 0));
        return cells;
    };

    const renderMainDisplayViewBaseball = () => {
        return React.createElement( 'div', { className: "baseball-game-area w-full px-0 py-2 text-white flex flex-col h-screen font-sans" },
            // HEADER REMOVED
            React.createElement('section', { className: `my-2 md:my-3 ${atBatPanelPadding} bg-gradient-to-br from-blue-800 via-indigo-700 to-blue-800 rounded-xl shadow-2xl ring-4 ring-yellow-300 mx-auto w-11/12 max-w-6xl shrink-0` },
                React.createElement('div', { className: "flex items-center justify-between" },
                    React.createElement('div', { className: "text-center flex flex-col items-center justify-center" },
                        React.createElement('p', { className: `${atBatInfoSize} text-sky-300 font-semibold`}, "Inning"),
                        React.createElement('p', { className: `text-5xl md:text-6xl font-bold text-white`}, `${baseball_currentInning}`, React.createElement('span', {className: "text-3xl md:text-4xl text-slate-400"}, ` / ${BASEBALL_NUM_INNINGS}`))
                    ),
                    React.createElement('div', { className: "text-center flex-grow" },
                        currentParticipant && React.createElement(React.Fragment, null,
                            React.createElement('p', { className: `${atBatInfoSize} text-slate-200 font-semibold`}, "At Bat"),
                            React.createElement('h3', { className: `${atBatPlayerNameSize} font-bold text-yellow-300 game-title-font text-center break-words leading-tight animate-pulse` }, getPlayerDisplayName(currentParticipant))
                        ),
                         !currentParticipant && !gameState.gameOver && React.createElement('p', { className: `${atBatPlayerNameSize} text-slate-400`}, "Loading..."),
                        gameState.gameOver && React.createElement('p', { className: `${atBatPlayerNameSize} text-green-400 game-title-font`}, "GAME OVER!")
                    ),
                    React.createElement('div', { className: `text-7xl md:text-8xl lg:text-9xl`}, "⚾")
                )
            ),
            React.createElement('main', { className: "overflow-x-auto shadow-2xl rounded-lg flex-grow w-full mb-2 px-1 md:px-2" },
                React.createElement('table', { className: "min-w-full border-collapse border border-slate-700/50" },
                    React.createElement('thead', {className: "bg-slate-700/90 backdrop-blur-sm"}, React.createElement('tr', null, React.createElement('th', { className: `sticky left-0 z-10 bg-slate-700/90 ${tableCellPaddingY} ${scoreboardPlayerNamePaddingX} border-r border-slate-600/70 text-left align-middle ${playerNameScoreboardFontSize} font-semibold text-slate-200 rounded-l-md` }, "Team"), ...renderInningHeaders())),
                    React.createElement('tbody', {className: "bg-slate-800/80 backdrop-blur-sm"},
                        participants.map(p => {
                            const isCurrent = p.id === currentParticipant?.id;
                            const isLeading = leadingPlayerIds.includes(p.id) && !isCurrent;
                            let nameCellBg = 'bg-slate-700';
                            let nameCellRingShadow = 'ring-1 ring-slate-600';
                            let playerNameColor = 'text-slate-200 font-medium';
                            if (isCurrent) { nameCellBg = 'bg-indigo-600'; nameCellRingShadow = 'shadow-xl shadow-indigo-500/50 ring-2 ring-indigo-300'; playerNameColor = 'text-white font-bold'; }
                            else if (isLeading) { nameCellBg = 'bg-sky-700'; nameCellRingShadow = 'shadow-lg shadow-sky-500/30 ring-1 ring-sky-400'; playerNameColor = 'text-sky-100 font-semibold'; }
                            return React.createElement('tr', { key: p.id, className: `transition-all duration-300 ease-in-out border-b border-slate-600/70`},
                                React.createElement('td', { className: `sticky left-0 z-10 align-middle text-left border-r border-slate-600/70 rounded-l-md ${tableCellPaddingY} ${scoreboardPlayerNamePaddingX} ${nameCellBg} ${nameCellRingShadow}` },
                                    React.createElement('div', { className: `${playerNameScoreboardFontSize} ${playerNameColor} flex items-center` }, getPlayerDisplayName(p), isLeading && " 👑", React.createElement(WinTracker, { name: p.name, type: 'team', sessionStats: sessionStats }))
                                    // Individual player list removed
                                ), ...renderPlayerRow(p, isCurrent)
                            );
                        })
                    )
                )
            )
        );
    };

    const renderControllerViewBaseball = () => {
        const controllerActionButtonClass = "w-full text-xl font-bold rounded-lg shadow-xl transition-all duration-150 ease-in-out flex items-center justify-center text-center leading-tight p-3";
        const controllerUtilityButtonClass = "w-full text-base font-semibold rounded-lg shadow-md transition-all duration-150 ease-in-out flex items-center justify-center text-center p-3";
        const controllerPlayerNameClass = "text-lg sm:text-xl game-title-font text-yellow-300 font-semibold text-center mb-1 leading-tight";
        const ActualKeypadComponent = window.Keypad;

        if (!currentParticipant || (!isMyTurnForAction && !showKeypadForBaseball)) {
            return React.createElement('div', { className: "flex flex-col items-center justify-center h-full p-3 text-center bg-slate-800 rounded-lg" },
                React.createElement('img', {src: "https://img.icons8.com/ios-filled/50/9CA3AF/baseball-cap.png", alt:"Baseball Cap", className: "w-12 h-12 mb-3 opacity-70"}),
                React.createElement('p', { className: "text-sm sm:text-base text-center text-slate-300 mb-0.5" }, gameState.gameOver ? "Game Over" : "Waiting for your turn...")
            );
        }

        const displayName = getPlayerDisplayName(currentParticipant, true);

        if (showKeypadForBaseball && showKeypadForBaseball.participantIndex === currentPlayerIndex) {
            return React.createElement(ActualKeypadComponent, {
                onSubmit: handleKeypadSubmit,
                onCancel: handleKeypadCancel,
                title: `Score for Inning ${baseball_currentInning}`,
                initialValue: '0',
            }, React.createElement('p', {className: "text-sm text-center text-slate-300 mb-1"}, `Enter total runs for ${displayName}.`));
        }

        return React.createElement('div', { className: "flex flex-col items-center justify-around h-full p-3 bg-slate-800 rounded-lg" },
            React.createElement('div', { className: "text-center w-full" },
                React.createElement('h3', { className: controllerPlayerNameClass }, `Team Up: ${displayName}`),
                React.createElement('p', { className: "text-3xl font-black text-sky-300" }, `Inning: ${baseball_currentInning}`)
            ),
            React.createElement('div', { className: "w-full max-w-xs" },
                isMyTurnForAction && React.createElement('button', {
                    onClick: handleRequestScoreEntry,
                    className: `${controllerActionButtonClass} py-8 bg-green-600 hover:bg-green-500 text-white`
                }, "⚾ Enter Score")
            ),
            React.createElement('div', { className: "w-full max-w-xs mt-4" },
                canUndoController && React.createElement('button', {
                    onClick: handleUndo,
                    className: `${controllerUtilityButtonClass} py-4 bg-yellow-500 hover:bg-yellow-600 text-black`
                }, "↩️ Undo")
            )
        );
    };

    if (displayRole === 'controller') {
        return renderControllerViewBaseball();
    } else {
        return renderMainDisplayViewBaseball();
    }
};
