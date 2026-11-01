const express = require("express");
const { signedInUser } = require("../middleware/auth");
const { chat } = require("../controllers/chatController");

const router = express.Router();

router.post("/", signedInUser, chat);

module.exports = router;