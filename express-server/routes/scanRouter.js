const express = require("express");
const { createScan, getScanById } = require("../controllers/scanController");
const { optionalUser } = require("../middleware/auth");
const { scanRateLimit } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/", optionalUser, scanRateLimit, createScan);

router.get("/:id", optionalUser, getScanById);

module.exports = router;