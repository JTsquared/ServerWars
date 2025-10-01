// Event.js (Mongoose schema)
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
    lastEventAt: { type: Date, default: null },
    nextEventAt: { type: Date, default: null },
    pendingEvent: { type: Boolean, default: false },
    // type: { type: String, default: null },
    // targets: { type: [String], default: [] },
    // effects: { type: Object, default: {} },
});

export default mongoose.model("Event", eventSchema);
