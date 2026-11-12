# Laxroa (www.laxroa.co.in)

E-commerce project with a static storefront (`/frontend`) and REST API (`/backend`).

## Build progress
- [x] Step 1: repo, backend server, database schema, seed
- [ ] Step 2: customer auth (register, forgot/reset password); admin sign-in is available
- [x] Step 3: public product catalog and admin price/image editing
- [x] Step 4: ordered-frame 360-degree product viewer
- [ ] Step 5: checkout (mandatory address) + Razorpay
- [ ] Step 6: deployment + DNS

## Product admin and 360-degree images
- Open **Admin** in the storefront and sign in with the account created by `npm run db:seed`.
- Admins can update a product's name, description, price, stock, visibility, main image, and 360-degree frames.
- Product uploads use Cloudinary. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the backend environment.
- Select numbered frame files such as `001.jpg`, `002.jpg`, and `003.jpg`; the storefront displays the 360° control when a product has at least two frames.
- Product prices are entered in rupees and stored as integer paise.

## Run the backend locally
```bash
cd backend
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
# Fill in DATABASE_URL, a unique JWT_SECRET, ADMIN_EMAIL, and ADMIN_PASSWORD.
# Add Cloudinary values to enable image uploads.
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed             # creates the admin user + sample products
npm run dev                 # http://localhost:4000/api/health
```

For the local storefront, serve the `frontend` folder (for example on `http://localhost:8000`). The app uses `http://localhost:4000` for its API on localhost. Add that storefront origin to `CORS_ORIGINS` if you use a different local port.

## Deploy the storefront to Vercel
1. Import `https://github.com/Lakshminarayanank9/Laxroa` into Vercel.
2. Set **Root Directory** to the repository root (`./` or blank), not `backend`, and use the `Other` framework preset. `vercel.json` serves the static files from `frontend`.
3. Deploy the storefront. The `api-base-url` meta tag in `frontend/index.html` points to `https://laxroa-api.onrender.com`; the page uses preview products if the API is unavailable.
4. Deploy `backend` as a separate Node.js service and configure `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and all three Cloudinary variables. Run `npm run db:deploy` and `npm run db:seed` once against the production database.
5. Add an API custom domain (recommended: `api.laxroa.co.in`) using the exact DNS instructions from the backend host. After the custom API domain has verified and HTTPS works, update the `api-base-url` meta tag in `frontend/index.html` to that URL and redeploy the storefront. Until then, keep using the Render URL above.
6. Add `www.laxroa.co.in` and `laxroa.co.in` under **Project Settings → Domains**. Follow the exact DNS records Vercel displays in GoDaddy; preserve unrelated MX/TXT records. Wait for Vercel to verify the domain and issue HTTPS.

## Security notes
- Never commit `.env` (it is in `.gitignore`). Only `.env.example` is committed.
- Prices are stored in paise (integers). Orders copy the price at purchase time.
- Use a unique, long `JWT_SECRET` and a strong `ADMIN_PASSWORD`; do not use the example placeholder in production.
- Admin sessions use an HttpOnly cookie. Keep the frontend and API on `laxroa.co.in` subdomains or configure a same-site deployment.

## Push to GitHub
```bash
git init && git add . && git commit -m "Step 1: backend foundation and database schema"
git branch -M main
git remote add origin https://github.com/<your-user>/laxroa.git   # create a PRIVATE repo first
git push -u origin main
```
