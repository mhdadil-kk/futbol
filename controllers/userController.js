const User = require('../models/user');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Product = require('../models/product');
const { validationResult } = require('express-validator');
const Address = require('../models/address');
const Wishlist = require('../models/wishlist');
const crypto = require('crypto');
const Wallet = require('../models/wallet');
const Category = require('../models/category');
const Offer = require('../models/offer');

require('dotenv').config(); // Load environment variables

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It expires in 5 minutes.`
    };

    await transporter.sendMail(mailOptions);
}

const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.render('user/verifyOTP', { email, error: 'Email is required to resend OTP', success: null });
        }

        const sessionUserData = req.session.userData;

        if (!sessionUserData || sessionUserData.email !== email) {
            return res.render('user/verifyOTP', { email, error: 'Invalid session or email mismatch', success: null });
        }

        const otp = generateOTP();
        console.log(otp)
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

        req.session.userData.otp = otp;
        req.session.userData.otpExpiry = otpExpiry;

        await sendOTPEmail(email, otp);

        res.render('user/verifyOTP', { email, error: null, success: 'OTP has been resent successfully' });
    } catch (error) {
        console.log("Error during OTP resend:", error);
        res.status(500).send('Server Error');
    }
}




const loadRegister = async (req, res) => {
    try {
        res.render('user/register', { errors: [], error: '' });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.log(error.message);
        throw new Error('Error hashing password');
    }
}

const registerUser = async (req, res) => {
    try {

        const errors = validationResult(req);


        if (!errors.isEmpty()) {
            return res.render('user/register', {
                errors: errors.errors,
                error: ''
            });
        }

        const { name, email, mobile, password, confirmPassword } = req.body;

        if (!name || !email || !mobile || !password, !confirmPassword) {
            return res.status(400).render('user/register', { errors: [], error: 'All fields are required' });
        }


        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).render('user/register', { errors: [], error: 'Email already registered.' });
        }





        if (!req.session.userData) {
            const sPassword = await securePassword(password);
            const otp = generateOTP();
            console.log(otp)
            const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

            req.session.userData = { name, email, mobile, password: sPassword, otp, otpExpiry };


            await sendOTPEmail(email, otp);
        }

        res.render('user/verifyOTP', { email, error: null, success: null, errors: [] });
    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
}

const verifyOTP = async (req, res) => {
    try {

        const { email, otp } = req.body;
        console.log(email, otp)


        if (!email || !otp) {
            return res.json({ error: 'Email and OTP are required' });
        }

        const sessionUserData = req.session.userData;

        if (!sessionUserData) {
            return res.json({ error: 'Session expired or invalid session.' });
        }

        const otpExpiry = new Date(sessionUserData.otpExpiry).getTime();
        if (sessionUserData.email === email && sessionUserData.otp === otp && otpExpiry > Date.now()) {
            const user = new User({
                name: sessionUserData.name,
                email: sessionUserData.email,
                mobile: sessionUserData.mobile,
                password: sessionUserData.password,
                isVerified: true
            });

            await user.save();
            req.session.userData = null;

            // Successful OTP verification
            res.json({ success: 'OTP verified successfully!' });
        } else {
            // Invalid or expired OTP
            res.json({ error: 'Invalid or expired OTP' });
        }
    } catch (error) {
        console.log("Error during OTP verification:", error);
        res.status(500).json({ error: 'Server Error' });
    }
};



const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {
            res.render('user/login', { errors: [], error: "" });
        } else {
            res.redirect('/')
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
}

const verifyLogin = async (req, res) => {
    try {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('user/login', {
                errors: errors.errors,
                error: ''
            });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.render('user/login', { errors: [], error: 'Email and password are required' });
        }

        const userData = await User.findOne({ email });

        if (userData) {
            if (!userData.isVerified) {
                return res.render('user/login', { errors: [], error: 'Please verify your email before logging in' });
            }

            if (userData.is_blocked) {
                return res.render('user/login', { errors: [], error: 'your not allowed' })
            }

            const checkPassword = await bcrypt.compare(password, userData.password);
            if (checkPassword) {
                req.session.user_id = userData._id;
                req.session.user = {
                    name: userData.name,
                    email: userData.email,
                    mobile: userData.mobile,
                };
                res.redirect('/');
            } else {
                res.render('user/login', { errors: [], error: 'Invalid email or password' });
            }
        } else {
            res.render('user/login', { errors: [], error: 'Invalid email or password' });
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
}



// Forgot Password route
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        let error = null;
        let success = null;

        if (!email) {
            error = 'Email is required';
            return res.render('user/forgotPassword', { error, success });
        }

        const user = await User.findOne({ email });
        if (!user) {
            error = 'User with this email does not exist';
            return res.render('user/forgotPassword', { error, success });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = Date.now() + 3600000;
        console.log(resetToken)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = tokenExpiry;
        await user.save();

        const resetURL = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset',
            text: `You requested a password reset. Click the link to reset your password: ${resetURL}`
        };
        await transporter.sendMail(mailOptions);

        success = 'Password reset link has been sent to your email';
        res.render('user/forgotPassword', { error, success });
    } catch (error) {
        console.error(error);
        error = 'An error occurred while processing your request';
        res.render('user/forgotPassword', { error, success: null });
    }
};





// Load Reset Password Form
const loadResetPassword = async (req, res) => {
    try {
        const resetToken = req.params.token;

        const user = await User.findOne({
            resetPasswordToken: resetToken,
            resetPasswordExpires: { $gt: Date.now() } // Check if the token is not expired
        });

        if (!user) {
            return res.render('user/resetPassword', { error: 'Password reset token is invalid or has expired', token: null });
        }

        // Render the reset password form with the token
        res.render('user/resetPassword', { token: resetToken, error: null });
    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
};

// Reset Password logic
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (!newPassword || !confirmPassword) {
            return res.render('user/resetPassword', { error: 'All fields are required', token });
        }

        if (newPassword !== confirmPassword) {
            return res.render('user/resetPassword', { error: 'Passwords do not match', token });
        }

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() } // check if token is still valid
        });

        if (!user) {
            return res.render('user/resetPassword', { error: 'Token is invalid or has expired', token });
        }

        // Hash the new password
        const hashedPassword = await securePassword(newPassword);

        // Update user's password
        user.password = hashedPassword;
        user.resetPasswordToken = undefined; // remove the token after use
        user.resetPasswordExpires = undefined; // remove token expiry
        await user.save();

        res.redirect('/login')
    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
};



const loadHome = async (req, res) => {
    try {

        const products = await Product.find({ status: false }).sort({ createdAt: -1 }).limit(4);
        res.render('user/index', { products });

    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
}




const loadProfile = async (req, res) => {
    try {
        // if (!req.session.user_id) {
        //     return res.redirect('/login'); 
        // }

        const user = await User.findById(req.session.user_id);
        const addresses = await Address.find({ user: user._id });
        const wallet = await Wallet.find({ user: user._id }).sort({ createdAt: -1 }); 
        if (!user) {
            return res.redirect('/login');
        }

        res.render('user/profile', { user, addresses, wallet });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

const updateProfile = async (req, res) => {
    try {
        console.log("here")
        if (!req.session.user_id) {
            return res.redirect('/login');
        }

        const { name, mobile } = req.body;
        console.log(mobile)


        if (!name || !mobile) {
            return res.redirect('/profile');
        }


        await User.findByIdAndUpdate(req.session.user_id, { name, mobile });

        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};


// Load Shop Function
const loadShop = async (req, res) => {
    try {
        const userWishlist = await Wishlist.findOne({ user: req.session.user_id });

        const products = await Product.find({ status: false }).populate('category'); 
        const categories = await Category.find({ is_hide: false });

        const activeOffers = await Offer.find({
            status: true,
            expiryDate: { $gte: new Date() }
        });

        // Filter out hidden products and products with hidden categories
        const visibleProducts = products.filter(product => {
            // Check if product category exists and is not hidden
            return product.status === false && product.category && !product.category.is_hide;
        });

        // Apply offers to the filtered products
        const productData = visibleProducts.map(product => {
            let applicableOffer = null;
            let offerPrice = null;

            const productOffer = activeOffers.find(offer => offer.offerType === 'product' && offer.selectItem.equals(product._id));
            const categoryOffer = activeOffers.find(offer => offer.offerType === 'category' && offer.selectItem.equals(product.category._id));

            if (productOffer) applicableOffer = productOffer;
            else if (categoryOffer) applicableOffer = categoryOffer;

            if (applicableOffer) {
                offerPrice = product.price - (product.price * (applicableOffer.discountPercentage / 100));
            }

            return {
                ...product._doc,
                offer: applicableOffer,
                offerPrice,
                discountPercentage: applicableOffer ? applicableOffer.discountPercentage : 0
            };
        });

        res.render('user/shop', { products: productData, wishlist: userWishlist ? userWishlist.product : [], categories });
    } catch (error) {
        console.log('Error loading shop:', error);
        res.status(500).send('Server Error');
    }
};




// Load Advanced Search Function
const loadProducts = async (req, res) => {
    const { page = 1, category, sort, query: searchQuery } = req.query;
    const limit = 9;
    const skip = (page - 1) * limit;
    let query = { status: false };

    // Filter by category if provided
    if (category) {
        const categoryData = await Category.findOne({ name: category });
        if (categoryData) {
            query.category = categoryData._id;
        }
    }

    // Add search query if provided
    if (searchQuery) {
        query.name = { $regex: searchQuery, $options: 'i' };
    }

    // Sort options based on the provided sort criteria
    let sortOption = {};
    switch (sort) {
        case 'popularity': sortOption.popularity = -1; break;
        case 'price_asc': sortOption.price = 1; break;
        case 'price_desc': sortOption.price = -1; break;
        case 'avg_rating': sortOption.averageRating = -1; break;
        case 'featured': sortOption.featured = -1; break;
        case 'new_arrivals': sortOption.createdAt = -1; break;
        case 'az': sortOption.name = 1; break;
        case 'za': sortOption.name = -1; break;
        default: sortOption.popularity = -1; break;
    }
   
    sortOption._id = 1;

    try {
        const products = await Product.find(query).populate('category').sort(sortOption).skip(skip).limit(limit);
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const activeOffers = await Offer.find({ status: true, expiryDate: { $gte: new Date() } });

        // Apply offers and filter hidden products
        const productData = products.map(product => {
            let applicableOffer = null;
            let offerPrice = null;

            const productOffer = activeOffers.find(offer => offer.offerType === 'product' && offer.selectItem.equals(product._id));
            const categoryOffer = activeOffers.find(offer => offer.offerType === 'category' && offer.selectItem.equals(product.category._id));

            if (productOffer) applicableOffer = productOffer;
            else if (categoryOffer) applicableOffer = categoryOffer;

            if (applicableOffer) {
                offerPrice = product.price - (product.price * (applicableOffer.discountPercentage / 100));
            }

            return {
                ...product._doc,
                offer: applicableOffer,
                offerPrice,
                discountPercentage: applicableOffer ? applicableOffer.discountPercentage : 0
            };
        });

        res.json({
            products: productData,
            wishlist: req.userWishlist ? req.userWishlist.product : [],
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error loading products:', error);
        res.status(500).send('Server Error');
    }
};



// Search Function



// Load Product Details Function
const loadProductDetails = async (req, res) => {
    const userWishlist = await Wishlist.findOne({ user: req.session.user_id ? req.session.user_id : null });
    const productId = req.params.id;
    try {
        const product = await Product.findById(productId).populate('category'); // Fetch product and its category
        const activeOffers = await Offer.find({
            status: true,
            expiryDate: { $gte: new Date() }
        });

        if (!product || product.status === true || product.category.is_hide === true) {
            return res.render('admin/404'); // Handle hidden product or hidden category
        }

        let applicableOffer = null;
        let offerPrice = null;

        const productOffer = activeOffers.find(offer => offer.offerType === 'product' && offer.selectItem.equals(product._id));
        const categoryOffer = activeOffers.find(offer => offer.offerType === 'category' && offer.selectItem.equals(product.category._id));

        if (productOffer) applicableOffer = productOffer;
        else if (categoryOffer) applicableOffer = categoryOffer;

        if (applicableOffer) {
            offerPrice = product.price - (product.price * (applicableOffer.discountPercentage / 100));
        }

        // Fetch related products (from the same category, excluding the current product)
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id } // Exclude the current product
        });

        res.render('user/shop-details', {
            product: {
                ...product._doc,
                offerPrice,
                discountPercentage: applicableOffer ? applicableOffer.discountPercentage : 0
            },
            offer: applicableOffer,
            Products: relatedProducts, wishlist: userWishlist ? userWishlist.product : []
        });
    } catch (err) {
        console.log('Error loading product details:', err);
        res.status(500).send('Server Error');
    }
};



const addAddress = async (req, res) => {
    const { userId, name, streetAddress, state, district, pinCode, mobile, country } = req.body;

    if (!userId || !name || !streetAddress || !state || !district || !pinCode || !mobile || !country) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    try {

        const newAddress = new Address({
            user: userId, // Associate address with the user ID from the request
            name,
            streetAddress,
            state,
            district,
            pinCode,
            mobile,
            country
        });

        await newAddress.save();
        res.status(200).json({ message: 'Address saved successfully' });


    } catch (error) {
        console.error('Error saving address:', error);
        res.status(500).json({ message: 'An error occurred while saving the address' });
    }

}

const updateAddress = async (req, res) => {
    try {
        const addressId = req.params.id

        const { name, streetAddress, state, district, pinCode, mobile, country } = req.body;

        // Check if all fields are provided
        if (!addressId || !name || !streetAddress || !state || !district || !pinCode || !mobile || !country) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const address = await Address.findById(addressId)



        // Update the address details
        address.name = name;
        address.streetAddress = streetAddress;
        address.state = state;
        address.district = district;
        address.pinCode = pinCode;
        address.mobile = mobile;
        address.country = country;

        await address.save();
        res.status(200).json({ message: 'Address updated successfully', address });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const id = req.query.id;

        if (!id) {
            return res.status(400).send({ message: 'Address ID is required' });
        }

        const result = await Address.deleteOne({ _id: id });

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: 'Address not found' });
        }

        res.status(200).send({ message: 'Address deleted successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send({ message: 'An error occurred while deleting the address' });
    }
}





const logout = async (req, res) => {
    try {

        req.session.destroy((err) => {
            if (err) {
                console.log(err);
                res.send("Error");
            } else {
                res.redirect('/')
            }
        });
    } catch (error) {
        console.log(error.message);
    }
}




module.exports = {
    loadRegister,
    registerUser,
    resendOTP,
    verifyOTP,
    loadLogin,
    verifyLogin,
    loadResetPassword,
    resetPassword,
    forgotPassword,
    loadHome,
    loadProfile,
    updateProfile,
    loadShop,
    loadProducts,
    loadProductDetails,
    addAddress,
    updateAddress,
    deleteAddress,
    logout
}
