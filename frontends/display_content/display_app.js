// display_app.js - Main React application for the Darts Display Frontend

// Ensure core libraries are loaded
if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || typeof io === 'undefined') {
    const missing = [
        typeof React === 'undefined' ? 'React' : null,
        typeof ReactDOM === 'undefined' ? 'ReactDOM' : null,
        typeof io === 'undefined' ? 'Socket.IO' : null,
    ].filter(Boolean).join(', ');
    const errorMsg = `Critical Error: Core libraries (${missing}) not loaded for Display. Check script tags in index.html.`;
    document.body.innerHTML = `<h1 style="color:red;text-align:center;margin-top:20px;">${errorMsg}</h1>`;
    throw new Error(errorMsg);
}

// --- Helper Functions & Shared Components ---
const IconPlaceholder = ({ emoji, size = 64, className = "", iconClassName = "" }) => (
    React.createElement('span', { className: `${className}`, style: { fontSize: `${size}px`, lineHeight: '1' } },
        React.createElement('span', { className: iconClassName }, emoji || "❓")
    )
);

window.WinTracker = ({ name, type, sessionStats }) => {
    if (!sessionStats || !name) return null;
    const wins = (type === 'team' ? sessionStats.teams?.[name] : sessionStats.players?.[name]) || 0;
    if (wins === 0) return null;
    return React.createElement('span', {
        className: "text-yellow-400 ml-3 text-3xl tracking-wide",
        title: `${wins} session win${wins > 1 ? 's' : ''}`
    }, '*'.repeat(wins));
};

// --- Game Mode Definitions (for display purposes) ---
const GAME_MODES = {
    CRICKET: { id: 'CRICKET', name: 'Cricket', description: 'Close out B, T, D, 20-15. Score on open numbers.', iconEmoji: "🎯", component: 'CricketGame' },
    THREE_FF: { id: 'THREE_FF', name: '3 Friendly Flights', description: 'Hit objectives, score points, or get halved!', iconEmoji: "🎲", component: 'ThreeFriendlyFlightsGame' },
    FIVE_ZERO_ONE: { id: 'FIVE_ZERO_ONE', name: '501', description: 'Race from 501 to 0. Double-in/out options.', iconEmoji: "🏁", component: 'FiveZeroOneGame' },
    AROUND_THE_WORLD: { id: 'AROUND_THE_WORLD', name: 'Around The World', description: 'Hit 1-20, SB, DB.', iconEmoji: "🌍", component: 'AroundTheWorldGame' },
    BEERS: { id: 'BEERS', name: 'B.E.E.R.S.', description: 'Beat previous score (High/Low).', iconEmoji: "🍺", component: 'BeersGame' },
    GOLF: { id: 'GOLF', name: 'Golf', description: 'Play 18 holes (1-18). Aim for lowest score.', iconEmoji: "⛳", component: 'GolfGame' },
    BASEBALL: { id: 'BASEBALL', name: 'Baseball', description: 'Play 9 innings (1-9). Score "runs".', iconEmoji: "⚾", component: 'BaseballGame' },
    KILLER: { id: 'KILLER', name: 'Killer', description: 'Claim number, become Killer, eliminate targets.', iconEmoji: "🔪", component: 'KillerGame' },
};

// --- Main App Component ---
const App = () => {
    const [currentView, setCurrentView] = React.useState('gameSelection');
    const [selectedGame, setSelectedGame] = React.useState(null);
    const [socket, setSocket] = React.useState(null);
    const [connectionStatus, setConnectionStatus] = React.useState('Initializing...');
    const [gameState, setGameState] = React.useState(null);
    const [persistentPlayers, setPersistentPlayers] = React.useState([]);
    const [stats, setStats] = React.useState({ sessionStats: { teams: {}, players: {} }, historicalStats: { teams: {}, players: {} } });

    const currentViewRef = React.useRef(currentView);
    React.useEffect(() => { currentViewRef.current = currentView; }, [currentView]);

    const transitionToMenu = React.useCallback(() => {
        setSelectedGame(null);
        setGameState(null);
        setCurrentView('gameSelection');
    }, []);

    const handleGameEnd = React.useCallback(() => {
        if (socket) socket.emit('requestMainMenu');
        transitionToMenu();
    }, [socket, transitionToMenu]);

    React.useEffect(() => {
        const SOCKET_SERVER_URL = `http://${window.location.hostname}:8046`;
        const newSocket = io(SOCKET_SERVER_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setConnectionStatus('Connected');
            newSocket.emit('requestGameState');
            newSocket.emit('getPersistentPlayersList');
            newSocket.emit('requestStats');
        });
        newSocket.on('disconnect', () => setConnectionStatus('Disconnected'));
        newSocket.on('connect_error', (error) => setConnectionStatus(`Error`));

        const handleGameStateReceived = (s) => {
            if (s && s.mode) {
                const gameModeDetails = Object.values(GAME_MODES).find(g => g.id === s.mode.toUpperCase());
                if (gameModeDetails) {
                    setGameState(s);
                    setSelectedGame(gameModeDetails);
                    setCurrentView('activeGame');
                } else {
                    console.error(`Received game state for unknown mode: ${s.mode}`);
                    transitionToMenu();
                }
            } else if (s === null && currentViewRef.current !== 'stats') {
                transitionToMenu();
            }
        };

        newSocket.on('gameState', handleGameStateReceived);
        newSocket.on('gameStateUpdate', handleGameStateReceived);
        newSocket.on('noGameActive', () => transitionToMenu());
        newSocket.on('persistentPlayersList', (list) => setPersistentPlayers(list || []));
        newSocket.on('statsUpdate', (newStats) => setStats(newStats));
        newSocket.on('displayStatsScreen', () => setCurrentView('stats'));

        return () => newSocket.disconnect();
    }, [transitionToMenu]);

    const GameOverScreen = ({ winner, onDismiss }) => {
        if (!winner) return null;
        return (
            React.createElement('div', { className: "fixed inset-0 w-screen h-screen bg-black bg-opacity-90 flex flex-col items-center justify-center z-[100] p-4" },
                React.createElement('div', { className: "bg-neutral-800 p-8 sm:p-12 rounded-2xl shadow-2xl text-center relative animate-pop-in max-w-3xl w-full border-4 border-amber-400" },
                    React.createElement('h1', { className: "text-6xl sm:text-8xl font-black game-title-font neon-text-yellow mb-6" }, "GAME OVER!"),
                    React.createElement('div', { className: "mb-8" },
                        React.createElement(IconPlaceholder, { emoji: "🏆", size: 120, className: "text-amber-300 mb-4 inline-block" }),
                        React.createElement('p', { className: "text-2xl text-gray-200 mb-2" }, "Winner:"),
                        React.createElement('p', { className: "text-5xl sm:text-6xl font-bold text-sky-400 game-title-font break-words leading-tight neon-text-blue" }, winner.name || "Unknown"),
                        winner.score !== undefined && React.createElement('p', { className: "text-2xl text-gray-200 mt-4" }, "Score: ", React.createElement('span', { className: "font-bold text-white" }, winner.score))
                    ),
                    React.createElement('button', { onClick: onDismiss, className: "bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 px-10 rounded-lg text-2xl game-title-font" }, "OK")
                )
            )
        );
    };

    const GameSelection = ({ onManagePlayers }) => (
        React.createElement('div', { className: "flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 md:p-8" },
            React.createElement('h1', { className: "text-5xl sm:text-6xl md:text-7xl font-black mb-10 game-title-font text-center neon-text-yellow tracking-wider" }, "Game Modes"),
            React.createElement('div', { className: "w-full max-w-5xl lg:max-w-6xl flex flex-col gap-6" },
                Object.values(GAME_MODES).map(mode => (
                    React.createElement('div', { key: mode.id, className: "game-display-row w-full flex items-center p-6 rounded-xl shadow-xl" },
                        React.createElement(IconPlaceholder, { emoji: mode.iconEmoji, size: 100, className: "mr-6 flex-shrink-0", iconClassName: "game-display-icon text-sky-400" }),
                        React.createElement('div', null,
                            React.createElement('h2', { className: "game-display-title game-title-font text-4xl md:text-5xl lg:text-6xl mb-2" }, mode.name),
                            React.createElement('p', { className: "game-display-description text-xl md:text-2xl text-neutral-300" }, mode.description)
                        )
                    )
                )),
                React.createElement('div', { className: "game-display-row w-full flex items-center p-6 rounded-xl shadow-xl", onClick: onManagePlayers },
                    React.createElement(IconPlaceholder, { emoji: "👥", size: 100, className: "mr-6 flex-shrink-0", iconClassName: "game-display-icon text-teal-400" }),
                    React.createElement('div', null,
                        React.createElement('h2', { className: "game-display-title game-title-font text-4xl md:text-5xl lg:text-6xl mb-2" }, "Manage Players"),
                        React.createElement('p', { className: "game-display-description text-xl md:text-2xl text-neutral-300" }, "View the roster of saved players.")
                    )
                )
            )
        )
    );

    const renderCurrentView = () => {
        switch (currentView) {
            case 'activeGame':
                if (!gameState || !selectedGame) return React.createElement('div', { className: "text-yellow-400 p-8 text-center animate-pulse text-2xl" }, "Loading Game...");
                const SpecificGameView = selectedGame ? window.gameComponentRegistry[selectedGame.component] : null;
                if (SpecificGameView) {
                    return React.createElement(SpecificGameView, { gameMode: selectedGame, onGameEnd: handleGameEnd, socket: socket, gameState: gameState, displayRole: "display", sessionStats: stats.sessionStats });
                }
                return React.createElement('div', { className: "text-red-500 p-8 text-center text-xl" }, `Error: Game component '${selectedGame.component}' not found. Check if its script file is loaded.`);
            default:
                return React.createElement(GameSelection, { onManagePlayers: () => {} });
        }
    };
    
    let statusIndicatorColor = connectionStatus === 'Connected' ? 'bg-green-500' : 'bg-red-500';

    return (
        React.createElement('div', { id: "root-container", className: "min-h-screen w-full flex flex-col bg-neutral-950" },
            React.createElement('header', { className: "p-3 sm:p-4 bg-neutral-900 shadow-lg fixed top-0 left-0 right-0 z-40 border-b-2 border-neutral-800" },
                React.createElement('div', { className: "container mx-auto flex justify-between items-center px-2 sm:px-4" },
                    React.createElement('div', { className: "text-2xl sm:text-3xl font-bold game-title-font flex items-center neon-text-yellow" },
                        React.createElement('span', { onClick: handleGameEnd, title: "Home / End Game", style:{fontSize:'28px', cursor: 'pointer', marginRight: '1rem'}}, '🏠'),
                        "Dart Display"
                    ),
                    React.createElement('div', { title: connectionStatus, className: `text-xs sm:text-sm px-3 py-1.5 rounded-full ${statusIndicatorColor} text-white font-semibold`},
                        connectionStatus === 'Connected' ? 'Online' : 'Offline'
                    )
                )
            ),
            React.createElement('main', { className: "flex-grow w-full" },
                renderCurrentView()
            ),
            gameState && gameState.gameOver && gameState.winner && (
                React.createElement(GameOverScreen, { winner: gameState.winner, onDismiss: handleGameEnd })
            )
        )
    );
};

// --- Start the App ---
const rootElement = document.getElementById('root');
if (rootElement) {
    ReactDOM.createRoot(rootElement).render(React.createElement(App));
    console.log("Darts Display App Initialized.");
} else {
    console.error("Display root element #root not found.");
}
