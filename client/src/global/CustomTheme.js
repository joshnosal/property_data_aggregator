import { createTheme } from '@mui/material'
import { blue, blueGrey, deepOrange, red } from '@mui/material/colors'


const white = 'rgb(255,255,255)'

const CustomTheme = createTheme({
    palette: {
      primary: {main: blue[700], light: blue[500], dark: blue[900]},
      secondary: {main: deepOrange[700], light: deepOrange[500], dark: deepOrange[900]},
      warning: {main: red[700], light: red[300], dark: red[900]},
      background: {default: blueGrey[50], paper: white },
      grey: blueGrey
    },
    typography: {
      fontWeightRegular: 400,
      fontSize: 14
    },
    components: {
      MuiTextField: {
        defaultProps: {
        }
      },
      MuiInputLabel: {
      },
      MuiFormControlLabel: {
        styleOverrides: {
          label: {
            fontSize: 14,
          }
        }
      },
      MuiTablePagination: {
        styleOverrides: {
          displayedRows: {
            margin: 0
          }
        }
      },
      MuiFormLabel: {
        styleOverrides: {
          fontSize: 12
        },
      }
    },
})

export default CustomTheme