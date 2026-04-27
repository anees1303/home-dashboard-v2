# 🏠 Home Construction Dashboard

A beautiful, real-time dashboard to track your home construction project. Share with family via a single link.

## ✨ Features

- 💰 Expense tracking with payment modes (UPI/Cash/Cheque/Bank) and receipt links
- 📦 Material stock register with status tracking
- 📸 Photo gallery via Google Drive links
- 👷 Daily labour attendance log
- 📅 Construction timeline with milestones
- 📞 Contacts directory with tap-to-call
- ✅ Document checklist with permit attachments
- 📄 PDF report export
- 🔄 Real-time sync across all family devices

## 🚀 Setup Instructions

### 1. Firebase Setup (Free)
1. Go to https://console.firebase.google.com
2. Create new project
3. Enable Firestore Database (production mode)
4. Add a Web App and copy the config keys
5. Paste keys into `src/firebase.js`

### 2. Firestore Security Rules
In Firebase Console → Firestore → Rules, paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/family-home-build-001 {
      allow read, write: if true;
    }
  }
}
```

### 3. Deploy to Vercel
1. Push code to GitHub
2. Go to vercel.com → Import from GitHub
3. Click Deploy
4. Get permanent URL → Share on WhatsApp!

## 📱 Tech Stack
- React 18
- Firebase Firestore (real-time database)
- Vercel (hosting)
