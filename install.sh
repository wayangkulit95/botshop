#!/bin/bash

# Update and install necessary packages
echo "Updating package list and installing required packages..."
sudo apt update
sudo apt install -y nodejs npm git

# Create project directory structure
echo "Creating project directory structure..."
mkdir -p shop-bot/public/images
mkdir -p shop-bot/views

# Change to the project directory
cd shop-bot || { echo "Directory 'shop-bot' does not exist."; exit 1; }

# Create package.json if it doesn't exist
if [ ! -f package.json ]; then
    npm init -y
fi

# Install necessary packages
echo "Installing Node.js packages..."
npm install axios body-parser ejs express multer node-telegram-bot-api sqlite3

# Create the app.js file
cat <<EOL > app.js
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

// Create Express app
const app = express();
const bot = new TelegramBot('7838592677:AAGAc35CeGNHPzutBWGL9HzV_ilfP3qcyxo', { polling: true });

// Set up middleware for Express
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Set up SQLite database
const db = new sqlite3.Database('./shop.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the shop database.');
        db.run(\`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            description TEXT,
            image TEXT
        )\`);
        db.run(\`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product TEXT,
            price REAL,
            name TEXT,
            address TEXT,
            paymentMethod TEXT,
            paymentStatus TEXT DEFAULT 'Pending'
        )\`);
    }
});

// Set up image uploading with Multer
const storage = multer.diskStorage({
    destination: './public/images',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// Store orders
const orders = {};

// --- Telegram Bot Logic ---
bot.onText(/\/shop/, (msg) => {
    getProductsFromDB((productsFromDB) => {
        productsFromDB.forEach(product => {
            bot.sendPhoto(msg.chat.id, product.image, {
                caption: \`\${product.name} - RM\${product.price}\\n\${product.description}\\n\\nReply with the product ID to place an order.\`,
            });
        });
    });
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const message = msg.text;

    getProductsFromDB((productsFromDB) => {
        let product = productsFromDB.find(p => p.id == message);
        if (product) {
            orders[chatId] = { product };
            bot.sendMessage(chatId, \`You've selected \${product.name}. Please enter your full name to proceed.\`);
        } else if (orders[chatId] && !orders[chatId].name) {
            orders[chatId].name = message;
            bot.sendMessage(chatId, \`Thanks, \${message}. Now, enter your delivery address.\`);
        } else if (orders[chatId] && !orders[chatId].address) {
            orders[chatId].address = message;
            bot.sendMessage(chatId, \`Select your payment method: \\n1. ToyyibPay\\n2. Bank Transfer\`, {
                reply_markup: {
                    keyboard: [['1. ToyyibPay'], ['2. Bank Transfer']],
                    one_time_keyboard: true,
                },
            });
        } else if (orders[chatId] && orders[chatId].address && message.startsWith('1')) {
            orders[chatId].paymentMethod = 'ToyyibPay';
            initiateToyyibPayPayment(chatId, orders[chatId]);
        } else if (orders[chatId] && orders[chatId].address && message.startsWith('2')) {
            orders[chatId].paymentMethod = 'Bank Transfer';
            sendBankTransferDetails(chatId, orders[chatId]);
        } else if (message.toLowerCase() === 'yes') {
            const order = orders[chatId];
            saveOrderToDB(order);
            bot.sendMessage(chatId, \`Order placed successfully!\`);
            delete orders[chatId];
        }
    });
});

// ToyyibPay Payment Function
const initiateToyyibPayPayment = (chatId, order) => {
    const toyyibPayAPI = 'https://toyyibpay.com/api/createBill';
    const billData = {
        userSecretKey: 'YOUR_TOYYIBPAY_SECRET_KEY',
        categoryCode: 'YOUR_CATEGORY_CODE',
        billName: 'Order Payment',
        billDescription: \`Payment for \${order.product.name}\`,
        billPriceSetting: 1,
        billPayorInfo: 1,
        billAmount: order.product.price * 100,
        billReturnUrl: 'https://yourserver.com/payment/success',
        billCallbackUrl: 'https://yourserver.com/payment/callback',
        billTo: order.name,
        billExternalReferenceNo: \`\${Date.now()}\`,
    };

    axios.post(toyyibPayAPI, billData)
        .then(response => {
            const paymentUrl = \`https://toyyibpay.com/\${response.data[0].BillCode}\`;
            bot.sendMessage(chatId, \`Please complete your payment using this link: \${paymentUrl}\`);
        })
        .catch(err => {
            bot.sendMessage(chatId, 'Error creating payment. Try again later.');
        });
};

// Bank Transfer Details
const sendBankTransferDetails = (chatId, order) => {
    bot.sendMessage(chatId, \`Transfer RM\${order.product.price} to Bank: YourBank\\nAccount Number: 123456789\\nAfter payment, reply 'Yes' to confirm.\`);
};

// --- Web Panel Logic ---
app.get('/admin/products', (req, res) => {
    getProductsFromDB((productsFromDB) => {
        res.render('products', { products: productsFromDB });
    });
});

app.post('/admin/products/add', upload.single('image'), (req, res) => {
    const { name, price, description } = req.body;
    const imagePath = \`/public/images/\${req.file.filename}\`;
    db.run(\`INSERT INTO products (name, price, description, image) VALUES (?, ?, ?, ?)\`,
        [name, price, description, imagePath], (err) => {
            if (err) {
                console.error(err.message);
            }
            res.redirect('/admin/products');
        });
});

app.post('/admin/products/delete/:id', (req, res) => {
    db.run(\`DELETE FROM products WHERE id = ?\`, [req.params.id], (err) => {
        if (err) {
            console.error(err.message);
        }
        res.redirect('/admin/products');
    });
});

// --- Database Helper Functions ---
const getProductsFromDB = (callback) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            console.error(err.message);
        }
        callback(rows);
    });
};

const saveOrderToDB = (order) => {
    db.run(\`INSERT INTO orders (product, price, name, address, paymentMethod) VALUES (?, ?, ?, ?, ?)\`,
        [order.product.name, order.product.price, order.name, order.address, order.paymentMethod],
        (err) => {
            if (err) {
                console.error(err.message);
            }
        });
};

// Run the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
EOL

# Create the products.ejs view
cat <<EOL > views/products.ejs
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Management</title>
</head>
<body>
    <h1>Product Management</h1>
    <form action="/admin/products/add" method="POST" enctype="multipart/form-data">
        <label>Name: <input type="text" name="name" required></label><br>
        <label>Price (RM): <input type="number" name="price" required></label><br>
        <label>Description: <textarea name="description"></textarea></label><br>
        <label>Image: <input type="file" name="image" accept="image/*" required></label><br>
        <button type="submit">Add Product</button>
    </form>

    <h2>Products</h2>
    <ul>
        <% products.forEach(function(product) { %>
            <li>
                <img src="<%= product.image %>" alt="<%= product.name %>" style="width: 100px; height: auto;">
                <p><strong><%= product.name %></strong> - RM<%= product.price %></p>
                <p><%= product.description %></p>
                <form action="/admin/products/delete/<%= product.id %>" method="POST" style="display:inline;">
                    <button type="submit">Delete</button>
                </form>
            </li>
        <% }); %>
    </ul>
</body>
</html>
EOL

# Make the script executable
chmod +x install.sh

echo "Installation complete. You can now run your bot with 'node app.js' in the shop-bot directory."
