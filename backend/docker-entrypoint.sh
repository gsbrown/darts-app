#!/bin/sh

# This script runs when the container starts.

# Define the path for the data directory and the persistent data file
DATA_DIR="/usr/src/app/data"
DATA_FILE="$DATA_DIR/persistent_players.json"

# --- INITIALIZATION LOGIC ---
# Ensure the data directory exists.
# This command runs as root.
mkdir -p "$DATA_DIR"

# Check if the persistent data file does NOT exist within the directory.
if [ ! -f "$DATA_FILE" ]; then
    echo "File not found at $DATA_FILE. Creating a new empty players file."
    # Create a new empty JSON array as a default. This also runs as root.
    echo "[]" > "$DATA_FILE"
    echo "Successfully created $DATA_FILE"
fi

# --- PERMISSIONS FIX ---
# Change the ownership of the entire data directory and its contents
# to the 'node' user and 'node' group. The '-R' flag makes it recursive.
# This ensures the Node.js application (running as user 'node') can read and write.
chown -R node:node "$DATA_DIR"

# Execute the main command from the Dockerfile's CMD instruction (e.g., node server_v2.js)
# This will now run as the 'node' user, as specified in the Dockerfile.
exec "$@"
