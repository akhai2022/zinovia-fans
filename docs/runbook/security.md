# Security notes

## CSRF strategy
- Access tokens are stored in HttpOnly cookies with `SameSite=Lax`.
- State-changing endpoints should require a CSRF token header in production.
- The CSRF token is derived from `CSRF_SECRET` and rotated per session.

## Auth cookies
- Cookies are `HttpOnly` and `Secure` in production.
- Always use HTTPS in production environments.
