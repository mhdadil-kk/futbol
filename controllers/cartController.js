const address = require("../models/address");
const Cart = require("../models/cart");
const Coupon = require("../models/coupon");
const Offer = require("../models/offer");
const Product = require("../models/product");
const User = require("../models/user");

const loadCart = async (req, res) => {
    try {
        const userId = req.session.user_id;
        if (!userId) {
            return res.redirect('/login'); // Redirect to login if not authenticated
        }

        // Fetch the cart with populated product details
        const cart = await Cart.findOne({ user: userId }).populate('products.product');
        
        if (!cart) {
            return res.render('user/cart', {
                cart: { products: [], total_price: 0 }
            });
        }

        // Fetch active offers
        const activeOffers = await Offer.find({
            status: true,
            expiryDate: { $gte: new Date() }
        });

        let total_price = 0;

        const cartProducts = cart.products.map(item => {
            const product = item.product;
            let offerPrice = null;
            let applicableOffer = null;

            const productOffer = activeOffers.find(offer => offer.offerType === 'product' && offer.selectItem.equals(product._id));
            const categoryOffer = activeOffers.find(offer => offer.offerType === 'category' && offer.selectItem.equals(product.category._id));

            if (productOffer) {
                applicableOffer = productOffer;
            } else if (categoryOffer) {
                applicableOffer = categoryOffer;
            }

            if (applicableOffer) {
                offerPrice = product.price - (product.price * (applicableOffer.discountPercentage / 100));
            }

            const finalPrice = offerPrice || product.price;
            
            total_price += item.quantity * finalPrice;

            return {
                ...item._doc,
                product: {
                    ...product._doc,
                    offerPrice,
                    discountPercentage: applicableOffer ? applicableOffer.discountPercentage : 0
                }
            };
        });

        res.render('user/cart', {
            cart: {
                products: cartProducts,
                total_price: total_price.toFixed(2) 
            }
        });
    } catch (error) {
        console.log(error);
        res.render('user/cart', {
            cart: { products: [], total_price: 0 }
        });
    }
};


const addToCart = async (req, res) => { 
    try {
        console.log('here')
        // Ensure user ID is present
        const userId = req.session.user_id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not logged in' });
        }
        
        const { productId, quantity } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check if the product is out of stock
        if (product.stock === 0) {
            return res.status(404).json({ success: false, message: 'Product Out of stock' });
        }

        const MAX_QTY_PER_USER = 5;

        let existingCart = await Cart.findOne({ user: userId });

        if (existingCart) {
            const productIndex = existingCart.products.findIndex(p => p.product.toString() === productId);

            if (productIndex > -1) {
                let newQuantity = existingCart.products[productIndex].quantity + Number(quantity);

                if (newQuantity > product.stock) {
                    newQuantity = product.stock;
                }
                if (newQuantity > MAX_QTY_PER_USER) {
                    newQuantity = MAX_QTY_PER_USER;
                }

                const quantityToAdd = newQuantity - existingCart.products[productIndex].quantity;
                existingCart.products[productIndex].quantity = newQuantity;
                existingCart.products[productIndex].product_total = newQuantity * product.price;
            } else {
                let newQuantity = Math.min(quantity, product.stock, MAX_QTY_PER_USER);
                
                existingCart.products.push({ product: productId, quantity: newQuantity, product_total: newQuantity * product.price });
            }

            // Recalculate total price
            existingCart.total_price = existingCart.products.reduce((acc, curr) => acc + curr.product_total, 0);
            await existingCart.save();
        } else {
            // New cart for the user
            let newQuantity = Math.min(quantity, product.stock, MAX_QTY_PER_USER);
            
            // Update stock
            const newCart = new Cart({
                user: userId,
                products: [{ product: productId, quantity: newQuantity, product_total: newQuantity * product.price }],
                total_price: newQuantity * product.price
            });
            await newCart.save();
        }

        // Save updated product stock
        await product.save();

        return res.json({ success: true });
    } catch (error) {
        console.log('Error adding to cart:', error);
        return res.json({ success: false, message: 'Error adding product to cart' });
    }
};


const removeProduct = async (req, res) => {
    try {
        const userId = req.session.user_id;
        if (!userId) {
            return res.redirect('/login'); // Redirect to login if not authenticated
        }

        const productId = req.params.productId; // Get the product ID from the URL

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.redirect('/cart'); // Redirect if the cart does not exist
        }

        // Find the index of the product to be removed
        const productIndex = cart.products.findIndex(p => p.product.toString() === productId);
        if (productIndex > -1) {
            // Get the quantity of the product being removed
            const quantityToRemove = cart.products[productIndex].quantity;

            // Find the product
            const product = await Product.findById(productId);
            if (product) {
                // Increase the stock based on the quantity removed
                await product.save(); // Save the updated product stock
            }

            // Remove the product from the cart
            cart.products.splice(productIndex, 1);

            // Recalculate the total price
            cart.total_price = cart.products.reduce((acc, curr) => acc + curr.product_total, 0);

            // Save the updated cart to the database
            await cart.save();
        }

        // Redirect back to the cart page after updating
        res.redirect('/cart');
    } catch (error) {
        console.log('Error removing product from cart:', error);
        res.redirect('/cart');
    }
};


const updateCart = async (req, res) => {
    try {
        const userId = req.session.user_id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not logged in' });
        }

        const productId = req.params.productId; 
        const { quantity } = req.body; 

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const activeOffers = await Offer.find({
            status: true,
            expiryDate: { $gte: new Date() }
        });

        let offerPrice = null;
        const productOffer = activeOffers.find(offer => offer.offerType === 'product' && offer.selectItem.equals(product._id));
        const categoryOffer = activeOffers.find(offer => offer.offerType === 'category' && offer.selectItem.equals(product.category._id));

        if (productOffer) {
            offerPrice = product.price - (product.price * (productOffer.discountPercentage / 100));
        } else if (categoryOffer) {
            offerPrice = product.price - (product.price * (categoryOffer.discountPercentage / 100));
        }

        const finalPrice = offerPrice || product.price; 

        let cart = await Cart.findOne({ user: userId });

        if (cart) {
            const productIndex = cart.products.findIndex(p => p.product.toString() === productId);

            if (productIndex > -1) {
                const previousQuantity = cart.products[productIndex].quantity;
                let newQuantity = Number(quantity);

                const MAX_QTY_PER_USER = 5;
                if (newQuantity > product.stock) {
                    newQuantity = product.stock;
                    return res.json({ success: false, message: 'Not enough stock available' });

                }
                if (newQuantity > MAX_QTY_PER_USER) {
                    return res.json({ success: false, message: `Maximum quantity per product is ${MAX_QTY_PER_USER}` });
                }
                if (newQuantity < 1) {
                    newQuantity = 1;
                }

                if (newQuantity > previousQuantity) {
                    // Decrease stock
                    const stockChange = newQuantity - previousQuantity;
                    if (product.stock < stockChange) {
                        return res.json({ success: false, message: 'Not enough stock available' });
                    }
                }

                // Update cart
                cart.products[productIndex].quantity = newQuantity;
                cart.products[productIndex].product_total = newQuantity * finalPrice; // Use final price (offer or original)

                cart.total_price = cart.products.reduce((acc, curr) => acc + curr.product_total, 0);

                await product.save(); 
                await cart.save(); 
                return res.json({ success: true, price: finalPrice, total_price: cart.total_price });
            } else {
                return res.status(404).json({ success: false, message: 'Product not found in cart' });
            }
        } else {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }
    } catch (error) {
        console.log('Error updating cart:', error);
        return res.json({ success: false, message: 'Error updating cart' });
    }
};




const loadcheckout = async (req, res) => {
    try {
        const userId = req.session.user_id;

        const user = await User.findOne({ _id: userId });
        const addresses = await address.find({ user: userId });
        const coupons = await Coupon.find({ status: true });
        const cart = await Cart.findOne({ user: userId }).populate('products.product');

        // Fetch active offers
        const activeOffers = await Offer.find({
            status: true,
            expiryDate: { $gte: new Date() }
        });

        const cartItems = cart.products.map(item => {
            const product = item.product;

            // Determine offer price
            let offerPrice = null;
            const productOffer = activeOffers.find(offer => offer.offerType === 'product' && offer.selectItem.equals(product._id));
            const categoryOffer = activeOffers.find(offer => offer.offerType === 'category' && offer.selectItem.equals(product.category._id));

            // Check and apply product offer
            if (productOffer) {
                offerPrice = product.price - (product.price * (productOffer.discountPercentage / 100));
                req.session.offerPrice = offerPrice; // Set the correct offer price
            } 

            else if (categoryOffer) {
                offerPrice = product.price - (product.price * (categoryOffer.discountPercentage / 100));
                req.session.offerPrice = offerPrice; // Set the correct offer price
            } else {
                req.session.offerPrice = product.price; // No offer, so original price
            }

            const finalPrice = offerPrice || product.price; // Use offer price if available, otherwise original price

            return {
                name: product.name,
                quantity: item.quantity,
                price: finalPrice,
                totalPrice: item.quantity * finalPrice // Use final price for total
            };
        });

        const totalPrice = cartItems.reduce((total, item) => total + item.totalPrice, 0);

        res.render('user/checkout', {
            user,
            addresses,
            cartItems,
            totalPrice,
            coupons
        });

    } catch (error) {
        console.log('Error loading checkout:', error);
        res.status(500).json({ success: false, message: 'Error loading checkout' });
    }
};




module.exports = {
    loadCart,
    addToCart,
    loadcheckout,
    removeProduct,
    updateCart

};
