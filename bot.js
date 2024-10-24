// bot.js
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with your actual token
const token = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome to the shop! Use /products to see available items.');
});

// Handle /products command
bot.onText(/\/products/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const response = await axios.get('http://localhost:3000/products'); // API endpoint for products
        const products = response.data;

        if (products.length === 0) {
            bot.sendMessage(chatId, "No products available.");
        } else {
            const productList = products.map(row => `${row.id}. ${row.name} - $${row.price}\n${row.description}`).join('\n\n');
            bot.sendMessage(chatId, productList);
        }
    } catch (error) {
        bot.sendMessage(chatId, "Error fetching products");
    }
});

// Handle /buy command
bot.onText(/\/buy (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const productId = match[1]; // The product ID

    // Create an order for the user
    const userId = chatId.toString(); // Use chat ID as user ID for simplicity
    try {
        const response = await axios.post('http://localhost:3000/create-order', { productId, userId });
        const orderId = response.data.orderId;
        const amount = response.data.amount;

        const paymentInstructions = `
        💳 Payment Instructions:
        1. Please transfer **$${amount}** to the following bank account:
            - Bank Name: Your Bank
            - Account Number: 123456789
            - Account Name: Your Shop Name
        2. After making the transfer, reply with **/confirm ${orderId}** to confirm your payment.
        `;
        bot.sendMessage(chatId, paymentInstructions, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, "Error creating order");
    }
});

// Handle /confirm command
bot.onText(/\/confirm (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1];

    try {
        const response = await axios.post('http://localhost:3000/confirm-payment', { orderId });
        bot.sendMessage(chatId, response.data.message);
    } catch (error) {
        bot.sendMessage(chatId, "Error confirming payment");
    }
});
