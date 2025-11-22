# OAuth Issue Analysis

## Problem
- 401 error with "handler_error" message
- OAuth flow fails in production

## Root Cause Analysis

### Flow Trace:
1. ✅ User clicks "Continue with Google" on `wildcat-radio.live`
2. ✅ Frontend navigates to `https://api.wildcat-radio.live/oauth2/authorization/google`
3. ✅ Backend initiates OAuth with Google (redirect URI: `https://api.wildcat-radio.live/login/oauth2/code/google`)
4. ✅ User authenticates with Google
5. ✅ Google redirects back to `https://api.wildcat-radio.live/login/oauth2/code/google`
6. ❌ **ISSUE**: Success handler runs but something fails, catches exception, redirects to `/login?oauth_error=handler_error`
7. ❌ **ISSUE**: Frontend receives redirect but cookies might not be set properly

## Potential Issues Identified:

### Issue 1: Cookie Domain Setting
- `setCookieDomain()` extracts root domain from `Host` header
- In production: `Host` = `api.wildcat-radio.live` → root domain = `wildcat-radio.live`
- Cookie domain should be `.wildcat-radio.live` ✅ (This looks correct)

### Issue 2: Secure Cookies Not Enabled
- `useSecureCookies` defaults to `false`
- We added `@PostConstruct` to auto-enable in production, but this might not work correctly
- **FIX NEEDED**: Ensure `APP_SECURITY_COOKIE_SECURE=true` is set in production OR fix the PostConstruct logic

### Issue 3: SameSite Cookie Attribute
- Production needs `SameSite=None` for cross-subdomain cookies
- This is set correctly IF `useSecureCookies=true`

### Issue 4: Exception in Success Handler
- The catch block catches ALL exceptions and redirects with "handler_error"
- Need better logging to see what's actually failing
- **FIX NEEDED**: Check backend logs for actual exception

### Issue 5: Frontend Domain Detection
- When Google redirects back, there's NO Origin header
- Falls back to `isProduction` flag → should return `https://wildcat-radio.live` ✅

## Most Likely Issue:
**Secure cookies are not being enabled properly in production**, causing cookies to be rejected by the browser when:
- Cookies are set with `Secure=true` but request is HTTP (unlikely, we're using HTTPS)
- OR cookies are set with `Secure=false` but browser requires secure cookies for HTTPS
- OR `SameSite=None` requires `Secure=true` but `Secure=false` is set

## Solution:
1. Ensure `APP_SECURITY_COOKIE_SECURE=true` is set in GCP environment variables
2. OR fix the `@PostConstruct` logic to properly enable secure cookies
3. Add better error logging to identify the exact failure point

