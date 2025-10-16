const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const passportController = require('../controllers/passportController');
const cartController = require('../controllers/cartController')
const orderController = require('../controllers/orderController')
const wishlistController = require('../controllers/wishlistController')
const couponController = require('../controllers/couponController')

const passport = require('passport'); 
const { ensureAuthenticated } = require('../middlewares/auth');
const { validateRegister,validateLogin } = require('../middlewares/validation');
const { generateInvoice } = require('../controllers/invoice_controller');
require('../passport');

// Define your user routes here
router.get('/register', userController.loadRegister);
router.post('/register',validateRegister, userController.registerUser);
router.post('/resend-otp', userController.resendOTP);
router.post('/verify-otp', userController.verifyOTP); 
router.get('/login',userController.loadLogin);
router.post('/login',validateLogin, userController.verifyLogin);
router.get('/', userController.loadHome);
router.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

router.get('/forgot-password', (req, res) => {
    res.render('user/forgotPassword', { error: null, success: null });
});


router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/failure' }), 
    passportController.successGoogleLogin
);

router.get('/success', passportController.successGoogleLogin); 
router.get('/failure', passportController.failureGoogleLogin);
router.post('/forgot-password', userController.forgotPassword);
router.get('/reset-password/:token', userController.loadResetPassword);
router.post('/reset-password', userController.resetPassword);
router.get('/profile', ensureAuthenticated,userController.loadProfile);
router.post('/update-profile', userController.updateProfile);
router.get('/shop',userController.loadShop)
router.get('/api/products', userController.loadProducts);

router.get('/product/:id',userController.loadProductDetails);
router.post('/add_address' ,ensureAuthenticated,userController.addAddress)
router.post('/updateAddress/:id',ensureAuthenticated,userController.updateAddress)
router.post('/delete_address',ensureAuthenticated,userController.deleteAddress)
router.get('/cart',ensureAuthenticated,cartController.loadCart)
router.post('/add-to-cart',cartController.addToCart)
router.post('/remove/:productId',ensureAuthenticated,cartController.removeProduct)
router.post('/update-quantity/:productId',ensureAuthenticated,cartController.updateCart)

router.get('/wishlist',ensureAuthenticated,wishlistController.loadWishlist)
router.post('/wishlist/add/:productId',ensureAuthenticated,wishlistController.addToWishlist)
router.post('/wishlist/remove/:productId',ensureAuthenticated,wishlistController.removeFromWishlist)

router.get('/checkout',ensureAuthenticated,cartController.loadcheckout)
router.post('/apply-coupon',couponController.applyCoupon)



router.post('/place-order',ensureAuthenticated,orderController.placeOrder)
router.post('/confirm-payment',orderController.confirmPayment)
router.post('/continue-payment',orderController.continuePayment)
router.get('/orders',ensureAuthenticated,orderController.loadOrderList)
router.post('/downloadInvoice',generateInvoice)
router.get('/order-details/:orderId',ensureAuthenticated,orderController.loadOrderDetails)
router.post('/order/cancel/:orderId',ensureAuthenticated,orderController.cancelOrder)
router.post('/order/return/:orderId', ensureAuthenticated, orderController.createReturnOrder);
router.get('/logout',userController.logout);
// Handle 404
router.use((req, res, next) => {
    res.status(404).render('user/404', { pageTitle: 'Page Not Found' });
});

// Handle other errors
router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('user/404', { pageTitle: 'Page Not Found' });
});



module.exports = router;
