import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { signInSuccess, signInFailure } from "../../redux/user/userSlice";
import { toast } from "react-toastify";
import { Spinner } from "flowbite-react";

const GitHubCallback = () => {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleGitHubCallback = async () => {
      try {
        setIsLoading(true);

        // Check if there's an error parameter
        const error = searchParams.get("error");
        const success = searchParams.get("success");

        if (error) {
          throw new Error(decodeURIComponent(error));
        }

        if (success === "true") {
          // Authentication was successful - fetch user data
          const response = await fetch("/api/auth/me", {
            credentials: "include",
          });

          if (response.ok) {
            const userData = await response.json();
            dispatch(signInSuccess(userData));
            toast.success("GitHub login successful!");

            setTimeout(() => {
              navigate("/");
            }, 1500);
          } else {
            throw new Error("Failed to fetch user data");
          }
        } else {
          throw new Error("No valid response from GitHub authentication");
        }
      } catch (error) {
        dispatch(signInFailure(error.message));
        toast.error("GitHub login failed. Please try again.");

        setTimeout(() => {
          navigate("/sign-in");
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    };

    handleGitHubCallback();
  }, [dispatch, navigate, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="text-center">
          <Spinner size="xl" className="mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Completing GitHub Authentication...
          </h2>
          <p className="text-gray-500">
            Please wait while we verify your authentication.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-red-50 to-pink-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold text-red-700 mb-2">
            Authentication Failed
          </h2>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-gray-500 text-sm">
            Redirecting to login page in a few seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-green-50 to-blue-50">
      <div className="text-center">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-semibold text-green-700 mb-2">
          Authentication Successful!
        </h2>
        <p className="text-gray-500">Redirecting to dashboard...</p>
      </div>
    </div>
  );
};

export default GitHubCallback;
