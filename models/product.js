const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    status: {
        type: Boolean,
        default: false
    },
    category: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category',
    },
    stock: {
        type: Number,
        required: true,
    },
    images: [String],
    
    offers: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Offer' 
    }],
},{
    timestamps :true
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
