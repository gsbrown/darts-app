// A single, shared location for code needed by both the display and controller.

// --- Global Registry for Game Components ---
// Both the display and controller will use this same object to find the correct
// React component for a given game mode. Each game file will add itself to this registry.
window.gameComponentRegistry = {};
