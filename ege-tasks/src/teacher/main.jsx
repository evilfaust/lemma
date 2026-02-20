import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp } from 'antd'
import '../App.css'
import App from '../App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AntApp>
      <App />
    </AntApp>
  </React.StrictMode>,
)
