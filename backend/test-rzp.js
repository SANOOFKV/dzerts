require('dotenv').config();
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function test() {
    try {
        const order = await razorpay.orders.create({
            amount: 1000,
            currency: "INR",
            receipt: "test_rcpt"
        });
        console.log("SUCCESS:", order);
    } catch (e) {
        console.error("ERROR:");
        console.error(JSON.stringify(e, null, 2));
    }
}
test();
