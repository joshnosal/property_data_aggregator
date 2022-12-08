import { Button, useTheme } from '@mui/material'
import axios from 'axios'


export default function ServerPrintButton(props) {
  const theme = useTheme()

  const handleClick = () => {
    let ids = props.properties.map(item => item._id)
    axios.get('/api/mailings/upload_recipients')
  }

  return (
    <Button
      size='small'
      disableElevation
      color='primary'
      variant='contained'
      sx={{ marginLeft: theme.spacing(1) }}
      onClick={handleClick}
    >
      Server Print
    </Button>
  )
}