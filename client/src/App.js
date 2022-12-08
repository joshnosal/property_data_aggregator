import CustomTheme from './global/CustomTheme'
import { ThemeProvider, CssBaseline, Box, Tabs, Tab, Button, useTheme } from '@mui/material'
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import DataPage from './data'
import AnalysisPage from './analysis'

function App() {
  const tabs = [
    {path: 'data', title: 'Data' },
    {path: 'analysis', title: 'Analysis' }
  ]
  const [ tab, setTab ] = useState(tabs[0])

  

  return (
    <ThemeProvider theme={CustomTheme}>
      <CssBaseline/>
      <Box sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <Header tabs={tabs}/>
        <Routes>
          <Route index element={<Navigate to='/data'/>}/>
          <Route path='data/*' element={<DataPage/>}/>
          <Route path='analysis/*' element={<AnalysisPage/>}/>
        </Routes>
      </Box>
      
    </ThemeProvider>
  );
}

export default App

const Header = ({ tabs, tab }) => {
  const { pathname } = useLocation()
  const theme = useTheme()
  const navigate = useNavigate()

  return (
    <Box sx={{
      padding: theme.spacing(1),
      background: theme.palette.background.paper,
      boxShadow: theme.shadows[3]
    }}>
      {tabs.map(tab => (
        <Button
          key={tab.path}
          variant={pathname.includes(tab.path) ? 'contained' : 'outlined'}
          disableElevation
          size='small'
          sx={{ marginRight: theme.spacing(2) }}
          onClick={() => navigate(tab.path)}
        >{tab.title}</Button>
      ))}
    </Box>
  )
}
