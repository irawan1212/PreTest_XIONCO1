const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS stock (
        product_id INT PRIMARY KEY,
        quantity INT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('completed', 'cancelled') DEFAULT 'completed',
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    const products = [
      ["Laptop", 15000000],
      ["Smartphone", 5000000],
      ["Headphones", 500000],
      ["Mouse", 200000],
      ["Keyboard", 300000],
      ["Monitor", 2500000],
      ["Tablet", 4000000],
      ["Speaker", 800000],
      ["Webcam", 600000],
      ["Printer", 1200000],
    ];

    for (const [name, price] of products) {
      const [rows] = await connection.query(
        "SELECT * FROM products WHERE name = ?",
        [name]
      );
      if (rows.length === 0) {
        const [result] = await connection.query(
          "INSERT INTO products (name, price) VALUES (?, ?)",
          [name, price]
        );
        await connection.query(
          "INSERT INTO stock (product_id, quantity) VALUES (?, ?)",
          [result.insertId, 100]
        );
      }
    }

    connection.release();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

module.exports = { pool, initializeDatabase };
