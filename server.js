// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the public directory

// Initialize the database
const db = new sqlite3.Database('shop.db');

// Create tables for products and orders
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL, description TEXT NOT NULL)");
    db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER, userId TEXT, status TEXT, amount REAL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

// Endpoint to get all products
app.get('/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) {
            return res.status(500).send("Error fetching products");
        }
        res.json(rows);
    });
});

// Endpoint to create an order
app.post('/create-order', (req, res) => {
    const { productId, userId } = req.body;

    // Fetch the product details
    db.get("SELECT * FROM products WHERE id = ?", [productId], (err, product) => {
        if (err || !product) {
            return res.status(404).send("Product not found");
        }

        // Create the order
        db.run("INSERT INTO orders (productId, userId, status, amount) VALUES (?, ?, ?, ?)", [productId, userId, 'Pending', product.price], function (err) {
            if (err) {
                return res.status(500).send("Error creating order");
            }
            res.send({ message: "Order created successfully", orderId: this.lastID, amount: product.price });
        });
    });
});

// Endpoint to confirm payment
app.post('/confirm-payment', (req, res) => {
    const { orderId } = req.body;

    db.run("UPDATE orders SET status = ? WHERE id = ?", ['Paid', orderId], function (err) {
        if (err) {
            return res.status(500).send("Error confirming payment");
        }
        if (this.changes === 0) {
            return res.status(404).send("Order not found");
        }
        res.send({ message: "Payment confirmed successfully" });
    });
});

// Endpoint to add a product
app.post('/add-product', (req, res) => {
    const { name, price, description } = req.body;

    db.run("INSERT INTO products (name, price, description) VALUES (?, ?, ?)", [name, price, description], function (err) {
        if (err) {
            return res.status(500).send("Error adding product");
        }
        res.send({ message: "Product added successfully", productId: this.lastID });
    });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
