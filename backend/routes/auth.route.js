import express from 'express';
import { google, signIn, signup, signInQR, github, githubCallback, me } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signIn)
router.post('/google', google)
router.post('/github', github)
router.get('/github/callback', githubCallback)
router.get('/me', me)
router.post('/signinQR', signInQR)

export default router;