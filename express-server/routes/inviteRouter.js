const express = require("express");
const { signedInUser } = require("../middleware/auth");
const { getInviteByCurrUser, acceptInvite, declineInvite } = require("../controllers/memberController");

const router = express.Router();

router.use(signedInUser);
router.get("/", getInviteByCurrUser);
router.post("/:id/accept", acceptInvite);
router.delete("/:id", declineInvite);

module.exports = router;