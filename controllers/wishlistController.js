const Wishlist = require("../models/wishlist");


const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user_id;

        const wishlist = await Wishlist.findOne({ user: userId }).populate('product'); 
        if (!wishlist) {
            return res.render('user/wishlist', { wishlist: { product: [] } });
        }

        res.render('user/wishlist', { wishlist });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};



const addToWishlist = async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.session.user_id;

        let wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                user: userId,
                product: [productId], 
            });
        } else {
            if (wishlist.product.includes(productId)) {
                wishlist.product = wishlist.product.filter(item => item !== productId);
            } else {
                wishlist.product.push(productId);
            }
        }

        await wishlist.save();

        res.json({ success: true, message: 'Wishlist updated successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to update wishlist' });
    }
};

const removeFromWishlist = async (req, res) => {
  const productId = req.params.productId; 
  const userId = req.session.user_id; 

  try {
      let wishlist = await Wishlist.findOne({ user: userId });

      if (!wishlist) {
          return res.status(404).json({ success: false, message: 'Wishlist not found' });
      }

      if (!wishlist.product.includes(productId)) {
          return res.status(400).json({ success: false, message: 'Product not in wishlist' });
          
      }

      wishlist.product = wishlist.product.filter(item => !item.equals(productId));

      await wishlist.save();

      return res.status(200).json({ success: true, message: 'Product removed from wishlist' });

  } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};
module.exports = {
    addToWishlist,
    removeFromWishlist,
    loadWishlist,
};
