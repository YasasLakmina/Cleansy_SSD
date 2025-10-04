import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
      default:
        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png",
    },
    // Social authentication
    facebookId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isUserAdmin: {
      type: Boolean,
      default: false,
    },
    isPropertyAdmin: {
      type: Boolean,
      default: false,
    },
    isVisitorAdmin: {
      type: Boolean,
      default: false,
    },
    isAnnouncementAdmin: {
      type: Boolean,
      default: false,
    },
    isBookingAdmin: {
      type: Boolean,
      default: false,
    },
    isStaffAdmin: {
      type: Boolean,
      default: false,
    },
    isBillingAdmin: {
      type: Boolean,
      default: false,
    },
    isFacilityAdmin: {
      type: Boolean,
      default: false,
    },
    isFacilityServiceAdmin: {
      type: Boolean,
      default: false,
    },
    isStaff: {
      type: Boolean,
      default: false,
    },
    // OAuth provider IDs
    facebookId: {
      type: String,
      default: null,
    },
    githubId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
export default User;
