import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "firebase/storage"
import { app } from "../../firebase"

import {
  Button,
  Label,
  TextInput,
  Textarea,
  Alert,
  FileInput,
  Select,
} from "flowbite-react";



// --- Security helpers (client-side) ---
const MAX_IMAGES = 2; // UI says 2 Images Max
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

// Format "H:MM" or "HH:MM" -> "HH:MM"
const toHHMM = (t) => {
  if (typeof t !== "string" || !t.includes(":")) return "";
  const [h, m] = t.split(":");
  return `${String(parseInt(h, 10)).padStart(2, "0")}:${String(parseInt(m, 10)).padStart(2, "0")}`;
};

const convertTimeRangeToArray = (timeRange) => {
  if (typeof timeRange !== "string") return [];
  const m = timeRange.match(/^\s*(\d{1,2}):([0-5]\d)\s*-\s*(\d{1,2}):([0-5]\d)\s*$/);
  if (!m) return [];
  const startHour = String(parseInt(m[1], 10));
  const endHour = String(parseInt(m[3], 10));
  return [startHour, endHour];
};

const BookAmenity = () => {
  const { amenityId } = useParams();
  const { currentUser } = useSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const [imageUploadError, setImageUploadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([])
  const [availableTimes, setAvailableTimes] = useState([]);
  const [timeslots, setTimeslots] = useState([]);
  const [bookedTimes, setBookedTimes] = useState([]);
  

  const generateBookingId = () => `BID-${Math.floor(10000 + Math.random() * 90000)}`;


  const [formData, setFormData] = useState({
    bookingDate: "",
    bookingTime: "",
    duration: "",
    amenityId: "",
    amenityTitle: "",
    residentUsername: "",
    residentName: "",
    residentEmail: "",
    residentContact: "",
    specialRequests: "",
    bookingID: generateBookingId(),
    bookingStatus: "",
    pricePerHour: 0,
    bookingPrice: 0,
    imageUrls: [],
  });

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
      imageUrls: formData.imageUrls.filter((_, i) => i !== index),
    })
 }

 useEffect(() => {
  const fetchAmenityDetails = async () => {
    try {
      const res = await fetch(`/api/amenitiesListing/get/${amenityId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success === false) {
        // swallow error for UI; optionally show a toast
        return;
      }

      setFormData((prevData) => ({
        ...prevData,
        amenityId: data.amenityID,
        amenityTitle: data.amenityTitle,
        residentUsername: currentUser.username,
        residentEmail: currentUser.email,
        pricePerHour: data.amenityPrice,
      }));

      const times = convertTimeRangeToArray(data.amenityAvailableTimes);
      setAvailableTimes(times);
      if (times.length === 2) {  // Ensure times are available before setting time slots
        setTimeslots(generateTimeSlots(times));
      }

      const bookedTimes = convertTimeRangeToArray(data.bookingTimes);
      setBookedTimes(bookedTimes);
      // swallow log
    } catch (error) {
      // swallow error for UI; optionally show a toast
    }
  };

    fetchAmenityDetails();
  }, [amenityId, currentUser]);


  const calculateTotalPrice = () => {
    if (formData.duration && formData.pricePerHour) {
      const total = formData.duration * formData.pricePerHour;
      setFormData((prevData) => ({
        ...prevData,
        bookingPrice: total,
      }));
    }
  };


  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let processedValue = sanitize(value);

    // booleans
    if (processedValue === "true" || processedValue === "false") {
      processedValue = processedValue === "true";
    }

    // numeric constraints
    if (type === "number") {
      processedValue = clampNumber(processedValue, 0);
    }

    // per-field rules
    if (name === "residentName") {
      processedValue = processedValue.replace(/[^A-Za-z\s]/g, "");
    } else if (name === "residentContact") {
      processedValue = processedValue.replace(/[^0-9]/g, "");
    } else if (name === "specialRequests") {
      // limit length client-side
      processedValue = processedValue.slice(0, 1000);
    }

    setFormData((prevState) => ({
      ...prevState,
      [name]: processedValue,
    }));
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.imageUrls.length < 1)
        return setError("Please upload at least one image");
      setLoading(true);
      setError(false);

      const payload = {
        bookingDate: formData.bookingDate,
        bookingTime: formData.bookingTime,
        duration: clampNumber(formData.duration, 0),
        amenityId: sanitize(formData.amenityId).trim(),
        amenityTitle: sanitize(formData.amenityTitle).trim(),
        residentUsername: sanitize(formData.residentUsername).trim(),
        residentName: sanitize(formData.residentName).trim(),
        residentEmail: sanitize(formData.residentEmail).trim(),
        residentContact: sanitize(formData.residentContact).trim(),
        specialRequests: sanitize(formData.specialRequests).trim(),
        bookingID: sanitize(formData.bookingID).trim(),
        pricePerHour: clampNumber(formData.pricePerHour, 0),
        bookingPrice: clampNumber(formData.bookingPrice, 0),
        imageUrls: (formData.imageUrls || []).filter(isSafeUrl),
        userRef: currentUser._id,
      };

      const start = toHHMM(formData.bookingTime);
      const end = calculateFinishTime(start, Number(formData.duration));
      const bookingTimeRange = start && end ? `${start}-${end}` : "";

      if (!start || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        setLoading(false);
        return setError("Invalid start or end time (HH:MM expected).");
      }
      if (!formData.bookingDate) {
        setLoading(false);
        return setError("Please select a booking date.");
      }
      if (!formData.duration || Number(formData.duration) <= 0) {
        setLoading(false);
        return setError("Please enter a valid duration (in hours).");
      }
      if (!formData.bookingTime) {
        setLoading(false);
        return setError("Please select a booking start time.");
      }

      const response = await fetch('/api/amenitiesBooking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          bookingTime: bookingTimeRange, // legacy string
          startTime: start,
          endTime: end,
        }),
      });
      const data = await response.json();
      setLoading(false);
      if (data.success === false) {
        return setError(data.message);
      }

      navigate('/dashboard?tab=bookings');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Robust finish time calculator: wraps within the day, always returns HH:MM
  const calculateFinishTime = (startTime, duration) => {
    if (typeof startTime !== "string" || !startTime.includes(":")) return "";
    const [h, m] = startTime.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return "";
    const startMinutes = h * 60 + m;
    const addMinutes = Math.max(0, Math.floor(Number(duration) * 60));
    const total = (startMinutes + addMinutes) % (24 * 60);
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  };


  function generateTimeSlots(times) {
    var timeslots = [];
    var startTime = new Date();
    startTime.setHours(parseInt(times[0]), 0, 0, 0);  // Use parsed time for start
    var endTime = new Date();
    endTime.setHours(parseInt(times[1]), 0, 0, 0);    // Use parsed time for end

    var currentTime = new Date(startTime);

    while (currentTime <= endTime) {
        var timeSlotsStart = new Date(currentTime);

        // Formatting to always use 2-digit hour for consistency
        timeslots.push({
            start: timeSlotsStart.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                hourCycle: 'h23'
            }),
        });
        currentTime.setTime(currentTime.getTime() + 60 * 60000);
    }
    return timeslots;
}


  return (
    <div className="min-h-screen mt-20">
      <h1 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Book Amenity</h1>
      <div className="flex p-3 w-[40%] mx-auto flex-col md:flex-row md:items-center gap-20 md:gap-20 mt-10">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full justify-center">
          <div>
            <Label htmlFor="bookingId">Booking ID:</Label>
            <TextInput
              type="text"
              id="bookingId"
              name="bookingID"
              value={formData.bookingID}
              disabled 
            />
          </div>

          <div>
            <Label htmlFor="amenityID">Amenity ID:</Label>
            <TextInput
              type="text"
              id="amenityID"
              name="amenityNum"
              value={formData.amenityId}
              readOnly
            />
          </div>

          <div>
            <Label htmlFor="amenityTitle" >Amenity Title:</Label>
            <TextInput
              type="text"
              id="amenityTitle"
              name="amenityTitle"
              value={formData.amenityTitle}
              readOnly
              
            />
          </div>

          <div>
            <Label htmlFor="residentUsername" >Resident Username</Label>
            <TextInput
              type="text"
              id="residentUsername"
              name="username"
              value={formData.residentUsername}
              readOnly
            />

          </div>
          <div>
            <Label htmlFor="name" >Resident Name:</Label>
            <TextInput
              type="text"
              id="residentName"
              name="residentName"
              required
              onChange={handleChange}
              maxLength={80}
              pattern="^[A-Za-z\s]*$"
              title="Only letters and spaces allowed"
            />
          </div>

          <div>
            <Label htmlFor="residentEmail" >Resident Email</Label>
            <TextInput
              type="email"
              name="residentEmail"
              value={formData.residentEmail}
              onChange={handleChange}
              maxLength={120}
            />  
          </div>

          <div>
            <Label htmlFor="contact" >Resident Contact:</Label>
            <TextInput
              type="text"
              id="residentContact"
              name="residentContact"
              required
              onChange={handleChange}
              inputMode="numeric"
              pattern="^[0-9]{7,15}$"
              maxLength={15}
              title="Enter 7 to 15 digits"
            />
          </div>

          <div>
            <Label htmlFor="date" >Date:</Label>
            <TextInput
              type="date"
              id="eventDate"
              min={new Date().toISOString().split('T')[0]}
              name="bookingDate"
              required
              onChange={handleChange}
            />
          </div>

          {/* <div>
            <Label htmlFor="time" >Time:</Label>
            <TextInput
              type="time"
              id="eventTime"
              name="bookingTime"
              min={availableTimes[0]}
              max={availableTimes[1]}
              required
              onChange={handleChange}
            />   
          </div> */}

          <div>
          <Label htmlFor="duration" >Duration (Hours):</Label>
            <TextInput
              type="number"
              id="duration"
              name="duration"
              required
              onChange={handleChange}
              min={1}
              step={1}
            />
          </div>
          
          <div>
          <Label htmlFor="time" className="bloack mb-1">Booking Time</Label>
            <Select
              name="bookingTime"
              id="eventTime"
              required
              value={formData.bookingTime}
              onChange={handleChange}
              className="w-full p-1"
              defaultValue=""
            >
              <option value="" disabled>
                Select a start time
              </option>
              {timeslots.map((timeslot, index) => {
                const hasDuration = Number(formData.duration) > 0;
                const label = hasDuration
                  ? `${timeslot.start} - ${calculateFinishTime(timeslot.start, Number(formData.duration))}`
                  : `${timeslot.start}`;
                return (
                  <option key={index} value={timeslot.start}>
                    {label}
                  </option>
                );
              })}
            </Select>
            <Button onClick={calculateTotalPrice} gradientDuoTone={"purpleToBlue"}>
            Calculate Total Price
          </Button>  
          </div>

          <div>
            <Label htmlFor="totalPrice" >Total Price:</Label>
            <TextInput
              type="text"
              id="totalPrice"
              name="totalPrice"
              value={`LKR ${formData.bookingPrice.toFixed(2)}`}
              onChange={handleChange}
              disabled
            />
          </div>

          <div>
            <Label htmlFor="specialRequests" >Special Requests:</Label>
            <Textarea
              id="specialRequests"
              name="specialRequests"
              onChange={handleChange}
              maxLength={1000}
            />
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <p className="font-semibold">Payment Image: <span className="font-normal text-gray-600 ml-2">2 Images Max</span></p>
            <div className="flex gap-4">
                <FileInput onChange={(e) => setFiles(e.target.files)} type='file' id="image" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="w-full" />
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

         </div>

          <div className="flex flex-col gap-4 flex-1">
            <Button 
            type="submit"
            gradientDuoTone="purpleToBlue"
            className="uppercase"
            >{loading ? "Booking Amenity" : "Book Amenity"}</Button> 
              {error && <Alert className='mt-7 py-3 bg-gradient-to-r from-red-100 via-red-300 to-red-400 shadow-shadowOne text-center text-red-600 text-base tracking-wide animate-bounce'>{error}</Alert>}
          </div>  
        </form>
      </div>  
    </div>
  );
};

export default BookAmenity;

