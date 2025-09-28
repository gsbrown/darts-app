// Ensure React is loaded before proceeding
if (typeof React === 'undefined') {
    document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:50px;">Error: React library not loaded.</h1>';
    throw new Error("React not loaded");
}
console.log('React version:', React.version);

// --- Helper Functions & Constants ---
const generateClientSideId = () => `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const IconPlaceholder = ({ emoji, size = 64, className = "" }) => (<span className={`icon-placeholder ${className}`} style={{ fontSize: `${size}px` }}>{emoji || "❓"}</span>);
const SOCKET_SERVER_URL = 'http://' + window.location.hostname + ':8046'; // Dynamic hostname

// --- Game Mode Definitions ---
const GAME_MODES = {
    CRICKET: { id: 'CRICKET', name: 'Cricket', description: 'Close out B, T, D, 20-15. Score on open numbers.', iconEmoji: "🎯", component: 'CricketGame', maxPlayers: 8, maxTeams: 4, playersPerTeam: 4, supportsTeams: true, individualOnly: false },
    THREE_FF: { id: 'THREE_FF', name: '3 Friendly Flights', description: 'Hit objectives, score points, or get halved! Round-robin for teams.', iconEmoji: "🎲", component: 'ThreeFriendlyFlightsGame', maxPlayers: 8, maxTeams: 4, playersPerTeam: 4, supportsTeams: true, individualOnly: false },
    FIVE_ZERO_ONE: { id: 'FIVE_ZERO_ONE', name: '501', description: 'Race from 501 to 0. Double-in and Double-out required.', iconEmoji: "📊", component: 'FiveZeroOneGame', maxPlayers: 8, maxTeams: 4, playersPerTeam: 4, supportsTeams: true, individualOnly: false },
    AROUND_THE_WORLD: { id: 'AROUND_THE_WORLD', name: 'Around The World', description: 'Hit 1-20, SB, DB. Report highest number hit for current target.', iconEmoji: "🌍", component: 'AroundTheWorldGame', maxPlayers: 8, maxTeams: 4, playersPerTeam: 4, supportsTeams: true, individualOnly: false },
    BEERS: { id: 'BEERS', name: 'BEERS', description: 'Beat the previous player\'s score (High or Low).', iconEmoji: "🍺", component: 'BeersGame', maxPlayers: 8, supportsTeams: false, individualOnly: true },
    GOLF: { id: 'GOLF', name: 'Golf', description: 'Play 18 holes (numbers 1-18). Aim for the lowest score.', iconEmoji: "⛳", component: 'GolfGame', maxPlayers: 8, maxTeams: 4, playersPerTeam: 4, supportsTeams: true, individualOnly: false },
    BASEBALL: { id: 'BASEBALL', name: 'Baseball', description: 'Play 9 innings (numbers 1-9). Score "runs" in each inning.', iconEmoji: "⚾", component: 'BaseballGame', maxPlayers: 8, maxTeams: 4, playersPerTeam: 4, supportsTeams: true, individualOnly: false },
    KILLER: { id: 'KILLER', name: 'Killer', description: 'Claim your number, become a Killer, eliminate targets.', iconEmoji: "🔪", component: 'KillerGame', maxPlayers: 8, supportsTeams: false, individualOnly: true },
};

// --- Reusable UI Components (Your full versions) ---
const Keypad = ({ initialValue = '', onSubmit, onCancel, title = "Enter Score", children }) => {
    const [inputValue, setInputValue] = React.useState(initialValue);
    const inputRef = React.useRef(null);
    React.useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
    const handleInput = (char) => {
        if (char === 'DEL') setInputValue(prev => prev.slice(0, -1));
        else if (char === 'CLR') setInputValue('');
        else if (inputValue.length < 3) setInputValue(prev => prev + char);
    };
    const handleSubmit = () => {
        const score = parseInt(inputValue, 10);
        if (!isNaN(score)) { onSubmit(score); }
        else if (inputValue === '' && onSubmit) { onSubmit(0); }
        else {
            const displayElement = inputRef.current?.querySelector('.keypad-display');
            if (displayElement) {
                const originalText = displayElement.textContent;
                displayElement.textContent = "Invalid Input"; displayElement.style.color = "#EF4444";
                setTimeout(() => { if(displayElement) { displayElement.textContent = inputValue || '0'; displayElement.style.color = "white";}}, 1500);
            }
        }
    };
    const handleKeyDown = (e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); };
    const keypadButtonsConfig = [ /* ... */ { display: '1', value: '1' }, { display: '2', value: '2' }, { display: '3', value: '3' }, { display: '4', value: '4' }, { display: '5', value: '5' }, { display: '6', value: '6' }, { display: '7', value: '7' }, { display: '8', value: '8' }, { display: '9', value: '9' }, { display: 'CLR', value: 'CLR' }, { display: '0', value: '0' }, { display: 'DEL', value: 'DEL' }];
    return (<div className="keypad-overlay" onKeyDown={handleKeyDown} tabIndex="-1" ref={inputRef}><div className="keypad"><h3 className="text-2xl font-semibold text-white text-center mb-3">{title}</h3>{children && <div className="keypad-children-wrapper">{children}</div>}<div className="keypad-display" tabIndex="0">{inputValue || '0'}</div><div className="keypad-grid">{keypadButtonsConfig.map(btn => (<button key={btn.display} onClick={() => handleInput(btn.value)} className="keypad-button">{btn.display}</button>))}</div><div className="keypad-actions-container"><button onClick={onCancel} className="keypad-button cancel flex-1">Cancel</button><button onClick={handleSubmit} className="keypad-button action flex-1">Submit</button></div></div></div>);
};
const GameModePlaceholder = ({ gameMode, onGameEnd, gameState }) => ( <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-800 rounded-lg shadow-xl"> <h2 className="text-5xl font-bold mb-8 game-title-font text-yellow-400">{gameMode.name}</h2> {gameState && (<div className="my-4 p-3 bg-gray-700 rounded w-full max-w-md text-left"><h3 className="text-lg font-semibold mb-2 text-yellow-300">Received Game State (Debug):</h3><pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">{JSON.stringify(gameState, null, 2)}</pre></div>)} <p className="text-xl text-gray-300 mb-8">Placeholder for {gameMode.name}.</p> <button onClick={onGameEnd} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-2xl">❌ End Game</button> </div> );
const GameOverScreen = ({ winner, onDismiss }) => { /* ... Your full GameOverScreen ... */ return null; };
const ManagePlayersScreen = ({ persistentPlayers, onSaveChanges, onBack, socket }) => { /* ... Your full ManagePlayersScreen ... */ return null; };
const PlayerSetup = ({ selectedGame, onSetupComplete, onCancel, persistentPlayers, socket }) => { /* ... Your full PlayerSetup ... */ return null; };
const GameSelection = ({ onSelectGame, onManagePlayers }) => { /* ... Your full GameSelection ... */ return null; };


// Registry for dynamically loading game components
const gameComponentRegistry = { /* Populated in App's useEffect */ };

// --- Main App Component ---
const App = () => {
    const [currentView, setCurrentView] = React.useState('gameSelection');
    const [selectedGame, setSelectedGame] = React.useState(null);
    const [socket, setSocket] = React.useState(null);
    const [connectionStatus, setConnectionStatus] = React.useState('Initializing...');
    const [gameState, setGameState] = React.useState(null);
    const [persistentPlayers, setPersistentPlayers] = React.useState([]);
    const [clientPlayerId, setClientPlayerId] = React.useState(null);

    // Refs to hold the latest state for use in socket handlers without causing re-subscriptions
    const currentViewRef = React.useRef(currentView);
    const gameStateRef = React.useRef(gameState);
    React.useEffect(() => { currentViewRef.current = currentView; }, [currentView]);
    React.useEffect(() => { gameStateRef.current = gameState; }, [gameState]);


    // Initialize gameComponentRegistry once
    React.useEffect(() => {
        if (typeof CricketGame !== 'undefined') gameComponentRegistry.CricketGame = CricketGame;
        if (typeof ThreeFriendlyFlightsGame !== 'undefined') gameComponentRegistry.ThreeFriendlyFlightsGame = ThreeFriendlyFlightsGame;
        if (typeof FiveZeroOneGame !== 'undefined') gameComponentRegistry.FiveZeroOneGame = FiveZeroOneGame;
        if (typeof AroundTheWorldGame !== 'undefined') gameComponentRegistry.AroundTheWorldGame = AroundTheWorldGame;
        if (typeof BeersGame !== 'undefined') gameComponentRegistry.BeersGame = BeersGame;
        if (typeof GolfGame !== 'undefined') gameComponentRegistry.GolfGame = GolfGame;
        if (typeof BaseballGame !== 'undefined') gameComponentRegistry.BaseballGame = BaseballGame;
        if (typeof KillerGame !== 'undefined') gameComponentRegistry.KillerGame = KillerGame;
    }, []);

    const transitionToMenu = React.useCallback(() => {
        console.log("TransitionToMenu: Setting view to gameSelection, clearing selectedGame and gameState.");
        setSelectedGame(null);
        setGameState(null);
        setCurrentView('gameSelection'); // This should trigger re-render and useEffect re-run if currentView is a dep
        setClientPlayerId(null);
    }, []); // setX functions are stable

    const handleGameEnd = React.useCallback((emitToServer = true) => {
        console.log("handleGameEnd called. emitToServer:", emitToServer);
        if (emitToServer && socket && gameStateRef.current && gameStateRef.current.mode) { // Use ref here
            console.log("Emitting endGame to server for mode:", gameStateRef.current.mode);
            socket.emit('endGame');
        }
        transitionToMenu();
    }, [socket, transitionToMenu]); // gameStateRef is not needed as a dep

    // Effect for initializing the socket connection
    React.useEffect(() => {
        const sessionSpecificId = generateClientSideId();
        const newSocket = io(SOCKET_SERVER_URL, { query: { clientSessionId: sessionSpecificId } });
        setSocket(newSocket);
        console.log("MainDisplay: Socket initialized.");
        return () => {
            if (newSocket) {
                console.log("MainDisplay: Disconnecting socket.");
                newSocket.disconnect();
            }
        };
    }, []);

    // Effect for handling socket event listeners
    React.useEffect(() => {
        if (!socket) {
            console.log("MainDisplay: Socket not ready for listeners.");
            return;
        }
        console.log("MainDisplay: Attaching socket listeners.");

        const handleConnect = () => {
            console.log("MainDisplay: Socket connected.");
            setConnectionStatus('Connected');
            socket.emit('requestGameState');
            socket.emit('getPersistentPlayersList');
        };
        const handleDisconnect = (reason) => {
            console.log("MainDisplay: Socket disconnected, reason:", reason);
            setConnectionStatus('Disconnected');
            if (reason === 'io server disconnect') socket.connect();
        };
        const handleConnectError = (error) => {
            console.error("MainDisplay: Socket connection error:", error);
            setConnectionStatus(`Error: ${error.message.substring(0, 30)}...`);
        };

        const handleGameStateReceived = (s, eventName) => {
            console.log(`MainDisplay: Received ${eventName}. Incoming state (s):`, s ? s.mode : "null", ". CurrentView (ref):", currentViewRef.current, "Current gameState (ref is null?):", gameStateRef.current === null);
            if (s && s.mode) {
                const gameModeDetails = Object.values(GAME_MODES).find(g => g.id === s.mode.toUpperCase());
                if (gameModeDetails) {
                    setGameState(s);
                    setSelectedGame(gameModeDetails);
                    setCurrentView('activeGame'); // This will trigger a re-render
                    // Killer specific logic can remain or be adapted
                    if (s.mode === 'KILLER') { // Simplified clientPlayerId logic for now
                        const currentClientPlayerId = clientPlayerId; // Capture current value
                        if (!currentClientPlayerId && s.participants && s.participants.length > 0) {
                             setClientPlayerId(s.participants[0].id);
                        }
                    }

                } else {
                    console.warn("MainDisplay: Unknown game mode from server:", s.mode, ". Transitioning to menu.");
                    transitionToMenu();
                }
            } else if (s === null) {
                console.log("MainDisplay: Incoming game state (s) is null. Transitioning to menu.");
                transitionToMenu(); // Force transition to menu
            }
        };

        const handleNoGameActive = () => {
            console.log("MainDisplay: Received noGameActive. Transitioning to menu.");
            transitionToMenu(); // Force transition to menu
        };

        const handlePersistentPlayersList = (list) => { setPersistentPlayers(list || []); };
        const handleGameStartError = (errorMessage) => {
            alert(`Error starting game: ${errorMessage}`);
            console.log("MainDisplay: Game start error. Transitioning to menu.");
            transitionToMenu();
        };
        const handleKillerError = (errorMessage) => { alert(`Killer Game Error: ${errorMessage}`); };
        const handlePersistentPlayersUpdateStatus = (status) => { if(status.success) alert(status.message || 'Player list updated!'); else alert(`Error: ${status.message || 'Failed to update.'}`); };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);
        socket.on('gameState', (s) => handleGameStateReceived(s, 'gameState'));
        socket.on('gameStateUpdate', (s) => handleGameStateReceived(s, 'gameStateUpdate'));
        socket.on('noGameActive', handleNoGameActive);
        socket.on('persistentPlayersList', handlePersistentPlayersList);
        socket.on('gameStartError', handleGameStartError);
        socket.on('killerError', handleKillerError);
        socket.on('persistentPlayersUpdateStatus', handlePersistentPlayersUpdateStatus);

        return () => {
            console.log("MainDisplay: Cleaning up socket listeners.");
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect_error', handleConnectError);
            socket.off('gameState', handleGameStateReceived);
            socket.off('gameStateUpdate', handleGameStateReceived);
            socket.off('noGameActive', handleNoGameActive);
            socket.off('persistentPlayersList', handlePersistentPlayersList);
            socket.off('gameStartError', handleGameStartError);
            socket.off('killerError', handleKillerError);
            socket.off('persistentPlayersUpdateStatus', handlePersistentPlayersUpdateStatus);
        };
    }, [socket, transitionToMenu, clientPlayerId]); // Simplified dependencies: socket and stable callbacks. clientPlayerId for killer logic.

    // Effect for Killer clientPlayerId (if still needed separately)
     React.useEffect(() => {
        if (gameState && gameState.mode === 'KILLER' && !clientPlayerId && gameState.participants && gameState.participants.length > 0) {
            setClientPlayerId(gameState.participants[0].id);
        } else if ((gameState && gameState.mode !== 'KILLER') || !gameState) { // If not killer OR no game state
            if (clientPlayerId !== null) { // Only set if it's currently not null
                setClientPlayerId(null);
            }
        }
    }, [gameState, clientPlayerId]); // clientPlayerId is needed here if it can be set by other means


    const handleGameSelect = (gameMode) => { setSelectedGame(gameMode); setCurrentView('playerSetup'); setGameState(null); setClientPlayerId(null); };
    const handleManagePlayersNav = () => { setCurrentView('managePlayers'); };
    const handlePlayerSetupComplete = (participantsForGame, gameSpecificOpts = {}) => {
        if (socket && selectedGame) {
            if (selectedGame.id === GAME_MODES.KILLER.id) {
                if (participantsForGame && participantsForGame.length > 0) {
                    const firstPlayerForClientControl = participantsForGame[0].id;
                    setClientPlayerId(firstPlayerForClientControl); // This might trigger the killer useEffect
                    socket.emit('startKillerGame', { players: participantsForGame });
                } else {
                    alert("Error: Cannot start Killer game without players.");
                }
            } else {
                setClientPlayerId(null); // Ensure clientPlayerId is null for non-killer games
                socket.emit('startGame', selectedGame.id, { names: participantsForGame, ...gameSpecificOpts });
            }
        } else {
            alert("Error: Not connected to server or no game selected. Cannot start game.");
        }
    };
    const handlePlayerSetupCancel = () => { transitionToMenu(); };
    const handleSavePersistentPlayers = (updatedList) => { if (socket) { socket.emit('updatePersistentPlayersList', updatedList); } else { alert("Not connected to server to save players."); } };


    const renderCurrentView = () => {
        console.log("RenderCurrentView. CurrentView:", currentView, "SelectedGame:", selectedGame ? selectedGame.id : "null", "GameState (is null?):", gameState === null);
        switch (currentView) {
            case 'playerSetup':
                return selectedGame ? <PlayerSetup selectedGame={selectedGame} onSetupComplete={handlePlayerSetupComplete} onCancel={handlePlayerSetupCancel} persistentPlayers={persistentPlayers} socket={socket} /> : <GameSelection onSelectGame={handleGameSelect} onManagePlayers={handleManagePlayersNav} />;
            case 'activeGame':
                // If currentView is 'activeGame', but selectedGame or gameState is null/mismatched,
                // it means we are likely in a transition to menu, or waiting for sync.
                if (!selectedGame || !gameState || gameState.mode !== selectedGame.id) {
                    console.log("Render 'activeGame': Conditions not met for displaying game. SelectedGame:", selectedGame ? selectedGame.id : "null", "GameState:", gameState ? gameState.mode : "null");
                    // The "Waiting for {X} game data..." message comes from this block
                    let loadingMessage = "Syncing with server...";
                    if (selectedGame && !gameState) { // Still selected a game, but server state is null
                        loadingMessage = `Waiting for ${selectedGame.name} game data...`;
                    } else if (!selectedGame && gameState) { // Server has state, but client has no selected game (should not happen if currentView is 'activeGame')
                        loadingMessage = "Client state mismatch: Game selected is null. Syncing...";
                    } else if (selectedGame && gameState && gameState.mode !== selectedGame.id) {
                        loadingMessage = `Mode mismatch. Server: ${gameState.mode}, Client expected: ${selectedGame.id}. Syncing...`;
                    } else if (!selectedGame && !gameState && currentView === 'activeGame') {
                        // This is a problematic state: view is 'activeGame' but no game info.
                        // Should have been caught by transitionToMenu.
                        loadingMessage = "Error: In active game view with no game data. Attempting to reset...";
                        // Consider calling transitionToMenu() here after a delay or logging an error for further debug
                        // For now, just show a generic message. The useEffect should correct this.
                    }
                    return <div className="text-yellow-400 p-8 text-center animate-pulse text-2xl">{loadingMessage}</div>;
                }
                // If we reach here, selectedGame and gameState are valid for the active game
                const SpecificGameView = gameComponentRegistry[selectedGame.component];
                if (SpecificGameView) {
                    return <SpecificGameView gameMode={selectedGame} onGameEnd={() => handleGameEnd(true)} socket={socket} gameState={gameState} clientPlayerId={clientPlayerId} />;
                } else {
                    return <GameModePlaceholder gameMode={selectedGame} onGameEnd={() => handleGameEnd(true)} gameState={gameState} />;
                }
            case 'managePlayers':
                return <ManagePlayersScreen persistentPlayers={persistentPlayers} onSaveChanges={handleSavePersistentPlayers} onBack={() => setCurrentView('gameSelection')} socket={socket} />;
            case 'gameSelection':
            default:
                return <GameSelection onSelectGame={handleGameSelect} onManagePlayers={handleManagePlayersNav} />;
        }
    };

    let statusIndicatorColor = 'bg-yellow-500';
    if (connectionStatus === 'Connected') statusIndicatorColor = 'bg-green-600';
    else if (connectionStatus.startsWith('Disconnected') || connectionStatus.startsWith('Error')) statusIndicatorColor = 'bg-red-600';

    return (
        <div id="root-container" className="min-h-screen w-full flex flex-col bg-gray-900">
            <header className="p-3 bg-gray-800 shadow-md fixed top-0 left-0 right-0 z-40">
                <div className="container mx-auto flex justify-between items-center px-2 sm:px-4">
                    <div className="text-xl sm:text-2xl font-bold text-yellow-400 game-title-font flex items-center">
                        <span
                            className="mr-2 sm:mr-3 text-blue-400 cursor-pointer hover:text-blue-300 p-1 transition-colors"
                            onClick={() => {
                                if (currentViewRef.current === 'activeGame' && gameStateRef.current && !gameStateRef.current.gameOver) {
                                    if (!confirm('Leave current game?')) return;
                                }
                                handleGameEnd(currentViewRef.current === 'activeGame' && gameStateRef.current?.mode);
                            }}
                            title="Home / End Game"
                            style={{fontSize:'24px', lineHeight: '1'}}
                        >
                            🏠
                        </span>
                        Darts Scorer
                    </div>
                    <div
                        title={connectionStatus}
                        className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full ${statusIndicatorColor} text-white truncate max-w-[100px] sm:max-w-[150px] transition-colors`}
                    >
                        {connectionStatus === 'Connected' ? 'Online' : (connectionStatus.startsWith('Error') ? 'Error' : 'Offline')}
                    </div>
                </div>
            </header>
            <main className="flex-grow w-full pt-16 pb-12"> {/* Added padding for fixed header/footer */}
                {renderCurrentView()}
            </main>
            <footer className="p-3 sm:p-4 bg-gray-800 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-700 fixed bottom-0 left-0 right-0 z-30">
                &copy; {new Date().getFullYear()} Darts Scoring App. Client ID (Session/Game): {clientPlayerId || "N/A"}
            </footer>
        </div>
    );
};

// Render the App component to the DOM
const rootElement = document.getElementById('root');
if (rootElement) { ReactDOM.createRoot(rootElement).render(<App />); }
else {
    console.error("Root element #root not found in HTML. App cannot be mounted.");
    document.body.innerHTML = '<div style="color: red; text-align: center; margin-top: 50px; font-size: 24px;">Critical Error: App Root (#root) Missing.</div>';
}
