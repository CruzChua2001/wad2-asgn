const express = require("express");
const { signedInUser } = require("../middleware/auth");
const { projectMember, projectOwner, projectCreator } = require("../middleware/projectRole");
const { getProjects, createProject, updateProjectById, deleteProjectById } = require("../controllers/projectController");
const { getMembersByProjectId, inviteMember, removeMemberById, cancelInviteById } = require("../controllers/memberController");

const router = express.Router();

router.use(signedInUser);
router.get("/", getProjects);
router.post("/", createProject);
router.put("/:id", projectOwner, updateProjectById);
router.delete("/:id", projectOwner, deleteProjectById);

router.get("/:id/member", projectMember, getMembersByProjectId);
router.post("/:id/invite", projectOwner, inviteMember);
router.delete("/:id/member/:userId", projectCreator, removeMemberById);
router.delete("/:id/invite/:inviteId", projectCreator, cancelInviteById);

module.exports = router;