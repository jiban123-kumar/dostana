const express = require("express");
const validationResultResponse = require("../validators/expressValidatorsResult");
const { protect } = require("../middlewares/protect");
const profileCreationValidator = require("../validators/profileCreationValidator");
const { createUserProfile, getUserProfile, searchUsers, getAllUserProfiles, updateUserProfile } = require("../controller/profileController");
const { profileUpload } = require("../multer/multer");

const router = express.Router();

router.get("/searchUsers", protect, searchUsers);

router.post("/create-profile", profileUpload, profileCreationValidator, validationResultResponse, protect, createUserProfile);

router.patch("/update-profile", profileUpload, validationResultResponse, protect, updateUserProfile);

// Updated getUserProfile route
router.get("/:id?", protect, getUserProfile); // Optional user ID

router.get("/all-users", getAllUserProfiles);

module.exports = router;
