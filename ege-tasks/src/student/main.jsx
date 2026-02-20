import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp } from 'antd'
import '../App.css'
import StudentApp from '../StudentApp.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AntApp>
      <StudentApp />
    </AntApp>
  </React.StrictMode>,
)
