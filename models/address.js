const mongoose = require('mongoose')

const addressSchema  = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true }, // Reference to User
    name: { 
        type: String,
       required: true
     },
    streetAddress: { 
        type: String,
        required: true
     },
    state: { 
        type: String,
         required: true
     },
    district: { type: String,
         required: true
         },
    pinCode: { type: String,
         required: true
         },
    mobile: {
         type: String,
          required: true
         },
    country: {
         type: String,
          required: true

     }
})

module.exports = mongoose.model('Address', addressSchema);
