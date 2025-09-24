// models/Tile.js
import mongoose from "mongoose";

const tileSchema = new mongoose.Schema({
  tileId: { type: String, required: true, unique: true },
  serverId: { type: String }, // optional, which nation currently owns this tile (after settlement)
  surveyedBy: [{ type: String }], // array of Nation serverIds who discovered this tile
  resources: {
    gold: { type: Number, default: 0 },
    steel: { type: Number, default: 0 },
    oil: { type: Number, default: 0 },
    fertility: { type: Number, default: 0 } // affects food yield
  },
  city: {
    name: { type: String },
    exists: { type: Boolean, default: false },
    owner: { type: String, ref: "Nation" }, // serverId of the Nation
    ownerName: { type: String }, // cached nation name for convenience
    foundedAt: { type: Date }
  }
}, { timestamps: true });

const Tile = mongoose.models.Tile || mongoose.model("Tile", tileSchema);
export default Tile;
