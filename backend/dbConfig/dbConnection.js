import mongoose from "mongoose";

const dbConnection = async () => {
   try {
      const dbConnection = await mongoose.connect(process.env.MONGO_DB_URL).then(() => {
         console.log('Database connected');
      })
   } catch (error) {
      console.log("Database error:", error.message);
   }
}

export default dbConnection;