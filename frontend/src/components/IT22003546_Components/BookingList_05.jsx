import { useEffect, useState } from "react";

// PaymentImage component for safe fallback SVG rendering
const PaymentImage = ({ safeUrl, alt }) => {
  const [errored, setErrored] = useState(false);
  if (!safeUrl) return null;
  if (errored) {
    return (
      <div title="Image failed to load" style={{ width: '100px', height: '100px' }} className="flex items-center justify-center bg-gray-100 text-gray-400 rounded">
        {/* simple image placeholder icon */}
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <path d="M21 15l-5-5L5 21"></path>
        </svg>
      </div>
    );
  }
  return (
    <img
      src={safeUrl}
      alt={alt}
      style={{ maxWidth: '100px', maxHeight: '100px' }}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onError={() => setErrored(true)}
    />
  );
};
import { useSelector, useDispatch } from "react-redux";
import { Table, Button, TextInput} from "flowbite-react";
import { Link } from "react-router-dom";
import jsPDF from 'jspdf';
import "jspdf-autotable";

const getSafeImageUrl = (rawUrl) => {
  try {
    const s = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!s) return '';

    // Reject control chars or whitespace (can be abused in some browsers)
    if (/\s/.test(s) || /[\u0000-\u001F\u007F]/.test(s)) return '';

    // Allow same-origin relative paths (e.g., /uploads/a.jpg)
    if (s.startsWith('/')) return s;

    // Allow safe data URLs only for images (small payment proofs, etc.)
    if (/^data:/i.test(s)) {
      return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(s) ? s : '';
    }

    // Must be absolute URL; resolve with current origin as fallback base
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(s, base);

    // Disallow embedded credentials
    if (url.username || url.password) return '';

    // Only http/https
    if (!(url.protocol === 'http:' || url.protocol === 'https:')) return '';

    // Whitelist trusted hosts (add yours as needed)
    const ALLOWED_HOSTS = [
        'firebasestorage.googleapis.com',
        'res.cloudinary.com',
        'images.example.com',
        'cdn.example.com',
        'localhost',             // allow local dev
        '127.0.0.1'              // allow explicit local IP
    ];

    const okHost = ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith('.' + host));
    if (!okHost) return '';

    return url.href;
  } catch (e) {
    return '';
  }
};



const BookingList_05 = () => {
    const { currentUser } = useSelector((state) => state.user);
    const [showBookingError, setShowBookingError] = useState(false);
    const [showBooking, setShowBooking] = useState([]);
    const [searchInput, setSearchInput] = useState("");
    const [showConfirmOnly, setshowConfirmOnly] = useState(false);
    const [showPendingOnly, setshowPendingOnly] = useState(false);
    const [startDate, setStartDate] = useState(""); 
    const [endDate, setEndDate] = useState(""); 

    useEffect(() => {
        
        handleShowBooking();
    }, []);
    
    const handleShowBooking = async () => {
        try {
            const res = await fetch("/api/amenitiesBooking/getAll");
            const data = await res.json();
            if (data.success === false) {
                setShowBookingError(true);
                return;
            }
            setShowBooking(data);
        } catch (error) {
            setShowBookingError(true);
        }
    }

    const filteredBookings = showBooking.filter((booking) => {
        const bookingDate = new Date(booking.bookingDate);
        return (
            (
                booking.amenityTitle.toLowerCase().includes(searchInput.toLowerCase()) ||
                booking.residentName.toLowerCase().includes(searchInput.toLowerCase()) ||
                booking.residentEmail.toLowerCase().includes(searchInput.toLowerCase())
            ) &&
            (
                !startDate || !endDate || (bookingDate >= new Date(startDate) && bookingDate <= new Date(endDate))
            ) &&
            (
                (!showConfirmOnly || booking.bookingStatus === 'Confirmed') &&
                (!showPendingOnly || booking.bookingStatus === 'Pending')
            )    
        );
    });

    const handleChange = (e) => {
        console.log("Search query:", e.target.value);
        setSearchInput(e.target.value);
    };

    const handleToggleConfirmOnly = () => {
        setshowConfirmOnly(!showConfirmOnly);
    };

    const handleTogglePendingOnly = () => {
        setshowPendingOnly(!showPendingOnly);
    };

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
    };

    console.log("Table bookings:", filteredBookings);
    console.log("Filtered bookings:", filteredBookings);

    const handleBookingDelete = async (_id) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this booking?");
        if (!confirmDelete) {
            return; 
        }
        try {
            const res = await fetch(`/api/amenitiesBooking/delete/${_id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success === false) {
                console.log(data.message);
                return;
            }
            setShowBooking((prev) => prev.filter((booking) => booking._id !== _id));
        } catch (error) {
            console.log(error.message);
        }
    }
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric', 
          month: 'short',
          day: 'numeric',
        });
      };
    
      const sortedBookings = filteredBookings.sort((a, b) => {
        // Convert booking dates to Date objects
        const dateA = new Date(a.bookingDate);
        const dateB = new Date(b.bookingDate);
      
        // Compare dates
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
      
        // If dates are equal, compare times
        const timeA = a.bookingTime.split(':').map(num => parseInt(num));
        const timeB = b.bookingTime.split(':').map(num => parseInt(num));
      
        // Compare hours
        if (timeA[0] < timeB[0]) return -1;
        if (timeA[0] > timeB[0]) return 1;
      
        // If hours are equal, compare minutes
        if (timeA[1] < timeB[1]) return -1;
        if (timeA[1] > timeB[1]) return 1;
      
        // If both dates and times are equal, bookings are equal
        return 0;
      });
    


    const handleDownloadPDF = () => {
        const bookingPDF = new jsPDF('l');
        const tableColumn = ["Booking ID", "Amenity Title", "Resident Name", "Resident Email", "Resident Contact", "Date", "Time", "Duration", "Total Amount", "Status"];
        const tableRows = [];

       showBooking.forEach(booking => {

        const bookingDate = new Date(booking.bookingDate);
    
        const year = bookingDate.getFullYear();
        const m = bookingDate.getMonth() + 1; 
        const date = bookingDate.getDate();
        
        const formattedDate = `${year}-${m.toString().padStart(2, '0')}-${date.toString().padStart(2, '0')}`;

        const rowData = [
            booking.bookingID,
            booking.amenityTitle,
            booking.residentName,
            booking.residentEmail,
            booking.residentContact,
            formattedDate,
            booking.bookingTime,
            booking.duration,
            booking.bookingPrice,
            booking.bookingStatus,
        ];
        tableRows.push(rowData);
        });

        const d = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const month = monthNames[d.getMonth()];

        const logo = "/cleansyBG.png"

        const imgHeight = 120;
        const imgWidth = 160;

        const centerX = (bookingPDF.internal.pageSize.getWidth() - imgWidth / 0.7);
        const centerY = (bookingPDF.internal.pageSize.getHeight() - imgHeight / 0.8);

        const addWaterMark = () => {
            bookingPDF.addImage(logo, 'PNG', centerX, centerY, imgWidth, imgHeight);
        }
        bookingPDF.autoTable({
            startY: 30,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            startY: 40, addPageContent: addWaterMark,
            didDrawCell: (data) => {
                bookingPDF.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
            }
        });
    
        bookingPDF.text(`Cleansy Facility Management Services (Pvt) Ltd \nBooking List`, 14, 15);
        bookingPDF.save(`Booking_List_${month}.pdf`);
    }

    const handleStatusChange = async (_id, newStatus) => {
        try {
            const res = await fetch(`/api/amenitiesBooking/update/${_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bookingStatus: newStatus }),
            });
            const data = await res.json();
            if (data.success === false) {
                console.log(data.message);
                return;
            }
            setShowBooking((prev) =>
                prev.map((booking) =>
                    booking._id === _id ? { ...booking, bookingStatus: newStatus } : booking
                )
            );
        } catch (error) {
            console.log(error.message);
        }
    };
    

    return (
        <div className="w-full table-auto overflow-x-scroll md:mx-auto p-3 scrollbar scrollbar-track-slate-100 scrollbar-thumb-slate-300 dark:scrollbar-track-slate-700 dark:scrollbar-thumb-slate-500">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4 text-center dark:text-white">Booking List</h1>    
            {currentUser.isBookingAdmin ? (
                <>
                    <div className="flex gap-4 mb-4">
                    <TextInput
                            type="text"
                            placeholder="Search..."
                            value={searchInput}
                            onChange= {handleChange}
                        />
                        <Button onClick={handleToggleConfirmOnly} className={showConfirmOnly ? 'bg-green-500 text-white' : 'bg-gray-200'}>
                            Confirmed Bookings
                        </Button>
                        <Button onClick={handleTogglePendingOnly} className={showPendingOnly ? 'bg-red-500 text-white' : 'bg-gray-200'}>
                            Pending Bookings
                        </Button>

                        
                        <label className="block text-sm font-semibold text-gray-700 dark:text-white pt-3">Start Date</label>
                        <input 
                        type="date" 
                        value={startDate} 
                        onChange={handleStartDateChange}
                        className="appearance-none block w-56 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />

                        
                        <label className="block text-sm font-semibold text-gray-700 dark:text-white pt-3">End Date</label>
                        <input 
                        type="date" 
                        value={endDate} 
                        onChange={handleEndDateChange} 
                        className="appearance-none block w-56 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />

                    </div>
                    {filteredBookings.length > 0 ? (
                    <Table hoverable className="shadow-md">
                        <Table.Head>
                            <Table.HeadCell>Booking ID</Table.HeadCell>
                            <Table.HeadCell>Amenity Title</Table.HeadCell>
                            <Table.HeadCell>Resident Name</Table.HeadCell>
                            <Table.HeadCell>Resident Email</Table.HeadCell>
                            <Table.HeadCell>Date</Table.HeadCell>
                            <Table.HeadCell>Time</Table.HeadCell>
                            <Table.HeadCell>Duration</Table.HeadCell>
                            <Table.HeadCell>Total Amount</Table.HeadCell>
                            <Table.HeadCell>Status</Table.HeadCell>
                            <Table.HeadCell>Update Status</Table.HeadCell>
                            <Table.HeadCell>Payment Image</Table.HeadCell>
                        </Table.Head>
                        {sortedBookings.map((booking) => (
                            <Table.Body key={booking._id} className="divide-y">
                                <Table.Row className={`bg-white dark:border-gray-700 dark:bg-gray-800 ${booking.bookingStatus === 'Confirmed' ? 'text-green-500' : booking.bookingStatus === 'Pending' ? 'text-red-600' : ''}`}>
                                    <Table.Cell>{booking.bookingID}</Table.Cell>
                                    <Table.Cell>{booking.amenityTitle}</Table.Cell>
                                    <Table.Cell>{booking.residentName}</Table.Cell>
                                    <Table.Cell>{booking.residentEmail}</Table.Cell>
                                    <Table.Cell style={{ whiteSpace: 'nowrap' }}>{formatDate(booking.bookingDate)}</Table.Cell>
                                    <Table.Cell>{booking.bookingTime}</Table.Cell>
                                    <Table.Cell>{booking.duration}</Table.Cell>
                                    <Table.Cell>{booking.bookingPrice}</Table.Cell>
                                    <Table.Cell className="py-2">
                                        <div className={`w-20 h-5 rounded-md text-center ${booking.bookingStatus === 'Confirmed' ? 'bg-green-500 text-white' : booking.bookingStatus === 'Pending' ? 'bg-red-700 text-white' : ''}`}>
                                            {booking.bookingStatus}
                                        </div>
                                    </Table.Cell>

                                    <Table.Cell className="py-2">
                                        <select 
                                            value={booking.bookingStatus} 
                                            onChange={(e) => handleStatusChange(booking._id, e.target.value)}
                                            className="block w-full mt-1 py-2 px-3 border border-gray-300 bg-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Confirmed">Confirmed</option>
                                        </select>
                                    </Table.Cell>
                                    
                                    <Table.Cell>
                                        {(Array.isArray(booking.imageUrls) ? booking.imageUrls : []).map((imageUrl, index) => {
                                            const safeUrl = getSafeImageUrl(imageUrl);
                                            if (!safeUrl) return null;
                                            return (
                                              <a key={index} href={safeUrl} target="_blank" rel="noopener noreferrer">
                                                <PaymentImage safeUrl={safeUrl} alt={`Payment image ${index + 1}`} />
                                              </a>
                                            );
                                        })}
                                        {(!Array.isArray(booking.imageUrls) || booking.imageUrls.length === 0) && (
                                          <div title="No image" style={{ width: '100px', height: '100px' }} className="flex items-center justify-center bg-gray-100 text-gray-400 rounded">
                                            {/* simple image placeholder icon */}
                                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                              <path d="M21 15l-5-5L5 21"></path>
                                            </svg>
                                          </div>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span onClick={() => handleBookingDelete(booking._id)} 
                                        className="font-medium text-red-500 hover:underline cursor-pointer">Delete</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Link
                                            className="text-teal-500 hover:underline"
                                            to = {`/update-booking/${booking._id}`}>
                                                <span>Update</span>
                                            </Link>
                                    </Table.Cell>
                                </Table.Row>
                            </Table.Body>
                        ))}
                    </Table>
                    ) : (
                        <p className="text-gray-500 text-center">No matching amenities found.</p>
                    )}
                    <br />
                    <Button onClick={handleDownloadPDF}>Download PDF</Button>

                    <p className="text-red-700 mt-5">
                        {showBookingError ? "Error fetching amenity" : ""}
                    </p>

                    {showBooking &&
                        showBooking.length === 0 && 
                        showBooking.map((booking) => (
                            <Link
                                key={booking._id}
                                className="text-slate-700 font-semiblod hover:underline truncate flex-1"
                                to={`/update-booking/${booking._id}`}
                            ></Link>    
                           
                        ))}
                </>
            ) : (
                <>
                {/* Resident view */}
                <div className="flex gap-4 mb-4">
                    <TextInput
                        type="text"
                        placeholder="Search..."
                        value={searchInput}
                        onChange= {handleChange}
                    />
                    <Button onClick={handleToggleConfirmOnly} className={showConfirmOnly ? 'bg-green-500 text-white' : 'bg-gray-200'}>
                        Confirmed Bookings
                    </Button>
                    <Button onClick={handleTogglePendingOnly} className={showPendingOnly ? 'bg-red-500 text-white' : 'bg-gray-200'}>
                        Pending Bookings
                    </Button>
                    
                    <label className="block text-sm font-semibold text-gray-700 dark:text-white pt-3">Start Date</label>
                    <input 
                    type="date" 
                    value={startDate} 
                    onChange={handleStartDateChange}
                    className="appearance-none block w-56 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />

                    <label className="block text-sm font-semibold text-gray-700 dark:text-white pt-3">End Date</label>
                    <input 
                    type="date" 
                    value={endDate} 
                    onChange={handleEndDateChange} 
                    className="appearance-none block w-56 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                {filteredBookings.length > 0 ? (
                <Table hoverable className="shadow-md">
                    <Table.Head>
                            <Table.HeadCell>Booking ID</Table.HeadCell>
                            <Table.HeadCell>Amenity Title</Table.HeadCell>
                            <Table.HeadCell>Resident Name</Table.HeadCell>
                            <Table.HeadCell>Resident Email</Table.HeadCell>
                            <Table.HeadCell>Resident Contact</Table.HeadCell>
                            <Table.HeadCell>Date</Table.HeadCell>
                            <Table.HeadCell>Time</Table.HeadCell>
                            <Table.HeadCell>Duration</Table.HeadCell>
                            <Table.HeadCell>Total Amount</Table.HeadCell>
                            <Table.HeadCell>Status</Table.HeadCell>
                            <Table.HeadCell onClick={() => handleAmenitiesDelete(booking._id)}>Delete</Table.HeadCell>
                            <Table.HeadCell>
                                <span>Upadte</span>
                            </Table.HeadCell>
                            <Table.HeadCell>Payment Image</Table.HeadCell>
                        </Table.Head>
                    {sortedBookings.filter(booking => booking.residentUsername === currentUser.username)
                        .map((booking) => (
                            <Table.Body key={booking._id} className="divide-y">
                                <Table.Row className={`bg-white dark:border-gray-700 dark:bg-gray-800 ${booking.bookingStatus === 'Confirmed' ? 'text-green-600' : booking.bookingStatus === 'Pending' ? 'text-red-600' : ''}`}>
                                <Table.Cell>{booking.bookingID}</Table.Cell>
                                    <Table.Cell>{booking.amenityTitle}</Table.Cell>
                                    <Table.Cell>{booking.residentName}</Table.Cell>
                                    <Table.Cell>{booking.residentEmail}</Table.Cell>
                                    <Table.Cell>{booking.residentContact}</Table.Cell>
                                    <Table.Cell style={{ whiteSpace: 'nowrap' }}>{formatDate(booking.bookingDate)}</Table.Cell>
                                    <Table.Cell>{booking.bookingTime}</Table.Cell>
                                    <Table.Cell>{booking.duration}</Table.Cell>
                                    <Table.Cell>{booking.bookingPrice}</Table.Cell>
                                    <Table.Cell className="py-2">
                                        <div className={`w-20 h-5 rounded-md text-center ${booking.bookingStatus === 'Confirmed' ? 'bg-green-500 text-white' : booking.bookingStatus === 'Pending' ? 'bg-red-700 text-white' : ''}`}>
                                            {booking.bookingStatus}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span onClick={() => handleBookingDelete(booking._id)} 
                                        className="font-medium text-red-500 hover:underline cursor-pointer">Delete</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Link
                                            className="text-teal-500 hover:underline"
                                            to = {`/update-booking/${booking._id}`}>
                                                <span>Update</span>
                                            </Link>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {(Array.isArray(booking.imageUrls) ? booking.imageUrls : []).map((imageUrl, index) => {
                                            const safeUrl = getSafeImageUrl(imageUrl);
                                            if (!safeUrl) return null;
                                            return (
                                              <a key={index} href={safeUrl} target="_blank" rel="noopener noreferrer">
                                                <PaymentImage safeUrl={safeUrl} alt={`Payment image ${index + 1}`} />
                                              </a>
                                            );
                                        })}
                                        {(!Array.isArray(booking.imageUrls) || booking.imageUrls.length === 0) && (
                                          <div title="No image" style={{ width: '100px', height: '100px' }} className="flex items-center justify-center bg-gray-100 text-gray-400 rounded">
                                            {/* simple image placeholder icon */}
                                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                              <path d="M21 15l-5-5L5 21"></path>
                                            </svg>
                                          </div>
                                        )}
                                    </Table.Cell>
                                </Table.Row>
                            </Table.Body>
                        ))}
                </Table>
                ) : (
                    <p className="text-gray-500 text-center">No matching amenities found.</p>
                )}
                <p className="text-red-700 mt-5">
                    {showBookingError ? "Error fetching bookings" : ""}
                </p>
                {showBooking.length === 0 && (
                    <p>No bookings found</p>
                )}
            </>
            )
            
            }
            
        </div>
    );
}

export default BookingList_05;
