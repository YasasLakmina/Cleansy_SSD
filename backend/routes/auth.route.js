import express from "express";
import {
  google,
  signIn,
  signup,
  signInQR,
  facebookAuth,
  facebookCallback,
} from "../controllers/auth.controller.js";

const router = express.Router();

// Standard authentication routes
router.post("/signup", signup);
router.post("/signin", signIn);

router.post("/signinQR", signInQR);

// Facebook authentication routes

/**
 * GET /api/auth/facebook
 * Initiates Facebook OAuth flow
 */
router.get("/facebook", facebookAuth);

/**
 * GET /api/auth/facebook/callback
 * Handles Facebook OAuth callback
 */
router.get("/facebook/callback", facebookCallback);

export default router;
