import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { CurriculumPage } from './pages/CurriculumPage'
import { ModulePage } from './pages/ModulePage'
import { LessonPage } from './pages/LessonPage'
import { ProjectPage } from './pages/ProjectPage'
import { RoadmapPage } from './pages/RoadmapPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { FAQPage } from './pages/FAQPage'
import { NotFoundPage } from './pages/NotFoundPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'curriculum', element: <CurriculumPage /> },
      { path: 'curriculum/:moduleId', element: <ModulePage /> },
      { path: 'curriculum/:moduleId/:lessonId', element: <LessonPage /> },
      { path: 'curriculum/:moduleId/project/:projectId', element: <ProjectPage /> },
      { path: 'roadmap', element: <RoadmapPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'faq', element: <FAQPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]
