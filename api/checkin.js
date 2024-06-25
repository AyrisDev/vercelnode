import { fetchCheckInData, getRoomNames, getPersonNames } from "../utils.js";
import dotenv from "dotenv";

dotenv.config();

const {
  NOTION_API_KEY,
  MAIN_DATABASE_ID,
  LISTINGS_DATABASE_ID,
  PERSON_DATABASE_ID,
} = process.env;

export default async (req, res) => {
  try {
    const checkInData = await fetchCheckInData(
      NOTION_API_KEY,
      MAIN_DATABASE_ID
    );
    const roomNames = await getRoomNames(NOTION_API_KEY, LISTINGS_DATABASE_ID);
    const personNames = await getPersonNames(
      NOTION_API_KEY,
      PERSON_DATABASE_ID
    );

    if (checkInData.length === 0) {
      res
        .status(200)
        .json({
          message: "Bugün ve yarın için herhangi bir check-in bulunmamaktadır.",
        });
      return;
    }

    const response = checkInData.map((data) => {
      const roomName = roomNames[data.listings] || "Unknown Room";
      const personName = personNames[data.personId] || "Unknown Person";
      return {
        person: personName,
        checkDate: data.checkDate,
        listings: roomName,
      };
    });

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching check-in data from Notion:", error);
    res.status(500).json({ error: error.message });
  }
};
