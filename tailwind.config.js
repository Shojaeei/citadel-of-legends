/** Build-time only: compiles the utility classes used by the game UI into
 *  css/tailwind.css so no runtime CDN script is required (offline/PWA safe).
 *  Run: npm run build:css */
module.exports = {
    content: ['./index.html', './js/**/*.js'],
    theme: { extend: {} },
    plugins: []
};
