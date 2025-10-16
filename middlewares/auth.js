const User = require('../models/user')

// middleware/auth.js

const isAuthenticated = (req, res, next) => {
    res.locals.isAuthenticated = req.isAuthenticated(); // Use Passport's method to check authentication
    next();
};

// middleware/auth.js

const ensureAuthenticated = async (req, res, next) => {
    const userid = req.session.user_id 
        const user = await User.findById(userid)
        if (userid && !user.is_blocked) { 
            return next();
        } else {
            res.redirect('/login');
        }
   
};
const ensureAdmin = (req, res, next) => {
    if (req.session.admin_id) { 
        // Use Passport's method to check authentication
        return next();
    } else {
        res.redirect('/admin');
    }
};

const  islogin = (req,res,next) =>{
    if(req.session.admin_id){
        res.redirect('/admin/dashboard')
    }else{
       return next()
    }
}

module.exports = {
    ensureAuthenticated,
    ensureAdmin,
    isAuthenticated,
    islogin
};
