const express = require('express')
const router = express.Router()
const axios = require('axios')
const rp = require('request-promise')
const cheerio = require('cheerio')
const Street = require('../models/street')
const Property = require('../models/property')
const Zipcode = require('../models/zipcode')
const CronJob = require('cron').CronJob
const async = require('async')

let searchingForIDs = false
let searchingForDetails = false
let searchingForAttomDetails = false
let searchingForMortgageDetails = false
let searchingForForeclosureDetails = false
let searchingForSaleHistory = false
let searchingForAVMData = false

const findPropetyDetails = async (update) => {
  const getDetails = ($) => {
    let details = {}
    $('table.trans table[border="0"] td h3').each(function(i, element){
      // Format into array
      let array = $(this).text().replaceAll('\t','').split('\n')
      for(const i in array) array[i] = array[i].trim()
      array = array.filter(item => item !== '')
      // Condense rows
      for(let i = 0; i<array.length; i++) {
        if(array[i].indexOf(':') === array[i].length-1) {
          array[i] = array[i] + array[i+1]
          array.splice(i+1,1)
        }
      }
      // Extract object details
      for(let item of array) {
        let colonIndex = item.indexOf(':')
        if(colonIndex !== -1) {
          let key = item.slice(0,colonIndex)
          let val = item.slice(colonIndex + 1).trim()
          details[key] = val
        }
      }
    })
    let keys = Object.keys(details)
    let index = details['Property Site Address'].indexOf(',')
    if(index !== -1) details.street = details['Property Site Address'].slice(0, index)
    index = details['Address'].indexOf(details.street)
    if(index !== -1) {
      details.owner_name = details['Address'].slice(0, index)
      let string = details['Address'].slice(index)
      details.owner_address = string.slice(0, details.street.length) + ', ' + string.slice(details.street.length)
    }
    for(const key of keys) {
      if(details[key].indexOf('$') !== -1) {
        details[key] = Number(details[key].replace('$', '').replaceAll(',', ''))
        if(isNaN(details[key])) details[key] = 0
      }
    }

    for(const key of ['Prior Year Amount Due', 'Market Value', 'Land Value', 'Improvement Value', 'Current Amount Due']) {
      details[key] = isNaN(Number(details[key])) ? 0 : details[key]
    }
    
    return {
      apn: details['Account Number'],
      fips: '48113',
      owner_address: details.owner_address,
      owner_name: details.owner_name,
      property_address: details['Property Site Address'],
      status: Boolean(details['Market Value']) ? 'Active' : 'Inactive',
      current_tax_levy: details['Current Amount Due'],
      prior_year_amount_due: details['Prior Year Amount Due'],
      market_value: details['Market Value'],
      exemptions: details['Exemptions'],
      land_value: details['Land Value'],
      improvement_value: details['Improvement Value']
    }
  }

  if(searchingForDetails) return
  try {
    console.log('PROPERTY DETAILS: Starting search')
    searchingForDetails = true
    let streets = await Street.find({ $and: [
      {details_pulled: { $exists: false } },
      {ids_pulled: { $exists: true } }
    ]}).limit(100)
    console.log('Found', streets.length, 'unanalyzed streets')
    let ids = []
    for(const street of streets) {
      ids = ids.concat(street.account_ids)
    }
    
    let setAll = new Set(ids)
    console.log('Found',[...setAll].length,'property accounts')

    let streetCount = 0
    for(const street of streets) {
      streetCount++
      let setStreet = new Set(street.account_ids) //get unique ids from street
      streetArray = [...setStreet].filter( i => setAll.has(i)) //filter to those IDs in the master list
      let count = 0
      for(const id of streetArray) {
        $ = await rp({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          form: { can: id, ownerno: 0 },
          transform: (body) => (cheerio.load(body)),
          uri: `https://www.dallasact.com/act_webdev/dallas/showdetail2.jsp`
        })

        let details = getDetails($)
        if(details.status === 'Active' && details.prior_year_amount_due > 5000) {
          count++
          await Property.updateMany({apn: details.apn}, details, {upsert: true}) //Save new property if active and past due taxes
          // console.log('Saved property at ', details.property_address,' with deliquent taxes of ',details.prior_year_amount_due)
        }
      }
      street.details_pulled = new Date()
      await street.save()
      console.log('PROPERTY DETAILS: Updated', count, 'addresses on', street.name, '(',streetCount,'of',streets.length,'streets)')
      setStreet = new Set(streetArray) //Convert street ids back to unique set
      setAll = new Set([...setAll].filter(i => !setStreet.has(i))) //Filter master list of ids to remove those in the street
    }

    searchingForDetails = false
    console.log('PROPERTY DETAILS: Stopping search')
  } catch(e) {
    searchingForDetails = false
    console.log(e)
  }
}
// findPropetyDetails()

const findSteetAccountIDs = async (update) => {
  if(searchingForIDs) return
  try {
    console.log('Starting: ID Search')
    searchingForIDs = true
    let streets = await Street.find({$or: [
      { $and: [ { account_ids: { $exists: false } }, { ids_pulled: { $exists: false } } ] },
      { $and: [ { account_ids: { $eq: [] } }, { ids_pulled: { $exists: false } } ] }
    ]})
    console.log('Pulled',streets.length, 'streets')

    for(const street of streets) {
      let page = 1, searching = true, ids = [], skip = false
      while(searching) {
        $ = await rp({
          uri: `https://www.dallasact.com/act_webdev/dallas/showlist.jsp?page=${page}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          form: { criteria: street.name, searchby: 3 },
          transform: (body) => (cheerio.load(body))
        })
        let range = ''
        $('#mySize').each(function(i,element){
          range = $(this).text()
          let string = $(element).parent().text()
          if(string.indexOf('Showing') !== -1) {
            string = string.replace('Showing ' + range + ' of', '')
            let index = string.indexOf('matches')
            let val = Number(string.slice(0,index - 1).replace(',', '').trim())
            if(val > 2000) {
              console.log('Skipped street',street.name, 'with ', val, 'accounts')
              skip = true
              searching = false
            }
          }
        })
        
        if(!skip) {
          if(range.indexOf('-') === -1) searching = false
          page++

          $('#flextable tbody tr').each(function(i, element){
            $(this).find('td').each(function(i, element){
              if(i === 0) ids.push($(this).find('a').text().trim())
            })
          })
        }
      }
      if(!skip) {
        let set = new Set(ids)
        ids = Array.from(set)
        street.account_ids = [...ids]
        street.ids_pulled = new Date()
        street.save()
        console.log('Updated',street.name, 'with ', ids.length, ' ids')
      } else {
        street.account_ids = []
        street.ids_pulled = new Date()
        street.save()
      }
    }
    searchingForIDs = false
    console.log('Stopping: ID Search')
  } catch(e) {
    searchingForIDs = false
    console.log(e)
  }
}
// findSteetAccountIDs()

const getTimeString = () => {
  let now = new Date()
  return '[' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds() + ']'
}

const addAttomDataToProperties = async () => {
  searchingForAttomDetails = true
  console.log(getTimeString(),'ATTOM PROPERTY: Start search')

  // try {
  //   let properties = await Property.find({attom_msg: {$exists: false }}).limit(100)

  //   let limit = 5
  //   await async.eachLimit(
  //     properties,
  //     limit,
  //     (property, complete) => {
  //       axios.get('https://api.gateway.attomdata.com/propertyapi/v1.0.0/valuation/homeequity', {
  //         headers: { APIKey: process.env.ATTOM_DEMO_API_KEY, Accept: 'application/json' },
  //         params: { fips: property.fips, apn: property.apn }
  //       })
  //       .then(({ data }) => {
  //         if(data.status.code === 0 && data.status.total === 1) {
  //           let propData = data.property[0]
  //           property.attom_id = propData.identifier.attomId
  //           property.address = propData.address
  //           property.homeEquity = propData.homeEquity
  //           property.avm = propData.avm
  //           property.building = propData.building
  //           property.summary = propData.summary
  //           property.attom_msg = data.status.msg
  //           property.save()
  //           console.log(getTimeString(),'ATTOM PROPERTY: Updated one property')
  //         } else {
  //           property.attom_msg = data.status.msg
  //           property.save()
  //           console.log(getTimeString(),'ATTOM PROPERTY: Skipped a property because -->',property.attom_msg)
  //         }
  //         setTimeout(() => {
  //           complete(null)
  //         }, 20000)
  //       })
  //       .catch(e => {
  //         if(e.response.data.status) {
  //           property.attom_msg = e.response.data.status.msg
  //           property.save()
  //           console.log(getTimeString(),'ATTOM PROPERTY: Skipped a property because -->',property.attom_msg)
  //           setTimeout(() => {
  //             complete(null)
  //           }, 20000)
  //         } else {

  //           // turnOffAPIKey(key)
  //           setTimeout(() => {
  //             complete(e)
  //           }, 20000)
  //         }
  //       })
  //     }
  //   )
  //   searchingForAttomDetails = false
  // } catch(e) {
  //   console.log(e.response.data)
  //   console.log(getTimeString(),'ATTOM PROPERTY: Stopping search')
  //   searchingForAttomDetails = false
  // }

  async.waterfall([
    (done) => Property.find({attom_msg: {$exists: false }}).exec(done),
    (properties, done) => {
      let count = 0
      let apiKeys = [
        {key: "cc30dfda23cc970c3783e8549ef9aa74", status: 'free'},
        {key: "2374f2bd87bed200c842f18847de5bc9", status: 'free'},
        {key: "555726bac86d05c4a2f865034de07ae1", status: 'free'},
        {key: "8d46f1e829dfaf764b22200c70e536ce", status: 'free'},
        {key: "edba950885ad3b156687f9f8450100d0", status: 'free'},
        {key: "23c5cf2386495b81657a51b94d5f482b", status: "free"}, //Still works
        {key: "fdf6f4eef9571de010804237cc44f116", status: "free"}, //Still works
        {key: "08ee862c6ef1661a38ba33a27f7ef55b", status: 'free'}, //Still works
        {key: "44185dd0d8b52940d0b2b21d88f1dbb7", status: 'free'}, //Still works
        {key: "aa06faf12224ce243c719445be15a3ae", status: 'free'} //Still works
      ]

      const getAPIKey = () => {
        let now = new Date().getTime()
        for(const key of apiKeys) {
          if(key.status === 'free' && (!key.lastUsed || now > key.lastUsed + 7000)) {
            key.lastUsed = now
            return key.key
            break
          }
        }
        return
      }
      const setKeyInUse = (apiKey) => {
        for(const key of apiKeys) {
          if(key.key === apiKey) {
            key.status = key.status === 'used' ? 'free' : 'used'
          }
        }
      }
      const turnOffAPIKey = (apiKey) => {
        for(const key of apiKeys) {
          if(key.key === apiKey) {
            key.status = 'expired'
          }
        }
      }


      async.whilst(
        (cb) => {cb(null, properties.length > 0)},
        (next) => {
          let key = getAPIKey()
          if(!key) {
            setTimeout(() =>{
              console.log('ATTOM PROPERTY: waiting for new key')
              next(null)
            }, 7000)
            return
          }
          let property = properties.shift()
          setKeyInUse(key)
          axios.get('https://api.gateway.attomdata.com/propertyapi/v1.0.0/valuation/homeequity', {
            headers: { APIKey: key, Accept: 'application/json' },
            params: { fips: property.fips, apn: property.apn }
          })
          .then(({data}) => {
            if(data.status.code === 0 && data.status.total === 1) {
              let propData = data.property[0]
              property.attom_id = propData.identifier.attomId
              property.address = propData.address
              property.homeEquity = propData.homeEquity
              property.avm = propData.avm
              property.building = propData.building
              property.summary = propData.summary
              property.attom_msg = data.status.msg
              property.save()
              setKeyInUse(key)
              console.log(getTimeString(),'ATTOM PROPERTY: Updated property')
            } else {
              property.attom_msg = data.status.msg
              property.save()
              setKeyInUse(key)
              console.log(getTimeString(),'ATTOM PROPERTY: Skipped property -->', property.attom_msg)
            }
            // count++
            // next(null)
          })
          .catch(e => {
            if(e.response.data.status) {
              property.attom_msg = e.response.data.status.msg
              property.save()
              setKeyInUse(key)
              console.log(getTimeString(),'ATTOM PROPERTY: Skipped property -->', property.attom_msg)
              // count++
            } else {
              turnOffAPIKey(key)
              properties.push(property)
              console.log(getTimeString(),'ATTOM PROPERTY: API Error triggered. Get new key') 
            }
            // next(null)
          })
          next(null)
        },
        (err, result) => done(err)
      )

    }
  ], (err, res) => {
    searchingForAttomDetails = false
    console.log(getTimeString(),'ATTOM PROPERTY: Stopping search')
  })
}
// addAttomDataToProperties()

const addAttomMortgageDetails = async () => {
  console.log(getTimeString(),'ATTOM MORTGAGE: Starting search')
  searchingForMortgageDetails = true

  async.waterfall([
    (done) => Property.find({attom_msg: {$exists: false}}).exec(done),
    (properties, done) => {
      properties.length > 0 ? done('error') : done(null)
    },
    (done) => {
      Property
        .find({$and: [
          {attom_id: {$exists: true}},
          {owner: {$exists: false}},
          {mortgage: {$exists: false}}
        ]})
        .exec(done)
    },
    (properties, done) => {
      let apiKeys = [
        {key: "c01e67c202a00f8c20f3ba93ff82422e", status: 'free'},
        {key: "bfe7b3d8c9d84b25578798303ed707b5", status: 'free'},
        {key: "bd765db01e405c8fd2843d71937d31f8", status: 'free'},
        {key: "7cba4f51e81234a6ee29445e9d1c6cad", status: 'free'},
        {key: "9197411d81b983e30d66871d7285f48e", status: 'free'},
        {key: "f17281f5f61127f2433dfd3c2e2bcebe", status: 'free'},
        {key: "9b29dbb4b5f604c606754fde89d2fbde", status: 'free'},
        {key: "4c333d24fa7ad657f929e073616a721f", status: 'free'},
        {key: "677630483406fbd0cf0b1e9fbba9afed", status: 'free'},
      ]

      const getAPIKey = () => {
        let now = new Date().getTime()
        for(const key of apiKeys) {
          if(key.status === 'free' && (!key.lastUsed || now > key.lastUsed + 7000)) {
            key.lastUsed = now
            return key.key
          }
        }
        return
      }
      const setKeyInUse = (apiKey) => {
        for(const key of apiKeys) {
          if(key.key === apiKey) {
            key.status = key.status === 'used' ? 'free' : 'used'
          }
        }
      }
      const turnOffAPIKey = (apiKey) => {
        for(const key of apiKeys) {
          if(key.key === apiKey) {
            key.status = 'expired'
          }
        }
      }

      setInterval(() => {
        console.log('Remaining properties:', properties.length)
      }, 60000)

      async.whilst(
        (cb) => {cb(null, properties.length > 0)},
        (next) => {
          let key = getAPIKey()
          if(!key) {
            setTimeout(() =>{
              console.log(getTimeString(),'ATTOM MORTGAGE: waiting for new key')
              next(null)
            }, 7000)
            return
          }
          let property = properties.shift()
          setKeyInUse(key)
          console.log('initiating call')
          axios.get('https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detailmortgageowner', {
            headers: { APIKey: key, Accept: 'application/json' },
            params: { attomid: property.attom_id }
          })
          .then(({data}) => {
            let details = data.property[0]
            property.owner = details.owner
            property.mortgage = details.mortgage
            property.save()
            setKeyInUse(key)
            // next(null)
            console.log(getTimeString(),'ATTOM MORTGAGE: Updated one property')
          })
          .catch(e => {
            turnOffAPIKey(key)
            console.log(e.response.data)
            console.log(getTimeString(),'ATTOM MORTGAGE: API Error triggered. Get new key') 
            // next('Error')
            properties.push(property)
          })
          next(null)
        },
        (err, result) => done(err)
      )

    }
  ], (err, result) => {
    searchingForMortgageDetails = false
    console.log(getTimeString(),'ATTOM MORTGAGE: Stopping search')
  })
}
// addAttomMortgageDetails()

const addAttomSaleHistory = () => {
  console.log(getTimeString(),'ATTOM SALE HISTORY: Starting search')
  searchingForSaleHistory = true

  async.waterfall([
    (done) => Property.find({$and: [{attom_id: {$exists: true}}, {searched_saleHistory: {$exists: false}}]}).limit(2000).exec(done),
    (properties, done) => {

      let apiKeys = [
        {key: "c01e67c202a00f8c20f3ba93ff82422e", status: 'free'},
        {key: "bfe7b3d8c9d84b25578798303ed707b5", status: 'free'},
        {key: "bd765db01e405c8fd2843d71937d31f8", status: 'free'},
        {key: "7cba4f51e81234a6ee29445e9d1c6cad", status: 'free'},
        {key: "9197411d81b983e30d66871d7285f48e", status: 'free'},
        {key: "f17281f5f61127f2433dfd3c2e2bcebe", status: 'free'},
        {key: "9b29dbb4b5f604c606754fde89d2fbde", status: 'free'},
        {key: "4c333d24fa7ad657f929e073616a721f", status: 'free'},
        {key: "677630483406fbd0cf0b1e9fbba9afed", status: 'free'},
      ]

      const getAPIKey = () => {
        let now = new Date().getTime()
        for(const key of apiKeys) {
          if(key.status === 'free' && (!key.lastUsed || now > key.lastUsed + 7000)) {
            key.lastUsed = now
            return key.key
          }
        }
        return
      }
      const setKeyInUse = (apiKey) => {
        for(const key of apiKeys) {
          if(key.key === apiKey) {
            key.status = key.status === 'used' ? 'free' : 'used'
          }
        }
      }
      const turnOffAPIKey = (apiKey) => {
        for(const key of apiKeys) {
          if(key.key === apiKey) {
            key.status = 'expired'
          }
        }
      }

      setInterval(() => {
        console.log('Remaining properties:', properties.length)
      }, 60000)

      async.whilst(
        (cb) => {cb(null, properties.length > 0)},
        (next) => {
          let key = getAPIKey()
          if(!key) {
            setTimeout(() =>{
              console.log(getTimeString(),'ATTOM SALE HISTORY: waiting for new key')
              next(null)
            }, 7000)
            return
          }
          let property = properties.shift()
          setKeyInUse(key)
          console.log('initiating call')
          axios.get('https://api.gateway.attomdata.com/propertyapi/v1.0.0/saleshistory/expandedhistory', {
            headers: { APIKey: key, Accept: 'application/json' },
            params: { attomid: property.attom_id }
          })
          .then(({data}) => {
            if(data.property.length === 1) {
              property.saleHistory = data.property[0].saleHistory
              property.foreclosure = data.property[0].foreclosure
              property.searched_saleHistory = new Date()
              property.save()
            } else {
              console.log('found too many properties')
            }
            setKeyInUse(key)
            console.log(getTimeString(),'ATTOM SALE HISTORY: Updated one property')
          })
          .catch(e => {
            turnOffAPIKey(key)
            console.log(e.response.data)
            console.log(getTimeString(),'ATTOM SALE HISTORY: API Error triggered. Get new key') 
            properties.push(property)
          })
          next(null)
        },
        (err, result) => done(err)
      )

    }
  ], (err, result) => {
    searchingForSaleHistory = false
    console.log(getTimeString(),'ATTOM SALE HISTORY: Stopping search')
  })
}
// addAttomSaleHistory()

const addAttomForclosureDetails = async () => {
  console.log(getTimeString(),'ATTOM FORECLOSURE: Starting search')
  searchingForForeclosureDetails = true

  async.waterfall([
    (done) => Property.find({$and: [{attom_id: {$exists: true}}, {owner: {$exists: false}}, {mortgage: {$exists: false}}]}).exec(done),
    (properties, done) => {
      properties.length > 0 ? done('error') : done(null)
    },
    (done) => {
      Property
        .find({$and: [
          {attom_id: {$exists: true}},
          {$or: [{foreclosure_searched: false}, {foreclosure_searched: {$exists: false}}]},
        ]})
        .limit(2000)
        .exec(done)
    },
    (properties, done) => {
      console.log('Props found', properties.length)

      let apiKeys = [
        {key: "c01e67c202a00f8c20f3ba93ff82422e", status: 'free'},
        {key: "bfe7b3d8c9d84b25578798303ed707b5", status: 'free'},
        {key: "bd765db01e405c8fd2843d71937d31f8", status: 'free'},
        {key: "7cba4f51e81234a6ee29445e9d1c6cad", status: 'free'},
        {key: "9197411d81b983e30d66871d7285f48e", status: 'free'},
        {key: "f17281f5f61127f2433dfd3c2e2bcebe", status: 'free'},
        {key: "9b29dbb4b5f604c606754fde89d2fbde", status: 'free'},
        {key: "4c333d24fa7ad657f929e073616a721f", status: 'free'},
        {key: "677630483406fbd0cf0b1e9fbba9afed", status: 'free'},
      ]

      const getAPIKey = () => {
        let now = new Date().getTime()
        for(const key of apiKeys) {
          if(key.status === 'free' && (!key.lastUsed || now > key.lastUsed + 7000)) {
            key.lastUsed = now
            return key.key
          }
        }
        return
      }
      const setKeyInUse = (apiKey) => {
        for(const key of apiKeys) {
          if(key.key === apiKey) {
            key.status = key.status === 'used' ? 'free' : 'used'
          }
        }
      }
      const turnOffAPIKey = (apiKey) => {
        for(const key of apiKeys) {
          if(key.key === apiKey) {
            key.status = 'expired'
          }
        }
      }

      setInterval(() => {
        console.log('Remaining properties:', properties.length)
      }, 60000)

      async.whilst(
        (cb) => {cb(null, properties.length > 0)},
        (next) => {
          let key = getAPIKey()
          if(!key) {
            setTimeout(() =>{
              console.log(getTimeString(),'ATTOM MORTGAGE: waiting for new key')
              next(null)
            }, 7000)
            return
          }
          let property = properties.shift()
          setKeyInUse(key)
          console.log('initiating call')
          axios.get('https://api.gateway.attomdata.com/property/v3/preforeclosuredetails', {
            headers: { APIKey: key, Accept: 'application/json' },
            params: { attomid: property.attom_id }
          })
          .then(({data}) => {
            property.default = data.PreforeclosureDetails.Default
            property.auction = data.PreforeclosureDetails.Auction
            property.foreclosure_searched = true
            // console.log(property)
            property.save()
            setKeyInUse(key)
            // next(null)
            console.log(getTimeString(),'ATTOM FORECLOSURE: Updated one property')
          })
          .catch(e => {
            turnOffAPIKey(key)
            console.log(e)
            console.log(getTimeString(),'ATTOM FORECLOSURE: API Error triggered. Get new key') 
            properties.push(property)
          })
          next(null)
        },
        (err, result) => done(err)
      )

    }
  ], (err, result) => {
    searchingForForeclosureDetails = false
    console.log(getTimeString(),'ATTOM FORECLOSURE: Stopping search')
  })

}
// addAttomForclosureDetails()

const testFunction = async () => {
  let props = await Property
    .find({$and: [
      {attom_id: {$exists: true}}, {searched_saleHistory: {$exists: false}}
    ]})
  console.log('Unscanned props:', props.length)


}

// Cron increments
// * seconds (0-59)
// * minute (0-59)
// * hour (0-23)
// * day of month (1-31)
// * month (1-12)
// * day of week (0-6) (Sunday = 0)
new CronJob('*/10 * * * *', () => {
  if(searchingForIDs) return
  // findSteetAccountIDs()
}, null, true)

new CronJob('* * * * *', () => {
  if(searchingForDetails) return
  // findPropetyDetails()
}, null, true)

new CronJob('*/5 * * * *', () => {
  if(searchingForAttomDetails) return
  // addAttomDataToProperties()
}, null, true)

new CronJob('*/10 * * * *', () => {
  if(searchingForMortgageDetails) return
  // addAttomMortgageDetails()
}, null, true)

new CronJob('*/10 * * * *', () => {
  if(searchingForForeclosureDetails) return
  // addAttomForclosureDetails()
}, null, true)

new CronJob('*/2 * * * *', () => {
  if(searchingForSaleHistory) return
  // addAttomSaleHistory()
}, null, true)

// Test Routes
router.post('/create_streets', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    let countyURLs = {
      Dallas: 'https://geographic.org/streetview/usa/tx/dallas.html'
    }

    // Scan for street names
    let $ = await rp({
      uri: countyURLs[req.body.county],
      transform: (body) => (cheerio.load(body))
    })
    let streetList = []
    $('.listspan li a').each(function(i, element){
      streetList.push($(this).text())
    })
    let set = new Set(streetList)
    streetList = Array.from(set)

    // Create new street objects
    let newStreets = []
    for(const street of streetList) {
      newStreets.push({
        name: street,
        county: req.body.county,
        state: req.body.state
      })
    }

    await Street.insertMany(newStreets, { limit: 1000 })

    res.send(newStreets)
  })
  .catch(next)
})

router.post('/property_details', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    $ = await rp({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      form: { can: '000801000B0010000', ownerno: 0 },
      transform: (body) => (cheerio.load(body)),
      uri: `https://www.dallasact.com/act_webdev/dallas/showdetail2.jsp`
    })
    let details = {}
    $('table.trans table[border="0"] td h3').each(function(i, element){
      // Format into array
      let array = $(this).text().replaceAll('\t','').split('\n')
      for(const i in array) array[i] = array[i].trim()
      array = array.filter(item => item !== '')
      // Condense rows
      for(let i = 0; i<array.length; i++) {
        if(array[i].indexOf(':') === array[i].length-1) {
          array[i] = array[i] + array[i+1]
          array.splice(i+1,1)
        }
      }
      // Extract object details
      for(let item of array) {
        let colonIndex = item.indexOf(':')
        if(colonIndex !== -1) {
          let key = item.slice(0,colonIndex)
          let val = item.slice(colonIndex + 1).trim()
          details[key] = val
        }
      }
    })
    let keys = Object.keys(details)
    let index = details['Property Site Address'].indexOf(',')
    if(index !== -1) details.street = details['Property Site Address'].slice(0, index)
    index = details['Address'].indexOf(details.street)
    if(index !== -1) {
      details.owner_name = details['Address'].slice(0, index)
      let string = details['Address'].slice(index)
      details.owner_address = string.slice(0, details.street.length) + ', ' + string.slice(details.street.length)
    }
    for(const key of keys) {
      if(details[key].indexOf('$') !== -1) {
        details[key] = Number(details[key].replace('$', '').replaceAll(',', ''))
        if(isNaN(details[key])) details[key] = 0
      }
    }
    
    let newProperty = {
      // account_id: details['Account Number'],
      owner_address: details.owner_address,
      owner_name: details.owner_name,
      property_address: details['Property Site Address'],
      status: Boolean(details['Market Value']) ? 'Active' : 'Inactive',
      current_tax_levy: details['Current Amount Due'],
      prior_year_amount_due: details['Prior Year Amount Due'],
      market_value: details['Market Value'],
      exemptions: details['Exemptions'],
      land_value: details['Land Value'],
      improvement_value: details['Improvement Value']
    }

    res.send(newProperty)
  })
  .catch(next)
})
router.post('/call_test_function', (req, res, next) => {
  testFunction()
  res.send()
})



// Active Routes
router.post('/all_properties', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    let properties = await Property
      .find({$and: [{attom_id: {$exists: true}}, {owner: {$exists: true}}]})
      .sort({attom_id: 1})
      .skip(req.body.count)
      .limit(req.body.searchFor)
    properties = properties.filter(item => Boolean(item.attom_id))
    res.send(properties)
  })
  .catch(next)
})

module.exports = router