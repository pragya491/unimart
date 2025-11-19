import Coupon from "../models/coupon.model.js";
import Order from "../models/order.model.js";
import { razorpay } from "../lib/razorpay.js"; 

// Use a function to compute HMAC-SHA256 signature for verification
import crypto from "crypto"; 



// Helper function to create a new coupon (keep this, it's independent of payment gateway)
async function createNewCoupon(userId) {
  // ... (Your existing createNewCoupon logic)
  await Coupon.findOneAndDelete({ userId });

  const newCoupon = new Coupon({
    code: "GIFT" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    discountPercentage: 10,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    userId: userId,
  });

  await newCoupon.save();

  return newCoupon;
}

// 1. CREATE RAZORPAY ORDER (replaces createCheckoutSession)
export const createCheckoutSession = async (req, res) => {
  try {
    const { products, couponCode } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Invalid or empty products array" });
    }

    // 1. Calculate Total Amount in CENTS (or PAISA, smallest unit)
    let totalAmountInCents = 0;
    products.forEach((product) => {
      // Assuming product.price is in dollars/local currency unit.
      // Convert to cents/paise (x100) and multiply by quantity.
      totalAmountInCents += Math.round(product.price * 100) * product.quantity; 
    });
    
    // 2. Apply Coupon Discount (The coupon logic stays mostly the same)
    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({ code: couponCode, userId: req.user._id, isActive: true });
      if (coupon) {
        const discountAmount = Math.round((totalAmountInCents * coupon.discountPercentage) / 100);
        totalAmountInCents -= discountAmount;
      }
    }
    
    // Safety check for minimum Razorpay amount (e.g., 100 paise for INR)
    if (totalAmountInCents < 100) totalAmountInCents = 100; 
    const shortTime = Date.now().toString().slice(-8);
    // 3. Create Razorpay Order
    const options = {
      amount: totalAmountInCents, // Amount in smallest currency unit (paise)
      currency: "INR", // CHANGE CURRENCY TO INR (Razorpay is primarily INR-based)
      receipt: `ORD_${shortTime}_${req.user._id.toString()}`,
      // Store custom metadata directly on the order to be retrieved later
      notes: {
        userId: req.user._id.toString(),
        couponCode: couponCode || "",
        products: JSON.stringify(
          products.map((p) => ({
            id: p._id,
            quantity: p.quantity,
            price: p.price,
          }))
        ),
      },
    };

    const order = await razorpay.orders.create(options);

    if (totalAmountInCents >= 20000) { // Keep your coupon creation logic
      await createNewCoupon(req.user._id);
    }
    
    // Send back the Razorpay Order ID and the final amount
    res.status(200).json({ 
        orderId: order.id, 
        amount: totalAmountInCents / 100, // Send back in dollars/local currency unit
        currency: options.currency
    }); 
  } catch (error) {
    console.error("Error processing checkout:", error);
    res.status(500).json({ message: "Error processing checkout", error: error.message });
  }
};

// 2. VERIFY PAYMENT (replaces checkoutSuccess, but the frontend will send different data)
export const checkoutSuccess = async (req, res) => {
  try {
    // The data received from the frontend's Razorpay handler
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      products: orderProducts, 
      couponCode, 
      totalAmount,
      userId
    } = req.body;
    
    
    const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        message: "Payment verification failed (Signature Mismatch)" 
      });
    }
    // *** END OF VERIFICATION ***

    // Assuming verification passed:

    if (couponCode) {
      await Coupon.findOneAndUpdate(
        {
          code: couponCode,
          userId: userId, // Use the passed userId
        },
        {
          isActive: false,
        }
      );
    }

    // Create a new Order
    const newOrder = new Order({
      user: userId, // Use the passed userId
      products: orderProducts.map((product) => ({
        product: product.id,
        quantity: product.quantity,
        price: product.price,
      })),
      totalAmount: totalAmount,
      // Change stripeSessionId to paymentGatewayId
      paymentGatewayId: razorpay_payment_id, 
    });

    await newOrder.save();

    res.status(200).json({
      success: true,
      message: "Payment successful, order created, and coupon deactivated if used.",
      orderId: newOrder._id,
    });
    
  } catch (error) {
    console.error("Error processing successful checkout:", error);
    res.status(500).json({ message: "Error processing successful checkout", error: error.message });
  }
};

