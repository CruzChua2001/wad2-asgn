require("dotenv").config();

const express = require('express');
const app = express();

const cors = require("cors");
app.use(cors({ origin: process.env.FRONTEND_URL }));

const PORT = 3001;

app.use(express.json());

const scanRouter = require("./routes/scan");
const projectRouter = require("./routes/projectRouter");

app.use("/api/scan", scanRouter);
app.use("/api/project", projectRouter);

app.get('/', (req, res) => {
    res.send('Hello, world! Your Express server is up and running.');
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
