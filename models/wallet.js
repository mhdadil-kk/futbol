const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    amount:{
        type:Number,
        required: true
    },
    payment_type:{
        type:String,
        required:true
    }
},{
    timestamps: true
});


module.exports = mongoose.model('wallet' , walletSchema);
