/**
 * MongoDB Data Migration Script
 * Purpose: Strip country codes (+91, 91, 0) and standardize all phone numbers 
 * inside the leads collection to a pure 10-digit string format.
 */
const { MongoClient } = require('mongodb');

// Update with your production/local MongoDB string from Vercel/local config
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DATABASE_NAME = "avani_ai_crm"; 

async function standardizeDatabasePhones() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log("⏳ Connecting to MongoDB cluster...");
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    const leadsCollection = db.collection('leads');

    // Fetch all records that have a phone property
    const leads = await leadsCollection.find({ phone: { $exists: true } }).toArray();
    console.log(`📋 Found ${leads.length} total lead documents to inspect.`);

    const bulkOperations = [];

    for (const lead of leads) {
      const originalPhone = String(lead.phone).trim();
      
      // Remove all non-numeric characters (spaces, +, -, brackets)
      let cleanedPhone = originalPhone.replace(/\D/g, '');

      // Rule: If it starts with 91 and is 12 digits, strip the 91 country code
      if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
        cleanedPhone = cleanedPhone.slice(2);
      } 
      // Rule: If it accidentally includes a leading zero, strip it
      else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('0')) {
        cleanedPhone = cleanedPhone.slice(1);
      }

      // Final Validation: Ensure it is a valid 10-digit Indian mobile number
      if (cleanedPhone.length === 10) {
        // Only queue an update if the value actually changed
        if (originalPhone !== cleanedPhone) {
          bulkOperations.push({
            updateOne: {
              filter: { _id: lead._id },
              update: { $set: { phone: cleanedPhone, updatedAt: new Date() } }
            }
          });
        }
      } else {
        console.warn(`⚠️ Warning: Skipping invalid/non-standard phone layout: "${originalPhone}" (Cleaned: "${cleanedPhone}")`);
      }
    }

    // Execute updates in a high-performance single database network call
    if (bulkOperations.length > 0) {
      console.log(`🚀 Executing bulk update for ${bulkOperations.length} records...`);
      const result = await leadsCollection.bulkWrite(bulkOperations);
      console.log(`✅ Success! Updated ${result.modifiedCount} records to the 10-digit standard.`);
    } else {
      console.log("ℹ️ All records are already clean and standardized to 10 digits. No updates needed.");
    }

  } catch (error) {
    console.error("❌ Critical migration process breakdown encountered:", error.message);
  } finally {
    await client.close();
    console.log("🔌 Database connection closed cleanly.");
  }
}

standardizeDatabasePhones();
