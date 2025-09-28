// cricket.js - Cricket Game Component
// ENHANCED: Controller UI now mirrors main display for marks and shows score confirmations.
// POLISHED: The turn indicator pop-up is now a narrower, centered element with a single directional arrow to avoid obscuring game info.
// FIX: Positioned the pop-up at the top of the screen between the score boxes.

// Assumes React, Keypad component are available globally

const CRICKET_CLOSABLE_OBJECTIVES_IN_CRICKET_GAME = ["20", "19", "18", "17", "16", "15", "B"];
// Define objectives for the controller grid
const CRICKET_CONTROLLER_OBJECTIVES = ["20", "19", "18", "17", "16", "15", "B", "D", "T"];

// New component to manage its own lifecycle for animations
const ScorePopup = ({ score, index, onComplete }) => {
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onComplete(); // Notify parent to remove this from the state
        }, 2500); // Lifetime of the popup

        return () => clearTimeout(timer);
    }, [onComplete]);
    
    const isScore = typeof score === 'number';
    const displayText = isScore ? `+${score}` : score;
    const textColor = isScore ? 'text-green-400' : 'text-sky-400';

    return React.createElement('div', {
        className: 'absolute animate-fade-out-score',
        style: {
            transform: `translateY(-${index * 45}px)`,
            animationDelay: `${index * 0.2}s`
        }
    },
    React.createElement('span', {
        className: `text-5xl font-black ${textColor} animate-pop-in-score`,
        style: {
            animationDelay: `${index * 0.2}s`,
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }
    }, displayText)
    );
};

// NEW: Central pop-up for the current thrower with directional arrow
const CricketCurrentThrowerPopup = ({ currentThrowerName, currentTeamName, positionIndex, totalPlayers, leftSlotsCount }) => {
    if (!currentThrowerName || !currentTeamName) return null;

    const side = positionIndex < leftSlotsCount ? 'left' : 'right';
    const arrow = totalPlayers > 1 ? (side === 'left' ? '◄' : '►') : null;

    return React.createElement('div', {
        // POLISHED: Positioned the pop-up at the top of the page.
        className: 'absolute top-8 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-30 w-full'
    },
        React.createElement('div', {
            // POLISHED: Made narrower and adjusted padding.
            className: 'p-3 bg-black/80 backdrop-blur-sm rounded-xl border-2 border-sky-400 shadow-2xl w-full max-w-xs mx-auto animate-fade-in-pop'
        },
            // POLISHED: Use justify-center and a single arrow for a more compact design.
            React.createElement('div', { className: 'flex items-center justify-center' },
                (arrow && side === 'left') && React.createElement('div', { className: `text-sky-300 text-6xl font-bold` }, arrow),
                
                React.createElement('div', { className: 'text-center' },
                    React.createElement('p', { className: "text-slate-200 text-2xl" }, "Thrower:"),
                    React.createElement('p', { className: "text-sky-300 text-6xl font-bold leading-tight" }, currentThrowerName),
                    React.createElement('p', { className: "text-slate-300 text-xl" }, `(Team: ${currentTeamName})`)
                ),

                (arrow && side === 'right') && React.createElement('div', { className: `text-sky-300 text-6xl font-bold` }, arrow)
            )
        )
    );
};


const CricketGame = ({ gameMode, onGameEnd, socket, gameState, displayRole, sessionStats }) => {
    // --- Controller Specific State ---
    const initialScorerIdForController = (displayRole === 'controller' && gameState && gameState.participants && gameState.participants[gameState.currentPlayerIndex])
                                        ? gameState.participants[gameState.currentPlayerIndex].id
                                        : null;
    const [selectedScorerId, setSelectedScorerId] = React.useState(initialScorerIdForController);
    // NEW: State for showing points scored on the controller - now an array for multiple popups
    const [scorePopups, setScorePopups] = React.useState([]);
    const prevGameStateRef = React.useRef();

    // --- 1. Initial Game State Validation ---
    if (!gameState || gameState.mode !== 'CRICKET' || !gameState.participants || !gameState.objectives) {
        console.error("CricketGame: Invalid or incomplete gameState", gameState);
        return React.createElement('div', { className: "p-8 text-center text-red-500 font-sans" }, "Loading Cricket Game State or Invalid State...");
    }

    // --- 2. Destructure Game State Properties & Determine Actual Current Player ---
    const { objectives, participants, currentPlayerIndex, currentPlayerTurnInTeam, showKeypadFor, history } = gameState;
    const actualServerCurrentParticipant = participants[currentPlayerIndex];
    const actualServerCurrentParticipantId = actualServerCurrentParticipant ? actualServerCurrentParticipant.id : null;

    // --- Sync selectedScorerId with server's current player for controller ---
    React.useEffect(() => {
        if (displayRole === 'controller') {
            const serverCurrentPlayerId = participants[currentPlayerIndex]?.id;
            if (serverCurrentPlayerId && !showKeypadFor) {
                if (selectedScorerId !== serverCurrentPlayerId) {
                     console.log(`[CricketController] Server's current player is ${participants[currentPlayerIndex]?.name}. Updating view to this player.`);
                    setSelectedScorerId(serverCurrentPlayerId);
                }
            } else if (!serverCurrentPlayerId && selectedScorerId !== null) {
                setSelectedScorerId(null);
            }
        }
    }, [currentPlayerIndex, displayRole, showKeypadFor, participants, selectedScorerId]);

    // NEW: Effect to detect and display points scored for the controller
    React.useEffect(() => {
        if (displayRole !== 'controller') return;

        const prevGameState = prevGameStateRef.current;
        if (prevGameState && gameState && prevGameState.history.length < gameState.history.length) {
            let scoreChanged = false;
            // Find which player's score changed
            for (let i = 0; i < gameState.participants.length; i++) {
                const currentParticipant = gameState.participants[i];
                const prevParticipant = prevGameState.participants.find(p => p.id === currentParticipant.id);
                if (currentParticipant && prevParticipant) {
                    const scoreDiff = currentParticipant.score - prevParticipant.score;
                    if (scoreDiff > 0) {
                        const newPopup = {
                            score: scoreDiff,
                            id: Date.now() + Math.random(), // Unique ID for the element
                            participantId: currentParticipant.id
                        };
                        setScorePopups(prev => [...prev, newPopup]);
                        scoreChanged = true;
                        break; // A score change is the primary feedback, so we stop here.
                    }
                }
            }

            // If no score change, check for D or T mark for the player who just acted.
            const actingPlayerIndex = prevGameState.currentPlayerIndex;
            
            if (!scoreChanged && actingPlayerIndex !== undefined) {
                 const prevPlayerState = prevGameState.participants[actingPlayerIndex];
                 const currentPlayerState = gameState.participants.find(p => p.id === prevPlayerState?.id);
                 
                 if (prevPlayerState && currentPlayerState) {
                    const prevMarksD = prevPlayerState.marks['D'] || 0;
                    const currentMarksD = currentPlayerState.marks['D'] || 0;
                    const prevMarksT = prevPlayerState.marks['T'] || 0;
                    const currentMarksT = currentPlayerState.marks['T'] || 0;

                    let popupText = null;
                    if (currentMarksD > prevMarksD) {
                        popupText = 'Double';
                    } else if (currentMarksT > prevMarksT) {
                        popupText = 'Triple';
                    }

                    if (popupText) {
                         const newPopup = {
                            score: popupText, // Use text instead of number
                            id: Date.now() + Math.random(),
                            participantId: currentPlayerState.id
                        };
                        setScorePopups(prev => [...prev, newPopup]);
                    }
                 }
            }
        }
        // Deep copy the game state for reliable comparison next time
        prevGameStateRef.current = JSON.parse(JSON.stringify(gameState));
    }, [gameState, displayRole]);
    
    // Callback for when a popup animation completes
    const handlePopupComplete = React.useCallback((popupId) => {
        setScorePopups(prev => prev.filter(p => p.id !== popupId));
    }, []);

    // --- Helper: Find Participant Index by ID (for controller) ---
    const getParticipantIndexById = (id) => {
        if (!id) return -1;
        return participants.findIndex(p => p.id === id);
    };

    const participantToDisplayId = displayRole === 'controller' ? (selectedScorerId || actualServerCurrentParticipantId) : null;
    const participantToDisplayIndex = participantToDisplayId ? getParticipantIndexById(participantToDisplayId) : -1;
    const participantToDisplay = participantToDisplayIndex !== -1 ? participants[participantToDisplayIndex] : null;

    // --- Event Handlers ---
    const handleObjectiveClickController = (objectiveName) => {
        if (socket && participantToDisplayId && actualServerCurrentParticipantId) {
            if (participantToDisplayId === actualServerCurrentParticipantId) {
                socket.emit('cricketMark', {
                    participantIndex: currentPlayerIndex,
                    objectiveName: objectiveName
                });
            } else {
                console.warn(`[CricketController] Mark attempt for ${participantToDisplay?.name} but it's ${actualServerCurrentParticipant?.name}'s turn. Action blocked.`);
            }
        }
    };

    const handleKeypadSubmit = (score) => {
        if (socket && showKeypadFor) {
            if (showKeypadFor.participantIndex === currentPlayerIndex) {
                socket.emit('submitCricketScore', { score });
            } else {
                socket.emit('cancelCricketKeypad');
            }
        }
    };

    const handleKeypadCancel = () => {
        if (socket && showKeypadFor) socket.emit('cancelCricketKeypad');
    };

    const handleUndo = () => {
        if (socket && history && history.length > 1) {
            socket.emit('undoLastAction');
        }
    };

    const handleSelectScorerController = (participantId) => {
        setSelectedScorerId(participantId);
    };

    const handleEndTurnController = () => {
        if (socket && actualServerCurrentParticipantId) {
            socket.emit('cricketControllerEndTurn', { participantId: actualServerCurrentParticipantId });
        }
    };

    // --- UI Helper Functions ---
    const getMarkDisplay = (markCount, isPlayerClosedThis, isFullyClosedForAllObjective) => {
        const markBaseStyle = "font-black flex items-center justify-center h-full w-full";
        if (markCount === 0) return React.createElement('span', {className: `text-slate-500 text-4xl sm:text-5xl md:text-6xl ${markBaseStyle}`}, '○');
        if (markCount === 1) return React.createElement('span', {className: `text-sky-400 text-5xl sm:text-6xl md:text-7xl ${markBaseStyle}`}, '/');
        if (markCount === 2) return React.createElement('span', {className: `text-blue-400 text-6xl sm:text-7xl md:text-8xl ${markBaseStyle}`}, 'X');
        
        if (markCount >= 3) {
            const xMarkSize = "text-7xl sm:text-8xl md:text-9xl";
            let circleAndXContainerClasses = `flex items-center justify-center rounded-full w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 border-4 transition-colors duration-300`;
            let xStyle = `font-black ${xMarkSize}`;

            if (isFullyClosedForAllObjective) {
                circleAndXContainerClasses += " border-red-500 bg-slate-800/50";
                xStyle += " text-red-500";
            } else if (isPlayerClosedThis) {
                circleAndXContainerClasses += " border-lime-400 bg-green-900/50";
                xStyle += " text-lime-400";
            }

            return React.createElement('div', { className: circleAndXContainerClasses },
                React.createElement('span', { className: xStyle }, 'X')
            );
        }
        
        return React.createElement('span', {className: `text-slate-500 text-4xl sm:text-5xl md:text-6xl ${markBaseStyle}`}, '○');
    };

    const getPlayerDisplayName = (participant, isHeaderContext = false, participantOriginalIndexIfKnown = -1, forController = false) => {
        if (!participant) return "";
        let baseName = participant.name;

        if (participant.type === 'team' && participant.players && Array.isArray(participant.players)) {
            const teamMemberIndexToDisplay = (displayRole === 'controller' && participant.id === actualServerCurrentParticipantId) ? gameState.currentPlayerTurnInTeam : 0; 
            const teamMemberName = participant.players[teamMemberIndexToDisplay];
            if (forController) {
                 baseName = teamMemberName ? `${participant.name} (${teamMemberName})` : `${participant.name} (P${teamMemberIndexToDisplay + 1})`;
            } else { 
                baseName = participant.name;
            }
        }

        if (forController) return baseName;

        if (participants.length > 4 && isHeaderContext) {
            let nameToAbbreviate = participant.name || `Team ${participantOriginalIndexIfKnown + 1}`;
            const nameParts = String(nameToAbbreviate).trim().split(/\s+/);
            let initials = (nameParts[0]?.[0] || "").toUpperCase();
            if (nameParts.length > 1) initials += (nameParts[nameParts.length - 1]?.[0] || "").toUpperCase();
            else if (String(nameToAbbreviate).length > 1) initials += (String(nameToAbbreviate)[1] || "").toUpperCase();
            return initials || String(nameToAbbreviate).substring(0,3);
        }
        return baseName;
    };

    const numP = participants.length;
    const canUndoController = history && history.length > 1;

    // --- Main Display Sizing Logic ---
    let gameAreaPadding = "px-1 py-1 sm:px-2";
    let playerHeaderMinHeight = "min-h-[10rem] sm:min-h-[12rem] md:min-h-[14rem]";
    let playerHeaderPadding = "p-2 sm:p-3";
    let playerNameFontSize = "text-5xl sm:text-6xl md:text-7xl lg:text-8xl";
    let playerScoreFontSize = "text-7xl sm:text-8xl md:text-9xl lg:text-9xl";
    let markCellMinHeight = "min-h-[6rem] sm:min-h-[7rem] md:min-h-[8rem]";
    let objectiveLabelPadding = "p-1 sm:p-2";
    let objectiveLabelFontSize = "text-5xl sm:text-6xl md:text-7xl lg:text-8xl";
    let markCellPadding = "p-0";

    let totalGridColumns; let objectiveColumnGridIndex; let displaySlots = [];
    if (numP <= 2) { totalGridColumns = 3; objectiveColumnGridIndex = 2; }
    else if (numP <= 4) { totalGridColumns = 5; objectiveColumnGridIndex = 3; }
    else if (numP <= 6) { totalGridColumns = 7; objectiveColumnGridIndex = 4; }
    else { totalGridColumns = 9; objectiveColumnGridIndex = 5; }

    let playerDisplayCounter = 0;
    const leftSlotsCount = objectiveColumnGridIndex - 1;
    const rightSlotsCount = totalGridColumns - objectiveColumnGridIndex;
    for (let i = 0; i < leftSlotsCount; i++) { if (playerDisplayCounter < numP) { displaySlots.push({ type: 'player', participant: participants[playerDisplayCounter], originalIndex: playerDisplayCounter }); playerDisplayCounter++; } else { displaySlots.push({ type: 'blank', originalIndex: -1 - i }); } }
    displaySlots.push({ type: 'objective', originalIndex: -100 });
    for (let i = 0; i < rightSlotsCount; i++) { if (playerDisplayCounter < numP) { displaySlots.push({ type: 'player', participant: participants[playerDisplayCounter], originalIndex: playerDisplayCounter }); playerDisplayCounter++; } else { displaySlots.push({ type: 'blank', originalIndex: -200 - i }); } }
    
    let columnWidths = "1fr";
    if (totalGridColumns === 3) columnWidths = "2.5fr 1fr 2.5fr";
    else if (totalGridColumns === 5) columnWidths = "2fr 2fr 1fr 2fr 2fr";
    else if (totalGridColumns === 7) columnWidths = "1.5fr 1.5fr 1.5fr 1fr 1.5fr 1.5fr 1.5fr";
    else if (totalGridColumns === 9) columnWidths = "1.2fr 1.2fr 1.2fr 1.2fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr";

    const renderMainDisplayViewCricket = () => {
        let leadingPlayerOriginalIndices = [];
        if (participants && participants.length > 0) {
            let maxScore = -Infinity;
            participants.forEach(p => { if (p.score > maxScore) maxScore = p.score; });
            if (maxScore > 0) {
                participants.forEach((p, index) => { if (p.score === maxScore) leadingPlayerOriginalIndices.push(index); });
            }
        }
        
        const currentThrowerName = actualServerCurrentParticipant?.players?.[currentPlayerTurnInTeam];
        const currentTeamName = actualServerCurrentParticipant?.name;

        return (
            React.createElement('div', { className: `w-full ${gameAreaPadding} flex flex-col h-full bg-slate-900 text-slate-100 font-sans` },
                React.createElement('div', { className: "grid w-full flex-grow relative", style: { gridTemplateColumns: columnWidths, gap: '0.1rem' } },
                    // RENDER HEADERS
                    displaySlots.map((slotInfo, gridColIdx) => {
                        if (slotInfo.type === 'objective') {
                            return React.createElement('div', { key: `header-obj-${gridColIdx}`, className: `invisible ${playerHeaderPadding} ${playerHeaderMinHeight}` });
                        }
                        if (slotInfo.type === 'player' && slotInfo.participant) {
                            const p = slotInfo.participant;
                            const originalParticipantIdx = slotInfo.originalIndex;
                            const isLeading = leadingPlayerOriginalIndices.includes(originalParticipantIdx);
                            const isCurrent = originalParticipantIdx === currentPlayerIndex;

                            let headerClasses = `${playerHeaderPadding} ${playerHeaderMinHeight} rounded-t-md flex flex-col justify-between items-center text-center bg-slate-700 text-slate-100 transition-all duration-300 ease-in-out`;
                            if (isCurrent) {
                                headerClasses += " scale-105 z-10 bg-gradient-to-br from-sky-700 to-indigo-800 ring-4 ring-sky-400 shadow-2xl shadow-sky-500/40";
                            }
                            let playerNameDisplayClasses = `player-name ${playerNameFontSize} font-semibold truncate w-full leading-tight`;
                            if (isLeading) playerNameDisplayClasses += " text-yellow-300";
                            let crownSize = '1.5rem';
                            if (playerNameFontSize.includes('7xl') || playerNameFontSize.includes('6xl')) crownSize = '3rem';
                            else if (playerNameFontSize.includes('5xl')) crownSize = '2.5rem';
                            else if (playerNameFontSize.includes('4xl')) crownSize = '2rem';
                            const displayName = getPlayerDisplayName(p, true, originalParticipantIdx, false);
                            const actualScoreToShow = p.score || 0;

                            return React.createElement('div', { key: `header-${p.id || originalParticipantIdx}`, className: headerClasses },
                                React.createElement('div', { className: 'w-full' },
                                    React.createElement('div', { className: "flex items-center justify-center" },
                                        isLeading && React.createElement('span', { className: "leading-player-crown text-yellow-400 mr-1 sm:mr-2 animate-pulse", style: { fontSize: crownSize, textShadow: '0 0 5px rgba(250, 204, 21, 0.7)'}}, "👑"),
                                        React.createElement('div', { className: playerNameDisplayClasses }, 
                                            displayName,
                                            React.createElement(WinTracker, { name: p.name, type: 'team', sessionStats: sessionStats })
                                        )
                                    ),
                                    React.createElement('div', { className: `player-score ${playerScoreFontSize} font-black leading-none ${isLeading ? 'text-yellow-200' : ''}` }, actualScoreToShow)
                                ),
                                p.type === 'team' && p.players && React.createElement('div', { className: "mt-auto w-full px-1 pt-2 border-t border-slate-600" },
                                    React.createElement('ul', { className: "text-left space-y-1" },
                                        p.players.map((playerName, playerIdx) => {
                                            const isCurrentThrowerInList = isCurrent && playerIdx === currentPlayerTurnInTeam;
                                            const throwerClasses = isCurrentThrowerInList
                                                ? "font-bold text-sky-300"
                                                : "text-slate-400";
                                            // The emoji is removed from here
                                            const throwerIndicator = isCurrentThrowerInList ? "▶ " : "• ";

                                            return React.createElement('li', {
                                                key: `${p.id}-player-${playerIdx}`,
                                                className: `text-xl md:text-2xl lg:text-3xl truncate ${throwerClasses}`
                                            },
                                                throwerIndicator + playerName
                                            );
                                        })
                                    )
                                )
                            );
                        }
                        return React.createElement('div', { key: `header-blank-${gridColIdx}-${slotInfo.originalIndex}`, className: `${playerHeaderPadding} ${playerHeaderMinHeight}` });
                    }),

                    // RENDER OBJECTIVE ROWS
                    objectives.map(obj => (
                        React.createElement(React.Fragment, { key: `row-${obj.name}` },
                            displaySlots.map((slot, gridColIdx) => {
                                const isFullyClosedForAllObjective = participants.every(mainP => (mainP.marks[obj.name] || 0) >= 3);
                                if (slot.type === 'objective') {
                                    const isBull = obj.name === "B";
                                    const objLabelClasses = `${objectiveLabelPadding} ${objectiveLabelFontSize} ${markCellMinHeight} font-black rounded-md flex items-center justify-center transition-opacity duration-300 leading-tight ${isBull ? 'bg-red-700 text-yellow-300 ring-1 ring-red-500 shadow-md shadow-red-700/40' : 'bg-slate-800 text-amber-400'} ${isFullyClosedForAllObjective ? 'opacity-50' : ''}`;
                                    return React.createElement('div', { key: `label-${obj.name}-${gridColIdx}`, className: objLabelClasses }, isBull ? "🎯" : obj.name);
                                }
                                if (slot.type === 'player' && slot.participant) {
                                    const p = slot.participant;
                                    const marks = (p.marks && p.marks[obj.name]) ? p.marks[obj.name] : 0;
                                    const isPlayerClosedThis = marks >= 3;
                                    let cellClasses = `${markCellMinHeight} ${markCellPadding} rounded-md transition-all duration-150 ease-in-out flex items-center justify-center cursor-default `;
                                    if (isFullyClosedForAllObjective) cellClasses += " bg-slate-800 opacity-70 border-2 border-slate-700";
                                    else if (isPlayerClosedThis) cellClasses += " bg-green-800/50 border-2 border-green-600";
                                    else cellClasses += " bg-slate-700 border-2 border-slate-500";
                                    if (p.id === actualServerCurrentParticipantId) {
                                         cellClasses += " bg-opacity-60 backdrop-blur-sm";
                                    }
                                    return React.createElement('div', { key: `${p.id || slot.originalIndex}-${obj.name}`, className: cellClasses }, getMarkDisplay(marks, isPlayerClosedThis, isFullyClosedForAllObjective));
                                }
                                return React.createElement('div', { key: `mark-blank-${obj.name}-${gridColIdx}-${slot.originalIndex}`, className: `${markCellMinHeight} ${markCellPadding}` });
                            })
                        )
                    )),
                    // RENDER POPUP
                    actualServerCurrentParticipant && !gameState.gameOver && React.createElement(CricketCurrentThrowerPopup, {
                        currentThrowerName: currentThrowerName,
                        currentTeamName: currentTeamName,
                        positionIndex: currentPlayerIndex,
                        totalPlayers: numP,
                        leftSlotsCount: leftSlotsCount,
                    })
                )
            )
        );
    };

    const renderControllerViewCricket = () => {
        const squareButtonBase = "aspect-square text-3xl sm:text-4xl font-bold rounded-lg shadow-lg transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 flex items-center justify-center text-center leading-tight relative overflow-hidden flex-col p-1";
        const objectiveButtonClass = `${squareButtonBase} bg-slate-600 hover:bg-slate-500 text-white`;
        const specialObjectiveButtonClass = `${squareButtonBase} bg-purple-600 hover:bg-purple-500 text-white`;

        const infoTextClass = "text-sm text-center text-slate-300 mb-1";
        const selectedPlayerNameClass = "text-lg sm:text-xl game-title-font text-yellow-300 font-semibold text-center mb-1";
        const ActualKeypadComponent = window.Keypad;

        // POLISHED: Controller button style now stacks the label on top of the mark display area
        const getControllerMarkDisplay = (markCount, isFullyClosed) => {
            const baseStyle = "w-full h-1/2 flex items-center justify-center transition-all duration-150 ease-in-out";
            if (markCount === 1) return React.createElement('span', { className: `${baseStyle} text-sky-300 font-black text-5xl` }, '/');
            if (markCount === 2) return React.createElement('span', { className: `${baseStyle} text-blue-300 font-black text-6xl opacity-75` }, 'X');
            if (markCount >= 3) {
                const xColor = isFullyClosed ? 'text-red-500' : 'text-lime-300';
                const borderColor = isFullyClosed ? 'border-red-500' : 'border-lime-300';
                return React.createElement('div', { className: `${baseStyle} opacity-75 relative w-full` },
                    React.createElement('span', { className: `${xColor} font-black text-6xl z-10` }, 'X'),
                    React.createElement('div', { className: `absolute inset-1 border-4 ${borderColor} rounded-full` })
                );
            }
            return React.createElement('div', { className: baseStyle }); // Placeholder for spacing
        };

        const renderMainContent = () => {
             const isKeypadForCurrentScorerAndTurn = showKeypadFor &&
                                               participantToDisplayId === participants[showKeypadFor.participantIndex]?.id &&
                                               showKeypadFor.participantIndex === currentPlayerIndex;

            if (isKeypadForCurrentScorerAndTurn && ActualKeypadComponent) {
                const keypadParticipant = participants[showKeypadFor.participantIndex];
                return React.createElement(ActualKeypadComponent, {
                    onSubmit: handleKeypadSubmit,
                    onCancel: handleKeypadCancel,
                    title: `Score for ${getPlayerDisplayName(keypadParticipant, false, showKeypadFor.participantIndex, true)} on ${showKeypadFor.objectiveName}`
                }, React.createElement('p', {className: "text-xs text-center text-slate-400 mb-1"}, `Enter points for ${showKeypadFor.objectiveName}.`));
            }

            if (!participantToDisplay) {
                if (participants.length > 0) {
                    return React.createElement('div', { className: "flex flex-col items-center justify-center h-full p-4 space-y-2" },
                        React.createElement('h3', { className: `${selectedPlayerNameClass} mb-3` }, "Whose Throw?"),
                        React.createElement('div', {className: "w-full max-w-sm"},
                            participants.map((p, index) => (
                                React.createElement('button', {
                                    key: p.id || index,
                                    onClick: () => handleSelectScorerController(p.id),
                                    className: `w-full text-xl font-bold rounded-lg shadow-md my-1 py-3 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center text-center leading-tight ${p.id === actualServerCurrentParticipantId ? 'bg-green-700 hover:bg-green-600' : 'bg-sky-700 hover:bg-sky-600'} text-white`
                                }, getPlayerDisplayName(p, false, index, true), p.id === actualServerCurrentParticipantId ? " (Current Turn)" : "")
                            ))
                        )
                    );
                }
                return React.createElement('div', {className: "text-center p-4 text-slate-400"}, "No active game or players.");
            }

            const isViewingActualCurrentPlayer = participantToDisplay.id === actualServerCurrentParticipantId;

            return React.createElement(React.Fragment, null,
                React.createElement('div', { className: "relative w-full text-center mb-1 shrink-0" },
                    React.createElement('p', { className: infoTextClass },
                        isViewingActualCurrentPlayer ? "Marking for:" : "Viewing:"
                    ),
                    React.createElement('h3', { className: selectedPlayerNameClass },
                        getPlayerDisplayName(participantToDisplay, false, getParticipantIndexById(participantToDisplay.id), true),
                        !isViewingActualCurrentPlayer && actualServerCurrentParticipant &&
                            React.createElement('span', { className: "block text-xs text-yellow-400" }, `(It's ${actualServerCurrentParticipant.name}'s turn)`)
                    ),
                    // NEW: Score Confirmation Display - maps over an array to show multiple popups
                    React.createElement('div', { className: 'absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20' },
                        scorePopups.filter(p => p.participantId === participantToDisplay.id).map((popup, index) =>
                            React.createElement(ScorePopup, {
                                key: popup.id,
                                score: popup.score,
                                index: index,
                                onComplete: () => handlePopupComplete(popup.id)
                            })
                        )
                    )
                ),
                React.createElement('div', { className: "grid grid-cols-3 gap-1.5 sm:gap-2 w-full max-w-xs mx-auto my-1 flex-grow content-center" },
                    CRICKET_CONTROLLER_OBJECTIVES.map(objName => {
                        const isSpecial = objName === "D" || objName === "T";
                        const isBull = objName === "B";
                        let buttonClass = objectiveButtonClass;
                        if(isSpecial) buttonClass = specialObjectiveButtonClass;
                        if(isBull) buttonClass = `${squareButtonBase} bg-red-600 hover:bg-red-500 text-white`;

                        const displayMarks = participantToDisplay.marks[objName] || 0;
                        const isFullyClosed = CRICKET_CLOSABLE_OBJECTIVES_IN_CRICKET_GAME.includes(objName) && participants.every(p => (p.marks[objName] || 0) >= 3);
                        const markDisplayElement = getControllerMarkDisplay(displayMarks, isFullyClosed);
                        
                        return React.createElement('button', {
                            key: objName,
                            onClick: () => handleObjectiveClickController(objName),
                            disabled: !isViewingActualCurrentPlayer || gameState.gameOver,
                            className: `${buttonClass} ${!isViewingActualCurrentPlayer ? 'opacity-60 cursor-not-allowed' : ''}`
                        },
                           React.createElement('span', {className: "w-full h-1/2 flex items-center justify-center font-black text-4xl"}, isBull ? "🎯" : objName),
                           markDisplayElement
                        )
                    })
                )
            );
        };

        return React.createElement('div', { className: "flex flex-col h-full p-2 bg-slate-800 rounded-lg" },
            React.createElement('div', { className: "flex flex-wrap justify-center border-b border-slate-700 mb-2 shrink-0" },
                participants.map((p, index) => {
                    const buttonTextContent = `${getPlayerDisplayName(p, false, index, true)}${p.id === actualServerCurrentParticipantId ? " (Turn)" : ""}`;
                    return React.createElement('button', {
                        key: p.id,
                        onClick: () => handleSelectScorerController(p.id),
                        className: `py-1.5 px-2 m-0.5 text-xs sm:text-sm font-medium rounded-md
                                    ${participantToDisplayId === p.id ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                                    ${p.id === actualServerCurrentParticipantId ? 'font-bold border-2 border-green-400 shadow-md shadow-green-500/30' : ''}
                                  `
                    }, buttonTextContent );
                })
            ),
            React.createElement('div', { className: "flex-grow flex flex-col" }, renderMainContent()),
            React.createElement('div', { className: "w-full max-w-xs mx-auto flex space-x-2 shrink-0 pt-2" },
                canUndoController && React.createElement('button', { 
                    onClick: handleUndo, 
                    className: "flex-1 text-lg font-bold rounded-lg shadow-md p-3 transition-transform hover:scale-105 active:scale-95 bg-yellow-500 hover:bg-yellow-400 text-black"
                }, "↩️ Undo"),
                React.createElement('button', {
                    onClick: handleEndTurnController,
                    disabled: gameState.gameOver || !actualServerCurrentParticipant,
                    className: `flex-1 text-lg font-bold rounded-lg shadow-md p-3 transition-transform hover:scale-105 active:scale-95 bg-green-600 hover:bg-green-500 text-white ${actualServerCurrentParticipant ? '' : 'opacity-50 cursor-not-allowed'}`
                 },
                    "End Turn"
                )
            )
        );
    };

    // --- Conditional Rendering Based on displayRole ---
    if (displayRole === 'controller') {
        return renderControllerViewCricket();
    } else {
        return renderMainDisplayViewCricket();
    }
};

// Make CricketGame globally available if not using a module bundler
if (typeof window !== 'undefined') {
    window.CricketGame = CricketGame;
}

