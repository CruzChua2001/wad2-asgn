const express = require("express");
const { signedInUser } = require("../middleware/auth");
const { getProjects, createProject, updateProjectById, deleteProjectById } = require("../controllers/projectController");

const router = express.Router();

router.use(signedInUser);
router.get("/", getProjects);
router.post("/", createProject);
router.put("/:id", updateProjectById);
router.delete("/:id", deleteProjectById);

module.exports = router;