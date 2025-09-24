import React, { useState } from 'react';
import { Alert, Button, TextInput, Textarea, Select } from 'flowbite-react'; // Assuming these components are available
import { useNavigate } from 'react-router-dom';

// --- Security helpers (client-side) ---
const TITLE_MAX = 120;
const CONTENT_MAX = 2000;
const URL_MAX = 500;
const ALLOWED_CATEGORIES = ["staff", "customer"];

const sanitize = (s) => (typeof s === "string" ? s.replace(/[<>]/g, "") : s);
const isHttpsUrl = (u) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};
// Stronger ID generator (A + 6 digits)
function generateAnnouncement_ID() {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    const num = (arr[0] % 1000000).toString().padStart(6, "0");
    return `A${num}`;
  }
  return `A${Math.floor(Math.random() * 1000000).toString().padStart(6, "0")}`;
}
// --- End helpers ---

const CreateAnnouncementForm = () => {
    const [formData, setFormData] = useState({
        Announcement_ID: generateAnnouncement_ID(),
        Title: '',
        Content: '',
        Category_ID: '',
        Attachment_URL: '',
        Create_At: new Date().toISOString()
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleChange = e => {
        const { name, value } = e.target;
        let v = sanitize(value);
        if (name === 'Title') {
            v = v.slice(0, TITLE_MAX);
        } else if (name === 'Content') {
            v = v.slice(0, CONTENT_MAX);
        } else if (name === 'Attachment_URL') {
            v = v.slice(0, URL_MAX);
        } else if (name === 'Category_ID') {
            // force only allowed categories client-side
            if (!ALLOWED_CATEGORIES.includes(v)) {
                v = '';
            }
        }
        setFormData(prev => ({ ...prev, [name]: v }));
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);
        try {
            const title = sanitize(formData.Title).trim();
            const content = sanitize(formData.Content).trim();
            const category = formData.Category_ID;
            const attachment = sanitize(formData.Attachment_URL).trim();

            if (!title || !content) {
                throw new Error('Title and Content are required.');
            }
            if (title.length > TITLE_MAX || content.length > CONTENT_MAX) {
                throw new Error('Title/Content exceed maximum length.');
            }
            if (category && !ALLOWED_CATEGORIES.includes(category)) {
                throw new Error('Invalid category selected.');
            }
            if (attachment && !isHttpsUrl(attachment)) {
                throw new Error('Attachment URL must be a valid HTTPS URL.');
            }

            const payload = {
                Announcement_ID: formData.Announcement_ID, // generated locally & readonly
                Title: title,
                Content: content,
                Category_ID: category,
                Attachment_URL: attachment || '',
                Create_At: new Date().toISOString(),
            };

            const res = await fetch('/api/announcements/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || data?.success === false) {
                throw new Error(data?.message || 'Failed to create announcement');
            }
            setSuccess(true);
            navigate('/dashboard?tab=announcement');
        } catch (error) {
            setError(error.message || 'An error occurred. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setFormData({
            Announcement_ID: generateAnnouncement_ID(),
            Title: '',
            Content: '',
            Category_ID: '',
            Attachment_URL: '',
            Create_At: new Date().toISOString()
        });
    };

    return (
        <div className="p-3 max-w-lg mx-auto">
            <h1 className="text-3xl text-center font-semibold my-7">Create Announcement</h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <TextInput
                    type="text"
                    placeholder="Announcement ID"
                    name="Announcement_ID"
                    value={formData.Announcement_ID}
                    onChange={handleChange}
                    readOnly // Make the input readonly so the user can't change the ID directly
                />
                <TextInput
                    type="text"
                    placeholder="Title"
                    name="Title"
                    value={formData.Title}
                    onChange={handleChange}
                    required
                    maxLength={TITLE_MAX}
                />
                <Textarea
                    placeholder="Content"
                    name="Content"
                    value={formData.Content}
                    onChange={handleChange}
                    required
                    maxLength={CONTENT_MAX}
                />
                <Select
                    placeholder="Category ID"
                    name="Category_ID"
                    value={formData.Category_ID}
                    onChange={handleChange}
                >
                    <option value="">Select Category</option>
                    <option value="staff">Staff</option>
                    <option value="customer">Customer</option>
                </Select>
                <TextInput
                    type="url"
                    placeholder="Attachment URL (https://...)"
                    name="Attachment_URL"
                    value={formData.Attachment_URL}
                    onChange={handleChange}
                    maxLength={URL_MAX}
                    pattern="https://.*"
                    title="Must be an HTTPS URL"
                />
                <div className="flex space-x-4">
                    <Button type="submit" disabled={loading} gradientDuoTone="purpleToBlue">
                        {loading ? 'Submitting...' : 'Submit'}
                    </Button>
                    <Button type="button" onClick={handleClear} gradientDuoTone="pinkToOrange">
                        Clear
                    </Button>
                </div>
                {loading && (
                        <span className="text-white text-lg"></span>
                )}
            </form>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            {success && <p className="text-green-700 text-sm">Announcement created Successfully!</p>}
        </div>
    );
};

export default CreateAnnouncementForm;
