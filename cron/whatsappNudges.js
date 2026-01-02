const cron = require("node-cron");
const {
  sendReorderNudge,
  sendExploreNudge,
} = require("../services/whatsapp_nudge_service");

// 🧪 TEST MODE – every 1 minute
// cron.schedule("* * * * *", async () => {
//   await sendReorderNudge(1440);  // Reorder after 1 day
//   await sendExploreNudge(2880);  // Explore after 2 day
// });
