import { Button } from "flowbite-react";
import { FaFacebook } from "react-icons/fa";
import { toast } from "react-toastify";

const FacebookOAuth = () => {
  const handleFacebookClick = () => {
    try {
      window.location.href = "http://localhost:3000/api/auth/facebook";
    } catch (error) {
      toast.error("Couldn't initiate Facebook authentication");
    }
  };

  return (
    <Button
      type="button"
      gradientDuoTone="purpleToBlue"
      onClick={handleFacebookClick}
      className="uppercase w-full"
    >
      <FaFacebook className="text-2xl text-white mr-2" />
      Continue With Facebook
    </Button>
  );
};

export default FacebookOAuth;
