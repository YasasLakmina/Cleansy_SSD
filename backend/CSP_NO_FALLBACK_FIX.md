# CSP "No Fallback" Fix - Implementation Guide

## 🔍 ZAP Finding: "CSP: Failure to Define Directive with No Fallback"

### What This Error Means

ZAP raises this error when:

1. **Missing Fallback Coverage**: Using `script-src-elem` or `script-src-attr` without defining `script-src`
2. **Missing Critical Directives**: Not defining `base-uri`, `form-action`, or `frame-ancestors` (these have NO fallback)
3. **Inheritance Issues**: Relying on `default-src` for directives that don't inherit from it

### How Our Fix Resolves It

✅ **Explicit Directive Definition**: Always define `script-src` when using `script-src-elem/attr`  
✅ **Critical Directives**: Explicitly define `base-uri`, `form-action`, `frame-ancestors`  
✅ **Environment-Aware**: Production (strict) vs Development (relaxed) configurations  
✅ **Nonce Support**: Secure inline script/style execution in production

---

## 🚀 Implementation

### 1. CSP Configuration Structure

```javascript
// Production CSP (strict)
{
  'default-src': ["'self'"],
  'script-src': ["'self'", "'nonce-{nonce}'"],          // ✅ Defined
  'script-src-elem': ["'self'", "'nonce-{nonce}'"],     // ✅ Has fallback
  'script-src-attr': ["'none'"],                        // ✅ Has fallback
  'style-src': ["'self'", "'nonce-{nonce}'"],           // ✅ Defined
  'style-src-elem': ["'self'", "'nonce-{nonce}'"],      // ✅ Has fallback
  'style-src-attr': ["'none'"],                         // ✅ Has fallback
  'base-uri': ["'self'"],                               // ✅ No fallback - explicit
  'form-action': ["'self'"],                            // ✅ No fallback - explicit
  'frame-ancestors': ["'none'"],                        // ✅ No fallback - explicit
  'object-src': ["'none'"],
  'upgrade-insecure-requests': []
}

// Development CSP (relaxed for HMR)
{
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'base-uri': ["'self'"],                               // ✅ Still explicit
  'form-action': ["'self'"],                            // ✅ Still explicit
  'frame-ancestors': ["'none'"],                        // ✅ Still explicit
  // ... other directives
}
```

### 2. Nonce Implementation

```javascript
// Server generates unique nonce per request
app.use(cspNonceMiddleware);

// Use nonce in templates (if serving HTML)
<script nonce="${res.locals.nonce}">
  // This inline script will be allowed
  console.log('Secure inline script');
</script>

<style nonce="${res.locals.nonce}">
  /* This inline style will be allowed */
  body { background: #f0f0f0; }
</style>
```

---

## 🧪 Verification Steps

### 1. Basic CSP Header Check

```bash
# Check that CSP header is present
curl -I http://localhost:3000/api/csp-test | grep -i content-security-policy

# Expected output should include:
# content-security-policy: default-src 'self'; script-src 'self' 'nonce-...'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

### 2. Verify Critical Directives

```bash
# Get full CSP header and check for required directives
curl -s http://localhost:3000/api/csp-test | jq '.headers.csp'

# Must contain these directives:
# ✅ base-uri 'self'
# ✅ form-action 'self'
# ✅ frame-ancestors 'none'
# ✅ object-src 'none'
# ✅ script-src (when script-src-elem/attr present)
# ✅ style-src (when style-src-elem/attr present)
```

### 3. Test Nonce Generation

```bash
# Check that nonce is generated per request
curl -s http://localhost:3000/api/csp-test | jq '.nonce'
curl -s http://localhost:3000/api/csp-test | jq '.nonce'

# Should show different nonce values for each request
```

### 4. Environment-Specific Testing

#### Production Mode

```bash
# Set production environment
export NODE_ENV=production

# Restart server and check CSP
curl -I http://localhost:3000/api/csp-test | grep content-security-policy

# Should NOT contain 'unsafe-inline' or 'unsafe-eval'
# Should contain nonces for inline content
```

#### Development Mode

```bash
# Set development environment
export NODE_ENV=development

# Check CSP allows development tools
curl -I http://localhost:3000/api/csp-test | grep content-security-policy

# Should contain 'unsafe-inline' and 'unsafe-eval' for HMR
```

### 5. ZAP Scan Verification

After implementing these changes:

1. Run OWASP ZAP scan against your application
2. The "CSP: Failure to Define Directive with No Fallback" finding should be resolved
3. Check that ZAP shows proper CSP coverage

---

## 📋 CSP Directive Reference

| Directive         | Fallback Source | Required | Purpose                           |
| ----------------- | --------------- | -------- | --------------------------------- |
| `default-src`     | N/A             | ✅       | Base policy for all resources     |
| `script-src`      | `default-src`   | ✅       | JavaScript execution              |
| `script-src-elem` | `script-src`    | ⚠️       | `<script>` elements               |
| `script-src-attr` | `script-src`    | ⚠️       | Inline event handlers             |
| `style-src`       | `default-src`   | ✅       | CSS styling                       |
| `style-src-elem`  | `style-src`     | ⚠️       | `<style>` elements                |
| `style-src-attr`  | `style-src`     | ⚠️       | Inline style attributes           |
| `base-uri`        | **NONE**        | ✅       | `<base>` element URLs             |
| `form-action`     | **NONE**        | ✅       | Form submission URLs              |
| `frame-ancestors` | **NONE**        | ✅       | Embedding restrictions            |
| `object-src`      | `default-src`   | ✅       | `<object>`, `<embed>`, `<applet>` |

**Key**: ✅ Must define explicitly | ⚠️ Must define parent directive

---

## 🔧 Customization Examples

### Add Trusted CDN

```javascript
// In buildCspDirectives function
'script-src': [
  "'self'",
  "'nonce-${nonce}'",
  "https://cdn.jsdelivr.net",  // Add trusted CDN
  "https://js.stripe.com"
],
```

### Allow Specific Inline Styles (Production)

```javascript
// Use nonce instead of 'unsafe-inline'
'style-src': [
  "'self'",
  "'nonce-${nonce}'",           // Secure inline styles
  "https://fonts.googleapis.com"
],
```

### WebSocket Support

```javascript
'connect-src': [
  "'self'",
  "wss://your-websocket-server.com",
  "ws://localhost:*"  // Development only
],
```

---

## ⚡ Performance Notes

1. **Nonce Generation**: Minimal overhead (~1ms per request)
2. **Header Size**: Production CSP header ~200-400 bytes
3. **Browser Support**: CSP Level 3 features supported in modern browsers
4. **Caching**: CSP headers are not cached due to nonce uniqueness

---

## 🚨 Security Benefits

1. **XSS Prevention**: Blocks unauthorized script execution
2. **Clickjacking Protection**: Prevents iframe embedding
3. **Data Injection**: Prevents base tag and form hijacking
4. **Mixed Content**: Forces HTTPS in production
5. **Resource Restriction**: Limits resource loading to trusted sources

This implementation resolves the ZAP "No Fallback" finding while maintaining strong security posture and development flexibility.
