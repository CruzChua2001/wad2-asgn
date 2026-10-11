const express = require("express");
const { createScan, getScanById } = require("../controllers/scanController");
const { optionalUser } = require("../middleware/auth");

const router = express.Router();

router.post("/", optionalUser, createScan);

router.get("/:id", optionalUser, getScanById);

module.exports = router;