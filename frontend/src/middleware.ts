import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    const { url, cookies, redirect } = context;

    // Admin Auth Protection
    if (url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login')) {
        console.log(`[Middleware] Checking auth for ${url.pathname}`);
        const adminKey = cookies.get('admin_key')?.value;

        // Simple check - in production you might validate against env var here too
        if (!adminKey) {
            console.log('[Middleware] No key found, redirecting to login');
            return redirect('/admin/login');
        } else {
            console.log('[Middleware] Key found, allowing access');
        }
    }

    // Font Caching Strategy
    if (url.pathname.match(/\.(ttf|woff|woff2|otf)$/)) {
        const response = await next();
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return response;
    }

    return next();
});
