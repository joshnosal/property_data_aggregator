const mongoose = require('mongoose')

const zipcodeSchema = new mongoose.Schema({
  zip: String,
  addresses: Array,
  pulled_addresses: Boolean,
})

module.exports = mongoose.model('Zipcode', zipcodeSchema)