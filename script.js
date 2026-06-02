/* ════════════════════════════════════════════════════════════
   Runnymede Science Blog — logic
   ════════════════════════════════════════════════════════════

   ░░ WHERE IS THE BACKEND? ░░
   Every line that talks to Firebase lives in ONE place: the
   "BACKEND ADAPTER" block just below (look for the big banner).
   The rest of the app only calls the generic Backend.* functions,
   so if the backend ever changes (Supabase, a REST API, etc.)
   you only rewrite that one block — nothing else.

   Search the file for the tag  >>> FIREBASE  to jump to every
   Firebase-specific spot.
   ════════════════════════════════════════════════════════════ */


/* ╔══════════════════════════════════════════════════════════╗
   ║                                                          ║
   ║            BACKEND ADAPTER   >>> FIREBASE <<<            ║
   ║   The ONLY part of the app that knows about Firebase.   ║
   ║   To switch backends, re-implement the four functions   ║
   ║   on the `Backend` object below and nothing else.       ║
   ║                                                          ║
   ╚══════════════════════════════════════════════════════════╝ */

/* ── (1) CLIENT CONFIG — leave as a placeholder. ───────────────
   >>> FIREBASE: paste the client's Firebase config here.
   Get it from: Firebase console → Project settings → Your apps
   → Web app → "SDK setup and configuration" → Config.
   The app stays on the warning banner until this is filled in. */
const firebaseConfig = {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId:             "YOUR_APP_ID"
};

/* ── (2) Shared password students must type to publish. ───────
   This is NOT Firebase-specific — it's just the posting gate.
   The username they enter is saved as the post's author. */
const POST_PASSWORD = "science2026";

/* ── (3) The Backend object: the app's whole data layer. ──────
   Swap the bodies of these to change backends. */
const Backend = {
    ready: false,        // becomes true once a real config is loaded
    _db:   null,         // >>> FIREBASE: the Firestore handle

    /* Connect to the backend. Called once at startup. */
    init() {
        try {
            // >>> FIREBASE: initialise the SDK + Firestore
            firebase.initializeApp(firebaseConfig);
            this._db = firebase.firestore();
            this.ready = (firebaseConfig.apiKey !== "YOUR_API_KEY");
        } catch (e) {
            console.error("Backend init failed:", e);
            this.ready = false;
        }
        return this.ready;
    },

    /* Live-stream all posts, newest first.
       `onChange` is called with an array of posts every time the
       data changes. `onError` is called with an Error.
       Each post is a plain object: { id, title, body, author,
       subject, links[], images[], createdAt }. */
    subscribePosts(onChange, onError) {
        // >>> FIREBASE: Firestore real-time listener on "posts"
        return this._db.collection("posts")
            .orderBy("createdAt", "desc")          // most recent → oldest
            .onSnapshot(
                snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
                err  => onError(err)
            );
    },

    /* Save one new post. `post` is a plain object (see above,
       minus id/createdAt — those are added here). Returns a Promise. */
    addPost(post) {
        // >>> FIREBASE: write a document, server fills the timestamp
        return this._db.collection("posts").add({
            ...post,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    /* Normalise a stored timestamp into a JS Date (or null). */
    toDate(ts) {
        if (!ts) return null;
        // >>> FIREBASE: Firestore Timestamps expose .toDate()
        if (typeof ts.toDate === "function") return ts.toDate();
        return new Date(ts);
    }
};

/* ╔══════════════════════════════════════════════════════════╗
   ║          END BACKEND ADAPTER  —  no more Firebase         ║
   ║   Everything below is backend-agnostic UI / app logic.   ║
   ╚══════════════════════════════════════════════════════════╝ */


/* ───────────────────────────────────────────────
   STATE
   ─────────────────────────────────────────────── */
let allPosts = [];            // every post fetched from the backend
let currentFilter = "all";    // all | today | week | month | year
let selectedSubject = "General";
let attachedPhotos = [];      // base64 data URLs

/* ───────────────────────────────────────────────
   STARTUP
   ─────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    updateHeaderDate();
    wireFilters();
    wireSubjects();
    wireForm();
    addLinkField();           // start with one empty link field
    Backend.init();           // connect to the backend
    subscribeToPosts();
});

function updateHeaderDate() {
    const el = document.getElementById("header-date");
    if (el) el.textContent = new Date().toLocaleDateString("en-GB",
        { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/* ───────────────────────────────────────────────
   LIVE DATA  (subscribe via the Backend adapter)
   ─────────────────────────────────────────────── */
function subscribeToPosts() {
    if (!Backend.ready) {
        showBanner(
            "⚠️ The backend is not configured yet. Open <code>script.js</code> and paste the " +
            "client's config into <code>firebaseConfig</code> (top of the BACKEND ADAPTER block). " +
            "Until then, posts can't be saved or loaded.",
            "warn"
        );
        renderFeed();
        return;
    }
    Backend.subscribePosts(
        posts => { allPosts = posts; renderFeed(); },
        err   => { console.error(err); showBanner("Could not load posts: " + err.message, "error"); }
    );
}

/* ───────────────────────────────────────────────
   FILTERING  (Today / Week / Month / Year)
   ─────────────────────────────────────────────── */
function wireFilters() {
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("filter-active"));
            btn.classList.add("filter-active");
            renderFeed();
        });
    });
}

function passesFilter(post) {
    if (currentFilter === "all") return true;
    const created = Backend.toDate(post.createdAt);
    if (!created) return true;             // keep posts whose timestamp is still pending
    const now = new Date();
    const cutoff = new Date();
    switch (currentFilter) {
        case "today": cutoff.setHours(0, 0, 0, 0); break;
        case "week":  cutoff.setDate(now.getDate() - 7);   break;
        case "month": cutoff.setMonth(now.getMonth() - 1); break;
        case "year":  cutoff.setFullYear(now.getFullYear() - 1); break;
    }
    return created >= cutoff;
}

/* ───────────────────────────────────────────────
   RENDER FEED
   ─────────────────────────────────────────────── */
function renderFeed() {
    const feed = document.getElementById("feed");
    const empty = document.getElementById("empty-state");
    const posts = allPosts.filter(passesFilter);   // already sorted desc by the backend

    feed.innerHTML = "";
    if (posts.length === 0) {
        empty.classList.remove("hidden");
        return;
    }
    empty.classList.add("hidden");
    posts.forEach(p => feed.appendChild(buildPostCard(p)));
}

function buildPostCard(p) {
    const subject = p.subject || "General";
    const card = document.createElement("article");
    card.className = "post-card bg-[#001a47]/55 backdrop-blur-xl border border-blue-400/15 shadow-xl rounded-2xl p-5 sm:p-6";

    // Header row
    const header = `
        <div class="flex items-start justify-between gap-3 mb-3">
            <div class="min-w-0">
                <h3 class="text-xl sm:text-2xl font-bold text-white break-words">${esc(p.title || "Untitled")}</h3>
                <div class="flex items-center gap-2 mt-1 text-sm text-blue-200/70">
                    <span class="font-semibold text-blue-200">${esc(p.author || "Anonymous")}</span>
                    <span class="opacity-40">•</span>
                    <span>${formatWhen(p.createdAt)}</span>
                </div>
            </div>
            <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border badge-${esc(subject)}">${esc(subject)}</span>
        </div>`;

    // Body
    const body = `<p class="text-blue-50/90 whitespace-pre-wrap break-words leading-relaxed">${esc(p.body || "")}</p>`;

    // Photos
    let photos = "";
    if (Array.isArray(p.images) && p.images.length) {
        photos = `<div class="grid ${p.images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"} gap-2 mt-4">` +
            p.images.map(src =>
                `<img src="${src}" alt="" loading="lazy"
                      class="w-full h-40 object-cover rounded-xl cursor-pointer hover:opacity-90 transition"
                      onclick="openLightbox(this.src)" />`
            ).join("") + `</div>`;
    }

    // Links
    let links = "";
    if (Array.isArray(p.links) && p.links.length) {
        links = `<div class="flex flex-wrap gap-2 mt-4">` +
            p.links.map(l => {
                const safe = esc(l);
                return `<a href="${safe}" target="_blank" rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-100 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/25 rounded-lg px-3 py-1.5 transition-colors break-all max-w-full">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5"/></svg>
                    <span class="truncate">${prettyUrl(l)}</span></a>`;
            }).join("") + `</div>`;
    }

    card.innerHTML = header + body + photos + links;
    return card;
}

function formatWhen(ts) {
    const d = Backend.toDate(ts);
    if (!d) return "just now";
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)    return "just now";
    if (diff < 3600)  return Math.floor(diff / 60) + " min ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + " d ago";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ───────────────────────────────────────────────
   MODAL
   ─────────────────────────────────────────────── */
function openModal() {
    document.getElementById("modal-overlay").classList.remove("hidden");
    document.body.classList.add("modal-open");
}
function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
    document.body.classList.remove("modal-open");
}
// Close modal on Escape
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeLightbox(); } });

function wireSubjects() {
    document.querySelectorAll(".subject-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".subject-chip").forEach(c => c.classList.remove("subject-active"));
            chip.classList.add("subject-active");
            selectedSubject = chip.dataset.subject;
        });
    });
}

/* ───────────────────────────────────────────────
   LINK FIELDS
   ─────────────────────────────────────────────── */
function addLinkField(value = "") {
    const container = document.getElementById("links-container");
    const row = document.createElement("div");
    row.className = "flex items-center gap-2";
    row.innerHTML = `
        <input type="url" class="field link-input" placeholder="https://…" value="${esc(value)}" />
        <button type="button" class="shrink-0 text-blue-200/50 hover:text-red-300 p-2 rounded-lg hover:bg-white/5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>`;
    row.querySelector("button").addEventListener("click", () => row.remove());
    container.appendChild(row);
}

/* ───────────────────────────────────────────────
   PHOTOS  (resize + compress to base64)
   ─────────────────────────────────────────────── */
function handlePhotos(event) {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = e => resizeImage(e.target.result, dataUrl => {
            attachedPhotos.push(dataUrl);
            renderPhotoPreviews();
        });
        reader.readAsDataURL(file);
    });
    event.target.value = "";   // allow re-selecting same file
}

function resizeImage(dataUrl, cb) {
    const img = new Image();
    img.onload = () => {
        const MAX = 1000;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else                { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        cb(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = dataUrl;
}

function renderPhotoPreviews() {
    const wrap = document.getElementById("photo-previews");
    wrap.innerHTML = "";
    attachedPhotos.forEach((src, i) => {
        const div = document.createElement("div");
        div.className = "relative";
        div.innerHTML = `
            <img src="${src}" class="w-20 h-20 object-cover rounded-lg border border-blue-400/25" />
            <button type="button" class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg text-xs">✕</button>`;
        div.querySelector("button").addEventListener("click", () => {
            attachedPhotos.splice(i, 1);
            renderPhotoPreviews();
        });
        wrap.appendChild(div);
    });
}

/* ───────────────────────────────────────────────
   SUBMIT
   ─────────────────────────────────────────────── */
function wireForm() {
    document.getElementById("post-form").addEventListener("submit", submitPost);
}

async function submitPost(e) {
    e.preventDefault();
    const errEl = document.getElementById("form-error");
    errEl.classList.add("hidden");

    const username = document.getElementById("f-username").value.trim();
    const password = document.getElementById("f-password").value;
    const title    = document.getElementById("f-title").value.trim();
    const body     = document.getElementById("f-body").value.trim();

    if (password !== POST_PASSWORD) return formError("Wrong posting password — ask your teacher for it.");
    if (!Backend.ready)             return formError("The backend isn't configured yet, so the post can't be saved.");

    const links = Array.from(document.querySelectorAll(".link-input"))
        .map(i => i.value.trim())
        .filter(Boolean)
        .map(normalizeUrl);

    // Plain, backend-agnostic post object (Backend.addPost adds the timestamp).
    const post = {
        title, body,
        author:  username,
        subject: selectedSubject,
        links,
        images:  attachedPhotos.slice()
    };

    const btn = document.getElementById("submit-btn");
    btn.disabled = true;
    btn.textContent = "Publishing…";

    try {
        await Backend.addPost(post);
        playSuccessSound();
        btn.classList.add("publish-pulse");
        resetForm();
        closeModal();
    } catch (err) {
        console.error(err);
        formError("Couldn't publish: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Publish Post";
        setTimeout(() => btn.classList.remove("publish-pulse"), 700);
    }
}

function formError(msg) {
    const el = document.getElementById("form-error");
    el.textContent = msg;
    el.classList.remove("hidden");
}

function resetForm() {
    document.getElementById("f-title").value = "";
    document.getElementById("f-body").value = "";
    document.getElementById("f-password").value = "";
    document.getElementById("links-container").innerHTML = "";
    addLinkField();
    attachedPhotos = [];
    renderPhotoPreviews();
    // keep username & subject for convenience
}

/* ───────────────────────────────────────────────
   SUCCESS SOUND  (Web Audio — pleasant chime)
   ─────────────────────────────────────────────── */
function playSuccessSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Ascending major arpeggio: C5 – E5 – G5 – C6
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            const t = ctx.currentTime + i * 0.09;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            osc.start(t);
            osc.stop(t + 0.5);
        });
    } catch (e) { console.warn("Audio not available:", e); }
}

/* ───────────────────────────────────────────────
   LIGHTBOX
   ─────────────────────────────────────────────── */
function openLightbox(src) {
    document.getElementById("lightbox-img").src = src;
    document.getElementById("lightbox").classList.remove("hidden");
}
function closeLightbox() {
    document.getElementById("lightbox").classList.add("hidden");
}

/* ───────────────────────────────────────────────
   HELPERS
   ─────────────────────────────────────────────── */
function esc(str) {
    return String(str)
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function normalizeUrl(url) {
    return /^https?:\/\//i.test(url) ? url : "https://" + url;
}
function prettyUrl(url) {
    try { return new URL(normalizeUrl(url)).hostname.replace(/^www\./, ""); }
    catch { return esc(url); }
}
function showBanner(html, type) {
    const el = document.getElementById("status-banner");
    const styles = {
        warn:  "bg-amber-500/15 border border-amber-400/30 text-amber-200",
        error: "bg-red-500/15 border border-red-400/30 text-red-200",
        info:  "bg-blue-500/15 border border-blue-400/30 text-blue-200"
    };
    el.className = "mb-4 px-4 py-3 rounded-xl text-sm " + (styles[type] || styles.info);
    el.innerHTML = html;
    el.classList.remove("hidden");
}

/* expose functions used by inline onclick handlers */
window.openModal = openModal;
window.closeModal = closeModal;
window.addLinkField = addLinkField;
window.handlePhotos = handlePhotos;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
