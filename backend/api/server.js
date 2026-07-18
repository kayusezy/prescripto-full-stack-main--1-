import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "../config/mongodb.js";
import connectCloudinary from "../config/cloudinary.js";
import userRouter from "../routes/userRoute.js";
import doctorRouter from "../routes/doctorRoute.js";
import adminRouter from "../routes/adminRoute.js";

// Import your new webhook controllers
import { stripeWebhook, paystackWebhook, flutterwaveWebhook } from "../controllers/userController.js";

const app = express();

const PORT = process.env.PORT || 5001;

connectDB();
connectCloudinary();

const allowedOrigins = [
  "http://localhost:5175",
  "http://localhost:5173",
  "http://localhost:5176",
  "https://prescripto-full-stack-main-1.vercel.app",
  "https://prescripto-full-stack-main-1-git-main-jon-dannys-projects.vercel.app",
  'https://prescripto-full-stack-main-1-lcic8crf2-jon-dannys-projects.vercel.app',
  "https://admin-yourdomain.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } 
    // 2. Wildcard check for dynamic Vercel preview/branch deployments
    if (origin.includes("prescripto-full-stack-main-1") && origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "token", "atoken", "dtoken"]
}));

app.options("*", cors());

//Webhook routes 
app.post("/api/webhook/stripe", express.raw({ type: "application/json" }), stripeWebhook);
app.post("/api/webhook/paystack", express.raw({ type: "application/json" }), paystackWebhook);
app.post("/api/webhook/flutterwave", express.raw({ type: "application/json" }), flutterwaveWebhook);

app.use(express.json());

// API routes
app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/doctor", doctorRouter);

app.get("/", (req, res) => {
  res.send("API Working");
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running locally on port ${PORT}`);
  });
}

// ❌ DO NOT use app.listen()
// ✅ Instead, export the app
export default app;
