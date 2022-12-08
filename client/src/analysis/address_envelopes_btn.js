import { Button, Modal, useTheme, Box, Dialog, MenuItem, Select, useMediaQuery } from '@mui/material'
import axios from 'axios'
import { useEffect, useReducer, useState } from 'react'

let zipPriority = [
  75225,
  75205,
  75230,
  75229,
  75209,
  75019,
  75214,
  75082,
  75244,
  75201,
  75048,
  75218,
  75248,
  75088,
  75063,
  75204,
  75089,
  75219,
  75202,
  75238,
  75206,
  75208,
  75154,
  75081,
  75080,
  75044,
  75006,
  75181,
  75234,
  75104,
  75052,
  75137,
  75220,
  75254,
  75115,
  75038,
  75043,
  75040,
  75240,
  75159,
  75223,
  75062,
  75249,
  75060,
  75050,
  75146,
  75041,
  75231,
  75150,
  75042,
  75180,
  75233,
  75236,
  75061,
  75134,
  75243,
  75149,
  75235,
  75211,
  75228,
  75246,
  75232,
  75224,
  75227,
  75116,
  75252,
  75203,
  75215,
  75051,
  75253,
  75212,
  75172,
  75141,
  75241,
  75217,
  75216,
  75237,
  75210,
]

const reducer = (s,a) => ({...s, ...a})

export default function AddressEnvelopesButton(props){
  const theme = useTheme()
  const [ state, dispatch ] = useReducer(reducer, {
    open: false,
    zipCodes: []
  })

  useEffect(() => {
    let data = JSON.parse(JSON.stringify(props.properties))
    let zipCodes = []
    data = data.filter(item => !item.mailing_details.addressed_envelope)
    for(const zip of zipPriority) {
      let obj = {
        zip,
        properties: data.filter(item => Number(item.targetZip) === zip)
      }
      if(obj.properties.length) zipCodes.push(obj)
      data = data.filter(item => Number(item.targetZip) !== zip)

    }
    if(data.length) zipCodes = { zip: 'Other', properties: data}
    dispatch({ zipCodes, open: false })
  }, [props.properties])

  // useEffect(() => {
  //   if(!state.open && state.zipCodes.length) props.refresh() 
  // }, [state.open])

  const updateZipCodes = (codes) => dispatch({zipCodes: codes})

  return (
    <>
      <Button
        size='small'
        color='secondary'
        variant='contained'
        onClick={() => dispatch({ open: true })}
        sx={{ marginLeft: theme.spacing(2) }}
      >
        Address Envelopes
      </Button>
      <CustomDialog 
        open={state.open} 
        onClose={props.refresh} 
        zipCodes={state.zipCodes} 
        updateZipCodes={updateZipCodes}
      />
    </>
  )
}

const CustomDialog = ({ open, onClose, zipCodes, updateZipCodes }) => {
  const [ zipCode, setZipCode ] = useState({zip: 'None', properties: [] })
  const [ property, setProperty ] = useState({})
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'))

  const handleZipSelect = (e) => {
    for(const zip of zipCodes) {
      if(zip.zip === e.target.value) return setZipCode(zip)
    }
  }

  useEffect(() => {
    setZipCode(zipCodes.length ? zipCodes[0] : {zip: 'None', properties: [] })
  }, [zipCodes])

  useEffect(() => {
    if(zipCode) {
      setProperty(zipCode.properties.length ? zipCode.properties[0] : {})
    } else {
      setProperty({})
    }
  }, [zipCode])

  const markEnvelopeComplete = () => {
    // Send message to server to mark complete
    axios.post('/api/mailings/mark_addressed_envelope_complete', {property})
    .then(res => {
      let clone = JSON.parse(JSON.stringify(zipCode))
      clone.properties = clone.properties.filter(item => item._id !== property._id)
      if(clone.properties.length) {
        setZipCode(clone)
      } else {
        let clone2 = JSON.parse(JSON.stringify(zipCodes))
        clone2 = clone2.filter(item => item.zip !== clone.zip)
        updateZipCodes(clone2)
      }
    })
    .catch(e => console.log(e))
    
    // On success
    
  }

  const styles = {
    row: {
      display: 'flex'
    },
    col1: {
      fontWeight: 600,
      textAlign: 'right',
      paddingRight: theme.spacing(2),
      minWidth: 200,
      fontSize: 22
    },
    col2: {
      fontSize: 22
    }
  }

  return (
    <Dialog
      open={open} 
      onClose={onClose} 
      fullScreen={fullScreen}
    >
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        padding: theme.spacing(2)
      }}>
        <Select
          label='Zip Code'
          value={zipCode.zip}
          renderValue={value => value + ' (' + zipCode.properties.length + ')'}
          size='small'
          onChange={handleZipSelect}
        >
          {zipCodes.map((item) => (
            <MenuItem key={item.zip} value={item.zip}>{item.zip + ' (' + item.properties.length + ')'}</MenuItem>
          ))}
        </Select>
        {property.mailing_details ? (
          <>
          <Box sx={{...styles.row, marginBottom: theme.spacing(4)}}>
            <Box sx={styles.col1}>Target Address:</Box>
            <Box sx={{...styles.col2, color: theme.palette.grey[200]}}>{property.mailing_details.target_property_address}</Box>
          </Box>
          <Box sx={styles.row}>
            <Box sx={styles.col1}>First Names:</Box>
            <Box sx={styles.col2}>{property.mailing_details.first_names}</Box>
          </Box>
          <Box sx={{...styles.row, marginBottom: theme.spacing(2)}}>
            <Box sx={styles.col1}>Full Names:</Box>
            <Box sx={styles.col2}>{property.mailing_details.full_names}</Box>
          </Box>
          <Box sx={styles.row}>
            <Box sx={styles.col1}>Line 1:</Box>
            <Box sx={styles.col2}>{property.mailing_details.firstAddressLine}</Box>
          </Box>
          <Box sx={styles.row}>
            <Box sx={styles.col1}>Line 2:</Box>
            <Box sx={styles.col2}>{property.mailing_details.cityStateZipAddressLine}</Box>
          </Box>
          </>
        ) : (
          <Box sx={{
            margin: theme.spacing(2)
          }}>No More Properties!</Box>
        )}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: theme.spacing(2)
        }}>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={markEnvelopeComplete}
          >
            Mark Complete
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}