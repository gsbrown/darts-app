// controller_app.js - Main React application for the Darts Controller Frontend
// REVAMPED: Team system overhaul. Manage Players is for individuals only. Game Setup is a new team builder.
// Drag-and-drop replaced with tap-to-add and arrow-based ordering.

if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || typeof io === 'undefined' || typeof Babel === 'undefined') {
    const missing = [ typeof React === 'undefined' ? 'React' : null, typeof ReactDOM === 'undefined' ? 'ReactDOM' : null, typeof io === 'undefined' ? 'Socket.IO' : null, typeof Babel === 'undefined' ? 'Babel' : null, ].filter(Boolean).join(', ');
    const errorMsg = `Critical Error: Core libraries (${missing}) not loaded for Controller. Check script tags in controller.html.`;
    document.body.innerHTML = `<h1 style="color:red;text-align:center;margin-top:20px;padding:10px;font-size:16px;">${errorMsg}</h1>`;
    throw new Error(errorMsg);
}

// --- Helper Functions & Constants ---
const generateClientSideId = () => `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const IconPlaceholder = ({ emoji, size = 40, className = "" }) => React.createElement('span', { className: `icon-placeholder ${className}`, style: { fontSize: `${size}px`, lineHeight: '1' } }, emoji || "❓");

const GAME_MODES = {
    CRICKET: { id: 'CRICKET', name: 'Cricket', description: 'Close out B, T, D, 20-15. Score on open numbers.', iconEmoji: "🎯", maxTeams: 4, playersPerTeam: 4, individualOnly: false },
    // MODIFICATION: Explicitly define the component name to match the actual component in the game file.
    THREE_FF: { id: 'THREE_FF', name: '3 Friendly Flights', description: 'Hit objectives, score points, or get halved!', iconEmoji: "🎲", maxTeams: 4, playersPerTeam: 4, individualOnly: false, component: 'ThreeFriendlyFlightsGame' },
    FIVE_ZERO_ONE: { id: 'FIVE_ZERO_ONE', name: '501', description: 'Race from 501 to 0. Double-in/out options.', iconEmoji: "📊", maxTeams: 4, playersPerTeam: 4, individualOnly: false },
    AROUND_THE_WORLD: { id: 'AROUND_THE_WORLD', name: 'Around The World', description: 'Hit 1-20, SB, DB. Report highest number hit.', iconEmoji: "🌍", maxTeams: 4, playersPerTeam: 4, individualOnly: false },
    BEERS: { id: 'BEERS', name: 'B.E.E.R.S.', description: 'Beat previous score (High/Low).', iconEmoji: "🍺", maxTeams: 8, playersPerTeam: 1, individualOnly: true },
    GOLF: { id: 'GOLF', name: 'Golf', description: 'Play 18 holes (1-18). Aim for lowest score.', iconEmoji: "⛳", maxTeams: 4, playersPerTeam: 4, individualOnly: false },
    BASEBALL: { id: 'BASEBALL', name: 'Baseball', description: 'Play 9 innings (1-9). Score "runs".', iconEmoji: "⚾", maxTeams: 4, playersPerTeam: 4, individualOnly: false },
    KILLER: { id: 'KILLER', name: 'Killer', description: 'Claim number, become Killer, eliminate targets.', iconEmoji: "🔪", maxTeams: 8, playersPerTeam: 1, individualOnly: true },
};

// MODIFICATION: Add a check to ensure we don't overwrite an explicitly defined component name.
Object.keys(GAME_MODES).forEach(key => {
    if (!GAME_MODES[key].component) {
        GAME_MODES[key].component = `${key.charAt(0) + key.slice(1).toLowerCase().replace(/_([a-z])/g, g => g[1].toUpperCase())}Game`;
    }
});


// --- UI Components ---

const GameSelectionScreenController = ({ onSelectGame, onManagePlayers, onShowStats }) => {
    return React.createElement('div', { className: "flex flex-col items-center p-2 sm:p-4 h-full overflow-y-auto custom-scrollbar" },
        React.createElement('h1', { className: "text-3xl sm:text-4xl font-bold mb-6 game-title-font text-yellow-300 text-center" }, "Select Game"),
        React.createElement('div', { className: "grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md" },
            Object.values(GAME_MODES).map(mode => React.createElement('button', {
                key: mode.id,
                onClick: () => onSelectGame(mode),
                className: "bg-slate-700 hover:bg-blue-600 text-white rounded-lg p-3 shadow-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 ring-blue-500 flex flex-col items-center"
            },
                React.createElement(IconPlaceholder, { emoji: mode.iconEmoji, className: "mb-2" }),
                React.createElement('h2', { className: "text-lg sm:text-xl font-semibold game-title-font" }, mode.name)
            )),
            React.createElement('div', { className: "sm:col-span-2 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" },
                React.createElement('button', {
                    onClick: onManagePlayers,
                    className: "bg-slate-700 hover:bg-teal-600 text-white rounded-lg p-3 shadow-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 ring-teal-500 flex flex-col items-center justify-center"
                },
                    React.createElement(IconPlaceholder, { emoji: "👥", className: "mb-2" }),
                    React.createElement('h2', { className: "text-lg sm:text-xl font-semibold game-title-font" }, "Manage Players")
                ),
                React.createElement('button', {
                    onClick: onShowStats,
                    className: "bg-slate-700 hover:bg-purple-600 text-white rounded-lg p-3 shadow-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 ring-purple-500 flex flex-col items-center justify-center"
                },
                    React.createElement(IconPlaceholder, { emoji: "🏆", className: "mb-2" }),
                    React.createElement('h2', { className: "text-lg sm:text-xl font-semibold game-title-font" }, "View Stats")
                )
            )
        )
    );
};

const PlayerSetupScreenController = ({ selectedGameMode, onSetupComplete, onCancel, persistentPlayers = [] }) => {
    const [participants, setParticipants] = React.useState([]);
    const [editingTeam, setEditingTeam] = React.useState(null);
    // MODIFICATION: Add state to hold the selected BEERS rule.
    const [beersRule, setBeersRule] = React.useState('HIGHER');

    const availablePlayers = React.useMemo(() => {
        const playersInTeams = new Set(participants.flatMap(p => p.players || []));
        return persistentPlayers.filter(p => !playersInTeams.has(p.name));
    }, [persistentPlayers, participants]);
    
    const handleMoveParticipant = (participantId, direction) => {
        const index = participants.findIndex(p => p.id === participantId);
        if (index === -1) return;
        const newParticipants = [...participants];
        if (direction === 'up' && index > 0) {
            [newParticipants[index], newParticipants[index - 1]] = [newParticipants[index - 1], newParticipants[index]];
        } else if (direction === 'down' && index < newParticipants.length - 1) {
            [newParticipants[index], newParticipants[index + 1]] = [newParticipants[index + 1], newParticipants[index]];
        }
        setParticipants(newParticipants);
    };

    const handleMoveTeamPlayer = (playerName, direction) => {
        if (!editingTeam) return;
        const players = [...editingTeam.players];
        const index = players.indexOf(playerName);
        if (index === -1) return;
        if (direction === 'up' && index > 0) {
            [players[index], players[index - 1]] = [players[index - 1], players[index]];
        } else if (direction === 'down' && index < players.length - 1) {
            [players[index], players[index + 1]] = [players[index + 1], players[index]];
        }
        setEditingTeam(prev => ({ ...prev, players }));
    };
    
    const addParticipantToGame = (player) => {
        if (selectedGameMode.individualOnly) {
             const newTeam = { id: player.id, name: player.name.charAt(0), type: 'team', players: [player.name] };
             setParticipants(prev => [...prev, newTeam]);
        }
    };

    const handleCreateTeam = () => {
        const newTeamId = generateClientSideId();
        const newTeam = { id: newTeamId, name: 'New Team', type: 'team', players: [] };
        setParticipants(prev => [...prev, newTeam]);
        setEditingTeam(newTeam);
    };

    const removeParticipant = (participantId) => {
        setParticipants(prev => prev.filter(p => p.id !== participantId));
    };
    
    const updateParticipant = (updatedParticipant) => {
        if (updatedParticipant.type === 'team' && updatedParticipant.players.length > 0) {
            updatedParticipant.name = updatedParticipant.players.map(p => p.charAt(0)).join(' / ');
        } else if (updatedParticipant.type === 'team') {
            updatedParticipant.name = "Empty Team";
        }
        setParticipants(prev => prev.map(p => p.id === updatedParticipant.id ? updatedParticipant : p));
        setEditingTeam(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (participants.some(p => p.players.length === 0)) {
            alert("All teams must have at least one player.");
            return;
        }
        if (participants.length === 0) {
            alert("Please add at least one team to the game.");
            return;
        }
        
        // MODIFICATION: Create a specific options object and add the BEERS rule if it's the selected game.
        const gameSpecificOptions = {};
        if (selectedGameMode.id === 'BEERS') {
            gameSpecificOptions.beersRule = beersRule;
        }
        onSetupComplete(participants, gameSpecificOptions);
    };
    
    const renderAvailablePlayerListForTeam = (team) => {
        if (!team) return null;

        const playersInOtherTeams = new Set(participants.filter(p => p.id !== team.id).flatMap(p => p.players || []));
        const currentTeamPlayers = new Set(team.players);
        const availableForThisTeam = persistentPlayers.filter(p => !playersInOtherTeams.has(p.name) && !currentTeamPlayers.has(p.name));
        
        return (
            React.createElement('div', { className: "space-y-2 mt-4" },
                React.createElement('h4', { className: "text-lg font-semibold text-slate-300 border-b border-slate-600 pb-1 mb-2" }, "Add Players to Team"),
                 React.createElement('div', { className: "max-h-48 overflow-y-auto bg-slate-800 p-2 rounded-md space-y-1 custom-scrollbar" },
                    availableForThisTeam.length === 0 && React.createElement('p', { className: "text-slate-400 text-sm italic p-2" }, "All available players added."),
                    availableForThisTeam.map(player => (
                        React.createElement('div', { key: player.id, className: "flex justify-between items-center bg-slate-700 hover:bg-slate-600 p-2 rounded" },
                            React.createElement('span', { className: "text-white" }, player.name),
                            React.createElement('button', {
                                type: "button",
                                onClick: () => {
                                    if (team.players.length < selectedGameMode.playersPerTeam) {
                                        setEditingTeam(t => ({ ...t, players: [...t.players, player.name] }));
                                    }
                                },
                                disabled: team.players.length >= selectedGameMode.playersPerTeam,
                                className: "text-green-400 hover:text-green-300 font-bold disabled:text-slate-500 disabled:cursor-not-allowed"
                            }, "Add")
                        )
                    ))
                )
            )
        );
    };

    const renderSelectedParticipants = () => (
        React.createElement('div', { className: "space-y-2" },
            React.createElement('h3', { className: "text-lg font-semibold text-slate-200 border-b border-slate-600 pb-1 mb-2" }, "Game Turn Order"),
            participants.length === 0 && React.createElement('p', { className: "text-slate-400 text-center py-3" }, selectedGameMode.individualOnly ? "Tap a player below to add them." : "Create a team to get started."),
            React.createElement('div', { className: "min-h-[100px] p-2 bg-slate-800 rounded-lg space-y-2" },
                participants.map((p, index) => (
                    React.createElement('div', {
                        key: p.id,
                        className: `flex items-center justify-between p-3 bg-slate-700 rounded-md`
                    },
                        React.createElement('div', { className: "flex items-center flex-grow min-w-0" },
                            React.createElement('span', { className: "text-slate-400 mr-3 font-mono" }, `${index + 1}.`),
                            React.createElement('div', { className: "truncate" },
                                React.createElement('span', { className: "font-semibold text-lg text-white" }, p.name),
                                p.players && p.players.length > 0 &&
                                React.createElement('span', { className: "text-xs text-slate-400 ml-2 block truncate" }, `(${p.players.join(', ')})`)
                            )
                        ),
                        React.createElement('div', { className: "flex items-center space-x-2 flex-shrink-0" },
                            React.createElement('div', { className: 'flex flex-col' },
                                React.createElement('button', { type: 'button', onClick: () => handleMoveParticipant(p.id, 'up'), disabled: index === 0, className: "text-xl text-sky-300 hover:text-sky-100 disabled:text-slate-600 disabled:cursor-not-allowed" }, '▲'),
                                React.createElement('button', { type: 'button', onClick: () => handleMoveParticipant(p.id, 'down'), disabled: index === participants.length - 1, className: "text-xl text-sky-300 hover:text-sky-100 disabled:text-slate-600 disabled:cursor-not-allowed" }, '▼')
                            ),
                            !selectedGameMode.individualOnly && React.createElement('button', {
                                type: 'button',
                                onClick: () => setEditingTeam(p),
                                className: "text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold py-1 px-2 rounded"
                            }, "Edit"),
                            React.createElement('button', {
                                type: 'button',
                                onClick: () => removeParticipant(p.id),
                                className: "text-red-400 hover:text-red-300 text-2xl font-bold"
                            }, "⊖")
                        )
                    )
                ))
            )
        )
    );

    // MODIFICATION: New function to render the High/Low rule selection for BEERS.
    const renderBeersOptions = () => (
        React.createElement('div', { className: "my-4 p-3 bg-slate-800 rounded-lg" },
            React.createElement('h3', { className: "text-lg font-semibold text-slate-200 mb-2 text-center" }, "Game Rule"),
            React.createElement('div', { className: "flex justify-center gap-3" },
                React.createElement('button', {
                    type: 'button',
                    onClick: () => setBeersRule('HIGHER'),
                    className: `px-4 py-2 rounded-md font-semibold transition-all ${beersRule === 'HIGHER' ? 'bg-green-600 text-white ring-2 ring-white' : 'bg-slate-600 text-slate-200 hover:bg-slate-500'}`
                }, "Play High (Score >)"),
                React.createElement('button', {
                    type: 'button',
                    onClick: () => setBeersRule('LOWER'),
                    className: `px-4 py-2 rounded-md font-semibold transition-all ${beersRule === 'LOWER' ? 'bg-green-600 text-white ring-2 ring-white' : 'bg-slate-600 text-slate-200 hover:bg-slate-500'}`
                }, "Play Low (Score <)")
            )
        )
    );

    const renderEditTeamModal = () => {
        if (!editingTeam) return null;
        
        const removePlayerFromTeam = (playerName) => {
            setEditingTeam(t => ({...t, players: t.players.filter(p => p !== playerName)}));
        };

        return (
            React.createElement(ModalOverlay, { onClose: () => setEditingTeam(null) },
                React.createElement('h3', { className: "text-xl font-bold mb-4 text-yellow-300" }, `Editing Team`),
                React.createElement('p', { className: "text-sm text-slate-300 mb-4" }, "Add players from the list below. Use the arrows to set their throwing order."),
                React.createElement('div', { className: "space-y-2" },
                    React.createElement('h4', { className: "text-lg font-semibold text-slate-300 border-b border-slate-600 pb-1" }, "Current Players"),
                    editingTeam.players.length === 0 
                        ? React.createElement('p', { className: "text-slate-400 italic p-2" }, "No players in this team yet.")
                        : editingTeam.players.map((playerName, index) => (
                            React.createElement('div', {
                                key: `${playerName}-${index}`,
                                className: `flex items-center justify-between p-2 bg-slate-600 rounded-md`
                            },
                                React.createElement('div', { className: 'flex items-center' },
                                    React.createElement('span', { className: "text-slate-400 mr-3" }, `#${index + 1}`),
                                    React.createElement('span', { className: "font-medium text-white" }, playerName)
                                ),
                                React.createElement('div', { className: 'flex items-center space-x-2' },
                                    React.createElement('button', { type: 'button', onClick: () => handleMoveTeamPlayer(playerName, 'up'), disabled: index === 0, className: "text-xl text-sky-300 hover:text-sky-100 disabled:text-slate-600" }, '▲'),
                                    React.createElement('button', { type: 'button', onClick: () => handleMoveTeamPlayer(playerName, 'down'), disabled: index === editingTeam.players.length - 1, className: "text-xl text-sky-300 hover:text-sky-100 disabled:text-slate-600" }, '▼'),
                                    React.createElement('button', { type: 'button', onClick: () => removePlayerFromTeam(playerName), className: "text-red-400 text-xl" }, '⊖')
                                )
                            )
                        ))
                ),
                renderAvailablePlayerListForTeam(editingTeam),
                React.createElement('div', { className: "flex justify-end space-x-3 mt-6" },
                    React.createElement('button', { type: 'button', onClick: () => setEditingTeam(null), className: "px-4 py-2 rounded-md bg-slate-500 hover:bg-slate-400 font-semibold" }, "Cancel"),
                    React.createElement('button', { type: 'button', onClick: () => updateParticipant(editingTeam), className: "px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 text-white font-semibold" }, "Done")
                )
            )
        );
    };

    const renderGameSetupActions = () => {
         if (selectedGameMode.individualOnly) {
            return (
                 React.createElement('div', { className: "space-y-2" },
                    React.createElement('h3', { className: "text-lg font-semibold text-slate-200 border-b border-slate-600 pb-1 mb-2" }, "Available Players"),
                    React.createElement('div', { className: "max-h-60 overflow-y-auto custom-scrollbar p-2 bg-slate-800 rounded-lg" },
                        availablePlayers.length === 0 && React.createElement('p', { className: "text-slate-400 text-center py-3" }, "All players added or no players saved."),
                        availablePlayers.map(p => (
                            React.createElement('button', {
                                key: p.id,
                                type: 'button',
                                onClick: () => addParticipantToGame(p),
                                className: "w-full flex justify-between items-center text-left p-3 mb-2 bg-slate-700 hover:bg-sky-600 rounded-md transition-colors"
                            },
                                React.createElement('span', { className: "font-medium" }, p.name),
                                React.createElement('span', { className: "text-xl text-green-400" }, "⊕")
                            )
                        ))
                    )
                )
            );
        }
        return (
            React.createElement('div', null,
                React.createElement('button', {
                    type: 'button',
                    onClick: handleCreateTeam,
                    className: "w-full p-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold text-lg"
                }, "＋ Create New Team")
            )
        );
    }

    return (
        React.createElement('div', { className: "p-2 sm:p-3 h-full flex flex-col text-sm" },
            React.createElement('div', { className: "flex justify-between items-center mb-4" },
                React.createElement('h2', { className: "text-2xl font-bold game-title-font text-yellow-300" }, `${selectedGameMode.name} Setup`),
                React.createElement('button', { type: "button", onClick: onCancel, className: "text-slate-300 hover:text-white text-2xl p-1 rounded-full" }, "✕")
            ),
            
            React.createElement('form', { onSubmit: handleSubmit, className: "flex-grow overflow-y-auto space-y-4 custom-scrollbar pr-1 pb-16" },
                renderSelectedParticipants(),
                // MODIFICATION: Conditionally render the BEERS options UI.
                selectedGameMode.id === 'BEERS' && renderBeersOptions(),
                renderGameSetupActions()
            ),

            renderEditTeamModal(),

            React.createElement('div', { className: "pt-4 mt-auto flex justify-end space-x-3 sticky bottom-0 bg-slate-900 py-3 border-t border-slate-700 px-2" },
                React.createElement('button', { type: "button", onClick: onCancel, className: "px-4 py-2 text-base rounded-md font-semibold shadow-md bg-slate-600 hover:bg-slate-500 text-slate-100" }, "Cancel"),
                React.createElement('button', {
                    type: "submit",
                    onClick: handleSubmit,
                    className: "px-4 py-2 text-base rounded-md font-semibold shadow-md bg-green-600 hover:bg-green-500 text-white flex items-center"
                },
                    React.createElement('span', { className: "mr-2 text-lg" }, "▶️"), "Start Game"
                )
            )
        )
    );
};


const ModalOverlay = ({ children, onClose }) => (
    React.createElement('div', {
        className: "fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-3",
        onClick: onClose
    },
        React.createElement('div', { className: "player-form-modal-content bg-slate-800 p-6 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto w-full max-w-md border border-slate-700", onClick: e => e.stopPropagation() },
            children
        ))
);

const ManagePlayersScreenController = ({ persistentPlayers = [], onSaveChanges, onBack }) => {
    const [localPlayers, setLocalPlayers] = React.useState([]);
    const [showPlayerFormModal, setShowPlayerFormModal] = React.useState(false);
    const [editingPlayer, setEditingPlayer] = React.useState(null);

    React.useEffect(() => {
        setLocalPlayers(JSON.parse(JSON.stringify(persistentPlayers)));
    }, [persistentPlayers]);

    const handleAddNewPlayer = () => {
        setEditingPlayer(null);
        setShowPlayerFormModal(true);
    };

    const handleEdit = (playerToEdit) => {
        setEditingPlayer(playerToEdit);
        setShowPlayerFormModal(true);
    };

    const handleSavePlayer = (playerData) => {
        let updatedPlayers;
        if (editingPlayer) {
            updatedPlayers = localPlayers.map(p => (p.id === playerData.id ? playerData : p));
        } else {
            const newEntry = { ...playerData, id: playerData.id || generateClientSideId() };
            updatedPlayers = [...localPlayers, newEntry];
        }
        setLocalPlayers(updatedPlayers);
        setShowPlayerFormModal(false);
        setEditingPlayer(null);
    };

    const handleDeletePlayer = (playerId) => {
        if (confirm('Are you sure you want to delete this player? This action cannot be undone.')) {
            const updatedPlayers = localPlayers.filter(p => p.id !== playerId);
            setLocalPlayers(updatedPlayers);
        }
    };

    const handleSaveChangesToServer = () => {
        onSaveChanges(localPlayers);
    };

    const PlayerFormModal = ({ playerToEdit, onSave, onCancel }) => {
        const [name, setName] = React.useState(playerToEdit ? playerToEdit.name : '');

        const handleSubmit = (e) => {
            e.preventDefault();
            const trimmedName = name.trim();
            if (!trimmedName) {
                alert("Player name is required.");
                return;
            }
            onSave({
                ...(playerToEdit || {}),
                name: trimmedName,
                id: playerToEdit ? playerToEdit.id : generateClientSideId()
            });
        };
        
        return React.createElement(ModalOverlay, { onClose: onCancel },
            React.createElement('h3', { className: "text-2xl sm:text-3xl game-title-font text-yellow-300 mb-4" },
                playerToEdit ? 'Edit Player' : 'Add New Player'
            ),
            React.createElement('form', { onSubmit: handleSubmit, className: "space-y-5 mt-4" },
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: "entryName", className: "block text-sm font-medium text-slate-300 mb-1" }, "Player Name"),
                    React.createElement('input', {
                        type: "text", id: "entryName", value: name, onChange: e => setName(e.target.value), required: true, autoFocus: true,
                        className: "mt-1 block w-full bg-slate-700 border-slate-600 rounded-md shadow-sm py-3 px-4 text-lg"
                    })
                ),
                React.createElement('div', { className: "player-form-modal-actions pt-5 flex justify-end gap-3" },
                    React.createElement('button', { type: "button", onClick: onCancel, className: "bg-slate-600 hover:bg-slate-500 text-slate-100 font-semibold py-2 px-5 rounded-md" }, "Cancel"),
                    React.createElement('button', { type: "submit", className: "bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-5 rounded-md" }, playerToEdit ? 'Save Changes' : 'Add Player')
                )
            )
        );
    };

    return React.createElement('div', { className: "manage-players-container p-4 flex flex-col h-full box-border" },
        React.createElement('h2', { className: "manage-players-header text-3xl sm:text-4xl text-center game-title-font text-yellow-300 mb-6" },
            "Manage Players"
        ),
        React.createElement('div', { className: "mb-6 text-center" },
            React.createElement('button', {
                type: "button",
                onClick: handleAddNewPlayer,
                className: "manage-players-button bg-sky-600 hover:bg-sky-500 text-white text-lg font-semibold py-3 px-5 rounded-lg"
            }, "➕ Add New Player")
        ),
        showPlayerFormModal && React.createElement(PlayerFormModal, {
            playerToEdit: editingPlayer,
            onSave: handleSavePlayer,
            onCancel: () => { setShowPlayerFormModal(false); setEditingPlayer(null); }
        }),
        React.createElement('div', { className: "manage-players-list-container flex-grow overflow-y-auto custom-scrollbar bg-slate-800 p-4 rounded-lg border border-slate-700" },
            localPlayers.length === 0 ?
                React.createElement('p', { className: "text-slate-400 text-center py-4 text-lg" },
                    "No players saved yet. Add some!"
                ) :
                localPlayers.map(p => React.createElement('div', { key: p.id, className: "manage-players-list-item flex justify-between items-center bg-slate-700 p-4 rounded-md mb-3 border border-slate-600" },
                    React.createElement('span', { className: "manage-players-list-item-name font-medium text-slate-200 text-lg truncate" }, p.name),
                    React.createElement('div', { className: "manage-players-list-item-actions flex-shrink-0 flex items-center gap-2" },
                        React.createElement('button', {
                            type: "button", onClick: () => handleEdit(p),
                            className: "bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-3 text-sm rounded-md"
                        }, "✏️ ", React.createElement('span', { className: "hidden sm:inline" }, "Edit")),
                        React.createElement('button', {
                            type: "button", onClick: () => handleDeletePlayer(p.id),
                            className: "bg-red-600 hover:bg-red-500 text-white font-medium py-2 px-3 text-sm rounded-md"
                        }, "🗑️ ", React.createElement('span', { className: "hidden sm:inline" }, "Del"))
                    )
                ))
        ),
        React.createElement('div', { className: "manage-players-footer-actions mt-8 flex flex-col sm:flex-row justify-center gap-3" },
            React.createElement('button', {
                type: "button", onClick: onBack,
                className: "manage-players-button bg-slate-600 hover:bg-slate-500 text-slate-100 text-lg font-semibold py-3 px-6 rounded-lg"
            }, "⬅️ Back"),
            React.createElement('button', {
                type: "button", onClick: handleSaveChangesToServer,
                className: "manage-players-button bg-green-600 hover:bg-green-500 text-white text-lg font-semibold py-3 px-6 rounded-lg"
            }, "💾 Save Changes")
        )
    );
};

const StatsScreen = ({ stats, onBack, socket }) => {
    const handleResetSession = () => {
        if (confirm('Are you sure you want to end the current session and start a new one? This will reset session stats.')) {
            socket.emit('resetSessionStats');
        }
    };
    const handleResetAllTime = () => {
        const confirmationText = "WARNING: This will permanently delete ALL saved player and team win records. This action cannot be undone.\n\nAre you absolutely sure you want to proceed?";
        if (confirm(confirmationText)) {
            socket.emit('resetHistoricalStats');
        }
    };

    const StatList = ({ title, data, type }) => {
        const sortedData = Object.entries(data || {}).sort(([, a], [, b]) => b - a);
        return React.createElement('div', { className: "bg-slate-800 p-4 rounded-lg shadow-inner border border-slate-700" },
            React.createElement('h3', { className: "text-2xl font-bold game-title-font text-yellow-300 mb-4 border-b-2 border-slate-600 pb-2" }, title),
            sortedData.length === 0
                ? React.createElement('p', { className: "text-slate-400 italic" }, `No ${type} wins recorded.`)
                : React.createElement('ul', { className: "space-y-2" },
                    sortedData.map(([name, wins]) => (
                        React.createElement('li', { key: name, className: "flex justify-between items-center bg-slate-700 p-3 rounded-md" },
                            React.createElement('span', { className: "font-semibold text-lg text-slate-100 truncate pr-2" }, name),
                            React.createElement('span', { className: "text-lg font-bold text-amber-400 bg-slate-800 px-3 py-1 rounded-md" }, `${wins} Win${wins > 1 ? 's' : ''}`)
                        )
                    ))
                )
        );
    };

    return React.createElement('div', { className: "p-4 h-full flex flex-col" },
        React.createElement('h2', { className: "text-4xl font-bold game-title-font text-center text-purple-400 mb-6" }, "Game Statistics"),
        React.createElement('div', { className: "mb-6 text-center grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto" },
            React.createElement('button', { onClick: handleResetSession, className: "bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md" }, "New Session"),
            React.createElement('button', { onClick: handleResetAllTime, className: "bg-red-700 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md" }, "Wipe All Stats")
        ),
        React.createElement('div', { className: "flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-6" },
            React.createElement('div', { className: "bg-slate-900 p-4 rounded-xl border-2 border-slate-700" },
                 React.createElement('h3', { className: "text-3xl font-bold game-title-font text-center text-sky-300 mb-4" }, "Session Stats"),
                 React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-6" },
                    React.createElement(StatList, { title: "Team Wins", data: stats.sessionStats.teams, type: "team" }),
                    React.createElement(StatList, { title: "Player Wins", data: stats.sessionStats.players, type: "player" })
                 )
            ),
            React.createElement('div', { className: "bg-slate-900 p-4 rounded-xl border-2 border-slate-700" },
                 React.createElement('h3', { className: "text-3xl font-bold game-title-font text-center text-sky-300 mb-4" }, "All-Time Stats"),
                 React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-6" },
                    React.createElement(StatList, { title: "Team Wins", data: stats.historicalStats.teams, type: "team" }),
                    React.createElement(StatList, { title: "Player Wins", data: stats.historicalStats.players, type: "player" })
                 )
            )
        ),
        React.createElement('div', { className: "mt-6 text-center" },
            React.createElement('button', { onClick: onBack, className: "bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 px-8 rounded-lg shadow-md" }, "⬅️ Back to Menu")
        )
    );
};


const ControllerApp = () => {
    const [socket, setSocket] = React.useState(null);
    const [connectionStatus, setConnectionStatus] = React.useState('Initializing...');
    const [gameState, setGameState] = React.useState(null);
    const [activeGameModeDetails, setActiveGameModeDetails] = React.useState(null);
    const [currentView, setCurrentView] = React.useState('gameSelection');
    const [selectedGameModeForSetup, setSelectedGameModeForSetup] = React.useState(null);
    const [persistentPlayers, setPersistentPlayers] = React.useState([]);
    const [stats, setStats] = React.useState({ sessionStats: { teams: {}, players: {} }, historicalStats: { teams: {}, players: {} } });
    // Make the socket connection URL dynamic here as well.
    const isSecure = window.location.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss://' : 'ws://';
    const SOCKET_SERVER_URL = `${wsProtocol}${window.location.hostname}:${isSecure ? '' : '8442'}`;
    const gameComponentRegistry = React.useRef({});

    React.useEffect(() => {
        Object.values(GAME_MODES).forEach(mode => {
            if (mode.component && typeof window[mode.component] !== 'undefined') {
                gameComponentRegistry.current[mode.component] = window[mode.component];
            }
        });
        
        const newSocket = io(SOCKET_SERVER_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setConnectionStatus('Connected');
            newSocket.emit('requestGameState');
            newSocket.emit('getPersistentPlayersList');
            newSocket.emit('requestStats');
        });
        newSocket.on('disconnect', () => setConnectionStatus('Disconnected'));
        newSocket.on('connect_error', () => setConnectionStatus(`Error`));

        const handleGameStateUpdate = (s) => {
            setGameState(s);
            if (s && s.mode) {
                const gameModeDetails = Object.values(GAME_MODES).find(g => g.id === s.mode.toUpperCase());
                if (gameModeDetails) {
                    setActiveGameModeDetails(gameModeDetails);
                    setCurrentView('activeGameController');
                }
            } else if (s === null && currentView !== 'stats') { // Prevent returning to menu if stats screen is manually shown
                setActiveGameModeDetails(null);
                setSelectedGameModeForSetup(null);
                setCurrentView('gameSelection');
            }
        };

        newSocket.on('gameState', (s) => handleGameStateUpdate(s));
        newSocket.on('gameStateUpdate', (s) => handleGameStateUpdate(s));
        newSocket.on('noGameActive', () => handleGameStateUpdate(null));
        newSocket.on('persistentPlayersList', (list) => setPersistentPlayers(list || []));
        newSocket.on('persistentPlayersUpdateStatus', (status) => {
            if (status.success) { 
                console.log(status.message || 'Player list updated successfully on server!');
                if (socket) socket.emit('getPersistentPlayersList');
            } else {
                alert(`Error updating players: ${status.message || 'Failed to update.'}`);
            }
        });
        newSocket.on('gameStartError', (errorMessage) => {
            alert(`Error starting game: ${errorMessage}`);
            setCurrentView('playerSetup');
        });
        
        newSocket.on('statsUpdate', (newStats) => setStats(newStats));
        newSocket.on('displayStatsScreen', () => setCurrentView('stats'));

        return () => { newSocket.disconnect(); };
    }, []);

    const handleSelectGameForSetup = (gameMode) => {
        setSelectedGameModeForSetup(gameMode);
        setCurrentView('playerSetup');
    };

    const handlePlayerSetupComplete = (participants, gameSpecificOptions = {}) => {
        if (socket && selectedGameModeForSetup) {
            // MODIFICATION: Check if the game mode is KILLER and use the specific event.
            if (selectedGameModeForSetup.id === 'KILLER') {
                // The server expects an object with a 'players' property for the startKillerGame event.
                socket.emit('startKillerGame', { players: participants });
            } else {
                // Otherwise, use the generic startGame event.
                socket.emit('startGame', selectedGameModeForSetup.id, { names: participants, ...gameSpecificOptions });
            }
        }
    };

    const handleReturnToGameSelection = () => {
        setSelectedGameModeForSetup(null);
        setCurrentView('gameSelection');
    };

    const handleManagePlayers = () => setCurrentView('managePlayers');
    const handleShowStats = () => socket && socket.emit('showStatsScreen');

    const handleSaveChangesToPlayers = (updatedList) => {
        if (socket) {
            socket.emit('updatePersistentPlayersList', updatedList);
            alert('Changes submitted to server!');
        } else {
            alert("Not connected to server to save players.");
        }
    };

    const handleRequestMainMenu = () => {
        if (socket) {
            socket.emit('requestMainMenu');
        } else { // Fallback if socket is down
            setCurrentView('gameSelection');
            setActiveGameModeDetails(null);
            setGameState(null);
            setSelectedGameModeForSetup(null);
        }
    };

    const renderMainContent = () => {
        switch (currentView) {
            case 'gameSelection':
                return React.createElement(GameSelectionScreenController, { onSelectGame: handleSelectGameForSetup, onManagePlayers: handleManagePlayers, onShowStats: handleShowStats });
            case 'playerSetup':
                if (!selectedGameModeForSetup) {
                    setCurrentView('gameSelection'); return null;
                }
                return React.createElement(PlayerSetupScreenController, { selectedGameMode: selectedGameModeForSetup, onSetupComplete: handlePlayerSetupComplete, onCancel: handleReturnToGameSelection, persistentPlayers: persistentPlayers });
            case 'managePlayers':
                return React.createElement(ManagePlayersScreenController, { persistentPlayers: persistentPlayers, onSaveChanges: handleSaveChangesToPlayers, onBack: handleReturnToGameSelection });
            case 'stats':
                return React.createElement(StatsScreen, { stats: stats, onBack: handleRequestMainMenu, socket: socket });
            case 'activeGameController':
                if (!gameState || !activeGameModeDetails) {
                    return React.createElement('div', { className: "text-center text-gray-400 p-4 text-lg" }, "Waiting for game...");
                }
                const GameControllerComponent = gameComponentRegistry.current[activeGameModeDetails.component];
                if (GameControllerComponent) {
                    return React.createElement(GameControllerComponent, { gameMode: activeGameModeDetails, socket: socket, gameState: gameState, displayRole: 'controller' });
                } else {
                    return React.createElement('div', { className: "text-center text-orange-400 p-4" }, `Controller for ${activeGameModeDetails.name} not available.`);
                }
            default:
                setCurrentView('gameSelection');
                return null;
        }
    };

    let statusIndicatorColor = 'bg-yellow-500';
    let statusText = connectionStatus;
    if (connectionStatus === 'Connected') {
        if (currentView === 'activeGameController' && gameState && activeGameModeDetails) { statusIndicatorColor = 'bg-green-500'; statusText = `In Game`; } 
        else { statusIndicatorColor = 'bg-blue-500'; statusText = 'Menu'; }
    } else if (connectionStatus.startsWith('Error') || connectionStatus === 'Disconnected') {
        statusIndicatorColor = 'bg-red-600';
    }

    return React.createElement('div', { className: "flex flex-col h-full w-full items-stretch" },
        React.createElement('header', { className: "p-2 bg-slate-800 text-white text-center shrink-0 shadow-md" },
            React.createElement('div', { className: "flex items-center justify-between" },
                React.createElement('button', { onClick: handleRequestMainMenu, className: "text-lg sm:text-xl px-2 py-1 hover:bg-slate-700 rounded", title: "Home / End Current Game" }, '🏠'),
                React.createElement('h1', { className: "text-lg sm:text-xl font-bold game-title-font" }, "Dart Control"),
                React.createElement('div', {
                    title: connectionStatus + (activeGameModeDetails ? ` - ${activeGameModeDetails.name}` : ''),
                    className: `text-xs px-2 py-0.5 rounded-full inline-block ${statusIndicatorColor} truncate max-w-[100px] sm:max-w-[150px]`
                }, statusText)
            )
        ),
        React.createElement('main', { className: "flex-grow p-1 sm:p-2 overflow-y-auto custom-scrollbar bg-slate-900" },
            renderMainContent()
        )
    );
};

const controllerRootElement = document.getElementById('controller_root');
if (controllerRootElement) {
    ReactDOM.createRoot(controllerRootElement).render(React.createElement(ControllerApp));
} else {
    console.error("Controller root element #controller_root not found. Controller cannot be mounted.");
    document.body.innerHTML = '<div style="color: red; text-align: center; margin-top: 20px; font-size:16px;">Critical Error: Controller App Root (#controller_root) Missing.</div>';
}

