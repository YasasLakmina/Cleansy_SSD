import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { app } from "../../firebase";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// --- Security helpers (client-side) ---
const MAX_IMAGES = 2; // UI says 2 Photos Max
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
const randHex = (len = 16) => {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(len / 2);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2, 2 + len);
};
// --- End helpers ---

import {
    Button,
    Label,
    TextInput,
    Textarea,
    FileInput,
    Alert,
} from "flowbite-react";

const BookingUpdate_05 = () => {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const params = useParams();
    const [formData, setFormData] = useState({
        bookingID: "",
        amenityID: "",
        amenityTitle: "",
        residentUsername: "",
        residentName: "",
        residentEmail: "",
        residentContact: "",
        bookingDate:"",
        bookingTime:"",
        duration: 1,
        specialRequests: "",
        status: "Pending",
        pricePerHour: 0,
        bookingPrice: 0,
        imageUrls: [],
    });

    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [imageUploadError, setImageUploadError] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [calculateDisabled, setCalculateDisabled] = useState(false); 
    const [durationDisabled, setDurationDisabled] = useState(false); 


    useEffect(() => {
        const fetchBooking = async () => {
            const bookingID = params.bookingID;
            const res = await fetch(`/api/amenitiesBooking/get/${bookingID}`);
            const data = await res.json();
            if (data.success === false) {
                console.error(data.message);
                return;
            }
            const formattedDate = new Date(data.bookingDate).toISOString().split('T')[0];
            setFormData((prevData) => ({
                ...prevData,
                bookingID: data.bookingID,
                amenityID: data.amenityId,
                amenityTitle: data.amenityTitle,
                residentUsername: data.residentUsername,
                residentName: data.residentName,
                residentEmail: data.residentEmail,
                residentContact: data.residentContact,
                bookingDate: formattedDate,
                bookingTime: data.bookingTime,
                duration: data.duration,
                specialRequests: data.specialRequests,
                status: data.bookingStatus,
                pricePerHour: data.bookingPrice/data.duration,
                bookingPrice: data.bookingPrice,
                imageUrls: data.imageUrls,
            }));
        }
        fetchBooking();
    }, []);

    const calculateTotalPrice = () => {
        if (formData.duration && formData.pricePerHour) {
            const currentTotalPrice = formData.bookingPrice;
            const newTotalPrice = formData.duration * formData.pricePerHour;
            const priceDifference = newTotalPrice - currentTotalPrice;
            setFormData((prevData) => ({
                ...prevData,
                bookingPrice: newTotalPrice,
                priceDifference: priceDifference, // Add priceDifference to the state
            }));
            setCalculateDisabled(true); // Disable the Calculate button after it's clicked
            setDurationDisabled(true); // Disable the Duration field after Calculate button is clicked
        }
    };

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
          const safe = urls.filter(isSafeUrl);
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
            () => {}, // no noisy progress logs
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
      setFormData((prev) => ({
        ...prev,
        imageUrls: prev.imageUrls.filter((_, i) => i !== index),
      }));
    };

    const handleChange = (e) => {
      const { name, value, type } = e.target;
      let processedValue = sanitize(value);

      // numeric constraints
      if (type === "number") {
        processedValue = clampNumber(processedValue, 0);
      }

      // per-field rules
      if (name === "residentName") {
        processedValue = processedValue.replace(/[^A-Za-z\s]/g, "");
      } else if (name === "residentEmail") {
        processedValue = processedValue.slice(0, 120); // keep length reasonable
      } else if (name === "residentContact") {
        processedValue = processedValue.replace(/[^0-9]/g, "").slice(0, 15);
      } else if (name === "specialRequests") {
        processedValue = processedValue.slice(0, 1000);
      }

      setFormData((prev) => ({
        ...prev,
        [name]: processedValue,
      }));
    };
        

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError(false);

      try {
        if (formData.imageUrls.length < 1) {
          setLoading(false);
          return setError("Please upload at least one image");
        }
        if (!formData.residentName || !formData.residentEmail || !formData.residentContact) {
          setLoading(false);
          return setError("Please fill all required fields");
        }
        // simple email format check
        const emailOk = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(formData.residentEmail);
        if (!emailOk) {
          setLoading(false);
          return setError("Please enter a valid email address");
        }

        const payload = {
          bookingID: sanitize(formData.bookingID).trim(),
          amenityId: sanitize(formData.amenityID).trim(),
          amenityTitle: sanitize(formData.amenityTitle).trim(),
          residentUsername: sanitize(formData.residentUsername).trim(),
          residentName: sanitize(formData.residentName).trim(),
          residentEmail: sanitize(formData.residentEmail).trim(),
          residentContact: sanitize(formData.residentContact).trim(),
          bookingDate: formData.bookingDate,
          bookingTime: formData.bookingTime,
          duration: clampNumber(formData.duration, 1),
          specialRequests: sanitize(formData.specialRequests).trim(),
          bookingStatus: "Pending",
          pricePerHour: clampNumber(formData.pricePerHour, 0),
          bookingPrice: clampNumber(formData.bookingPrice, 0),
          imageUrls: (formData.imageUrls || []).filter(isSafeUrl),
        };

        const res = await fetch(`/api/amenitiesBooking/update/${params.bookingID}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success === false) {
          setError(data.message || "Failed to update booking");
          setLoading(false);
          return;
        }
        navigate('/dashboard?tab=bookings');
      } catch (error) {
        setError("An error occurred. Please try again.");
        setLoading(false);
      }
    };

    return (
        <div className="min-h-screen mt-20">
            <main>
                <h1 className="text-3xl text-center mt-6 font-extrabold underline text-blue-950 dark:text-slate-300">
                    Update Booking
                </h1>
            </main>
            <div className="flex p-3 w-[40%] mx-auto flex-col md:flex-row md:items-center gap-20 md:gap-20 mt-10">
                <form onSubmit = {handleSubmit} className="flex flex-col gap-4 w-full justify-center">
                    <div>
                        <Label htmlFor="bookingId">Booking ID:</Label>
                        <TextInput
                            type="text"
                            id="bookingId"
                            name="bookingID"
                            value={formData.bookingID}
                            readOnly
                        />
                    </div>

                    <div>
                        <Label htmlFor="amenityId">Amenity ID:</Label>
                        <TextInput
                            type="text"
                            id="amenityId"
                            name="amenityID"
                            value={formData.amenityID}
                            readOnly
                        />
                    </div>

                    <div>
                        <Label htmlFor="amenityTitle">Amenity Title:</Label>
                        <TextInput
                            type="text"
                            id="amenityTitle"
                            name="amenityTitle"
                            value={formData.amenityTitle}
                            readOnly
                        />
                    </div>

                    <div>
                        <Label htmlFor="residentUsername">Resident Username:</Label>
                        <TextInput
                            type="text"
                            id="residentUsername"
                            name="residentUsername"
                            value={formData.residentUsername}
                            readOnly
                        />
                    </div>

                    <div>
                        <Label htmlFor="residentName">Resident Name:</Label>
                        <TextInput
                          type="text"
                          id="residentName"
                          name="residentName"
                          value={formData.residentName}
                          onChange={handleChange}
                          maxLength={80}
                          pattern="^[A-Za-z\s]*$"
                          title="Only letters and spaces allowed"
                        />
                    </div>

                    <div>
                        <Label htmlFor="residentEmail">Resident Email:</Label>
                        <TextInput
                          type="email"
                          id="residentEmail"
                          name="residentEmail"
                          value={formData.residentEmail}
                          onChange={handleChange}
                          maxLength={120}
                        />
                    </div>

                    <div>
                        <Label htmlFor="residentContact">Resident Contact:</Label>
                        <TextInput
                          type="text"
                          id="residentContact"
                          name="residentContact"
                          value={formData.residentContact}
                          onChange={handleChange}
                          inputMode="numeric"
                          pattern="^[0-9]{7,15}$"
                          maxLength={15}
                          title="Enter 7 to 15 digits"
                        />
                    </div>

                    <div>
                        <Label htmlFor="Date">Date:</Label>
                        <TextInput
                            type="date"
                            id="date"
                            name="bookingDate"
                            min={new Date().toISOString().split('T')[0]}
                            value={formData.bookingDate}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <Label htmlFor="Time">Time:</Label>
                        <TextInput
                            type="time"
                            id="time"
                            name="bookingTime"
                            value={formData.bookingTime}
                            onChange={handleChange}
                        />
                    </div>
                    
                    <div>
                        <Label htmlFor="duration">Duration:</Label>
                        <TextInput
                          type="number"
                          id="duration"
                          name="duration"
                          value={formData.duration}
                          onChange={handleChange}
                          min={1}
                          step={1}
                          disabled={durationDisabled}
                        />
                        <Button onClick={calculateTotalPrice} gradientDuoTone={"purpleToBlue"} disabled={calculateDisabled}>
                            Calculate Total Price
                        </Button>
                    </div>

                    <div>
                        <Label htmlFor="bookingPrice">Total Price:</Label>
                        <TextInput
                            type="text"
                            id="bookingPrice"
                            name="bookingPrice"
                            value={formData.bookingPrice}
                            disabled
                        />
                    </div>
                    <div>
                        <Label htmlFor="priceDifference">Amount Need to Paid:</Label>
                        <TextInput
                            type="text"
                            id="priceDifference"
                            name="priceDifference"
                            value={formData.priceDifference || 0} 
                            readOnly
                        />
                    </div>

                    <div>
                        <Label htmlFor="specialRequests">Special Requests:</Label>
                        <Textarea
                          id="specialRequests"
                          name="specialRequests"
                          value={formData.specialRequests}
                          onChange={handleChange}
                          maxLength={1000}
                        />
                    </div>

                    <div className="flex flex-col gap-4 flex-1">
                        <p className="font-semibold">Paymennt Images: <span className="font-normal text-gray-600 ml-2">2 Photos Max</span></p>
                        <div className="flex gap-4">
                          <FileInput
                            onChange={(e) => setFiles(e.target.files)}
                            type="file"
                            id="image"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            className="w-full"
                          />
                          <button onClick={handleImageSubmit} type="button" disabled={uploading} className="p-1 text-red-700 border border-red-700 rounded uppercase hover:shadow-lg disabled:opacity-80">{uploading ? 'Uploading...' : 'Upload'}</button>
                        </div>
                        <p className="text-red-700">{imageUploadError && imageUploadError}</p>
                        {
                          formData.imageUrls.length > 0 && formData.imageUrls.map((url, index) => (
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
                    >{loading ? "Updating Booking..." : "Update Booking"}</Button>
                        {error && <Alert className='mt-7 py-3 bg-gradient-to-r from-red-100 via-red-300 to-red-400 shadow-shadowOne text-center text-red-600 text-base tracking-wide animate-bounce'>{error}</Alert>}
                    </div>
                </form>    
            </div>
        </div>
    );
};

export default BookingUpdate_05;



