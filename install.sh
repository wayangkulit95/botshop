#!/bin/bash

# This script sets up the mts-bot environment.

# Update package list and upgrade installed packages
echo "Updating package list..."
sudo apt update

echo "Upgrading installed packages..."
sudo apt upgrade -y

# Define the directory
BOT_DIR="/root/mts-bot"

# Create the directory
echo "Creating directory $BOT_DIR..."
sudo mkdir -p $BOT_DIR

# Change to the bot directory
cd $BOT_DIR

# Install Node.js and npm if they are not installed
if ! command -v node &> /dev/null
then
    echo "Node.js not found. Installing Node.js and npm..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js is already installed."
fi

# Check and install SQLite3 if not installed
if ! command -v sqlite3 &> /dev/null
then
    echo "SQLite3 not found. Installing SQLite3..."
    sudo apt install -y sqlite3
else
    echo "SQLite3 is already installed."
fi

# Download your script
echo "Downloading app.js..."
curl -O https://raw.githubusercontent.com/wayangkulit95/botshop/main/app.js

# Create package.json
echo "Creating package.json..."
cat <<EOL > package.json
{
  "name": "mts-bot",
  "version": "1.0.0",
  "description": "A Telegram bot for managing a shop with a credit system.",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "telegraf": "^4.4.0",
    "sqlite3": "^5.0.0"
  },
  "author": "MTS OFFICIAL",
  "license": "MIT"
}
EOL

# Install necessary npm packages
echo "Installing necessary npm packages..."
npm install

# Create the database file if it doesn't exist
if [ ! -f shop.db ]; then
    echo "Creating the database..."
    touch shop.db
    echo "Database created."
fi

echo "Installation completed. You can now run your bot using 'npm start' from the $BOT_DIR directory."
