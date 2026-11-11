# Laxroa (www.laxroa.co.in)

Full-stack e-commerce monorepo: user site + admin panel (`/frontend`) and REST API (`/backend`).

## Build progress
- [x] Step 1: repo, backend server, database schema, seed
- [ ] Step 2: auth (register, login, forgot/reset password)
- [ ] Step 3: products + admin panel
- [ ] Step 4: 360-degree viewer
- [ ] Step 5: checkout (mandatory address) + Razorpay
- [ ] Step 6: deployment + DNS

## Run the backend locally
```bash
cd backend
cp .env.example .env        # then fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run db:seed             # creates the admin user + sample products
npm run dev                 # http://localhost:4000/api/health
```

## Security notes
- Never commit `.env` (it is in `.gitignore`). Only `.env.example` is committed.
- Prices are stored in paise (integers). Orders copy the price at purchase time.
- Change the seeded admin password immediately after first login.

## Push to GitHub
```bash
git init && git add . && git commit -m "Step 1: backend foundation and database schema"
git branch -M main
git remote add origin https://github.com/<your-user>/laxroa.git   # create a PRIVATE repo first
git push -u origin main
```
