# AI Leads - Kommo CRM Lead Scoring & Management

An intelligent lead scoring and management system for Kommo CRM, powered by OpenAI's GPT models.

## Features

- 🤖 **AI-Powered Lead Scoring**: Automatically score leads based on communication activity, messages, and notes
- 📊 **Multiple Scoring Modes**: Score all leads, specific pipelines, or selected leads
- 📈 **Pipeline Management**: Move leads between pipelines and stages with intelligent user assignment
- 🔄 **Sequential User Assignment**: Automatically cycle through team members (Algo, Hayat, Fatima)
- 📝 **Communication Analysis**: Analyzes messages, calls, and notes to determine lead quality
- 💾 **Local Storage**: Persists scored results across sessions
- 📥 **CSV Import/Export**: Import and export scored leads for external analysis
- ⚡ **Real-time Updates**: Live progress tracking during scoring operations
- 🎯 **Smart Filtering**: Filter by score, pipeline, adult/non-adult, closed/open leads

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **AI**: OpenAI GPT-4o-mini
- **CRM**: Kommo API
- **Storage**: LocalStorage for caching scored results

## Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Kommo CRM account
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-leads.git
cd ai-leads
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```env
# Kommo CRM credentials
NEXT_PUBLIC_KOMMO_SUBDOMAIN=your-subdomain
NEXT_PUBLIC_KOMMO_ACCESS_TOKEN=your-kommo-token

# OpenAI API Key
OPENAI_API_KEY=your-openai-api-key
NEXT_PUBLIC_OPENAI_API_KEY=your-openai-api-key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

Vercel will automatically detect Next.js and configure the deployment.

## Usage

### Scoring Leads

1. Navigate to **Score Leads** page
2. Choose your scoring mode:
   - **All Leads**: Score all open leads
   - **Pipeline**: Score leads from a specific pipeline
   - **Selected**: Score only manually selected leads
3. Configure options:
   - Number of leads to score
   - Only score unscored leads (to save API costs)
4. Click **Start Scoring**

### Moving Leads

#### Move Leads (Updates existing leads)
- Use this to update leads in place
- Assigns to team members sequentially
- Shows only **scored leads** from selected pipeline

#### Pipeline Mover
- Use this to move leads between pipelines/stages
- Shows **all leads** from selected pipeline
- Great for bulk pipeline operations

### Viewing Results

- **Scored Results** page shows all scored leads
- Filter by score range, search by name
- Export to CSV for external analysis
- Import CSV files with scored data

## Rate Limits

**Important**: If using OpenAI's free tier (3 RPM), the system will:
- Automatically wait 21 seconds between requests
- Stop immediately if rate limit is hit
- Save progress before stopping

To scale beyond free tier limits, add a payment method to your OpenAI account.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues, questions, or contributions, please open an issue on GitHub.
