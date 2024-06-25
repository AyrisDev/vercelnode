import express from "express";
import {
  fetchNotionDatabase,
  getRoomNames,
  parseDatesAndRoomsFromNotion,
  findEmptyDatesByRoom,
} from "../utils.js";

const router = express.Router();

router.get("/checkdate", async (req, res) => {
  try {
    const notionData = await fetchNotionDatabase(
      process.env.NOTION_API_KEY,
      process.env.MAIN_DATABASE_ID
    );
    console.log("Fetched notion data:", notionData); // Debugging line

    const dateEntries = parseDatesAndRoomsFromNotion(notionData);
    console.log("Parsed date entries:", dateEntries); // Debugging line

    if (!dateEntries || dateEntries.length === 0) {
      throw new Error("No valid date entries found");
    }

    const roomNames = await getRoomNames(
      process.env.NOTION_API_KEY,
      process.env.LISTINGS_DATABASE_ID
    );
    console.log("Fetched room names:", roomNames); // Debugging line

    const dateRangesByRoom = {};
    dateEntries.forEach(({ roomId, startDate, endDate }) => {
      const roomName = roomNames[roomId] || "Unknown Room";
      if (!dateRangesByRoom[roomName]) {
        dateRangesByRoom[roomName] = [];
      }
      dateRangesByRoom[roomName].push({ startDate, endDate });
    });
    console.log("Date ranges by room:", dateRangesByRoom); // Debugging line

    const emptyDatesByRoom = findEmptyDatesByRoom(dateRangesByRoom);
    console.log("Empty dates by room:", emptyDatesByRoom); // Debugging line

    res.json({ emptyDatesByRoom });
  } catch (error) {
    console.error("Error:", error.message); // Debugging line
    res
      .status(500)
      .json({ error: `Error fetching data from Notion: ${error.message}` });
  }
});

export default router;
