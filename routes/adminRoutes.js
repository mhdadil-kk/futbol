const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController')
const categoryController = require('../controllers/categoryController');
const { ensureAdmin,islogin } = require('../middlewares/auth');
const { validateLogin } = require('../middlewares/validation');
const orderController = require('../controllers/orderController')
const couponController = require('../controllers/couponController')
const offerController = require('../controllers/offerController')
// Set storage engine
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads')); 
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname); 
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 * 5 },
})





router.get('/', islogin, adminController.getLoginPage);
router.post('/',validateLogin, adminController.verifyAdmin)
router.get('/dashboard',ensureAdmin,adminController.loadDashboard)

router.get('/api/monthly-sales',adminController.monthlySales)
router.get('/api/yearly-sales',adminController.yearlysales)

router.get('/products',ensureAdmin,productController.loadProducts)
router.get('/addproducts',ensureAdmin,productController.loadaddProduct)
router.post('/addproducts', upload.array('images', 4), productController.addProduct);
router.get('/editProduct/:id',ensureAdmin, productController.loadeditProduct)
router.post('/editProduct/:id', ensureAdmin,upload.array('images', 5),productController.editProduct)
router.post('/productBlock',ensureAdmin, productController.productBlock);
router.get('/categories',ensureAdmin,categoryController.loadCategory)
router.post('/categories',ensureAdmin,categoryController.addCategory)
router.get('/editCategory/:id',ensureAdmin,categoryController.loadeditCategory)
router.post('/editCategory/:id',ensureAdmin,categoryController.editCategory)
router.post('/blockUnblockUser',ensureAdmin, adminController.blockUnblockUser);
router.post('/hideCategory', ensureAdmin,categoryController.hideCategory)
router.get('/Users',ensureAdmin,adminController.loadUserList)

router.get('/coupons',ensureAdmin,couponController.CouponPageLoad)
router.post('/addcoupon',ensureAdmin,couponController.addCoupon)
router.post('/editcoupon/:id',ensureAdmin,couponController.editCoupon);
router.post('/deletecoupon/:id',ensureAdmin, couponController.deleteCoupon);

router.get('/offers',ensureAdmin,offerController.loadOfferPage)
router.post('/addoffer',ensureAdmin,offerController.addOffer)
router.get('/getItems',ensureAdmin,offerController.getItems)
router.post('/deleteoffer/:offerId',ensureAdmin,offerController.deleteOffer)
router.post('/toggleOfferStatus/:offerId',ensureAdmin,offerController.toggleOfferStatus)



router.get('/Orders',ensureAdmin, orderController.adOrderLoad)
router.get('/orders/:id',ensureAdmin,orderController.adOrderDetails)
router.post('/update-order/:orderId',ensureAdmin, orderController.updateOrder)

router.get('/sales-report',ensureAdmin,adminController.loadSalesReport)
router.post('/sales-report',ensureAdmin,adminController.SalesReport)
router.post('/sales-report/download/:format',ensureAdmin,adminController.downloadSalesReport)

router.get('/logout',adminController.logout)

module.exports = router;
