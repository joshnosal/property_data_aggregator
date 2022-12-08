if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

// SERVER RESOURCES
const express = require('express')
const mongoose = require('mongoose')
const path = require('path')
const propertyRouter = require('./routes/property')
const mailRouter = require('./routes/mailings')

const PORT = process.env.PORT || 4001
const app = express()

app.use(express.urlencoded({extended: false, limit: '50mb'}))
app.use(express.json({limit: '50mb'}))
app.use('/api/property', propertyRouter)
app.use('/api/mailings', mailRouter)

if(process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'build')))
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'))
  })
}

mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

let db = mongoose.connection
db.on('connected', ()=>{
  app.listen(PORT, ()=>{
    console.log(`Server listening at port ${PORT}.`)
  })
})
