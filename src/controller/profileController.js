const User = require("../model/userModel");
const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");
const { removeFileFromSupabase } = require("../utilsFunction/fileRemover");
const { uploadFileToSupabase } = require("../utilsFunction/fileUploader");
const mongoose = require("mongoose");

/**
 * Controller to create a user profile.
 * Handles both standard and Google authenticated users.
 */
const cleanName = (name) => name.replace(/\s+/g, " ").trim();
const createUserProfile = catchAsync(async (req, res, next) => {
  const { firstName, lastName, mobileNum, aboutMe, gender, dob } = req.body;
  const profileImageFile = req.files?.profileImage?.[0];
  const coverImageFile = req.files?.coverImage?.[0];

  const user = await User.findById(req.user?.id);

  if (!user) {
    return next(new CustomError("Account not found", 404));
  }

  if (user.isProfileComplete) {
    return next(new CustomError("Profile already created", 400));
  }

  // Process profileImage and coverImage (e.g., upload to Supabase)

  if (profileImageFile) {
    const result = await uploadFileToSupabase(profileImageFile);
    if (result.isError) return next(new CustomError("Failed to upload profile image", 500));
    user.profileImage = result.fileUrl;
  }

  if (coverImageFile) {
    const result = await uploadFileToSupabase(coverImageFile);
    if (result.isError) return next(new CustomError("Failed to upload cover image", 500));
    user.coverImage = result.fileUrl;
  }

  // Update user profile fields
  user.firstName = cleanName(firstName);
  user.lastName = cleanName(lastName);
  user.isProfileComplete = true;
  user.mobileNumber = mobileNum;
  user.about = aboutMe;
  user.gender = gender;
  user.dob = new Date(dob);

  // Save updated user profile
  const updatedUser = await user.save();
  updatedUser.password = undefined;

  res.status(200).json({
    message: "Profile created successfully",
    profile: updatedUser,
  });
});
const updateUserProfile = catchAsync(async (req, res, next) => {
  const { firstName, lastName, mobileNum, aboutMe, gender, avatar, dob, hobbies, removeCoverImage, removeProfileImage } = req.body;
  console.log(removeCoverImage, removeProfileImage);

  // Access the uploaded files from Multer (if any)
  const profileImageFile = req.files?.profileImage?.[0];
  const coverImageFile = req.files?.coverImage?.[0];

  // Find the user by ID
  const user = await User.findById(req.user?.id);

  if (!user) {
    return next(new CustomError("User not found", 404));
  }

  // Update only the fields provided in the request
  if (firstName !== undefined) user.firstName = cleanName(firstName); // Clean up firstName;
  if (lastName !== undefined) user.lastName = cleanName(lastName); // Clean up lastName;

  // Handle file uploads

  // Only update the fields if they are provided
  if (mobileNum !== undefined) user.mobileNumber = mobileNum;
  if (aboutMe !== undefined) user.about = aboutMe;
  if (dob !== undefined) user.dob = dob;
  if (hobbies?.length > 0) user.hobbies = hobbies;

  // Validate gender field
  if (gender !== undefined) {
    if (!["male", "female", "other"].includes(gender)) {
      return next(new CustomError("Invalid gender value", 400));
    }
    user.gender = gender;
  }

  // Validate avatar field
  if (avatar !== undefined) {
    const validAvatars = ["avatar1", "avatar2", "avatar3", "avatar4", "avatar5", "avatar6", "avatar7", "avatar8"];
    if (!validAvatars.includes(avatar)) {
      return next(new CustomError("Invalid avatar value", 400));
    }
    user.avatar = avatar;
  }

  if (profileImageFile) {
    const result = await uploadFileToSupabase(profileImageFile); // Process and upload the image
    if (result.isError) return next(new CustomError("Failed to upload profile image", 500));
    user.profileImage = result.fileUrl; // Update with new file URL
  }

  if (coverImageFile) {
    const result = await uploadFileToSupabase(coverImageFile); // Process and upload the cover image
    if (result.isError) return next(new CustomError("Failed to upload cover image", 500));
    user.coverImage = result.fileUrl; // Update with new cover image URL
  }

  if (removeProfileImage) {
    if (user.profileImage) {
      const result = await removeFileFromSupabase(user.profileImage);
      if (result.isError) return next(new CustomError("Failed to remove profile image", 500));
      user.profileImage = null;
    }
  }

  // Remove cover image if flag provided
  if (removeCoverImage) {
    if (user.coverImage) {
      const result = await removeFileFromSupabase(user.coverImage);
      if (result.isError) return next(new CustomError("Failed to remove cover image", 500));
      user.coverImage = null;
    }
  }

  // Save the updated user document
  const updatedUser = await user.save();
  updatedUser.password = undefined; // Remove password field from response

  res.status(200).json({
    message: "Profile updated successfully",
    userProfile: updatedUser,
  });
});

/**
 * Controller to fetch the current user's profile details.
 */
const getUserProfile = catchAsync(async (req, res, next) => {
  // Determine the target user ID to fetch the profile
  const targetUserId = req.params.id || req.user?.id;

  // Fetch the user profile
  const userProfile = await User.findById(targetUserId);

  if (!userProfile) {
    return next(new CustomError("User not found", 404));
  }

  // Prevent password from being exposed
  userProfile.password = undefined;

  res.status(200).json({
    message: "Profile fetched successfully",
    userProfile,
  });
});

/**
 * Controller to fetch all user profiles.
 */
const getAllUserProfiles = catchAsync(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    message: "Profiles fetched successfully",
    profiles: users,
  });
});
const searchUsers = catchAsync(async (req, res, next) => {
  const { query } = req.query;
  const userId = req.user?.id;
  console.log(userId);

  if (!query) {
    return next(new CustomError("Search query is required", 400));
  }

  // Function to generate substrings of at least 3 consecutive characters
  const generateSubstrings = (str) => {
    const substrings = [];
    for (let i = 0; i < str.length - 2; i++) {
      substrings.push(str.substring(i, i + 3));
    }
    return substrings;
  };

  const substrings = generateSubstrings(query);

  // If there are no valid substrings, return an empty result set
  if (substrings.length === 0) {
    return res.status(200).json({
      message: "Search results fetched successfully",
      users: [],
    });
  }

  const regexPatterns = substrings.map((substring) => new RegExp(substring, "i"));

  // Build the $or array dynamically
  const orConditions = [
    ...regexPatterns.map((regex) => ({ firstName: regex })),
    ...regexPatterns.map((regex) => ({ lastName: regex })),
    ...regexPatterns.map((regex) => ({
      $expr: {
        $regexMatch: {
          input: { $concat: ["$firstName", " ", "$lastName"] },
          regex: regex,
        },
      },
    })),
  ];

  // If no conditions are generated, return an empty result set
  if (orConditions.length === 0) {
    return res.status(200).json({
      message: "Search results fetched successfully",
      users: [],
    });
  }

  // Search for users matching the regex in firstName, lastName, or combined name
  const users = await User.aggregate([
    {
      $match: {
        isProfileComplete: true, // Ensure only profiles that are complete are included
        $or: orConditions,
        ...(userId && { _id: { $ne: new mongoose.Types.ObjectId(String(userId)) } }),
      },
    },
    {
      $project: {
        _id: 1, // Exclude the `_id` field
        profileImage: 1, // Include `profileImage`
        name: { $concat: ["$firstName", " ", "$lastName"] }, // Combine `firstName` and `lastName` into `name`
      },
    },
  ]);

  res.status(200).json({
    message: "Search results fetched successfully",
    users,
  });
});

module.exports = {
  createUserProfile,
  getUserProfile,
  getAllUserProfiles,
  searchUsers,
  updateUserProfile,
};
