import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
const WEBHOOK_URL = process.env.WEBHOOK_URL;

export async function getEmptyDatesFromApi() {
  const response = await fetch(
    "https://new-express-project-omega-nine.vercel.app/api/checkdate"
  );
  if (!response.ok) {
    throw new Error(`Error fetching data from API: ${response.statusText}`);
  }
  return response.json();
}
