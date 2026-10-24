/* ============================================================
   Oakcraft Expense Manager — client configuration
   ------------------------------------------------------------
   EDIT THIS FILE after you deploy the Apps Script backend.

   1. Deploy apps-script as a Web App (see docs/DEPLOYMENT.md).
   2. Copy the "/exec" Web App URL and paste it into API_URL below.
   3. If you set a non-default API_SHARED_KEY in Config.gs, paste the
      same value into API_KEY below.

   Leave API_URL empty ("") to run in DEMO/PREVIEW mode, which uses the
   bundled snapshot in demo-data.js and keeps all changes in memory only.
   ============================================================ */
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwC7nqPDE48Yl6XNMLVG2oW2XzMxQffZqy1IZ46xtUDIygxeG6WPVJVOj4PoXY2cSt9kA/exec",                       // e.g. "https://script.google.com/macros/s/AKfyc.../exec"
  API_KEY: "",                       // must match API_SHARED_KEY in Config.gs if you changed it
  ORG_NAME: "Oakcraft",
  CURRENCY: "₹",
  APP_VERSION: "1.0.0"
};
