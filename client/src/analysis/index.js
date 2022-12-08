import { Box, Button, Checkbox, CircularProgress, FormControlLabel, useTheme } from '@mui/material'
import { DataGrid, GridCheckIcon, GridEditInputCell, useGridApiContext,GridToolbar } from '@mui/x-data-grid'
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx/xlsx.mjs'
import readXlsxFile from 'read-excel-file'
import PDFPrintButton from './pdf_print_btn'
import AddressEnvelopesButton from './address_envelopes_btn'

const getTargetZips = (properties) => {
  for(const property of properties) {
    let array = property.mailing_details.target_property_address.split(' ')
    property.targetZip = array.pop()
  }
  return properties
}

export default function AnalysisPage(props){
  const theme = useTheme()
  const [properties, setProperties] = useState([])
  const [refresh, setRefresh] = useState(false)
  
  useEffect(() => {
    axios.get('/api/mailings/all_properties')
    .then(({data}) => {
      data = getTargetZips(data)
      data.sort((a,b) => a.targetZip > b.targetZip ? 1 : a.targetZip < b.targetZip ? -1 : 0)
      setProperties(data)
    })
    .catch(e => console.log(e))
  }, [refresh])

  const formatDollars = ({ value }) => (value !== undefined ? '$' + Math.round(value).toLocaleString('en-US') : '')

  const columns = [
    { 
      field: 'apn', 
      headerName: 'ID', 
      width: 180,
      renderCell: (({ value }) => (
        <a href={`https://www.dallasact.com/act_webdev/dallas/showdetail2.jsp?can=${value}&ownerno=0`} target="_blank" rel="noreferrer noopener">{value}</a>
      )),
    },
    {
      field: 'address_verified_internal',
      headerName: 'Checked',
      type: 'boolean'
    },
    {
      field: 'address_verified_external',
      headerName: 'Verified',
      type: 'boolean'
    },
    {
      field: 'mailing_details.addressed_envelope',
      headerName: 'Addressed',
      type: 'boolean',
      valueGetter: ({ row }) => (row.mailing_details.addressed_envelope),
    },
    {
      field: 'targetZip',
      headerName: 'Zip',
    },
    {
      field: 'mailing_details.first_names',
      headerName: 'First Names',
      width: 200,
      valueGetter: ({ row }) => (row.mailing_details.first_names),
    },
    {
      field: 'mailing_details.full_names',
      headerName: 'Full Names',
      width: 300,
      valueGetter: ({ row }) => (row.mailing_details.full_names),
    },
    {
      field: 'mailing_details.firstAddressLine',
      headerName: 'Street 1',
      width: 250,
      valueGetter: ({ row }) => (row.mailing_details.firstAddressLine),
    },
    {
      field: 'mailing_details.cityStateZipAddressLine',
      headerName: 'Street 2',
      width: 400,
      valueGetter: ({ row }) => (row.mailing_details.cityStateZipAddressLine),
    },
    {
      field: 'mailing_details.target_property_address',
      headerName: 'Target',
      width: 400,
      valueGetter: ({ row }) => (row.mailing_details.target_property_address),
    },
    {
      field: 'mailing_details.assessedValue',
      headerName: 'Assessed',
      // width: 400,
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.mailing_details.assessedValue),
    },
    {
      field: 'mailing_details.avm',
      headerName: 'AVM',
      // width: 400,
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.mailing_details.avm),
    },
    {
      field: 'mailing_details.purchase_price',
      headerName: 'Purchase Price',
      // width: 400,
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.mailing_details.purchase_price),
    },
    {
      field: 'mailing_details.tax_amount',
      headerName: 'Tax',
      // width: 400,
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.mailing_details.tax_amount),
    },
    {
      field: 'mailing_details.mortgage_amount',
      headerName: 'Mortgage',
      // width: 400,
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.mailing_details.mortgage_amount),
    },
    {
      field: 'mailing_details.closing_costs',
      headerName: 'Closing Costs',
      // width: 400,
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.mailing_details.closing_costs),
    },
    {
      field: 'mailing_details.seller_proceeds',
      headerName: 'Seller Proceeds',
      // width: 400,
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.mailing_details.seller_proceeds),
    }
  ]

  const verifyAddresses = () => {
    axios.get('/api/mailings/verify_addresses')
    .then(res => console.log(res.data))
    .catch(e => console.log(e))
  }

  const populateLetterEconomics = () => {
    axios.get('/api/mailings/populate_letter_details')
  } 

  const handleFileSelect = (e) => {

  }


  return (
    <Box sx={{
      flexGrow: 1,
      padding: theme.spacing(2),
      display: 'flex',
      overflow: 'hidden'
    }}>
      <Box sx={{
        background: theme.palette.background.paper,
        borderRadius: theme.spacing(1),
        boxShadow: theme.shadows[3],
        padding: theme.spacing(1),
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <Box sx={{
          paddingBottom: theme.spacing(1),
          display: 'flex',
          alignItems: 'center'
        }}>
          <Button 
            variant='contained'
            disableElevation
            size='small'
            onClick={verifyAddresses}
          >
            Verify Addresses
          </Button>
          <Button
            variant='contained'
            disableElevation
            size='small'
            sx={{ marginLeft: theme.spacing(2) }}
            onClick={populateLetterEconomics}
          >
            Economics
          </Button>
          <PDFPrintButton properties={properties}/>
          <AddressEnvelopesButton properties={properties} refresh={() => setRefresh(!refresh)}/>
        </Box>
        <Box sx={{
          flexGrow: 1,
          display: 'flex',
          overflow: 'hidden'
        }}>
          <DataGrid
            rows={properties}
            getRowId={row => row._id}
            columns={columns}
            density='compact'
            disableDensitySelector
            components={{
              Toolbar: GridToolbar
            }}
            onRowClick={params => console.log(params.row)}
            experimentalFeatures={{ newEditingApi: true }}
          />
        </Box>
      </Box>
    </Box>
  )
}