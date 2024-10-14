const { body, validationResult } = require('express-validator');

const validateRegister = [
  body('name')
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters long')
    .matches(/^[a-zA-Z]+(?: [a-zA-Z]+)*$/).withMessage('Name must contain only letters'),

  body('email')
    .isEmail().withMessage('Enter a valid email'),

  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/)
    .withMessage('Password must contain at least one letter, one number, and one special character'),

  body('confirmPassword')
    .custom((value, { req }) => {

      if (value != req.body.password) {
        throw new Error('Confirm password does not match password');
      }
      return true;
    }),

  body('mobile')
    .isMobilePhone().withMessage('Enter a valid mobile number')
    .isLength({ min: 10, max: 10 }).withMessage('Mobile number must contain 10 digits')
    .matches(/^[0-9]{10}$/).withMessage('Mobile number must contain only digits')
    .custom(value => {
        const ascending = '1234567890';
        const descending = '9876543210';
        
        // Check for ascending or descending sequence
        if (ascending.includes(value) || descending.includes(value)) {
            throw new Error('Mobile number cannot be in sequential order (1 to 9 or 9 to 1)');
        }

        // Check for all identical digits
        if (/^(\d)\1+$/.test(value)) {
            throw new Error('Mobile number cannot contain all identical digits');
        }

        return true;
    }),
];


const validateLogin = [
  body('email')
    .isEmail().withMessage('Enter a valid email')
    .normalizeEmail(), // Optional: Sanitizes email input

  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/)
    .withMessage('Password must contain at least one letter, one number, and one special character')
    .trim(), // Optional: Trims whitespace from the password

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.errors = errors.array(); // Store errors in request object
      return next(); // Proceed to the controller to handle errors
    }
    next(); // No errors, proceed to the controller
  }
];

module.exports = {
  validateRegister,
  validateLogin
};
