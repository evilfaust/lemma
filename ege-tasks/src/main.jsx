import React from 'react'
import ReactDOM from 'react-dom/client'
import './App.css'

const pathname = window.location.pathname;

let RootComponent;
if (pathname.startsWith('/student/')) {
  const StudentApp = React.lazy(() => import('./StudentApp.jsx'));
  RootComponent = () => (
    <React.Suspense fallback={<div style={{ textAlign: 'center', padding: '50px', fontSize: '18px' }}>Загрузка...</div>}>
      <StudentApp />
    </React.Suspense>
  );
} else {
  const App = React.lazy(() => import('./App.jsx'));
  RootComponent = () => (
    <React.Suspense fallback={<div style={{ textAlign: 'center', padding: '50px', fontSize: '18px' }}>Загрузка...</div>}>
      <App />
    </React.Suspense>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
)
