Full-Stack Developer: Take-Home Assignment
PadosiPro · Remote, India · Brief version 1.0, September 2026

Why this assignment
PadosiPro is a lifestyle management service: a household tells us what it needs, and a dedicated Lifestyle
Manager gets it done. Our customer app at app.padosipro.com is where that starts. A new user signs up,
verifies their email, tells us who they are, and picks the tasks they want handled.
This assignment is that first journey, built by you as a native mobile app with its own backend. It is close to
the first real piece of work you would own here.
Part A: Backend API
Any language and framework you are comfortable with (Node/TypeScript, Python, Go, Java all fine). Any
database; PostgreSQL or SQLite preferred. It must run locally with one documented command (Docker
Compose is ideal).
• Register with email and password. Store passwords with bcrypt or argon2, never plain or reversible.
• Email OTP: a 6-digit code, valid for 10 minutes, single use, at most 5 wrong attempts, and a resend
cooldown of about 30 seconds. Store only a hash of the code. Send real email through SMTP, or a
local mail catcher such as Mailpit or Ethereal; say which in your README.
• Login for verified users only, returning a token or session (JWT with expiry is fine). Unverified users are
sent back to verification.
• Profile: save Name, Mobile Number (Indian, +91, 10 digits), Address and Business Name. Business
Name may be optional; if you decide so, say why.
• Task catalogue: seed at least 20 tasks across at least 4 categories, modelled on app.padosipro.com.
Each has a name, category and short description.
• Task selection: save and return the tasks a user picked.
• Validate every input on the server and return clear error messages. Handle errors consistently.
Part B: Mobile app
React Native (Expo is fine), Flutter, or native Kotlin/Swift. No WebView of app.padosipro.com or of
anything else: build every screen natively. Use the site as your reference for layout, wording, colours and
flow.
• Register: email, password, confirm password, with inline validation.
• Verify email: enter the OTP, see a countdown for resend, and get clear messages for a wrong or
expired code.
• Login: for returning users. A logged-in user stays logged in after restarting the app.
• First-login profile: shown once, straight after the first successful login. Name, Mobile Number,
Address and Business Name.

PadosiPro | Full-Stack Developer assignment | Confidential Page 2
• Task Selection: tasks grouped by category, with search, multi-select and a confirm step. After saving,
show a simple home screen listing the selected tasks.
• Loading, empty and error states on every screen that talks to the network. No dead ends.
• Logout.
Part C: Engineering quality
• Tests for the risky logic at minimum: OTP generation, expiry, attempt limits and login rules.
• A README with prerequisites, backend setup, environment variables (ship a .env.example, never real
secrets), how to run the app, and how to build the APK.
• A short DESIGN.md (one page): your architecture, the main trade-offs, what you left out and what you
would do next with another week.
• Optional but welcome: a 2 to 3 minute screen recording of the full flow.
Deliverables
• Complete source code as a ZIP file, or a link to a GitHub repository (public, or private with access for
us).
• Built app file(s): an APK for Android, and/or an IPA or TestFlight link for iOS. Android alone is
completely fine; we know iOS builds need a paid Apple account.
• The README and DESIGN.md described above, so we can compile and run everything ourselves.
How we will review it
Area Weight What we look at
Working product 30% Every flow in Part B works end to end on a real device or emulator
Backend and security 25% OTP handling, password storage, auth, validation, data model
UI/UX 20% Faithful to app.padosipro.com, clean on small screens, clear states
Code quality and tests 15% Structure, naming, meaningful tests for the risky parts
Documentation 10% Someone else can run it from your README in under 15 minutes
We will build it from your instructions, run the whole flow, and read the code. A smaller scope done
properly beats every feature done halfway.
Ground rules
• Your own work. AI assistants and libraries are fine, but in the final round you will walk us through the
code and should be able to explain any part of it.
• Do not call PadosiPro's production APIs, and do not copy code or assets from our site beyond what you
need as a visual reference.
• Use test data only. No real personal information.

PadosiPro | Full-Stack Developer assignment | Confidential Page 3
Timeline and questions
Reply to the email with the date you plan to submit by. Most candidates need about a week alongside their
current commitments. If anything here is unclear, ask before you build: a good question is a good signal.
Write to hanmanth@padosipro.com.
Once you submit, we review your work, and if it meets our expectations we invite you to a final-round