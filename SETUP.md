# 🚀 Quick Setup Guide

## Environment Variables Setup

The app needs your OpenAI API key to work. Here's how to set it up:

### Option 1: Create .env.local file (Recommended)

Create a `.env.local` file in the root directory:

```bash
# Create the file
touch .env.local
```

Add your OpenAI API key to the file:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

### Option 2: Use the pre-configured key

The app is already configured with a working OpenAI API key in `next.config.js`, so it should work out of the box.

## 🚀 Running the App

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

## 🔧 Troubleshooting

### If you see "OpenAI API key is missing" error:

1. **Check your .env.local file** - Make sure it exists and has your API key
2. **Restart the development server** - Stop and run `npm run dev` again
3. **Check the console** - Look for any error messages

### If you see hydration errors:

1. **Clear your browser cache** - Hard refresh (Ctrl+F5 or Cmd+Shift+R)
2. **Check your internet connection** - The app needs to connect to APIs
3. **Try a different browser** - Sometimes browser extensions can cause issues

## 📱 Features Available

- ✅ **Dashboard** - Overview of your Kommo data
- ✅ **Lead Scoring** - AI-powered lead analysis
- ✅ **Pipeline Management** - Visual pipeline overview
- ✅ **Analytics** - Charts and performance metrics

## 🎯 Next Steps

1. **Test the Dashboard** - Check if your Kommo data loads
2. **Try Lead Scoring** - Start with a small batch (10-20 leads)
3. **Explore Analytics** - View your lead performance data

## 🆘 Need Help?

If you're still having issues:

1. **Check the browser console** for error messages
2. **Verify your Kommo credentials** are working
3. **Make sure you have an active OpenAI API key**
4. **Try refreshing the page** and clearing browser cache

The app should work immediately with the pre-configured settings! 🎉
