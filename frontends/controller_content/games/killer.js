// killer.js - Killer Game Component
// REVAMPED: Updated to handle the new "all-teams" participant structure for this individual-only game.
// UI CHANGE: Removed title for more player space and updated the killer status text for better grammar.

const KillerGame = ({ gameMode, onGameEnd, socket, gameState, clientPlayerId, displayRole, sessionStats }) => {
    const [actingPlayerId, setActingPlayerId] = React.useState(null);
    const [controllerView, setControllerView] = React.useState('NUMBER_SELECTION');

    const allNumbersChosen = gameState?.participants?.every(p => p.killer_number !== null);

    React.useEffect(() => {
        if (!gameState || gameState.gameOver) return;
        if (allNumbersChosen && controllerView === 'NUMBER_SELECTION') {
            setControllerView('ACTION_MENU');
            setActingPlayerId(null);
        }
        if (!allNumbersChosen && controllerView !== 'NUMBER_SELECTION') {
            setControllerView('NUMBER_SELECTION');
        }
    }, [allNumbersChosen, controllerView, gameState]);

    if (!gameState || typeof gameState !== 'object' || gameState.mode !== 'KILLER' ||
        !Array.isArray(gameState.participants) ||
        !Array.isArray(gameState.KILLER_NUMBERS_TO_CHOOSE_FROM) ||
        typeof gameState.KILLER_LIVES_START !== 'number') {
        return React.createElement('div', { className: "p-8 text-center text-yellow-400 animate-pulse font-sans" }, "Loading Killer Game...");
    }
    
    const { 
        participants = [], 
        history, 
        KILLER_NUMBERS_TO_CHOOSE_FROM = [], 
        KILLER_LIVES_START = 3 
    } = gameState;

    const activeKillers = participants.filter(p => p.killer_is_killer && !p.killer_is_eliminated);
    const actingPlayer = actingPlayerId ? participants.find(p => p.id === actingPlayerId) : null;
    const canUndo = history && Array.isArray(history) && history.length > 1;

    // REVAMPED: Always pull the first player's name for display in this individual game mode.
    const getPlayerDisplayName = (participant) => {
        if (!participant) return "UNKNOWN";
        if (Array.isArray(participant.players) && participant.players[0]) {
            return participant.players[0];
        }
        return participant.name || "UNKNOWN";
    };

    const handleChooseNumberForPlayer = (chosenNumber) => { 
        if (socket && actingPlayer && !actingPlayer.killer_is_eliminated && !actingPlayer.killer_number) { 
            socket.emit('killerChooseNumber', { playerId: actingPlayer.id, chosenNumber: chosenNumber });
            setActingPlayerId(null);
        }
    };

    const handlePlayerSpecificBecomeKiller = (playerIdToBecomeKiller) => {
        const player = participants.find(p => p.id === playerIdToBecomeKiller);
        if (socket && player && allNumbersChosen && player.killer_number && !player.killer_is_killer && !player.killer_is_eliminated) {
            socket.emit('killerBecomeKiller', { playerId: player.id });
        }
    };
    
    const CONTROLLER_DEVICE_ACTION_ID = "CONTROLLER_DEVICE_ACTION";

    const handleControllerRemoveLifeForPlayer = (targetPlayerId) => {
        if (socket) {
            const target = participants.find(p => p.id === targetPlayerId);
            if (target && !target.killer_is_eliminated && activeKillers.length > 0) { 
                socket.emit('killerRemoveLife', { fromPlayerId: CONTROLLER_DEVICE_ACTION_ID, targetPlayerId: targetPlayerId });
            }
        }
    };
    
    const handleUndo = () => { 
        if (socket && canUndo) {
            socket.emit('undoLastAction');
            if (controllerView === 'ACTION_MENU' && activeKillers.length === 0 && !allNumbersChosen) {
                 setControllerView('NUMBER_SELECTION'); 
            }
        }
    };

    const assassinIcon = "🔪";
    const targetIcon = "🎯"; 
    const skullIcon = "💀";   

    const renderMainDisplayViewKiller = () => {
        const useLargeScale = participants.length <= 4;
        const cardPadding = useLargeScale ? "px-4 py-10" : "px-3 py-8";
        const playerNameSize = useLargeScale ? "text-7xl" : "text-5xl";
        const playerStatusSize = useLargeScale ? "text-6xl" : "text-4xl";
        const lifeIconSize = useLargeScale ? "text-[10rem]" : "text-[7rem]";
        const playerNumberSize = useLargeScale ? "text-[12rem]" : "text-[9rem]";
        const questionMarkSize = useLargeScale ? "text-8xl" : "text-6xl";
        const nameMarginBottom = useLargeScale ? "mb-6" : "mb-4";
        const livesNumberMarginTop = useLargeScale ? "mt-6" : "mt-4";
        const livesSpacing = useLargeScale ? "space-x-4" : "space-x-3";
        const cardMinHeight = useLargeScale ? "min-h-[28rem]" : "min-h-[22rem]";

        return (
            React.createElement('div', { className: "killer-game-area container mx-auto px-1 sm:px-2 py-4 text-white flex flex-col items-center h-screen bg-slate-900 font-sans" },
                React.createElement('div', { className: `w-full max-w-full space-y-5 md:space-y-6 flex-grow overflow-y-auto custom-scrollbar pb-4`}, 
                    participants.map((p_target) => { 
                        const isAssassin = p_target.killer_is_killer && !p_target.killer_is_eliminated;
                        const isEliminated = p_target.killer_is_eliminated;
                        const cardBaseClasses = `killer-player-card ${cardPadding} ${cardMinHeight} rounded-xl transition-all duration-300 ease-in-out relative overflow-hidden shadow-lg flex flex-col justify-around`; 
                        const assassinCardClasses = isAssassin ? "bg-gradient-to-br from-red-700 via-red-800 to-red-900 ring-4 ring-offset-2 ring-offset-red-800 ring-red-500 shadow-xl shadow-red-600/50" : "bg-slate-800 border-2 border-slate-700 hover:border-slate-600";
                        const eliminatedCardClasses = isEliminated ? "opacity-40 filter grayscale" : ""; 
                        const nameColor = isAssassin ? "text-red-100" : (isEliminated ? "text-slate-500" : "text-slate-100"); 
                        const numberColor = isAssassin ? "text-red-200" : (isEliminated ? "text-slate-600" : "text-sky-300");
                        let playerStatusText = "TARGET", playerStatusColor = "text-sky-400"; 
                        if (isEliminated) { playerStatusText = "ELIMINATED"; playerStatusColor = "text-slate-500"; }
                        else if (isAssassin) { playerStatusText = "KILLER"; playerStatusColor = "text-red-400"; }
                        const eliminatedStampClasses = isEliminated ? `absolute inset-0 flex items-center justify-center text-red-600 ${useLargeScale ? 'text-8xl sm:text-9xl' : 'text-7xl sm:text-8xl'} font-black tracking-wider opacity-70 transform -rotate-12 pointer-events-none z-10` : "hidden";
                        
                        return ( 
                            React.createElement('div', { key: p_target.id, className: `${cardBaseClasses} ${assassinCardClasses} ${eliminatedCardClasses}`},
                                React.createElement('div', {className: eliminatedStampClasses, style: { textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}, "ELIMINATED"),
                                React.createElement('div', {className: `relative z-0 flex flex-col ${isEliminated ? 'pointer-events-none' : ''}`}, 
                                    React.createElement('div', { className: `flex items-baseline justify-start w-full ${nameMarginBottom}` }, 
                                        React.createElement('h3', { className: `font-bold ${nameColor} ${playerNameSize} mr-8 leading-none flex items-center` }, getPlayerDisplayName(p_target), React.createElement(WinTracker, { name: getPlayerDisplayName(p_target), type: 'player', sessionStats: sessionStats })),
                                        !isEliminated && React.createElement('p', { className: `${playerStatusColor} ${playerStatusSize} leading-none` }, isAssassin ? React.createElement('span', { className: "mr-1" }, assassinIcon) : null, playerStatusText)
                                    ),
                                    React.createElement('div', { className: `flex items-center w-full ${livesNumberMarginTop}` }, 
                                        React.createElement('div', { className: "w-3/5 flex justify-center items-center" }, 
                                            React.createElement('div', {className: `flex items-center ${livesSpacing}`}, 
                                                [...Array(KILLER_LIVES_START)].map((_, i) => {
                                                    const lifeLost = i < (KILLER_LIVES_START - (p_target.killer_lives || 0));
                                                    return React.createElement('span', { key: `life-${p_target.id}-${i}`, className: `${lifeIconSize} ${lifeLost ? 'text-slate-600 opacity-70' : (isAssassin ? 'text-red-300 animate-pulse' : 'text-green-400')}` }, lifeLost ? skullIcon : targetIcon);
                                                })
                                            )
                                        ),
                                        !isEliminated && React.createElement('div', { className: "w-2/5 flex justify-center items-center" }, React.createElement('p', { className: `font-black leading-none ${numberColor} ${playerNumberSize}` }, p_target.killer_number || React.createElement('span', {className: `text-slate-500 ${questionMarkSize}`}, "?") ))
                                    )
                                )
                            )
                        );
                    })
                )
            )
        );
    };

    const renderControllerViewKiller = () => {
        const largeButtonBase = "w-full text-xl font-bold rounded-lg shadow-md my-2 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center text-center leading-tight disabled:opacity-50 disabled:cursor-not-allowed";
        const playerListButtonClass = `${largeButtonBase} py-5 bg-sky-600 hover:bg-sky-500 text-white`;
        const actionButtonClass = `${largeButtonBase} py-5 bg-green-600 hover:bg-green-500 text-white`;
        const destructiveButtonClass = `${largeButtonBase} py-4 text-lg bg-red-600 hover:bg-red-500 text-white`;
        const navButtonClass = `${largeButtonBase} py-3 text-lg bg-blue-600 hover:bg-blue-500 text-white`;
        const undoButtonClass = `${largeButtonBase} py-4 text-lg bg-yellow-500 hover:bg-yellow-600 text-black`;
        const numberChoiceButtonClass = "aspect-square text-3xl rounded-lg font-bold transition-all p-2 shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center";
        const titleClass = "text-2xl md:text-3xl game-title-font text-yellow-300 font-semibold text-center mb-2 leading-tight";
        const subTitleClass = "text-base md:text-lg text-center text-slate-300 mb-3";
        
        if (gameState.gameOver){
             return React.createElement('div', { className: "flex flex-col items-center justify-center h-full p-3 text-center bg-slate-800 text-slate-100 font-sans rounded-lg" }, 
                React.createElement('h3', { className: `${titleClass} text-red-400` }, "GAME OVER"),
                gameState.winner && React.createElement('p', {className: `${subTitleClass} text-xl mt-1`}, `Winner: ${getPlayerDisplayName(gameState.winner)}`),
                React.createElement('button', { onClick: () => onGameEnd(false), className: `${largeButtonBase} py-4 bg-slate-500 hover:bg-slate-600 mt-4` }, "Close Controller")
            );
        }

        if (controllerView === 'NUMBER_SELECTION') {
            if (!actingPlayer) { 
                return React.createElement('div', { className: "flex flex-col h-full p-3 space-y-2 bg-slate-800 text-slate-100 font-sans rounded-lg" }, 
                    React.createElement('h3', { className: titleClass }, "Choose Player's Mark"),
                    React.createElement('p', { className: subTitleClass }, "Select a player to choose their number."),
                    React.createElement('div', {className: "w-full max-w-sm mx-auto flex-grow overflow-y-auto custom-scrollbar pr-1"},
                        participants.map(p => {
                            if (p.killer_number) { 
                                return React.createElement('div', { key: p.id, className: `${playerListButtonClass} opacity-70 flex justify-between items-center`}, React.createElement('span', null, getPlayerDisplayName(p)), React.createElement('span', {className: "text-2xl font-black ml-2"}, p.killer_number));
                            }
                            return React.createElement('button', { key: p.id, onClick: () => setActingPlayerId(p.id), className: playerListButtonClass, disabled: p.killer_is_eliminated }, getPlayerDisplayName(p), p.killer_is_eliminated ? " (Eliminated)" : "");
                        })
                    ),
                    canUndo && React.createElement('button', { onClick: handleUndo, className: `${undoButtonClass} mt-auto`}, "↩️ Undo")
                );
            } else { 
                return React.createElement('div', { className: "flex flex-col h-full p-2 bg-slate-800 text-slate-100 font-sans rounded-lg" }, 
                    React.createElement('h3', { className: titleClass }, `Set Mark for ${getPlayerDisplayName(actingPlayer)}`),
                    React.createElement('div', { className: "grid grid-cols-5 gap-2 my-auto w-full max-w-xs mx-auto" },
                        KILLER_NUMBERS_TO_CHOOSE_FROM.map(num => {
                            const isTakenByOther = participants.some(p => p.id !== actingPlayerId && p.killer_number === num);
                            return React.createElement('button', { key: num, onClick: () => handleChooseNumberForPlayer(num), disabled: isTakenByOther, className: `${numberChoiceButtonClass} ${isTakenByOther ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-60' : 'bg-sky-600 hover:bg-sky-500 text-white'}` }, num);
                        })
                    ),
                    React.createElement('button', { onClick: () => setActingPlayerId(null), className: `${navButtonClass} mt-2`}, "← Back to Player List")
                );
            }
        }

        if (controllerView === 'ACTION_MENU') {
            return React.createElement('div', { className: "flex flex-col items-center justify-center h-full p-3 space-y-3 bg-slate-800 text-slate-100 font-sans rounded-lg" }, 
                React.createElement('h3', { className: titleClass }, "Killer Actions"),
                React.createElement('div', {className: "w-full max-w-sm space-y-3"},
                    React.createElement('button', { onClick: () => setControllerView('BECOME_KILLER_SELECTION'), className: actionButtonClass }, assassinIcon + " Designate Killers"),
                    React.createElement('button', { onClick: () => setControllerView('MANAGE_LIVES'), className: actionButtonClass, disabled: activeKillers.length === 0 }, targetIcon + " Manage Lives", activeKillers.length === 0 ? " (No Killers Yet)" : ""),
                    canUndo && React.createElement('button', { onClick: handleUndo, className: undoButtonClass}, "↩️ Undo Last Action")
                )
            );
        }
        
        if (controllerView === 'BECOME_KILLER_SELECTION') {
            return React.createElement('div', { className: "flex flex-col h-full p-2 bg-slate-800 text-slate-100 font-sans overflow-y-auto custom-scrollbar rounded-lg" }, 
                React.createElement('h3', { className: titleClass }, "Designate Killers"),
                React.createElement('div', { className: "space-y-2 flex-grow mb-2 w-full max-w-md mx-auto" },
                    participants.map(p => {
                        const canBecomeKiller = p.killer_number && !p.killer_is_killer && !p.killer_is_eliminated;
                        return React.createElement('div', {key: p.id, className: `p-3 rounded-lg shadow flex justify-between items-center ${p.killer_is_killer ? 'bg-red-800/60' : 'bg-slate-700'}`}, 
                            React.createElement('span', {className: `text-lg ${p.killer_is_killer ? 'text-red-200 font-bold' : 'text-slate-100'}`}, getPlayerDisplayName(p), p.killer_is_killer ? ` ${assassinIcon} IS KILLER` : (p.killer_is_eliminated ? " (Eliminated)" : ` (#${p.killer_number || '?'})`)),
                            canBecomeKiller && React.createElement('button', { onClick: () => handlePlayerSpecificBecomeKiller(p.id), className: `${destructiveButtonClass} text-sm py-2 px-4 ml-2` }, "Make Killer")
                        );
                    })
                ),
                React.createElement('button', { onClick: () => setControllerView('ACTION_MENU'), className: `${navButtonClass} mt-auto w-full max-w-xs mx-auto`}, "← Back to Actions")
            );
        }

        if (controllerView === 'MANAGE_LIVES') {
            if (activeKillers.length === 0 && !gameState.gameOver) { 
                 setControllerView('ACTION_MENU'); 
                 return React.createElement('div', {className: "p-4 text-center bg-slate-800 text-slate-100 font-sans rounded-lg"}, "No active killers. Returning to menu..."); 
            }
            return React.createElement('div', { className: "flex flex-col h-full p-2 bg-slate-800 text-slate-100 font-sans overflow-y-auto custom-scrollbar rounded-lg" }, 
                React.createElement('h3', { className: titleClass }, "Manage Player Lives"),
                React.createElement('p', { className: subTitleClass }, "Tap a life (🎯) to remove it. Killers can attack anyone."),
                React.createElement('div', { className: "space-y-2 flex-grow mb-2 w-full max-w-md mx-auto" },
                    participants.map(p => {
                        const isEliminated = p.killer_is_eliminated;
                        const isKiller = p.killer_is_killer && !isEliminated;
                        const currentLives = typeof p.killer_lives === 'number' ? p.killer_lives : KILLER_LIVES_START;
                        return React.createElement('div', { key: p.id, className: `p-3 rounded-lg shadow ${isEliminated ? 'bg-slate-700 opacity-60' : (isKiller ? 'bg-red-900/50 border border-red-700' : 'bg-slate-700 border border-slate-600')}` },
                            React.createElement('p', { className: `text-xl font-semibold mb-1.5 ${isEliminated ? 'text-slate-400 line-through' : (isKiller ? 'text-red-300' : 'text-sky-300')}` }, getPlayerDisplayName(p) + (isKiller ? ` ${assassinIcon}` : "") + (isEliminated ? " (💀 ELIMINATED)" : ` (#${p.killer_number})`)),
                            !isEliminated && React.createElement('div', { className: "flex justify-center items-center space-x-2 sm:space-x-3 mt-2" },
                                [...Array(KILLER_LIVES_START)].map((_, i) => {
                                    const isLifeActive = i < currentLives; 
                                    const canTapToLoseLife = isLifeActive && !isEliminated && activeKillers.length > 0;
                                    return React.createElement('button', { key: `life-ctrl-${p.id}-${i}`, onClick: () => { if(canTapToLoseLife) handleControllerRemoveLifeForPlayer(p.id); }, disabled: !canTapToLoseLife, className: `text-5xl sm:text-6xl p-1.5 rounded transition-transform duration-100 ${canTapToLoseLife ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'cursor-not-allowed'} ${isLifeActive ? (isKiller ? 'text-red-300 hover:text-red-200' : 'text-green-400 hover:text-green-300') : 'text-slate-600 opacity-70'}`}, isLifeActive ? targetIcon : skullIcon);
                                })
                            )
                        );
                    })
                ),
                React.createElement('button', { onClick: () => setControllerView('ACTION_MENU'), className: `${navButtonClass} mt-auto w-full max-w-xs mx-auto`}, "← Back to Actions")
            );
        }
        
        return React.createElement('div', {className: "p-4 text-center bg-slate-800 text-slate-100 h-full flex flex-col justify-center items-center rounded-lg"}, 
             React.createElement('p', {className: "text-xl"}, "Loading Controller Interface..."),
             React.createElement('button', {onClick: () => { setControllerView('NUMBER_SELECTION'); setActingPlayerId(null);}, className: `${navButtonClass} mt-4 w-auto px-6`}, "Reset View")
        );
    };

    if (displayRole === 'controller') {
        return renderControllerViewKiller();
    } else {
        return renderMainDisplayViewKiller(); 
    }
};
