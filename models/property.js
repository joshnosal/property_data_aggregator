const mongoose = require('mongoose')

const mailingSchema = new mongoose.Schema({
  first_names: String,
  full_names: String,
  street1: String,
  street2: String,
  city: String,
  state: String,
  zip: String,
  purchase_price: Number,
  target_property_address: String,
  tax_amount: Number,
  mortgage_amount: Number,
  closing_costs: Number,
  seller_proceeds: Number,
  cassVerified: Date,
  firstAddressLine: String,
  cityStateZipAddressLine: String,
  lastMailSent: Date,
  assessedValue: Number,
  avm: Number,
  addressed_envelope: Boolean
}, { timestamps: true})

const propertySchema = new mongoose.Schema({
  fips: {type: String, required: true },
  apn: {type: String, required: true },
  owner_address: String,
  owner_name: String,
  property_address: String,
  status: String,
  current_tax_levy: Number,
  exemptions: String,
  prior_year_amount_due: Number,
  market_value: Number,
  land_value: Number,
  improvement_value: Number,

  attom_id: Number,
  attom_msg: String,
  address: Object,
  homeEquity: Object,
  avm: Object,
  building: Object,
  summary: Object,
  owner: Object,
  mortgage: Object, //Probably useless

  saleHistory: Array, //from sale history
  foreclosure: Array, //from sale history
  searched_saleHistory: Date,

  default: Array, //from preforeclosure
  auction: Array, //from preforeclosure
  foreclosure_searched: Boolean,

  qualified_for_mailing: Boolean, //Toggle if I want to mail to this person
  address_verified_internal: Boolean,
  address_verified_external: Boolean,
  mailingDetails: Object,
  mailing_details: mailingSchema,
  google_address_data: Object
}, {timestamps: true })

module.exports = mongoose.model('Property', propertySchema)

