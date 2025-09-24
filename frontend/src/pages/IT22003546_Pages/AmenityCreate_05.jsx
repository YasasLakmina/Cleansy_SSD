import { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { app } from "../../firebase";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import {
    Button,
    Label,
    TextInput,
    Textarea,
    FileInput,
    Alert,
    } from "flowbite-react";

// Security helpers
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
const sanitize = (s) => (typeof s === "string" ? s.replace(/[<>]/g, "") : s);
const clampNumber = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
};

const AmenityCreate = () => {

    const generateAmenityId = () => `AMD-${Math.floor(1000 + Math.random() * 9000)}`;
    const [files, setFiles] = useState([]);
    const { currentUser } = useSelector((state) => state.user);
    const [formData, setFormData] = useState({
        amenityID: generateAmenityId(),
        amenityTitle: '',
        amenityDescription: '',
        imageURLs: [],
        amenityLocation: '',
        amenityCapacity: 1,
        amenityAvailableTimes: '',
        amenityPrice: '',
        amenityStatus: "Unavailable",
    });

    // const { AmenityID, AmenityName, Description, Image, Location, Capacity, Availability, Price } = formData;
    const [imageUploadError, setImageUploadError] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
      const { name, value, type } = e.target;

      // normalize and sanitize string inputs
      let processedValue = sanitize(value);

      // coerce booleans coming from selects if needed
      if (processedValue === "true" || processedValue === "false") {
        processedValue = processedValue === "true";
      }

      // numeric constraints
      if (type === "number") {
        processedValue = clampNumber(processedValue, 0);
      }

      // extra guardrails per-field
      if (name === "amenityTitle") {
        // Allow letters, numbers, spaces, apostrophes and hyphens; keep spaces intact
        processedValue = processedValue.replace(/[^A-Za-z0-9 '\-]/g, "");
    } else if (name === "amenityAvailableTimes") {
        // Allow digits, colon, and dash for ranges (e.g., 09:00-17:00)
        processedValue = processedValue.replace(/[^0-9:-]/g, "");
      }

      setFormData((prev) => ({
        ...prev,
        [name]: processedValue,
      }));
    };
    
    

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
          // basic client-side validation
          if (formData.imageURLs.length < 1) return setError("You must upload at least one image");
          if (!formData.amenityTitle || !formData.amenityDescription || !formData.amenityLocation) {
            return setError("Please fill all required fields.");
          }
          if (clampNumber(formData.amenityCapacity, 1) < 1) {
            return setError("Capacity must be at least 1.");
          }
          if (clampNumber(formData.amenityPrice, 0) < 0) {
            return setError("Price cannot be negative.");
          }

          setLoading(true);
          setError(false);

          const payload = {
            amenityID: sanitize(formData.amenityID).trim(),
            amenityTitle: sanitize(formData.amenityTitle).trim(),
            amenityDescription: sanitize(formData.amenityDescription).trim(),
            imageURLs: formData.imageURLs.filter(isSafeUrl),
            amenityLocation: sanitize(formData.amenityLocation).trim(),
            amenityCapacity: clampNumber(formData.amenityCapacity, 1),
            amenityAvailableTimes: sanitize(formData.amenityAvailableTimes).trim(),
            amenityPrice: clampNumber(formData.amenityPrice, 0),
            amenityStatus: "Unavailable",
            userRef: currentUser?._id,
          };
        
          const response = await fetch("/api/amenitiesListing/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payload),
          });

            const data = await response.json();
            setLoading(false);
            if (data.success === false) {
                return setError(data.message);
            }
            navigate('/dashboard?tab=amenity');
        }
        catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleImageSubmit = () => {
      // file selection present?
      if (!files || files.length === 0) {
        setImageUploadError("Please choose at least one image to upload");
        return;
      }
      const total = files.length + formData.imageURLs.length;
      if (total > MAX_IMAGES) {
        setImageUploadError(`You can only upload ${MAX_IMAGES} images per listing`);
        return;
      }

      // client-side validation for type and size
      const invalid = Array.from(files).find(
        (f) => !IMAGE_TYPES.includes(f.type) || f.size > MAX_IMAGE_SIZE_BYTES
      );
      if (invalid) {
        setImageUploadError("Image upload failed (allowed types: JPG/PNG/WebP/GIF, max 2MB each)");
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
          // Validate again
          if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE_BYTES) {
            return reject(new Error("Invalid file"));
          }
          const storage = getStorage(app);
          // random hex + timestamp as filename; avoid using user-provided file.name
          const rand = crypto && crypto.getRandomValues ? [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, "0")).join("") : Math.random().toString(16).slice(2);
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
            <h1 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Create Amenity</h1>
            <div className="flex p-3 w-[40%] mx-auto flex-col md:flex-row md:items-center gap-20 md:gap-20 mt-10">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full justify-center">
                    <div>
                        <Label htmlFor="amenityID">Amenity ID</Label>
                        <TextInput
                            type="text"
                            name="amenityID"
                            value={formData.amenityID}
                            onChange={handleChange}
                            required
                            
                        />
                    </div>
                    <div>
                        <Label htmlFor="amenityTitle">Amenity Name</Label>
                        <TextInput
                            type="text"
                            name="amenityTitle"
                            value={formData.amenityTitle}
                            onChange={handleChange}
                            required
                            maxLength={60}
                        />
                    </div>
                    <div>
                        <Label htmlFor="amenityDescription">Description</Label>
                        <Textarea
                            name="amenityDescription"
                            value={formData.amenityDescription}
                            onChange={handleChange}
                            required
                            maxLength={2000}
                        />
                    </div>

                    <div>
                        <Label htmlFor="amenityLocation">Location</Label>
                        <TextInput
                            type="text"
                            name="amenityLocation"
                            value={formData.amenityLocation}
                            onChange={handleChange}
                            required
                            maxLength={120}
                        />
                    </div>
                    
                    <div>
                        <Label htmlFor="amenityCapacity">Capacity</Label>
                        <TextInput
                            type="number"
                            name="amenityCapacity"
                            value={formData.amenityCapacity}
                            onChange={handleChange}
                            required
                            min={1}
                            step={1}
                        />
                    </div>

                    <TextInput
                        type="text"
                        name="amenityAvailableTimes"
                        value={formData.amenityAvailableTimes}
                        onChange={handleChange}
                        required
                        maxLength={120}
                        pattern="^[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}$"
                        placeholder="Format: HH:MM-HH:MM (e.g., 09:00-17:00)"
                    />

                    <div>
                        <Label htmlFor="amenityPrice">Price</Label>
                        <TextInput
                            type="number"
                            name="amenityPrice"
                            value={formData.amenityPrice}
                            onChange={handleChange}
                            required
                            min={0}
                            step={0.01}
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
                    >{loading ? "Creating Amenity..." : "Create Amenity"}</Button>
                        {error && <Alert className='mt-7 py-3 bg-gradient-to-r from-red-100 via-red-300 to-red-400 shadow-shadowOne text-center text-red-600 text-base tracking-wide animate-bounce'>{error}</Alert>}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AmenityCreate