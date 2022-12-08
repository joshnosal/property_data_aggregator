import { Box, Button, CircularProgress, Collapse, IconButton, TextField, useTheme } from '@mui/material'
import { DataGrid, GridEditInputCell, GridEditSingleSelectCell, GridToolbar, useGridApiContext } from '@mui/x-data-grid'
import axios from 'axios'
import { useEffect, useState } from 'react'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import async from 'async'

import PDFPrintButton from './pdf_print_button'
import DownloadExcelButton from './download_excel'
import ServerPrintButton from './server_print_button'


export default function DataPage(props){
  const theme = useTheme()
  return (
    <Box sx={{
      flexGrow: 1,
      padding: theme.spacing(2),
      display: 'flex',
      overflow: 'hidden'
    }}>
      {/* <StreetGrid/> */}
      <PropertyGrid/>
    </Box>
  )
}

const StreetGrid = (props) => {
  const theme = useTheme()
  const [ streets, setStreets ] = useState([])
  const [ counter, setCounter ] = useState(null)

  const getStreets = () => {
    axios.get('/api/property/all_streets')
    .then(({ data }) => {
      if(Array.isArray(data) && data.length){
        setStreets(data)
      } else {
        setStreets([])
      }
    })
    .catch(e => {})
  }

  useEffect(()=>{
    if(!counter) getStreets()
    clearInterval(counter)

    setCounter(setInterval(() => {
      getStreets()
    }, 1000 * 60))

    return () => clearInterval(counter)
  }, [])


  const columns = [
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'ids_pulled', headerName: 'IDs', type: 'boolean', valueGetter: ({ value }) => Boolean(value) },
    { field: 'details_pulled', headerName: 'Details', type: 'boolean', valueGetter: ({ value }) => Boolean(value) }
  ]

  const getIDsTotal = (array, key) => {
    let total = array.length
    let count = 0
    for(const item of array) {
      if(item[key]) count++
    }
    return `${count} of ${total} (${Math.round((count / total) * 100)}%)`
  }

  const styles = {
    label: {
      fontWeight: 700,
      fontSize: 12,
      paddingLeft: theme.spacing(0.5)
    },
    string: {
      fontSize: 12,
    }
  }

  return (
    <Box sx={{
      background: theme.palette.background.paper,
      borderRadius: theme.spacing(1),
      boxShadow: theme.shadows[3],
      padding: theme.spacing(1),
      minWidth: 450,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      overflow: 'hidden'
    }}>
      <Box sx={{
        paddingBottom: theme.spacing(1),
        display: 'flex',
        alignItems: 'center'
      }}>
        <Button
          variant='contained'
          color='secondary'
          size='small'
          disableElevation
          onClick={getStreets}
        >Refresh</Button>
        <Box sx={styles.label}>IDs:</Box>
        <Box sx={styles.string}>{getIDsTotal(streets, 'ids_pulled')}</Box>
        <Box sx={styles.label}>Details:</Box>
        <Box sx={styles.string}>{getIDsTotal(streets, 'details_pulled')}</Box>
      </Box>
      
      <Box sx={{
        flexGrow: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        <DataGrid
          rows={streets}
          getRowId={row => row._id}
          columns={columns}
          density='compact'
          // autoHeight={true}
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              background: theme.palette.primary.main,
              color: theme.palette.primary.contrastText
            },
            '& .MuiDataGrid-columnHeader:last-child .MuiDataGrid-columnSeparator': {
              display: 'none'
            },
          }}
        />
      </Box>
    </Box>
  )
}

const PropertyGrid = (props) => {
  const theme = useTheme()
  const [ properties, setProperties ] = useState([])
  const [ rawData, setRawData ] = useState([])
  const [ filters, setFilters ] = useState({
    property_address: '',
    prior_year_amount_due: { min: null, max: null },
    current_tax_levy: { min: null, max: null },
    market_value: { min: null, max: null },
    land_value: { min: null, max: null },
    years_arrears: { min: null, max: null },
  })
  const [ filtersOpen, setFiltersOpen ] = useState(false)
  const [ counter, setCounter ] = useState(null)
  const [ searching, setSearching ] = useState(false)

  const getProperties = () => {
    let array = []
    let searching = true
    let searchFor = 500
    let count = 0
    setSearching(true)
    async.whilst(
      (cb) => {cb(null, searching)},
      (next) => {
        axios.post('/api/property/all_properties', {searchFor: searchFor, count: count})
        .then(({ data }) => {
          if(!data.length) {
            searching = false
            return next(null)
          }
          count = count + data.length
          for(const item of data) item.years_arrears = Math.round(item.prior_year_amount_due * 10 / item.current_tax_levy) / 10
          array = array.concat(data)
          if(array.length >= rawData.length) setRawData(array)
          setRawData(array)
          console.log('Loaded',count,'properties')
          setSearching(count)
          next(null)
        })
        .catch(next)
      },
      (err, res) => {
        if(err) console.log(err)
        setSearching(false)
      }
    )
  }

  
  const populateFormData = (data) => {
    const capitalizeWord = (word) => (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    const capitalizeSentence = (sentence) => {
      sentence = sentence.split(' ')
      for(const i in sentence) {
        sentence[i] = capitalizeWord(sentence[i])
      }
      return sentence.join(' ')
    }
    const getFirstNames = (prop) => {
      let string = ''
      if(prop.owner) {
        if(prop.owner.corporateindicator === 'Y') {
          let string = prop.owner.owner1.lastname.toUpperCase().trim()
          let index = string.indexOf('EST')
          if(index === string.length - 3) return 'Estate Administrator'
          index = string.indexOf('EST OF')
          if(index === string.length - 6) return 'Estate Administrator'
          return 'Sir or Madam'
        } else {
          if(prop.owner.owner1) {
            if (prop.owner.owner1.firstnameandmi) {
              let index = prop.owner.owner1.firstnameandmi.indexOf(' ')
              string = index === -1 ? string + capitalizeWord(prop.owner.owner1.firstnameandmi)
                : string + capitalizeWord(prop.owner.owner1.firstnameandmi.slice(0,index))
            } else if (prop.owner.owner1.lastname) {
              string = string + 'Mr/Mrs ' + capitalizeWord(prop.owner.owner1.lastname)
            }
          } 
          if(prop.owner.owner2) {
            if(prop.owner.owner1) {
              string = prop.owner.owner3 ? string + ', ' : string + ' and '
            }
            if (prop.owner.owner2.firstnameandmi) {
              let index = prop.owner.owner2.firstnameandmi.indexOf(' ')
              string = index === -1 ? string + capitalizeWord(prop.owner.owner2.firstnameandmi)
                : string + capitalizeWord(prop.owner.owner2.firstnameandmi.slice(0,index))
            } else if (prop.owner.owner2.lastname) {
              string = string + 'Mr/Mrs ' + capitalizeWord(prop.owner.owner2.lastname)
            }
          }
          if(prop.owner.owner3) {
            if(prop.owner.owner1 || prop.owner.owner2) string = string + ' and '
            if (prop.owner.owner3.firstnameandmi) {
              let index = prop.owner.owner3.firstnameandmi.indexOf(' ')
              string = index === -1 ? string + capitalizeWord(prop.owner.owner3.firstnameandmi)
                : string + capitalizeWord(prop.owner.owner3.firstnameandmi.slice(0,index))
            } else if (prop.owner.owner3.lastname) {
              string = string + 'Mr/Mrs ' + capitalizeWord(prop.owner.owner3.lastname)
            }
          }
        }
        return string
      } else if (prop.owner_name) {
        let string = prop.owner_name.toUpperCase()
        let index = string.indexOf('EST OF')
        console.log(index)
        if(index === string.length - 5) return 'Estate Administrator'

        return 'Sir or Madam'
      } else {
        return 'Sir or Madam'
      }
    }
    const getFullNames = (prop) => {
      let array = []
      if(prop.owner) {
        if(prop.owner.owner1) {
          let string = ''
          if(prop.owner.owner1.firstnameandmi) string = prop.owner.owner1.firstnameandmi.split(' ')[0] + ' '
          string = string + prop.owner.owner1.lastname
          array.push(string)
        }
        if(prop.owner.owner2) {
          let string = ''
          if(prop.owner.owner2.firstnameandmi) string = prop.owner.owner2.firstnameandmi.split(' ')[0] + ' '
          string = string + prop.owner.owner2.lastname
          array.push(string)
        }
        if(prop.owner.owner3) {
          let string = ''
          if(prop.owner.owner3.firstnameandmi) string = prop.owner.owner3.firstnameandmi.split(' ')[0] + ' '
          string = string + prop.owner.owner3.lastname
          array.push(string)
        }
      } else if (prop.owner_name) {
        let string = prop.owner_name
        let index = string.toUpperCase().indexOf('EST OF')
        if(index === string.length - 6) {
          string = string.slice(index) + ' ' + string.slice(0,index)
          array.push(string)
        } else {
          array.push(prop.owner_name)
        }
      } else {
        array.push('PRIMARY RESIDENT')
      }
      return array
    }
    const getMailingAddress = (prop) => {
      let array = []
      const getArray = (string) => {
        let index = string.indexOf(',')
        return [string.slice(0,index).trim(), string.slice(index+1).trim()]
      }
      if(prop.owner && prop.owner.mailingaddressoneline) {
        array = getArray(prop.owner.mailingaddressoneline)
      } else if (prop.owner_address) {
        array = getArray(prop.owner_address)
      }
      return array
    }
    const getEconomics = (prop) => {
      const confirmNum = (val) => {
        val = Number(val)
        return isNaN(val) ? 0 : Math.round(val)
      }
      let economics = {}
      economics.purchase_price = confirmNum(Math.min(...[prop.market_value * 0.5, prop.avm.amount.value * 0.4]))
      economics.tax = confirmNum((prop.prior_year_amount_due || 0) + (prop.current_tax_levy || 0))
      economics.mortgage = confirmNum((prop.homeEquity.totalEstimatedLoanBalance || 0))
      economics.closing_costs = confirmNum(economics.purchase_price * 0.05)
      economics.seller_proceeds = confirmNum(economics.purchase_price - economics.tax - economics.mortgage - economics.closing_costs)
      return economics
    }

    for(const property of data) {
      let newFormData = {}
      newFormData.firstNames = getFirstNames(property)
      newFormData.fullNames = getFullNames(property)
      newFormData.mailingAddress = getMailingAddress(property)
      newFormData.economics = getEconomics(property)
      property.formData = newFormData
    }
    return data
  }

  useEffect(() => {
    if(searching) return
    if(!searching && !rawData.length) return
    let keys = Object.keys(filters)
    let data = [...rawData]
    
    data = data.filter(item => Boolean(item.attom_id))
    
    for(const key of keys) {
      if(key === 'property_address' && filters[key]) {
        data = data.filter(item => item.property_address.includes(filters[key]))
      } else {
        if(filters[key].min) data = data.filter(item => item[key] > filters[key].min)
        if(filters[key].max) data = data.filter(item => item[key] < filters[key].max)
      }
    }
    data = populateFormData(data)
    data = data.filter(item => item.formData.economics.seller_proceeds > 0)
    data = data.filter(item => {
      if(!item.saleHistory.length || !item.saleHistory[0].saleTransDate) return true
      if(!item.years_arrears || item.years_arrears <=0) return false
      let now = new Date()
      let dateSold = new Date(item.saleHistory[0].saleTransDate)
      let arrearsDate = new Date(now.getFullYear(),now.getMonth(),now.getDate() - (365 * item.years_arrears), now.getFull)
      return arrearsDate < dateSold ? false : true
    })
    data = data.filter(item => Boolean(item.current_tax_levy && item.current_tax_levy > 0 && item.prior_year_amount_due && item.prior_year_amount_due > 0))
    data = data.filter(item => item.years_arrears < 20)

    // console.log(data)
    setProperties(data)

  }, [rawData, filters, searching])

  useEffect(()=>{
    getProperties()
    // if(!counter) getProperties()
    // clearInterval(counter)

    // setCounter(setInterval(() => {
    //   getProperties()
    // }, 1000 * 120 * 5))

    // return () => clearInterval(counter)
  }, [])

  const formatDollars = ({ value }) => (value !== undefined ? '$' + Math.round(value).toLocaleString('en-US') : '')

  const columns = [
    { 
      field: 'apn', 
      headerName: 'ID', 
      width: 180,
      renderCell: (({ value }) => (
        <a href={`https://www.dallasact.com/act_webdev/dallas/showdetail2.jsp?can=${value}&ownerno=0`} target="_blank" rel="noreferrer noopener">{value}</a>
      )),
      hide: true
    },
    { 
      field: 'address', 
      headerName: 'Address', 
      width: 300,
      valueGetter: ({ value }) => (value.oneLine)
    },
    { 
      field: 'firstName', 
      headerName: 'First Names', 
      width: 300,
      hide: true,
      valueGetter: ({ row }) => (row.formData.firstNames)
    },
    { 
      field: 'fullNames', 
      headerName: 'Full Names', 
      width: 300,
      hide: true,
      renderCell: (({ row }) => (
        <Box>
          {row.formData.fullNames.map((name) => (
            <Box key={name}>{name}</Box>
          ))}
        </Box>
      ))
    },
    { 
      field: 'mailingaddress', 
      headerName: 'Mail To', 
      width: 300,
      hide: true,
      renderCell: (({ row }) => (
        <Box>
          {row.formData.mailingAddress.map((line) => (
            <Box key={line}>{line}</Box>
          ))}
        </Box>
      ))
    },
    {
      field: 'purchase_price',
      headerName: 'Purchase Price',
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.formData.economics.purchase_price)
    },
    {
      field: 'taxes',
      headerName: '-Taxes',
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.formData.economics.tax)
    },
    {
      field: 'mortgage',
      headerName: '-Mortgage',
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.formData.economics.mortgage)
    },
    {
      field: 'closing_costs',
      headerName: '-Costs',
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.formData.economics.closing_costs)
    },
    {
      field: 'seller_cash',
      headerName: 'Seller Cash',
      valueFormatter: formatDollars,
      valueGetter: ({ row }) => (row.formData.economics.seller_proceeds)
    },
    {
      field: 'net_value',
      headerName: 'Net Value',
      valueFormatter: formatDollars,
      hide: true,
      valueGetter: ({ row }) => (row.market_value - row.homeEquity.totalEstimatedLoanBalance - row.prior_year_amount_due)
    },
    {
      field: 'total_costs',
      headerName: 'Total Costs',
      valueFormatter: formatDollars,
      hide: true,
      valueGetter: ({ row }) => (row.homeEquity.totalEstimatedLoanBalance + row.prior_year_amount_due)
    },
    {
      field: 'mortgage_value',
      headerName: 'Mortgage',
      valueFormatter: formatDollars,
      hide: true,
      valueGetter: ({ row }) => (row.homeEquity ? row.homeEquity.totalEstimatedLoanBalance : undefined)
    },
    { 
      field: 'owner', 
      headerName: 'Owner', 
      width: 250,
      hide: true,
      renderCell: (({ row }) => {
        let owners = []
        for(const key of ['owner1', 'owner2', 'owner3', 'owner4']) {
          if(row.owner[key]) owners.push({ firstname: row.owner[key].firstnameandmi, lastname: row.owner[key].lastname })
        }
        return (
          <Box>
            {owners.map((owner, idx) => (
              <Box key={idx}>{`${owner.firstname || ''} ${owner.lastname}`}</Box>
            ))}
          </Box>
        )
      })
    },
    { 
      field: 'years_arrears', 
      headerName: 'Arrears (yrs)', 
      align: 'center',
      width: 100,
    },
    { 
      field: 'prior_year_amount_due', 
      headerName: 'Past Taxes', 
      width: 120,
      valueFormatter: formatDollars,
      renderCell: (({ formattedValue, row }) => (
        <a href={`https://www.dallasact.com/act_webdev/dallas/reports/taxbyyear.jsp?can=${row.apn}&ownerno=0`} target="_blank" rel="noreferrer noopener">{formattedValue}</a>
      ))
    },
    { 
      field: 'current_tax_levy', 
      headerName: 'Current Taxes', 
      width: 120,
      valueFormatter: formatDollars,
      hide: true
    },
    { 
      field: 'market_value', 
      headerName: 'Market', 
      width: 120,
      valueFormatter: formatDollars
    },
    { 
      field: 'avm_value', 
      headerName: 'AVM', 
      width: 120,
      valueFormatter: formatDollars,
      valueGetter: ({row}) => (row.avm.amount.value)
    },
    { 
      field: 'improvement_value', 
      headerName: 'Improvements', 
      width: 120,
      valueFormatter: formatDollars,
      hide: true
    },
    { 
      field: 'land_value', 
      headerName: 'Land', 
      width: 120,
      valueFormatter: formatDollars,
      hide: true
    },
  ]


  const styles = {
    label: {
      fontWeight: 700,
      fontSize: 12,
      paddingLeft: theme.spacing(0.5)
    },
    string: {
      fontSize: 12,
    }
  }

  const handleCall = () => {
    axios.post('/api/property/call_test_function')
    .then(({ data }) => {
      // console.log(data)
    })
    .catch(e => console.log(e))
  }

  return (
    <Box sx={{
      background: theme.palette.background.paper,
      borderRadius: theme.spacing(1),
      boxShadow: theme.shadows[3],
      padding: theme.spacing(1),
      flexGrow: 1,
      // marginLeft: theme.spacing(2),
      display: 'flex',
      flexDirection: 'column',
      // alignItems: 'flex-start',
      overflow: 'hidden'
    }}>
      <Box sx={{
        paddingBottom: theme.spacing(1),
        display: 'flex',
        alignItems: 'center'
      }}>
        <Button
          variant='contained'
          color='secondary'
          size='small'
          disableElevation
          onClick={getProperties}
        >Refresh</Button>
        <Button 
          sx={{
            display: 'flex',
            alignItems: 'center',
            marginLeft: theme.spacing(2)
          }}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters
          <ChevronLeftIcon sx={{
            transform: filtersOpen ? 'rotate(90deg)' : 'rotate(-90deg)',
            transition: 'transform 0.3s ease-in-out'
          }}/>
        </Button>
        <Button
          color='success'
          variant='contained'
          size='small'
          disableElevation
          onClick={handleCall}
        >Ping</Button>
        <Box sx={{
          marginLeft: theme.spacing(2),
          color: theme.palette.primary.main,
          fontWeight: 600,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center'
        }}>
          {searching && <CircularProgress size={16} sx={{marginRight: theme.spacing(1)}}/> }
          {searching ? 'Searching...' : 'Done!'}
        </Box>
        <PDFPrintButton
          properties={properties}
        />
        <DownloadExcelButton
          properties={properties}
        />
        <ServerPrintButton
          properties={properties}
        />
      </Box>
      <Collapse in={filtersOpen}>
        <Box sx={{ 
          padding: theme.spacing(1)
        }}>
          <Box>
            <TextField
              size='small'
              value={filters.property_address || ''}
              onChange={e => setFilters({ ...filters, property_address: e.target.value.toUpperCase() })}
              label='Address'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
            <TextField
              size='small'
              value={filters.years_arrears.min || ''}
              onChange={e => setFilters({ ...filters, years_arrears: { ...filters.years_arrears, min: e.target.value.toUpperCase() } })}
              label='Arrears (min)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
            <TextField
              size='small'
              value={filters.years_arrears.max || ''}
              onChange={e => setFilters({ ...filters, years_arrears: { ...filters.years_arrears, max: e.target.value.toUpperCase() } })}
              label='Arrears (max)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
          </Box>
          <Box>
            <TextField
              size='small'
              value={filters.prior_year_amount_due.min || ''}
              onChange={e => setFilters({ ...filters, prior_year_amount_due: { ...filters.prior_year_amount_due, min: e.target.value.toUpperCase() } })}
              label='Prior Taxes (min)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
            <TextField
              size='small'
              value={filters.prior_year_amount_due.max || ''}
              onChange={e => setFilters({ ...filters, prior_year_amount_due: { ...filters.prior_year_amount_due, max: e.target.value.toUpperCase() } })}
              label='Prior Taxes (max)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
            <TextField
              size='small'
              value={filters.current_tax_levy.min || ''}
              onChange={e => setFilters({ ...filters, current_tax_levy: { ...filters.current_tax_levy, min: e.target.value.toUpperCase() } })}
              label='Current Taxes (min)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
            <TextField
              size='small'
              value={filters.current_tax_levy.max || ''}
              onChange={e => setFilters({ ...filters, current_tax_levy: { ...filters.current_tax_levy, max: e.target.value.toUpperCase() } })}
              label='Current Taxes (max)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
          </Box>
          <Box>
            <TextField
              size='small'
              value={filters.market_value.min || ''}
              onChange={e => setFilters({ ...filters, market_value: { ...filters.market_value, min: e.target.value.toUpperCase() } })}
              label='Market Value (min)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
            <TextField
              size='small'
              value={filters.market_value.max || ''}
              onChange={e => setFilters({ ...filters, market_value: { ...filters.market_value, max: e.target.value.toUpperCase() } })}
              label='Market Value (max)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
            <TextField
              size='small'
              value={filters.land_value.min || ''}
              onChange={e => setFilters({ ...filters, land_value: { ...filters.land_value, min: e.target.value.toUpperCase() } })}
              label='Land Value (min)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
            <TextField
              size='small'
              value={filters.land_value.max || ''}
              onChange={e => setFilters({ ...filters, land_value: { ...filters.land_value, max: e.target.value.toUpperCase() } })}
              label='Land Value (max)'
              sx={{ marginBottom: theme.spacing(1), marginRight: theme.spacing(1) }}
            />
          </Box>
        </Box>
      </Collapse>
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
          // autoHeight={true}
          components={{
            Toolbar: GridToolbar
          }}
          disableColumnFilter
          disableDensitySelector
          // headerHeight={() => 'auto'}
          getRowHeight={() => 'auto'}
          onRowClick={params => console.log(params.row)}
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              background: theme.palette.primary.main,
              color: theme.palette.primary.contrastText
            },
            '& .MuiDataGrid-columnHeader:last-child .MuiDataGrid-columnSeparator': {
              display: 'none'
            },
          }}
        />
      </Box>
    </Box>
  )
}