# Live LoL Esports

A React application for viewing live and upcoming League of Legends esports matches.

## 🛠️ Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6 with HashRouter
- **Styling**: CSS Modules with Theme Support
- **API**: Riot LoL Esports API
- **Deployment**: GitHub Pages

## 📦 Dependencies

| Package | Version | Usage |
|---------|---------|-------|
| [React](https://reactjs.org/) | ^18.2.0 | UI Framework |
| [React Router](https://reactrouter.com/) | ^6.8.0 | Routing |
| [Axios](https://axios-http.com/) | ^0.21.1 | HTTP Client |
| [React Toastify](https://fkhadra.github.io/react-toastify/) | ^9.1.1 | Notifications |
| [use-sound](https://www.joshwcomeau.com/react/use-sound/) | ^2.0.1 | Audio playback |
| [BigNumber.js](https://github.com/MikeMcl/bignumber.js/) | ^9.0.1 | Number handling |

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/aureom/live-lol-esports.git
   cd live-lol-esports
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173/` to view it in the browser.

## 📝 Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the app for production
- `npm run preview` - Preview the production build locally
- `npm run deploy` - Deploy to GitHub Pages

## 🌐 Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

```env
# Generate source maps for debugging (true/false)
GENERATE_SOURCEMAP=false
```

## 🏗️ Build & Deployment

### Building for Production

```bash
npm run build
```

This creates a `dist` folder with the production build.

### Local Preview

```bash
npm run preview
```

### GitHub Pages Deployment

The app is configured to deploy to GitHub Pages using the `gh-pages` package:

```bash
npm run deploy
```

## 📁 Project Structure

```
live-lol-esports/
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   ├── styles/            # Global styles
│   ├── theme/             # Theme configuration
│   ├── utils/             # Utility functions
│   ├── assets/            # Images and audio
│   ├── App.tsx            # Main app component
│   └── main.tsx           # App entry point
├── legacy/                # Original Create React App version
├── package.json
├── vite.config.ts
└── README.md
```

## 🔄 Migration Notes

This project has been migrated from Create React App to Vite + React 18. The original CRA version is preserved in the `legacy/` directory for reference.

### Key Changes

- **Build Tool**: Migrated from Create React App to Vite
- **React Version**: Upgraded to React 18 with `createRoot` API
- **Router**: Upgraded to React Router v6 with `HashRouter`
- **Locale**: Changed from Portuguese (pt-BR) to English (en-US)
- **Environment Variables**: Changed from `REACT_APP_*` to Vite's format

## 📚 API Documentation

The app uses the [LoL Esports API](https://github.com/vickz84259/lolesports-api-docs) by [vickz84259](https://github.com/vickz84259).

## 🐛 Troubleshooting

If you encounter any issues:

1. Clear the node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Check the console for any error messages

3. Ensure all environment variables are properly set

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
