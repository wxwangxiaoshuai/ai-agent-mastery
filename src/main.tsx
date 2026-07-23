import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import { ProgressProvider } from './components/ProgressProvider'
import { routes } from './router'
import './index.css'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

const router = createBrowserRouter(routes, {
  basename: basename || undefined,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ProgressProvider>
        <RouterProvider router={router} />
      </ProgressProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
