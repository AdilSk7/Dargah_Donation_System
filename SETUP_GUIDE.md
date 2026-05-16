# 🕌 Dargah Donation Management System
## Complete Setup & Deployment Guide

---

## 📁 Project Structure

```
dargah/
├── backend/
│   ├── app.py              ← Flask REST API
│   ├── requirements.txt    ← Python packages
│   ├── schema.sql          ← MySQL database setup
│   └── uploads/            ← Payment screenshots (auto-created)
├── frontend/
│   ├── src/
│   │   ├── App.jsx         ← Full React app
│   │   └── main.jsx        ← Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── SETUP_GUIDE.md          ← This file
```

---

## 🖥️ LOCAL SETUP (Run on your computer)

### Step 1 — Install MySQL
- Download MySQL Community Server: https://dev.mysql.com/downloads/mysql/
- Install and set root password (remember it!)

### Step 2 — Create Database
Open MySQL terminal and run:
```sql
CREATE DATABASE dargah_db CHARACTER SET utf8mb4;
```
Or run the full schema:
```bash
mysql -u root -p < backend/schema.sql
```

### Step 3 — Setup Backend (Flask)
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it:
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install packages
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your MySQL password

# Run the server
python app.py
```
Backend runs at: http://localhost:5000

### Step 4 — Setup Frontend (React)
Open a NEW terminal:
```bash
cd frontend

# Install Node.js from https://nodejs.org if not installed

npm install
npm run dev
```
Frontend runs at: http://localhost:3000

### Step 5 — Login
- **Admin:** Mobile: `9001447689` / Password: `admin123`
- **Members:** Register via the Register tab

---

## 🌐 ONLINE DEPLOYMENT (Free Hosting)

### Option A: Render (Backend) + Vercel (Frontend) — RECOMMENDED

#### Deploy Backend on Render (Free)
1. Push your code to GitHub
2. Go to https://render.com → New Web Service
3. Connect your GitHub repo
4. Set these:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
5. Add Environment Variables:
   ```
   DATABASE_URL = mysql+pymysql://user:pass@host/dargah_db
   JWT_SECRET   = your-very-secret-key-here
   ```
6. For MySQL, use **PlanetScale** (free MySQL cloud): https://planetscale.com

#### Deploy Frontend on Vercel (Free)
1. Go to https://vercel.com → New Project
2. Import your GitHub repo
3. Set Root Directory: `frontend`
4. Add Environment Variable:
   ```
   VITE_API_URL = https://your-render-app.onrender.com/api
   ```
5. Deploy!

---

### Option B: Railway (All-in-one)
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Add MySQL plugin (free tier)
4. Set environment variables
5. Deploy backend and frontend separately

---

## ⚙️ Environment Variables

### Backend (.env)
```
DATABASE_URL=mysql+pymysql://root:yourpassword@localhost/dargah_db
JWT_SECRET=change-this-to-a-random-secret-string
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```
Change to your deployed backend URL when hosting online.

---

## 💳 Payment Gateway Integration (Advanced)

### Razorpay (Recommended for auto-verification)
1. Sign up at https://razorpay.com
2. Get API keys from Dashboard
3. Add to backend .env:
   ```
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=your_secret
   ```
4. Replace manual UTR verification with Razorpay webhook

### Razorpay Webhook (Auto-verify payments)
```python
# Add to app.py
import razorpay
import hmac, hashlib

@app.route("/api/razorpay/webhook", methods=["POST"])
def razorpay_webhook():
    payload = request.get_data(as_text=True)
    signature = request.headers.get("X-Razorpay-Signature")
    secret = os.getenv("RAZORPAY_KEY_SECRET")
    
    expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    if hmac.compare_digest(expected, signature):
        data = request.json
        if data["event"] == "payment.captured":
            # Auto-verify the payment
            notes = data["payload"]["payment"]["entity"]["notes"]
            member_id = notes.get("member_id")
            month = notes.get("month")
            if member_id and month:
                p = Payment(member_id=member_id, month=month, status="verified",
                           utr=data["payload"]["payment"]["entity"]["id"])
                db.session.add(p); db.session.commit()
    return jsonify({"status": "ok"})
```

---

## 📱 SMS/WhatsApp Reminders (MSG91)

1. Sign up at https://msg91.com
2. Get API key
3. Add to backend:
```python
import requests

def send_sms_reminder(mobile, name, month, amount):
    url = "https://api.msg91.com/api/v5/flow/"
    payload = {
        "flow_id": "YOUR_FLOW_ID",
        "sender": "DARGAH",
        "mobiles": f"91{mobile}",
        "VAR1": name,
        "VAR2": month,
        "VAR3": str(amount)
    }
    headers = { "authkey": "YOUR_MSG91_AUTHKEY", "Content-Type": "application/json" }
    requests.post(url, json=payload, headers=headers)
```

Add a monthly cron job to send reminders on 1st of each month.

---

## 🔒 Security Checklist
- [ ] Change JWT_SECRET to a random 32+ character string
- [ ] Change admin password from admin123
- [ ] Use HTTPS in production (Render/Vercel handle this)
- [ ] Set strong MySQL password
- [ ] Enable CORS only for your frontend domain in production

---

## 📞 Support
- UPI Number: 9001447689
- Monthly Amount: ₹100
- Admin Login: 9001447689 / admin123

**Barakallahu feekum 🤲**
