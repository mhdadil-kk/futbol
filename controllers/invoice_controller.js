const Order = require('../models/order');
const easyinvoice = require('easyinvoice');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

const generateInvoice = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Check if orderId is present
        if (!orderId) {
            console.error("Error: orderId not provided in request.");
            return res.status(400).json({ message: 'Order ID is required' });
        }

        // Fetch order details and populate product and delivery address details
        const orderData = await Order.findOne({ _id: orderId })
            .populate('products.product')
            .populate('deliveryAddress');

        // Handle case if no order is found
        if (!orderData) {
            console.error(`Error: Order with ID ${orderId} not found.`);
            return res.status(404).json({ message: 'Order not found' });
        }

        // Format the date to "MMM dd, yyyy"
        const formatConvertedDate = format(orderData.createdAt, "MMM dd, yyyy");

        // Shortened order ID for display purposes
        const pageOrderId = orderData._id.toString().substring(0, 8);

        // Calculate total price of all products
        const productTotal = orderData.products.reduce((total, item) => {
            return total + (item.quantity * item.price);
        }, 0);

        // Apply coupon discount if present
        const discount = orderData.couponDiscound || 0; // Assuming couponDiscount field exists in the order
        const totalPriceAfterDiscount = productTotal - discount;

        // Map the products to the required format for invoice
        const products = orderData.products.map(item => ({
            quantity: item.quantity,
            description: item.product.name,
            price: item.price, // Ensure that price or sale price is used correctly
        }));

        // Prepare invoice data
        const data = {
            apiKey: "free",
            mode: "development",
            images: {
                logo: "https://drive.google.com/uc?export=view&id=1ih8paSnqM4Jo46a1Qn4IRjvCkOUNNuw0",
            },
            sender: {
                company: "Futbol",
                address: "Sample Street 123",
                zip: "676517",
                city: "Malappuram, Kerala",
                country: "India",
            },
            client: {
                company: `${orderData.deliveryAddress.name}`,
                address: `${orderData.deliveryAddress.streetAddress}`,
                zip: `${orderData.deliveryAddress.pinCode}`,
                city: `${orderData.deliveryAddress.district}, ${orderData.deliveryAddress.state}`,
                country: "India",
            },
            information: {
                OrderId: pageOrderId,
                date: formatConvertedDate,
            },
            products, // Product list for the invoice
            bottomNotice: discount > 0 ? `Coupon discount applied: ₹${discount}` : '',
            settings: {
                currency: "INR",
            },
            // Adding subtotal and total calculation here
            subtotal: productTotal.toFixed(2), // Subtotal without discount
            discount: discount.toFixed(2), // Discount applied
            total: totalPriceAfterDiscount.toFixed(2), // Total price after applying discount
        };

        console.log("Generated Invoice Data:", data);

        // Define folder and file paths
        const invoiceFolderPath = path.join(__dirname, '../downloads');
        const invoiceFilePath = path.join(invoiceFolderPath, `invoice-${orderData._id}.pdf`);

        // Generate and save the invoice PDF
        easyinvoice.createInvoice(data, async function (result) {
            try {
                if (!result.pdf) {
                    console.error("Failed to generate PDF. Result:", result);
                    return res.status(500).json({ message: 'Invoice PDF generation failed.' });
                }

                // Create downloads folder if it doesn't exist
                await fs.promises.mkdir(invoiceFolderPath, { recursive: true });

                // Write the PDF to the filesystem
                await fs.promises.writeFile(invoiceFilePath, result.pdf, 'base64');

                // Send the PDF file to the client as a download
                res.sendFile(invoiceFilePath, {
                    headers: {
                        'Content-Disposition': `attachment; filename="invoice-${orderData._id}.pdf"`,
                    },
                }, (err) => {
                    if (err) {
                        console.error("Error downloading the PDF file:", err);
                        return res.status(500).json({ message: 'Error downloading invoice.' });
                    }
                });
            } catch (err) {
                console.error("Error during invoice processing:", err);
                return res.status(500).json({ message: 'Error creating and processing invoice.' });
            }
        });

    } catch (error) {
        console.error("Internal Server Error:", error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = { generateInvoice };
