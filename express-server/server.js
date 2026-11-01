require("dotenv").config();

const express = require('express');
const app = express();

// Vercel puts one proxy in front of us, so req.ip is the real client ip and not the proxy's
app.set("trust proxy", 1);

const cors = require("cors");
app.use(cors({ origin: process.env.FRONTEND_URL }));

const PORT = 3001;

app.use(express.json());

const scanRouter = require("./routes/scanRouter");
const projectRouter = require("./routes/projectRouter");
const inviteRouter = require("./routes/inviteRouter");
const chatRouter = require("./routes/chatRouter");

app.use("/api/scan", scanRouter);
app.use("/api/project", projectRouter);
app.use("/api/invite", inviteRouter);
app.use("/api/chat", chatRouter);

app.get('/', (req, res) => {
    res.send('Hello, world! Your Express server is up and running.');
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

module.exports = app;