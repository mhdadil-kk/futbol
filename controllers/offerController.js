const Category = require("../models/category")
const Offer = require("../models/offer")
const Product = require("../models/product")

const loadOfferPage = async (req, res) => {
    try {
        const offers = await Offer.find({})
            .populate('selectItem', 'name') 
            .exec();

        const offersWithNames = offers.map(offer => ({
            ...offer._doc,
            selectedItemName: offer.selectItem ? offer.selectItem.name : 'N/A'
        }));

        res.render('admin/offer-management', { offers: offersWithNames });

    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
};



const getItems = async (req, res) => {
    try {
        const type = req.query.type;

        if (type === 'category') {
            const categories = await Category.find({});
            res.json({ items: categories.map(cat => ({ id: cat._id, name: cat.name })) });
        } else if (type === 'product') {
            const products = await Product.find({});
            res.json({ items: products.map(prod => ({ id: prod._id, name: prod.name })) });
        } else {
            res.status(400).json({ success: false, error: 'Invalid type specified' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

const addOffer = async (req, res) => {
    try {
        const { offerName, discountPercentage, offerType, expiryDate, selectItem } = req.body;

        // Validate the input data
        if (!offerName || !discountPercentage || !offerType || !selectItem || !expiryDate) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        // Check if an offer already exists for the selected item
        const existingOffer = await Offer.findOne({ selectItem, offerType });
        if (existingOffer) {
            return res.status(400).json({ success: false, error: 'An offer already exists for this item' });
        }

        const item = await Product.findById(selectItem) || await Category.findById(selectItem);
        if (!item) {
            return res.status(404).json({ success: false, error: 'Selected item not found' });
        }

        // Create a new offer object
        const newOffer = new Offer({
            offerName,
            discountPercentage,
            offerType,
            expiryDate,
            selectItem,
        });

        // Save the new offer to the database
        await newOffer.save();

        console.log(item.name)
        // Send a success response
        res.status(200).json({ success: true, data: newOffer ,selectedItemName :item.name });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while adding the offer' });
    }
};



const deleteOffer = async (req, res) => {
    try {
        const offerId = req.params.offerId;
       console.log(offerId)
        
        if (!offerId) {
            return res.status(400).json({ success: false, error: 'Offer ID is required' });
        }

        
        const deletedOffer = await Offer.findByIdAndDelete(offerId);
          console.log(deletedOffer)
        
        if (!deletedOffer) {
            return res.status(404).json({ success: false, error: 'Offer not found' });
        }

        res.status(200).json({ success: true, message: 'Offer deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while deleting the offer' });
    }
};





const toggleOfferStatus = async (req, res) => {
    try {
        const { offerId } = req.params;

        const offer = await Offer.findById(offerId);

        if (!offer) {
            return res.status(404).send('Offer not found');
        }

        offer.status = !offer.status;

        await offer.save();

        res.status(200).json({
            success: true,
            message: 'Offer status updated successfully',
            offer: offer, 
        });
    } catch (error) {
        console.log(error); 
        res.status(500).send('Server Error'); 
    }
};


module.exports = {
    loadOfferPage,
    addOffer,
    getItems, 
    deleteOffer,
    toggleOfferStatus 

}