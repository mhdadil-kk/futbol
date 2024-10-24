const Cart = require("../models/cart")
const Order = require('../models/order');
const Razorpay = require('razorpay');
const User = require("../models/user");
const Wallet = require("../models/wallet");
const Offer = require('../models/offer')
const Product = require('../models/product')
const crypto = require('crypto');
const ReturnOrder = require("../models/ReturnOrder");
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const razorpayInstance = new Razorpay({
    key_id: process.env.KEY_ID,
    key_secret: process.env.KEY_SECRET
});


const loadOrderList = async (req, res) => {
    try {
        const userId = req.session.user_id ? req.session.user_id : null;// Use optional chaining to avoid errors if user is undefined

        if (!userId) {
            console.error('User ID is not defined');
            return res.status(400).send('User not authenticated');
        }

        const orders = await Order.find({ user: userId }).sort({ orderDate: -1 }).exec();

        if (!orders || orders.length === 0) {
            console.log('No orders found for user:', userId);
            return res.render('user/order', { orders: [] }); // Render with an empty list
        }

        res.render('user/order', { orders });
    } catch (error) {
        console.error('Error loading orders:', error);
        res.status(500).send('Internal server error');
    }
};



const loadOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        console.log(orderId, "order ID");

        // Fetch returned products with detailed status and reason
        const returnedProducts = await ReturnOrder.aggregate([
            { $match: { orderId: new ObjectId(orderId) } },
            { $unwind: "$products" },
            {
                $project: {
                    _id: 1,
                    orderId: 1,
                    userId: 1,
                    "products.productId": "$products.productId",
                    "products.quantity": "$products.quantity",
                    "products.reason": "$products.reason", // Include reason for each product
                    "products.status": "$products.status", // Include status for each product
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]);

        console.log(returnedProducts);

        // Create a mapping of returned products with status and reason
        const returnedProductMap = returnedProducts.reduce((acc, item) => {
            acc[item.products.productId] = {
                status: item.products.status, // Status of the product
                reason: item.products.reason // Reason for return
            };
            return acc;
        }, {});

        // Find the order details
        const order = await Order.findById(orderId)
            .populate('products.product')
            .populate('deliveryAddress')
            .populate('user');

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        // Calculate estimated delivery date
        const orderDate = new Date(order.orderDate);
        const estimatedDeliveryDate = new Date(orderDate);
        estimatedDeliveryDate.setDate(orderDate.getDate() + 4); // Add 4 days

        // Render the view and pass order, returnedProducts, and returnedProductMap
        res.render('user/order-Details', {
            order,
            estimatedDeliveryDate: estimatedDeliveryDate.toDateString(),
            returnedProducts,
            returnedProductMap 
        });

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('error', { message: 'Error fetching order details' });
    }
};




const cancelOrder = async (req, res) => {
    const { orderId } = req.params;
    const { selectedProducts, cancellationReason } = req.body;

    try {
        const order = await Order.findById(orderId).populate('products.product');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Order is already cancelled' });
        }

        if (!selectedProducts || selectedProducts.length === 0) {
            return res.status(400).json({ success: false, message: 'No products selected for cancellation' });
        }

        let refundAmount = 0;

        for (const productId of selectedProducts) {
            const productIndex = order.products.findIndex(item => item.product._id.toString() === productId);

            if (productIndex === -1) {
                return res.status(404).json({ success: false, message: `Product with ID ${productId} not found in order` });
            }

            const canceledProduct = order.products[productIndex];

            const product = await Product.findById(canceledProduct.product._id);
            if (product) {
                product.stock += canceledProduct.quantity;
                await product.save();
            }

            refundAmount += canceledProduct.price * canceledProduct.quantity;
            order.products.splice(productIndex, 1);
        }

        order.totalPrice -= refundAmount;

        if (order.products.length === 0) {
            order.status = 'Cancelled';
        }

        const userId = order.user;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (order.paymentMethod === 'Wallet' || order.paymentMethod === 'Razorpay') {
            if (order.paymentStatus === "Paid") {
                user.wallet_balance += refundAmount;
                await user.save();

                const walletTransaction = new Wallet({
                    user: userId,
                    amount: refundAmount,
                    payment_type: 'Credit',
                });
                await walletTransaction.save();
            }
        }

        await order.save();

        res.status(200).json({ success: true, message: 'Selected products cancelled and refund processed', refundAmount });
    } catch (error) {
        console.error('Error cancelling products in order:', error);
        res.status(500).json({ success: false, message: 'An error occurred while cancelling the products', error: error.message });
    }
};



const placeOrder = async (req, res) => {
    try {
        const { address, paymentMethod } = req.body;
        const userId = req.session.user_id;

        if (!address || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Address and payment method are required'
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const cart = await Cart.findOne({ user: userId }).populate('products.product');

        if (!cart || cart.products.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        const activeOffers = await Offer.find({
            status: true,
            expiryDate: { $gte: new Date() }
        });

        let totalPrice = 0;
        const productsWithPrices = cart.products.map(cartItem => {
            const product = cartItem.product;

            // Determine offer price
            let offerPrice = null;
            const productOffer = activeOffers.find(offer => offer.offerType === 'product' && offer.selectItem.equals(product._id));
            const categoryOffer = activeOffers.find(offer => offer.offerType === 'category' && offer.selectItem.equals(product.category._id));

            if (productOffer) {
                offerPrice = product.price - (product.price * (productOffer.discountPercentage / 100));
            } else if (categoryOffer) {
                offerPrice = product.price - (product.price * (categoryOffer.discountPercentage / 100));
            }

            const finalPrice = offerPrice || product.price; // Use offer price if available, otherwise original price
            totalPrice += cartItem.quantity * finalPrice;

            return {
                product: product._id,
                quantity: cartItem.quantity,
                price: finalPrice // Use final price for order
            };
        });

        if (req.session.discountedTotal) {
            totalPrice = req.session.discountedTotal;
        }

        let couponDiscound = req.session.couponDiscount;
        let offerDiscound = req.session.offerPrice;
        req.session.discountedTotal = null;

        // Check for COD payment method and total price > 1000
        if (paymentMethod === 'COD' && totalPrice > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Cash on Delivery is not available for orders above 1000. Please choose another payment method.'
            });
        }

        // Proceed to create order only if COD condition is not triggered or for other payment methods

        const newOrder = new Order({
            user: userId,
            products: productsWithPrices,
            totalPrice,
            couponDiscound,
            offerDiscound,
            deliveryAddress: address,
            paymentMethod,
            status: 'Pending'
        });

        const savedOrder = await newOrder.save();

        // Handle Wallet Payment
        if (paymentMethod === 'Wallet') {
            const user = await User.findOne({ _id: userId });
            if (user.wallet_balance < totalPrice) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance. Please try another payment method.'
                });
            }

            user.wallet_balance -= totalPrice;
            await user.save();

            // Record wallet transaction
            const walletTransaction = new Wallet({
                user: userId,
                amount: totalPrice,
                payment_type: 'Debit'
            });
            await walletTransaction.save();
            savedOrder.status = 'Confirmed'
            savedOrder.paymentStatus = 'Paid';
            await savedOrder.save();

            // Empty cart after order placement
            await Cart.deleteOne({ user: userId });

            return res.json({
                success: true,
                orderId: savedOrder._id,
                message: 'Order placed successfully with wallet payment'
            });
        }

        // Handle Razorpay Payment
        if (paymentMethod === 'Razorpay') {
            const options = {
                amount: totalPrice * 100, // Convert to the smallest currency unit
                currency: 'INR',
                receipt: `receipt_order_${Date.now()}`,
                payment_capture: 1
            };

            const razorpayOrder = await razorpayInstance.orders.create(options);

            req.session.razorpayOrderId = razorpayOrder.id;

            await Cart.deleteOne({ user: userId });

            return res.json({
                success: true,
                orderId: savedOrder._id,
                razorpayOrderId: razorpayOrder.id,
                totalPrice,
                key: process.env.KEY_ID
            });
        }

        // Handle COD Payment
        if (paymentMethod === 'COD') {
            await Cart.deleteOne({ user: userId });

            return res.json({
                success: true,
                orderId: savedOrder._id,
                message: 'Order placed successfully with COD'
            });
        }

    } catch (error) {
        console.error('Error placing order:', error.message);
        res.status(500).json({
            success: false,
            message: error.message || 'An error occurred while placing your order. Please try again.'
        });
    }
};



// Assuming you have the necessary imports and setup

const continuePayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        console.log(orderId);

        const orderData = await Order.findById(orderId);
        if (!orderData) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const options = {
            amount: orderData.totalPrice * 100,
            currency: 'INR',
            receipt: `receipt_order_${Date.now()}`,
            payment_capture: 1
        };

        const razorpayOrder = await razorpayInstance.orders.create(options);
        req.session.razorpayOrderId = razorpayOrder.id;

        return res.json({
            success: true,
            orderId: orderData._id,
            razorpayOrderId: razorpayOrder.id,
            totalPrice: orderData.totalPrice,
            key: process.env.KEY_ID
        });
    } catch (error) {
        console.error("Error in continuePayment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// Add your endpoint for confirming payment here



const confirmPayment = async (req, res) => {
    try {
        const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

        // Ensure all required parameters are provided
        if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
            return res.status(400).json({ message: 'Missing payment details' });
        }

        // Find the order in the database
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Create a HMAC using the Razorpay order ID and payment ID
        const hmac = crypto.createHmac('sha256', process.env.KEY_SECRET); // Use Razorpay key_secret from environment variables
        hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
        const generatedSignature = hmac.digest('hex');

        // Verify the payment signature
        if (generatedSignature === razorpaySignature) {
            // Payment is successful and verified
            order.paymentStatus = 'Paid'; // Corrected field name
            order.status = 'Confirmed';   // Corrected field name
            await order.save();

            res.status(200).json({ message: 'Success', orderId: order._id });
        } else {
            // Signature mismatch, payment verification failed
            return res.status(400).json({ message: 'Invalid payment signature' });
        }
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};




//admin Side  


const adOrderLoad = async (req, res) => {
    try {

        const orders = await Order.find()
            .populate('user', 'name email')
            .populate('products.product', 'name')
            .populate('deliveryAddress')
            .sort({ createdAt: -1 });
        res.render('admin/orderList', { orders });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};


const adOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        // Fetch returned products for the order with detailed status and reason
        const returnedProducts = await ReturnOrder.aggregate([
            { $match: { orderId: new ObjectId(orderId) } },
            { $unwind: "$products" },
            {
                $project: {
                    _id: 1,
                    orderId: 1,
                    userId: 1,
                    "products.productId": "$products.productId",
                    "products.quantity": "$products.quantity",
                    "products.reason": "$products.reason", // Include return reason for each product
                    "products.status": "$products.status", // Include return status for each product
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]);

        // Create a map of returned products, their statuses, and reasons
        const returnedProductMap = returnedProducts.reduce((acc, item) => {
            acc[item.products.productId] = {
                status: item.products.status, // Status of the return
                reason: item.products.reason  // Return reason
            };
            return acc;
        }, {});

        // Fetch order details
        const order = await Order.findById(orderId)
            .populate('products.product')
            .populate('deliveryAddress')
            .populate('user')
            .exec();

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        // Render the admin order detail page
        res.render('admin/orders-detail', {
            order,
            returnedProductMap  // Pass this to the view
        });
    } catch (error) {
        console.error('Error fetching order details for admin:', error);
        res.status(500).send('Server Error');
    }
};




const updateOrder = async (req, res) => {
    try {

        const orderId = req.params.orderId
        const { status } = req.body

        const Updated = await Order.findByIdAndUpdate(orderId, { status }, { new: true })

        if (Updated) {
            res.redirect(`/admin/orders/${orderId}`);
        } else {
            return res.status(404).send('Order not found');

        }




    } catch (error) {
        console.log(error)
    }
}



const createReturnOrder = async (req, res) => {
    const { returnReason, selectedProducts } = req.body;

    try {
        // Find the order to ensure it belongs to the user and is eligible for return
        const order = await Order.findById(req.params.orderId)
            .populate('products.product')
            .populate('user'); // Ensure the user field is populated

        console.log("Order:", order); // Debugging line

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        if (!order.user) {
            return res.status(500).json({ success: false, message: 'Order user is not defined.' });
        }

        // Verify user ownership
        if (order.user._id.toString() !== req.session.user_id) {
            return res.status(403).json({ success: false, message: 'You are not authorized to return this order.' });
        }

        // Create return order object
        const returnOrder = new ReturnOrder({
            orderId: req.params.orderId,
            userId: req.session.user_id, // Use session user ID
            products: selectedProducts.map(productId => {
                const orderedProduct = order.products.find(item => item.product._id.toString() === productId);
                return {
                    productId,
                    quantity: orderedProduct ? orderedProduct.quantity : 1, // Default to 1 if not found
                    reason: returnReason, // Assign the reason to each product
                    status: 'requested'    // Assign the initial status to each product
                };
            }),
            // Removed reason and status from here as they are now included in products
            status: 'requested' // This can be kept if you want an overall status for the return order
        });

        // Save return order to the database
        await returnOrder.save();

        res.status(201).json({ success: true, message: 'Return request submitted successfully.', returnOrder });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
    }
};


const returnReq = async (req, res) => {
    const { productId, orderId, action } = req.body;

    try {
        // Find the order to ensure it exists and is eligible for return
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // Find the return order associated with this order ID and product ID
        const returnOrder = await ReturnOrder.findOne({ orderId, 'products.productId': productId });
        if (!returnOrder) {
            return res.status(404).json({ success: false, message: 'Return request not found.' });
        }

        // Find the specific product in the return order
        const productIndex = returnOrder.products.findIndex(item => item.productId.toString() === productId);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in return request.' });
        }

        // Update return order status based on action (Accept, Reject, Returned)
        if (action === 'Accept') {
            returnOrder.products[productIndex].status = 'approved'; 
        } else if (action === 'Reject') {
            returnOrder.products[productIndex].status = 'rejected'; 
        } else if (action === 'Returned') {
            returnOrder.products[productIndex].status = 'returned'; 

            // Check if the payment method is 'Razorpay' or 'Wallet'
            if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') {
                // Find the user associated with this order
                const user = await User.findById(order.user);
                if (!user) {
                    return res.status(404).json({ success: false, message: 'User not found.' });
                }

                // Find the product in the order
                const product = order.products.find(item => item.product.toString() === productId);
                if (!product) {
                    return res.status(404).json({ success: false, message: 'Product not found in the order.' });
                }

                // Add the product amount to the user's wallet
                user.wallet_balance = (user.wallet_balance || 0) + product.price;

                // Save the updated user details
                await user.save();
                const walletTransaction = new Wallet({
                    user: order.user,
                    amount: product.price,
                    payment_type: 'Credit',
                });
                await walletTransaction.save();
            }
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action.' });
        }

        // Save the updated return order
        await returnOrder.save();

        return res.status(200).json({ success: true, message: `Return request ${action}ed successfully.` });
    } catch (error) {
        console.error('Error processing return request:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};





module.exports = {
    loadOrderList,
    loadOrderDetails,
    placeOrder,
    cancelOrder,
    adOrderLoad,
    adOrderDetails,
    confirmPayment,
    continuePayment,
    updateOrder,
    createReturnOrder,
    returnReq
}

