import mongoose from 'mongoose';

const uri = "mongodb://avani_crm_prod_app:GtU8M9dPe4WRLVGd@cluster0-shard-00-00.mlcxcp.mongodb.net:27017,cluster0-shard-00-01.mlcxcp.mongodb.net:27017,cluster0-shard-00-02.mlcxcp.mongodb.net:27017/avani_ai_crm_prod?ssl=true&authSource=admin&retryWrites=true&w=majority";

console.log("Testing DIRECT connection...");

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("Connected successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Connection failed:", err.message);
    process.exit(1);
  });
