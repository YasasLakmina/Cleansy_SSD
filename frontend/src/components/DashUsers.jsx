import { Button, Modal, Table } from "flowbite-react";
import { useEffect, useState } from "react"
import { useSelector } from 'react-redux';
import { FaCheck, FaTimes } from "react-icons/fa";
import { HiOutlineExclamationCircle } from "react-icons/hi";

// Strict image URL sanitizer to prevent DOM-based XSS
const getSafeImageUrl = (rawUrl) => {
  try {
    const s = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!s) return '';

    // Reject control characters or stray whitespace which may be abused
    if (/\s/.test(s) || /[\u0000-\u001F\u007F]/.test(s)) return '';

    // Allow same-origin relative paths (e.g. /uploads/foo.jpg)
    if (s.startsWith('/')) return s;

    // Allow safe data:image URLs (only for PNG/JPEG/WebP/GIF and base64 payloads)
    if (/^data:/i.test(s)) {
      return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(s) ? s : '';
    }

    // Try to parse absolute URLs
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(s, base);

    // Disallow credentials in URL
    if (url.username || url.password) return '';

    // Only allow http(s)
    if (!(url.protocol === 'http:' || url.protocol === 'https:')) return '';

    // Whitelist of trusted hosts
    const ALLOWED_HOSTS = [
      'firebasestorage.googleapis.com',
      'res.cloudinary.com',
      'images.example.com',
      'cdn.example.com',
      (typeof window !== 'undefined' ? window.location.hostname : 'localhost')
    ];

    const ok = ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith('.' + host));
    if (!ok) return '';

    return url.href;
  } catch (e) {
    return '';
  }
};

const ImagePlaceholder = ({ className = 'w-10 h-10' }) => (
  <div className={`flex items-center justify-center bg-gray-200 rounded-full ${className}`}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
      <rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <path d="M21 15l-5-5L5 21"></path>
    </svg>
  </div>
);

const DashUsers = () => {
   const { currentUser } = useSelector((state) => state.user);
   const [users, setUsers] = useState([]);
   const [showMore, setShowMore] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userIdToDelete, setUserIdToDelete] = useState('');

   useEffect(() => {
      const fetchUsers = async () => {
         try {
            const res = await fetch(`/api/user/getusers`);
            const data = await res.json();
            if(res.ok) {
               setUsers(data.users);
               if (data.users.length < 9) {
                  setShowMore(false);
               }
            }
         } catch (error) {
            console.log(error.message);
         }
      }
      if(currentUser.isAdmin) {
         fetchUsers()
      }
   }, [currentUser._id])

   const handleShowMore = async () => {
      const startIndex = users.length;
      try {
         const res = await fetch(`/api/user/getusers?startIndex=${startIndex}`);
         const data = await res.json();
         if(res.ok) {
            setUsers((prev) => [...prev, ...data.users]);
            if (data.users.length < 9) {
               setShowMore(false);
            }
         }
      } catch (error) {
         console.log(error.message);
      }
   }

   const handleDeleteUser = async () => {
      try {
         const res = await fetch(`/api/user/delete/${userIdToDelete}`, {
            method: 'DELETE'
         })
         const data = await res.json()
         if(res.ok) {
            setUsers((prev) => prev.filter((user) => user._id !== userIdToDelete))
            setShowModal(false)
         } else {
            console.log(data.message);
         }
      } catch (error) {
         console.log(error.message);
      }
   }

  return (
    <div className="w-full table-auto overflow-x-scroll md:mx-auto p-3 scrollbar scrollbar-track-slate-100 scrollbar-thumb-slate-300 dark:scrollbar-track-slate-700 dark:scrollbar-thumb-slate-500">
      {currentUser.isUserAdmin && users.length > 0 ? (
         <>
            <Table hoverable className='shadow-md'>
               <Table.Head>
                  <Table.HeadCell>Date created</Table.HeadCell>
                  <Table.HeadCell>User image</Table.HeadCell>
                  <Table.HeadCell>username</Table.HeadCell>
                  <Table.HeadCell>Email</Table.HeadCell>
                  <Table.HeadCell>Admin</Table.HeadCell>
                  <Table.HeadCell>Delete</Table.HeadCell>
               </Table.Head>
               {users.map((user) => (
                  <>
                     <Table.Body className='divide-y' key={user._id} >
                        <Table.Row className='bg-white dark:border-gray-700 dark:bg-gray-800'>
                           <Table.Cell>
                              {new Date(user.createdAt).toLocaleDateString()}
                           </Table.Cell>
                           <Table.Cell>
                              {(() => {
                                const safeImageUrl = getSafeImageUrl(user.profilePicture);
                                if (!safeImageUrl) return <ImagePlaceholder />;
                                // we use a tiny wrapper that switches to the placeholder on load error to avoid broken image icon
                                return (
                                  <img
                                    src={safeImageUrl}
                                    alt={user.username || 'User image'}
                                    className='w-10 h-10 object-cover bg-gray-500 rounded-full shadow-sm'
                                    loading='lazy'
                                    decoding='async'
                                    referrerPolicy='no-referrer'
                                    crossOrigin='anonymous'
                                    onError={(e) => {
                                      // replace the broken image with the placeholder element
                                      const parent = e.currentTarget.parentNode;
                                      if (!parent) return;
                                      const placeholder = document.createElement('div');
                                      placeholder.setAttribute('class', 'flex items-center justify-center bg-gray-200 rounded-full w-10 h-10');
                                      placeholder.innerHTML = `\n          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">\n            <rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect>\n            <circle cx="8.5" cy="8.5" r="1.5"></circle>\n            <path d="M21 15l-5-5L5 21"></path>\n          </svg>`;
                                      parent.replaceChild(placeholder, e.currentTarget);
                                    }}
                                  />
                                );
                              })()}
                           </Table.Cell>
                           <Table.Cell>
                              {user.username}
                           </Table.Cell>
                           <Table.Cell>
                              {user.email}
                           </Table.Cell>
                           <Table.Cell>
                              {user.isAdmin ? (<FaCheck className='text-green-500 mx-4'/>) : (<FaTimes className='text-red-500 mx-4'/>)}
                           </Table.Cell>
                           <Table.Cell>
                              <span className='font-medium text-red-500 hover:underline cursor-pointer' onClick={() => {
                                 setShowModal(true);
                                 setUserIdToDelete(user._id);
                              }}>
                                 Delete
                              </span>
                           </Table.Cell>
                        </Table.Row>
                     </Table.Body>
                  </>
               ))}
            </Table>
            {
               showMore && (
                  <button className='w-full text-teal-500 self-center text-sm py-7' onClick={handleShowMore}>
                     Show more
                  </button>
               )
            }
         </>
      ) : (
         <p>You have no users yet!</p>
      )}
      <Modal
        show={showModal}
        onClose={() => setShowModal(false)}
        popup
        size='md'
      >
        <Modal.Header />
        <Modal.Body>
          <div className='text-center'>
            <HiOutlineExclamationCircle className='h-14 w-14 text-gray-400 dark:text-gray-200 mb-4 mx-auto' />
            <h3 className='mb-5 text-lg text-gray-500 dark:text-gray-400'>
              Are you sure you want to delete this User?
            </h3>
            <div className='flex justify-center gap-4' >
              <Button color='failure' onClick={handleDeleteUser}>
                Yes, I'm sure
              </Button>
              <Button color='gray' onClick={() => setShowModal(false)}>
                No, cancel
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default DashUsers
