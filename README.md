# Academic Plug

Static GitHub Pages site for Academic Plug.

## Real auth setup

The site now expects Supabase Auth for:

- sign up
- login
- remembered sessions across visits
- forgot password email links
- password reset

### 1. Create a Supabase project

Create a project in Supabase, then go to:

- `Project Settings -> API`

Copy:

- project URL
- anon public key

### 2. Configure the site

Edit:

- `/Users/amna/Desktop/Mansur/Skyline HS/CAS Project/Academic Plug/site/supabase-config.js`

Replace:

- `YOUR_SUPABASE_URL`
- `YOUR_SUPABASE_ANON_KEY`

The anon key is safe to expose in the frontend. Do not put a service role key in this file.

### 3. Configure Supabase Auth URLs

In Supabase, set your site URL and redirect URL to your live GitHub Pages domain:

- `Site URL`: `https://mansurakhan.github.io/academic-plug/`
- `Redirect URL`: `https://mansurakhan.github.io/academic-plug/login.html`

If you test locally as well, also add:

- `http://localhost:8012/Academic%20Plug/site/login.html`

### 4. Email/password auth

In Supabase:

- enable `Email` provider
- choose whether email confirmation is required

If confirmation is enabled, sign-up will tell the user to check email before logging in.

### 5. Publish

Commit and push the updated site files to:

- [https://github.com/MansurAKhan/academic-plug](https://github.com/MansurAKhan/academic-plug)

GitHub Pages should publish from:

- branch: `main`
- folder: `/ (root)`
