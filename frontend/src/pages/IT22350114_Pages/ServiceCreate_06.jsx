import { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { app } from "../../firebase";

import {
  Button,
  Label,
  Select,
  TextInput,
  Textarea,
  FileInput,
  Alert,
} from "flowbite-react";

// --- Security helpers (client-side) ---
const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const TITLE_MAX = 120;
const DESC_MAX = 2000;

const sanitize = (s) => (typeof s === "string" ? s.replace(/[<>]/g, "") : s); // don't trim during typing
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

const ServiceListingCreate = () => {
  const { currentUser } = useSelector((state) => state.user);
  const [files, setFiles] = useState([]);
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [imageUploadError, setImageUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleImageSubmit = () => {
    if (!files || files.length === 0) {
      setImageUploadError("Please choose at least one image to upload");
      return;
    }
    const total = files.length + formData.imageUrls.length;
    if (total > MAX_IMAGES) {
      setImageUploadError(`You can only upload ${MAX_IMAGES} Images per listing`);
      return;
    }
    const invalid = Array.from(files).find(
      (f) => !IMAGE_TYPES.includes(f.type) || f.size > MAX_IMAGE_SIZE_BYTES
    );
    if (invalid) {
      setImageUploadError("Image upload failed (allowed: JPG/PNG/WebP/GIF, max 2MB each)");
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
        const safeUrls = urls.filter(isHttpsUrl);
        setFormData((prev) => ({
          ...prev,
          imageUrls: prev.imageUrls.concat(safeUrls).slice(0, MAX_IMAGES),
        }));
        setImageUploadError(false);
        setUploading(false);
      })
      .catch(() => {
        setImageUploadError("Image Upload failed (2MB max per Image)");
        setUploading(false);
      });
  };

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
          () => {}, // no noisy logs
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

  const handleRemoveImage = (index) => {
    setFormData({
      ...formData,
      imageUrls: formData.imageUrls.filter((_, i) => i !== index),
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (formData.imageUrls.length < 1)
        return setError("Please upload at least one image");

      // Basic client-side validations and normalization
      const payload = {
        serviceID: sanitize(formData.serviceID).trim().toUpperCase(),
        serviceName: sanitize(formData.serviceName).trim(),
        serviceDescription: sanitize(formData.serviceDescription).trim(),
        servicePrice: clampNumber(formData.servicePrice, 0),
        serviceType: sanitize(formData.serviceType),
        serviceAvailability: sanitize(formData.serviceAvailability),
        servicePhone: sanitize(formData.servicePhone).trim(),
        serviceEmail: sanitize(formData.serviceEmail).trim(),
        serviceRequirements: Array.isArray(formData.serviceRequirements)
          ? formData.serviceRequirements.map((s) => sanitize(s).trim()).filter(Boolean)
          : [],
        imageUrls: (formData.imageUrls || []).filter(isHttpsUrl),
        userRef: currentUser?._id,
      };

      if (!payload.serviceID || payload.serviceID.length !== 6) {
        setLoading(false);
        return setError("Service ID must be exactly 6 alphanumeric characters");
      }
      if (!payload.serviceName || !payload.serviceDescription) {
        setLoading(false);
        return setError("Please fill all required fields");
      }
      if (payload.servicePrice < 0) {
        setLoading(false);
        return setError("Price cannot be negative");
      }
      // simple email regex
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.serviceEmail);
      if (!emailOk) {
        setLoading(false);
        return setError("Please enter a valid email address");
      }
      // simple phone length check
      if (payload.servicePhone.length < 7) {
        setLoading(false);
        return setError("Please enter a valid phone number (7-15 digits)");
      }

      setLoading(true);
      setError(false);

      const res = await fetch("/api/serviceListing/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok || data.success === false) {
        return setError(data.message || "Failed to create service");
      }
      navigate("/dashboard?tab=services");
    } catch (error) {
      setError(error.message || "An error occurred");
      setLoading(false);
    }
  };

  
  const handleChange = (e) => {
    const { name, value, type, files: fileList } = e.target;
    // file input
    if (type === "file") {
      setFiles(fileList);
      return;
    }

    let v = sanitize(value);

    // boolean coercion for selects (not used here but safe if added later)
    if (v === "true" || v === "false") {
      v = v === "true";
    }

    // numeric
    if (type === "number" || name === "servicePrice") {
      v = clampNumber(v, 0);
    }

    // field-specific rules
    if (name === "serviceID") {
      // Keep alphanumerics only, uppercase, and cap to 6 client-side
      v = String(v).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    } else if (name === "serviceName") {
      v = v.replace(/[^A-Za-z0-9 '\-]/g, "").slice(0, TITLE_MAX);
    } else if (name === "serviceDescription") {
      v = v.slice(0, DESC_MAX);
    } else if (name === "servicePhone") {
      v = v.replace(/[^0-9]/g, "").slice(0, 15); // digits only, up to 15
    } else if (name === "serviceEmail") {
      v = v.slice(0, 120);
    } else if (name === "serviceRequirements") {
      // split by comma into array; sanitize each; max 15 items
      const parts = v.split(",").map((s) => sanitize(s).trim()).filter(Boolean).slice(0, 15);
      setFormData((prev) => ({ ...prev, serviceRequirements: parts }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: v,
    }));
  };

  return (
    <main className="p-3 max-w-4xl mx-auto mb-10">
      <h1 className="text-2xl text-center font-semibold mb-5">
        Create a Service Listing
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="serviceID">Service ID</Label>
            <TextInput
              type="text"
              name="serviceID"
              value={formData.serviceID}
              onChange={handleChange}
              id="serviceID"
              maxLength={6}
              minLength={6}
              required
            />
          </div>
          <div>
            <Label htmlFor="serviceName">Service Name</Label>
            <TextInput
              type="text"
              name="serviceName"
              value={formData.serviceName}
              onChange={handleChange}
              id="serviceName"
              required
              maxLength={TITLE_MAX}
            />
          </div>
          <div>
            <Label htmlFor="serviceDescription">Service Description</Label>
            <Textarea
              name="serviceDescription"
              value={formData.serviceDescription}
              onChange={handleChange}
              id="serviceDescription"
              required
              maxLength={DESC_MAX}
            />
          </div>
          <div>
            <Label htmlFor="servicePrice">Service Price</Label>
            <TextInput
              type="number"
              name="servicePrice"
              value={formData.servicePrice}
              onChange={handleChange}
              id="servicePrice"
              required
              min={0}
              step={0.01}
            />
          </div>

          <div>
            <Label htmlFor="serviceType">Service Type</Label>
            <Select
              name="serviceType"
              value={formData.serviceType}
              onChange={handleChange}
              id="serviceType"
              required
            >
              <option value="">Select a service type</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
              <option value="Carpentry">Carpentry</option>
              <option value="Gardening">Gardening</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="serviceAvailability">Service Availability</Label>
            <Select
              name="serviceAvailability"
              value={formData.serviceAvailability}
              onChange={handleChange}
              id="serviceAvailability"
              required
            >
              <option value="">Select availability</option>
              <option value={"Available"}>Available</option>
              <option value={"Unavailable"}>Unavailable</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="servicePhone">Phone Number</Label>
            <TextInput
              type="text"
              name="servicePhone"
              value={formData.servicePhone}
              onChange={handleChange}
              id="servicePhone" // corrected id attribute
              required
              inputMode="numeric"
              pattern="^[0-9]{7,15}$"
              maxLength={15}
              title="Enter 7 to 15 digits"
            />
          </div>
          <div>
            <Label htmlFor="serviceEmail">Email</Label> {/* corrected typo */}
            <TextInput
              type="email"
              name="serviceEmail"
              value={formData.serviceEmail}
              onChange={handleChange}
              id="serviceEmail"
              required
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="serviceRequirements">Service Requirements</Label>
            <TextInput
              type="text"
              name="serviceRequirements"
              value={Array.isArray(formData.serviceRequirements) ? formData.serviceRequirements.join(", ") : formData.serviceRequirements}
              onChange={handleChange}
              id="serviceRequirements"
              required
              placeholder="Comma-separated (e.g., Gloves, Mask, ID)"
            />
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <p className="font-semibold">Images: <span className="font-normal text-gray-600 ml-2">6 Photos Max</span></p>
            <div className="flex gap-4">
                <FileInput onChange={(e) => setFiles(e.target.files)} type='file' id="image" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="w-full" />
                <button onClick={handleImageSubmit} type="button" disabled={uploading} className="p-1 text-red-700 border border-red-700 rounded uppercase hover:shadow-lg disabled:opacity-80">{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
            <p className="text-red-700">{imageUploadError && imageUploadError}</p>
            {
                formData.imageUrls.length > 0 && formData.imageUrls.map((url, index) => (
                    <div key={`image-${index}`} className="flex justify-between p-3 border items-center">
                        <img src={isHttpsUrl(url) ? url : ""} alt={`listing image ${index}`} className='w-20 h-20 object-contain rounded-lg' />
                        <Button type="button" onClick={() => handleRemoveImage(index)} gradientDuoTone="pinkToOrange">Delete</Button>
                    </div>
                ))
            }
            <Button
            type="submit"
            gradientDuoTone="purpleToBlue"
            className="uppercase"
        >{loading ? "Service Listing..." : "Service Listing"}</Button>
            {error && <Alert className='mt-7 py-3 bg-gradient-to-r from-red-100 via-red-300 to-red-400 shadow-shadowOne text-center text-red-600 text-base tracking-wide animate-bounce'>{error}</Alert>}
        </div>
        </div>
      </form>
    </main>
  );
};

export default ServiceListingCreate;