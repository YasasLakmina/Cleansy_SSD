import { useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { app } from "../../firebase";
import { Button, FileInput, Label, TextInput, Textarea } from "flowbite-react";
import { set } from "mongoose";

// --- Security helpers (client-side) ---
const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const TITLE_MAX = 120;
const DESC_MAX = 2000;

const sanitize = (s) => (typeof s === "string" ? s.replace(/[<>]/g, "") : s); // do not trim during typing
const isHttpsUrl = (u) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};
const clampNumber = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
};
const randHex = (len = 16) => {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(len / 2);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2, 2 + len);
};
// --- End helpers ---

const ServiceUpdate_06 = () => {
  const { currentUser } = useSelector((state) => state.user);
  const [files, setFiles] = useState([]);
  const navigate = useNavigate();
  const params = useParams();
  const [formData, setFormData] = useState({
    serviceID: "",
    serviceName: "",
    serviceDescription: "",
    servicePrice: "",
    serviceType: "",
    serviceAvailability: "",
    servicePhone: "",
    serviceEmail: "",
    serviceRequirements: [],
    imageUrls: [],
  });

  const {
    serviceID,
    serviceName,
    serviceDescription,
    servicePrice,
    serviceType,
    serviceAvailability,
    servicePhone,
    serviceEmail,
    serviceRequirements,
    imageUrls,
  } = formData;
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchServiceListings = async () => {
      const serviceID = params.serviceID;
      const response = await fetch(`/api/serviceListing/read/${serviceID}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        setError(data?.message || "Failed to fetch service");
        return;
      }
      setFormData((prevData) => ({
        ...prevData,
        serviceID: sanitize(data.serviceID || ""),
        serviceName: sanitize(data.serviceName || ""),
        serviceDescription: sanitize(data.serviceDescription || ""),
        servicePrice: data.servicePrice ?? "",
        serviceType: sanitize(data.serviceType || ""),
        serviceAvailability: sanitize(data.serviceAvailability || ""),
        servicePhone: sanitize(data.servicePhone || ""),
        serviceEmail: sanitize(data.serviceEmail || ""),
        serviceRequirements: Array.isArray(data.serviceRequirements) ? data.serviceRequirements : [],
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.filter(isHttpsUrl) : [],
      }));
    };
    fetchServiceListings();
  }, []);

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(false);

      // Build sanitized payload (trim at submit time)
      const payload = {
        serviceID: sanitize(formData.serviceID).trim().toUpperCase(),
        serviceName: sanitize(formData.serviceName).trim(),
        serviceDescription: sanitize(formData.serviceDescription).trim(),
        servicePrice: clampNumber(formData.servicePrice, 0),
        serviceType: sanitize(formData.serviceType).trim(),
        serviceAvailability: sanitize(formData.serviceAvailability).trim(),
        servicePhone: sanitize(formData.servicePhone).trim(),
        serviceEmail: sanitize(formData.serviceEmail).trim(),
        serviceRequirements: Array.isArray(formData.serviceRequirements)
          ? formData.serviceRequirements.map((s) => sanitize(String(s)).trim()).filter(Boolean)
          : [],
        imageUrls: (formData.imageUrls || []).filter(isHttpsUrl),
        userRef: currentUser?._id,
      };

      // Basic validations
      if (!payload.serviceID || !/^[A-Z0-9]{6}$/.test(payload.serviceID)) {
        setLoading(false);
        return setError("Service ID must be exactly 6 alphanumeric characters (A–Z, 0–9).");
      }
      if (!payload.serviceName || !payload.serviceDescription) {
        setLoading(false);
        return setError("Please fill all required fields.");
      }
      if (payload.servicePrice < 0) {
        setLoading(false);
        return setError("Price cannot be negative.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.serviceEmail)) {
        setLoading(false);
        return setError("Please enter a valid email address.");
      }
      if (!/^[0-9]{7,15}$/.test(payload.servicePhone)) {
        setLoading(false);
        return setError("Please enter a valid phone number (7–15 digits).");
      }
      if (payload.imageUrls.length < 1) {
        setLoading(false);
        return setError("Please upload at least one image.");
      }

      const response = await fetch(
        `/api/serviceListing/update/${params.serviceID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      setLoading(false);
      if (!response.ok || data?.success === false) {
        setError(data?.message || "Error updating service. Please try again.");
        return;
      }
      navigate("/dashboard?tab=services");
    } catch (error) {
      setLoading(false);
      setError("Error updating service. Please try again.");
    }
  };

  // Function to handle image upload
  const handleImageSubmit = () => {
    if (!files || files.length === 0) {
      setImageUploadError("Please choose at least one image to upload");
      setUploading(false);
      return;
    }
    const total = files.length + formData.imageUrls.length;
    if (total > MAX_IMAGES) {
      setImageUploadError(`You can only upload ${MAX_IMAGES} images per listing`);
      setUploading(false);
      return;
    }
    const invalid = Array.from(files).find(
      (f) => !IMAGE_TYPES.includes(f.type) || f.size > MAX_IMAGE_SIZE_BYTES
    );
    if (invalid) {
      setImageUploadError("Image upload failed (allowed: JPG/PNG/WebP/GIF, max 2MB each)");
      setUploading(false);
      return;
    }

    setUploading(true);
    setImageUploadError(false);
    const promises = [];
    for (let i = 0; i < files.length; i++) {
      promises.push(storeImage(files[i]));
    }

    Promise.all(promises)
      .then((urls) => {
        const safe = urls.filter(isHttpsUrl);
        setFormData((prev) => ({
          ...prev,
          imageUrls: prev.imageUrls.concat(safe).slice(0, MAX_IMAGES),
        }));
        setImageUploadError(false);
        setUploading(false);
      })
      .catch(() => {
        setImageUploadError("Image Upload failed (2MB max per Image)");
        setUploading(false);
      });
  };
  // Function to store image in cloud storage
  const storeImage = async (file) => {
    return new Promise((resolve, reject) => {
      try {
        if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE_BYTES) {
          return reject(new Error("Invalid file"));
        }
        const storage = getStorage(app);
        const ext = file.name && file.name.lastIndexOf(".") > -1 ? file.name.slice(file.name.lastIndexOf(".")) : "";
        const fileName = `${Date.now()}_${randHex(8)}${ext}`;
        const storageRef = ref(storage, fileName);
        const metadata = { contentType: file.type };
        const uploadTask = uploadBytesResumable(storageRef, file, metadata);
        uploadTask.on(
          "state_changed",
          () => {}, // no verbose logs
          (error) => reject(error),
          () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => resolve(downloadURL));
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  };

  // Function to handle removing an image
  const handleRemoveImage = (index) => {
    setFormData({
      ...formData,
      imageUrls: formData.imageUrls.filter((_, i) => i !== index),
    });
  };

  // Function to handle form field changes
  const handleChange = (e) => {
    const { name, value, type, files: fileList } = e.target;

    // handle file input
    if (type === "file") {
      setFiles(fileList);
      return;
    }

    let v = sanitize(value);

    // numeric
    if (type === "number" || name === "servicePrice") {
      v = clampNumber(v, 0);
    }

    // per-field rules
    if (name === "serviceID") {
      v = String(v).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    } else if (name === "serviceName") {
      v = v.replace(/[^A-Za-z0-9 '\-]/g, "").slice(0, TITLE_MAX);
    } else if (name === "serviceDescription") {
      v = v.slice(0, DESC_MAX);
    } else if (name === "servicePhone") {
      v = v.replace(/[^0-9]/g, "").slice(0, 15);
    } else if (name === "serviceEmail") {
      v = v.slice(0, 120);
    } else if (name === "serviceRequirements") {
      const parts = v.split(",").map((s) => sanitize(s).trim()).filter(Boolean).slice(0, 15);
      setFormData((prev) => ({ ...prev, serviceRequirements: parts }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: v }));
  };

  return (
    <div>
      <main>
        <h1 className="text-center mt-7 font-extrabold text-3xl underline">
          Update Service
        </h1>
      </main>
      <div className="flex justify-center items-center mt-5">
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
          <div>
            <label htmlFor="serviceID">Service ID</label>
            <TextInput
              type="text"
              name="serviceID"
              value={serviceID}
              onChange={handleChange}
              placeholder="6 chars, A–Z/0–9"
              required
              maxLength={6}
            />
          </div>
          <div>
            <label value="Service Name"> Service Name</label>
            <TextInput
              type="text"
              name="serviceName"
              value={serviceName}
              onChange={handleChange}
              placeholder="Enter Service Name"
              required
              maxLength={TITLE_MAX}
            />
          </div>
          <div>
            <label value="Service Description"> Service Description</label>
            <Textarea
              name="serviceDescription"
              value={serviceDescription}
              onChange={handleChange}
              placeholder="Enter Service Description"
              required
              maxLength={DESC_MAX}
            />
          </div>
          <div>
            <label value="Service Price"> Service Price</label>
            <TextInput
              type="number"
              name="servicePrice"
              value={servicePrice}
              onChange={handleChange}
              placeholder="Enter Service Price"
              required
              min={0}
              step={0.01}
            />
          </div>
          <div>
            <label value="Service Type"> Service Type</label>
            <TextInput
              type="text"
              name="serviceType"
              value={serviceType}
              onChange={handleChange}
              placeholder="Enter Service Type"
              required
            />
          </div>
          <div>
            <label value="Service Availability"> Service Availability</label>
            <TextInput
              type="text"
              name="serviceAvailability"
              value={serviceAvailability}
              onChange={handleChange}
              placeholder="Enter Service Availability"
              required
            />
          </div>
          <div>
            <label value="Service Phone"> Service Phone</label>
            <TextInput
              type="text"
              name="servicePhone"
              value={servicePhone}
              onChange={handleChange}
              placeholder="Enter Service Phone"
              required
              inputMode="numeric"
              pattern="^[0-9]{7,15}$"
              maxLength={15}
              title="Enter 7 to 15 digits"
            />
          </div>
          <div>
            <label value="Service Email"> Service Email</label>
            <TextInput
              type="email"
              name="serviceEmail"
              value={serviceEmail}
              onChange={handleChange}
              placeholder="Enter Service Email"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label value="Service Requirements"> Service Requirements</label>
            <TextInput
              type="text"
              name="serviceRequirements"
              value={Array.isArray(serviceRequirements) ? serviceRequirements.join(", ") : serviceRequirements}
              onChange={handleChange}
              placeholder="Comma-separated (e.g., Gloves, Mask, ID)"
              required
            />
          </div>

          {/* Update images section */}
          <div className="flex flex-col gap-4 flex-1">
            <p className="font-semibold">
              Images:{" "}
              <span className="font-normal text-gray-600 ml-2">
                6 Photos Max
              </span>
            </p>
            <div className="flex gap-4">
              <FileInput
                onChange={(e) => setFiles(e.target.files)}
                type="file"
                id="image"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="w-full"
              />
              <button
                onClick={handleImageSubmit}
                type="button"
                disabled={uploading}
                className="p-1 text-red-700 border border-red-700 rounded uppercase hover:shadow-lg disabled:opacity-80"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
            <p className="text-red-700">
              {imageUploadError && imageUploadError}
            </p>
            {formData.imageUrls.length > 0 &&
              formData.imageUrls.map((url, index) => (
                <div
                  key={`image-${index}`}
                  className="flex justify-between p-3 border items-center"
                >
                  <img
                    src={isHttpsUrl(url) ? url : ""}
                    alt={`listing image ${index}`}
                    className="w-20 h-20 object-contain rounded-lg"
                  />
                  <Button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    gradientDuoTone="pinkToOrange"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            <Button
              type="submit"
              gradientDuoTone="purpleToBlue"
              className="uppercase"
            >
              {loading ? "Service Listing..." : "Service Listing"}
            </Button>
            {error && (
              <Alert className="mt-7 py-3 bg-gradient-to-r from-red-100 via-red-300 to-red-400 shadow-shadowOne text-center text-red-600 text-base tracking-wide animate-bounce">
                {error}
              </Alert>
            )}
          </div>
          {error && <p>{error}</p>}

          {/* Add other form fields */}
          <button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Service"}
          </button>
        </form>
        {/* Add logic for displaying uploaded images and error messages */}
      </div>
    </div>
  );
};

export default ServiceUpdate_06;
