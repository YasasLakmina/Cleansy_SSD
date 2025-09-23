# Facebook Authentication Implementation Guide

## ✅ Implementation Complete

### What's Been Added:

1. **User Model Update**: Added `facebookId` field to link Facebook accounts
2. **Passport Configuration**: Facebook OAuth strategy with profile field requests
3. **Auth Controller**: Facebook authentication handlers with JWT generation
4. **Auth Routes**: Facebook login endpoints
5. **Server Integration**: Passport initialization in Express app

---

## 🔧 Configuration

### Environment Variables Required:

```bash
# Already in your .env file:
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
JWT_SECRET=

# Optional: Frontend URL for redirects
CLIENT_URL=http://localhost:5173
```

### Facebook App Settings:

Ensure your Facebook app has these settings:

- **Valid OAuth Redirect URIs**: `http://localhost:3000/api/auth/facebook/callback`
- **App Domain**: `localhost` (for development)
- **Permissions**: `email` (basic permission)

---

## 🚀 API Endpoints

### 1. Initiate Facebook Login

```
GET /api/auth/facebook
```

**Purpose**: Redirects user to Facebook login page
**Usage**: Navigate user's browser to this URL to start Facebook authentication

**Example**:

```javascript
// Frontend - redirect user to Facebook login
window.location.href = "http://localhost:3000/api/auth/facebook";
```

### 2. Facebook Callback (Automatic)

```
GET /api/auth/facebook/callback
```

**Purpose**: Handles Facebook OAuth response, creates/links user, issues JWT
**Response**: JSON with user data and sets httpOnly JWT cookie

**Success Response**:

```json
{
  "success": true,
  "message": "Facebook authentication successful",
  "user": {
    "_id": "user_id",
    "username": "johndoe1234",
    "email": "john@facebook.com",
    "profilePicture": "https://facebook.com/profile/photo.jpg",
    "facebookId": "facebook_user_id",
    "isAdmin": false
    // ... other user fields
  }
}
```

---

## 🔄 Authentication Flow

### New User Flow:

1. User clicks "Login with Facebook" → GET `/api/auth/facebook`
2. Redirected to Facebook login page
3. User authorizes app on Facebook
4. Facebook redirects to `/api/auth/facebook/callback`
5. **New user created** with:
   - Email from Facebook
   - Username generated from name + random suffix
   - Profile picture from Facebook
   - Random password (not used)
   - `facebookId` stored
6. JWT token generated and set in httpOnly cookie
7. User data returned

### Existing User (Same Email) Flow:

1. Same steps 1-4 as above
2. **Existing user found** by email
3. **Facebook account linked**: `facebookId` added to existing user
4. Profile picture updated (if better quality)
5. JWT token generated and set in httpOnly cookie
6. Updated user data returned

### Returning Facebook User Flow:

1. Same steps 1-4 as above
2. **User found** by `facebookId`
3. JWT token generated and set in httpOnly cookie
4. User data returned

---

## 🧪 Testing

### Test 1: New Facebook User

```bash
# Navigate browser to:
http://localhost:3000/api/auth/facebook

# Expected: Redirects to Facebook, creates new user
```

### Test 2: Link Facebook to Existing User

1. Create user via standard signup with email: `test@example.com`
2. Navigate to Facebook auth with same email
3. Should link Facebook account to existing user

### Test 3: Returning Facebook User

1. Complete Facebook authentication once
2. Navigate to Facebook auth again
3. Should immediately authenticate existing user

---

## 🔒 Security Features

### JWT Token Security:

- **HttpOnly Cookie**: Prevents XSS access to token
- **Secure Flag**: HTTPS only in production
- **SameSite**: CSRF protection
- **24-hour expiration**: Automatic token expiry

### User Data Protection:

- **Password excluded**: Never sent in responses
- **Email validation**: Requires email from Facebook
- **Unique constraints**: Prevents duplicate accounts

### Error Handling:

- **Facebook auth errors**: Gracefully handled
- **Missing email**: Rejected with error message
- **Network issues**: Proper error responses

---

## 🎨 Frontend Integration Examples

### React/JavaScript Example:

```javascript
// Facebook Login Button Component
const FacebookLoginButton = () => {
  const handleFacebookLogin = () => {
    // Redirect to Facebook authentication
    window.location.href = "http://localhost:3000/api/auth/facebook";
  };

  return (
    <button
      onClick={handleFacebookLogin}
      className="bg-blue-600 text-white px-4 py-2 rounded"
    >
      Continue with Facebook
    </button>
  );
};

// After successful authentication, user will be redirected back
// Check for authentication cookie or user state in your app
```

### Handling Authentication Response:

```javascript
// Check if user is authenticated (after redirect back)
const checkAuthStatus = async () => {
  try {
    const response = await fetch("/api/user/profile", {
      credentials: "include", // Include httpOnly cookies
    });

    if (response.ok) {
      const user = await response.json();
      console.log("User authenticated:", user);
      // Update your app state with user data
    }
  } catch (error) {
    console.log("User not authenticated");
  }
};
```

---

## 🐛 Troubleshooting

### Common Issues:

1. **"Invalid OAuth Redirect URI"**:

   - Check Facebook app settings
   - Ensure callback URL matches exactly: `http://localhost:3000/api/auth/facebook/callback`

2. **"App Not Set Up for Facebook Login"**:

   - Enable Facebook Login in your Facebook app
   - Add required permissions (email)

3. **"This app is in development mode"**:

   - Normal for development
   - Add test users in Facebook app or make app live

4. **CORS Errors**:

   - Ensure frontend URL is in CORS whitelist
   - Check browser network tab for blocked requests

5. **"User not found" after authentication**:
   - Check server logs for detailed error messages
   - Verify database connection
   - Ensure User model is properly imported

---

## 🔧 Customization Options

### Redirect After Authentication:

```javascript
// In facebookCallback function, uncomment this line:
return res.redirect(
  `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard`
);
```

### Request Additional Facebook Permissions:

```javascript
// In auth.route.js, modify the scope:
router.get(
  "/facebook",
  passport.authenticate("facebook", {
    scope: ["email", "user_location", "user_birthday"],
  })
);
```

### Custom Username Generation:

```javascript
// In passport.js, modify the username generation:
username: `${profile.name.givenName.toLowerCase()}_${profile.name.familyName.toLowerCase()}_${Math.random()
  .toString(9)
  .slice(-4)}`;
```

---

## 📊 Database Schema

### Updated User Model:

```javascript
{
  username: String (required, unique),
  email: String (required, unique),
  password: String (required),
  profilePicture: String,
  facebookId: String (unique, sparse), // ← NEW FIELD
  isAdmin: Boolean,
  // ... other admin fields
}
```

The Facebook authentication is now fully integrated and follows the same JWT pattern as your existing Google authentication! 🎉
