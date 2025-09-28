import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
  serverId: { type: String, required: true, unique: true },
  playerRoleId: { type: String, default: null }, // Role ID for Server Wars Player
  defaultChannelId: { type: String, default: null },
}, { timestamps: true });

const Config = mongoose.models.Config || mongoose.model("Config", configSchema);
export default Config;