# Deployment Guide for aaPanel (Node.js Stack)

This guide details how to deploy the **Hadith Translation System** on aaPanel using the new Node.js stack (Fastify Backend + Astro Frontend).

## Prerequisites

1.  **aaPanel Installed**: Nginx (1.21+), Node.js Version Manager (v20+ recommended).
2.  **MongoDB**: Installed either via Docker Manager or local standard installation (Port 27017).

---

## 1. Backend Deployment (Fastify)

The backend handles the API and Admin Dashboard.

1.  **Preparation**:
    - Build locally: `npm run build` inside `backend/`.
    - Upload the `backend/` folder to `/www/wwwroot/hadith-backend` (or similar).
    - Ensure `dist/` folder is present (or build on server).

2.  **AA Panel Setup**:
    - Go to **Website** -> **Node Project** -> **Add Node Project**.
    - **Project Root**: `/www/wwwroot/hadith-backend`
    - **Startup Option**: `script`
    - **Script File**: `dist/index.js` (Make sure you ran `npm run build` or `tsc` first!)
    - **Run Port**: `3000`
    - **Node Version**: v20+
    - **Bind Domain**: `api.yourdomain.com` (Optional, or just use 127.0.0.1:3000 for internal proxy).
    - Click **Submit**.

3.  **Environment Variables**:
    - Create a `.env` file in the project root:
      ```
      PORT=3000
      MONGO_URI=mongodb://127.0.0.1:27017/hadith_db
      GEMINI_API_KEY=your_key_here
      ```
    - Restart the project.

---

## 2. Frontend Deployment (Astro SSR)

The frontend connects to the backend API.

1.  **Preparation**:
    - In `frontend/`, create `.env`:
      ```
      PUBLIC_API_URL=https://yourdomain.com/api 
      # OR if deploying on same domain via Nginx proxy:
      PUBLIC_API_URL=/api
      ```
    - Build: `npm run build`
    - Upload the `frontend/` folder to `/www/wwwroot/hadith-frontend`.

2.  **AA Panel Setup**:
    - Go to **Website** -> **Node Project** -> **Add Node Project**.
    - **Project Root**: `/www/wwwroot/hadith-frontend`
    - **Startup Option**: `script`
    - **Script File**: `dist/server/entry.mjs`
    - **Run Port**: `4321`
    - **Node Version**: v20+
    - **Bind Domain**: `yourdomain.com`
    - Click **Submit**.

---

## 3. Nginx Reverse Proxy (Single Domain)

If you want everything on one domain (e.g., `hadith.com`):

1.  **Frontend**: Bind `hadith.com` to the Frontend Node Project (Port 4321).
2.  **API Proxy**:
    - Go to **Website** -> Click `hadith.com` -> **Config File** (or Reverse Proxy tab).
    - Add the `/api` and `/admin` proxy rules *before* the main location block.

    ```nginx
    # Proxy API to Backend
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy Admin Dashboard to Backend
    location /admin {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    ```

## 4. Database Migration

Since you have data locally:
1.  **Export Local Data**:
    ```bash
    mongodump --db hadith_db --out backup/
    ```
2.  **Upload & Import**:
    - Upload `backup/hadith_db` folder to server.
    - Run: `mongorestore --db hadith_db hadith_db/`

---
