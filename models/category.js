const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    is_hide:{
        type: Boolean,
        default: false
    }, 
}, {
    timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);