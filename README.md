# Runnymede Science Blog

A blog where students post about science — type text, attach links and photos.
Styled to match the Runnymede Timer (navy `#00163d`, Runnymede logo in the background).
Posts are stored in **Firebase Firestore** and shown most-recent-first, with
**Today / Week / Month / Year** filters. A satisfying chime plays when a post is published.

## Features
- ✍️  Write a post (title, body text, subject) + attach **links** and **photos**
- 🔐  Requires a **username + password** to publish (username is saved as the author)
- 🗂️  Filter by **Today, Week, Month, Year** (or All), newest → oldest
- 🔊  Success sound on publish
- 📱  Responsive on phones, tablets and desktops
- 🖼️  Runnymede logo watermark in the background

## Setup (one time, ~5 min)

### 1. Create a Firebase project
1. Go to <https://console.firebase.google.com> → **Add project**.
2. In the project, open **Build → Firestore Database → Create database**
   (start in **test mode** for now, pick a location, Enable).

### 2. Register a Web app & copy the config
1. Project **⚙ Settings → General → Your apps → Web (`</>`)**.
2. Give it a nickname, Register. Copy the `firebaseConfig` object shown.
3. Paste it into **`script.js`** where it says `const firebaseConfig = {…}`.

### 3. Set the posting password
In `script.js`, change:
```js
const POST_PASSWORD = "science2026";
```
to whatever password you want students to use. Share it with your class.

### 4. Open the blog
Just open `index.html` in a browser (or host it — see below).

## Firestore security rules (recommended)
Test mode allows anyone to read/write for 30 days. Before that expires, set rules in
**Firestore → Rules**. A simple "anyone can read, anyone can create a post" rule:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{post} {
      allow read: if true;
      allow create: if true;   // the app gates creation with the shared password
      allow update, delete: if false;
    }
  }
}
```

> Note: the password check happens in the browser, so it stops casual posting but is
> not strong security. For a school blog that's usually fine. For stronger protection,
> upgrade to **Firebase Authentication**.

## Hosting (optional)
- **Firebase Hosting:** `npm i -g firebase-tools`, then `firebase init hosting` and
  `firebase deploy`.
- Or drop the folder on GitHub Pages / Netlify — it's plain HTML/CSS/JS.

## Notes on photos
Images are resized in the browser (max 1000px, JPEG q0.7) and stored as base64 inside
the Firestore document. Firestore limits a document to **1 MB**, so keep to a few photos
per post. For many/large images, switch to **Firebase Storage**.

## Files
| File | Purpose |
|------|---------|
| `index.html` | Markup + Tailwind + Firebase SDK |
| `style.css`  | Theme (navy `#00163d`, cards, animations) |
| `script.js`  | Firebase, posting, filtering, sound, photos — **edit config here** |
| `assets/Runnymede Logo.png` | Background watermark |
