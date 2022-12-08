import { Box, Button, useTheme } from '@mui/material'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from '../global/vfs_fonts'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import async from 'async'
import * as XLSX from 'xlsx/xlsx.mjs'


const formatDollars = (value) => (value !== undefined ? '$' + Math.round(value).toLocaleString('en-US') : '')
const formatNumber = (value) => (value !== undefined ? Math.round(value).toLocaleString('en-US') : '')
const formatDate = (date) => {
  let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear()
}
const getDate = () => {
  let date = new Date()
  let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear()
}
const capitalizeWord = (word) => (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
const capitalizeSentence = (sentence) => {
  sentence = sentence.split(' ')
  for(const i in sentence) {
    sentence[i] = capitalizeWord(sentence[i])
  }
  return sentence.join(' ')
}

const populateAddressData = (properties) => {
  const capitalizeWord = (word) => (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  const capitalizeSentence = (sentence) => {
    if(!sentence) return sentence
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
        array.push(string.trim())
      }
      if(prop.owner.owner2) {
        let string = ''
        if(prop.owner.owner2.firstnameandmi) string = prop.owner.owner2.firstnameandmi.split(' ')[0] + ' '
        string = string + prop.owner.owner2.lastname
        array.push(string.trim())
      }
      if(prop.owner.owner3) {
        let string = ''
        if(prop.owner.owner3.firstnameandmi) string = prop.owner.owner3.firstnameandmi.split(' ')[0] + ' '
        string = string + prop.owner.owner3.lastname
        array.push(string.trim())
      }
    } else if (prop.owner_name) {
      let string = prop.owner_name
      let index = string.toUpperCase().indexOf('EST OF')
      if(index === string.length - 6) {
        string = string.slice(index) + ' ' + string.slice(0,index)
        array.push(string.trim())
      } else {
        array.push(prop.owner_name.trim())
      }
    } else {
      array.push('PRIMARY RESIDENT')
    }
    array = capitalizeSentence(array.join(', '))
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
    
    array = capitalizeSentence(array.join(', '))
    return array
  }
  const confirmNum = (val) => {
    val = Number(val)
    return isNaN(val) ? 0 : Math.round(val)
  }
  const getAddressComponents = (address) => {
    address = address.split(',')
    let string = address.pop().trim()
    let index = string.indexOf(' ')
    let state = string.slice(0,index).trim().toUpperCase()
    string = string.slice(index).trim()
    index = string.indexOf('-')
    let zip = index !== -1 ? string.slice(0, index) : string
    let city = address.pop()
    let street2 = '', street1 = ''
    if(address.length > 1) {
      street2 = address.pop()
      street1 = address.pop()
    } else {
      street1 = address.pop()
    }


    return { street1, street2, city, state, zip }
  }

  for(const property of properties) {
    let newFormData = {}
    newFormData.first_names = getFirstNames(property)
    newFormData.full_names = getFullNames(property)
    newFormData.full_address = getMailingAddress(property)
    newFormData.purchase_price = confirmNum(Math.min(...[property.market_value * 0.5, property.avm.amount.value * 0.4]))
    newFormData.tax_amount = confirmNum((property.prior_year_amount_due || 0) + (property.current_tax_levy || 0))
    newFormData.mortgage_amount = confirmNum((property.homeEquity.totalEstimatedLoanBalance || 0))
    newFormData.closing_costs = confirmNum(newFormData.purchase_price * 0.05)
    newFormData.seller_proceeds = confirmNum(newFormData.purchase_price - newFormData.tax - newFormData.mortgage - newFormData.closing_costs)
    newFormData = {
      ...newFormData,
      ...(getAddressComponents(newFormData.full_address))
    }
    property.mailingDetails = newFormData
  }
  return properties
}


export default function DownloadExcelButton({ properties }){
  const theme = useTheme()
  
  const printPDF = () => {
    pdfMake.vfs = pdfFonts.pdfMake.vfs
    pdfMake.fonts = {
      Roboto: {
        normal: "Nunito-Light.ttf",
        bold: 'Nunito-Bold.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      },
      SuperBold: {
        normal: 'Nunito-ExtraBold.ttf',
        bold: 'Nunito-ExtraBold.ttf',
        italics: 'Nunito-ExtraBold.ttf',
        bolditalics: 'Nunito-ExtraBold.ttf'
      }
    }
    let data = JSON.parse(JSON.stringify(properties))

    let zip = new JSZip()
    let count = 0
    let lastSave = 0
    let content = []
    let workbook = XLSX.utils.book_new()
    let sheetData = [], row = []

    let excelColumns = [
      {title: 'TAX ASSESSOR>>>', key: '', type: ''},
      {title: 'APN', key: 'apn', type: 'text'},
      {title: 'Assessed Value', key: 'market_value', type: 'dollar'},
      {title: 'Improvement Value', key: 'improvement_value', type: 'dollar'},
      {title: 'Land Value', key: 'land_value', type: 'dollar'},
      {title: 'Current Tax', key: 'current_tax_levy', type: 'dollar'},
      {title: 'Past Taxes Due', key: 'prior_year_amount_due', type: 'dollar'},
      {title: 'Years in Arrears', key: 'years_arrears', type: 'text'},
      {title: 'Exemptions', key: 'exemptions', type: 'text'},
      {title: '', key: '', type: ''},
      {title: 'ATTOM PROPERTY>>>', key: '', type: ''},
      {title: 'ATTOM ID', key: 'attom_id', type: 'text'},
      {title: 'Line 1', key: 'address.line1', type: 'text'},
      {title: 'Line 2', key: 'address.line2', type: 'text'},
      {title: 'Year Built', key: 'summary.yearBuilt', type: 'text'},
      {title: 'Prop Class', key: 'summary.propClass', type: 'text'},
      {title: 'Sqft', key: 'building.size.universalSize', type: 'number'},
      {title: 'AVM>>>', key: '', type: ''},
      {title: 'Score', key: 'avm.amount.scr', type: 'number'},
      {title: 'Value', key: 'avm.amount.value', type: 'number'},
      {title: 'High', key: 'avm.amount.high', type: 'number'},
      {title: 'Low', key: 'avm.amount.low', type: 'number'},
      {title: 'SALE HISTORY>>>', key: '', type: ''},
      {title: 'Last Sale', key: 'sale_date', type: 'sale_date'},
      {title: 'Total Sales', key: 'sale_count', type: 'sale_count'},
      {title: '', key: '', type: ''},
      {title: 'LETTER DATA>>>', key: '', type: ''},
      {title: 'Purchase Price', key: 'formData.economics.purchase_price', type: 'dollar'},
      {title: 'Taxes', key: 'formData.economics.tax', type: 'dollar'},
      {title: 'Mortgage', key: 'formData.economics.mortgage', type: 'dollar'},
      {title: 'Closing Costs', key: 'formData.economics.closing_costs', type: 'dollar'},
      {title: 'Seller Proceeds', key: 'formData.economics.seller_proceeds', type: 'dollar'},
      {title: 'First Names', key: 'formData.firstNames', type: 'text'},
      {title: 'Full Names', key: 'fullNames', type: 'fullNames'},
      {title: 'Mailing Address', key: 'mailingAddress', type: 'mailingAddress'},
    ]

    for(const column of excelColumns) row.push(column.title)
    sheetData.push(row)

    for(const datum of data) {
      row = []
      for(const column of excelColumns) {
        let key = column.key
        let getVal = () => {
          let keys = key.split('.')
          let val = datum
          for(const key of keys) val = val[key]
          return val
        }

        switch(column.type) {
          case 'text': {
            row.push(getVal())
            break
          }
          case 'dollar': {
            row.push(formatDollars(getVal()))
            break
          }
          case 'number': {
            row.push(formatNumber(getVal()))
            break
          }
          case 'sale_date': {
            if(datum.saleHistory.length) {
              row.push(formatDate(new Date(datum.saleHistory[0].saleSearchDate)))
            } else {
              row.push('')
            }
            break
          }
          case 'sale_count': {
            if(datum.saleHistory.length) {
              row.push(formatNumber(datum.saleHistory.length))
            } else {
              row.push(formatNumber(0))
            }
            break
          }
          case 'fullNames': {
            let string = ''
            for(const name of datum.formData.fullNames) string = string + (string ? '\n' : '') + name
            row.push(string)
            break
          }
          case 'mailingAddress': {
            let string = ''
            for(const name of datum.formData.mailingAddress) string = string + (string ? '\n' : '') + name
            row.push(string)
            break
          }
          default: {
            row.push('')
            break
          }
        }
      }
      sheetData.push(row)
    }
    let worksheet = XLSX.utils.aoa_to_sheet(sheetData, {})
    XLSX.utils.book_append_sheet(workbook,worksheet, 'Dallas Properties')
    XLSX.writeFile(workbook, 'Dallas Properties.xlsx')
  }

  const downloadAddresses = () => {
    let clone = JSON.parse(JSON.stringify(properties))
    let workbook = XLSX.utils.book_new()
    let sheetData = [], row = []

    let excelColumns = [
      {title: 'APN', key: 'apn', type: 'text'},
      {title: 'FIRST NAMES', key: 'mailingDetails.first_names', type: 'text'},
      {title: 'FULL NAMES', key: 'mailingDetails.full_names', type: 'text'},
      {title: 'owner1_first', key: 'owner.owner1.firstnameandmi', type: 'text'},
      {title: 'owner1_last', key: 'owner.owner1.lastname', type: 'text'},
      {title: 'owner2_first', key: 'owner.owner2.firstnameandmi', type: 'text'},
      {title: 'owner2_last', key: 'owner.owner2.lastname', type: 'text'},
      {title: 'owner3_first', key: 'owner.owner3.firstnameandmi', type: 'text'},
      {title: 'owner3_last', key: 'owner.owner3.lastname', type: 'text'},
      {title: 'owner_name', key: 'owner_name', type: 'text'},
      {title: 'STREET 1', key: 'mailingDetails.street1', type: 'text'},
      {title: 'STREET 2', key: 'mailingDetails.street2', type: 'text'},
      {title: 'CITY', key: 'mailingDetails.city', type: 'text'},
      {title: 'STATE', key: 'mailingDetails.state', type: 'text'},
      {title: 'ZIP', key: 'mailingDetails.zip', type: 'text'},
      {title: 'mailing_address', key: 'owner.mailingaddressoneline', type: 'text'},
      {title: 'owner_address', key: 'owner_address', type: 'text'},
    ]

    clone = populateAddressData(clone)
    for(const column of excelColumns) row.push(column.title)
    sheetData.push(row)

    for(const datum of clone) {
      row = []
      for(const column of excelColumns) {
        let key = column.key
        let getVal = () => {
          let keys = key.split('.')
          let val = datum
          for(const key of keys) {
            val = val[key]
            if(typeof val !== 'object') return val
          }
          return val
        }

        switch(column.type) {
          case 'text': {
            row.push(getVal())
            break
          }
          default: {
            row.push('')
            break
          }
        }
      }
      sheetData.push(row)
    }
    let worksheet = XLSX.utils.aoa_to_sheet(sheetData, {})
    XLSX.utils.book_append_sheet(workbook,worksheet, 'Addresses')
    XLSX.writeFile(workbook, 'Addresses.xlsx')
  }

  return (
    <Button
      variant='contained'
      disableElevation
      color='primary'
      size='small'
      sx={{
        marginLeft: theme.spacing(2)
      }}
      onClick={downloadAddresses}
    >
      Download Excel
    </Button>
  )
}