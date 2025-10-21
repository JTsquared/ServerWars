import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
    gamemode: {
        gameType: { 
            type: String, 
            enum: ["sandbox", "seasonal"], 
            default: "sandbox" 
          },
        seasonEnd: Date,
        minServers: { type: Number, default: 1 },
        victoryType: { 
        type: String, 
        enum: ["conquest","power", "cities", "gold"], 
        default: "military" 
        }
    },
    enableCrypto: { type: Boolean, default: false },
    treasureRewardsExhausted: { type: Boolean, default: false },
}, { timestamps: true });

const GameConfig = mongoose.models.GameConfig || mongoose.model("GameConfig", configSchema);
export default GameConfig;