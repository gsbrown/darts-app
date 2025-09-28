// beers.js - B.E.E.R.S. Game Component
// REVAMPED: Updated to handle the new "all-teams" participant structure, especially for this individual-only game.
// UI ENHANCEMENT: Unified player card color and added a distinct, animated style for the current player to improve clarity.
// FEATURE: Added haptic feedback for controller button presses on supported devices.

const BeersGame = ({ gameMode, onGameEnd, socket, gameState, displayRole, sessionStats }) => {
    // Inject custom styles for the current player's glow animation
    React.useEffect(() => {
        const styleElement = document.createElement("style");
        styleElement.id = "beers-dynamic-styles";
        styleElement.innerHTML = `
            @keyframes beers-glow {
                0%, 100% {
                    box-shadow: 0 0 10px rgba(253, 224, 71, 0.4), 0 0 20px rgba(253, 224, 71, 0.3), 0 0 5px rgba(252, 211, 77, 0.5) inset;
                }
                50% {
                    box-shadow: 0 0 20px rgba(253, 224, 71, 0.7), 0 0 30px rgba(253, 224, 71, 0.5), 0 0 10px rgba(252, 211, 77, 0.7) inset;
                }
            }
            .beers-current-player-glow {
                animation: beers-glow 2.5s infinite ease-in-out;
            }
        `;
        document.head.appendChild(styleElement);

        return () => {
            const style = document.getElementById("beers-dynamic-styles");
            if (style) {
                style.remove();
            }
        };
    }, []);

    // --- 1. Initial Game State Validation ---
    if (!gameState || typeof gameState !== 'object' || gameState.mode !== 'BEERS' || !Array.isArray(gameState.participants)) {
        console.error("BeersGame: Invalid or incomplete gameState", gameState);
        return React.createElement('div', { className: "p-8 text-center text-red-500 text-2xl sm:text-3xl" }, "Loading B.E.E.R.S. Game State or Invalid State...");
    }

    // --- Haptic Feedback Helper ---
    const triggerHapticFeedback = (duration = 50) => {
        if (navigator.vibrate) {
            try {
                navigator.vibrate(duration);
            } catch (e) {
                console.warn("Haptic feedback failed.", e);
            }
        }
    };

    // --- 3. Destructure Game State Properties ---
    const {
        participants = [],
        currentPlayerIndex,
        scoreToBeat,
        beersGlobalHighLowRule,
        promptForPlayerAction,
        showKeypadForBeers,
        promptToTakeLetter,
        history
    } = gameState;

    // --- 4. Current Player and Undo Logic ---
    const currentParticipant = participants[currentPlayerIndex];
    const canUndo = history && Array.isArray(history) && history.length > 1 && !promptToTakeLetter && !showKeypadForBeers;

    // --- 5. Helper Functions ---
    const getPlayerDisplayName = (participant, lettersRemaining) => {
        let playerName = (participant && Array.isArray(participant.players) && participant.players[0]) ? participant.players[0] : "Unknown";
        if (participant && !participant.isEliminated && lettersRemaining === 1 && displayRole !== 'controller') {
            playerName += " 😰";
        }
        return playerName;
    };

    const BEERS_LETTERS_CONST = ["B", "E", "E", "R", "S"];
    const TOTAL_BEERS_LETTERS = BEERS_LETTERS_CONST.length;

    const getGameTitle = () => {
        if (typeof beersGlobalHighLowRule === 'string') {
            const ruleUpperCase = beersGlobalHighLowRule.toUpperCase();
            if (ruleUpperCase === 'HIGHER') return "BEERS HIGH";
            else if (ruleUpperCase === 'LOWER') return "BEERS LOW";
        }
        return gameMode?.name || "B.E.E.R.S.";
    };

    // --- 6. Event Handlers ---
    const handleEnterScore = () => {
        triggerHapticFeedback();
        if (socket && currentParticipant && !currentParticipant.isEliminated) {
            socket.emit('beersRequestScoreEntry');
        }
    };
    const handleKeypadSubmit = (score) => {
        triggerHapticFeedback();
        if (socket && currentParticipant && !currentParticipant.isEliminated) {
            socket.emit('beersSubmitScore', { score });
        }
    };
    const handleKeypadCancel = () => {
        triggerHapticFeedback();
        if (socket) socket.emit('beersCancelScoreEntry');
    };
    const handleUndo = () => {
        triggerHapticFeedback();
        if (socket && canUndo) socket.emit('undoLastAction');
    };
    const handleAcknowledgeLetter = () => {
        triggerHapticFeedback();
        if (socket && promptToTakeLetter && promptToTakeLetter.participantIndex === currentPlayerIndex) {
            socket.emit('beersAcknowledgeLetter');
        }
    };

    // --- 7. UI Configuration & Dynamic Sizing ---
    const numPlayers = participants.length;
    const scalingFactor = Math.max(0.5, 1 - (numPlayers - 2) * 0.1);
    const nameFontSizeRem = Math.max(2, 5 * scalingFactor);
    const letterSlotSizeRem = 12 * scalingFactor;
    const eliminatedTextSizeRem = 2.5 * scalingFactor;
    const scoreValueFontSizeRem = Math.max(1.25, 2.5 * scalingFactor);
    const playerCardGapRem = 0.7 * scalingFactor;
    const titleFontSizeRem = `clamp(1.5rem, ${5 - numPlayers * 0.3}vw, 3rem)`;
    const scoreToBeatFontSizeRem = `clamp(8rem, ${20 - numPlayers}vw, 15rem)`;
    const scoreToBeatLabelSizeRem = `clamp(2rem, ${7 - numPlayers * 0.5}vw, 5rem)`;
    const ruleFontSizeRem = `clamp(1.25rem, ${4 - numPlayers * 0.2}vw, 4.25rem)`;
    const isMyTurnAndCanEnterScore = currentParticipant && !currentParticipant.isEliminated && promptForPlayerAction && promptForPlayerAction.participantIndex === currentPlayerIndex && !gameState.gameOver && !showKeypadForBeers && !promptToTakeLetter;
    const playerFailedAndLetterAssigned = currentParticipant && !currentParticipant.isEliminated && promptToTakeLetter && promptToTakeLetter.participantIndex === currentPlayerIndex && !gameState.gameOver;
    const scoreToBeatNumberStyle = { fontSize: scoreToBeatFontSizeRem, lineHeight: '0.8', textShadow: '3px 3px 6px rgba(0,0,0,0.6), 0 0 12px rgba(255,255,150,0.6)' };

    const renderMainDisplayViewBeers = () => {
        return (
            React.createElement(React.Fragment, null,
                React.createElement('div', { className: `beers-game-area w-full flex flex-col h-full bg-slate-900 text-slate-100 p-1` },
                    React.createElement('h2', { className: `font-black game-title-font text-yellow-300 text-center shrink-0`, style: { fontSize: titleFontSizeRem, marginBottom: '0.25rem' } }, getGameTitle()),
                    React.createElement('div', { className: `flex flex-row justify-between items-center bg-gradient-to-br from-yellow-500 via-orange-600 to-red-700 rounded-xl shadow-2xl shrink-0 p-2 sm:p-4 my-1` },
                        React.createElement('div', { className: "text-left flex-shrink-0 mr-2 sm:mr-4" },
                            React.createElement('p', { className: "text-white font-semibold leading-tight", style: { fontSize: scoreToBeatLabelSizeRem, textShadow: '1px 1px 3px rgba(0,0,0,0.7)' } }, "🎯 SCORE TO BEAT:"),
                            React.createElement('p', { className: "font-bold uppercase text-yellow-200 leading-tight", style: { fontSize: ruleFontSizeRem, textShadow: '1px 1px 3px rgba(0,0,0,0.7)' } }, `(MUST SCORE ${beersGlobalHighLowRule || "N/A"})`)
                        ),
                        React.createElement('div', { className: "flex-grow text-center px-1" },
                             React.createElement('p', { className: `font-black text-white tracking-tighter ${isMyTurnAndCanEnterScore && scoreToBeat !== null ? 'animate-pulse' : ''}`, style: scoreToBeatNumberStyle }, scoreToBeat === null ? "SET" : scoreToBeat)
                        )
                    ),
                    React.createElement('div', { className: `grid grid-cols-1 flex-grow min-h-0 overflow-y-auto custom-scrollbar pr-0.5 sm:pr-1 pb-1`, style: { gap: `${playerCardGapRem}rem` } },
                        participants.map((p, index) => {
                            if (!p) return null;
                            const isCurrent = index === currentPlayerIndex;
                            const lettersGivenCount = p.lettersGiven?.length || 0;
                            const lettersRemaining = TOTAL_BEERS_LETTERS - lettersGivenCount;

                            let baseBgColor = '', ringStyle = '', nameColor = 'text-slate-100', scoreColor = 'text-slate-300', extraCardClasses = '', shadowStyle = 'shadow-lg', scaleAndZIndex = 'scale-100 z-1';

                            if (p.isEliminated) {
                                baseBgColor = 'bg-red-900/70';
                                nameColor = 'text-red-300';
                                scoreColor = 'text-red-400';
                                ringStyle = 'ring-1 ring-red-700';
                                shadowStyle = 'shadow-md';
                            } else {
                                // Standard style for all non-current, active players
                                baseBgColor = 'bg-slate-700';
                                ringStyle = 'ring-1 ring-slate-600';

                                if (isCurrent) {
                                    scaleAndZIndex = 'scale-105 z-10';
                                    ringStyle = 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-slate-900';
                                    shadowStyle = 'shadow-2xl';
                                    nameColor = 'text-white';
                                    scoreColor = 'text-gray-100';

                                    if (playerFailedAndLetterAssigned) {
                                        baseBgColor = 'bg-red-600';
                                        ringStyle = "ring-4 ring-red-300 ring-offset-2 ring-offset-slate-900";
                                        extraCardClasses = ''; // No glow on failure
                                    } else {
                                        baseBgColor = 'bg-gradient-to-br from-blue-500 to-indigo-700';
                                        extraCardClasses = 'beers-current-player-glow'; // The custom animation class
                                    }
                                }
                            }

                            let cardClasses = `beers-player-card ${baseBgColor} ${ringStyle} ${shadowStyle} ${extraCardClasses} ${scaleAndZIndex} rounded-lg sm:rounded-xl flex flex-row items-stretch transition-all duration-300 p-1`;

                            return React.createElement('div', { key: p.id || index, className: cardClasses },
                                React.createElement('div', { className: "w-[30%] flex flex-col items-center justify-center text-center p-1 sm:p-2 border-r border-slate-600/50" },
                                    React.createElement('div', { className: `beers-player-name font-bold ${nameColor} break-words leading-tight flex items-center justify-center`, style: { fontSize: `${nameFontSizeRem}rem` } }, getPlayerDisplayName(p, lettersRemaining), React.createElement(WinTracker, { name: p.players[0], type: 'player', sessionStats: sessionStats })),
                                    p.isEliminated && React.createElement('p', { className: "text-red-300 font-black game-title-font beers-elimination-text leading-none text-center", style: { fontSize: `${eliminatedTextSizeRem}rem`, marginTop: '0.25rem' } }, "ELIMINATED!"),
                                    p.lastScore !== null && !p.isEliminated && React.createElement('div', { className: `${scoreColor} leading-tight mt-1`, style: { fontSize: `${scoreValueFontSizeRem}rem`, fontWeight: '500', whiteSpace: 'nowrap' } }, "(Last: ", React.createElement('span', { className: "text-white font-semibold" }, p.lastScore), ")")
                                ),
                                React.createElement('div', { className: `w-[70%] flex items-center justify-center p-1` },
                                    React.createElement('div', { className: `beers-player-letters-container flex items-center justify-center w-full space-x-1 sm:space-x-2`},
                                        [...Array(TOTAL_BEERS_LETTERS)].map((_, slotIdx) => {
                                            const isLetterLostInThisSlot = slotIdx < lettersGivenCount;
                                            const actualLetterForThisSlot = BEERS_LETTERS_CONST[slotIdx];
                                            let letterDisplayContent, letterSlotClasses = `beers-letter-slot rounded-full flex items-center justify-center transition-all duration-200 shadow-inner `;
                                            if (p.isEliminated) { letterDisplayContent = actualLetterForThisSlot; letterSlotClasses += 'bg-slate-800/50 text-slate-600 opacity-70 font-extrabold'; }
                                            else if (isLetterLostInThisSlot) { letterDisplayContent = actualLetterForThisSlot; letterSlotClasses += 'bg-red-900/60 text-red-400 font-extrabold ring-1 ring-red-700'; }
                                            else { letterDisplayContent = '🍺'; letterSlotClasses += 'bg-slate-800/80 text-yellow-400 opacity-90'; }
                                            return React.createElement('div', { key: `${p.id}-letter-slot-${slotIdx}`, className: letterSlotClasses, style: { width: `${letterSlotSizeRem}rem`, height: `${letterSlotSizeRem}rem`, fontSize: `${letterSlotSizeRem * 0.75}rem`, lineHeight: '1' } }, letterDisplayContent);
                                        })
                                    )
                                )
                            );
                        })
                    )
                )
            )
        );
    };

    const renderControllerViewBeers = () => {
        const controllerPrimaryButtonClass = "w-36 h-36 text-xl sm:text-2xl font-bold rounded-lg shadow-md my-2 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center text-center leading-tight";
        const controllerSecondaryButtonClass = "w-32 h-32 text-lg font-bold rounded-lg shadow-md my-2 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center text-center leading-tight";
        const controllerInfoTextClass = "text-lg sm:text-xl text-center text-slate-300 mb-1";
        const controllerPlayerNameClass = "text-2xl sm:text-3xl text-yellow-300 font-semibold text-center mb-2 game-title-font leading-tight";
        const ActualKeypadComponent = window.Keypad;

        if (!currentParticipant) {
            return React.createElement('div', { className: "flex flex-col items-center justify-center h-full p-4 bg-slate-800 rounded-lg" }, React.createElement('p', { className: controllerInfoTextClass }, "Waiting for game to assign current player..."));
        }

        const lettersRemaining = TOTAL_BEERS_LETTERS - (currentParticipant.lettersGiven?.length || 0);

        return React.createElement('div', { className: "flex flex-col items-center justify-around h-full p-3 space-y-3 bg-slate-800 rounded-lg" },
            React.createElement('div', {className: "w-full text-center"},
                React.createElement('h3', { className: controllerPlayerNameClass }, `Turn: ${getPlayerDisplayName(currentParticipant, lettersRemaining)}`),
                scoreToBeat !== null && React.createElement('p', { className: controllerInfoTextClass }, "Score to Beat: ", React.createElement('span', {className: "font-bold text-white"}, scoreToBeat), React.createElement('span', {className: "block text-sm"}, `(Must score ${beersGlobalHighLowRule || 'N/A'})`)),
                scoreToBeat === null && React.createElement('p', {className: controllerInfoTextClass}, "You are setting the first score!")
            ),
            React.createElement('div', { className: "w-full max-w-xs space-y-3 flex flex-col items-center" },
                isMyTurnAndCanEnterScore && React.createElement('button', { onClick: handleEnterScore, className: `${controllerPrimaryButtonClass} bg-sky-500 hover:bg-sky-600 text-white` }, "🎯 Enter Score"),
                playerFailedAndLetterAssigned && React.createElement('div', { className: "text-center w-full p-3 bg-red-800/50 rounded-lg flex flex-col items-center" },
                    React.createElement('p', { className: "text-2xl sm:text-3xl text-red-300 font-semibold animate-pulse leading-tight" }, "You Failed!"),
                    React.createElement('p', { className: "text-md sm:text-lg text-red-200 my-1" }, `Letter "`, React.createElement('span', {className: "font-bold text-xl text-white"}, promptToTakeLetter.letter), `" assigned.`),
                    React.createElement('button', { onClick: handleAcknowledgeLetter, className: `${controllerSecondaryButtonClass} bg-orange-500 hover:bg-orange-600 text-white mt-2` }, "OK")
                ),
                showKeypadForBeers && showKeypadForBeers.participantIndex === currentPlayerIndex && ActualKeypadComponent &&
                     React.createElement(ActualKeypadComponent, { onSubmit: handleKeypadSubmit, onCancel: handleKeypadCancel, title: `Score for ${getPlayerDisplayName(currentParticipant, lettersRemaining)}` },
                        React.createElement('div', { className: "text-center text-sm text-gray-300 mb-2" }, "Enter total score for 3 darts.", showKeypadForBeers.isSettingInitialScore && scoreToBeat === null && React.createElement('p', { className: "text-yellow-300 font-semibold mt-0.5 sm:mt-1" }, "You're setting the first score!"), scoreToBeat !== null && React.createElement('p', { className: "text-gray-400 mt-0.5 sm:mt-1" }, `Must score ${beersGlobalHighLowRule} than `, React.createElement('span', { className: "font-bold text-white" }, scoreToBeat), "."))
                    ),
                canUndo && !showKeypadForBeers && !playerFailedAndLetterAssigned && React.createElement('button', { onClick: handleUndo, className: `${controllerSecondaryButtonClass} bg-yellow-500 hover:bg-yellow-600 text-black` }, "↩️ Undo Last")
            )
        );
    };

    if (displayRole === 'controller') {
        return renderControllerViewBeers();
    } else {
        return renderMainDisplayViewBeers();
    }
};

