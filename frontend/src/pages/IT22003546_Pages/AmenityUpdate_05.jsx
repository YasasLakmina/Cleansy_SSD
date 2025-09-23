import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { app } from "../../firebase";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import {
    Button,
    Label,
    TextInput,
    Textarea,
    FileInput,
    Alert
} from "flowbite-react";

// === Security helpers (client-side) ===
const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const isSafeUrl = (u) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};
const sanitize = (s) => (typeof s === "string" ? s.replace(/[<>]/g, "") : s); // don't trim while typing
const clampNumber = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
};

const AmenityUpdate_05 = () => {
    const navigate = useNavigate();
    const params = useParams();
    const [files, setFiles] = useState([]);
    const { currentUser } = useSelector((state) => state.user);
    const [formData, setFormData] = useState({
        amenityID: "",
        amenityTitle: "",
        amenityDescription: "",
        amenityLocation: "",
        amenityCapacity: 1,
        amenityAvailableTimes: "",
        amenityPrice: "",
        imageURLs: [],
    });

    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [imageUploadError, setImageUploadError] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const fetchAmenity = async () => {
            const amenityID = params.amenityID;
            const res = await fetch(`/api/amenitiesListing/get/${amenityID}`);
            const data = await res.json();
            if (data.success === false) {
                return;
            }
            setFormData((prevData) => ({
                ...prevData,
                amenityID: data.amenityID,
                amenityTitle: data.amenityTitle,
                amenityDescription: data.amenityDescription,
                amenityLocation: data.amenityLocation,
                amenityCapacity: data.amenityCapacity,
                amenityAvailableTimes: data.amenityAvailableTimes,
                amenityPrice: data.amenityPrice,
                imageURLs: data.imageURLs,
            }));
        }
        fetchAmenity();
    }
        , []);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        let processedValue = sanitize(value);

        // boolean coercion if needed
        if (processedValue === "true" || processedValue === "false") {
          processedValue = processedValue === "true";
        }

        if (type === "number") {
          processedValue = clampNumber(processedValue, 0);
        }

        // Field-specific guardrails
        if (name === "amenityTitle") {
          // Allow letters, numbers, spaces, apostrophes and hyphens; keep spaces intact
          processedValue = processedValue.replace(/[^A-Za-z0-9 '\-]/g, "");
        } else if (name === "amenityAvailableTimes") {
          // Normalize separators to a single hyphen and keep only valid chars
          processedValue = processedValue
            .replace(/[–—−|]/g, "-")     // en/em dashes, minus sign, pipe -> hyphen
            .replace(/\s*to\s*/gi, "-") // "to" -> hyphen
            .replace(/\s+/g, "")        // remove spaces
            .replace(/-+/g, "-")         // collapse multiple hyphens
            .replace(/[^0-9:\-]/g, ""); // keep only digits, colon, hyphen
        }

        setFormData((prev) => ({ ...prev, [name]: processedValue }));
    };
        
        

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Basic validation
            if (formData.imageURLs.length < 1) {
              return setError("Please upload at least one image");
            }
            if (!formData.amenityTitle || !formData.amenityDescription || !formData.amenityLocation) {
              return setError("Please fill all required fields");
            }
            if (clampNumber(formData.amenityCapacity, 1) < 1) {
              return setError("Capacity must be at least 1");
            }
            if (clampNumber(formData.amenityPrice, 0) < 0) {
              return setError("Price cannot be negative");
            }

            setLoading(true);
            setError(false);

            // Build sanitized payload (trim only at submit)
            const payload = {
              amenityID: sanitize(formData.amenityID).trim(),
              amenityTitle: sanitize(formData.amenityTitle).trim(),
              amenityDescription: sanitize(formData.amenityDescription).trim(),
              amenityLocation: sanitize(formData.amenityLocation).trim(),
              amenityCapacity: clampNumber(formData.amenityCapacity, 1),
              amenityAvailableTimes: sanitize(formData.amenityAvailableTimes).trim(),
              amenityPrice: clampNumber(formData.amenityPrice, 0),
              imageURLs: (formData.imageURLs || []).filter(isSafeUrl),
            };

            const res = await fetch(`/api/amenitiesListing/update/${params.amenityID}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            setLoading(false);
            if (data.success === false) {
                setError(data.message || "Failed to update amenity");
                return;
            }
            navigate("/dashboard?tab=amenity");
        } catch (error) {
            setLoading(false);
            setError("An error occurred while updating the amenity.");
        }
    };

    const handleImageSubmit = () => {
        if (!files || files.length === 0) {
          setImageUploadError("Please choose at least one image to upload");
          return;
        }
        const total = files.length + formData.imageURLs.length;
        if (total > MAX_IMAGES) {
          setImageUploadError(`You can only upload ${MAX_IMAGES} images per listing`);
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
            const safeUrls = urls.filter(isSafeUrl);
            setFormData((prev) => ({
              ...prev,
              imageURLs: prev.imageURLs.concat(safeUrls).slice(0, MAX_IMAGES),
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
            // random filename; avoid trusting user-provided file name
            const rand = crypto && crypto.getRandomValues
              ? [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, "0")).join("")
              : Math.random().toString(16).slice(2);
            const ext = (file.name && file.name.lastIndexOf(".") > -1) ? file.name.slice(file.name.lastIndexOf(".")) : "";
            const fileName = `${Date.now()}_${rand}${ext}`;
            const storageRef = ref(storage, fileName);
            const metadata = { contentType: file.type };
            const uploadTask = uploadBytesResumable(storageRef, file, metadata);
            uploadTask.on(
              "state_changed",
              () => {},
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
          imageURLs: formData.imageURLs.filter((_, i) => i !== index),
        })
     }



    return (
        <div className="min-h-screen mt-20">
            <main>
                <h1 className="text-3xl text-center mt-6 font-extrabold underline text-blue-950 dark:text-slate-300">
                    Update Amenity
                </h1>
            </main>
            <div className="flex p-3 w-[40%] mx-auto flex-col md:flex-row md:items-center gap-20 md:gap-20 mt-10">
                <form onSubmit = {handleSubmit} className="flex flex-col gap-4 w-full justify-center">
                    <div>
                        <Label value="amenityID" />
                        <TextInput
                            type="text"
                            name="amenityID"
                            required
                            value={formData.amenityID}
                            onChange={handleChange}
                            readOnly
                        />
                    </div>
                    <div>
                        <Label value="Amenity Name" />
                        <TextInput
                            type="text"
                            name="amenityTitle"
                            required
                            value={formData.amenityTitle}
                            onChange={handleChange}
                            maxLength={60}
                        />
                    </div>   
                    <div>
                        <Label value="Description" />
                        <Textarea
                            name="amenityDescription"
                            required
                            value={formData.amenityDescription}
                            onChange={handleChange}
                            maxLength={2000}
                        />
                    </div>
                    <div>
                        <Label value="Location" />
                        <TextInput
                            type="text"
                            name="amenityLocation"
                            required
                            value={formData.amenityLocation}
                            onChange={handleChange}
                            maxLength={120}
                        />
                    </div>
                    <div>
                        <Label value="Capacity" />
                        <TextInput
                            type="number"
                            name="amenityCapacity"
                            required
                            value={formData.amenityCapacity}
                            onChange={handleChange}
                            min={1}
                            step={1}
                        />
                    </div>
                    <div>
                        <Label value="Price" />
                        <TextInput
                            type="number"
                            name="amenityPrice"
                            required
                            value={formData.amenityPrice}
                            onChange={handleChange}
                            min={0}
                            step={0.01}
                        />
                    </div>
                    <div>
                        <Label value="AvailableTime" />
                        <TextInput
                            type="text"
                            name="amenityAvailableTimes"
                            required
                            value={formData.amenityAvailableTimes}
                            onChange={handleChange}
                            maxLength={120}
                            pattern="^\s*\d{1,2}:[0-5]\d\s*[-–]\s*\d{1,2}:[0-5]\d\s*$"
                            title="Use HH:MM-HH:MM (e.g., 09:00-17:00). Hyphen or en dash allowed."
                            placeholder="e.g., 09:00-17:00"
                        />
                    </div>
                    <div className="flex flex-col gap-4 flex-1">
                        <p className="font-semibold">Images: <span className="font-normal text-gray-600 ml-2">6 Photos Max</span></p>
                        <div className="flex gap-4">
                            <FileInput onChange={(e) => setFiles(e.target.files)} type='file' id="image" accept="image/*" multiple className="w-full" />
                            <button onClick={handleImageSubmit} type="button" disabled={uploading} className="p-1 text-red-700 border border-red-700 rounded uppercase hover:shadow-lg disabled:opacity-80">{uploading ? 'Uploading...' : 'Upload'}</button>
                        </div>
                        <p className="text-red-700">{imageUploadError && imageUploadError}</p>
                        {
                            formData.imageURLs.length > 0 && formData.imageURLs.map((url, index) => (
                                <div key={`image-${index}`} className="flex justify-between p-3 border items-center">
                                    <img src={isSafeUrl(url) ? url : ""} alt={`listing image ${index}`} className='w-20 h-20 object-contain rounded-lg' />
                                    <Button type="button" onClick={() => handleRemoveImage(index)} gradientDuoTone="pinkToOrange">Delete</Button>
                                </div>
                            ))
                        }
                        <Button
                        type="submit"
                        gradientDuoTone="purpleToBlue"
                        className="uppercase"
                    >{loading ? "Updating Amenity..." : "Update Amenity"}</Button>
                        {error && <Alert className='mt-7 py-3 bg-gradient-to-r from-red-100 via-red-300 to-red-400 shadow-shadowOne text-center text-red-600 text-base tracking-wide animate-bounce'>{error}</Alert>}
                    </div>
                </form>   
        </div>
    </div>
    );
}

export default AmenityUpdate_05;