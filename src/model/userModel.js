const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
    },
    profileImage: {
      type: String,
    },
    avatar: {
      type: String,
      default: "avatar1",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    coverImage: {
      type: String,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
    },
    isGoogleAccount: {
      type: Boolean,
      default: false,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    mobileNumber: {
      type: String,
    },
    about: {
      type: String,
      maxlength: [200, "About me should be a maximum of 200 characters"],
      default: "Hey there! I'm using Dostana a Social Media website",
    },
    hobbies: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      default: "",
    },
    dob: {
      type: Date,
      default: null,
    },

    subscription: {
      type: Object,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Define a virtual field for posts
userSchema.virtual("posts", {
  ref: "Post", // The name of the Post model
  localField: "_id", // The field in the User schema
  foreignField: "user", // The field in the Post schema that references the User
});

const User = mongoose.model("User", userSchema);

module.exports = User;
