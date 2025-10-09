import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import 'react-toastify/dist/ReactToastify.min.css'
import App from './App.tsx'
import { ThemeProvider } from './theme/ThemeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
