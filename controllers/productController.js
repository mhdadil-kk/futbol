const category = require("../models/category")
const Category = require("../models/category")
const Product = require("../models/product")
const fs = require('fs'); 
const path = require('path');

const loadProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the page number from the query
        const limit = 10; // Set the limit for products per page
        const skip = (page - 1) * limit; // Calculate the number of products to skip

        const products = await Product.find({}).skip(skip).limit(limit); // Fetch the products
        const totalProducts = await Product.countDocuments({}); // Count total products for pagination
        const totalPages = Math.ceil(totalProducts / limit); // Calculate total pages

        res.render('admin/page-products-grid', { products, totalPages, currentPage: page }); // Pass current page
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};



const loadProductsWithPagination = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the page number from the query
        const limit = 10; // Set the limit for products per page
        const skip = (page - 1) * limit; // Calculate the number of products to skip

        const products = await Product.find({}).skip(skip).limit(limit); // Fetch the products
        const totalProducts = await Product.countDocuments({}); // Count total products for pagination
        const totalPages = Math.ceil(totalProducts / limit); // Calculate total pages

        res.json({ products, totalPages }); // Send the products and total pages as JSON
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};




const loadaddProduct = async (req, res) => {
    try {
       
        const categories = await Category.find({is_hide:false})
        
        res.render('admin/page-form-product-2' ,{categories})

    } catch (error) {

    }
}

const addProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock } = req.body;

        // console.log("these are the files",req.files); 
        
        let imagePaths = [];
        if (req.files && req.files.length > 0) {
            imagePaths = req.files.map(file => file.filename);
        }

        const newProduct = new Product({
            name,
            description,
            price,
            stock,
            images: imagePaths, // Ensure this is 'images' if your schema uses this name
            category,
        });

        const savedProduct = await newProduct.save();

        if (savedProduct) {
            console.log('Product saved:', newProduct);
            res.redirect('/admin/products');
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'An error occurred while adding the product' });
    }
};

const loadeditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category');
        const categories = await category.find({is_hide:false})
        console.log(categories)
        res.render('admin/edit-products',{product ,categories})

    } catch (error) {
        console.error("Error loading edit product:", error);
        res.status(500).send("Internal Server Error");
    }
}



const editProduct = async (req, res) => {
    try {
        console.log(req.body);

        const { name, description, price, category, stock, deletedImages } = req.body;
        let imagePaths = [];

        // Handle new images uploaded
        if (req.files && req.files.length > 0) {
            imagePaths = req.files.map(file => file.filename);
        }

        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Update basic product details
        product.name = name;
        product.description = description;
        product.price = price;
        product.stock = stock;
        product.category = category;

        // Remove deleted images from product.images
        if (deletedImages) {
            const imagesToDelete = deletedImages.split(','); // Split the string into an array

            // Remove images from the filesystem
            for (const image of imagesToDelete) {
                const imagePath = path.join(__dirname, '..', 'public', 'uploads', image); // Adjusted path
                fs.unlink(imagePath, (err) => {
                    if (err) {
                        console.error(`Error deleting image ${image}:`, err);
                    } else {
                        console.log(`Deleted image: ${imagePath}`);
                    }
                });
            }

            // Filter out the deleted images from product.images
            product.images = product.images.filter(image => !imagesToDelete.includes(image));
        }

        // Add newly uploaded images
        if (imagePaths.length > 0) {
            product.images = product.images.concat(imagePaths); // Append new images to the existing ones
        }

        const productEdited = await product.save();

        if (productEdited) {
            console.log('Product updated:', productEdited);
           res.json({success:true})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'An error occurred while editing the product' });
    }
};



const productBlock = async (req, res) => {

    try {
        const productId = req.query.id;
        const productData = await Product.findOne({ _id: productId });
        productData.status = !productData.status
        const saving = await productData.save();

        if (saving) {
            res.send({ success: 1 })
            console.log(productId + ' listing or unlisting productId')
        } else {
            res.send({ success: 0 })
        }

    } catch (error) {
        console.log(error);
        res.send({ success: 0 })
    }
}




module.exports = {
    loadProducts,
    loadaddProduct,
    addProduct,
    loadeditProduct,
    editProduct,
    productBlock,
    loadProductsWithPagination
}

