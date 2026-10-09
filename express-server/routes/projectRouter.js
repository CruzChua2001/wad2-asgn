const express = require("express");
const { signedInUser } = require("../middleware/auth");
const { getProjects, createProject } = require("../controllers/projectController");

const router = express.Router();

router.use(signedInUser);
router.get("/", getProjects);
router.post("/", createProject);

module.exports = router;