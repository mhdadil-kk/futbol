const { validationResult } = require('express-validator');

const User = require('../models/user');
const bcrypt = require('bcryptjs');
const Order = require('../models/order');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');
const path = require('path');
const fs = require('fs');
const Product = require('../models/product');
const Category = require('../models/category');

const getLoginPage = async (req, res) => {
    try{
        res.render('admin/adminlogin', {errors : [] , error:""}); 
    }catch(error){
        console.log(error)
    }
    
};

const verifyAdmin = async(req,res)=>{
    try{
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.render('admin/adminlogin', { 
              errors:  errors.errors,
              error: ''
          });
      }

       const {email,password} = req.body
       if (!email || !password) {
        return res.render('admin/adminlogin', { errors : [],error: 'Email and password are required' });
      }


      const  adminData = await User.findOne({email:email})

      if(adminData){
        const CheckPassword = await bcrypt.compare(password,adminData.password)
        if(CheckPassword&&adminData.isAdmin){
          req.session.admin_id = adminData._id;
                req.session.admn = {  
                    name: adminData.name,
                    email: adminData.email,
                    mobile: adminData.mobile,
                };
           res.redirect('admin/dashboard')
        }else{
          res.render('admin/adminlogin', { errors:[], error: 'Invalid email or password' });
        }
      }else{
        res.render('admin/adminlogin', { errors:[], error: 'Invalid email or password' });
      }

    }catch(error){
        console.log(error)
    }
}

const loadDashboard = async(req, res) => {
    try {
        // Fetch all products, categories, and delivered orders
        const Products = await Product.find();
        const categories = await Category.find();
        const orders = await Order.find({status: 'Delivered'}).populate('products.product');

        // Calculate total revenue from delivered orders
        const Revenue = orders.reduce((acc, order) => acc + order.totalPrice, 0);

        // Get top 10 selling products
        const productSales = await Order.aggregate([
            { $match: { status: 'Delivered' } }, // Only delivered orders
            { $unwind: '$products' }, // Unwind products array
            { $group: {
                _id: '$products.product', // Group by product ID
                totalQuantity: { $sum: '$products.quantity' }, // Sum quantities sold
            }},
            { $sort: { totalQuantity: -1 } }, // Sort by totalQuantity in descending order
            { $limit: 10 }, // Limit to top 10
            { $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'productDetails'
            }},
            { $unwind: '$productDetails' }
        ]);

        // Get top 10 selling categories
        const categorySales = await Order.aggregate([
            { $match: { status: 'Delivered' } }, // Only delivered orders
            { $unwind: '$products' }, // Unwind products array
            { $lookup: {
                from: 'products',
                localField: 'products.product',
                foreignField: '_id',
                as: 'productDetails'
            }},
            { $unwind: '$productDetails' },
            { $group: {
                _id: '$productDetails.category', 
                totalQuantity: { $sum: '$products.quantity' }, 
            }},
            { $sort: { totalQuantity: -1 } }, 
            { $limit: 10 },
            { $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'categoryDetails'
            }},
            { $unwind: '$categoryDetails' }
        ]);

        res.render('admin/index', {
            Products,
            categories,
            orders,
            Revenue,
            topProducts: productSales,
            topCategories: categorySales
        });
    } catch (error) {
        console.log(error);
    }
};

  // Monthly Sales
// Monthly Sales
// Monthly Sales
const monthlySales = async (req, res) => {
    try {
        const salesData = await Order.aggregate([
            { $match: { status: 'Delivered' } },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year: { $year: "$createdAt" }
                    },
                    totalProducts: { $sum: 1 },
                    totalRevenue: { $sum: "$totalPrice" } // Sum total revenue as well
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);
        res.json(salesData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching monthly sales data' });
    }
};

// Yearly Sales
const yearlysales = async (req, res) => {
    try {
        const salesData = await Order.aggregate([
            { $match: { status: 'Delivered' } },
            {
                $group: {
                    _id: { year: { $year: "$createdAt" } },
                    totalProducts: { $sum: 1 },
                    totalRevenue: { $sum: "$totalPrice" } // Sum total revenue as well
                }
            },
            { $sort: { "_id.year": 1 } }
        ]);
        res.json(salesData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching yearly sales data' });
    }
};





const loadUserList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page
        const limit = 10; // Number of users per page
        const skip = (page - 1) * limit;

        // Fetch total number of documents for calculating total pages
        const totalUsers = await User.countDocuments({ isAdmin: false });
        const totalPages = Math.ceil(totalUsers / limit);

        // Fetch paginated users
        const users = await User.find({ isAdmin: false })
            .skip(skip)
            .limit(limit);

        res.render('admin/users-list.ejs', {
            users,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};


  const blockUnblockUser = async (req, res) => {
    try {
        const { id } = req.query;

        // Find the user by ID
        const user = await User.findOne({_id :id});

        if (!user) {
            return res.status(404).json({ success: 0, message: 'User not found' });
        }

        // Toggle the is_blocked status
        user.is_blocked = !user.is_blocked;

        // Save the updated user
        const save =  await user.save();

        if(save){
          res.send({success :1})
      
        }else{
          res.send({success:0})
        }

       
    } catch (error) {
      console.log(error)
      res.send({ success: 0 })
    }
};



const SalesReport = async (req, res) => {
    const { dateRange, startDate, endDate } = req.body;

    try {
        let filter = {};

        if (dateRange) {
            const today = new Date();
            switch (dateRange) {
                case 'today':
                    filter.orderDate = {
                        $gte: new Date(today.setHours(0, 0, 0, 0)),
                        $lt: new Date(today.setHours(23, 59, 59, 999)),
                    };
                    break;
                case 'yesterday':
                    today.setDate(today.getDate() - 1);
                    filter.orderDate = {
                        $gte: new Date(today.setHours(0, 0, 0, 0)),
                        $lt: new Date(today.setHours(23, 59, 59, 999)),
                    };
                    break;
                case 'lastWeek':
                    const lastWeek = new Date(today);
                    lastWeek.setDate(today.getDate() - 7);
                    filter.orderDate = { $gte: lastWeek, $lt: today };
                    break;
                case 'lastMonth':
                    const lastMonth = new Date(today);
                    lastMonth.setMonth(today.getMonth() - 1);
                    filter.orderDate = { $gte: lastMonth, $lt: today };
                    break;
                case 'custom':
                    if (startDate && endDate) {
                        filter.orderDate = {
                            $gte: new Date(startDate),
                            $lt: new Date(endDate),
                        };
                    }
                    break;
            }
        }

        const orders = await Order.find(filter)
            .populate('user', 'name')
            .populate({
                path: 'products.product',
                populate: {
                    path: 'offers',
                    model: 'Offer',
                },
            })
            .exec();

        const reportData = orders.map(order => ({
            orderId: order._id,
            billingName: order.user ? order.user.name : 'N/A',
            date: order.orderDate.toISOString().split('T')[0],
            total: order.totalPrice,
            paymentMethod: order.paymentMethod,
            couponDiscound: order.couponDiscound || 0,
            offerDiscound: order.offerDiscound || 0,
        }));

        res.json(reportData);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};


const loadSalesReport = async (req, res) => {
    const { dateRange = 'today', startDate, endDate } = req.body; // Default dateRange to 'today'
  
    try {
        let filter = {};
        const today = new Date(); // Get the current date
  
        // Filter by date range
        switch (dateRange) {
            case 'today':
                filter.orderDate = {
                    $gte: new Date(today.setHours(0, 0, 0, 0)),  // Start of today
                    $lt: new Date(today.setHours(23, 59, 59, 999)) // End of today
                };
                break;
            case 'yesterday':
                today.setDate(today.getDate() - 1);
                filter.orderDate = {
                    $gte: new Date(today.setHours(0, 0, 0, 0)),
                    $lt: new Date(today.setHours(23, 59, 59, 999))
                };
                break;
            case 'lastWeek':
                const lastWeek = new Date(today);
                lastWeek.setDate(today.getDate() - 7);
                filter.orderDate = {
                    $gte: lastWeek,
                    $lt: today
                };
                break;
            case 'lastMonth':
                const lastMonth = new Date(today);
                lastMonth.setMonth(today.getMonth() - 1);
                filter.orderDate = {
                    $gte: lastMonth,
                    $lt: today
                };
                break;
            case 'lastYear':
                const lastYear = new Date(today);
                lastYear.setFullYear(today.getFullYear() - 1);
                filter.orderDate = {
                    $gte: lastYear,
                    $lt: today
                };
                break;
            case 'custom':
                if (startDate && endDate) {
                    filter.orderDate = {
                        $gte: new Date(startDate),
                        $lt: new Date(endDate)
                    };
                }
                break;
            default:
                break;
        }
  
        const orders = await Order.find(filter)
            .populate('user', 'name')
            .populate({
                path: 'products.product',
                populate: {
                    path: 'offers',
                    model: 'Offer',
                },
            })
            .exec();
  
        const reportData = orders.map(order => {
            const billingName = order.user ? order.user.name : 'N/A';
            const orderDate = order.orderDate.toISOString().split('T')[0];
  
            const productsWithOffers = order.products.map(item => {
                const product = item.product;
                const offers = product ? product.offers : [];
  
                return {
                    productId: product ? product._id : null,
                    productName: product ? product.name : 'N/A',
                    offers: offers,
                    offerDeduction: offers.reduce((acc, offer) => acc + (offer.discountPercentage ? (item.price * offer.discountPercentage / 100) : 0), 0)
                };
            });
  
            const totalOfferDeduction = productsWithOffers.reduce((acc, product) => acc + product.offerDeduction, 0);
  
            return {
                orderId: order._id,
                billingName: billingName,
                date: orderDate,
                total: order.totalPrice,
                paymentMethod: order.paymentMethod,
                offerDeduction: totalOfferDeduction,
                products: productsWithOffers,
            };
        });
  
        res.render('admin/sales-report', { reportData });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal Server Error');
    }
  };
  

  const downloadSalesReport = async (req, res) => {
    const { format } = req.params; // Either 'excel' or 'pdf'
    const { reportData } = req.body; // Sales report data from frontend
 console.log(reportData)
    try {
        if (format === 'excel') {
            await generateExcelReport(reportData, res);
        } else if (format === 'pdf') {
            generatePdfReport(reportData, res);
        } else {
            res.status(400).json({ error: 'Invalid format' });
        }
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Error generating report' });
    }
};

const generatePdfReport = async (reportData, res) => {
    const doc = new PDFDocument({ margin: 30 });
    const downloadsDir = path.join(__dirname, '..', 'downloads');
  
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  
    const filePath = path.join(downloadsDir, 'sales-report.pdf');
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    doc.pipe(res);
  
    // Title
    doc.fontSize(18).text('Sales Report', { align: 'center' }).moveDown(1);
  
    // Dynamically generate rows from reportData
    const rows = reportData.map(order => [
      order.orderId,
      order.billingName,
      order.date,
      '₹ ' + (order.offerDeduction || 0),
      '₹ ' + (order.couponDeduction || 0),
      '₹ ' + order.total,
      order.paymentMethod,
    ]);
  
    // Table definition
    const table = {
      headers: ['Order ID', 'Billing Name', 'Date', 'Offer Deduction', 'Coupon Deduction', 'Total', 'Payment Method'],
      rows: rows
    };
  
    // Draw the table
    await doc.table(table, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(12),
      prepareRow: (row, i) => doc.font("Helvetica").fontSize(10),
      padding: 5,  // Optional padding for better cell spacing
      columnSpacing: 10,  // Space between columns
      width: 550,  // Total width of the table
    });
  
    // End the document
    doc.end();
  
    writeStream.on('finish', () => {
      console.log('PDF written successfully.');
    });
  
    writeStream.on('error', (error) => {
      console.error('Error writing PDF:', error);
      res.status(500).json({ error: 'Error writing PDF file' });
    });
  
    // If you want to stream the PDF to the client in an Express.js environment, you can:
    // doc.pipe(res);
  };



const generateExcelReport = async (reportData, res) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Define columns
    worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 25 },
        { header: 'Billing Name', key: 'billingName', width: 30 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Offer Deduction', key: 'offerDeduction', width: 20 },
        { header: 'Coupon Deduction', key: 'couponDeduction', width: 20 },
        { header: 'Total', key: 'total', width: 20 },
        { header: 'Payment Method', key: 'paymentMethod', width: 25 }
    ];

    // Add header style
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        fillType: 'solid',
        startColor: { argb: 'FF007BFF' }, // Blue color
        endColor: { argb: 'FF007BFF' }
    };
    headerRow.height = 30;

    // Add data with alternating row colors
    reportData.forEach((order, index) => {
        const row = worksheet.addRow({
            orderId: order.orderId,
            billingName: order.billingName,
            date: order.date,
            offerDeduction: order.offerDeduction || 0,
            couponDeduction: order.couponDeduction || 0,
            total: order.total,
            paymentMethod: order.paymentMethod
        });
        
        // Alternate row colors
        if (index % 2 === 0) {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF2F2F2' }, // Light grey for even rows
            };
        }
    });

    // Stream the Excel file to the response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
};



  const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log(err);
                res.send("Error");
            } else {
             res.redirect('/admin')
            }
        });
    } catch (error) {
        console.log(error.message);
    }
}




module.exports = {
    getLoginPage,
    verifyAdmin,
    loadDashboard,
    monthlySales, 
    yearlysales, 
    loadUserList,
    blockUnblockUser,
    loadSalesReport,
    SalesReport,
    downloadSalesReport,
    logout
};
