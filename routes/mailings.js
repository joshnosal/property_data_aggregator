const axios = require('axios')
const express = require('express')
const router = express.Router()
const Property = require('../models/property')
const async = require('async')

router.get('/test_mail', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    // let { data } = await axios.get('https://us.stannp.com/api/v1/accounts/balance', {
    //   params: {
    //     api_key: process.env.STANNP_API_KEY
    //   }
    // })
    // console.log(data)
    res.send()
  })
  .catch(e => {
    console.log(e)
    next(e)
  })
})

router.get('/verify_addresses', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    let chunk = 500
    let searching = true

    async.whilst(
      (cb) => {cb(null, searching === true)},
      (next) => {

        async.waterfall([
          (done) => Property.find({ $and: [{qualified_for_mailing: true}, {google_address_data: {$exists: false}}] }, {mailingDetails: 1}).limit(chunk).exec(done),
          (properties, done) => {
            console.log(properties.length)
            !properties.length ? next('finished') : done(null, properties)
          },
          (properties, done) => {
            let count = 0
            let timeLeft = 0
            async.eachLimit(
              properties,
              25,
              (property, nextProperty) => {
                let addressLine = property.mailingDetails.street1
                if(property.mailingDetails.street2) addressLine = addressLine + ', ' + property.mailingDetails.street2
                axios.post(`https://addressvalidation.googleapis.com/v1:validateAddress?key=${process.env.GOOGLE_MAPS_API_KEY}`, {
                  address: {
                    regionCode: 'US',
                    locality: property.mailingDetails.city,
                    administrativeArea: property.mailingDetails.state,
                    postalCode: property.mailingDetails.zip,
                    addressLines: [addressLine]
                  },
                  enableUspsCass: true
                })
                .then(({ headers, data }) => {
                  count++
                  property.google_address_data = { ...data.result, responseId: data.responseId, validated_on: new Date() }
                  property.address_verified_external = data.result.uspsData.cassProcessed
                  if(count > 0 && count % 50 === 0) console.log('Saved', count, 'of', chunk)
                  nextProperty(null)
                })
                .catch(e => {
                  console.log(e)
                  nextProperty(null)
                  count++
                })
              },
              (err) => {
                if(err) {
                  console.log(err)
                  done(null)
                } else {
                  console.log('Saving',properties.length,'properties')
                  Property.bulkSave(properties)
                  done(null)
                }
              }
            )
          },
          (done) => {
            console.log('Pausing for', 60,'seconds')
            setTimeout(() => {
              next(null)
            }, 60 * 1000, next)
          }
        ])
      },
      (err, result) => {
        res.send()
      }
    )
    res.send()
  })
  .catch(next)
})

router.get('/all_properties', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    let properties = await Property.find({qualified_for_mailing: true}, {mailing_details: 1, address_verified_external: 1, address_verified_internal: 1, apn: 1})
    res.send(properties)
  })
  .catch(next)
})

router.post('/save_changes', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    let docUpdates = req.body.updates
    let ids = docUpdates.map(item => item._id)
    let properties = await Property.find({_id: {$in: ids}})
    for(let i=0; i<docUpdates.length; i++) {
      for(const property of properties) {
        if(property._id.equals(docUpdates[i]._id)) {
          property.mailingDetails = docUpdates[i].mailingDetails
          property.address_verified_internal = true
          docUpdates[i] = await property.save()
          break
        }
      }
    }
    res.send(docUpdates)
  })
  .catch(next)
})

router.post('/verify_one_internal', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    let property = await Property.findById(req.body.update._id)
    property.mailingDetails = req.body.update.mailingDetails
    property.address_verified_internal = true
    let update = await property.save()
    res.send(update)
  })
  .catch(next)
})

router.post('/upload_mailing_addresses', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    let addresses = req.body.addresses

    while(addresses.length > 0) {
      let chunk = addresses.splice(0,500)
      console.log('Processing chunk of', chunk.length, 'of', addresses.length)
      let apns = chunk.map(item => item.apn)
      let deletedAPNs = []
      for(const item of chunk) {
        if(item.delete) deletedAPNs.push(item.apn)
      }
      if(deletedAPNs.length) {
        await Property.deleteMany({apn: {$in: deletedAPNs}})
      }
      let properties = await Property.find({apn: {$in: apns}})
      for(const property of properties) {
        for(const address of chunk) {
          if(address.apn === property.apn) {
            delete address.delete
            delete address.apn
            property.mailingDetails = {
              ...property.mailingDetails,
              ...address
            }
            property.address_verified_internal = true
          }
        }
      }
      await Property.bulkSave(properties)
      console.log('Saved', chunk.length, 'addresses')
    }
  })
  .catch(next)
})

router.get('/populate_letter_details', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    let ids = []
    let searching = true
    while(searching) {

      let properties = await Property.find({$and: [
        {qualified_for_mailing: true},
        {_id: {$nin: ids }},
        {address_verified_internal: true}
      ]}).limit(500)

      if(!properties.length) return res.send()

      properties.forEach(item => ids.push(item._id))

      const confirmNum = (val) => {
        val = Number(val)
        return isNaN(val) ? 0 : Math.round(val)
      }

      for(const property of properties) {
        property.mailing_details
        let val = confirmNum(Math.min(...[property.market_value * 0.5, property.avm.amount.value * 0.4]))
        property.mailing_details.purchase_price = Math.floor(val / 1000) * 1000
        val = confirmNum((property.prior_year_amount_due || 0) + (property.current_tax_levy || 0))
        property.mailing_details.tax_amount = Math.ceil(val / 1000) * 1000
        val = confirmNum((property.homeEquity.totalEstimatedLoanBalance || 0))
        property.mailing_details.mortgage_amount = Math.ceil(val / 1000) * 1000
        val = confirmNum(property.mailing_details.purchase_price * 0.05)
        property.mailing_details.closing_costs = Math.ceil(val / 100) * 100
        val = confirmNum(property.mailing_details.purchase_price - property.mailing_details.tax_amount - property.mailing_details.mortgage_amount - property.mailing_details.closing_costs)
        property.mailing_details.seller_proceeds = val
        property.mailing_details.target_property_address = property.address.oneLine
        property.address_verified_external = property.google_address_data.verdict.addressComplete
        if(property.address_verified_external) property.mailing_details.cassVerified = property.google_address_data.validated_on
        property.mailing_details.firstAddressLine = property.google_address_data.uspsData.standardizedAddress.firstAddressLine
        property.mailing_details.cityStateZipAddressLine = property.google_address_data.uspsData.standardizedAddress.cityStateZipAddressLine
        property.mailing_details.assessedValue = confirmNum(property.market_value)
        property.mailing_details.avm = confirmNum(property.avm.amount.value)
      }
      
      await Property.bulkSave(properties)
      console.log(ids.length)
    }
    res.send()
  })
  .catch(e => console.log(e))
})

router.post('/mark_addressed_envelope_complete', (req, res, next) => {
  Promise.resolve()
  .then(async () => {
    // await Property.updateMany({mailing_details: {$exists: true}}, {"mailing_details.addressed_envelope": false})
    let property = await Property.findOne({_id: req.body.property})
    property.mailing_details.addressed_envelope = true
    await property.save()
    res.send()
  })
  .catch(next)
})

module.exports = router