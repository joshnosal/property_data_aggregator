import { Box, Button } from '@mui/material'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from '../global/vfs_fonts'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import async from 'async'
import logo from '../global/logo.png'
import * as XLSX from 'xlsx/xlsx.mjs'


const formatDollars = (value) => (value !== undefined ? '$' + Math.round(value).toLocaleString('en-US') : '')
const getDate = () => {
  let date = new Date()
  let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear()
}


export default function PDFPrintButton({ properties }){

  
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

    async.whilst(
      (cb) => {cb(null, count < data.length)},
      (next) => {
        // if(count - 1 > 0 && (count - 1) % 500 === 0) content = []
        let property = data[count]
        content = content.concat([
          {
            layout: 'noBorders',
            table: {
              headerRows: 0,
              widths: ['*', 'auto'],
              body: [
                [
                  {
                    alignment: 'left',
                    stack: [
                      {text: getDate(), margin: [0,0,0,10]},
                      ...(property.formData.fullNames.map(line => line)),,
                      ...(property.formData.mailingAddress.map(line => line)),
                      {text: `Dear ${property.formData.firstNames},`, margin: [0,10,0,10]},
                    ]
                  },
                  {
                    alignment: 'center',
                    stack: [
                      {
                        image: 'Logo.png',
                        width: 70,
                      },
                      {text: 'JN | PROPERTIES', margin: [0,10,0,0], style: { color: 'grey'} }
                    ]
                  }
                ]
              ]
            }
          },
          {
            text: [
              "I've been doing some research in your area and came across your property at ",
              {text: property.address.oneLine , bold: true },
              ". I don’t know if you have ever considered selling but I would love to discuss further if you would be" + 
              " open to a possible sale.I would of course need to do more diligence on the property to formalize an " + 
              "offer, but as part of the purchase, I would plan to submit an all cash offer to ",
              {text: '(1)', bold: true },
              " pay off all past-due property taxes, ",
              {text: '(2)', bold: true },
              " payoff any mortgage(s) on the property, ",
              {text: '(3)', bold: true },
              " cover all closing costs, and ",
              {text: '(4)', bold: true },
              " pay you additional cash consideration."
            ],
            style: { alignment: 'justify' },
            margin: [0,0,0,10]
          },
          {
            text: "Based on my preliminary figures, this could look something like the following:",
            margin: [0,0,0,5]
          },
          {
            layout: 'noBorders',
            table: {
              headerRows: 0,
              widths: [40, 120, 90, '*'],
              body: [
                ['', 'Purchase Price', {text: formatDollars(property.formData.economics.purchase_price), style: { alignment: 'right'}}],
                ['', 'Property Taxes', {text: `(${formatDollars(property.formData.economics.tax)})`, style: { alignment: 'right'}}],
                ['', 'Mortgage(s)', {text: `(${formatDollars(property.formData.economics.mortgage)})`, style: { alignment: 'right'}}],
                ['', 'Closing costs', {text: `(${formatDollars(property.formData.economics.closing_costs)})`, style: { alignment: 'right'}}],
                ['', {text: 'Your Sale Proceeds', bold: true, style: { font: 'SuperBold'}}, {text: formatDollars(property.formData.economics.seller_proceeds), bold: true, style: { alignment: 'right', font: 'SuperBold' }}],
              ]
            },
            margin: [0,0,0,10],
          },
          {
            text: [
              {text: "Before finalizing an offer, I would plan to conduct an inspection of the property and be prepared to " },
              {text: "close as early as 30 days after the inspection", bold: true},
              {text: " is completed. I would also be open to structuring the deal in a manner that best suits " + 
              "your current situation. A few examples might be:"}
            ],
            margin: [0,0,0,5],
            style: { alignment: 'justify' }
          },
          { 
            ul: [
              'Short or long term lease back to you (as needed/desired)',
              'Include moving costs in the purchase price',
              'Including repair costs in the purchase'
            ],
            margin: [40, 0, 0, 10]
          },
          {
            text: "If the proposal outlined above is appealing to you, please do reach out at your earliest convenience. " + 
            "Assuming you are interested, I would love to come out to see the property and align on terms that work " + 
            "for both of us. My email and cellphone are listed below so please feel free to reach out at any time that works best for you.",
            style: { alignment: 'justify' },
            margin: [0,0,0,10]
          },
          { text: 'Sincerely,', margin: [0,0,0,30] },
          {
            text: [
              {text: '.', style: { color: 'white', decoration: 'underline', fontSize: 0 } },
              {text: '                                                                           ', style: { decoration: 'underline' } }
            ],
            style: { alignment: 'left'}
          },
          { text: 'Josh Nosal', margin: [0,0,0,40]},
          {
            layout: 'noBorders',
            table: {
              headerRows: 0,
              body: [
                [{text: 'Contact Me', colSpan: 2, bold: true}, {text: ''}],
                [{text: 'E-mail:', style: { alignment: 'right'}}, 'jnosal1989@gmail.com'],
                [{text: 'Cell:', style: { alignment: 'right'}}, '(512) 746-7999'],
              ]
            },
            pageBreak: 'after'
          },
        ])
        count++
        if(count % 100 === 0) console.log('Scanned', count, 'files')
        if((count !== 0 && count % 500 === 0) || count === data.length) {
          let pdfDocGenerator = pdfMake.createPdf({content})
          pdfDocGenerator.getBlob((blob) => {
            zip.file(`Letters ${lastSave} to ${count}.pdf`, blob)
            lastSave = count + 1
            content = []
            next(null)
          })
        } else {
          next(null)
        }
      },
      (err, result) => {
        if(err) {
          console.log(err)
        } else {
          zip.generateAsync({type: 'blob'}).then(blob => {
            saveAs(blob, 'Property Letters.zip')
          })
        }
      }
    )

  }

  return (
    <Button
      variant='contained'
      disableElevation
      color='primary'
      size='small'
      sx={{
        marginLeft: 'auto'
      }}
      onClick={printPDF}
    >
      Print Letters
    </Button>
  )
}