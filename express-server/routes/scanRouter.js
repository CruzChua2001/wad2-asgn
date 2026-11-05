const express = require("express");
const { createScan, getScanById, getFindingGuide, saveProgress } = require("../controllers/scanController");
const { optionalUser, signedInUser } = require("../middleware/auth");
const { scanRateLimit } = require("../middleware/rateLimit");
const router = express.Router();

router.post("/", optionalUser, scanRateLimit, createScan);

router.get("/:id", optionalUser, getScanById);

router.post("/:id/finding/:findingId/guide", signedInUser, scanRateLimit, getFindingGuide);

router.put("/:id/progress", signedInUser, saveProgress);

module.exports = router;