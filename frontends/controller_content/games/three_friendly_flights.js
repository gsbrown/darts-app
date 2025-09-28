// three_friendly_flights.js - 3 Friendly Flights Game Component
// REVAMPED: Updated to handle the new "all-teams" participant structure.
// FIXED: Added validation to prevent controller view from crashing on initial load.
// ENHANCED: Restored unique objective styling and added a "Current Thrower" pop-up for better visibility.
// UI TWEAK: Moved "Current Thrower" to the main header and removed redundant in-row shooter text for a cleaner look.

const ThreeFriendlyFlightsGame = ({ gameMode, onGameEnd, socket, gameState, displayRole, sessionStats }) => {
    // Inject custom styles for this component
    React.useEffect(() => {
        const styleElement = document.createElement("style");
        styleElement.id = "3ff-dynamic-styles";
        styleElement.innerHTML = `
            .threeff-obj-static_number {
                background-color: #1e3a8a; /* blue-800 */
                color: #dbeafe; /* blue-100 */
                border: 2px solid #3b82f6; /* blue-500 */
            }
            .threeff-obj-hard_score {
                background-color: #b91c1c; /* red-700 */
                color: #fee2e2; /* red-100 */
                border: 2px solid #ef4444; /* red-500 */
            }
            .threeff-obj-special_3ff {
                background: linear-gradient(135deg, #f59e0b, #fbbf24); /* amber-500 to amber-400 */
                color: #451a03; /* amber-950 */
                border: 2px solid #fcd34d; /* amber-300 */
                text-shadow: 0 1px 1px rgba(255,255,255,0.3);
            }
            .threeff-obj-random_challenge {
                background-color: #581c87; /* purple-800 */
                color: #f3e8ff; /* purple-100 */
                border: 2px solid #a855f7; /* purple-500 */
            }
        `;
        document.head.appendChild(styleElement);
        return () => {
            const style = document.getElementById("3ff-dynamic-styles");
            if (style) style.remove();
        };
    }, []);

    if (!gameState || gameState.mode !== 'THREE_FF' || !gameState.participants || !gameState.objectives) {
        return React.createElement('div', { className: "p-8 text-center text-red-500 text-3xl" }, "Loading 3FF Game State or Invalid State...");
    }

    const {
        objectives,
        participants,
        activeObjectiveIndex,
        currentPlayerIndex,
        currentPlayerTurnInTeam,
        showMetMissPromptFor,
        showKeypadFor3FF,
        history,
    } = gameState;

    const currentParticipantObject = participants[currentPlayerIndex];
    const activeObjective = objectives[activeObjectiveIndex];
    const canUndo = history && history.length > 1;

    const handleObjectiveAction = (action) => {
        if (socket && showMetMissPromptFor && activeObjective && showMetMissPromptFor.participantIndex === currentPlayerIndex && showMetMissPromptFor.objectiveId === activeObjective.id) {
            socket.emit('threeFFObjectiveAction', { action });
        }
    };
    const handleKeypadSubmit = (score) => {
        if (socket && showKeypadFor3FF && activeObjective && showKeypadFor3FF.participantIndex === currentPlayerIndex && showKeypadFor3FF.objectiveId === activeObjective.id) {
            socket.emit('submitThreeFFScore', { score });
        }
    };
    const handleKeypadCancel = () => {
        if (socket && showKeypadFor3FF) socket.emit('cancelThreeFFKeypad');
    };
    const handleUndo = () => {
        if (socket && canUndo) socket.emit('undoLastAction');
    };

    const getPlayerDisplayName = (participant, isHeaderContext = false, participantIndex, teamMemberIndex) => {
        if (!participant) return "N/A";
        let baseName = participant.name || `Team ${participantIndex + 1}`;
        if (participant.players && typeof teamMemberIndex === 'number' && participant.players[teamMemberIndex]) {
            baseName = `${participant.name} (${participant.players[teamMemberIndex]})`;
        }
        return baseName;
    };

    const getObjectiveStylingClasses = (obj) => {
        if (!obj) return "";
        let baseClass = `threeff-obj-${obj.type}`;
        if (obj.type === 'random_challenge' && obj.name) {
            const challengeNameForClass = String(obj.name).replace(/[^a-zA-Z0-9]/g, '_');
            baseClass += `-${challengeNameForClass}`;
        }
        return baseClass;
    };

    const renderControllerViewThreeFriendlyFlights = () => {
        const controllerButtonClass = "text-lg font-bold py-3 px-4 rounded-lg shadow-md my-1.5 transition-transform hover:scale-105 active:scale-95";
        const controllerInfoTextClass = "text-base text-center text-slate-300 mb-1";
        const controllerPlayerNameClass = "text-xl game-title-font text-yellow-300 font-semibold text-center mb-1 leading-tight";
        const controllerObjectiveClass = "text-3xl font-black text-sky-300 my-2 text-center p-2 rounded bg-slate-700";
        const ActualKeypadComponent = window.Keypad;
        
        if (!currentParticipantObject || !activeObjective) {
            return React.createElement('div', { className: "flex items-center justify-center h-full p-4" }, 
                React.createElement('p', { className: controllerInfoTextClass }, "Waiting for game data...")
            );
        }
        
        const displayName = getPlayerDisplayName(currentParticipantObject, false, currentPlayerIndex, currentPlayerTurnInTeam);
        const isMyTurnPrompt = showMetMissPromptFor && showMetMissPromptFor.participantIndex === currentPlayerIndex && showMetMissPromptFor.objectiveId === activeObjective.id;
        const isMyTurnKeypad = showKeypadFor3FF && showKeypadFor3FF.participantIndex === currentPlayerIndex && showKeypadFor3FF.objectiveId === activeObjective.id;
        
        const renderMainContent = () => {
            if (isMyTurnKeypad && ActualKeypadComponent) {
                return React.createElement(ActualKeypadComponent, { 
                    onSubmit: handleKeypadSubmit, 
                    onCancel: handleKeypadCancel, 
                    title: `Score for ${activeObjective.name}`
                }, 
                    React.createElement('p', {className: "text-xs text-center text-slate-400 mb-1"}, showKeypadFor3FF.objectiveDescription || activeObjective.description)
                );
            }
            if (isMyTurnPrompt) {
                return React.createElement('div', { className: "w-full max-w-xs space-y-2 mt-4" },
                    React.createElement('p', {className: `${controllerInfoTextClass} font-semibold`}, `Did you hit "${activeObjective.name}"?`), 
                    React.createElement('div', { className: "flex space-x-2" },
                        React.createElement('button', { onClick: () => handleObjectiveAction('missed'), className: `flex-1 ${controllerButtonClass} bg-red-500 hover:bg-red-600 text-white` }, "❌ No"), 
                        React.createElement('button', { onClick: () => handleObjectiveAction('met'), className: `flex-1 ${controllerButtonClass} bg-green-500 hover:bg-green-600 text-white` }, "✔️ Yes")
                    )
                );
            }
            return React.createElement('p', {className: `${controllerInfoTextClass} text-lg py-8`}, "Waiting for next action...");
        };

        return React.createElement('div', { className: "flex flex-col h-full p-2" },
            React.createElement('div', { className: "text-center shrink-0" }, 
                React.createElement('h3', { className: controllerPlayerNameClass }, `Turn: ${displayName}`), 
                React.createElement('p', { className: controllerObjectiveClass }, activeObjective.name), 
                React.createElement('p', { className: `${controllerInfoTextClass} text-xs` }, activeObjective.description)
            ),
            React.createElement('div', { className: "flex-grow flex flex-col items-center justify-center" }, renderMainContent()),
            React.createElement('div', { className: "w-full max-w-xs mx-auto shrink-0 pt-4" },
                canUndo && React.createElement('button', { onClick: handleUndo, className: `w-full ${controllerButtonClass} bg-yellow-500 hover:bg-yellow-600 text-black text-base py-2`}, "↩️ Undo Last Action")
            )
        );
    };

    const renderMainDisplayViewThreeFriendlyFlights = () => {
        let maxScore = -Infinity;
        if (participants.length > 0) maxScore = Math.max(...participants.map(p => p.score));
        const leadingPlayersIds = participants.filter(p => p.score === maxScore && maxScore > 0).map(p => p.id);
        const playerRowBaseClass = "flex flex-col items-center justify-center p-3 sm:p-4 rounded-lg shadow-xl mb-2 sm:mb-3 min-h-[10rem] sm:min-h-[12rem] md:min-h-[15rem] transition-all duration-300 ease-in-out";
        const playerNameClassMain = "text-5xl sm:text-6xl md:text-7xl font-bold text-white text-center leading-tight mb-1 sm:mb-2";
        const playerScoreClassMain = "text-6xl sm:text-7xl md:text-8xl font-extrabold text-yellow-300 text-center leading-none";
        
        const currentThrowerName = currentParticipantObject?.players?.[currentPlayerTurnInTeam];

        const renderPlayerColumn = (playersToDisplay) => {
            return React.createElement('div', { className: `flex flex-col justify-start space-y-2 sm:space-y-4 w-[60%] p-1 sm:p-2 overflow-y-auto custom-scrollbar` },
                playersToDisplay.map((p, index) => {
                    const originalIndex = participants.findIndex(origP => origP.id === p.id);
                    const isCurrentTurnOuter = originalIndex === currentPlayerIndex;
                    const isLeader = leadingPlayersIds.includes(p.id);
                    let playerRowDynamicClasses = isCurrentTurnOuter ? "bg-blue-600 ring-4 ring-yellow-300 shadow-yellow-400/50 animate-pulse" : isLeader ? "bg-amber-700 ring-2 ring-amber-300 shadow-amber-500/40" : "bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700";
                    return React.createElement('div', { key: p.id || `player-${index}`, className: `${playerRowBaseClass} ${playerRowDynamicClasses}` },
                        React.createElement('div', { className: `${playerNameClassMain} flex items-center justify-center` }, isLeader && React.createElement('span', {className: "mr-2 sm:mr-3 text-4xl sm:text-5xl"}, "👑"), getPlayerDisplayName(p, true, originalIndex, isCurrentTurnOuter ? currentPlayerTurnInTeam : undefined), React.createElement(WinTracker, { name: p.name, type: 'team', sessionStats: sessionStats })),
                        React.createElement('div', { className: playerScoreClassMain }, p.score)
                    );
                })
            );
        };
        
        const objectiveColumn = React.createElement('div', { className: "w-[40%] flex flex-col items-center p-1 sm:p-2 min-w-0" },
            activeObjective && React.createElement('div', { className: `threeff-current-objective-header ${getObjectiveStylingClasses(activeObjective)} flex items-center justify-center text-center rounded-xl p-3 sm:p-4 mb-4 w-full shadow-2xl shadow-yellow-400/60 ring-4 ring-yellow-300 ring-offset-4 ring-offset-gray-900 transform scale-105 min-h-[10rem] sm:min-h-[12rem]`}, React.createElement('span', { className: "threeff-current-objective-name text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] font-extrabold leading-tight" }, activeObjective.name)),
            React.createElement('div', { className: "w-full flex-grow overflow-y-auto space-y-1.5 sm:space-y-2 custom-scrollbar pr-1" },
                objectives.map((obj) => {
                    let listItemClasses = `threeff-cell threeff-objective-display-cell ${getObjectiveStylingClasses(obj)} flex items-center justify-center text-center rounded-md p-1.5 sm:p-2 md:p-3 h-auto min-h-[5rem] sm:min-h-[6rem] md:min-h-[7rem] w-full transition-all duration-200 ease-in-out`;
                    if (obj.id === activeObjective?.id) listItemClasses += " active ring-2 ring-sky-300 shadow-lg scale-105";
                    if (obj.status === 'closed') listItemClasses += " closed opacity-60 line-through";
                    return React.createElement('div', { key: obj.id, className: listItemClasses }, React.createElement('span', { className: "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold leading-none" }, obj.name));
                })
            )
        );
        
        const renderHeader = () => {
             return React.createElement('div', { className: "flex-shrink-0 p-2 text-center bg-gray-900 border-b-2 border-slate-700" },
                currentThrowerName ?
                React.createElement(React.Fragment, null,
                    React.createElement('p', { className: "text-slate-300 text-lg sm:text-xl" }, "Current Thrower"),
                    React.createElement('p', { className: "text-sky-300 text-4xl sm:text-5xl font-bold game-title-font" }, currentThrowerName)
                ) :
                // Placeholder to prevent layout shift when no thrower is determined yet
                React.createElement('div', { className: "h-[68px] sm:h-[84px] flex items-center justify-center" }, 
                   React.createElement('p', { className: "text-3xl game-title-font text-yellow-300" }, "3 Friendly Flights")
                )
            );
        };

        return (
            React.createElement('div', { className: "threeff-game-area-grid w-full h-full flex flex-col items-stretch px-0.5 py-1 bg-gray-900 text-white" },
                renderHeader(),
                React.createElement('div', { className: "flex flex-row flex-grow min-h-0 relative" }, 
                    renderPlayerColumn(participants), 
                    objectiveColumn
                ),
                React.createElement('div', { className: "flex-shrink-0 border-t border-slate-700 mt-1 sm:mt-2 pt-1 sm:pt-2" },
                    React.createElement('div', { className: "threeff-turn-indicator text-center" }, currentParticipantObject && activeObjective && React.createElement('p', {className: "text-xl sm:text-2xl lg:text-3xl text-gray-200 leading-tight"}, `Turn: ${getPlayerDisplayName(currentParticipantObject, false, currentPlayerIndex, currentPlayerTurnInTeam)} | Obj: ${activeObjective.name}`)))
            )
        );
    };

    if (displayRole === 'controller') {
        return renderControllerViewThreeFriendlyFlights();
    } else {
        return renderMainDisplayViewThreeFriendlyFlights();
    }
};
