const User = require('../models/user');

const successGoogleLogin = async (req, res) => {
    try {
        if (!req.user) {

            return res.redirect('/failure');
        }

    
        req.session.user_id = req.user._id;

        res.redirect('/');
    } catch (error) {
        console.log(error.message);
        res.redirect('/failure');
    }
}

const failureGoogleLogin = (req, res) => {
    try {
        res.redirect('/login');
    } catch (error) {
        console.log(error.message);
    }
}

module.exports = {
    successGoogleLogin,
    failureGoogleLogin
};
