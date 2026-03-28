I need to add full multi-user authentication, profiles, privacy, 
and security to the Cô Ơi Vietnamese learning app. Implement 
everything below in order. Do not skip steps.

## Context
- Vite + React 19 app deployed on Vercel
- Tailwind CSS v4 (CSS-first, @import "tailwindcss", no config file)
- Supabase already installed and connected (src/lib/supabase.js exists)
- Existing tables: weeks, flashcards, game_stats
- Current RLS policies are permissive "allow all" — these must be replaced
- Google Translate called directly from client (VITE_GOOGLE_API_KEY) — 
  must move server-side
- Anthropic API called directly from client (VITE_ANTHROPIC_API_KEY) — 
  must move server-side
- Simple useState router in App.jsx (no React Router installed)
- App has light/dark CSS variable theme system
- Existing CSS variable fonts: --font-pixel-viet (VT323), 
  --font-pixel-ui (Pixelify Sans), --font-pixel-score (Silkscreen)
- Logo component exists at src/components/Logo.jsx
- Header component exists at src/components/Header.jsx

---

## STEP 1 — Database migrations
Create file: supabase/migrations/002_auth_profiles.sql

Write SQL that does ALL of the following in order:

### Profiles table
create table profiles (
  id uuid references auth.users primary key,
  display_name text,
  avatar_color text default '#E8526A',
  native_language text default 'en',
  learning_language text default 'vi',
  class_name text,
  created_at timestamptz default now()
);

### Auto-create profile on signup trigger
Create a function handle_new_user() that inserts a new row into
profiles on every auth.users insert, setting id to new.id and
display_name to the part of the email before the @ symbol.
Attach it as an AFTER INSERT trigger on auth.users.

### Drop all existing permissive policies
drop policy if exists "allow all" on weeks;
drop policy if exists "allow all" on flashcards;
drop policy if exists "allow all" on game_stats;

### User-scoped RLS policies
Enable RLS on all tables if not already enabled.

weeks: users can only select/insert/update/delete rows where 
user_id = auth.uid()

flashcards: users can only select/insert/update/delete rows where 
the flashcard's week_id belongs to a week owned by auth.uid()
(use a subquery: week_id in (select id from weeks where user_id = auth.uid()))

game_stats: users can only select/insert/update/delete rows where 
user_id = auth.uid()

profiles: users can select and update only their own row 
(where id = auth.uid()). No insert policy needed — the trigger 
handles that with security definer.

### Account deletion function
Create a postgres function delete_user() with security definer
that deletes the calling user from auth.users. This cascades
to profiles via the FK. Weeks and flashcards cascade via their
own FK relationships.
Grant execute on delete_user() to authenticated.

---

## STEP 2 — Auth library
Create src/lib/auth.js with these exported async functions:

signInWithMagicLink(email)
  calls supabase.auth.signInWithOtp with email and 
  emailRedirectTo set to window.location.origin + '/auth/callback'

signOut()
  calls supabase.auth.signOut()

getCurrentUser()
  calls supabase.auth.getUser() and returns the user object or null

getProfile(userId)
  queries profiles table, selects all, eq id to userId, returns single

updateProfile(userId, updates)
  updates profiles table where id = userId with the updates object

deleteAccount()
  calls supabase.rpc('delete_user')

---

## STEP 3 — Auth context
Create src/context/AuthContext.jsx

Export an AuthProvider component and a useAuth() hook.

AuthProvider manages:
- user state (null initially)
- profile state (null initially)  
- loading state (true initially)

On mount, call supabase.auth.getSession() to get initial session.
Subscribe to supabase.auth.onAuthStateChange and update user state.
When user becomes non-null, fetch their profile and store it.
When user becomes null, clear profile.
Set loading to false after initial session check completes.
Clean up the auth subscription on unmount.

useAuth() returns { user, profile, loading, signOut, refreshProfile }
refreshProfile() re-fetches and updates profile state.

---

## STEP 4 — Login page
Create src/pages/Login.jsx

Layout: full screen centered column, dark navy background (#0d1018),
using existing app color variables where possible.

Top: <Logo size="lg" /> component
Below logo: "Cô Ơi" in --font-pixel-ui, coral color (#E8526A), 
large size
Tagline: "your Vietnamese class companion" in muted white, small

Form area (card-style container, rounded, subtle border):
- Heading: "Sign in" in --font-pixel-ui
- Subtext: "We'll send a magic link to your email — no password needed"
  in small muted text
- Email input: full width, large touch target (min 48px height),
  placeholder "your@email.com"
- Submit button: full width, coral background, white text,
  "Send magic link →" label, --font-pixel-ui
- Loading state: button shows "Sending..." and is disabled
- Success state: replace form with a confirmation panel showing
  a checkmark icon, "Check your email" heading, and the message
  "We sent a magic link to {email}. Click it to sign in."
  with a "Use a different email" text button to reset
- Error state: show error message below the button in red

Footer of page: small "Privacy Policy" text link that navigates
to the privacy page. Use --font-pixel-ui at small size.

---

## STEP 5 — Auth callback page
Create src/pages/AuthCallback.jsx

This page handles the redirect after a user clicks the magic link.

On mount, call supabase.auth.exchangeCodeForSession(
  window.location.search
) to complete the auth flow.

While processing: show a centered loading spinner with 
"Signing you in..." text in --font-pixel-ui.

On success: navigate to 'home' view in the app's router.

On error: navigate to 'login' view and pass an error message
"Sign in link expired or already used. Please request a new one."

The URL will contain a code parameter — parse it from 
window.location.search.

---

## STEP 6 — Auth guard component
Create src/components/AuthGuard.jsx

A wrapper component that:
- While loading: shows a full-screen loading state with the 
  Logo centered and a subtle pulsing animation
- When no user: renders the Login page
- When user exists: renders children

Import and use useAuth() from AuthContext.

---

## STEP 7 — Update Header.jsx
Import useAuth from AuthContext.

Add a UserMenu to the right side of the existing header layout.

UserMenu renders:
- A circular avatar (36px diameter) filled with the user's 
  profile.avatar_color, containing their display_name initial
  in white, --font-pixel-ui, centered
- display_name text next to the avatar, truncated at 120px max-width
- On click: toggle a small dropdown menu (position absolute, 
  top-right aligned, card style with border and shadow)

Dropdown contains:
- User's display_name as a non-clickable header in small muted text
- User's email in even smaller muted text below that
- Divider line
- "My Profile" button → navigates to 'profile' view
- "Sign out" button → calls signOut() from useAuth(), then 
  navigates to 'login' view
- Close dropdown when clicking outside (useEffect + document listener)

If profile is null (still loading), show a subtle placeholder circle.

---

## STEP 8 — Profile page
Create src/pages/Profile.jsx

Import useAuth. Fetch profile on mount. Allow editing and saving.

Layout: max-w-lg mx-auto, standard page padding.

Sections (use card containers matching app's existing card style):

### Account section
- Display name: text input, pre-filled with profile.display_name
- Class: text input, pre-filled with profile.class_name, 
  placeholder "e.g. Vietnamese 101 — Spring 2026"
- Email: read-only text showing user.email with a lock icon
- Save button: coral, full width on mobile

### Avatar color section
- Label: "Profile color"
- 6 color swatches (40px circles), clickable, showing a checkmark 
  on the selected one. Colors:
  #E8526A (coral — default), #F5A623 (gold), #5BAF7A (green),
  #6090D0 (blue), #C05080 (rose), #9070C0 (purple)
- Selecting a swatch immediately updates local state

### Language settings section  
- Native language: select dropdown, default "English"
  options: English, French, Spanish, Mandarin, Japanese, Korean, Other
- Learning language: select dropdown, default "Vietnamese"
  options: Vietnamese, French, Spanish, Mandarin, Japanese, Korean, Other
- (These power future multi-language support)

### Danger zone section
- Red-bordered card
- Heading: "Delete account" in --font-pixel-ui
- Description: "Permanently delete your account and all your 
  flashcards, weeks, and progress. This cannot be undone."
- "Delete my account" button: red outline style
- On click: show a confirmation dialog (simple inline, not browser alert):
  "Type DELETE to confirm" text input
  Confirm button only enabled when input value === 'DELETE'
  On confirm: call deleteAccount() from auth.js, then navigate to login

Back button at top to return to home.

---

## STEP 9 — Privacy page
Create src/pages/Privacy.jsx

Simple prose page. Use the app's standard page layout.

Content sections:

Heading: "Privacy Policy" with last updated date

"What we collect"
- Your email address (for sign-in only)
- Vocabulary and flashcards you create
- Study progress and game stats
- Your chosen display name and profile color

"What we never do"
- Sell or share your data with third parties
- Show you advertisements
- Use your content to train AI models

"Third-party services"
- Supabase: stores your account and data securely 
  (link to supabase.com/privacy)
- Google Cloud Translation: processes vocabulary text 
  to generate translations (link to cloud.google.com/terms/privacy)
- Anthropic: processes text for conversation practice and 
  phrase breakdowns (link to anthropic.com/privacy)

"Your rights"
- You can delete your account and all data at any time 
  from your Profile settings
- You can export your vocabulary by contacting us

"Contact"
- A placeholder email or note: "This app is a personal project. 
  For questions, contact your class instructor."

Back button to return to previous view.

---

## STEP 10 — Vercel serverless functions

### Create api/translate.js
A Vercel serverless function that proxies Google Translate.

Reads GOOGLE_API_KEY from process.env (never exposed to client).
Accepts POST requests with body: { q, source, target }
Adds CORS headers to allow requests from the app's origin.
Forwards to: https://translation.googleapis.com/language/translate/v2
Returns the translation response.
Returns 405 for non-POST requests.
Returns 500 with { error: 'Translation failed' } on API errors.

### Create api/claude.js
A Vercel serverless function that proxies the Anthropic API.

Reads ANTHROPIC_API_KEY from process.env.
Accepts POST requests with body: { model, messages, system, max_tokens }
Adds CORS headers.
Forwards to: https://api.anthropic.com/v1/messages
Sets required Anthropic headers: anthropic-version, x-api-key, 
content-type.
Always uses model claude-sonnet-4-20250514.
Returns the Anthropic response.
Returns 405 for non-POST requests.
Returns 500 with { error: 'Claude API failed' } on errors.

### Update src/lib/translate.js
Change the fetch URL from the Google endpoint to '/api/translate'.
Remove any reference to import.meta.env.VITE_GOOGLE_API_KEY.
Keep the translateToEnglish(text) function signature identical
so no other files need to change.

### Update all Claude API calls
Search the entire codebase for fetch calls to 
'https://api.anthropic.com/v1/messages'.
Replace every instance with a fetch to '/api/claude'.
Remove the x-api-key header (handled server-side now).
Remove any reference to import.meta.env.VITE_ANTHROPIC_API_KEY.
Keep all request body structures identical.

---

## STEP 11 — Update App.jsx

Import AuthProvider from AuthContext.
Import AuthGuard from AuthGuard.
Import AuthCallback from pages/AuthCallback.

Wrap the entire app in <AuthProvider>.

Add routing for these new views in the existing useState router:
- 'login' → <Login />
- 'auth/callback' → <AuthCallback />  
- 'profile' → <Profile /> (protected)
- 'privacy' → <Privacy /> (public, accessible without auth)

On mount, check if window.location.pathname includes '/auth/callback'
and if so, immediately render AuthCallback regardless of router state.

Wrap all protected views (home, week, study, game, profile) in 
<AuthGuard>. Login and privacy pages are not wrapped.

Pass navigate function down or use a simple setView approach
consistent with the existing routing pattern.

---

## STEP 12 — Update all data operations

Search the codebase for every supabase insert into weeks or flashcards.

For weeks inserts: add user_id: user.id from useAuth()
For flashcards inserts: user_id is inherited via the week's RLS,
but add it explicitly for clarity: user_id: user.id

Verify that all existing queries (selects) will still work correctly
now that RLS is enforced — they should automatically filter to the
current user's data without any query changes needed.

---

## STEP 13 — Environment variable cleanup

Update .env.example to:
- REMOVE: VITE_GOOGLE_API_KEY
- REMOVE: VITE_ANTHROPIC_API_KEY  
- ADD: GOOGLE_API_KEY (server-side, Vercel env vars)
- ADD: ANTHROPIC_API_KEY (server-side, Vercel env vars)
- KEEP: VITE_SUPABASE_URL (safe to expose — needed client-side)
- KEEP: VITE_SUPABASE_ANON_KEY (safe to expose — RLS protects the data)

Add a comment in .env.example explaining:
"GOOGLE_API_KEY and ANTHROPIC_API_KEY must be added to Vercel 
environment variables in the Vercel dashboard, NOT to .env 
(they are server-side only and must never be in the client bundle)"

---

## STEP 14 — Deployment configuration

Create vercel.json in the project root:
{
  "rewrites": [
    { "source": "/auth/callback", "destination": "/index.html" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}

This ensures the magic link redirect to /auth/callback works 
correctly on Vercel and that all client-side routes serve index.html.

---

## After completing all steps, verify:

1. A new user can enter their email on the login page and receive 
   a magic link

2. Clicking the magic link redirects to /auth/callback and then 
   to the home screen

3. The header shows their avatar and display name

4. Creating a week correctly saves user_id on the row

5. User A cannot see User B's weeks (test this by checking 
   that queries return empty for another user's data)

6. The /api/translate and /api/claude endpoints work locally 
   via vercel dev

7. VITE_GOOGLE_API_KEY and VITE_ANTHROPIC_API_KEY are gone from 
   all client-side code

8. Signing out returns to the login page

9. The profile page saves changes correctly

10. The delete account flow removes all user data

Tell me when each step is complete and flag any issues before 
moving to the next step.