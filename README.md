# QIVRA (www.qivra.co.in)

E-commerce project with a static storefront (`/frontend`) and REST API (`/backend`).

## Build progress
- [x] Step 1: repo, backend server, database schema, seed
- [x] Step 2: customer accounts, password changes, and email password recovery
- [x] Step 3: public product catalog and admin product/price/image editing
- [x] Step 4: ordered-frame 360-degree product viewer
- [x] Step 5: guest checkout with mandatory delivery address + cash on delivery
- [ ] Step 6: deployment + DNS verification

## Product admin and 360-degree images
- Customer storefront: https://www.qivra.co.in/
- Admin sign-in: https://www.qivra.co.in/admin
- Sign in with the account created by `npm run db:seed`.
- Admins can change their password while signed in or request an email reset from the admin sign-in screen.
- Admins can add products, update a product's name, description, current price, optional original price, stock, visibility, main image, and 360-degree frames.
- Products with order history are removed from the storefront but retained for those orders. Products with no order history can be deleted.
- The customer storefront has no admin link; use the separate `/admin` URL.
- Admins can review the latest 50 cash-on-delivery order requests in the same panel, confirm a delivery fee after calling the customer, and cancel an order to return its stock.
- Product uploads use Cloudinary. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the backend environment.
- Select numbered frame files such as `001.jpg`, `002.jpg`, and `003.jpg`; the storefront displays the 360° control when a product has at least two frames.
- Enter the discounted/current price and, optionally, the higher original price in rupees. The storefront displays the savings; checkout always uses the current price. Prices are stored as integer paise.

## Customer accounts and password recovery
- Customers can sign up or sign in from the storefront's **Sign in** button. Guest checkout remains available.
- Signed-in users can change their password from their account panel.
- Forgot-password links are single-use and expire after 15 minutes. To send them, configure `EMAIL_API_KEY` and `EMAIL_FROM` in the backend environment. These use the Resend email API; verify the sender domain with Resend first. Keep the API key private and never commit it.
- If those email settings are missing, the forgot-password form reports that email recovery is not configured; registration and signed-in password changes continue to work.

## Checkout
- Guest checkout collects a delivery name, phone number, and Indian postal address; customers do not need an account.
- Orders are priced from the live database and reserve available stock. They remain pending until an admin calls the customer, enters the delivery charge, and accepts the order. The customer pays the confirmed total on delivery.
- Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD`, run `npm run db:seed` once, and use that admin account to replace the sample products with real inventory before accepting orders.
- Online payments are not enabled.

## Run the backend locally
```bash
cd backend
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
# Fill in DATABASE_URL, a unique JWT_SECRET, ADMIN_EMAIL, and ADMIN_PASSWORD.
# Add Cloudinary values to enable image uploads and Resend values for reset emails.
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
4. Deploy `backend` as a separate Node.js service and configure `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `FRONTEND_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and all three Cloudinary variables. Add `EMAIL_API_KEY` and a verified `EMAIL_FROM` sender to enable password reset emails. Run `npm run db:deploy` and `npm run db:seed` once against the production database.
5. Add an API custom domain (recommended: `api.qivra.co.in`) using the exact DNS instructions from the backend host. After the custom API domain has verified and HTTPS works, update the `api-base-url` meta tag in `frontend/index.html` to that URL and redeploy the storefront. Until then, keep using the Render URL above.
6. Add `www.qivra.co.in` and `qivra.co.in` under **Project Settings → Domains**. Follow the exact DNS records Vercel displays in GoDaddy; preserve unrelated MX/TXT records. Wait for Vercel to verify the domain and issue HTTPS.

## Security notes
- Never commit `.env` (it is in `.gitignore`). Only `.env.example` is committed.
- Prices are stored in paise (integers). Orders copy the price at purchase time.
- Use a unique, long `JWT_SECRET` and a strong `ADMIN_PASSWORD`; do not use the example placeholder in production.
- Sessions use an HttpOnly cookie. Keep the storefront and API on `qivra.co.in` subdomains or configure a same-site deployment.

## Push to GitHub
```bash
git init && git add . && git commit -m "Step 1: backend foundation and database schema"
git branch -M main
git remote add origin https://github.com/<your-user>/laxroa.git   # create a PRIVATE repo first
git push -u origin main
```
