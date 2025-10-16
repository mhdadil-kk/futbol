const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReturnOrderSchema = new Schema({
    orderId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Order', 
        required: true 
    },
    userId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    products: [{
        productId: { 
            type: Schema.Types.ObjectId, 
            ref: 'Product', 
            required: true 
        },
        quantity: {
            type: Number,
            required: true,
            default: 1 // Default quantity if not provided
        },
        reason: { // Reason for returning the specific product
            type: String,
            required: true
        },
        status: { 
            type: String, 
            enum: ['requested', 'approved', 'rejected', 'returned'], 
            default: 'requested' 
        }
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('ReturnOrder', ReturnOrderSchema);
