const express = require("express");
const { signedInUser } = require("../middleware/auth");
const { projectMember, projectAdmin } = require("../middleware/projectRole");
const { getProjects, createProject, updateProjectById, deleteProjectById, getScansByProjectId } = require("../controllers/projectController");
const { getMembersByProjectId, inviteMember, removeMemberById, cancelInviteById } = require("../controllers/memberController");

const router = express.Router();

router.use(signedInUser);
router.get("/", getProjects);
router.post("/", createProject);
router.get("/:id/scan", projectMember, getScansByProjectId);
router.put("/:id", projectAdmin, updateProjectById);
router.delete("/:id", projectMember, deleteProjectById);

router.get("/:id/member", projectMember, getMembersByProjectId);
router.post("/:id/invite", projectAdmin, inviteMember);
router.delete("/:id/member/:userId", projectAdmin, removeMemberById);
router.delete("/:id/invite/:inviteId", projectAdmin, cancelInviteById);

module.exports = router;