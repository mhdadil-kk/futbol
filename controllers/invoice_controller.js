const Order = require('../models/order');
const easyinvoice = require('easyinvoice');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

const generateInvoice = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Fetch order details and populate product and delivery address details
        const orderData = await Order.findOne({ _id: orderId })
            .populate('products.product')
            .populate('deliveryAddress');

        // Handle case if no order is found
        if (!orderData) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Format the date to "MMM dd, yyyy" using date-fns
        const formatConvertedDate = format(orderData.createdAt, "MMM dd, yyyy");

        // Generate a shorter version of the order ID for display purposes
        const pageOrderId = orderData._id.toString().substring(0, 8);

        // Map the products to the required format
        const products = orderData.products.map(item => ({
            quantity: item.quantity,
            description: item.product.name,
            price: item.price // Ensure that price or sale price is used correctly
        }));

        // Invoice data for easyinvoice
        const data = {
            apiKey: "free", // Replace with your production API key if needed
            mode: "development", // Change to production when deploying
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
                OrderId: pageOrderId, // Shortened order ID
                date: formatConvertedDate, // Formatted date
            },
            products, // Product list for the invoice
            settings: {
                currency: "INR", // Currency setting for the invoice
            }
        };

        // Debugging logs to ensure the correct data is being sent
        console.log("Invoice Data:", data);

        // Define folder and file paths
        const invoiceFolderPath = path.join(__dirname, '../downloads');
        const invoiceFilePath = path.join(invoiceFolderPath, `invoice-${orderData._id}.pdf`);

        // Create the invoice and handle errors
        easyinvoice.createInvoice(data, async function (result) {
            try {
                if (!result.pdf) {
                    console.error("Failed to generate PDF. Result:", result);
                    return res.status(500).json({ message: 'Invoice PDF generation failed.', error: result });
                }
        
                // Ensure the folder for storing invoices exists
                await fs.promises.mkdir(invoiceFolderPath, { recursive: true });
        
                // Write the generated PDF to the filesystem
                await fs.promises.writeFile(invoiceFilePath, result.pdf, 'base64');
        
                // Send the PDF file to the client as a download
                res.sendFile(invoiceFilePath, {
                    headers: {
                        'Content-Disposition': `attachment; filename="invoice-${orderData._id}.pdf"`,
                    },
                }, (err) => {
                    if (err) {
                        const downloadError = new Error('Error: Unable to download the PDF file');
                        console.error(downloadError);
                        return res.status(500).json({ message: 'Error downloading invoice.' });
                    }
                });
            } catch (err) {
                console.error('Error during invoice processing:', err);
                return res.status(500).json({ message: 'Error creating and processing invoice.' });
            }
        });
        
    } catch (error) {
        // Catch any other errors and return a generic server error
        console.error('Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = { generateInvoice };
