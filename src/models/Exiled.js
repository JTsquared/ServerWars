import mongoose from "mongoose";

const exiledSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // Discord user ID
  serverId: { type: String, required: true }, // Nation they were exiled from
}, { timestamps: true });

const Exiled = mongoose.models.Exiled || mongoose.model("Exiled", exiledSchema);
export default Exiled;