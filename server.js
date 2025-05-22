const express = require("express");
const { pool, initializeDatabase } = require("./database");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // penting untuk JSON response ke fetch()
app.use(express.static("public"));

initializeDatabase();

app.get("/", async (req, res) => {
  try {
    const [products] = await pool.query(
      "SELECT p.id, p.name, p.price, s.quantity FROM products p JOIN stock s ON p.id = s.product_id"
    );
    res.render("index", { products });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

// Add new product endpoint
app.post("/products", async (req, res) => {
  const { name, price, quantity } = req.body;
  try {
    // Insert product
    const [result] = await pool.query(
      "INSERT INTO products (name, price) VALUES (?, ?)",
      [name, price]
    );

    // Insert initial stock
    await pool.query("INSERT INTO stock (product_id, quantity) VALUES (?, ?)", [
      result.insertId,
      quantity,
    ]);

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

app.get("/purchases", async (req, res) => {
  try {
    const [purchases] = await pool.query(`
      SELECT p.id, pr.name, p.quantity, p.total_price, p.purchase_date, p.status 
      FROM purchases p JOIN products pr ON p.product_id = pr.id
      ORDER BY p.purchase_date DESC
    `);
    res.render("purchases", { purchases });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

app.post("/purchase", async (req, res) => {
  const { product_id, quantity } = req.body;
  try {
    const [product] = await pool.query(
      "SELECT price, s.quantity as stock FROM products p JOIN stock s ON p.id = s.product_id WHERE p.id = ?",
      [product_id]
    );
    if (product.length === 0) return res.status(404).send("Product not found");
    if (product[0].stock < quantity)
      return res.status(400).send("Insufficient stock");

    const total_price = product[0].price * quantity;
    await pool.query(
      "INSERT INTO purchases (product_id, quantity, total_price) VALUES (?, ?, ?)",
      [product_id, quantity, total_price]
    );
    await pool.query(
      "UPDATE stock SET quantity = quantity - ? WHERE product_id = ?",
      [quantity, product_id]
    );
    res.redirect("/purchases");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

app.post("/cancel/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [purchase] = await pool.query(
      "SELECT product_id, quantity, status FROM purchases WHERE id = ?",
      [id]
    );
    if (purchase.length === 0 || purchase[0].status === "cancelled")
      return res.status(400).send("Invalid purchase or already cancelled");

    await pool.query('UPDATE purchases SET status = "cancelled" WHERE id = ?', [
      id,
    ]);
    await pool.query(
      "UPDATE stock SET quantity = quantity + ? WHERE product_id = ?",
      [purchase[0].quantity, purchase[0].product_id]
    );
    res.redirect("/purchases");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

app.get("/chatbot", (req, res) => {
  res.render("chatbot", { messages: [] });
});

app.post("/chatbot", async (req, res) => {
  const { message } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: message }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (data?.candidates?.length > 0) {
      const reply = data.candidates[0].content.parts[0].text;
      res.json({ reply });
    } else {
      console.error("No reply from Gemini:", data);
      res.json({ reply: "Maaf, tidak ada respons dari AI." });
    }
  } catch (error) {
    console.error("Error with Gemini API:", error);
    res.json({ reply: "Terjadi kesalahan saat menghubungi Gemini API." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
