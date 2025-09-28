// Player specific background colors (used in 501.js, around_the_world.js, etc.)
const PLAYER_COLORS = [
    'bg-red-700/70', 'bg-blue-700/70', 'bg-green-700/70', 'bg-cyan-700/70',
    'bg-purple-700/70', 'bg-pink-700/70', 'bg-teal-700/70', 'bg-orange-600/70'
];

// Common Icons (used across various game files like 501.js, ATW.js, Baseball.js etc.)
const ICON_LEADER = "🏆"; // Used in 501, ATW (as ICON_LEADER_ATW or ICON_WINNER_ATW)
const ICON_DART_TARGET = "🎯"; // Used in 501, Cricket (as Bull), Killer
const ICON_MISS_SHRUG = "�"; // Used in 501
const ICON_UNDO = "↩️"; // Used in 501, ATW, Beers, Baseball, Killer, Golf, Cricket
const ICON_DOUBLE_IN_WARN = "⚠️"; // Used in 501
const ICON_GAME_SHOT = "🎉"; // Used in 501, Golf (as Hole-in-One)
const ICON_BUST = "💥"; // Used in 501, Baseball (conceptually)
const ICON_NEXT_PLAYER_OK = "✅"; // Used in 501
const ICON_SETUP_CONSIDER = "🤔"; // Used in 501

// You might have other icons used in multiple files, add them here.
// For example, from ATW:
// const ICON_RECORD_HIT_ATW = "✔️"; // If used elsewhere
// const ICON_END_TURN_ATW = "➡️"; // If used elsewhere

// From Killer:
// const assassinIcon = "🔪"; // If used elsewhere (already in Killer, maybe centralize if needed by other modes)
// const targetIcon = "🎯"; // Already ICON_DART_TARGET
// const skullIcon = "💀";   // If used elsewhere

// From Baseball: (These are image URLs, not constants, so they stay in baseball.js or become part of assets)
// const BASEBALL_ICON_URL = "https://img.icons8.com/ios-filled/100/FFFFFF/baseball.png";
// const GLOVE_ICON_URL = "https://img.icons8.com/ios-filled/100/FFFFFF/baseball-glove.png";
// const DART_ICON_URL = "https://img.icons8.com/ios-filled/50/A0AEC0/dart.png";
// const FIELD_ICON_URL = "https://img.icons8.com/ios-filled/50/A0AEC0/baseball-field.png";

// It's good practice to ensure these are available if scripts are loaded in a way
// that doesn't use ES modules (which is your current HTML setup).
// However, Parcel might handle this if app.js imports this file and game components import from app.js.
// For direct script loading in HTML, these will be global.
