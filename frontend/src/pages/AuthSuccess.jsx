import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { signInSuccess, signInFailure } from "../../redux/user/userSlice";
import { toast } from "react-toastify";
import { Spinner } from "flowbite-react";

const AuthSuccess = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    const verifyAuthentication = async () => {
      try {
        setIsLoading(true);

        // Wait for cookie to be set
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Fetch current user data to verify JWT cookie
        const response = await fetch("/api/user/me", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.user) {
            // Authentication successful
            dispatch(signInSuccess(data.user));
            toast.success("Facebook login successful!");

            setTimeout(() => {
              navigate("/");
            }, 1500);
          } else {
            throw new Error("Invalid response format");
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || "Authentication verification failed"
          );
        }
      } catch (error) {
        setError(error.message);
        dispatch(signInFailure(error.message));
        toast.error("Facebook login failed. Please try again.");

        setTimeout(() => {
          navigate("/sign-in");
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuthentication();
  }, [dispatch, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="text-center">
          <Spinner size="xl" className="mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Completing Facebook Authentication...
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
        <p className="text-gray-600">Redirecting to home page...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;
