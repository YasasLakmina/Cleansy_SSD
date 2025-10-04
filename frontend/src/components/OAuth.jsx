import { Button } from "flowbite-react";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { FaFacebook } from "react-icons/fa";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth";
import { app } from "../firebase.js";
import { useDispatch } from "react-redux";
import { signInSuccess } from "../../redux/user/userSlice";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const OAuth = () => {
  const auth = getAuth(app);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleGoogleClick = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await signInWithPopup(auth, provider);
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: result.user.displayName,
          email: result.user.email,
          googlePhotoURL: result.user.photoURL,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(signInSuccess(data));
        navigate("/");
        toast.success("User logged in successfully");
      }
    } catch (error) {
      toast.error("Couldn't Authorized with Google");
    }
  };

  const handleGitHubClick = () => {
    try {
      // Redirect to GitHub OAuth
      const clientId = "Ov23liTqZXM5My5iZUWg"; // This should match your .env
      const redirectUri = encodeURIComponent(
        "http://localhost:3000/api/auth/github/callback"
      ); // Match GitHub app config
      const scope = encodeURIComponent("user:email");
      const state = Math.random().toString(36).substring(2, 15);

      // Store state in localStorage for verification
      localStorage.setItem("github_oauth_state", state);

      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

      // Redirect to GitHub
      window.location.href = githubAuthUrl;
    } catch (error) {
      toast.error("Couldn't initiate GitHub authentication");
  const handleFacebookClick = () => {
    try {
      window.location.href = "http://localhost:3000/api/auth/facebook";
    } catch (error) {
      toast.error("Couldn't initiate Facebook authentication");
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        gradientDuoTone="pinkToOrange"
        onClick={handleGoogleClick}
        className="uppercase w-full"
      >
        <FcGoogle className="text-2xl bg-white rounded-full mr-2" /> Continue
        With Google
      </Button>

      <Button
        type="button"
        gradientDuoTone="purpleToPink"
        onClick={handleGitHubClick}
        className="uppercase w-full"
      >
        <FaGithub className="text-2xl text-white mr-2" /> Continue With GitHub
        gradientDuoTone="purpleToBlue"
        onClick={handleFacebookClick}
        className="uppercase w-full"
      >
        <FaFacebook className="text-2xl text-white mr-2" />
        Continue With Facebook
      </Button>
    </div>
  );
};

export default OAuth;
