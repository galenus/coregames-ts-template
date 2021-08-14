import axios from "axios";
import { CoreAPI } from "./processors/core-api-declarations";

export const DEFAULT_API_DEFINITIONS_URL = "https://raw.githubusercontent.com/ManticoreGamesInc/platform-documentation/development/src/assets/api/CoreLuaAPI.json";

export default async function loadApiDefinitions(url = DEFAULT_API_DEFINITIONS_URL): Promise<CoreAPI> {
    const response = await axios.get(url);
    return response.data as CoreAPI;
}
