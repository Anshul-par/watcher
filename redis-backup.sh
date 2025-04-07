#!/bin/bash

# Redis credentials
REDIS_PASS="efu*&8hsdjer83HUEHWru;isjd"
REDIS_CLI="redis-cli -a $REDIS_PASS"

# Directories
DUMP_DIR="/r-dump"        # Directory to store Redis dump files
REDIS_DATA_DIR="/data"    # Directory where Redis expects the dump file

# Function to ensure directories exist
ensure_directory() {
  local dir=$1
  if [ ! -d "$dir" ]; then
    echo "Creating directory: $dir"
    mkdir -p "$dir" || { echo "Failed to create directory $dir. Exiting." >&2; exit 1; }
  fi
}

# Ensure required directories exist
ensure_directory "$DUMP_DIR"
ensure_directory "$REDIS_DATA_DIR"

# Function to handle graceful shutdown
shutdown_redis() {
  echo "Caught termination signal. Initiating graceful shutdown..."

  # Perform a Redis SAVE to persist data to disk
  echo "Creating Redis dump..."
  if $REDIS_CLI SAVE; then
    echo "Redis dump created successfully."
    
    # Copy the dump file with a timestamped name
    TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
    DUMP_FILE="$DUMP_DIR/abrupt_dump-$TIMESTAMP.rdb"
    if cp "$REDIS_DATA_DIR/dump.rdb" "$DUMP_FILE"; then
      echo "Dump file saved as $DUMP_FILE"
    else
      echo "Failed to copy dump file to $DUMP_FILE" >&2
    fi
  else
    echo "Failed to create Redis dump using SAVE." >&2
  fi

  # Shut down Redis gracefully
  echo "Shutting down Redis server..."
  $REDIS_CLI shutdown
  exit 0
}

# Restore the most recent dump file if available
restore_recent_dump() {
  local recent_dump
  recent_dump=$(ls -t "$DUMP_DIR"/*_dump-*.rdb 2>/dev/null | head -n 1)
  
  if [ -f "$recent_dump" ]; then
    echo "Restoring from the most recent dump: $recent_dump"
    if cp "$recent_dump" "$REDIS_DATA_DIR/dump.rdb"; then
      echo "Dump file restored to Redis data directory."
    else
      echo "Failed to restore dump file to Redis data directory." >&2
    fi
  else
    echo "No recent dump file found. Starting with a fresh Redis instance."
  fi
}

# Set up trap for signals
trap shutdown_redis SIGTERM SIGINT

# Restore the most recent dump file (if any)
restore_recent_dump

# Start Redis server using exec
echo "Starting Redis server..."
exec redis-server --requirepass "$REDIS_PASS" &
REDIS_PID=$!

# Wait for Redis to exit or for signals to be caught
wait $REDIS_PID