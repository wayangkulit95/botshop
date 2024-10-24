const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const bot = new Telegraf('7838592677:AAGAc35CeGNHPzutBWGL9HzV_ilfP3qcyxo');

// Replace with actual admin user ID(s)
const ADMIN_USER_ID = 7813473203; // e.g., 123456789

const db = new sqlite3.Database('shop.db');

// Initialize database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS Users (
        userId TEXT PRIMARY KEY,
        username TEXT,
        credits INTEGER DEFAULT 0
    )`);

    // Add image_url to the Products table
    db.run(`CREATE TABLE IF NOT EXISTS Products (
        productId INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        description TEXT,
        image_url TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS Transactions (
        transactionId INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        productId INTEGER,
        amount INTEGER,
        type TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES Users(userId),
        FOREIGN KEY (productId) REFERENCES Products(productId)
    )`);
});

// Add or update user in the database
function addUser(userId, username) {
    db.run(`INSERT OR REPLACE INTO Users (userId, username) VALUES (?, ?)`, [userId, username]);
}

// Add credits to a user
function addCredits(userId, amount, type) {
    db.serialize(() => {
        db.run(`UPDATE Users SET credits = credits + ? WHERE userId = ?`, [amount, userId]);
        db.run(`INSERT INTO Transactions (userId, amount, type) VALUES (?, ?, ?)`, [userId, amount, type]);
    });
}

// Deduct credits from a user
function deductCredits(userId, amount) {
    db.serialize(() => {
        db.run(`UPDATE Users SET credits = credits - ? WHERE userId = ?`, [amount, userId]);
    });
}

// Check user balance
function getUserBalance(userId, callback) {
    db.get(`SELECT credits FROM Users WHERE userId = ?`, [userId], (err, row) => {
        if (err) {
            console.error(err);
            callback(0);
            return;
        }
        callback(row ? row.credits : 0);
    });
}

// Add a product to the database
function addProduct(name, price, description, imageUrl) {
    db.run(`INSERT INTO Products (name, price, description, image_url) VALUES (?, ?, ?, ?)`, [name, price, description, imageUrl]);
}

// Get product list
function getProductList(callback) {
    db.all(`SELECT * FROM Products`, [], (err, rows) => {
        if (err) {
            console.error(err);
            callback([]);
            return;
        }
        callback(rows);
    });
}

// Purchase a product
function purchaseProduct(userId, productId, callback) {
    getUserBalance(userId, (balance) => {
        db.get(`SELECT price FROM Products WHERE productId = ?`, [productId], (err, row) => {
            if (err || !row) {
                callback(false, 'Product not found.');
                return;
            }
            const productPrice = row.price;
            if (balance < productPrice) {
                callback(false, 'Insufficient credits for this purchase.');
                return;
            }

            deductCredits(userId, productPrice);
            db.run(`INSERT INTO Transactions (userId, productId, amount, type) VALUES (?, ?, ?, ?)`, [userId, productId, productPrice, 'purchase']);
            callback(true, 'Purchase successful!');
        });
    });
}

// Start command
bot.command('start', (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Unknown';
    addUser(userId, username);
    ctx.reply('Welcome to the bot shop! Use /products to view available items and /topup to add credits.');
});

// List products command
bot.command('products', (ctx) => {
    getProductList((products) => {
        if (products.length === 0) {
            ctx.reply('No products available at the moment.');
            return;
        }

        let productList = 'Available Products:\n\n';
        products.forEach((product) => {
            productList += `*${product.productId}: ${product.name}* - ${product.price} credits\n${product.description}\n\n`;
            if (product.image_url) {
                ctx.replyWithPhoto(product.image_url);
            }
        });
        productList += 'Use /purchase <productId> to buy an item.';
        ctx.replyWithMarkdown(productList);
    });
});

// Purchase command
bot.command('purchase', (ctx) => {
    const [_, productId] = ctx.message.text.split(' ');

    if (!productId || isNaN(productId)) {
        ctx.reply('Usage: /purchase <productId>');
        return;
    }

    const userId = ctx.from.id;
    purchaseProduct(userId, parseInt(productId), (success, message) => {
        ctx.reply(message);
    });
});

// Top-up command for users
bot.command('topup', (ctx) => {
    const userId = ctx.from.id;
    const amount = parseInt(ctx.message.text.split(' ')[1]);

    if (isNaN(amount) || amount <= 0) {
        ctx.reply('Please provide a valid top-up amount.');
        return;
    }

    // Simulate payment processing (in a real scenario, you'd verify payment here)
    addCredits(userId, amount, 'topup');
    ctx.reply(`Top-up of ${amount} credits successfully added to your account.`);
});

// Admin command to top-up credits for a user
bot.command('admin_topup', (ctx) => {
    const userId = ctx.from.id;

    if (userId !== ADMIN_USER_ID) {
        ctx.reply('You are not authorized to use this command.');
        return;
    }

    const [_, targetUserId, amount] = ctx.message.text.split(' ');

    if (!targetUserId || isNaN(amount) || parseInt(amount) <= 0) {
        ctx.reply('Usage: /admin_topup <userId> <amount>');
        return;
    }

    addCredits(targetUserId, parseInt(amount), 'admin topup');
    ctx.reply(`Successfully added ${amount} credits to user ID ${targetUserId}.`);
});

// Admin command to add products with image
bot.command('add_product', (ctx) => {
    const userId = ctx.from.id;

    if (userId !== ADMIN_USER_ID) {
        ctx.reply('You are not authorized to use this command.');
        return;
    }

    const [_, name, price, imageUrl, ...descriptionParts] = ctx.message.text.split(' ');
    const description = descriptionParts.join(' ');

    if (!name || isNaN(price) || !description || !imageUrl) {
        ctx.reply('Usage: /add_product <name> <price> <imageUrl> <description>');
        return;
    }

    addProduct(name, parseInt(price), description, imageUrl);
    ctx.reply(`Product "${name}" added with price ${price} credits and image URL: ${imageUrl}.`);
});

// Start the bot
bot.launch().then(() => {
    console.log('Bot is running...');
});
