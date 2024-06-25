const { Telegraf } = require("telegraf");
const fetch = require("node-fetch");
require("dotenv").config();

const WEBHOOK_URL = process.env.WEBHOOK_URL;
export async function getEmptyDatesFromApi() {
  const response = await fetch(`${WEBHOOK_URL}/api/checkdate`);
  if (!response.ok) {
    throw new Error(`Error fetching data from API: ${response.statusText}`);
  }
  return response.json();
}
