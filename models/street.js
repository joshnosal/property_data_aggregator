const mongoose = require('mongoose')

const streetSchema = new mongoose.Schema({
  name: String,
  county: String,
  state: String,
  account_ids: Array,
  ids_pulled: Date,
  details_pulled: Date,
})

module.exports = mongoose.model('Street', streetSchema)