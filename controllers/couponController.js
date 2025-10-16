const Cart = require("../models/cart");
const Coupon = require("../models/coupon");
const Offer = require('../models/offer')

// Load Coupons for Coupon Management Page
const CouponPageLoad = async (req, res) => {
    try {
        const coupons = await Coupon.find();
        res.render('admin/coupon-management', { coupons });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.render('admin/coupon-management', { coupons: [], errorMessage: 'Failed to load coupons. Please try again.' });
    }
};


const addCoupon = async (req, res) => {
    try {
        const { name, percentage, couponCode, minimumAmount, maxredeemAmount, expires, status } = req.body;

        if (!name || !percentage || !couponCode || !minimumAmount || !maxredeemAmount || !expires || status === undefined) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        // Check if the coupon code already exists
        const existingCoupon = await Coupon.findOne({ couponCode });
        if (existingCoupon) {
            return res.status(400).json({ success: false, error: 'Coupon code already exists' });
        }

        // Create a new coupon if code does not exist
        const newCoupon = new Coupon({
            name,
            percentage,
            couponCode,
            minimumAmount,
            maxredeemAmount,
            expires: new Date(expires),
            status,
        });

        const savedCoupon = await newCoupon.save();

        res.status(200).json({
            success: true,
            data: savedCoupon,
            message: 'Coupon added successfully'
        });

    } catch (error) {
        console.error('Error adding coupon:', error);
        res.status(500).json({ success: false, error: 'Failed to add coupon. Please try again.' });
    }
};



// Edit Coupon function
// Toggle Coupon Status function
const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;

        // Find the coupon by ID
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        // Toggle the status
        coupon.status = !coupon.status;
        const updatedCoupon = await coupon.save(); // Save the updated coupon

        res.status(200).json({
            success: true,
            data: updatedCoupon,
            message: `Coupon status updated to ${updatedCoupon.status ? 'Active' : 'Inactive'}`,
        });
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).json({ success: false, message: 'Failed to update coupon status. Please try again.' });
    }
};

// Delete Coupon function
const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedCoupon = await Coupon.findByIdAndDelete(id);

        if (!deletedCoupon) {
            return res.status(404).json({ success:false, error: 'Coupon not found' });
        }

        res.status(200).json({ success:true , message: 'Coupon deleted successfully' });

    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ success :false, error: 'Failed to delete coupon. Please try again.' });
    }
};


const applyCoupon = async (req, res) => { 
    try {
        const { couponCode } = req.body;

        const cartItems = await Cart.findOne({ user: req.session.user_id }).populate('products.product');

        if (!cartItems) {
            return res.status(404).json({ success: false, message: 'Cart not found.' });
        }
        const activeOffers = await Offer.find({
            status: true,
            expiryDate: { $gte: new Date() }
        });

        let originalTotal = 0;
        const productsWithPrices = cartItems.products.map(cartItem => {
            const product = cartItem.product;

            let offerPrice = null;
            const productOffer = activeOffers.find(offer => offer.offerType === 'product' && offer.selectItem.equals(product._id));
            const categoryOffer = activeOffers.find(offer => offer.offerType === 'category' && offer.selectItem.equals(product.category._id));

            if (productOffer) {
                offerPrice = product.price - (product.price * (productOffer.discountPercentage / 100));
            } else if (categoryOffer) {
                offerPrice = product.price - (product.price * (categoryOffer.discountPercentage / 100));
            }

            const finalPrice = offerPrice || product.price;
            originalTotal += finalPrice * cartItem.quantity;

            return {
                product: product._id,
                quantity: cartItem.quantity,
                price: finalPrice 
            };
        });

        console.log(cartItems);
        console.log(originalTotal);

        const coupon = await Coupon.findOne({ couponCode });
        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid coupon code' });
        }

        if (originalTotal < coupon.minimumAmount) {
            return res.status(400).json({ message: 'Coupon not applicable for this amount.' });
        }

        const discountAmount = Math.min((coupon.percentage / 100) * originalTotal, coupon.maxredeemAmount);
        const newTotal = originalTotal - discountAmount;

        req.session.couponDiscount = discountAmount;
        req.session.couponId = coupon._id; // Store the coupon ID in the session
        req.session.discountedTotal = newTotal;

        return res.json({
            success: true,
            discountAmount,
            couponName: coupon.name,
            newTotal,
            message: 'Coupon applied successfully.'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'An error occurred while applying the coupon.' });
    }
};



module.exports = {
    CouponPageLoad,
    addCoupon,
    deleteCoupon,
    toggleCouponStatus,
    applyCoupon
};
