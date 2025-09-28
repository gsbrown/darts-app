/*
around_the_world.js - Around The World Game Component
REVAMPED: Updated to handle the new "all-teams" participant structure.
UI TWEAK: Moved "Current Thrower" to the main header and removed redundant in-row shooter text for a cleaner look.
UI TWEAK 2: Added prominent objective display in each player's row and moved SB Hits info for better clarity.
UI TWEAK 3: Simplified the controller UI to have direct "Record Hit" and "End Turn" actions.
FIX: Restored original "Missed Target" logic to the "End Turn" button to ensure functionality.
*/

// Ensure React is available globally
const PLAYER_COLORS_ATW = [
    'bg-red-700/70', 'bg-blue-700/70', 'bg-green-700/70', 'bg-cyan-700/70',
    'bg-purple-700/70', 'bg-pink-700/70', 'bg-teal-700/70', 'bg-orange-600/70'
];

// Icons
const ICON_UNDO_ATW = "↩️";
const ICON_RECORD_HIT_ATW = "✔️";
const ICON_WINNER_ATW = "🏆";
const ICON_END_TURN_ATW = "➡️";


const AroundTheWorldGame = ({ gameMode, onGameEnd, socket, gameState, displayRole, sessionStats }) => {
    // --- 1. Initial Game State Validation ---
    if (!gameState || typeof gameState !== 'object' || gameState.mode !== 'AROUND_THE_WORLD' ||
        !Array.isArray(gameState.participants)) {
        console.error("AroundTheWorldGame: Invalid or incomplete gameState", gameState);
        return React.createElement('div', { className: "p-10 text-center text-red-500 text-3xl sm:text-4xl" }, "Loading ATW Game State or Invalid State...");
    }

    // --- 3. Destructure Game State Properties ---
    const {
        participants = [],
        currentPlayerIndex,
        currentPlayerTurnInTeam,
        showAroundTheWorldActionPrompt,
        showATWObjectiveSelectorModal,
        history,
        ATW_TARGET_QUALIFY_SB,
        ATW_TARGET_WIN_DB,
        ATW_LOGICAL_WIN_VIA_SB,
        ATW_LOGICAL_WIN_VIA_DB,
        ATW_OBJECTIVES_NUMBERS_MAX,
    } = gameState;

    // --- 4. Current Player and Undo Logic ---
    const currentParticipant = participants[currentPlayerIndex];
    const canUndo = history && Array.isArray(history) && history.length > 1 && !showATWObjectiveSelectorModal;

    // --- 5. Helper Functions ---
    const getDisplayTarget = (participant) => {
        if (!participant) return 'N/A';
        if (participant.atw_isWinner) return ICON_WINNER_ATW;
    
        const targetValue = participant.atw_currentTargetValue;
    
        // If the target is a number, display the number.
        if (targetValue >= 1 && targetValue <= ATW_OBJECTIVES_NUMBERS_MAX) {
            return String(targetValue);
        }
        
        // If the target is beyond the numbers (e.g., 21 or 22)
        if (targetValue > ATW_OBJECTIVES_NUMBERS_MAX) {
            // If they have hit at least one SB, their next objective is the DB.
            if (participant.atw_has_hit_sb_this_game) {
                return 'DB';
            } else {
                // Otherwise, their next objective is the first SB.
                return 'SB';
            }
        }
        
        // Handle logical win values that might not have set the isWinner flag yet
        if (targetValue === ATW_LOGICAL_WIN_VIA_SB || targetValue === ATW_LOGICAL_WIN_VIA_DB) {
            return ICON_WINNER_ATW;
        }
    
        return 'N/A'; // Fallback
    };

    const getPlayerDisplayName = (participant, teamMemberIndexIfApplicable) => {
        if (!participant) return "Unknown Player";
        let name = participant.name || `Team ${participants.findIndex(p=>p.id === participant.id) + 1}`;
        if (participant.players && typeof teamMemberIndexIfApplicable === 'number' && participant.players[teamMemberIndexIfApplicable]) {
            name += ` (${participant.players[teamMemberIndexIfApplicable]})`;
        }
        return name;
    };

    const ATW_REPORTED_VALUE_SB_CONST = 25;
    const ATW_REPORTED_VALUE_DB_CONST = 50;
    const ATW_REPORTED_VALUE_MISS_CONST = 0;
    const MAX_SB_HITS_FOR_WIN = gameState.ATW_MAX_SB_HITS_FOR_WIN || 5;

    // --- 6. Event Handlers ---
    const handleRequestObjectiveEntry = () => {
        if (socket && currentParticipant && !currentParticipant.atw_isWinner &&
            showAroundTheWorldActionPrompt && showAroundTheWorldActionPrompt.participantIndex === currentPlayerIndex) {
            socket.emit('aroundTheWorldClientRequestsObjectiveModal');
        }
    };
    const handleObjectiveSelected = (reportedValue) => {
        if (socket && currentParticipant && !currentParticipant.atw_isWinner) {
            socket.emit('aroundTheWorldTurnResult', { reportedValue: reportedValue });
        }
    };

    // Correctly handle ending the turn, which is equivalent to reporting a "miss"
    const handleEndTurn = () => {
        if (socket && currentParticipant && !currentParticipant.atw_isWinner) {
            socket.emit('aroundTheWorldTurnResult', { reportedValue: ATW_REPORTED_VALUE_MISS_CONST });
        }
    };

    const handleCancelObjectiveSelector = () => {
        if (socket && showATWObjectiveSelectorModal) {
             socket.emit('aroundTheWorldCancelObjectiveEntry');
        }
    };
    const handleUndo = () => { if (socket && canUndo) socket.emit('undoLastAction'); };

    // --- 7. Dynamic Sizing Logic ---
    const numPlayers = participants.length;
    let stylesConfig;
    if (numPlayers <= 2) { stylesConfig = { cardPadding: 'p-4 sm:p-5 md:p-6', playerNameSize: 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl', teamMemberSize: 'text-2xl sm:text-3xl md:text-4xl', sbHitsSize: 'text-5xl sm:text-6xl md:text-6xl', targetIconSize: 'text-7xl sm:text-8xl md:text-9xl', targetTextSize: 'text-8xl sm:text-9xl md:text-[10rem] lg:text-[11rem]', lastActionSize: 'text-xl sm:text-2xl md:text-3xl', modalTitleSize: 'text-3xl sm:text-4xl md:text-5xl', modalButtonPY: 'py-4 sm:py-5 md:py-6', modalButtonText: 'text-2xl sm:text-3xl md:text-4xl', modalBottomButtonPY: 'py-3 sm:py-4 md:py-5', modalBottomButtonText: 'text-xl sm:text-2xl md:text-3xl', gapBetweenCards: 'gap-4 sm:gap-5 md:gap-6', mainTitleIconSize: 'text-3xl sm:text-4xl md:text-5xl', mainTitleTextSize: 'text-4xl sm:text-5xl md:text-6xl', mainTitleMarginBottom: 'mb-2 sm:mb-3 md:mb-4', };}
    else if (numPlayers <= 4) { stylesConfig = { cardPadding: 'p-3 sm:p-4 md:p-5', playerNameSize: 'text-3xl sm:text-4xl md:text-5xl', teamMemberSize: 'text-xl sm:text-2xl md:text-3xl', sbHitsSize: 'text-4xl sm:text-5xl md:text-5xl', targetIconSize: 'text-6xl sm:text-7xl md:text-8xl', targetTextSize: 'text-7xl sm:text-8xl md:text-9xl', lastActionSize: 'text-lg sm:text-xl md:text-2xl', modalTitleSize: 'text-2xl sm:text-3xl md:text-4xl', modalButtonPY: 'py-3.5 sm:py-4.5 md:py-5.5', modalButtonText: 'text-xl sm:text-2xl md:text-3xl', modalBottomButtonPY: 'py-3 sm:py-3.5 md:py-4.5', modalBottomButtonText: 'text-lg sm:text-xl md:text-2xl', gapBetweenCards: 'gap-3 sm:gap-4 md:gap-5', mainTitleIconSize: 'text-2xl sm:text-3xl md:text-4xl', mainTitleTextSize: 'text-3xl sm:text-4xl md:text-5xl', mainTitleMarginBottom: 'mb-1 sm:mb-2 md:mb-3', };}
    else if (numPlayers <= 6) { stylesConfig = { cardPadding: 'p-2 sm:p-3 md:p-4', playerNameSize: 'text-2xl sm:text-3xl md:text-4xl', teamMemberSize: 'text-lg sm:text-xl md:text-2xl', sbHitsSize: 'text-3xl sm:text-4xl md:text-4xl', targetIconSize: 'text-5xl sm:text-6xl md:text-7xl', targetTextSize: 'text-6xl sm:text-7xl md:text-8xl', lastActionSize: 'text-base sm:text-lg md:text-xl', modalTitleSize: 'text-xl sm:text-2xl md:text-3xl', modalButtonPY: 'py-3 sm:py-4', modalButtonText: 'text-lg sm:text-xl md:text-2xl', modalBottomButtonPY: 'py-2.5 sm:py-3', modalBottomButtonText: 'text-base sm:text-lg md:text-xl', gapBetweenCards: 'gap-2 sm:gap-3 md:gap-4', mainTitleIconSize: 'text-xl sm:text-2xl md:text-3xl', mainTitleTextSize: 'text-2xl sm:text-3xl md:text-4xl', mainTitleMarginBottom: 'mb-1 sm:mb-1.5 md:mb-2', };}
    else { stylesConfig = { cardPadding: 'p-2 sm:p-2.5', playerNameSize: 'text-lg sm:text-xl md:text-2xl', teamMemberSize: 'text-sm sm:text-base md:text-lg', sbHitsSize: 'text-2xl sm:text-3xl md:text-3xl', targetIconSize: 'text-3xl sm:text-4xl md:text-5xl', targetTextSize: 'text-4xl sm:text-5xl md:text-6xl', lastActionSize: 'text-xs sm:text-sm md:text-base', modalTitleSize: 'text-lg sm:text-xl', modalButtonPY: 'py-2 sm:py-2.5', modalButtonText: 'text-base sm:text-lg', modalBottomButtonPY: 'py-1.5 sm:py-2', modalBottomButtonText: 'text-sm sm:text-base', gapBetweenCards: 'gap-1 sm:gap-1.5 md:gap-2', mainTitleIconSize: 'text-lg sm:text-xl md:text-2xl', mainTitleTextSize: 'text-xl sm:text-2xl md:text-3xl', mainTitleMarginBottom: 'mb-0.5 sm:mb-1 md:mb-1.5', };}

    const AtwObjectiveSelectorModalSimplified = ({ onSelect, onCancel, currentTargetValueForDisplay, currentPlayerHasHitSb }) => {
        const objectivesToSelect = [];
        for (let i = 1; i <= ATW_OBJECTIVES_NUMBERS_MAX; i++) objectivesToSelect.push({ display: String(i), valueToSend: i });
        objectivesToSelect.push({ display: 'SB', valueToSend: ATW_REPORTED_VALUE_SB_CONST });
        objectivesToSelect.push({ display: 'DB', valueToSend: ATW_REPORTED_VALUE_DB_CONST });

        const modalStyles = displayRole === 'controller' ? {
            titleSize: 'text-xl font-bold mb-2 game-title-font text-yellow-300 text-center',
            objectiveButtonClasses: 'py-3.5 px-2 text-xl',
            bottomButtonClasses: 'py-3 px-4 text-lg',
            gridContainerClasses: 'grid grid-cols-4 gap-2',
            padding: 'p-3',
            maxWidth: 'max-w-xs sm:max-w-sm'
        } : {
            titleSize: `${stylesConfig.modalTitleSize} font-bold mb-4 sm:mb-6 game-title-font text-yellow-300 text-center`,
            objectiveButtonClasses: `${stylesConfig.modalButtonPY} ${stylesConfig.modalButtonText} px-1 sm:px-2`,
            bottomButtonClasses: `${stylesConfig.modalBottomButtonPY} ${stylesConfig.modalBottomButtonText} px-4 sm:px-6`,
            gridContainerClasses: 'grid grid-cols-4 sm:grid-cols-5 gap-2',
            padding: stylesConfig.cardPadding,
            maxWidth: 'max-w-md sm:max-w-lg'
        };
        
        const aimingFor = getDisplayTarget({
            atw_currentTargetValue: currentTargetValueForDisplay,
            atw_has_hit_sb_this_game: currentPlayerHasHitSb
        });

        return (
            React.createElement('div', { className: "fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2" },
                React.createElement('div', { className: `bg-gray-800 ${modalStyles.padding} rounded-xl shadow-2xl w-full ${modalStyles.maxWidth} max-h-[90vh] overflow-y-auto flex flex-col` },
                    React.createElement('h3', { className: modalStyles.titleSize }, `Report Hit (Aiming: ${aimingFor})`),
                    React.createElement('div', { className: `${modalStyles.gridContainerClasses} mb-3 flex-grow` },
                        objectivesToSelect.map(obj => {
                            let btnClass = `text-white font-bold ${modalStyles.objectiveButtonClasses} rounded-md transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 flex items-center justify-center`;
                            if (obj.display === 'SB') btnClass += ' bg-amber-500 hover:bg-amber-600 text-black focus:ring-amber-400';
                            else if (obj.display === 'DB') btnClass += ' bg-rose-500 hover:bg-rose-600 focus:ring-rose-400';
                            else btnClass += ' bg-sky-600 hover:bg-sky-700 focus:ring-sky-400';
                            return React.createElement('button', { key: obj.valueToSend, onClick: () => onSelect(obj.valueToSend), className: btnClass }, obj.display);
                        })
                    ),
                    React.createElement('div', { className: "flex justify-center items-center mt-auto pt-3 border-t border-gray-700" },
                        React.createElement('button', { onClick: onCancel, className: `w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-semibold ${modalStyles.bottomButtonClasses} rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400` }, "Cancel")
                    )
                )
            )
        );
    };

    const shouldShowModal = !!showATWObjectiveSelectorModal && displayRole === 'controller' && showATWObjectiveSelectorModal.participantIndex === currentPlayerIndex && currentParticipant && !currentParticipant.atw_isWinner;

    const renderControllerViewAroundTheWorld = () => {
        const controllerButtonClass = "flex-1 text-lg font-bold rounded-lg shadow-md transition-transform hover:scale-105 active:scale-95 flex items-center justify-center text-center leading-tight p-4";
        const controllerInfoTextClass = "text-base text-center text-slate-300 mb-1";
        const controllerPlayerNameClass = "text-xl game-title-font text-yellow-300 font-semibold text-center mb-1 leading-tight";
        const controllerTargetClass = "text-6xl font-black text-sky-300 my-2 text-center";

        if (!currentParticipant) {
            return React.createElement('div', { className: "flex items-center justify-center h-full p-4 bg-slate-800 rounded-lg" }, React.createElement('p', { className: controllerInfoTextClass }, "Waiting for player data..."));
        }

        const displayName = getPlayerDisplayName(currentParticipant, currentPlayerTurnInTeam);
        const playerTargetDisplay = getDisplayTarget(currentParticipant);
        const isWinner = currentParticipant.atw_isWinner === true;
        const showPlayerActionButtons = !isWinner && showAroundTheWorldActionPrompt && showAroundTheWorldActionPrompt.participantIndex === currentPlayerIndex && !shouldShowModal;

        return React.createElement('div', { className: "flex flex-col h-full p-3 bg-slate-800 rounded-lg" },
            React.createElement('div', { className: "flex-grow flex flex-col items-center justify-center" },
                React.createElement('div', { className: "text-center w-full" },
                    React.createElement('h3', { className: controllerPlayerNameClass }, `Turn: ${displayName}`),
                    isWinner ?
                        React.createElement('p', { className: `${controllerTargetClass} text-emerald-400 animate-pulse` }, ICON_WINNER_ATW) :
                        React.createElement('p', { className: controllerTargetClass }, playerTargetDisplay),
                    currentParticipant.atw_has_hit_sb_this_game && !isWinner && React.createElement('p', {className: `${controllerInfoTextClass} text-orange-300`}, "🔥 SB Qualified! Aim for DB!")
                )
            ),
            React.createElement('div', { className: "w-full max-w-md mx-auto flex flex-row items-stretch justify-center gap-3 shrink-0 pt-4" },
                showPlayerActionButtons && React.createElement(React.Fragment, null,
                    React.createElement('button', {
                        onClick: handleRequestObjectiveEntry,
                        className: `${controllerButtonClass} bg-teal-500 hover:bg-teal-600 text-white`
                    }, ICON_RECORD_HIT_ATW + " Record Hit"),
                    React.createElement('button', {
                        onClick: handleEndTurn,
                        className: `${controllerButtonClass} bg-slate-600 hover:bg-slate-700 text-white`
                    }, ICON_END_TURN_ATW + " End Turn")
                ),
                canUndo && React.createElement('button', {
                    onClick: handleUndo,
                    className: `${controllerButtonClass} bg-yellow-500 hover:bg-yellow-600 text-black`
                }, ICON_UNDO_ATW + " Undo")
            ),
            shouldShowModal && React.createElement(AtwObjectiveSelectorModalSimplified, {
                onSelect: handleObjectiveSelected,
                onCancel: handleCancelObjectiveSelector,
                currentTargetValueForDisplay: showATWObjectiveSelectorModal.currentTargetValue,
                currentPlayerHasHitSb: currentParticipant.atw_has_hit_sb_this_game
            })
        );
    };

    const renderMainDisplayViewAroundTheWorld = () => {
        const currentThrowerName = currentParticipant?.players?.[currentPlayerTurnInTeam];

        const renderHeader = () => {
             return React.createElement('div', { className: "flex-shrink-0 p-2 text-center bg-slate-900 border-b-2 border-slate-800" },
                currentThrowerName ?
                React.createElement(React.Fragment, null,
                    React.createElement('p', { className: `text-slate-300 ${stylesConfig.teamMemberSize}` }, "Current Thrower"),
                    React.createElement('p', { className: `text-sky-300 font-bold game-title-font ${stylesConfig.playerNameSize}` }, currentThrowerName)
                ) :
                // Fallback title to prevent layout shift
                React.createElement('div', { className: `h-[60px] sm:h-[76px] flex items-center justify-center font-bold game-title-font text-yellow-300 text-center ${stylesConfig.mainTitleMarginBottom}`},
                    React.createElement('span', { className: `${stylesConfig.mainTitleIconSize} mr-1 sm:mr-2` }, "🌍"),
                    React.createElement('span', { className: stylesConfig.mainTitleTextSize }, "Around The World"),
                    React.createElement('span', { className: `${stylesConfig.mainTitleIconSize} ml-1 sm:ml-2` }, "🎯")
                )
            );
        };
        
        return (
            React.createElement('div', { className: "around-the-world-game-area w-full px-0.5 sm:px-1 py-1 flex flex-col h-full bg-slate-900 text-slate-100" },
            renderHeader(),
            React.createElement('div', { className: `flex flex-col flex-grow min-h-0 overflow-y-auto custom-scrollbar ${stylesConfig.gapBetweenCards}` },
                participants.map((p, index) => {
                    if (!p || typeof p !== 'object') return null;
                    const isCurrentTurnPlayer = index === currentPlayerIndex;
                    const isWinner = p.atw_isWinner === true;
                    const hitsLog = Array.isArray(p.atw_hitsLog) ? p.atw_hitsLog : [];
                    const sbHitCount = p.atw_sb_hit_count || 0;
                    const hasHitSbThisGame = p.atw_has_hit_sb_this_game === true;

                    let playerCardBg = PLAYER_COLORS_ATW[index % PLAYER_COLORS_ATW.length];
                    let nameAndTargetColor = 'text-white';

                    if (isCurrentTurnPlayer && !shouldShowModal) playerCardBg = 'bg-indigo-600';
                    if (isWinner) playerCardBg = "bg-emerald-600";

                    let ringStyle = 'ring-1 ring-gray-700';
                    let scaleStyle = 'transform scale-100';
                    let extraShadow = 'shadow-lg';
                    if (isWinner) { ringStyle = "ring-2 sm:ring-4 ring-emerald-400"; extraShadow = "shadow-2xl shadow-emerald-500/50"; }
                    else if (isCurrentTurnPlayer && !shouldShowModal) { ringStyle = "ring-2 sm:ring-4 ring-yellow-400"; extraShadow = "shadow-xl sm:shadow-2xl shadow-yellow-500/50"; scaleStyle = 'transform scale-100 sm:scale-102'; }

                    let cardClasses = `atw-player-card ${playerCardBg} ${ringStyle} ${scaleStyle} ${extraShadow} rounded-lg sm:rounded-xl flex transition-all duration-300 ease-in-out overflow-hidden ${stylesConfig.cardPadding}`;
                    const lastActionDisplayFromLog = hitsLog.length > 0 ? (hitsLog[hitsLog.length - 1].display || 'N/A') : 'None';
                    const currentTargetDisplay = getDisplayTarget(p);

                    const renderSbHitIcons = () => {
                        const icons = [];
                        for (let i = 0; i < MAX_SB_HITS_FOR_WIN; i++) {
                            const isHit = sbHitCount > i;
                            const starClass = isHit ? `text-yellow-400 animate-bounce` : `text-gray-600 opacity-70`;
                            const starIcon = isHit ? '★' : '☆';
                            icons.push(React.createElement('span', { key: `sb-hit-${p.id}-${i}`, className: `mx-0.5 ${starClass} leading-none`, style:{fontSize: stylesConfig.sbHitsSize} }, starIcon));
                        }
                        return icons;
                    };

                    return ( React.createElement('div', { key: p.id || index, className: cardClasses },
                        React.createElement('div', { className: "flex flex-row justify-between items-center w-full h-full" },
                            // Left side content
                            React.createElement('div', { className: "flex-grow pr-2 flex flex-col justify-center" },
                                // Top row: Player name and SB hits
                                React.createElement('div', { className: "flex items-baseline gap-x-3 sm:gap-x-4" },
                                    React.createElement('div', { className: `atw-player-name truncate font-bold ${nameAndTargetColor} ${stylesConfig.playerNameSize}`, style: { lineHeight: '1.1' } }, 
                                        getPlayerDisplayName(p),
                                        React.createElement(WinTracker, { name: p.name, type: 'team', sessionStats: sessionStats })
                                    ),
                                    React.createElement('div', { className: `${nameAndTargetColor} opacity-90 font-medium ${stylesConfig.sbHitsSize} flex items-center shrink-0` }, 
                                        React.createElement('span', { className: "mr-1 sm:mr-2 text-sm sm:text-base md:text-lg self-center leading-none tracking-tighter" }, "SB:"), 
                                        renderSbHitIcons()
                                    )
                                ),
                                // Bottom row: Other info
                                React.createElement('div', { className: "mt-1" },
                                    hasHitSbThisGame && !isWinner && React.createElement('span', { className: `mr-3 text-orange-300 ${stylesConfig.teamMemberSize} font-semibold` }, "🔥 Qualified"),
                                    React.createElement('span', { className: `${nameAndTargetColor} opacity-80 font-medium ${stylesConfig.lastActionSize} leading-tight` }, 
                                        React.createElement('span', {className: "font-bold"}, "Last: "), lastActionDisplayFromLog
                                    )
                                )
                            ),
                            // Right side content (The Objective)
                            React.createElement('div', { className: `flex-shrink-0 font-black ${nameAndTargetColor} ${stylesConfig.targetTextSize} flex items-center justify-center p-2`, style: {lineHeight: 1}},
                                isWinner ? 
                                React.createElement('span', { className: 'animate-pulse' }, ICON_WINNER_ATW) : 
                                React.createElement('span', {}, currentTargetDisplay)
                            )
                        )
                    ));
                })
            ),
            shouldShowModal && currentParticipant && React.createElement(AtwObjectiveSelectorModalSimplified, {
                onSelect: handleObjectiveSelected,
                onCancel: handleCancelObjectiveSelector,
                currentTargetValueForDisplay: showATWObjectiveSelectorModal.currentTargetValue,
                currentPlayerHasHitSb: currentParticipant.atw_has_hit_sb_this_game
            })
        ));
    };

    if (displayRole === 'controller') {
        return renderControllerViewAroundTheWorld();
    } else {
        return renderMainDisplayViewAroundTheWorld();
    }
};


