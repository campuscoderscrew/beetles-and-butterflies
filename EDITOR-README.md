# Website Editor: Read Me

This folder includes a simple editor for the Beetles & Butterflies website. It runs **on your own computer**. It opens the website in your web browser with an editing bar at the bottom, so you can:

- **change words:** click any outlined text and type;
- **replace pictures:** click a picture and choose a new one, or drag a photo from your computer onto it;
- **update client photos and quotes** in the scrolling bar;
- **change where a link goes;**
- **save** your changes, then **publish** them to the live website.

It does **not** let you move things around, add or remove sections, or change colors and fonts. See [Limitations](#limitations) below.

---

## One-time setup

### Mac (Keemani)

1. **Get the website folder.** The easiest way is **GitHub Desktop** (free, desktop.github.com). Sign in with your GitHub account, then choose *File → Clone Repository* → `beetles-and-butterflies`. (Brennen must first add you as a collaborator on the repository.)
2. **Install Apple's Command Line Tools** (free; gives you Python and git). Open the **Terminal** app, type `xcode-select --install` and press Return, then click **Install** and wait for it to finish (5–15 minutes). If it says they're already installed, you're done.
3. **First launch only:** in Finder, open the website folder, **right-click** `Edit Website (Mac).command` and choose **Open**, then **Open** again. macOS asks this once because the file didn't come from the App Store.
   - If you see *"You do not have appropriate access privileges"*, open Terminal and type `chmod +x ` (with a space at the end), drag the `.command` file into the Terminal window, and press Return. Then try again.

### Windows (Brennen)

1. Install **Python 3** from python.org/downloads and tick **"Add python.exe to PATH"** during setup.
2. Have **git** installed (Git for Windows or GitHub Desktop) if you want to use the Publish button.

---

## Everyday use

1. Double-click **`Edit Website (Mac).command`** (Mac) or **`Edit Website (Windows).bat`** (Windows).
   A small black window opens and the website opens in your browser. **Leave the black window open** while you edit.
2. Edit:
   - **Text:** click outlined text and type. **Shift+Return** adds a line break. **⌘B / ⌘I** (Ctrl+B / Ctrl+I on Windows) for bold / italic.
     Pasted text arrives as plain text (no fonts or colors carried over from Word or email).
   - **Links:** click into the link's words. A **"Link goes to"** box appears in the bottom bar; change the address and press Return.
   - **Pictures:** click the picture to pick a new file, or drag a photo onto it. Large photos are automatically shrunk to a web-friendly size. If the same picture appears several times (like in the scrolling bar), you'll be asked whether to replace all of them.
   - **Client photos & quotes (scrolling bar on the Who We Are page):** click a client. Edit their words, or click **Replace photo…**. Every copy in the bar updates together.
   - **Other pages:** use the **Page** menu in the bottom bar. Links and buttons on the site are paused while editing so you don't navigate away by accident.
3. Click **Save changes**. Changed items have a gold border until you save. **Undo all** throws away unsaved changes on the current page.
4. When you're happy, click **Publish to website** (see below).
5. To stop, close the black window.

The passcode screen ("B&B") is skipped while you edit. Visitors still see it.

---

## Publishing to the live website

- **Publish button:** sends every saved change to GitHub, and the live site updates in a minute or two.
  It needs your computer to be signed in to GitHub. If Publish says it couldn't sign in, use the next option.
- **GitHub Desktop:** open GitHub Desktop. It lists your changed files. Type a short summary (e.g. "Updated Career Coaching text"), click **Commit to main**, then **Push origin**.
- **Or send it to Brennen:** tell him you've saved changes, and he can publish them for you.

---

## Limitations

**What you can't do with this editor** (ask Brennen for these):

- **Layout changes:** you can't move, add, delete, copy, or reorder boxes, sections, cards, list items, or pages.
- **Adding new things:** you can't add a new paragraph, bullet point, button, picture, or client to the scrolling bar. You can only change what's already there.
  *Tip:* until Brennen adds another client, you can reuse an existing slot by replacing its photo and quote.
- **Design:** you can't change colors, fonts, font sizes, spacing, or picture sizes and cropping. A new picture fills the same frame as the old one, so a very different shape (tall vs. wide) may be cropped.
- **Some text isn't clickable:** this includes button labels (e.g. "Send Message"), form field labels, dropdown choices (the "I'm interested in…" list), the browser-tab title, the passcode screen, and text that only appears in pop-ups or on small screens.
- **Line breaks:** Return does not start a new paragraph (Shift+Return adds a line break inside the same one).
- **Formatting:** only bold, italic, and links are kept. Other formatting is removed when you save.
- **Links:** you can change where a link goes and its words, but not add a brand-new link.
- **Videos:** there's no video upload. Put the video on YouTube (Unlisted is fine) or Instagram and change the relevant link to point to it.
- **Picture formats:** JPG, PNG, WebP, GIF and SVG work. iPhone **HEIC** photos only work in Safari. If one won't load, open it in Preview and choose *File → Export → JPEG*.
- **Forms:** the Let's Connect and Registration forms don't send anything yet. Use Google Forms links for real submissions.
- **Your computer only:** the editor runs on your own computer. It can't be used from a phone or tablet, or by two people at once.
- **Publishing:** publishing needs a GitHub sign-in on your computer (see above).
- **Not a security tool:** the passcode on the site only keeps casual visitors out. Never put private participant information on the website.

---

## If something goes wrong

- **Undo a saved change:** the version of each page from the start of your editing session is kept in `_editor/backups/<date-time>/`. Brennen can also restore any earlier published version from GitHub.
- **"This page changed since it was opened":** reload the page (⌘R / Ctrl+R) and make the change again.
- **"Please reload the page":** the editor was restarted; reload the browser tab.
- **The browser didn't open:** copy the address shown in the black window (like `http://127.0.0.1:8000/`) into your browser.
- **Mac says Python / Command Line Tools are missing:** repeat setup step 2.
- **Windows says Python is not installed:** reinstall from python.org and tick "Add python.exe to PATH".

---

## Notes for the developer

- **Files:** `_editor/server.py` (local server, Python standard library only, 3.7+), `_editor/htmltools.py` (tagging/patching/sanitizing), `_editor/editor.js` + `editor.css` (in-page UI), and the two launchers. Uploaded pictures go to `uploads/`.
- **How pages are marked:** on start-up, the editor gives every editable element a `data-edit="eN"` attribute in the `.html` files. This includes text elements that contain only text, bold, italic, or links; every `<img>`; and anything with `data-comment`. Nothing else in the files changes.
  Saves replace only the contents or attributes of those elements, so the rest of each file stays byte-for-byte the same.
- **Duplicate ids** (e.g. after copying a line by hand) are fixed automatically the next time the editor starts. Restart it after hand-editing pages.
- **Safety:** the server only listens on `127.0.0.1`, and every save needs a per-session token. It strips `gate.js` from pages only while editing. Edited text is cleaned to allow only `strong`, `em`, `u`, `small`, `sup`, `sub`, `span[class]`, `a[href,target,rel,class]` and `br`.
- **What gets published:** the `_editor/` folder and the launchers are published with the site. They're harmless there, because nothing runs without the local server. `_editor/backups/` is git-ignored.
