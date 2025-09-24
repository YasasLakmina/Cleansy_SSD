// UpdateAnnouncementForm.js
import React, { useState, useEffect } from 'react';
import { TextInput, Textarea, Select, Button } from 'flowbite-react';
import { useNavigate, useParams } from 'react-router-dom';

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
// --- End helpers ---

const UpdateAnnouncementForm = () => {
    const [formData, setFormData] = useState({
        Title: '',
        Content: '',
        Category_ID: '',
        Attachment_URL: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    const params = useParams();

    useEffect(() => {
        const fetchAnnouncement = async () => {
            try {
                const id = params.id;
                const res = await fetch(`/api/announcements/read/${id}`, { credentials: "include" });
                const data = await res.json();
                if (!res.ok || !data) {
                    throw new Error(data?.message || "Failed to fetch announcement");
                }
                // Map only expected fields and sanitize
                setFormData({
                    Title: sanitize(data.Title || ""),
                    Content: sanitize(data.Content || ""),
                    Category_ID: ALLOWED_CATEGORIES.includes(data.Category_ID) ? data.Category_ID : "",
                    Attachment_URL: typeof data.Attachment_URL === "string" ? data.Attachment_URL : "",
                });
            } catch (error) {
                setError("An error occurred while fetching the announcement.");
            }
        };
        fetchAnnouncement();
    }, []);

    const handleChange = e => {
        const { name, value } = e.target;
        let v = sanitize(value);
        if (name === "Title") {
            v = v.slice(0, TITLE_MAX);
        } else if (name === "Content") {
            v = v.slice(0, CONTENT_MAX);
        } else if (name === "Attachment_URL") {
            v = v.slice(0, URL_MAX);
        } else if (name === "Category_ID") {
            if (!ALLOWED_CATEGORIES.includes(v)) v = "";
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

            const id = params.id;
            const payload = {
                Title: title,
                Content: content,
                Category_ID: category,
                Attachment_URL: attachment || '',
            };

            const res = await fetch(`/api/announcements/update/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || data?.success === false) {
                throw new Error(data?.message || 'Failed to update announcement');
            }
            setSuccess(true);
            navigate('/dashboard?tab=announcement');
        } catch (error) {
            setError(error.message || 'An error occurred while updating the announcement.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-3 max-w-lg mx-auto">
            <h1 className="text-3xl text-center font-semibold my-7">Update Announcement</h1>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            {success && <p className="text-green-700 text-sm">Announcement updated Successfully!</p>}
            <div className="p-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                        name="Category_ID"
                        value={formData.Category_ID}
                        onChange={handleChange}
                        required
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
                    <Button type="submit" gradientDuoTone="purpleToBlue">
                        {loading ? 'Updating...' : 'Update'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default UpdateAnnouncementForm;
