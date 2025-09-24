import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FaLocationDot } from "react-icons/fa6";
import { IoIosPeople } from "react-icons/io";
import { MdEventAvailable } from "react-icons/md";
import { IoIosPricetag } from "react-icons/io";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';


// Helper: validate image URLs to prevent DOM-based XSS
const toSafeImageUrl = (rawUrl) => {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    // quick reject for control characters or whitespace which may be abused
    if (/\s/.test(rawUrl) || /[\u0000-\u001F\u007F]/.test(rawUrl)) return null;

    // Allow same-origin relative paths (e.g. /uploads/foo.jpg)
    if (rawUrl.startsWith('/')) return rawUrl;

    // Must be an absolute URL
    const url = new URL(rawUrl);

    // Disallow credentials in URL
    if (url.username || url.password) return null;

    // Only allow http(s)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    // whitelist hostnames (add your trusted hosts here)
    const ALLOWED_HOSTS = [
      'res.cloudinary.com',
      'firebasestorage.googleapis.com',  // allow Firebase storage
      'images.example.com',
      'cdn.example.com',
      window.location.hostname
    ];

    const hostnameIsAllowed = ALLOWED_HOSTS.some((host) => {
      return url.hostname === host || url.hostname.endsWith('.' + host);
    });

    if (!hostnameIsAllowed) return null;

    // normalize and return safe href
    return url.href;
  } catch (e) {
    return null;
  }
};

// Build a sanitized amenity object for safe rendering
const sanitizeAmenityForRender = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const safe = { ...raw };
  // sanitize textual fields by ensuring they are strings (React escapes text automatically)
  safe.amenityTitle = typeof raw.amenityTitle === 'string' ? raw.amenityTitle : '';
  safe.amenityDescription = typeof raw.amenityDescription === 'string' ? raw.amenityDescription : '';
  safe.amenityLocation = typeof raw.amenityLocation === 'string' ? raw.amenityLocation : '';
  safe.amenityAvailableTimes = typeof raw.amenityAvailableTimes === 'string' ? raw.amenityAvailableTimes : '';
  safe.amenityCapacity = raw.amenityCapacity ?? '';
  safe.amenityPrice = raw.amenityPrice ?? '';

  // sanitize imageURLs into a safe array
  const rawImgs = Array.isArray(raw.imageURLs) ? raw.imageURLs : [];
  const safeImgs = rawImgs.map((u) => toSafeImageUrl(u)).filter(Boolean);
  safe.imageURLs = safeImgs;
  return safe;
};

const AmenityDetails = () => {
  const { amenityId } = useParams();
  const [amenity, setAmenity] = useState(null);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    const fetchAmenityDetails = async () => {
      try {
        const res = await fetch(`/api/amenitiesListing/get/${amenityId}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success === false) {
          console.error("Error fetching amenity details");
          return;
        }
        // sanitize before rendering to avoid DOM-based XSS vectors
        const safe = sanitizeAmenityForRender(data);
        setAmenity(safe);
      } catch (error) {
        console.error("Error fetching amenity details", error);
      }
    };

    fetchAmenityDetails();
  }, [amenityId]);

  if (!amenity) {
    return <p className="text-center mt-8 text-gray-600">Loading...</p>;
  }

  // Validate image URLs before rendering
  const backgroundImage = (amenity.imageURLs && toSafeImageUrl(amenity.imageURLs[0])) || null;
  const mainImage = (amenity.imageURLs && toSafeImageUrl(amenity.imageURLs[1])) || null;

  const onChange = (selectedDate) => {
    setDate(selectedDate);
  };

  return (
    <div className="font-sans">
      <div className="pl-4 pt-0">
        <Link
          to={"/amenity-User:amenityID"}
          className="text-black-500 font-semibold hover:underline"
          style={{ display: "block", paddingTop: "1px" }}
        >
          ← Amenity
        </Link>
      </div> 
      
      <div className="max-w-5xl mx-auto px-1 py-0">
        
          <div className="max-w-5xl mx-auto px-1 py-8 flex flex-col items-start justify-center">
            {/* Transparent Image Overlay */}
            {backgroundImage ? (
              <img
                src={backgroundImage}
                alt="Transparent Image"
                className="absolute inset-0 w-full opacity-10"
                style={{ pointerEvents: "none", zIndex: -1 }}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 w-full opacity-10 bg-gray-100" style={{ pointerEvents: "none", zIndex: -1 }} />
            )}
      
            <div className="max-w-5xl mx-auto px-1 py-0 flex items-center">
              <div>
                <div className="flex items-center justify-center gap-2">
                  <h1 className="text-5xl font-semibold text-gray-800 mb-4 dark:text-white">
                    {amenity.amenityTitle}
                  </h1>
                </div>

                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={amenity.amenityTitle || 'Amenity image'}
                    className="w-full h-80 object-cover rounded-md mb-6"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-80 bg-gray-200 rounded-md mb-6 flex items-center justify-center text-gray-500">
                    Image unavailable
                  </div>
                )}
                
                <div className="border border-gray-300 p-5 rounded-md shadow-md mt-5 relative">
                  <p className="text-lg text-gray-600 mb-6 dark:text-white text-center" >{amenity.amenityDescription}</p>
                </div>
                <div className="grid grid-cols-2 pt-5">
                  <div className="pt-4">
                    <div className="bg-white border border-gray-200 rounded-md p-6" >
                      <h2 className="text-xl font-semibold text-gray-800 mb-2">Other Details</h2>
                      
                      <p className="text-gray-600 flex items-center mb-4">
                        <FaLocationDot className="mr-2" size={20} />
                        Location : {amenity.amenityLocation}
                      </p>

                      <p className="text-gray-600 flex item-center mb-4">
                        <IoIosPeople className="mr-1" size={23}/>
                        Capacity : {amenity.amenityCapacity}
                      </p>

                      <p className="text-gray-600 flex items-center mb-4"> 
                        <MdEventAvailable className="mr-2" size={23}/>
                        Availability : {amenity.amenityAvailableTimes}
                      </p>

                      <p className="text-gray-600 flex items-center">
                      <IoIosPricetag className="mr-2" size={23}/>
                        Price: LKR {amenity.amenityPrice}
                      </p>
                    </div>
                    </div> 
                    <div className="pl-20 ">
                      <div>
                        <div>
                          <div>
                            <Calendar onChange={onChange} value={date} />
                          </div>
                          <div style={{ visibility: "hidden" }}> 
                          {date.toLocaleDateString()}
                          </div>
                        </div>
                        <div className="mt-3 flex justify-right pl-32">
                          <Link
                            to={`/book-amenity/${amenityId}`}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-md hover:bg-blue-600 transition duration-300"
                          >
                            Book Now
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  ); 
}; 

export default AmenityDetails;