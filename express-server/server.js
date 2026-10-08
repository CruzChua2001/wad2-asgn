const express = require('express');
const app = express();

const PORT = 5000;

app.use(express.json());

const scanRouter = require("./routes/scan");
app.use("/api/scan", scanRouter);

app.get('/', (req, res) => {
    res.send('Hello, world! Your Express server is up and running.');
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
