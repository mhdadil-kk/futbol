

const Category = require('../models/category')


const loadCategory = async (req, res) => {
    try {

        const categories = await Category.find()


        res.render('admin/page-categories', { categories: categories })

    } catch (error) {
        console.log(error)
    }
}

const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        let category = name.trim(); // Trim whitespace

        // Normalize the category name for existence check
        const lowerCaseCategory = category.toLowerCase();
        const capitalizedCategory = category
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

        // Check for existing categories in both lowercase and capitalized formats
        const existingCategory = await Category.findOne({
            $or: [
                { name: lowerCaseCategory }, // Check for lowercase
                { name: capitalizedCategory } // Check for capitalized
            ]
        });

        if (existingCategory) {
            return res.status(400).json({ success: false, error: 'Category name already exists' });
        }

        // Save the category with capitalized format
        const newCategory = new Category({
            name: capitalizedCategory, // Save with capitalized format
            description
        });

        const savedCategory = await newCategory.save();
        if (savedCategory) {
            console.log(savedCategory);
            res.status(200).json({ success: true, category: savedCategory }); // Return created category details
        } else {
            res.status(500).json({ success: false, error: 'Failed to save category' });
        }
    } catch (error) {
        console.error(error); // Log the error for debugging
        res.status(500).json({ success: false, error: 'Server error. Please try again.' });
    }
};





const loadeditCategory = async (req, res) => {
    try {
        const categoryId = req.params.id
        console.log(categoryId)

        const category = await Category.findById(categoryId)

        res.render('admin/editCategory', { category })

    } catch (error) {
        console.log(error)
    }
}

const editCategory = async (req, res) => {
    try {

        const categoryId = req.params.id;

        const { name, description } = req.body

        const category = await Category.findById(categoryId)

        category.name = name
        category.description = description

        const categoryEdited = await category.save()

        if (categoryEdited) {
            res.redirect('/admin/categories')
        }


    } catch (error) {
        console.log(error)
    }
}


const hideCategory = async (req, res) => {
    try {
        const categoryId = req.query.id

        const CategoryData = await Category.findOne({ _id: categoryId })


        CategoryData.is_hide = !CategoryData.is_hide

        const save = await CategoryData.save();


        if (save) {
            res.send({ success: 1 })

        } else {
            res.send({ success: 0 })
        }

    } catch (error) {
        console.log(error)
        res.send({ success: 0 })
    }
}


module.exports = {
    loadCategory,
    addCategory,
    hideCategory,
    loadeditCategory,
    editCategory
}