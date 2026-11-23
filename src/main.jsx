import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initPwa } from '@/lib/pwa'
import { installGlobalErrorReporting } from '@/lib/errorReporting'

initPwa()
installGlobalErrorReporting()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
